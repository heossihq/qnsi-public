---
title: RBAC and Policies
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# RBAC and Policies

QNSI enforces access control via roles and policies.

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

## Permission format

Permissions follow the pattern:
```
<service>:<resource>:<action>
```

Examples:
- `kms:keys:create`
- `vault:secrets:read`
- `storage:objects:write`

## Policy evaluation

Access control service evaluates:
1. Identity roles
2. Resource policies
3. Tenant-level overrides

All must allow for access to be granted.

## Capability tokens

For fine-grained access, capability tokens encode:
- Specific resource
- Allowed actions
- Expiry
- Constraints

Used for delegated access patterns.
