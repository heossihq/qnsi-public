---
title: QNSI Production and Local Environments
version: 0.0.1
last_updated: 2026-07-31
description: Configure QNSI development, test, and production behavior, approved API base URLs, runtime secrets, and production promotion checks.
copyright: © 2025 HEOSSI. All rights reserved.
---
# QNSI Production and Local Environments

QNSI services recognize three environment types via `NODE_ENV`:

The environment value changes safety and diagnostics behavior; it is not a
tenant, region or deployment identifier. Never use `NODE_ENV` to decide which
customer owns a request.

## Environment types

| Environment | Purpose | Characteristics |
|-------------|---------|-----------------|
| `development` | Local development | Relaxed validation, verbose logging |
| `test` | Automated testing | Deterministic behavior, test fixtures |
| `production` | Live workloads | Strict validation, optimized performance |

Tests may use deterministic providers and fixtures that are deliberately
unavailable to production. Evidence produced in `test` must therefore be
labelled as test evidence and cannot be presented as proof of a live
production control.

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.qnsi.heossi.com` |
| Local | `http://localhost:<port>` |

Staging endpoints (if available) are provided separately per deployment.

The public SDK and CLI default to the production edge endpoint. Local
development requires an explicit local base URL. Do not guess staging
hostnames or place an undocumented staging URL in customer configuration.

## Environment-specific behavior

- **Token TTLs**: May differ between environments
- **Rate limits**: Development environments have relaxed limits
- **Logging**: Production uses structured JSON; development uses human-readable format

Production services also avoid loading local `.env` files unless that behavior
is explicitly enabled for a controlled deployment. Runtime secrets should come
from the deployment's secret manager rather than a file shipped in the image.

## Configuration precedence

Use this order when troubleshooting an environment:

1. explicit command or client option;
2. canonical `QNSI_*` environment variable;
3. supported compatibility alias, where documented;
4. production-safe application default.

Record the resolved URL and environment name, but redact credentials. A
configuration file existing on disk does not prove the running process loaded
it.

## Promotion checklist

Before promoting from development or test to production:

- replace test fixtures and deterministic cryptographic providers;
- resolve every service through the production edge or approved internal
  service-discovery name;
- verify TLS and reject plain HTTP service URLs;
- source credentials from the production secret manager;
- run schema migrations and service health checks;
- perform one authenticated read and one controlled write using a synthetic
  tenant;
- confirm audit, metrics and alert delivery;
- retain the build identifier and verification timestamps.

## Local development

Local ports vary by service. Use the repository's local orchestration and
service manifests instead of copying a port from an unrelated example. Bind
only to interfaces required for the test and do not expose development
credentials to a shared network.

See [Development Environment](../environments/development),
[Staging Environment](../environments/staging) and
[Production Environment](../environments/production) for deployment-specific
guidance.
