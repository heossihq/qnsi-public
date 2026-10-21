package qnsicore

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	DefaultBaseURL = "https://api.qnsi.heossi.com"
	ActivationPath = "/billing/v1/sdk/activate"
	DefaultTimeout = 15 * time.Second
	expiryBuffer   = 60 * time.Second
)

// SDKID and SDKVersion are set by the public root package via
// SetSDKIdentity. Defaults match the Go SDK's identifier so the package
// remains usable on its own (e.g. unit tests).
var (
	sdkIdentityMu sync.RWMutex
	sdkID         = "qnsp-go"
	sdkVersion    = "0.0.0"
)

// SetSDKIdentity is called from the public root package init() so the
// activation handshake reports the correct SDK id/version. It is safe to
// call from any goroutine but should normally fire once at startup.
func SetSDKIdentity(id, version string) {
	sdkIdentityMu.Lock()
	defer sdkIdentityMu.Unlock()
	if strings.TrimSpace(id) != "" {
		sdkID = id
	}
	if strings.TrimSpace(version) != "" {
		sdkVersion = version
	}
}

func currentSDKIdentity() (string, string) {
	sdkIdentityMu.RLock()
	defer sdkIdentityMu.RUnlock()
	return sdkID, sdkVersion
}

type ActivationResult struct {
	TenantID        string
	Tier            string
	Limits          map[string]any
	ActivationToken string
	ExpiresAt       time.Time
	Raw             map[string]any
}

type activationCache struct {
	mu     sync.Mutex
	cached *ActivationResult
}

type Activator struct {
	apiKey     string
	baseURL    string
	timeout    time.Duration
	httpClient *http.Client

	cache activationCache
}

func NewActivator(apiKey, baseURL string, timeout time.Duration, httpClient *http.Client) (*Activator, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("qnsp: api key required (sign up at https://cloud.qnsi.heossi.com/auth)")
	}
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	if timeout == 0 {
		timeout = DefaultTimeout
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: timeout}
	}
	return &Activator{
		apiKey:     apiKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		timeout:    timeout,
		httpClient: httpClient,
	}, nil
}

func (a *Activator) BaseURL() string          { return a.baseURL }
func (a *Activator) AuthHeader() string       { return "Bearer " + a.apiKey }
func (a *Activator) HTTPClient() *http.Client { return a.httpClient }

func (a *Activator) Get(ctx context.Context) (*ActivationResult, error) {
	a.cache.mu.Lock()
	defer a.cache.mu.Unlock()
	cached := a.cache.cached
	if cached != nil && time.Until(cached.ExpiresAt) > expiryBuffer {
		return cached, nil
	}
	return a.refresh(ctx)
}

func (a *Activator) Invalidate() {
	a.cache.mu.Lock()
	a.cache.cached = nil
	a.cache.mu.Unlock()
}

func (a *Activator) refresh(ctx context.Context) (*ActivationResult, error) {
	id, version := currentSDKIdentity()
	body, err := json.Marshal(map[string]any{
		"sdkId":      id,
		"sdkVersion": version,
		"runtime":    "go",
	})
	if err != nil {
		return nil, fmt.Errorf("qnsp: marshal activation body: %w", err)
	}

	url := a.baseURL + ActivationPath
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("qnsp: build activation request: %w", err)
	}
	req.Header.Set("authorization", a.AuthHeader())
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json")

	resp, err := doWithoutRedirects(a.httpClient, req)
	if err != nil {
		return nil, &NetworkError{Op: http.MethodPost, URL: url, Err: err}
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &NetworkError{Op: http.MethodPost, URL: url, Err: err}
	}

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, ParseAuthError(resp.StatusCode, respBody)
	}
	if resp.StatusCode >= 300 {
		return nil, ParseAPIError(resp.StatusCode, respBody)
	}

	var raw map[string]any
	if err := json.Unmarshal(respBody, &raw); err != nil {
		return nil, &APIError{StatusCode: resp.StatusCode, Message: "activation response not valid JSON"}
	}

	result, err := decodeActivation(raw)
	if err != nil {
		return nil, err
	}

	a.cache.cached = result
	return result, nil
}

func decodeActivation(raw map[string]any) (*ActivationResult, error) {
	tenantID, _ := raw["tenantId"].(string)
	if tenantID == "" {
		return nil, &APIError{StatusCode: 200, Message: "activation response missing tenantId"}
	}
	tier, _ := raw["tier"].(string)
	limits, _ := raw["limits"].(map[string]any)
	if limits == nil {
		limits = map[string]any{}
	}
	token, _ := raw["activationToken"].(string)

	var expires time.Time
	if expRaw, ok := raw["expiresAt"]; ok {
		expStr, valid := expRaw.(string)
		parsed, err := time.Parse(time.RFC3339, expStr)
		if !valid || err != nil || !parsed.After(time.Now()) {
			return nil, &APIError{StatusCode: 200, Message: "activation response has invalid expiresAt"}
		}
		expires = parsed
	} else {
		seconds, valid := raw["expiresInSeconds"].(float64)
		if !valid || math.IsNaN(seconds) || math.IsInf(seconds, 0) || seconds <= 0 || seconds >= float64(math.MaxInt64)/float64(time.Second) {
			return nil, &APIError{StatusCode: 200, Message: "activation response has invalid expiresInSeconds"}
		}
		lifetime := time.Duration(seconds * float64(time.Second))
		if lifetime <= 0 {
			return nil, &APIError{StatusCode: 200, Message: "activation response has invalid expiresInSeconds"}
		}
		expires = time.Now().Add(lifetime)
	}

	return &ActivationResult{
		TenantID:        tenantID,
		Tier:            tier,
		Limits:          limits,
		ActivationToken: token,
		ExpiresAt:       expires,
		Raw:             raw,
	}, nil
}

func ParseAuthError(status int, body []byte) error {
	var raw map[string]any
	_ = json.Unmarshal(body, &raw)
	code, _ := raw["code"].(string)
	msg, _ := raw["message"].(string)
	if msg == "" {
		msg = fmt.Sprintf("activation rejected (HTTP %d)", status)
	}
	return &AuthError{Code: code, Message: msg}
}

func ParseAPIError(status int, body []byte) error {
	var raw map[string]any
	_ = json.Unmarshal(body, &raw)
	code, _ := raw["code"].(string)
	msg, _ := raw["message"].(string)
	if msg == "" {
		if errStr, ok := raw["error"].(string); ok {
			msg = errStr
		} else {
			msg = fmt.Sprintf("HTTP %d", status)
		}
	}
	return &APIError{StatusCode: status, Code: code, Message: msg, Body: raw}
}
