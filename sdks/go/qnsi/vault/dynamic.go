package vault

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
)

// DynamicSecretConfigRequest uses an approved connection reference, not inline admin credentials.
type DynamicSecretConfigRequest struct {
	Name              string         `json:"name"`
	EngineType        string         `json:"engineType"`
	ConnectionRef     string         `json:"connectionRef"`
	SecretType        string         `json:"secretType,omitempty"`
	RoleTemplate      map[string]any `json:"roleTemplate,omitempty"`
	DefaultTTLSeconds *int           `json:"defaultTtlSeconds,omitempty"`
	MaxTTLSeconds     *int           `json:"maxTtlSeconds,omitempty"`
	TenantID          string         `json:"tenantId,omitempty"`
}

type DynamicCredentialsRequest struct {
	TTLSeconds *int           `json:"ttlSeconds,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

func dynamicPathSegment(value string) (string, error) {
	if value == "" || value == "." || value == ".." {
		return "", errors.New("qnsi: empty or dot-segment Vault resource identifier")
	}
	return url.PathEscape(value), nil
}

// ListDynamicSecretEngines returns server registration state, not provider-account assurance.
func (c *Client) ListDynamicSecretEngines(ctx context.Context) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/dynamic-secrets/engines", nil, nil, "")
}

func (c *Client) CreateDynamicSecretConfig(ctx context.Context, request DynamicSecretConfigRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/dynamic-secrets/configs", request, nil, idempotencyKey)
}

func (c *Client) ListDynamicSecretConfigs(ctx context.Context, engineType, secretType string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/dynamic-secrets/configs", nil, map[string]string{"engineType": engineType, "secretType": secretType}, "")
}

// RequestCredentials preserves engine-specific fields; it does not assume username/password.
func (c *Client) RequestCredentials(ctx context.Context, configID string, request DynamicCredentialsRequest, idempotencyKey string) (map[string]any, error) {
	segment, err := dynamicPathSegment(configID)
	if err != nil {
		return nil, err
	}
	return c.base.Do(ctx, http.MethodPost, "/dynamic-secrets/configs/"+segment+"/credentials", request, nil, idempotencyKey)
}

// ListLeases optionally exposes recovery and terminal lifecycle states.
func (c *Client) ListLeases(ctx context.Context, configID string, includeAllStatuses *bool) (map[string]any, error) {
	segment, err := dynamicPathSegment(configID)
	if err != nil {
		return nil, err
	}
	query := map[string]string{}
	if includeAllStatuses != nil {
		query["includeAllStatuses"] = strconv.FormatBool(*includeAllStatuses)
	}
	return c.base.Do(ctx, http.MethodGet, "/dynamic-secrets/configs/"+segment+"/leases", nil, query, "")
}

func (c *Client) RenewLease(ctx context.Context, leaseID string, ttlSeconds *int) (map[string]any, error) {
	segment, err := dynamicPathSegment(leaseID)
	if err != nil {
		return nil, err
	}
	body := map[string]any{}
	if ttlSeconds != nil {
		body["ttlSeconds"] = *ttlSeconds
	}
	return c.base.Do(ctx, http.MethodPost, "/dynamic-secrets/leases/"+segment+"/renew", body, nil, "")
}

// RevokeLease returns the queued revoking acknowledgement, not completed invalidation.
func (c *Client) RevokeLease(ctx context.Context, leaseID string) (map[string]any, error) {
	segment, err := dynamicPathSegment(leaseID)
	if err != nil {
		return nil, err
	}
	return c.base.Do(ctx, http.MethodPost, "/dynamic-secrets/leases/"+segment+"/revoke", nil, nil, "")
}

func (c *Client) GetDynamicSecretStats(ctx context.Context) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/dynamic-secrets/stats", nil, nil, "")
}
