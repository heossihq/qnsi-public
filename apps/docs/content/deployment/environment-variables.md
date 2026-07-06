---
title: Environment Variables
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---

# Environment Variables

This document lists all environment variables used across QNSI services.

## Web Portal (`apps/web`)

### Authentication & Access
- `WEB_EDGE_GATEWAY_URL` - Edge Gateway URL (required)
- `XIIS_CONTROL_PLANE_URL` - XIIS control plane base URL for cross-product control-plane integrations (optional)
- `XIIS_CONTROL_PLANE_API_TOKEN` - XIIS control plane bearer token used by live XIIS verification, trust, and evidence endpoints (optional, but required to enable authenticated XIIS calls)
- `WEB_PLATFORM_API_TOKEN` - Platform API access token (optional)
- `WEB_TENANT_SERVICE_URL` - Tenant Service URL (optional, derived from edge-gateway)
- `WEB_BILLING_SERVICE_URL` - Billing Service URL (optional, derived from edge-gateway)
- `WEB_AUTH_SERVICE_URL` - Auth Service URL (optional, derived from edge-gateway)
- `WEB_VAULT_SERVICE_URL` - Vault Service URL (optional, derived from edge-gateway)
- `WEB_STORAGE_SERVICE_URL` - Storage Service URL (optional, derived from edge-gateway)
- `WEB_SEARCH_SERVICE_URL` - Search Service URL (optional, derived from edge-gateway)
- `WEB_KMS_SERVICE_URL` - KMS Service URL (optional, derived from edge-gateway)
- `WEB_AI_ORCHESTRATOR_URL` - AI Orchestrator URL (optional, derived from edge-gateway)
- `WEB_OBSERVABILITY_SERVICE_URL` - Observability Service URL (optional, derived from edge-gateway)
- `WEB_AUDIT_SERVICE_URL` - Audit Service URL (optional, derived from edge-gateway)
- `WEB_ACCESS_CONTROL_SERVICE_URL` - Access Control Service URL (optional, derived from edge-gateway)
- `WEB_SECURITY_MONITORING_SERVICE_URL` - Security Monitoring Service URL (optional, derived from edge-gateway)
- `WEB_OBSERVABILITY_OTLP_ENDPOINT` - OTLP endpoint for metrics (optional)

