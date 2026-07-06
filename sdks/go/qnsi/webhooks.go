package qnsp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"
)

// MaxWebhookSkew is the default replay-protection window for ParseWebhook.
const MaxWebhookSkew = 5 * time.Minute

// WebhookEvent is the typed envelope every QNSP webhook follows.
type WebhookEvent struct {
	EventType  string         `json:"event_type"`
	EventID    string         `json:"event_id"`
	OccurredAt string         `json:"occurred_at"`
	Payload    map[string]any `json:"payload"`
	Raw        map[string]any `json:"-"`
}

// VerifyWebhookSignature compares the HMAC-SHA-256 of `body` keyed by
// `secret` against the value in the X-QNSP-Signature header. The header
// must be of the form "sha256=<hex>".
func VerifyWebhookSignature(body []byte, signatureHeader, secret string) error {
	if !strings.HasPrefix(signatureHeader, "sha256=") {
		return &WebhookError{Reason: "signature header must start with 'sha256='"}
	}
	expectedHex := strings.TrimPrefix(signatureHeader, "sha256=")
	expected, err := hex.DecodeString(expectedHex)
	if err != nil {
		return &WebhookError{Reason: "signature is not valid hex"}
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	actual := mac.Sum(nil)
	if !hmac.Equal(actual, expected) {
		return &WebhookError{Reason: "signature mismatch"}
	}
	return nil
}

// ParseWebhook verifies the HMAC, enforces replay protection against
// `now`, parses the JSON body, and returns a typed WebhookEvent.
//
// Pass MaxWebhookSkew (or your own value) for `maxSkew`. Pass time.Time{}
// for `now` to use time.Now().
func ParseWebhook(body []byte, signatureHeader, timestampHeader, secret string, maxSkew time.Duration, now time.Time) (*WebhookEvent, error) {
	if err := VerifyWebhookSignature(body, signatureHeader, secret); err != nil {
		return nil, err
	}

	if timestampHeader != "" {
		if maxSkew == 0 {
			maxSkew = MaxWebhookSkew
		}
		ts, err := time.Parse(time.RFC3339, timestampHeader)
		if err != nil {
			ts, err = time.Parse("2006-01-02T15:04:05Z", timestampHeader)
		}
		if err != nil {
			return nil, &WebhookError{Reason: "timestamp header is not RFC3339"}
		}
		ref := now
		if ref.IsZero() {
			ref = time.Now().UTC()
		}
		delta := ref.Sub(ts)
		if delta > maxSkew {
			return nil, &WebhookError{Reason: "timestamp is too old"}
		}
		if -delta > maxSkew {
			return nil, &WebhookError{Reason: "timestamp is in the future"}
		}
	}

	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, &WebhookError{Reason: "body is not valid JSON"}
	}

	eventType, _ := raw["event_type"].(string)
	if eventType == "" {
		return nil, &WebhookError{Reason: "missing event_type"}
	}
	eventID, _ := raw["event_id"].(string)
	if eventID == "" {
		return nil, &WebhookError{Reason: "missing event_id"}
	}
	occurredAt, _ := raw["occurred_at"].(string)
	payload, _ := raw["payload"].(map[string]any)
	if payload == nil {
		payload = map[string]any{}
	}

	return &WebhookEvent{
		EventType:  eventType,
		EventID:    eventID,
		OccurredAt: occurredAt,
		Payload:    payload,
		Raw:        raw,
	}, nil
}
