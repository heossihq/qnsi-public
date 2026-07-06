---
title: CLI Workflows
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# CLI Workflows

Common workflows using the QNSI CLI.

## Key rotation workflow

```bash
#!/bin/bash

# List keys (JSON) and select by your own criteria.
# Note: key rotation is not implemented in the CLI; use the KMS API/service workflows.
qnsi kms keys list --output json | jq
```

## Secret backup workflow

```bash
#!/bin/bash

# List secrets and fetch a single secret.
# Note: bulk export/encryption helpers are not provided by the CLI.
qnsi vault secrets list --output json | jq
qnsi vault secrets get "$SECRET_ID" --output json | jq
```

## Environment sync workflow

```bash
#!/bin/bash

# The CLI does not implement profiles.
# Use separate environment variables (or separate CI jobs) per environment.
export QNSI_TENANT_ID="your-tenant"
export QNSI_SERVICE_ID="your-service-id"
export QNSI_SERVICE_SECRET="your-service-secret"

qnsi vault secrets get "$SECRET_ID" --output json | jq
```

## Audit export workflow

```bash
#!/bin/bash

# List audit events (JSON) and ship them to your SIEM.
qnsi audit events list --limit 50 --output json | jq
```
