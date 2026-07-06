package qnsicore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ServiceClient is the shared HTTP plumbing every submodule embeds.
type ServiceClient struct {
	Activator  *Activator
	HTTPClient *http.Client
	PathPrefix string // e.g. "/vault/v1"
	Timeout    time.Duration
}

func NewServiceClient(act *Activator, httpClient *http.Client, pathPrefix string, timeout time.Duration) *ServiceClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: timeout}
	}
	return &ServiceClient{
		Activator:  act,
		HTTPClient: httpClient,
		PathPrefix: pathPrefix,
		Timeout:    timeout,
	}
}

// Do executes an authenticated request and returns the decoded JSON body.
// A 401 triggers a one-shot retry after invalidating the activation cache.
func (c *ServiceClient) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	act, err := c.Activator.Get(ctx)
	if err != nil {
		return nil, err
	}

	resp, err := c.send(ctx, method, path, body, query, idempotencyKey, act.TenantID)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		c.Activator.Invalidate()
		reAct, rerr := c.Activator.Get(ctx)
		if rerr != nil {
			return nil, rerr
		}
		resp, err = c.send(ctx, method, path, body, query, idempotencyKey, reAct.TenantID)
		if err != nil {
			return nil, err
		}
	}

	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var raw map[string]any
		_ = json.Unmarshal(respBody, &raw)
		code, _ := raw["code"].(string)
		msg, _ := raw["message"].(string)
		if msg == "" {
			if e, ok := raw["error"].(string); ok {
				msg = e
			} else {
				msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
		}
		return nil, &APIError{StatusCode: resp.StatusCode, Code: code, Message: msg, Body: raw}
	}

	if resp.StatusCode == http.StatusNoContent || len(respBody) == 0 {
		return map[string]any{}, nil
	}
	var out any
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, &APIError{StatusCode: resp.StatusCode, Message: "response not valid JSON"}
	}
	switch v := out.(type) {
	case map[string]any:
		return v, nil
	default:
		return map[string]any{"_raw": v}, nil
	}
}

// SessionDo executes a request authenticated by a user SESSION (a JWT obtained from auth login)
// rather than the api-key, against an ABSOLUTE path (BaseURL + path, NOT the service PathPrefix).
// Used by the auth client for /edge/auth/* (login/refresh — no bearer yet) and /auth/* (revoke /
// mfa / risk — session bearer + the x-qnsp-tenant-id header). bearer/tenantID are omitted when "".
func (c *ServiceClient) SessionDo(ctx context.Context, method, path string, body any, query map[string]string, bearer, tenantID string) (map[string]any, error) {
	target := c.Activator.BaseURL() + path
	if len(query) > 0 {
		q := url.Values{}
		for k, v := range query {
			if v == "" {
				continue
			}
			q.Set(k, v)
		}
		if encoded := q.Encode(); encoded != "" {
			sep := "?"
			if strings.Contains(target, "?") {
				sep = "&"
			}
			target = target + sep + encoded
		}
	}

	var reader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("qnsp: marshal request body: %w", err)
		}
		reader = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return nil, fmt.Errorf("qnsp: build request: %w", err)
	}
	if bearer != "" {
		req.Header.Set("authorization", "Bearer "+bearer)
	}
	if tenantID != "" {
		req.Header.Set("x-qnsp-tenant-id", tenantID)
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, &NetworkError{Op: method, URL: target, Err: err}
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var raw map[string]any
		_ = json.Unmarshal(respBody, &raw)
		code, _ := raw["code"].(string)
		msg, _ := raw["message"].(string)
		if msg == "" {
			if e, ok := raw["error"].(string); ok {
				msg = e
			} else {
				msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
		}
		return nil, &APIError{StatusCode: resp.StatusCode, Code: code, Message: msg, Body: raw}
	}
	if resp.StatusCode == http.StatusNoContent || len(respBody) == 0 {
		return map[string]any{}, nil
	}
	var out any
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, &APIError{StatusCode: resp.StatusCode, Message: "response not valid JSON"}
	}
	if m, ok := out.(map[string]any); ok {
		return m, nil
	}
	return map[string]any{"_raw": out}, nil
}

func (c *ServiceClient) send(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey, tenantID string) (*http.Response, error) {
	target := c.Activator.BaseURL() + c.PathPrefix + path
	// Backend read/write routes scope by tenantId — in the GET query and in write bodies. Inject
	// the activated tenant centrally so every call carries it (mirrors @heossi/qnsp + the JVM
	// SDK); caller-supplied values win. Without this, kms/vault list+create 400 "missing tenant".
	q := url.Values{}
	for k, v := range query {
		if v != "" {
			q.Set(k, v)
		}
	}
	if tenantID != "" && q.Get("tenantId") == "" {
		q.Set("tenantId", tenantID)
	}
	if encoded := q.Encode(); encoded != "" {
		sep := "?"
		if strings.Contains(target, "?") {
			sep = "&"
		}
		target = target + sep + encoded
	}

	bodyToSend := body
	if body != nil && tenantID != "" {
		bodyToSend = injectTenantID(body, tenantID)
	}

	var reader io.Reader
	if bodyToSend != nil {
		buf, err := json.Marshal(bodyToSend)
		if err != nil {
			return nil, fmt.Errorf("qnsp: marshal request body: %w", err)
		}
		reader = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return nil, fmt.Errorf("qnsp: build request: %w", err)
	}
	req.Header.Set("authorization", c.Activator.AuthHeader())
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json")
	if idempotencyKey != "" {
		req.Header.Set("idempotency-key", idempotencyKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, &NetworkError{Op: method, URL: target, Err: err}
	}
	return resp, nil
}

// injectTenantID adds the activated tenantId to a JSON-object body when absent (caller-supplied
// wins). Bodies that don't marshal to a JSON object (nil, arrays, scalars) pass through unchanged.
func injectTenantID(body any, tenantID string) any {
	raw, err := json.Marshal(body)
	if err != nil {
		return body
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil || m == nil {
		return body
	}
	if _, ok := m["tenantId"]; !ok {
		m["tenantId"] = tenantID
	}
	return m
}
