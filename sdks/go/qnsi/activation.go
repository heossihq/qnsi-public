package qnsp

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

// SDK identity reported in the activation handshake.
const (
	sdkID      = "qnsp-go"
	sdkVersion = "0.3.0"
)

func init() {
	qnsicore.SetSDKIdentity(sdkID, sdkVersion)
}

// ActivationResult is the decoded response from the SDK activation
// handshake against billing-service.
type ActivationResult = qnsicore.ActivationResult

// Activator performs the SDK activation handshake and caches the result.
type Activator = qnsicore.Activator

// NewActivator constructs an Activator. Equivalent to
// qnsicore.NewActivator; preserved here so external code can refer to
// it via the public package.
func NewActivator(apiKey, baseURL string, timeout time.Duration, httpClient *http.Client) (*Activator, error) {
	return qnsicore.NewActivator(apiKey, baseURL, timeout, httpClient)
}

// EnsureActivated forces the activation handshake to run now. Equivalent
// to calling activator.Get(ctx) directly.
func EnsureActivated(ctx context.Context, a *Activator) (*ActivationResult, error) {
	return a.Get(ctx)
}
