// Package kms is the QNSP KMS client — server-side PQC keys with sign,
// verify, wrap, and unwrap.
package kms

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/kms/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

type CreateKeyRequest struct {
	Algorithm string         `json:"algorithm"`
	Purpose   string         `json:"purpose"` // "signing", "encryption", "kem"
	Metadata  map[string]any `json:"metadata,omitempty"`
}

func (c *Client) CreateKey(ctx context.Context, req CreateKeyRequest, idempotencyKey string) (map[string]any, error) {
	// Wire contract: createKeySchema = { tenantId(auto-injected), keyId(required), keyType(required:
	// root|master|data|byok), algorithm, metadata }. The SDK's "purpose" is NOT a backend field —
	// fold it into metadata, generate a keyId, default keyType "data". (Sending {algorithm,purpose}
	// alone 400'd "Invalid request body": no keyId/keyType.)
	metadata := map[string]any{}
	for k, v := range req.Metadata {
		metadata[k] = v
	}
	if req.Purpose != "" {
		metadata["purpose"] = req.Purpose
	}
	body := map[string]any{"keyId": newUUIDv4(), "keyType": "data"}
	if req.Algorithm != "" {
		body["algorithm"] = req.Algorithm
	}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	return c.base.Do(ctx, http.MethodPost, "/keys", body, nil, idempotencyKey)
}

// newUUIDv4 generates an RFC-4122 v4 UUID (no external dependency) for the required keyId field.
func newUUIDv4() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func (c *Client) ListKeys(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/keys", nil, query, "")
}

func (c *Client) GetKey(ctx context.Context, keyID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/keys/"+keyID, nil, nil, "")
}

func (c *Client) RotateKey(ctx context.Context, keyID string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/keys/"+keyID+"/rotate", nil, nil, idempotencyKey)
}

func (c *Client) DeleteKey(ctx context.Context, keyID string) error {
	_, err := c.base.Do(ctx, http.MethodDelete, "/keys/"+keyID, nil, nil, "")
	return err
}

func (c *Client) Sign(ctx context.Context, keyID string, data []byte, idempotencyKey string) ([]byte, error) {
	body := map[string]any{"data": base64.StdEncoding.EncodeToString(data)}
	resp, err := c.base.Do(ctx, http.MethodPost, "/keys/"+keyID+"/sign", body, nil, idempotencyKey)
	if err != nil {
		return nil, err
	}
	sigB64, ok := resp["signature"].(string)
	if !ok || sigB64 == "" {
		return nil, fmt.Errorf("qnsp: kms.Sign: missing signature in response")
	}
	return base64.StdEncoding.DecodeString(sigB64)
}

func (c *Client) Verify(ctx context.Context, keyID string, data, signature []byte) (bool, error) {
	body := map[string]any{
		"data":      base64.StdEncoding.EncodeToString(data),
		"signature": base64.StdEncoding.EncodeToString(signature),
	}
	resp, err := c.base.Do(ctx, http.MethodPost, "/keys/"+keyID+"/verify", body, nil, "")
	if err != nil {
		return false, err
	}
	valid, _ := resp["valid"].(bool)
	return valid, nil
}

func (c *Client) Wrap(ctx context.Context, keyID string, plaintext []byte, idempotencyKey string) ([]byte, error) {
	body := map[string]any{"dataKey": base64.StdEncoding.EncodeToString(plaintext)}
	resp, err := c.base.Do(ctx, http.MethodPost, "/keys/"+keyID+"/wrap", body, nil, idempotencyKey)
	if err != nil {
		return nil, err
	}
	ctB64, ok := resp["wrappedKey"].(string)
	if !ok || ctB64 == "" {
		ctB64, _ = resp["ciphertextB64"].(string) // tolerate legacy field name
	}
	if ctB64 == "" {
		return nil, fmt.Errorf("qnsp: kms.Wrap: missing wrappedKey in response")
	}
	return base64.StdEncoding.DecodeString(ctB64)
}

func (c *Client) Unwrap(ctx context.Context, keyID string, ciphertext []byte, idempotencyKey string) ([]byte, error) {
	body := map[string]any{"wrappedKey": base64.StdEncoding.EncodeToString(ciphertext)}
	resp, err := c.base.Do(ctx, http.MethodPost, "/keys/"+keyID+"/unwrap", body, nil, idempotencyKey)
	if err != nil {
		return nil, err
	}
	ptB64, ok := resp["dataKey"].(string)
	if !ok || ptB64 == "" {
		ptB64, _ = resp["plaintextB64"].(string) // tolerate legacy field name
	}
	if ptB64 == "" {
		return nil, fmt.Errorf("qnsp: kms.Unwrap: missing dataKey in response")
	}
	return base64.StdEncoding.DecodeString(ptB64)
}
