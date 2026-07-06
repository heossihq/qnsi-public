// Package billing is the QNSP Billing client — entitlement queries,
// usage meters, invoice listing, and credit balance.
//
// Wraps `apps/billing-service` (see /proxy/billing in production). Note
// that the activation handshake performed by qnsp.Client already gives
// you the tenant tier and limits via Client.Limits(); this module
// covers the deeper billing surface (meters, invoices, credits).
package billing

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/billing/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// GetEntitlements returns the tenant's full entitlement record (tier,
// add-ons, feature flags, limits). Mirrors the data used by the cloud
// portal's `useBootstrap()` hook.
func (c *Client) GetEntitlements(ctx context.Context) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/entitlements", nil, nil, "")
}

// IngestMeter records a single usage meter (legacy single-event variant).
// For high-volume ingest, use IngestMeters.
type IngestMeterRequest struct {
	MeterID    string         `json:"meterId"`
	Quantity   float64        `json:"quantity"`
	OccurredAt string         `json:"occurredAt,omitempty"` // RFC 3339; defaults to now
	Metadata   map[string]any `json:"metadata,omitempty"`
}

func (c *Client) IngestMeter(ctx context.Context, req IngestMeterRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/meters", req, nil, idempotencyKey)
}

// IngestMeters records a batch of usage meters in one round trip.
func (c *Client) IngestMeters(ctx context.Context, meters []IngestMeterRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/meters/batch", map[string]any{"meters": meters}, nil, idempotencyKey)
}

// ListInvoices returns invoices for the calling tenant. Supported query
// parameters include `status`, `from`, `to`, `cursor`, `limit`.
func (c *Client) ListInvoices(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/invoices", nil, query, "")
}

// GetInvoice returns a single invoice by ID.
func (c *Client) GetInvoice(ctx context.Context, invoiceID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/invoices/"+invoiceID, nil, nil, "")
}

// GetCreditBalance returns the tenant's outstanding credit balance.
func (c *Client) GetCreditBalance(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/credits/balance/"+tenantID, nil, nil, "")
}

// Do exposes the underlying service client for endpoints not yet wrapped.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
