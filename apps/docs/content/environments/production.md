---
title: Production Environment
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-auth-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.auth./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.

# Production Environment

Live production environment.

## Access

```
Base URL: https://api.qnsi.heossi.com
```

## Characteristics

- SLO monitoring (availability, latency, error rate)
- SLA coverage depends on subscription tier and, for Enterprise, signed agreements
- HSM-backed keys
- Multi-AZ deployment
- 24/7 monitoring

## Configuration

### Available Services

Production includes the following services, all accessible via edge-gateway:

- **Core Security**: auth-service, kms-service, vault-service, audit-service
- **Data**: storage-service, search-service, crypto-inventory-service
- **Platform**: platform-api (admin dashboard backend)
- **Control**: access-control-service, security-monitoring-service, tenant-service
- **Observability**: observability-service
- **AI**: ai-orchestrator
- **Billing**: billing-service

### SDK
```typescript
import { AuthClient } from "@heossi/qnsi-auth-sdk";
import { VaultClient } from "@heossi/qnsi-vault-sdk";

const auth = new AuthClient({
  baseUrl: "https://api.qnsi.heossi.com",
});

const token = await auth.requestServiceToken({
	serviceId: process.env["QNSI_SERVICE_ID"] ?? "",
	serviceSecret: process.env["QNSI_SERVICE_SECRET"] ?? "",
	audience: "internal-service",
});
if (!token) {
	throw new Error("Failed to obtain service token");
}

const vault = new VaultClient({
  baseUrl: "https://api.qnsi.heossi.com/proxy/vault",
  apiKey: token,
});
await vault.createSecret({ tenantId: "<tenant_uuid>", name: "example-secret", payload: "<base64_payload>" });
```

### CLI
```bash
export QNSI_EDGE_GATEWAY_URL=https://api.qnsi.heossi.com
export QNSI_TENANT_ID=<tenant_uuid>
export QNSI_SERVICE_ID=<service_id>
export QNSI_SERVICE_SECRET=<service_secret>
```

## Security requirements

- Use service accounts (not user credentials)
- Rotate credentials regularly
- Enable MFA for admin access
- Review audit logs

## Best practices

### Credentials
- Store in secure vault
- Never commit to code
- Use environment variables
- Rotate on schedule

### Error handling
- Implement retries
- Handle rate limits
- Log errors with request IDs
- Alert on failures

### Monitoring
- Track latency metrics
- Monitor error rates
- Set up alerts
- Review audit logs

## Support

Production issues:
- Critical: PagerDuty escalation
- High: 4-hour response
- Normal: 24-hour response
