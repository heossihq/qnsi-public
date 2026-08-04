// Package auth is the QNSP Auth client - password login, JWT session refresh/revocation, MFA,
// and risk-based authentication.
//
// Routes are mapped to the real auth-service surface verified against production (reaudit
// 2026-06-13 #32/#34/#36): login/refresh hit /edge/auth/* with credentials/refresh-token in the
// body and NO auth header (the session does not exist yet); revoke/mfa/risk hit bare /auth/* and
// require the session JWT (Bearer) plus the x-qnsp-tenant-id header. Call Login first; this client
// caches the resulting session and uses it automatically.
//
// WebAuthn passkeys (#33) and SAML/OIDC federation (#35) are intentionally NOT exposed. The real
// backend surfaces are /auth/webauthn/* (a browser authenticator ceremony - navigator.credentials,
// not driveable from a server-side api-key SDK) and /auth/federation/scim|saml/acs (a SCIM/SAML-ACS
// provisioning + callback API, not a per-call SDK surface). They were removed rather than ship dead
// endpoints (the old /passkeys/* and /federate/* paths did not exist on the backend).
package auth

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

// Client is the QNSP auth client.
type Client struct {
	base *qnsicore.ServiceClient
	mu   sync.RWMutex
	sess *Session
}

// Session is the cached login session (JWT + tenant) used by the post-login operations.
type Session struct {
	AccessToken  string
	RefreshToken string
	TenantID     string
}

// New constructs an auth client. The auth surface uses absolute /edge/auth/* and /auth/* paths
// via SessionDo, so the service path prefix is empty.
func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, "", timeout)}
}

// LoginRequest is the JSON body for POST /edge/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	TenantID string `json:"tenantId"`
}

// GetSession returns the current cached session, or nil until Login succeeds.
func (c *Client) GetSession() *Session {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.sess
}

// tokenString extracts a token that may be a bare string or an object {"token": "…"}.
func tokenString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case map[string]any:
		if s, ok := t["token"].(string); ok {
			return s
		}
	}
	return ""
}

// Login authenticates a user with email + password and caches the session so subsequent ops
// (Revoke, MfaChallenge, EvaluateRisk, …) authenticate automatically. POST /edge/auth/login.
func (c *Client) Login(ctx context.Context, req LoginRequest) (map[string]any, error) {
	body, err := c.base.SessionDo(ctx, http.MethodPost, "/edge/auth/login", req, nil, "", "")
	if err != nil {
		return nil, err
	}
	if access := tokenString(body["accessToken"]); access != "" {
		c.mu.Lock()
		c.sess = &Session{AccessToken: access, RefreshToken: tokenString(body["refreshToken"]), TenantID: req.TenantID}
		c.mu.Unlock()
	}
	return body, nil
}

// RefreshToken exchanges a refresh token for a new access token. POST /edge/auth/token/refresh.
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (map[string]any, error) {
	body, err := c.base.SessionDo(ctx, http.MethodPost, "/edge/auth/token/refresh", map[string]any{"refreshToken": refreshToken}, nil, "", "")
	if err != nil {
		return nil, err
	}
	if access := tokenString(body["accessToken"]); access != "" {
		c.mu.Lock()
		if c.sess != nil {
			c.sess.AccessToken = access
			if nr := tokenString(body["refreshToken"]); nr != "" {
				c.sess.RefreshToken = nr
			}
		}
		c.mu.Unlock()
	}
	return body, nil
}

func (c *Client) requireSession() (*Session, error) {
	s := c.GetSession()
	if s == nil {
		return nil, fmt.Errorf("qnsp: not logged in - call auth.Login first")
	}
	return s, nil
}

// Revoke invalidates a refresh token (session-authenticated). POST /auth/token/revoke.
func (c *Client) Revoke(ctx context.Context, refreshToken string) error {
	s, err := c.requireSession()
	if err != nil {
		return err
	}
	_, err = c.base.SessionDo(ctx, http.MethodPost, "/auth/token/revoke", map[string]any{"token": refreshToken}, nil, s.AccessToken, s.TenantID)
	return err
}

func (c *Client) sessionPost(ctx context.Context, path string, body map[string]any) (map[string]any, error) {
	s, err := c.requireSession()
	if err != nil {
		return nil, err
	}
	return c.base.SessionDo(ctx, http.MethodPost, path, body, nil, s.AccessToken, s.TenantID)
}

// MfaChallenge issues an MFA challenge (session-authenticated). POST /auth/mfa/challenge.
func (c *Client) MfaChallenge(ctx context.Context, body map[string]any) (map[string]any, error) {
	return c.sessionPost(ctx, "/auth/mfa/challenge", body)
}

// MfaVerify validates an MFA challenge response (session-authenticated). POST /auth/mfa/verify.
func (c *Client) MfaVerify(ctx context.Context, body map[string]any) (map[string]any, error) {
	return c.sessionPost(ctx, "/auth/mfa/verify", body)
}

// EvaluateRisk computes a risk score for an authentication event (session). POST /auth/risk/evaluate.
func (c *Client) EvaluateRisk(ctx context.Context, body map[string]any) (map[string]any, error) {
	return c.sessionPost(ctx, "/auth/risk/evaluate", body)
}

// ListRiskPolicies returns the configured risk policies for the tenant (session). GET /auth/risk/policies.
func (c *Client) ListRiskPolicies(ctx context.Context) (map[string]any, error) {
	s, err := c.requireSession()
	if err != nil {
		return nil, err
	}
	return c.base.SessionDo(ctx, http.MethodGet, "/auth/risk/policies", nil, nil, s.AccessToken, s.TenantID)
}
