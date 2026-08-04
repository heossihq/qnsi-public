// Package access is the QNSP Access-Control client - RBAC: roles,
// permissions, role assignments.
//
// Wraps `apps/access-control-service` (see /proxy/access in production).
package access

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/internal/qnsicore"
)

const pathPrefix = "/proxy/access/v1"

type Client struct {
	base *qnsicore.ServiceClient
}

func New(act *qnsicore.Activator, httpClient *http.Client, timeout time.Duration) *Client {
	return &Client{base: qnsicore.NewServiceClient(act, httpClient, pathPrefix, timeout)}
}

// CreateRoleRequest is the JSON body for POST /access/v1/roles.
type CreateRoleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Permissions []string `json:"permissions"` // e.g. ["vault:read", "kms:sign"]
}

func (c *Client) CreateRole(ctx context.Context, req CreateRoleRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/roles", req, nil, idempotencyKey)
}

func (c *Client) GetRole(ctx context.Context, roleID string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/roles/"+roleID, nil, nil, "")
}

func (c *Client) ListRoles(ctx context.Context, query map[string]string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodGet, "/roles", nil, query, "")
}

func (c *Client) DeleteRole(ctx context.Context, roleID string) error {
	_, err := c.base.Do(ctx, http.MethodDelete, "/roles/"+roleID, nil, nil, "")
	return err
}

// AssignRoleRequest is the JSON body for POST /access/v1/role-assignments.
type AssignRoleRequest struct {
	RoleID    string `json:"roleId"`
	SubjectID string `json:"subjectId"` // user, service, or API key id
	Scope     string `json:"scope,omitempty"`
}

func (c *Client) AssignRole(ctx context.Context, req AssignRoleRequest, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/role-assignments", req, nil, idempotencyKey)
}

func (c *Client) RevokeRoleAssignment(ctx context.Context, assignmentID string) error {
	_, err := c.base.Do(ctx, http.MethodDelete, "/role-assignments/"+assignmentID, nil, nil, "")
	return err
}

// CheckPermissionRequest is the JSON body for POST /access/v1/check.
type CheckPermissionRequest struct {
	SubjectID  string `json:"subjectId"`
	Permission string `json:"permission"`
	Scope      string `json:"scope,omitempty"`
}

// CheckPermission asks the access-control service whether a subject is
// allowed to perform an action. Returns the raw service response which
// will include `{ "allowed": bool, "reason": string }`.
func (c *Client) CheckPermission(ctx context.Context, req CheckPermissionRequest) (map[string]any, error) {
	return c.base.Do(ctx, http.MethodPost, "/check", req, nil, "")
}

// Do exposes the underlying service client for endpoints not yet wrapped.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string, idempotencyKey string) (map[string]any, error) {
	return c.base.Do(ctx, method, path, body, query, idempotencyKey)
}
