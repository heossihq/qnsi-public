// Package ai is the QNSP AI Orchestrator client — model registry, AI
// workload submission with enclave attestation, inference, and bias /
// prompt-injection monitoring.
package ai

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/ai/v1"

// Client is the QNSP AI Orchestrator client.
type Client struct {
	base *qnsicore.ServiceClient
}

// New constructs an AI client.
func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// ── Model registry ──────────────────────────────────────────────────

// RegisterModelRequest is the JSON body for POST /ai/v1/models.
type RegisterModelRequest struct {
	Name         string         `json:"name"`
	Version      string         `json:"version"`
	Provider     string         `json:"provider"` // e.g. "openai", "anthropic", "local"
	Capabilities []string       `json:"capabilities,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
}

func (c *Client) RegisterModel(ctx context.Context, req RegisterModelRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/models", req, nil, idempotencyKey)
}

func (c *Client) ListModels(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/models", nil, query, "")
}

func (c *Client) GetModel(ctx context.Context, modelID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/models/"+modelID, nil, nil, "")
}

func (c *Client) UpdateModel(ctx context.Context, modelID string, body map[string]any, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPatch, "/models/"+modelID, body, nil, idempotencyKey)
}

func (c *Client) ActivateModel(ctx context.Context, modelID string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/models/"+modelID+"/activate", nil, nil, idempotencyKey)
}

func (c *Client) DeployModel(ctx context.Context, body map[string]any, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/models/deploy", body, nil, idempotencyKey)
}

// ── Workloads (long-running jobs in enclaves) ───────────────────────

// SubmitWorkloadRequest is the JSON body for POST /ai/v1/workloads.
type SubmitWorkloadRequest struct {
	ModelID    string         `json:"modelId"`
	Type       string         `json:"type"` // "training" | "fine-tune" | "inference-batch"
	InputRefs  []string       `json:"inputRefs,omitempty"`
	OutputBucket string       `json:"outputBucket,omitempty"`
	EnclaveType string        `json:"enclaveType,omitempty"` // e.g. "sgx", "sev", "nitro"
	Metadata   map[string]any `json:"metadata,omitempty"`
}

func (c *Client) SubmitWorkload(ctx context.Context, req SubmitWorkloadRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/workloads", req, nil, idempotencyKey)
}

func (c *Client) GetWorkload(ctx context.Context, workloadID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/workloads/"+workloadID, nil, nil, "")
}

func (c *Client) ListWorkloads(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/workloads", nil, query, "")
}

func (c *Client) CancelWorkload(ctx context.Context, workloadID string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/workloads/"+workloadID+"/cancel", nil, nil, idempotencyKey)
}

// ── Inference ────────────────────────────────────────────────────────

// InferenceRequest is the JSON body for POST /ai/v1/inference.
type InferenceRequest struct {
	ModelID  string         `json:"modelId"`
	Input    map[string]any `json:"input"`
	Stream   bool           `json:"stream,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

func (c *Client) InvokeInference(ctx context.Context, req InferenceRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/inference", req, nil, idempotencyKey)
}

// ── Artifacts ────────────────────────────────────────────────────────

// RegisterArtifactRequest is the JSON body for POST /ai/v1/artifacts.
type RegisterArtifactRequest struct {
	Name      string         `json:"name"`
	Hash      string         `json:"hash"`
	StorageID string         `json:"storageId"`
	Type      string         `json:"type,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

func (c *Client) RegisterArtifact(ctx context.Context, req RegisterArtifactRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/artifacts", req, nil, idempotencyKey)
}

// Do exposes the underlying service client for endpoints not yet wrapped.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
