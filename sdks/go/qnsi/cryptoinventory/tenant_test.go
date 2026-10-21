package cryptoinventory

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

// Controlled transport, not live tenant authorization or production assurance.
type tenantTransport func(*http.Request) (*http.Response, error)

func (transport tenantTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestDiscoverySourceWireContract(t *testing.T) {
	var seen int
	httpClient := &http.Client{Transport: tenantTransport(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path == "/billing/v1/sdk/activate" {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"tenantId":"owned-tenant","tier":"free","activationToken":"owned-test-token","expiresAt":"2099-01-01T00:00:00Z"}`))}, nil
		}
		seen++
		if request.Method != http.MethodPost || request.URL.Path != "/proxy/crypto/v1/assets/discover" || request.Header.Get("idempotency-key") != "owned-discovery" {
			t.Fatal("Discovery request mismatch")
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["source"] != "code_repo" || body["tenantId"] != "owned-tenant" {
			t.Fatalf("Discovery selector was lost: %#v", body)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"runs":[{"source":"code_repo","status":"queued"}]}`))}, nil
	})}
	activation, err := qnsicore.NewActivator("owned-test-key", "https://inventory.example.test", time.Second, httpClient)
	if err != nil {
		t.Fatal(err)
	}
	response, err := New(activation, httpClient, time.Second).DiscoverAssetsFromSource(context.Background(), "code_repo", "owned-discovery")
	if err != nil || response["runs"] == nil || seen != 1 {
		t.Fatalf("Discovery contract failed: calls=%d error=%v", seen, err)
	}
}

func TestInventoryExplicitTenantsAndLegacyEmptyDefault(t *testing.T) {
	var expectedTenant, expectedPath string
	var calls int
	httpClient := &http.Client{Transport: tenantTransport(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path == "/billing/v1/sdk/activate" {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"tenantId":"owned-tenant","tier":"free","activationToken":"owned-test-token","expiresAt":"2099-01-01T00:00:00Z"}`))}, nil
		}
		calls++
		if request.Method != http.MethodGet || request.URL.Path != expectedPath {
			t.Fatalf("Unexpected inventory request: %s %s", request.Method, request.URL.Path)
		}
		query := request.URL.Query()
		if !query.Has("tenantId") || query.Get("tenantId") != expectedTenant {
			t.Fatalf("Caller tenant silently substituted: %#v", query)
		}
		return &http.Response{StatusCode: 403, Body: io.NopCloser(strings.NewReader(`{"error":"TENANT_MISMATCH"}`))}, nil
	})}
	activation, err := qnsicore.NewActivator("owned-test-key", "https://inventory.example.test", time.Second, httpClient)
	if err != nil {
		t.Fatal(err)
	}
	client := New(activation, httpClient, time.Second)
	for _, tenant := range []string{"explicit-tenant", ""} {
		expectedTenant = tenant
		if tenant == "" {
			expectedTenant = "owned-tenant"
		}
		expectedPath = "/proxy/crypto/v1/assets/stats"
		if _, err := client.GetAssetStats(context.Background(), tenant); err == nil {
			t.Fatal("Backend denial was discarded")
		}
		expectedPath = "/proxy/crypto/v1/readiness"
		if _, err := client.GetReadinessScore(context.Background(), tenant); err == nil {
			t.Fatal("Backend denial was discarded")
		}
	}
	if calls != 4 {
		t.Fatalf("Expected four backend checks, got %d", calls)
	}
}
