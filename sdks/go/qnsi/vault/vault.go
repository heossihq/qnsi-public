// Package vault is the QNSP Vault client — PQC-encrypted secret storage
// with versioning, rotation, and deletion.
package vault

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/vault/v1"

// Client is the QNSP vault client.
type Client struct {
	base *qnsicore.ServiceClient
}

// New constructs a vault client that shares an Activator and HTTP client
// with the parent qnsp.Client.
func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// CreateSecretRequest is the JSON body for POST /vault/v1/secrets.
type CreateSecretRequest struct {
	Name       string         `json:"name"`
	PayloadB64 string         `json:"payloadB64"`
	Algorithm  string         `json:"algorithm,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

func (c *Client) CreateSecret(ctx context.Context, req CreateSecretRequest, idempotencyKey string) (map[string]any, error) {
	// Wire contract: createSecretSchema = { tenantId(auto-injected), name(min3), payload, metadata,
	// rotationPolicy(default) }. Map the SDK's PayloadB64 -> payload; fold algorithm into metadata.
	// (Sending the raw struct put the value under "payloadB64", which the schema strips -> the
	// secret stored an empty payload.)
	metadata := map[string]any{}
	for k, v := range req.Metadata {
		metadata[k] = v
	}
	if req.Algorithm != "" {
		metadata["algorithm"] = req.Algorithm
	}
	body := map[string]any{"name": req.Name, "payload": req.PayloadB64}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	return c.base.Do(ctx, http.MethodPost, "/secrets", body, nil, idempotencyKey)
}

func (c *Client) GetSecret(ctx context.Context, secretID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/secrets/"+secretID, nil, nil, "")
}

func (c *Client) GetSecretVersion(ctx context.Context, secretID string, version int) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/secrets/"+secretID+"/versions/"+strconv.Itoa(version), nil, nil, "")
}

func (c *Client) RotateSecret(ctx context.Context, secretID string, payloadB64, algorithm string, idempotencyKey string) (map[string]any, error) {
	// Wire contract: rotateSecretSchema = { tenantId(auto), newPayload?, metadata?, rotationPolicy? }.
	// Map payloadB64 -> newPayload; fold algorithm into metadata.
	body := map[string]any{"newPayload": payloadB64}
	if algorithm != "" {
		body["metadata"] = map[string]any{"algorithm": algorithm}
	}
	return c.base.Do(ctx, http.MethodPost, "/secrets/"+secretID+"/rotate", body, nil, idempotencyKey)
}

func (c *Client) DeleteSecret(ctx context.Context, secretID string) error {
	_, err := c.base.Do(ctx, http.MethodDelete, "/secrets/"+secretID, nil, nil, "")
	return err
}

func (c *Client) ListSecretVersions(ctx context.Context, secretID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/secrets/"+secretID+"/versions", nil, nil, "")
}
