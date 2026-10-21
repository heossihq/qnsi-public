package qnsicore

import (
	"context"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestActivationLifetimeUsesBackendContract(t *testing.T) {
	start := time.Now()
	result, err := decodeActivation(map[string]any{"tenantId": "test-tenant", "expiresInSeconds": float64(3600)})
	if err != nil {
		t.Fatal(err)
	}
	if result.ExpiresAt.Before(start.Add(time.Hour)) || result.ExpiresAt.After(time.Now().Add(time.Hour)) {
		t.Fatal("expiry differs from backend lifetime")
	}
	for _, invalid := range []any{nil, "3600", true, float64(0), float64(-1), math.SmallestNonzeroFloat64, math.NaN(), math.Inf(1), float64(math.MaxInt64)} {
		if _, err := decodeActivation(map[string]any{"tenantId": "test-tenant", "expiresInSeconds": invalid}); err == nil {
			t.Fatalf("accepted invalid lifetime: %v", invalid)
		}
	}
	for _, invalid := range []any{nil, float64(3600), "invalid", time.Now().Add(-time.Hour).Format(time.RFC3339)} {
		if _, err := decodeActivation(map[string]any{"tenantId": "test-tenant", "expiresAt": invalid, "expiresInSeconds": float64(3600)}); err == nil {
			t.Fatal("invalid explicit expiry silently fell back")
		}
	}
}

func TestActivationRefreshIsSerialized(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = io.WriteString(w, `{"tenantId":"test-tenant","expiresInSeconds":3600}`)
	}))
	defer server.Close()
	activator, err := NewActivator("test-api-key", server.URL, 0, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	for i := 0; i < 32; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if _, err := activator.Get(context.Background()); err != nil {
				t.Error(err)
			}
		}()
	}
	group.Wait()
	if requests.Load() != 1 {
		t.Fatalf("concurrent refreshes issued %d handshakes", requests.Load())
	}
	activator.Invalidate()
	if _, err := activator.Get(context.Background()); err != nil {
		t.Fatal(err)
	}
	if requests.Load() != 2 {
		t.Fatal("invalidation did not trigger fresh handshake")
	}
}
