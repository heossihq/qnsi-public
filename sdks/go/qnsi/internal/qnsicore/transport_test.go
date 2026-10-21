package qnsicore

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

const activationJSON = `{"tenantId":"test-tenant","tier":"free","limits":{},"expiresAt":"2099-01-01T00:00:00Z"}`

func TestRedirectsAreRejectedAtEveryAuthenticationBoundary(t *testing.T) {
	for _, phase := range []string{"activation", "service", "retry", "session"} {
		t.Run(phase, func(t *testing.T) {
			var received atomic.Int32
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				received.Add(1)
				w.WriteHeader(http.StatusOK)
			}))
			defer target.Close()
			var serviceCalls atomic.Int32
			source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == ActivationPath && phase != "activation" {
					_, _ = io.WriteString(w, activationJSON)
					return
				}
				if phase == "retry" && serviceCalls.Add(1) == 1 {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				http.Redirect(w, r, target.URL+"/receive", http.StatusTemporaryRedirect)
			}))
			defer source.Close()
			var followed atomic.Int32
			httpClient := source.Client()
			httpClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
				followed.Add(1)
				return nil
			}
			activator, err := NewActivator("test-api-key", source.URL, 0, httpClient)
			if err != nil {
				t.Fatal(err)
			}
			client := NewServiceClient(activator, httpClient, "/proxy/kms/v1", 0)
			switch phase {
			case "activation":
				_, err = activator.Get(context.Background())
			case "session":
				_, err = client.SessionDo(context.Background(), http.MethodGet, "/auth/session", nil, nil, "test-session", "test-tenant")
			default:
				_, err = client.Do(context.Background(), http.MethodGet, "/keys", nil, nil, "")
			}
			var apiError *APIError
			if !errors.As(err, &apiError) || apiError.StatusCode != http.StatusTemporaryRedirect {
				t.Fatalf("redirect must fail with API status 307, got %T", err)
			}
			if received.Load() != 0 || followed.Load() != 0 {
				t.Fatal("a redirect was followed across the credential boundary")
			}
			// The caller's original redirect configuration is still intact.
			if err := httpClient.CheckRedirect(nil, nil); err != nil || followed.Load() != 1 {
				t.Fatal("SDK mutated the caller-owned HTTP client")
			}
		})
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

type trackedBody struct {
	reader     io.Reader
	readError  error
	closeError error
	closes     int
}

func (b *trackedBody) Read(buffer []byte) (int, error) {
	n, err := b.reader.Read(buffer)
	if b.readError != nil {
		return n, b.readError
	}
	return n, err
}
func (b *trackedBody) Close() error { b.closes++; return b.closeError }

func TestResponseReadFailuresCannotBecomeSuccessfulJSON(t *testing.T) {
	for _, phase := range []string{"activation", "service", "session"} {
		t.Run(phase, func(t *testing.T) {
			body := &trackedBody{reader: strings.NewReader(`{"ok":true}`), readError: io.ErrUnexpectedEOF}
			httpClient := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				responseBody := io.ReadCloser(body)
				if phase != "activation" && request.URL.Path == ActivationPath {
					responseBody = io.NopCloser(strings.NewReader(activationJSON))
				}
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: responseBody, Request: request}, nil
			})}
			activator, err := NewActivator("test-api-key", "https://api.example.invalid", 0, httpClient)
			if err != nil {
				t.Fatal(err)
			}
			client := NewServiceClient(activator, httpClient, "/proxy/kms/v1", 0)
			switch phase {
			case "activation":
				_, err = activator.Get(context.Background())
			case "session":
				_, err = client.SessionDo(context.Background(), http.MethodGet, "/auth/session", nil, nil, "test", "tenant")
			default:
				_, err = client.Do(context.Background(), http.MethodGet, "/keys", nil, nil, "")
			}
			var networkError *NetworkError
			if !errors.As(err, &networkError) || !errors.Is(err, io.ErrUnexpectedEOF) {
				t.Fatalf("partial body must fail as network error, got %T", err)
			}
			if body.closes != 1 {
				t.Fatal("failed response body was not closed exactly once")
			}
		})
	}
}

func TestUnauthorizedBodyIsClosedBeforeRetry(t *testing.T) {
	for _, failClose := range []bool{false, true} {
		t.Run(map[bool]string{false: "retry", true: "close-error"}[failClose], func(t *testing.T) {
			closeFailure := errors.New("body close failure")
			first := &trackedBody{reader: strings.NewReader(`{"error":"expired"}`)}
			if failClose {
				first.closeError = closeFailure
			}
			calls := 0
			httpClient := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				status := http.StatusOK
				var body io.ReadCloser = io.NopCloser(strings.NewReader(activationJSON))
				if request.URL.Path != ActivationPath {
					calls++
					if calls == 1 {
						status, body = http.StatusUnauthorized, first
					} else {
						if first.closes != 1 {
							t.Error("retry occurred before closing unauthorized response")
						}
						body = io.NopCloser(strings.NewReader(`{"ok":true}`))
					}
				}
				return &http.Response{StatusCode: status, Body: body, Header: make(http.Header), Request: request}, nil
			})}
			activator, err := NewActivator("test-key", "https://api.example.invalid", 0, httpClient)
			if err != nil {
				t.Fatal(err)
			}
			result, err := NewServiceClient(activator, httpClient, "/proxy/kms/v1", 0).Do(context.Background(), http.MethodGet, "/keys", nil, nil, "")
			if failClose {
				if !errors.Is(err, closeFailure) || calls != 1 {
					t.Fatal("close failure did not stop retry")
				}
			} else if err != nil || result["ok"] != true || calls != 2 {
				t.Fatal("retry failed")
			}
			if first.closes != 1 {
				t.Fatal("unauthorized body close count is not one")
			}
		})
	}
}
