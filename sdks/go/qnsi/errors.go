package qnsp

import "github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"

// Error is the root type for all QNSP SDK errors.
type Error = qnsicore.Error

// NetworkError covers DNS, TLS, timeout, and connection failures reaching
// the QNSP edge gateway.
type NetworkError = qnsicore.NetworkError

// AuthError is returned when activation fails because the API key is
// rejected by billing-service.
type AuthError = qnsicore.AuthError

// APIError wraps a structured 4xx/5xx response from a QNSP service.
type APIError = qnsicore.APIError

// WebhookError is returned by ParseWebhook / VerifyWebhookSignature when
// the request fails HMAC verification, replay protection, or shape checks.
type WebhookError = qnsicore.WebhookError
