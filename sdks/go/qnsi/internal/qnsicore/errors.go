// Package qnsicore is the internal shared core for the QNSP Go SDK.
// It holds the Activator, error types, and HTTP plumbing that every
// submodule (vault, kms, audit, etc.) needs. The public `qnsp` package
// re-exports the user-facing types from here.
//
// External consumers should import the user-facing aliases from `qnsp`
// rather than reaching into this package.
package qnsicore

import "fmt"

// Error is the root type for all QNSP SDK errors.
type Error interface {
	error
	qnspError()
}

type NetworkError struct {
	Op  string
	URL string
	Err error
}

func (e *NetworkError) Error() string {
	return fmt.Sprintf("qnsp: network error on %s %s: %v", e.Op, e.URL, e.Err)
}
func (e *NetworkError) Unwrap() error { return e.Err }
func (*NetworkError) qnspError()      {}

type AuthError struct {
	Code    string
	Message string
}

func (e *AuthError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("qnsp: auth error (%s): %s", e.Code, e.Message)
	}
	return "qnsp: auth error: " + e.Message
}
func (*AuthError) qnspError() {}

type APIError struct {
	StatusCode int
	Code       string
	Message    string
	Body       map[string]any
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("qnsp: api error %d %s: %s", e.StatusCode, e.Code, e.Message)
	}
	return fmt.Sprintf("qnsp: api error %d: %s", e.StatusCode, e.Message)
}
func (*APIError) qnspError() {}

type WebhookError struct {
	Reason string
}

func (e *WebhookError) Error() string { return "qnsp: webhook error: " + e.Reason }
func (*WebhookError) qnspError()      {}