### Invite and access gate (optional)
- `TP_GATE_JWT_SECRET` - JWT secret for preview invite tokens (required)
- `TP_GATE_PASS` - Optional access code for preview signup (optional)
- `PREVIEW_TOKEN_TTL_DAYS` - Preview token time-to-live in days (default: 14)
- `SALES_EMAIL` - Sales team email for preview signup notifications (default: qnsi-sales@heossi.com)
- `CLOUD_PORTAL_URL` - Cloud portal URL for redirect (default: https://cloud.qnsi.heossi.com)

### Email (SMTP)
- `SMTP_HOST` - SMTP server host (required)
- `SMTP_PORT` - SMTP server port (default: 465)
- `SMTP_SECURE` - Use SSL/TLS (default: true)
- `SMTP_USER` - SMTP username (required)
- `SMTP_PASSWORD` - SMTP password (required)
- `EMAIL_FROM_ADDRESS` - From email address (default: noreply@heossi.com)

### Observability
- `WEB_OBSERVABILITY_METRICS_INTERVAL_MS` - Metrics collection interval (default: 60000)
- `WEB_OBSERVABILITY_METRICS_TIMEOUT_MS` - Metrics timeout (default: 15000)

## Cloud Portal (`apps/cloud`)

### Service URLs
- `WEB_EDGE_GATEWAY_URL` - Edge Gateway URL (required)
- `WEB_TENANT_SERVICE_URL` - Tenant Service URL (optional, derived from edge-gateway)
- `WEB_BILLING_SERVICE_URL` - Billing Service URL (optional, derived from edge-gateway)
- `WEB_AUTH_SERVICE_URL` - Auth Service URL (optional, derived from edge-gateway)
- `XIIS_CONTROL_PLANE_URL` - XIIS control plane base URL for cross-product control-plane integrations (optional)
- `XIIS_CONTROL_PLANE_API_TOKEN` - XIIS control plane bearer token used for trust summary, evidence verification, and XIIS-backed assurance calls (optional, but required to enable authenticated XIIS calls)

### Invite and access gate (optional)
- `TP_GATE_JWT_SECRET` - JWT secret for preview invite tokens (required)
- `CLOUD_PORTAL_URL` - Cloud portal base URL (default: https://cloud.qnsi.heossi.com)

### OAuth and Identity Federation
- `CLOUD_OAUTH_SESSION_SECRET` - CSRF/session protection secret for social OAuth start/callback flows
- `CLOUD_OAUTH_GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- `CLOUD_OAUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret
- `CLOUD_OAUTH_GITHUB_CALLBACK_URL` - Optional GitHub callback override
- `CLOUD_OAUTH_GOOGLE_CLIENT_ID` - Google OAuth app client ID
- `CLOUD_OAUTH_GOOGLE_CLIENT_SECRET` - Google OAuth app client secret
- `CLOUD_OAUTH_GOOGLE_CALLBACK_URL` - Optional Google callback override
- `CLOUD_OAUTH_LINKEDIN_CLIENT_ID` - LinkedIn OAuth app client ID
- `CLOUD_OAUTH_LINKEDIN_CLIENT_SECRET` - LinkedIn OAuth app client secret
- `CLOUD_OAUTH_LINKEDIN_CALLBACK_URL` - Optional LinkedIn callback override
- `CLOUD_OAUTH_MICROSOFT_CLIENT_ID` - Microsoft OAuth app client ID
- `CLOUD_OAUTH_MICROSOFT_CLIENT_SECRET` - Microsoft OAuth app client secret
- `CLOUD_OAUTH_MICROSOFT_CALLBACK_URL` - Optional Microsoft callback override

## Billing Service (`apps/billing-service`)

### Database
- `BILLING_DATABASE_URL` - PostgreSQL connection string (required)
- `BILLING_DATABASE_SSL` - SSL mode for database connection (default: prefer)
- `BILLING_DATABASE_MAX_CONNECTIONS` - Max pool connections (default: 20)
- `BILLING_DATABASE_IDLE_TIMEOUT_MS` - Idle timeout in ms (default: 30000)

### Stripe
- `STRIPE_SECRET_KEY` - Stripe API secret key (optional)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (optional)
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (optional)

### GitHub Marketplace
- `GITHUB_MARKETPLACE_WEBHOOK_SECRET` - GitHub Marketplace webhook signing secret used to verify `X-Hub-Signature-256` on GitHub Marketplace deliveries including `ping` and `marketplace_purchase` (optional, but required to enable the route)

## Auth Service (`apps/auth-service`)

### Federation Background Work
- `AUTH_FEDERATION_EMBEDDED_WORKERS_ENABLED` - Run SCIM and metadata refresh loops inside auth-service instead of a separate worker (default: `true`)
- `AUTH_FEDERATION_SCIM_WORKER_ENABLED` - Enable SCIM import job processing (default: `true`)
- `AUTH_FEDERATION_SCIM_WORKER_INTERVAL_MS` - SCIM import polling interval in ms
- `AUTH_FEDERATION_SAML_METADATA_REFRESH_ENABLED` - Enable SAML metadata refresh polling (default: `true`)
- `AUTH_FEDERATION_SAML_METADATA_REFRESH_INTERVAL_MS` - SAML metadata refresh interval in ms

### XIIS Integration
- `XIIS_CONTROL_PLANE_URL` - XIIS control plane base URL used by QNSI frontends for live trust, evidence, and verifier integrations
- `XIIS_CONTROL_PLANE_API_TOKEN` - XIIS control plane bearer token used to authenticate release assurance, attestation verification, environment verification, and remote provider checks

### AWS Marketplace
- `AWS_MARKETPLACE_PRODUCT_CODE` - AWS Marketplace product code (optional)
- `AWS_MARKETPLACE_REGION` - AWS region for Marketplace (default: us-east-1)

### Admin
- `ADMIN_TOKEN` - Admin access token for provisioning (optional)

### Tier Sync
- `TIER_SYNC_CANARY_TENANT_ID` - Canary tenant for sync verification (optional)
- `TIER_SYNC_ALERT_CONFIG` - JSON config for sync alerts (optional)

## Cron Jobs

### Invite Signup Expiry Handling
- `BILLING_SERVICE_URL` - Billing Service URL (required)
- `GRACE_PERIOD_DAYS` - Grace period in days after expiry (default: 7)

### Invite Signup Reminder Emails
- `BILLING_SERVICE_URL` - Billing Service URL (required)
- `SMTP_HOST` - SMTP server host (required)
- `SMTP_PORT` - SMTP server port (default: 465)
- `SMTP_SECURE` - Use SSL/TLS (default: true)
- `SMTP_USER` - SMTP username (required)
- `SMTP_PASSWORD` - SMTP password (required)
- `EMAIL_FROM_ADDRESS` - From email address (default: noreply@heossi.com)
- `CLOUD_PORTAL_URL` - Cloud portal URL (default: https://cloud.qnsi.heossi.com)

## Common Service Variables

### Logging
- `LOG_LEVEL` - Log level (default: info)
- `OTLP_ENDPOINT` - OpenTelemetry endpoint (optional)

### Service Configuration
- `PORT` - Service port (varies by service)
- `HOST` - Service host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development, staging, production)

## Security Notes

- Never commit secrets to version control
- Use environment-specific secrets (dev, staging, prod)
- Rotate secrets regularly
- Use least-privilege access for service accounts
- Enable audit logging for sensitive operations

## See Also

- [Production Environment](/environments/production)
- [Development Environment](/environments/development)
- [Getting Started](/getting-started/overview)
