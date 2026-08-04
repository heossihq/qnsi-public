// Package storage is the QNSP Storage client - PQC-encrypted object
// storage with SSE-X (server-side encryption with extended PQC).
//
// Wraps `apps/storage-service` (see /proxy/storage in production).
// Requires a billing tier with `sseEnabled: true` (see ClientLimits.SSE).
package storage

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

// PathPrefix is "/storage/storage/v1" on the edge gateway because the
// edge proxies "/storage" to the storage-service which itself mounts
// routes under "/storage". See edge-gateway proxy table.
const pathPrefix = "/proxy/storage/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// PutObjectRequest is the JSON body for PUT /storage/storage/v1/buckets/:bucket/objects/:key.
type PutObjectRequest struct {
	DataB64      string         `json:"dataB64"`
	ContentType  string         `json:"contentType,omitempty"`
	SSEAlgorithm string         `json:"sseAlgorithm,omitempty"` // e.g. "ml-kem-768"
	Metadata     map[string]any `json:"metadata,omitempty"`
}

func (c *Client) PutObject(ctx context.Context, bucket, key string, req PutObjectRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPut, "/buckets/"+bucket+"/objects/"+key, req, nil, idempotencyKey)
}

// GetObject returns the encrypted object descriptor and a base64-decoded
// payload. The convenience wrapper here only exposes the metadata-and-bytes
// shape used by short objects; for streaming, call Do() directly.
func (c *Client) GetObject(ctx context.Context, bucket, key string) ([]byte, map[string]any, error) {
	resp, err := c.base.Do(ctx, http.MethodGet, "/buckets/"+bucket+"/objects/"+key, nil, nil, "")
	if err != nil {
		return nil, nil, err
	}
	dataB64, _ := resp["dataB64"].(string)
	if dataB64 == "" {
		return nil, resp, fmt.Errorf("qnsp: storage.GetObject: response missing dataB64")
	}
	body, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return nil, resp, fmt.Errorf("qnsp: storage.GetObject: dataB64 not valid base64: %w", err)
	}
	return body, resp, nil
}

func (c *Client) DeleteObject(ctx context.Context, bucket, key string) error {
	_, err := c.base.Do(ctx, http.MethodDelete, "/buckets/"+bucket+"/objects/"+key, nil, nil, "")
	return err
}

func (c *Client) ListObjects(ctx context.Context, bucket string, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/buckets/"+bucket+"/objects", nil, query, "")
}

func (c *Client) ListBuckets(ctx context.Context) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/buckets", nil, nil, "")
}

// Do exposes the underlying service client for endpoints not yet wrapped.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
