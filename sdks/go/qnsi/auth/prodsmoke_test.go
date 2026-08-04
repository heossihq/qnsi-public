package auth

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

// TestProdSmokeAuthLoginAndSession is a REAL end-to-end smoke against PRODUCTION through the
// actual Go auth client (provable-evidence mandate - prove the wire contract with a real call,
// not a mock). It proves the reaudit 2026-06-13 #32/#34/#36 fix: the auth client now targets
// /edge/auth/login (was /auth/v1/login → 404) and the session-authenticated /auth/risk/policies
// (was /auth/v1/risk/policies → 404).
//
// Gated on the persistent synthetic-canary creds (the QNSP_CANARY_KEY / _EMAIL / _PASSWORD / _TENANT env vars
// + the login email/password/tenant); skips cleanly when unset so a normal `go test ./...` never
// hits the network:
//
//	QNSP_CANARY_KEY=… QNSP_CANARY_EMAIL=… QNSP_CANARY_PASSWORD=… QNSP_CANARY_TENANT=… \
//	  go test ./auth/ -run TestProdSmokeAuthLoginAndSession -v
func TestProdSmokeAuthLoginAndSession(t *testing.T) {
	key := os.Getenv("QNSP_CANARY_KEY")
	email := os.Getenv("QNSP_CANARY_EMAIL")
	password := os.Getenv("QNSP_CANARY_PASSWORD")
	tenant := os.Getenv("QNSP_CANARY_TENANT")
	if key == "" || email == "" || password == "" || tenant == "" {
		t.Skip("canary creds not set (QNSP_CANARY_KEY/EMAIL/PASSWORD/TENANT) - skipping prod smoke")
	}

	baseURL := os.Getenv("QNSP_E2E_API")
	if baseURL == "" {
		baseURL = "https://api.qnsi.heossi.com"
	}
	const timeout = 30 * time.Second

	act, err := qnsicore.NewActivator(key, baseURL, timeout, nil)
	if err != nil {
		t.Fatalf("NewActivator: %v", err)
	}
	c := New(act, nil, timeout)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// login -> POST /edge/auth/login (creds in body, no auth header). Caches the session.
	// A non-2xx returns an error; reaching the asserts proves the corrected /edge/auth/login path.
	body, err := c.Login(ctx, LoginRequest{Email: email, Password: password, TenantID: tenant})
	if err != nil {
		t.Fatalf("Login(/edge/auth/login) failed: %v", err)
	}
	if tokenString(body["accessToken"]) == "" {
		t.Fatalf("login returned no accessToken: %v", body)
	}
	sess := c.GetSession()
	if sess == nil || sess.AccessToken == "" {
		t.Fatalf("login did not cache a session")
	}
	t.Logf("login OK - session cached (tenant=%s)", sess.TenantID)

	// listRiskPolicies -> GET /auth/risk/policies with the session JWT + x-qnsp-tenant-id.
	// (Returns 200 against prod; the old /auth/v1/risk/policies path 404'd.) A non-2xx returns
	// an error, so reaching here proves the session-authenticated route.
	policies, err := c.ListRiskPolicies(ctx)
	if err != nil {
		t.Fatalf("ListRiskPolicies(/auth/risk/policies, session) failed: %v", err)
	}
	t.Logf("listRiskPolicies OK - %d field(s) in response", len(policies))
}
