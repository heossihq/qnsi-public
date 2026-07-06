package qnsicore

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	cached := a.cache.cached
	if cached != nil && time.Until(cached.ExpiresAt) > expiryBuffer {
		a.cache.mu.Unlock()
		return cached, nil
	}
	a.cache.mu.Unlock()
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

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, &NetworkError{Op: http.MethodPost, URL: url, Err: err}
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, ParseAuthError(resp.StatusCode, respBody)
	}
	if resp.StatusCode >= 400 {
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

	a.cache.mu.Lock()
	a.cache.cached = result
	a.cache.mu.Unlock()
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
		if expStr, ok := expRaw.(string); ok {
			parsed, err := time.Parse(time.RFC3339, expStr)
			if err == nil {
				expires = parsed
			}
		}
	}
	if expires.IsZero() {
		expires = time.Now().Add(5 * time.Minute)
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
