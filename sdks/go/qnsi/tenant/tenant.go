// Package tenant is the QNSP Tenant client — tenant CRUD, crypto-policy
// management, sub-tenant onboarding, and quota / health introspection.
//
// This module wraps the routes exposed by `apps/tenant-service` (see
// /proxy/tenant in production). Most methods are reserved for tenants
// that manage sub-tenants on the QNSP platform; consult the QNSP API
// docs for the policy that gates each route.
package tenant

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/tenant/v1"

// Client is the QNSP tenant client.
type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// CreateTenantRequest is the JSON body for POST /tenant/v1/tenants.
type CreateTenantRequest struct {
	Name           string         `json:"name"`
	Slug           string         `json:"slug,omitempty"`
	Tier           string         `json:"tier,omitempty"`
	ParentTenantID string         `json:"parentTenantId,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

// CreateTenant provisions a new tenant. Available to customers with the
// `tenant.subTenants` capability.
func (c *Client) CreateTenant(ctx context.Context, req CreateTenantRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/tenants", req, nil, idempotencyKey)
}

// GetTenant returns a tenant by ID.
func (c *Client) GetTenant(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/tenants/"+tenantID, nil, nil, "")
}

// UpdateTenant patches the tenant record. Use null/omitted fields to
// leave them unchanged.
func (c *Client) UpdateTenant(ctx context.Context, tenantID string, body map[string]any, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPatch, "/tenants/"+tenantID, body, nil, idempotencyKey)
}

// ListTenants returns the page of tenants the caller is allowed to view.
// Pagination is cursor-based: if the response includes `nextCursor`,
// pass it as `query["cursor"]` on the next call.
func (c *Client) ListTenants(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/tenants", nil, query, "")
}

// GetCryptoPolicy returns the canonical crypto policy for a tenant
// (default | strict | maximum | government).
func (c *Client) GetCryptoPolicy(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/tenants/"+tenantID+"/crypto-policy", nil, nil, "")
}

// UpsertCryptoPolicy creates or replaces the crypto policy of a tenant.
// Requires the appropriate billing tier (see `.claude/rules/product.md`).
func (c *Client) UpsertCryptoPolicy(ctx context.Context, tenantID string, body map[string]any, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPut, "/tenants/"+tenantID+"/crypto-policy", body, nil, idempotencyKey)
}

// GetCurrentHealth returns the latest tenant-health snapshot.
func (c *Client) GetCurrentHealth(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/tenants/"+tenantID+"/health", nil, nil, "")
}

// GetCurrentQuotas returns the live quota usage for the tenant.
func (c *Client) GetCurrentQuotas(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/tenants/"+tenantID+"/quotas", nil, nil, "")
}

// Do exposes the underlying service client for endpoints that this
// SDK does not yet wrap. The path is appended to "/tenant/v1".
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
