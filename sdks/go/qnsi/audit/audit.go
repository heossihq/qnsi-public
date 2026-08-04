// Package audit is the QNSP Audit client - immutable, hash-chained event log.
package audit

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/audit/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

type LogEventRequest struct {
	EventType string         `json:"eventType"`
	Payload   map[string]any `json:"payload"`
	Tags      []string       `json:"tags,omitempty"`
}

func (c *Client) LogEvent(ctx context.Context, req LogEventRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/events", req, nil, idempotencyKey)
}

func (c *Client) IngestEvents(ctx context.Context, events []LogEventRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/events/batch", map[string]any{"events": events}, nil, idempotencyKey)
}

func (c *Client) ListEvents(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/events", nil, query, "")
}
