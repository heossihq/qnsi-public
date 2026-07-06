---
title: "Quickstart: First API Call"
version: 0.0.2
last_updated: 2026-04-23
description: "Make your first QNSI API call in under 10 minutes using curl: obtain a service access token, then send an authenticated request scoped to your tenant ID."
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/auth-service/src/server.ts
  - /apps/kms-service/src/config/env.ts
---
# Quickstart: First API Call

This guide gets you to a successful API call in under 10 minutes.

## Prerequisites

- A tenant ID and service account credentials
- `curl` and `jq` installed

## Step 1: Get an access token

```bash
export SERVICE_ID="your-service-id"
export SERVICE_SECRET="your-service-secret"

ACCESS_TOKEN=$(curl -sS -X POST \
  -H "Authorization: Bearer $SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"serviceId\": \"$SERVICE_ID\", \"audience\": \"internal-service\"}" \
  https://api.qnsi.heossi.com/auth/service-token \
  | jq -r '.accessToken')

echo $ACCESS_TOKEN
```

## Step 2: Make an authenticated request

```bash
export TENANT_ID="your-tenant-uuid"

curl -sS \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://api.qnsi.heossi.com/proxy/kms/v1/keys?tenantId=$TENANT_ID" \
  | jq
```

## Step 3: Check health endpoints

Health endpoints are public and bypass bot protection for GET/HEAD requests:

```bash
# Check all services health
curl -sS https://api.qnsi.heossi.com/proxy/health | jq

# Check specific service health
curl -sS https://api.qnsi.heossi.com/proxy/platform/health | jq
curl -sS https://api.qnsi.heossi.com/proxy/billing/health | jq
```

The `/proxy/health` endpoint returns the health status of all services:
```json
{
  "status": "healthy",
  "services": {
    "platform-api": {"status": "healthy", "latencyMs": 3},
    "auth-service": {"status": "healthy", "latencyMs": 5},
    ...
  }
}
```

## Common pitfalls

- **Missing tenant**: Returns `400 BAD_REQUEST` — include `tenantId` query parameter
- **Expired token**: Returns `401 UNAUTHORIZED` — request a new token and retry
- **Wrong audience**: Returns `403 FORBIDDEN` — check token audience matches endpoint requirements
