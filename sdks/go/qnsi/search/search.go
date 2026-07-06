// Package search is the QNSP Search client — encrypted vector search
// with SSE-X.
//
// Wraps `apps/search-service` (see /proxy/search in production).
// Requires the `vector-sse-x-search` add-on.
package search

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/search/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// CreateIndexRequest is the JSON body for POST /search/v1/indexes.
type CreateIndexRequest struct {
	Name        string         `json:"name"`
	Dimensions  int            `json:"dimensions"`
	Metric      string         `json:"metric,omitempty"` // "cosine" | "l2" | "dot"
	Algorithm   string         `json:"algorithm,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

func (c *Client) CreateIndex(ctx context.Context, req CreateIndexRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/indexes", req, nil, idempotencyKey)
}

func (c *Client) ListIndexes(ctx context.Context) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/indexes", nil, nil, "")
}

func (c *Client) DeleteIndex(ctx context.Context, indexName string) error {
	_, err := c.base.Do(ctx, http.MethodDelete, "/indexes/"+indexName, nil, nil, "")
	return err
}

// UpsertVectorsRequest pushes a batch of vectors into an index.
type UpsertVectorsRequest struct {
	Vectors []Vector `json:"vectors"`
}

type Vector struct {
	ID       string         `json:"id"`
	Values   []float32      `json:"values"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

func (c *Client) UpsertVectors(ctx context.Context, indexName string, req UpsertVectorsRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/indexes/"+indexName+"/vectors", req, nil, idempotencyKey)
}

// QueryRequest is the JSON body for POST /search/v1/indexes/:name/query.
type QueryRequest struct {
	Vector []float32      `json:"vector"`
	TopK   int            `json:"topK"`
	Filter map[string]any `json:"filter,omitempty"`
}

func (c *Client) Query(ctx context.Context, indexName string, req QueryRequest) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/indexes/"+indexName+"/query", req, nil, "")
}

// Do exposes the underlying service client for endpoints not yet wrapped.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
