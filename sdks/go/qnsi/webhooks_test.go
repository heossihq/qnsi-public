package qnsp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

const testWebhookSecret = "test-shared-secret"

func sign(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyWebhookSignature_OK(t *testing.T) {
	body := []byte(`{"event_type":"key.rotated"}`)
	if err := VerifyWebhookSignature(body, sign(body, testWebhookSecret), testWebhookSecret); err != nil {
		t.Fatalf("expected verify to succeed, got %v", err)
	}
}

func TestVerifyWebhookSignature_TamperedBody(t *testing.T) {
	body := []byte(`{"event_type":"key.rotated"}`)
	sig := sign(body, testWebhookSecret)
	tampered := []byte(`{"event_type":"key.deleted"}`)
	err := VerifyWebhookSignature(tampered, sig, testWebhookSecret)
	if err == nil {
		t.Fatalf("expected mismatch error")
	}
	var we *WebhookError
	if !errors.As(err, &we) || !strings.Contains(we.Reason, "mismatch") {
		t.Fatalf("expected mismatch WebhookError, got %v", err)
	}
}

func TestVerifyWebhookSignature_WrongPrefix(t *testing.T) {
	if err := VerifyWebhookSignature([]byte("{}"), "md5=abcd", testWebhookSecret); err == nil {
		t.Fatalf("expected wrong-prefix error")
	}
}

func TestParseWebhook_HappyPath(t *testing.T) {
	payload := map[string]any{
		"event_type":  "key.rotated",
		"event_id":    "evt-001",
		"occurred_at": "2026-04-30T00:00:00Z",
		"payload":     map[string]any{"keyId": "key-abc", "newVersion": 2},
	}
	body, _ := json.Marshal(payload)
	now := time.Now().UTC().Format(time.RFC3339)
	event, err := ParseWebhook(body, sign(body, testWebhookSecret), now, testWebhookSecret, MaxWebhookSkew, time.Time{})
	if err != nil {
		t.Fatalf("expected ParseWebhook ok, got %v", err)
	}
	if event.EventType != "key.rotated" || event.EventID != "evt-001" {
		t.Fatalf("unexpected event payload: %+v", event)
	}
	if event.Payload["keyId"] != "key-abc" {
		t.Fatalf("expected keyId in payload")
	}
}

func TestParseWebhook_OldTimestamp(t *testing.T) {
	body, _ := json.Marshal(map[string]any{"event_type": "x", "event_id": "y", "payload": map[string]any{}})
	old := time.Now().UTC().Add(-10 * time.Minute).Format(time.RFC3339)
	_, err := ParseWebhook(body, sign(body, testWebhookSecret), old, testWebhookSecret, MaxWebhookSkew, time.Time{})
	if err == nil {
		t.Fatalf("expected too-old error")
	}
	if !strings.Contains(err.Error(), "too old") {
		t.Fatalf("expected 'too old' in error, got %v", err)
	}
}

func TestParseWebhook_FutureTimestamp(t *testing.T) {
	body, _ := json.Marshal(map[string]any{"event_type": "x", "event_id": "y", "payload": map[string]any{}})
	future := time.Now().UTC().Add(10 * time.Minute).Format(time.RFC3339)
	_, err := ParseWebhook(body, sign(body, testWebhookSecret), future, testWebhookSecret, MaxWebhookSkew, time.Time{})
	if err == nil {
		t.Fatalf("expected future-timestamp error")
	}
	if !strings.Contains(err.Error(), "future") {
		t.Fatalf("expected 'future' in error, got %v", err)
	}
}

func TestParseWebhook_MalformedJSON(t *testing.T) {
	body := []byte(`{"not-valid-json`)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := ParseWebhook(body, sign(body, testWebhookSecret), now, testWebhookSecret, MaxWebhookSkew, time.Time{})
	if err == nil {
		t.Fatalf("expected JSON error")
	}
	if !strings.Contains(err.Error(), "JSON") {
		t.Fatalf("expected 'JSON' in error, got %v", err)
	}
}

func TestParseWebhook_MissingEventID(t *testing.T) {
	body, _ := json.Marshal(map[string]any{
		"event_type":  "x",
		"occurred_at": time.Now().UTC().Format(time.RFC3339),
		"payload":     map[string]any{},
	})
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := ParseWebhook(body, sign(body, testWebhookSecret), now, testWebhookSecret, MaxWebhookSkew, time.Time{})
	if err == nil {
		t.Fatalf("expected missing event_id error")
	}
	if !strings.Contains(err.Error(), "event_id") {
		t.Fatalf("expected event_id in error, got %v", err)
	}
}
