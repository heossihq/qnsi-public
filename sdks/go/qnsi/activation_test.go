package qnsp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newActivationServer(t *testing.T, status int, body map[string]any, hits *int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			*hits++
		}
		if r.URL.Path != "/billing/v1/sdk/activate" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("authorization") == "" {
			t.Errorf("missing authorization header")
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	}))
}

func TestActivator_HappyPath(t *testing.T) {
	hits := 0
	srv := newActivationServer(t, 200, map[string]any{
		"tenantId":        "tenant-abc",
		"tier":            "free",
		"limits":          map[string]any{"sseEnabled": true},
		"activationToken": "tkn-1",
		"expiresAt":       time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
	}, &hits)
	defer srv.Close()

	act, err := NewActivator("qnsp_pqc_test", srv.URL, 5*time.Second, srv.Client())
	if err != nil {
		t.Fatalf("NewActivator: %v", err)
	}
	res, err := act.Get(context.Background())
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if res.TenantID != "tenant-abc" || res.Tier != "free" {
		t.Fatalf("unexpected activation: %+v", res)
	}
	if hits != 1 {
		t.Fatalf("expected 1 hit, got %d", hits)
	}
	// Cached call
	if _, err := act.Get(context.Background()); err != nil {
		t.Fatalf("Get cached: %v", err)
	}
	if hits != 1 {
		t.Fatalf("expected 1 hit after cached, got %d", hits)
	}
}

func TestActivator_MissingAPIKey(t *testing.T) {
	if _, err := NewActivator("", "", 0, nil); err == nil {
		t.Fatal("expected error for empty api key")
	}
}

func TestActivator_AuthFailure(t *testing.T) {
	srv := newActivationServer(t, 401, map[string]any{
		"code":    "INVALID_API_KEY",
		"message": "API key not found",
	}, nil)
	defer srv.Close()
	act, _ := NewActivator("qnsp_pqc_bad", srv.URL, time.Second, srv.Client())
	_, err := act.Get(context.Background())
	var ae *AuthError
	if !errors.As(err, &ae) {
		t.Fatalf("expected AuthError, got %v", err)
	}
	if ae.Code != "INVALID_API_KEY" {
		t.Fatalf("expected code INVALID_API_KEY, got %q", ae.Code)
	}
}

func TestActivator_APIError(t *testing.T) {
	srv := newActivationServer(t, 500, map[string]any{"message": "boom"}, nil)
	defer srv.Close()
	act, _ := NewActivator("qnsp_pqc_test", srv.URL, time.Second, srv.Client())
	_, err := act.Get(context.Background())
	var apie *APIError
	if !errors.As(err, &apie) {
		t.Fatalf("expected APIError, got %v", err)
	}
	if apie.StatusCode != 500 {
		t.Fatalf("expected 500, got %d", apie.StatusCode)
	}
}

func TestActivator_InvalidateForcesRefetch(t *testing.T) {
	hits := 0
	srv := newActivationServer(t, 200, map[string]any{
		"tenantId":        "t",
		"tier":            "free",
		"limits":          map[string]any{},
		"activationToken": "t1",
		"expiresAt":       time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
	}, &hits)
	defer srv.Close()
	act, _ := NewActivator("qnsp_pqc_test", srv.URL, time.Second, srv.Client())
	if _, err := act.Get(context.Background()); err != nil {
		t.Fatalf("Get: %v", err)
	}
	act.Invalidate()
	if _, err := act.Get(context.Background()); err != nil {
		t.Fatalf("Get after invalidate: %v", err)
	}
	if hits != 2 {
		t.Fatalf("expected 2 hits after invalidate, got %d", hits)
	}
}
