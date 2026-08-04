---
title: RBAC and Policies
version: 0.0.1
last_updated: 2026-07-28
copyright: © 2025 HEOSSI. All rights reserved.
---
# RBAC and Policies

QNSI enforces access control via roles and policies.

Authentication establishes an identity. Authorization decides whether that
identity may perform one operation on one tenant-scoped resource. Keep those
decisions separate when diagnosing a denied request.

## Role model

Roles are collections of permissions assigned to identities.

### Built-in roles
- `owner`: Full tenant access
- `admin`: Administrative operations
- `developer`: Development operations
- `viewer`: Read-only access

### Custom roles
Define custom roles with specific permissions:
```json
{
  "name": "key-manager",
  "permissions": [
    "kms:keys:read",
    "kms:keys:create",
    "kms:keys:rotate"
  ]
}
```

Treat the built-in names as policy inputs, not as a substitute for reviewing
the permissions ultimately evaluated for a request. A custom role should
contain the smallest operation set needed by the workload.

## Permission format

Permissions follow the pattern:
```
<service>:<resource>:<action>
```

Examples:
- `kms:keys:create`
- `vault:secrets:read`
- `storage:objects:write`

Permissions are service contracts. Validate a proposed string against the
service's access-control documentation or route catalog; an unknown permission
must not silently grant access.

## Policy evaluation

Access control service evaluates:
1. Identity roles
2. Resource policies
3. Tenant-level overrides

All must allow for access to be granted.

Evaluation is tenant scoped and deny-by-default. A role assignment in one
tenant does not transfer to another tenant, and possession of a valid token
does not imply access to every service. Resource policy, tenant policy and
operation entitlement may each produce a denial.

For an authorization failure, record:

- authenticated subject and tenant;
- requested service, resource and action;
- matched role and resource-policy identifiers;
- decision and reason code;
- correlation identifier used to find the audit event.

Do not log bearer tokens, service secrets or secret payloads while collecting
this evidence.

## Capability tokens

For fine-grained access, capability tokens encode:
- Specific resource
- Allowed actions
- Expiry
- Constraints

Used for delegated access patterns.

Capability tokens should be short lived, resource specific and constrained to
the exact actions required by the recipient. Revocation, expiry and audience
checks remain mandatory. A capability cannot widen the issuing identity's own
authority.

## Example least-privilege review

For a deployment process that creates and rotates keys but never decrypts
application data:

1. start with `kms:keys:read`, `kms:keys:create` and `kms:keys:rotate`;
2. exclude key-use, deletion, tenant administration and vault permissions;
3. test the allowed operations using a synthetic key;
4. test that key use and deletion are denied;
5. retain the decision evidence with the deployment change.

Repeat the negative tests after policy changes. A successful allowed request
alone does not prove least privilege.

## Related controls

See [Organization Access](./organization-access), [Token Model](./token-model),
[KMS Access Control](../kms/access-control) and
[Secrets Access Control](../secrets/access-control). The documentation
describes the policy contract; each tenant must still verify its live role
assignments and exceptions.
