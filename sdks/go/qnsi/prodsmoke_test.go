package qnsp

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/kms"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/storage"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/vault"
)

// TestProdSmokeServiceClients is a REAL end-to-end smoke against PRODUCTION through the actual
// top-level Go SDK (provable-evidence mandate — prove the wire contract with a real call, not a
// mock). It proves the 2026-06-14 Go SDK remediation:
//
//   - service prefixes /proxy/<svc>/v1 (was bare /<svc>/v1 → 404 "No route found");
//   - central tenantId injection (GET query + write body) — without it kms/vault 400 "missing tenant";
//   - kms field names data/signature/dataKey/wrappedKey + createKey keyId/keyType (was
//     dataB64/signatureB64 + no keyId → 400);
//   - vault payload/newPayload (was payloadB64, stripped by the schema → empty secret);
//   - storage /proxy/storage/v1 (was the double /storage/storage/v1 → 404).
//
// Gated on the persistent synthetic-canary free-tenant key (provided via the
// QNSP_CANARY_KEY env var); skips cleanly when unset so a normal `go test ./...` never hits
// the network:
//
//	QNSP_CANARY_KEY=… go test . -run TestProdSmokeServiceClients -v
func TestProdSmokeServiceClients(t *testing.T) {
	key := os.Getenv("QNSP_CANARY_KEY")
	if key == "" {
		t.Skip("QNSP_CANARY_KEY not set — skipping prod smoke")
	}
	baseURL := os.Getenv("QNSP_E2E_API")
	if baseURL == "" {
		baseURL = "https://api.qnsi.heossi.com"
	}
	client, err := NewClient(ClientOptions{APIKey: key, BaseURL: baseURL, Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// ── kms: create(signing) -> sign -> verify ───────────────────────────────────────────────
	keyResp, err := client.KMS().CreateKey(ctx, kms.CreateKeyRequest{Algorithm: "dilithium-3", Purpose: "signing"}, "")
	if err != nil {
		t.Fatalf("kms.CreateKey (prefix+keyId+keyType+tenantId): %v", err)
	}
	keyID, _ := keyResp["keyId"].(string)
	if keyID == "" {
		keyID, _ = keyResp["id"].(string)
	}
	if keyID == "" {
		t.Fatalf("CreateKey returned no keyId: %v", keyResp)
	}
	data := []byte("go-prod-smoke")
	sig, err := client.KMS().Sign(ctx, keyID, data, "")
	if err != nil {
		t.Fatalf("kms.Sign (data/signature fields): %v", err)
	}
	if len(sig) == 0 {
		t.Fatalf("kms.Sign returned an empty signature")
	}
	valid, err := client.KMS().Verify(ctx, keyID, data, sig)
	if err != nil {
		t.Fatalf("kms.Verify: %v", err)
	}
	if !valid {
		t.Fatalf("kms.Verify returned false for a real signature")
	}
	t.Logf("kms create/sign/verify OK — %d sig bytes", len(sig))

	// kms.ListKeys with NO tenantId in the query — proves the central query injection.
	if _, err := client.KMS().ListKeys(ctx, nil); err != nil {
		t.Fatalf("kms.ListKeys (central tenantId query injection): %v", err)
	}
	t.Logf("kms.ListKeys OK (tenantId injected into query)")

	// ── vault: create -> rotate -> listVersions ──────────────────────────────────────────────
	payload := base64.StdEncoding.EncodeToString([]byte("go-secret-value"))
	sec, err := client.Vault().CreateSecret(ctx, vault.CreateSecretRequest{
		Name:       fmt.Sprintf("go-smoke-%d", time.Now().UnixNano()),
		PayloadB64: payload,
	}, "")
	if err != nil {
		t.Fatalf("vault.CreateSecret (payload field): %v", err)
	}
	secretID, _ := sec["id"].(string)
	if secretID == "" {
		secretID, _ = sec["secretId"].(string)
	}
	if secretID == "" {
		t.Fatalf("CreateSecret returned no id: %v", sec)
	}
	newPayload := base64.StdEncoding.EncodeToString([]byte("go-secret-rotated"))
	if _, err := client.Vault().RotateSecret(ctx, secretID, newPayload, "", ""); err != nil {
		t.Fatalf("vault.RotateSecret (newPayload field): %v", err)
	}
	if _, err := client.Vault().ListSecretVersions(ctx, secretID); err != nil {
		t.Fatalf("vault.ListSecretVersions: %v", err)
	}
	t.Logf("vault create/rotate/listVersions OK")

	// ── storage: put -> get round-trip ───────────────────────────────────────────────────────
	objKey := fmt.Sprintf("go-smoke-%d.txt", time.Now().UnixNano())
	content := []byte("go storage roundtrip")
	if _, err := client.Storage().PutObject(ctx, "default", objKey, storage.PutObjectRequest{
		DataB64:     base64.StdEncoding.EncodeToString(content),
		ContentType: "text/plain",
	}, ""); err != nil {
		t.Fatalf("storage.PutObject (/proxy/storage/v1 prefix): %v", err)
	}
	got, _, err := client.Storage().GetObject(ctx, "default", objKey)
	if err != nil {
		t.Fatalf("storage.GetObject: %v", err)
	}
	if !bytes.Equal(got, content) {
		t.Fatalf("storage round-trip mismatch: got %q want %q", got, content)
	}
	t.Logf("storage put/get OK — round-trip bytes match")
}
