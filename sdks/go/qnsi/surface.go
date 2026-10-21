package qnsp

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

//go:embed surface-operations.json
var surfaceOperationsJSON []byte

// Operation describes a manifest-declared route, not verified live availability.
type Operation struct {
	ID             string   `json:"id"`
	Service        string   `json:"service"`
	Method         string   `json:"method"`
	ManifestPath   string   `json:"manifestPath"`
	Path           string   `json:"path"`
	PathParameters []string `json:"pathParameters"`
	Description    string   `json:"description"`
}

// Operations returns a fresh catalog; mutation cannot alter another caller's contracts.
func Operations() ([]Operation, error) {
	var operations []Operation
	if err := json.Unmarshal(surfaceOperationsJSON, &operations); err != nil {
		return nil, fmt.Errorf("qnsi: invalid bundled operation catalog: %w", err)
	}
	return operations, nil
}

// CallOperation preserves the existing activation, retry, tenant and error contracts.
// Backend policy and entitlement checks remain authoritative. Bodies are JSON wire payloads.
func (c *Client) CallOperation(ctx context.Context, operationID string, parameters map[string]string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	operations, err := Operations()
	if err != nil {
		return nil, err
	}
	for _, operation := range operations {
		if operation.ID != operationID {
			continue
		}
		if len(parameters) != len(operation.PathParameters) {
			return nil, fmt.Errorf("qnsi: required path parameters: %v", operation.PathParameters)
		}
		path := operation.Path
		names := append([]string(nil), operation.PathParameters...)
		sort.Slice(names, func(i, j int) bool { return len(names[i]) > len(names[j]) })
		for _, name := range names {
			value := parameters[name]
			if value == "" || value == "." || value == ".." {
				return nil, fmt.Errorf("qnsi: invalid or missing path parameter %s", name)
			}
			path = strings.ReplaceAll(path, ":"+name, url.PathEscape(value))
		}
		service := qnsicore.NewServiceClient(c.activator, c.http, "", c.timeout)
		return service.Do(ctx, operation.Method, path, body, query, idempotencyKey)
	}
	return nil, fmt.Errorf("qnsi: unknown operation ID %q", operationID)
}
