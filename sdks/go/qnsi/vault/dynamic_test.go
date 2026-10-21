package vault

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

// Controlled HTTP exercises shared activation/transport, not live production or provider assurance.
type dynamicTransport func(*http.Request) (*http.Response, error)

func (transport dynamicTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestDynamicVaultWireContracts(t *testing.T) {
	var seen []*http.Request
	var bodies []map[string]any
	responseBody := `{"leaseId":"owned-lease","status":"revoking","metadata":null}`
	status := http.StatusOK
	httpClient := &http.Client{Transport: dynamicTransport(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path == "/billing/v1/sdk/activate" {
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"tenantId":"owned-tenant","tier":"free","activationToken":"owned-test-token","expiresAt":"2099-01-01T00:00:00Z"}`))}, nil
		}
		seen = append(seen, request)
		var body map[string]any
		if request.Body != nil {
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
		}
		bodies = append(bodies, body)
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(responseBody))}, nil
	})}
	activation, err := qnsicore.NewActivator("owned-test-key", "https://vault.example.test", time.Second, httpClient)
	if err != nil {
		t.Fatal(err)
	}
	client := New(activation, httpClient, time.Second)
	ctx := context.Background()
	check := func(result map[string]any, err error, path string) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		if result["leaseId"] != "owned-lease" {
			t.Fatalf("Response fields were not preserved: %#v", result)
		}
		request := seen[len(seen)-1]
		if request.URL.EscapedPath() != "/proxy/vault/v1"+path {
			t.Fatalf("Wrong mounted path: %s", request.URL)
		}
		if request.URL.Query().Get("tenantId") != "owned-tenant" {
			t.Fatal("Activated tenant was not injected")
		}
	}
	result, err := client.ListDynamicSecretEngines(ctx)
	check(result, err, "/dynamic-secrets/engines")
	result, err = client.CreateDynamicSecretConfig(ctx, DynamicSecretConfigRequest{Name: "owned", EngineType: "postgresql", ConnectionRef: "approved-test-reference"}, "owned-idem")
	check(result, err, "/dynamic-secrets/configs")
	want := map[string]any{"name": "owned", "engineType": "postgresql", "connectionRef": "approved-test-reference", "tenantId": "owned-tenant"}
	if !reflect.DeepEqual(bodies[len(bodies)-1], want) {
		t.Fatalf("Configuration wire mismatch: %#v", bodies)
	}
	if seen[len(seen)-1].Header.Get("idempotency-key") != "owned-idem" {
		t.Fatal("Missing idempotency key")
	}
	ttl, max := 60, 120
	result, err = client.CreateDynamicSecretConfig(ctx, DynamicSecretConfigRequest{Name: "owned", EngineType: "postgresql", ConnectionRef: "approved-test-reference", SecretType: "database", RoleTemplate: map[string]any{"role": "readonly"}, DefaultTTLSeconds: &ttl, MaxTTLSeconds: &max, TenantID: "owned-tenant"}, "")
	check(result, err, "/dynamic-secrets/configs")
	if bodies[len(bodies)-1]["defaultTtlSeconds"] != float64(60) || bodies[len(bodies)-1]["maxTtlSeconds"] != float64(120) {
		t.Fatal("TTL policy was not forwarded")
	}
	result, err = client.ListDynamicSecretConfigs(ctx, "postgresql", "database")
	check(result, err, "/dynamic-secrets/configs")
	if seen[len(seen)-1].URL.Query().Get("engineType") != "postgresql" {
		t.Fatal("Missing engine filter")
	}
	result, err = client.ListDynamicSecretConfigs(ctx, "", "")
	check(result, err, "/dynamic-secrets/configs")
	result, err = client.RequestCredentials(ctx, "config/encoded", DynamicCredentialsRequest{TTLSeconds: &ttl, Metadata: map[string]any{"scope": "owned"}}, "")
	check(result, err, "/dynamic-secrets/configs/config%2Fencoded/credentials")
	if bodies[len(bodies)-1]["ttlSeconds"] != float64(60) {
		t.Fatal("Requested TTL was not forwarded")
	}
	for _, include := range []*bool{nil, ptrBool(false), ptrBool(true)} {
		result, err = client.ListLeases(ctx, "config/encoded", include)
		check(result, err, "/dynamic-secrets/configs/config%2Fencoded/leases")
		query := seen[len(seen)-1].URL.Query()
		if include == nil && query.Has("includeAllStatuses") {
			t.Fatal("Absent status filter was invented")
		}
		if include != nil && query.Get("includeAllStatuses") != map[bool]string{false: "false", true: "true"}[*include] {
			t.Fatal("Status filter mismatch")
		}
	}
	for _, requested := range []*int{nil, &ttl} {
		result, err = client.RenewLease(ctx, "lease/encoded", requested)
		check(result, err, "/dynamic-secrets/leases/lease%2Fencoded/renew")
		_, present := bodies[len(bodies)-1]["ttlSeconds"]
		if present != (requested != nil) {
			t.Fatal("Renewal TTL presence mismatch")
		}
	}
	status = http.StatusAccepted
	result, err = client.RevokeLease(ctx, "lease/encoded")
	check(result, err, "/dynamic-secrets/leases/lease%2Fencoded/revoke")
	if result["status"] != "revoking" {
		t.Fatal("Queue acknowledgement was discarded")
	}
	status = http.StatusServiceUnavailable
	responseBody = `{"error":"DYNAMIC_SECRET_STATS_UNAVAILABLE"}`
	if _, err = client.GetDynamicSecretStats(ctx); err == nil {
		t.Fatal("Unavailable statistics were reported as successful")
	}
	status = http.StatusOK
	responseBody = `{"leaseId":"owned-lease","id":"owned-secret"}`
	result, err = client.CreateSecret(ctx, CreateSecretRequest{Name: "owned-secret", PayloadB64: "Zg=="}, "")
	check(result, err, "/secrets")
	if _, present := bodies[len(bodies)-1]["metadata"]; present {
		t.Fatal("Absent metadata was invented")
	}
	metadata := map[string]any{"purpose": "owned"}
	result, err = client.CreateSecret(ctx, CreateSecretRequest{Name: "owned-secret", PayloadB64: "Zg==", Algorithm: "ml-kem-768", Metadata: metadata}, "")
	check(result, err, "/secrets")
	if _, mutated := metadata["algorithm"]; mutated {
		t.Fatal("Caller metadata was modified")
	}
	for _, algorithm := range []string{"", "ml-kem-768"} {
		result, err = client.RotateSecret(ctx, "secret/encoded", "Zg==", algorithm, "")
		check(result, err, "/secrets/secret%2Fencoded/rotate")
		if bodies[len(bodies)-1]["newPayload"] != "Zg==" {
			t.Fatal("Rotation payload field mismatch")
		}
	}
	result, err = client.GetSecret(ctx, "secret/encoded")
	check(result, err, "/secrets/secret%2Fencoded")
	result, err = client.GetSecretVersion(ctx, "secret/encoded", 1)
	check(result, err, "/secrets/secret%2Fencoded/versions/1")
	result, err = client.ListSecretVersions(ctx, "secret/encoded")
	check(result, err, "/secrets/secret%2Fencoded/versions")
	status = http.StatusNoContent
	responseBody = ""
	if err = client.DeleteSecret(ctx, "secret/encoded"); err != nil {
		t.Fatal(err)
	}
	if seen[len(seen)-1].Method != http.MethodDelete || seen[len(seen)-1].URL.EscapedPath() != "/proxy/vault/v1/secrets/secret%2Fencoded" {
		t.Fatal("Soft-deletion request mismatch")
	}
}

func ptrBool(value bool) *bool { return &value }

func TestDynamicVaultRejectsInvalidResourcePathsBeforeHTTP(t *testing.T) {
	httpClient := &http.Client{Transport: dynamicTransport(func(*http.Request) (*http.Response, error) { t.Fatal("Invalid path reached HTTP"); return nil, nil })}
	activation, err := qnsicore.NewActivator("owned-key", "https://vault.example.test", time.Second, httpClient)
	if err != nil {
		t.Fatal(err)
	}
	client := New(activation, httpClient, time.Second)
	ctx := context.Background()
	for _, id := range []string{"", ".", ".."} {
		if _, err := client.RequestCredentials(ctx, id, DynamicCredentialsRequest{}, ""); err == nil {
			t.Fatal("Invalid config ID accepted")
		}
		if _, err := client.ListLeases(ctx, id, nil); err == nil {
			t.Fatal("Invalid config ID accepted")
		}
		if _, err := client.RenewLease(ctx, id, nil); err == nil {
			t.Fatal("Invalid lease ID accepted")
		}
		if _, err := client.RevokeLease(ctx, id); err == nil {
			t.Fatal("Invalid lease ID accepted")
		}
		if _, err := client.GetSecret(ctx, id); err == nil {
			t.Fatal("Invalid secret ID accepted")
		}
		if _, err := client.GetSecretVersion(ctx, id, 1); err == nil {
			t.Fatal("Invalid secret ID accepted")
		}
		if _, err := client.RotateSecret(ctx, id, "Zg==", "", ""); err == nil {
			t.Fatal("Invalid secret ID accepted")
		}
		if err := client.DeleteSecret(ctx, id); err == nil {
			t.Fatal("Invalid secret ID accepted")
		}
		if _, err := client.ListSecretVersions(ctx, id); err == nil {
			t.Fatal("Invalid secret ID accepted")
		}
	}
	if _, err := client.GetSecretVersion(ctx, "owned-secret", 0); err == nil {
		t.Fatal("Invalid secret version accepted")
	}
}
