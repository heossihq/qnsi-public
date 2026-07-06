// Package cryptoinventory is the QNSP Crypto-Inventory client — the
// Cryptographic Bill of Materials (CBOM): asset catalogue, discovery
// runs, deprecation policies, and PQC migration readiness.
//
// Wraps `apps/crypto-inventory-service` (see /proxy/crypto in production).
// Requires the `crypto-attestation-cbom` add-on for full functionality.
package cryptoinventory

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/crypto/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// ListAssets returns the page of CBOM assets matching the supplied
// query (algorithm, host, status, etc.). Pagination is cursor-based.
func (c *Client) ListAssets(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/assets", nil, query, "")
}

// GetAsset returns a single asset by ID.
func (c *Client) GetAsset(ctx context.Context, assetID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/assets/"+assetID, nil, nil, "")
}

// GetAssetStats returns aggregate counts for the tenant's CBOM
// (e.g. by algorithm, by status). Mirrors the data used by the
// `Crypto Inventory` cloud-portal page.
func (c *Client) GetAssetStats(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/assets/stats/"+tenantID, nil, nil, "")
}

// DiscoverAssetsRequest triggers a discovery run.
type DiscoverAssetsRequest struct {
	Targets []string       `json:"targets,omitempty"`
	Modes   []string       `json:"modes,omitempty"` // "tls", "ssh", "code", "config"
	Options map[string]any `json:"options,omitempty"`
}

func (c *Client) DiscoverAssets(ctx context.Context, req DiscoverAssetsRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/discovery/runs", req, nil, idempotencyKey)
}

// GetReadinessScore returns the tenant's PQC migration readiness score.
func (c *Client) GetReadinessScore(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/readiness/"+tenantID, nil, nil, "")
}

// Do exposes the underlying service client for endpoints not yet wrapped.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
