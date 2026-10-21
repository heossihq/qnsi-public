package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const authEdgePrefix = "/proxy/auth"

// PasskeyRegistrationRequest binds the ceremony to an explicit account/workspace.
type PasskeyRegistrationRequest struct {
	UserID   string `json:"userId"`
	TenantID string `json:"tenantId"`
}

// PasskeyRegistrationCompleteRequest carries the real platform authenticator response.
type PasskeyRegistrationCompleteRequest struct {
	UserID      string `json:"userId"`
	TenantID    string `json:"tenantId"`
	ChallengeID string `json:"challengeId"`
	Response    any    `json:"response"`
}

type PasskeyAuthenticationRequest struct {
	UserID   string `json:"userId,omitempty"`
	Email    string `json:"email,omitempty"`
	TenantID string `json:"tenantId"`
}

type PasskeyAuthenticationCompleteRequest struct {
	UserID      string `json:"userId,omitempty"`
	Email       string `json:"email,omitempty"`
	TenantID    string `json:"tenantId"`
	ChallengeID string `json:"challengeId"`
	Response    any    `json:"response"`
}

type FederationStartRequest struct {
	ProviderID  string `json:"providerId"`
	RedirectURI string `json:"redirectUri,omitempty"`
	ACSURL      string `json:"acsUrl,omitempty"`
	LoginHint   string `json:"loginHint,omitempty"`
	RelayState  string `json:"relayState,omitempty"`
}

type OIDCCallbackRequest struct {
	ProviderID string `json:"providerId"`
	Code       string `json:"code"`
	State      string `json:"state"`
	LinkMode   bool   `json:"linkMode,omitempty"`
}

// scopedRequest requires a cached session and rejects a different tenant before HTTP.
func (c *Client) scopedRequest(ctx context.Context, method, path string, body any, query map[string]string, tenantID string) (map[string]any, error) {
	session, err := c.requireSession()
	if err != nil {
		return nil, err
	}
	if tenantID == "" || session.TenantID != tenantID {
		return nil, fmt.Errorf("qnsi: requested tenant does not match the current session")
	}
	return c.base.SessionDo(ctx, method, authEdgePrefix+path, body, query, session.AccessToken, tenantID)
}

func workflowSegment(value string) (string, error) {
	if strings.TrimSpace(value) == "" || value == "." || value == ".." {
		return "", fmt.Errorf("qnsi: a nonempty resource identifier is required")
	}
	return url.PathEscape(value), nil
}

func (c *Client) RegisterPasskeyStart(ctx context.Context, req PasskeyRegistrationRequest) (map[string]any, error) {
	return c.scopedRequest(ctx, http.MethodPost, "/webauthn/register/start", req, nil, req.TenantID)
}

func (c *Client) RegisterPasskeyComplete(ctx context.Context, req PasskeyRegistrationCompleteRequest) (map[string]any, error) {
	return c.scopedRequest(ctx, http.MethodPost, "/webauthn/register/complete", req, nil, req.TenantID)
}

func (c *Client) AuthenticatePasskeyStart(ctx context.Context, req PasskeyAuthenticationRequest) (map[string]any, error) {
	return c.base.SessionDo(ctx, http.MethodPost, authEdgePrefix+"/webauthn/authenticate/start", req, nil, "", "")
}

func (c *Client) AuthenticatePasskeyComplete(ctx context.Context, req PasskeyAuthenticationCompleteRequest) (map[string]any, error) {
	body, err := c.base.SessionDo(ctx, http.MethodPost, authEdgePrefix+"/webauthn/authenticate/complete", req, nil, "", "")
	if err != nil {
		return nil, err
	}
	if verified, ok := body["verified"].(bool); !ok || !verified {
		return nil, fmt.Errorf("qnsi: passkey authentication did not return a valid verification result")
	}
	if err := c.AdoptSession(ctx, Session{AccessToken: tokenString(body["accessToken"]), RefreshToken: tokenString(body["refreshToken"]), TenantID: req.TenantID}); err != nil {
		return nil, err
	}
	return body, nil
}

func (c *Client) ListPasskeys(ctx context.Context, userID, tenantID string) (map[string]any, error) {
	segment, err := workflowSegment(userID)
	if err != nil {
		return nil, err
	}
	return c.scopedRequest(ctx, http.MethodGet, "/webauthn/credentials/"+segment, nil, map[string]string{"tenantId": tenantID}, tenantID)
}

func (c *Client) DeletePasskey(ctx context.Context, credentialID, userID, tenantID string) error {
	segment, err := workflowSegment(credentialID)
	if err != nil {
		return err
	}
	_, err = c.scopedRequest(ctx, http.MethodDelete, "/webauthn/credentials/"+segment, nil, map[string]string{"userId": userID, "tenantId": tenantID}, tenantID)
	return err
}

func (c *Client) DiscoverFederationProviders(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.SessionDo(ctx, http.MethodGet, authEdgePrefix+"/federation/public/providers", nil, map[string]string{"tenantId": tenantID}, "", "")
}

// StartFederation returns the backend's external IdP URL and state; it never follows it.
func (c *Client) StartFederation(ctx context.Context, req FederationStartRequest) (map[string]any, error) {
	return c.base.SessionDo(ctx, http.MethodPost, authEdgePrefix+"/federation/public/start", req, nil, "", "")
}

// CompleteOIDC preserves server-held state/PKCE. An explicit expected tenant is
// checked against current signed human authority before installing a session.
func (c *Client) CompleteOIDC(ctx context.Context, req OIDCCallbackRequest, expectedTenantID string) (map[string]any, error) {
	if expectedTenantID == "" {
		return nil, fmt.Errorf("qnsi: expected tenant is required")
	}
	var bearer string
	if req.LinkMode {
		session, err := c.requireSession()
		if err != nil {
			return nil, err
		}
		if session.TenantID != expectedTenantID {
			return nil, fmt.Errorf("qnsi: linking tenant does not match the current session")
		}
		bearer = session.AccessToken
	}
	body, err := c.base.SessionDo(ctx, http.MethodPost, authEdgePrefix+"/federation/oidc/callback", req, nil, bearer, "")
	if err != nil {
		return nil, err
	}
	if !req.LinkMode {
		if err := c.AdoptSession(ctx, Session{AccessToken: tokenString(body["accessToken"]), RefreshToken: tokenString(body["refreshToken"]), TenantID: expectedTenantID}); err != nil {
			return nil, err
		}
	}
	return body, nil
}

// AdoptSession verifies current backend human authority; it does not decode
// unverified JWT claims or treat a metadata tenant as an authorization grant.
// It does not constitute tenant approval for provisioning or production canaries.
func (c *Client) AdoptSession(ctx context.Context, session Session) error {
	if strings.TrimSpace(session.AccessToken) == "" || strings.TrimSpace(session.TenantID) == "" {
		return fmt.Errorf("qnsi: access token and expected tenant are required")
	}
	body, err := c.base.SessionDo(ctx, http.MethodGet, authEdgePrefix+"/session", nil, nil, session.AccessToken, session.TenantID)
	if err != nil {
		return err
	}
	user, ok := body["user"].(map[string]any)
	if !ok || user["tenantId"] != session.TenantID || user["status"] != "active" {
		return fmt.Errorf("qnsi: current human authority does not match the expected tenant")
	}
	if id, ok := user["id"].(string); !ok || strings.TrimSpace(id) == "" {
		return fmt.Errorf("qnsi: current human authority has no account binding")
	}
	c.mu.Lock()
	copy := session
	c.sess = &copy
	c.mu.Unlock()
	return nil
}
