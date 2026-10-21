package qnsp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type surfaceTransport func(*http.Request) (*http.Response, error)

func (f surfaceTransport) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func TestSurfaceEveryCatalogOperation(t *testing.T) {
	operations, err := Operations()
	if err != nil || len(operations) < 800 {
		t.Fatalf("catalog: %v", err)
	}
	var recorded *http.Request
	var recordedBody []byte
	httpClient := &http.Client{Transport: surfaceTransport(func(request *http.Request) (*http.Response, error) {
		response := "{}"
		if request.URL.Path == "/billing/v1/sdk/activate" {
			response = `{"tenantId":"tenant-test","tier":"free","limits":{},"activationToken":"test","expiresInSeconds":3600}`
		} else {
			recorded = request
			if request.Body != nil {
				recordedBody, _ = io.ReadAll(request.Body)
			} else {
				recordedBody = nil
			}
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(response))}, nil
	})}
	client, err := NewClient(ClientOptions{APIKey: "test-key", BaseURL: "https://api.test", HTTPClient: httpClient})
	if err != nil {
		t.Fatal(err)
	}
	for _, operation := range operations {
		params := map[string]string{}
		expected := operation.Path
		for _, name := range operation.PathParameters {
			params[name] = name + "/?# &%"
			expected = strings.ReplaceAll(expected, ":"+name, url.PathEscape(params[name]))
		}
		var body any
		if operation.Method != "GET" {
			body = map[string]any{"data": "aGVsbG8="}
		}
		if _, err := client.CallOperation(context.Background(), operation.ID, params, body, map[string]string{"cursor": "next & # page"}, "request-1"); err != nil {
			t.Fatalf("%s: %v", operation.ID, err)
		}
		if recorded.Method != operation.Method || recorded.URL.EscapedPath() != expected {
			t.Fatalf("%s: got %s %s", operation.ID, recorded.Method, recorded.URL.EscapedPath())
		}
		if recorded.URL.Query().Get("tenantId") != "tenant-test" || recorded.URL.Query().Get("cursor") != "next & # page" {
			t.Fatalf("query lost: %s", recorded.URL.RawQuery)
		}
		if recorded.Header.Get("idempotency-key") != "request-1" {
			t.Fatal("idempotency header lost")
		}
		if body != nil {
			var payload map[string]any
			if err := json.Unmarshal(recordedBody, &payload); err != nil || payload["tenantId"] != "tenant-test" {
				t.Fatalf("body binding: %s", recordedBody)
			}
		}
	}
	operations[0].ID = "caller-mutation"
	fresh, err := Operations()
	if err != nil || fresh[0].ID == "caller-mutation" {
		t.Fatal("caller mutated the canonical catalog")
	}
}

func TestSurfaceInvalidContractsAndCorruptCatalog(t *testing.T) {
	client, err := NewClient(ClientOptions{APIKey: "test-key", HTTPClient: &http.Client{Transport: surfaceTransport(func(*http.Request) (*http.Response, error) {
		t.Fatal("invalid contract sent credentials")
		return nil, nil
	})}})
	if err != nil {
		t.Fatal(err)
	}
	for _, input := range []struct {
		id     string
		params map[string]string
	}{
		{"unknown", nil}, {"kms-service.getKeysKeyId", nil},
		{"kms-service.getKeysKeyId", map[string]string{"extra": "x"}},
		{"kms-service.getKeysKeyId", map[string]string{"keyId": "."}},
		{"kms-service.getKeysKeyId", map[string]string{"keyId": ".."}},
		{"kms-service.getKeysKeyId", map[string]string{"keyId": ""}},
	} {
		if _, err := client.CallOperation(context.Background(), input.id, input.params, nil, nil, ""); err == nil {
			t.Fatalf("accepted invalid input: %v", input)
		}
	}
	old := surfaceOperationsJSON
	surfaceOperationsJSON = []byte("invalid JSON")
	defer func() { surfaceOperationsJSON = old }()
	if _, err := Operations(); err == nil {
		t.Fatal("accepted corrupt catalog")
	}
	if _, err := client.CallOperation(context.Background(), "kms-service.getKeys", nil, nil, nil, ""); err == nil {
		t.Fatal("executed with corrupt catalog")
	}
}
