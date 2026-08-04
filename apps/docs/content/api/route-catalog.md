---
title: API Route Catalog
version: 0.1.0
last_updated: 2026-07-20
copyright: © 2026 HEOSSI. All rights reserved.
license: BSL-1.1
---

# QNSI API Route Source Index

This page is auto-generated from statically visible `server.get/post/put/delete/patch` calls in service route source files. It is a source-level engineering index, not proof that a registrar is mounted or that an endpoint is externally reachable. The service manifests and production surface probe provide separate declaration and reachability evidence. For supported public contracts and usage examples, see [API Reference](./reference.md).

---

## AI Orchestrator

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/v1/artifacts` |  |
| GET | `/ai/v1/bias/configs` |  |
| POST | `/ai/v1/bias/configs` |  |
| DELETE | `/ai/v1/bias/configs/:id` |  |
| GET | `/ai/v1/bias/configs/:id` |  |
| PATCH | `/ai/v1/bias/configs/:id` |  |
| GET | `/ai/v1/bias/evaluations` |  |
| POST | `/ai/v1/bias/evaluations` |  |
| GET | `/ai/v1/bias/evaluations/:id` |  |
| PATCH | `/ai/v1/bias/evaluations/:id` |  |
| POST | `/ai/v1/bias/evaluations/:id/start` |  |
| GET | `/ai/v1/bias/incidents` |  |
| POST | `/ai/v1/bias/incidents` |  |
| GET | `/ai/v1/bias/incidents/:id` |  |
| PATCH | `/ai/v1/bias/incidents/:id` |  |
| GET | `/ai/v1/bias/metrics` |  |
| POST | `/ai/v1/bias/metrics` |  |
| POST | `/ai/v1/bias/metrics/batch` |  |
| GET | `/ai/v1/bias/summary` |  |
| GET | `/ai/v1/costs/alerts` |  |
| POST | `/ai/v1/costs/alerts/:id/acknowledge` |  |
| GET | `/ai/v1/costs/analytics` |  |
| GET | `/ai/v1/costs/budgets` |  |
| POST | `/ai/v1/costs/budgets` |  |
| DELETE | `/ai/v1/costs/budgets/:id` |  |
| GET | `/ai/v1/costs/budgets/:id` |  |
| PATCH | `/ai/v1/costs/budgets/:id` |  |
| GET | `/ai/v1/costs/recommendations` |  |
| POST | `/ai/v1/costs/recommendations` |  |
| POST | `/ai/v1/costs/recommendations/:id/accept` |  |
| POST | `/ai/v1/costs/recommendations/:id/reject` |  |
| POST | `/ai/v1/costs/record` | Transactional outbox for ai.recommendation.issued.v1 (sweep F6/F8). |
| POST | `/ai/v1/costs/record/batch` |  |
| GET | `/ai/v1/costs/summary` |  |
| GET | `/ai/v1/enclaves` |  |
| POST | `/ai/v1/enclaves` |  |
| POST | `/ai/v1/inference` |  |
| GET | `/ai/v1/inference/:id/stream` |  |
| GET | `/ai/v1/models` | List model deployments for a tenant |
| POST | `/ai/v1/models` | Register a new model deployment (submits a long-running workload tagged as a model) |
| DELETE | `/ai/v1/models/:id` | Delete (cancel) a model deployment |
| GET | `/ai/v1/models/:id` | Get a specific model deployment |
| GET | `/ai/v1/registry/deployments` |  |
| POST | `/ai/v1/registry/deployments` |  |
| GET | `/ai/v1/registry/deployments/:id` |  |
| PATCH | `/ai/v1/registry/deployments/:id` |  |
| POST | `/ai/v1/registry/deployments/:id/stop` |  |
| GET | `/ai/v1/registry/models` |  |
| POST | `/ai/v1/registry/models` |  |
| DELETE | `/ai/v1/registry/models/:id` |  |
| GET | `/ai/v1/registry/models/:id` |  |
| PATCH | `/ai/v1/registry/models/:id` |  |
| POST | `/ai/v1/registry/models/:id/activate` |  |
| POST | `/ai/v1/registry/models/:id/deprecate` |  |
| GET | `/ai/v1/registry/models/:id/versions` |  |
| POST | `/ai/v1/registry/models/:id/versions` |  |
| POST | `/ai/v1/security/incidents/analyze` |  |
| POST | `/ai/v1/security/injection/analyze` |  |
| GET | `/ai/v1/security/injection/configs` |  |
| PATCH | `/ai/v1/security/injection/configs` |  |
| POST | `/ai/v1/security/injection/configs` |  |
| GET | `/ai/v1/security/injection/incidents` |  |
| POST | `/ai/v1/security/injection/incidents` |  |
| GET | `/ai/v1/security/injection/incidents/:id` |  |
| GET | `/ai/v1/security/injection/patterns` |  |
| POST | `/ai/v1/security/injection/patterns` |  |
| DELETE | `/ai/v1/security/injection/patterns/:id` |  |
| GET | `/ai/v1/security/injection/patterns/:id` |  |
| PATCH | `/ai/v1/security/injection/patterns/:id` |  |
| GET | `/ai/v1/security/injection/stats` |  |
| GET | `/ai/v1/security/injection/summary` |  |
| GET | `/ai/v1/workloads` |  |
| POST | `/ai/v1/workloads` |  |
| GET | `/ai/v1/workloads/:id` |  |
| POST | `/ai/v1/workloads/:id/cancel` |  |
| GET | `/health` |  |

## Access Control

| Method | Path | Description |
|--------|------|-------------|
| GET | `/access/v1/ai/content-policy/:tenantId` |  |
| PUT | `/access/v1/ai/content-policy/:tenantId` |  |
| POST | `/access/v1/capabilities` |  |
| POST | `/access/v1/capabilities/:tokenId/revoke` |  |
| POST | `/access/v1/capabilities/introspect` |  |
| POST | `/access/v1/check` | Check whether a subject has a permission (optionally within a scope) |
| POST | `/access/v1/cross-tenant/anomalies` | Detect access anomalies across tenants |
| POST | `/access/v1/cross-tenant/compare` | Compare policies across tenants |
| GET | `/access/v1/cross-tenant/graph` | Get cross-tenant access graph |
| GET | `/access/v1/cross-tenant/isolation-audit` | Tenant isolation audit |
| POST | `/access/v1/cross-tenant/overview` | Cross-tenant access overview |
| POST | `/access/v1/evaluate` |  |
| DELETE | `/access/v1/internal/tenant/:tenantId` |  |
| POST | `/access/v1/jit/check` | Check if user has JIT access to resource |
| POST | `/access/v1/jit/grants/:grantId/revoke` | Revoke JIT grant |
| GET | `/access/v1/jit/grants/user/:userId` | Get active JIT grants for a user |
| GET | `/access/v1/jit/policies` | List JIT policies |
| POST | `/access/v1/jit/policies` | Create/update JIT policy |
| GET | `/access/v1/jit/requests` | List JIT requests |
| POST | `/access/v1/jit/requests` | Request JIT access |
| POST | `/access/v1/jit/requests/:requestId/process` | Process (approve/deny) JIT request |
| GET | `/access/v1/jit/stats` | JIT statistics |
| POST | `/access/v1/policies` |  |
| GET | `/access/v1/policies/:policyId` |  |
| GET | `/access/v1/reviews/campaigns` | List access review campaigns |
| POST | `/access/v1/reviews/campaigns` | Create a new access review campaign |
| POST | `/access/v1/reviews/campaigns/:campaignId/complete` | Complete a review campaign |
| GET | `/access/v1/reviews/campaigns/:campaignId/items` | Get review items for a campaign |
| POST | `/access/v1/reviews/campaigns/:campaignId/items/:itemId/decision` | Submit a review decision for an item |
| POST | `/access/v1/reviews/campaigns/:campaignId/start` | Start a review campaign (generates review items) |
| GET | `/access/v1/reviews/stats` | Get access review statistics |
| POST | `/access/v1/role-assignments` | Assign a role to a subject |
| DELETE | `/access/v1/role-assignments/:assignmentId` | Revoke a role assignment |
| GET | `/access/v1/roles` | List roles |
| POST | `/access/v1/roles` | Create a role |
| DELETE | `/access/v1/roles/:roleId` | Delete a role (and its assignments) |
| GET | `/access/v1/roles/:roleId` | Get a role |
| PATCH | `/access/v1/roles/:roleId` | Update a role |
| POST | `/access/v1/simulate` | Simulate a single access request |
| POST | `/access/v1/simulate/batch` | Batch simulation for multiple requests |
| GET | `/access/v1/simulate/history` | Get simulation history |
| POST | `/access/v1/simulate/impact` | Impact analysis for policy changes |
| GET | `/access/v1/tenants/:tenantId/policies` |  |
| GET | `/access/v1/zero-trust/status` |  |

## Audit

| Method | Path | Description |
|--------|------|-------------|
| POST | `/audit/v1/chain/verify` |  |
| GET | `/audit/v1/checkpoints` |  |
| GET | `/audit/v1/checkpoints/:id/proofs/public` | Public, receipt-facing inclusion proof. The proof contains only hashes and the signed checkpoint metadata; it never exposes event payloads. |
| GET | `/audit/v1/checkpoints/:id/verify` |  |
| GET | `/audit/v1/checkpoints/latest` |  |
| GET | `/audit/v1/checkpoints/latest/public` | are exposed; internal event IDs, counts of per-tenant events, and chain-state cursors are NOT included. |
| GET | `/audit/v1/compliance/frameworks` |  |
| GET | `/audit/v1/compliance/frameworks/:frameworkId` |  |
| GET | `/audit/v1/compliance/reports` |  |
| POST | `/audit/v1/compliance/reports/generate` |  |
| GET | `/audit/v1/conformance/runs/:runId` |  |
| GET | `/audit/v1/conformance/stats` |  |
| GET | `/audit/v1/events` |  |
| POST | `/audit/v1/events` |  |
| GET | `/audit/v1/forensic/timeline` | Advanced forensic timeline endpoint |
| POST | `/audit/v1/hipaa/incidents` | Create a HIPAA incident POST /audit/v1/hipaa/incidents |
| GET | `/audit/v1/hipaa/incidents/:id` | Get HIPAA incident report GET /audit/v1/hipaa/incidents/:id |
| POST | `/audit/v1/hipaa/incidents/:id/customer-notify` | Mark customer as notified POST /audit/v1/hipaa/incidents/:id/customer-notify |
| POST | `/audit/v1/hipaa/incidents/:id/hhs-report` | Report incident to HHS (for breaches affecting 500+ individuals) POST /audit/v1/hipaa/incidents/:id/hhs-report |
| PATCH | `/audit/v1/hipaa/incidents/:id/status` | Update incident status PATCH /audit/v1/hipaa/incidents/:id/status |
| POST | `/audit/v1/kms-evidence` |  |
| POST | `/audit/v1/receipts` |  |
| GET | `/audit/v1/receipts/:id/verify` |  |
| POST | `/audit/v1/retention/cleanup` | Execute manual cleanup POST /audit/v1/retention/cleanup |
| GET | `/audit/v1/retention/metrics` | Get retention metrics and statistics GET /audit/v1/retention/metrics |
| GET | `/audit/v1/retention/policies` | List retention policies for a tenant GET /audit/v1/retention/policies |
| POST | `/audit/v1/retention/policies` | Create a retention policy POST /audit/v1/retention/policies |
| DELETE | `/audit/v1/retention/policies/:policyId` | Delete a retention policy DELETE /audit/v1/retention/policies/:policyId |
| GET | `/audit/v1/retention/policies/:policyId` | Get a retention policy GET /audit/v1/retention/policies/:policyId |
| PATCH | `/audit/v1/retention/policies/:policyId` | Update a retention policy PATCH /audit/v1/retention/policies/:policyId |
| POST | `/audit/v1/retention/preview` | Preview retention impact (what would be deleted) POST /audit/v1/retention/preview |
| POST | `/audit/v1/search` |  |
| GET | `/audit/v1/stats` |  |
| GET | `/audit/v1/streaming/connections` | Get active streaming connections (admin endpoint) GET /audit/v1/streaming/connections |
| DELETE | `/audit/v1/streaming/connections/:connectionId` | Disconnect a streaming connection (admin endpoint) DELETE /audit/v1/streaming/connections/:connectionId |
| GET | `/audit/v1/streaming/events` | SSE endpoint for streaming audit events GET /audit/v1/streaming/events |
| GET | `/audit/v1/streaming/metrics` | Get streaming metrics GET /audit/v1/streaming/metrics |
| GET | `/audit/v1/streaming/subscriptions` | List streaming subscriptions for a tenant GET /audit/v1/streaming/subscriptions |
| POST | `/audit/v1/streaming/subscriptions` | Create a streaming subscription POST /audit/v1/streaming/subscriptions |
| DELETE | `/audit/v1/streaming/subscriptions/:subscriptionId` | Delete a streaming subscription DELETE /audit/v1/streaming/subscriptions/:subscriptionId |
| GET | `/audit/v1/streaming/subscriptions/:subscriptionId` | Get a streaming subscription GET /audit/v1/streaming/subscriptions/:subscriptionId |
| PATCH | `/audit/v1/streaming/subscriptions/:subscriptionId` | Update a streaming subscription PATCH /audit/v1/streaming/subscriptions/:subscriptionId |
| POST | `/v1/audit/chain/verify` |  |
| POST | `/v1/audit/intent` |  |
| GET | `/v1/audit/intent/:intentId` |  |
| POST | `/v1/audit/intent/complete` |  |
| POST | `/v1/audit/merkle/build` |  |
| GET | `/v1/audit/proof/:receiptId` |  |
| POST | `/v1/audit/verify` |  |

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/analytics/events` |  |
| GET | `/auth/analytics/risk-report` |  |
| GET | `/auth/analytics/sessions` |  |
| GET | `/auth/analytics/sessions/:sessionId` |  |
| GET | `/auth/analytics/stats` |  |
| POST | `/auth/email/addon-request` |  |
| POST | `/auth/email/join-request-notification` |  |
| POST | `/auth/email/team-invitation` |  |
| POST | `/auth/email/welcome` | Send welcome email to newly registered user. Called by billing-service after successful signup provisioning. |
| GET | `/auth/federation/:providerId/metadata` | Get federation metadata |
| GET | `/auth/federation/audit/cross-tenant` | Cross-tenant federation activity (for admin) |
| POST | `/auth/federation/audit/query` | Query federated audit events |
| GET | `/auth/federation/audit/reports` | List generated reports |
| POST | `/auth/federation/audit/reports` | Generate compliance report |
| GET | `/auth/federation/audit/reports/:reportId` | Get specific report |
| POST | `/auth/federation/config` | Register/update federation configuration (admin endpoint) |
| DELETE | `/auth/federation/config/:providerId` |  |
| GET | `/auth/federation/config/:providerId` |  |
| PUT | `/auth/federation/config/:providerId` |  |
| POST | `/auth/federation/config/:providerId/refresh-metadata` |  |
| POST | `/auth/federation/oidc/callback` | OIDC callback endpoint |
| POST | `/auth/federation/oidc/start` |  |
| GET | `/auth/federation/providers` |  |
| GET | `/auth/federation/public/providers` |  |
| POST | `/auth/federation/public/start` |  |
| POST | `/auth/federation/saml/acs` |  |
| POST | `/auth/federation/saml/assertion` | SAML assertion endpoint |
| POST | `/auth/federation/saml/start` |  |
| POST | `/auth/federation/scim/:providerId/Bulk` |  |
| GET | `/auth/federation/scim/:providerId/Groups` |  |
| POST | `/auth/federation/scim/:providerId/Groups` |  |
| DELETE | `/auth/federation/scim/:providerId/Groups/:groupId` |  |
| GET | `/auth/federation/scim/:providerId/Groups/:groupId` |  |
| PATCH | `/auth/federation/scim/:providerId/Groups/:groupId` |  |
| PUT | `/auth/federation/scim/:providerId/Groups/:groupId` |  |
| GET | `/auth/federation/scim/:providerId/ServiceProviderConfig` |  |
| GET | `/auth/federation/scim/:providerId/Users` |  |
| POST | `/auth/federation/scim/:providerId/Users` |  |
| DELETE | `/auth/federation/scim/:providerId/Users/:userId` |  |
| GET | `/auth/federation/scim/:providerId/Users/:userId` |  |
| PATCH | `/auth/federation/scim/:providerId/Users/:userId` |  |
| PUT | `/auth/federation/scim/:providerId/Users/:userId` |  |
| POST | `/auth/federation/scim/:providerId/import-jobs` |  |
| GET | `/auth/federation/scim/:providerId/import-jobs/:jobId` |  |
| GET | `/auth/federation/scim/:providerId/metadata` |  |
| POST | `/auth/federation/scim/:providerId/rotate-token` |  |
| GET | `/auth/federation/templates` |  |
| POST | `/auth/forgot-account` | Look up cloud accounts by email Sends email with list of accounts if any exist |
| POST | `/auth/forgot-password` | Request password reset Sends email with reset link if user exists |
| POST | `/auth/mfa/challenge` | Generate MFA challenge (TOTP) |
| POST | `/auth/mfa/verify` | Verify MFA challenge (TOTP) |
| GET | `/auth/oauth/identity` | Returns { userId, tenantId } or 404. Protected by AUTH_OAUTH_SESSION_SECRET. |
| POST | `/auth/oauth/identity` | Upsert an OAuth identity link. Protected by AUTH_OAUTH_SESSION_SECRET. |
| POST | `/auth/oauth/session` | Caller must supply { userId, tenantId, roles } - verified server-side. Protected by AUTH_OAUTH_SESSION_SECRET. |
| GET | `/auth/oauth/user-by-email` | is not linked yet but the user account already exists. Protected by AUTH_OAUTH_SESSION_SECRET. |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/risk/evaluate` | Evaluate authentication risk |
| GET | `/auth/risk/policies` | List risk policies |
| POST | `/auth/risk/policies` | Configure risk policy |
| POST | `/auth/risk/signals` | Report threat signal |
| GET | `/auth/risk/stats` | Get risk statistics |
| GET | `/auth/risk/users/:userId/signals` | Get risk signals for a user |
| DELETE | `/auth/v1/internal/tenant/:tenantId` |  |
| GET | `/auth/v1/nhi/discovery` |  |
| GET | `/auth/v1/nhi/identities` |  |
| POST | `/auth/v1/service-accounts` |  |
| POST | `/auth/v1/service-accounts/:serviceAccountId/keys` |  |
| POST | `/auth/v1/service-accounts/:serviceAccountId/rotate-secret` |  |
| PATCH | `/auth/v1/service-accounts/:serviceAccountId/status` |  |
| POST | `/auth/webauthn/authenticate/complete` | Complete passkey authentication |
| POST | `/auth/webauthn/authenticate/start` | Start passkey authentication |
| DELETE | `/auth/webauthn/credentials/:credentialId` | Delete a passkey |
| GET | `/auth/webauthn/credentials/:userId` | List passkeys for a user |
| POST | `/auth/webauthn/register/complete` | Complete passkey registration |
| POST | `/auth/webauthn/register/start` | Start passkey registration |

## Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/aws/entitlement/:customerIdentifier` | Verify customer subscription Used by other services to verify AWS Marketplace subscriptions |
| POST | `/api/marketplace/aws/resolve-customer` | AWS Marketplace. The registration token is passed as a query parameter by AWS Marketplace to the fulfillment URL. |
| POST | `/api/marketplace/aws/webhook` | AWS Marketplace webhook endpoint Handles subscription events from AWS Marketplace |
| GET | `/api/marketplace/azure/entitlement/:subscriptionId` | Get subscription entitlement by Azure subscription ID. GET /api/marketplace/azure/entitlement/:subscriptionId |
| POST | `/api/marketplace/azure/resolve` | Called when a customer clicks through from Azure Marketplace to the QNSP landing page. The marketplace token is passed as a query parameter. |
| POST | `/api/marketplace/azure/webhook` | Must respond with HTTP 200 to acknowledge receipt. For ChangePlan/ChangeQuantity, must PATCH the operation within 10 seconds. |
| GET | `/api/marketplace/vercel/oauth/callback` | OAuth callback (user-initiated install flow) ======================================================================= |
| GET | `/api/marketplace/vercel/sso` | SSO deep link ======================================================================= |
| DELETE | `/api/marketplace/vercel/v1/installations/:installationId` |  |
| GET | `/api/marketplace/vercel/v1/installations/:installationId` |  |
| GET | `/api/marketplace/vercel/v1/installations/:installationId/billing/plans` |  |
| POST | `/api/marketplace/vercel/v1/installations/:installationId/resources` | Partner API: Resource lifecycle ======================================================================= |
| DELETE | `/api/marketplace/vercel/v1/installations/:installationId/resources/:resourceId` |  |
| GET | `/api/marketplace/vercel/v1/installations/:installationId/resources/:resourceId` |  |
| PATCH | `/api/marketplace/vercel/v1/installations/:installationId/resources/:resourceId` |  |
| GET | `/api/marketplace/vercel/v1/products/:productId/plans` | Partner API: Billing plans ======================================================================= |
| POST | `/api/marketplace/vercel/webhook` | Webhook receiver (Vercel -> us) ======================================================================= |
| GET | `/billing/addons/:tenantId` | List all enabled add-ons for a tenant GET /addons/:tenantId |
| GET | `/billing/addons/catalog` | List all available add-ons with pricing GET /addons/catalog |
| POST | `/billing/addons/disable` | Disable an add-on for a tenant POST /addons/disable |
| POST | `/billing/addons/enable` | Enable an add-on for a tenant POST /addons/enable |
| POST | `/billing/addons/request` | Request an add-on (sales-assisted flow) POST /addons/request |
| GET | `/billing/tiers/catalog` | Returns the full tier catalog from TIER_PRICING config. Used by the frontend upgrade page to display dynamic pricing. |
| GET | `/billing/upgrade-context` |  |
| POST | `/billing/v1/admin/addons/enable` | Auth: same BILLING_ADMIN_TOKEN as provision-tier. Body: { tenantId: string (uuid), addonId: AddOnId, reason?: string } |
| POST | `/billing/v1/admin/addons/requests/complete` |  |
| GET | `/billing/v1/admin/funnel` |  |
| POST | `/billing/v1/admin/provision-tier` | This bypasses Stripe entirely - no payment required. Use for internal validation and non-production environments. |
| POST | `/billing/v1/admin/signup/cleanup` | Admin endpoint to cleanup failed signups (requires admin token) |
| POST | `/billing/v1/admin/signup/complete-provisioning` |  |
| POST | `/billing/v1/admin/signup/retry-provisioning` | Admin endpoint to retry provisioning for failed signups |
| DELETE | `/billing/v1/admin/tier/:tenantId` | Revoke tier entitlement (downgrade to free) DELETE /billing/v1/admin/tier/:tenantId |
| GET | `/billing/v1/admin/tier/:tenantId` | Get current tier entitlement for a tenant GET /billing/v1/admin/tier/:tenantId |
| GET | `/billing/v1/analytics/revenue/breakdown/:tenantId` | Get revenue breakdown by category GET /billing/v1/analytics/revenue/breakdown/:tenantId |
| GET | `/billing/v1/analytics/revenue/by-service` | Get revenue by service/meter type GET /billing/v1/analytics/revenue/by-service |
| GET | `/billing/v1/analytics/revenue/mrr` | Get Monthly Recurring Revenue (MRR) metrics GET /billing/v1/analytics/revenue/mrr |
| GET | `/billing/v1/analytics/revenue/summary` | Get revenue summary/overview GET /billing/v1/analytics/revenue/summary |
| GET | `/billing/v1/analytics/revenue/tenant/:tenantId` | Get revenue by tenant over time GET /billing/v1/analytics/revenue/tenant/:tenantId |
| GET | `/billing/v1/analytics/revenue/time-series` | Get revenue time series for charts GET /billing/v1/analytics/revenue/time-series |
| GET | `/billing/v1/analytics/revenue/top-tenants` | Get top revenue-generating tenants GET /billing/v1/analytics/revenue/top-tenants |
| GET | `/billing/v1/conformance/active-tenants` |  |
| GET | `/billing/v1/conformance/quota/:tenantId` |  |
| POST | `/billing/v1/conformance/quota/:tenantId/consume` |  |
| POST | `/billing/v1/credits` | Create a credit for a tenant POST /billing/v1/credits |
| POST | `/billing/v1/credits/apply` | Apply credit to an invoice or balance POST /billing/v1/credits/apply |
| GET | `/billing/v1/credits/balance/:tenantId` | Get credit balance for a tenant GET /billing/v1/credits/balance/:tenantId |
| GET | `/billing/v1/credits/history/:tenantId` | Get credit transaction history GET /billing/v1/credits/history/:tenantId |
| GET | `/billing/v1/credits/metrics` | Get credit system metrics GET /billing/v1/credits/metrics |
| POST | `/billing/v1/credits/process-expirations` | Process expired credits (cron endpoint) POST /billing/v1/credits/process-expirations |
| POST | `/billing/v1/credits/transfer` | Transfer credits between tenants POST /billing/v1/credits/transfer |
| POST | `/billing/v1/credits/void` | Void/cancel a credit POST /billing/v1/credits/void |
| POST | `/billing/v1/dunning/escalate` | Create an escalation for a failed payment POST /billing/v1/dunning/escalate |
| GET | `/billing/v1/dunning/failed-payments` | List all failed payments across tenants GET /billing/v1/dunning/failed-payments |
| GET | `/billing/v1/dunning/metrics` | Get dunning metrics/dashboard data GET /billing/v1/dunning/metrics |
| POST | `/billing/v1/dunning/process` | Process scheduled dunning actions (cron endpoint) POST /billing/v1/dunning/process |
| POST | `/billing/v1/dunning/resolve` | Manually resolve a failed payment POST /billing/v1/dunning/resolve |
| POST | `/billing/v1/dunning/retry` | Manually retry a failed payment POST /billing/v1/dunning/retry |
| POST | `/billing/v1/dunning/schedule` | Configure dunning schedule for a tenant POST /billing/v1/dunning/schedule |
| GET | `/billing/v1/dunning/schedule/:tenantId` | Get dunning schedule for a tenant GET /billing/v1/dunning/schedule/:tenantId |
| GET | `/billing/v1/dunning/status/:tenantId` | Get dunning status for a tenant GET /billing/v1/dunning/status/:tenantId |
| GET | `/billing/v1/forecasting/anomalies/:tenantId` | Detect usage anomalies GET /billing/v1/forecasting/anomalies/:tenantId |
| GET | `/billing/v1/forecasting/billing/:tenantId` | Get billing/cost forecast for a tenant GET /billing/v1/forecasting/billing/:tenantId |
| GET | `/billing/v1/forecasting/capacity/:tenantId` | Get capacity planning forecast GET /billing/v1/forecasting/capacity/:tenantId |
| GET | `/billing/v1/forecasting/trends/:tenantId` | Get trend analysis for usage GET /billing/v1/forecasting/trends/:tenantId |
| GET | `/billing/v1/forecasting/usage/:tenantId` | Get usage forecast for a tenant GET /billing/v1/forecasting/usage/:tenantId |
| POST | `/billing/v1/funnel/events` |  |
| DELETE | `/billing/v1/internal/tenant/:tenantId` |  |
| GET | `/billing/v1/invoices` |  |
| POST | `/billing/v1/invoices` |  |
| POST | `/billing/v1/invoices/generate` |  |
| GET | `/billing/v1/marketplace/gcp/entitlement/:entitlementId` | Get entitlement details by GCP entitlement ID. GET /api/marketplace/gcp/entitlement/:entitlementId |
| POST | `/billing/v1/marketplace/gcp/resolve` | Resolve a GCP Marketplace procurement token from the landing page. POST /api/marketplace/gcp/resolve |
| POST | `/billing/v1/marketplace/gcp/webhook` | Receives subscription lifecycle events from GCP via Pub/Sub push. Must respond with HTTP 200 to acknowledge receipt (non-200 triggers retry). |
| POST | `/billing/v1/marketplace/github/webhook` |  |
| POST | `/billing/v1/meters` |  |
| GET | `/billing/v1/promotions` | List available promotions GET /billing/v1/promotions |
| POST | `/billing/v1/promotions` | Create a promotion/coupon code POST /billing/v1/promotions |
| POST | `/billing/v1/promotions/redeem` | Redeem a promotion code POST /billing/v1/promotions/redeem |
| POST | `/billing/v1/sdk/activate` |  |
| POST | `/billing/v1/signup/init` |  |
| POST | `/billing/v1/signup/oauth` |  |
| GET | `/billing/v1/signup/status` | Get signup status by checkout session ID |
| POST | `/billing/v1/stripe/checkout` | Create Stripe Checkout session for subscription POST /billing/v1/stripe/checkout |
| GET | `/billing/v1/stripe/grace-period/:tenantId` | Get grace period status for a tenant GET /billing/v1/stripe/grace-period/:tenantId |
| GET | `/billing/v1/stripe/payment-methods/:tenantId` | Get customer's payment methods GET /billing/v1/stripe/payment-methods/:tenantId |
| POST | `/billing/v1/stripe/process-grace-periods` | to process accounts that have exceeded their 7-day grace period and downgrade them to the free tier. |
| GET | `/billing/v1/stripe/subscriptions/:tenantId` | Get subscription status GET /billing/v1/stripe/subscriptions/:tenantId |
| POST | `/billing/v1/stripe/subscriptions/:tenantId/cancel` | Cancel subscription POST /billing/v1/stripe/subscriptions/:tenantId/cancel |
| POST | `/billing/v1/stripe/verification-unlock` |  |
| GET | `/billing/v1/stripe/verification-unlock/events/:tenantId` |  |
| GET | `/billing/v1/stripe/verification-unlock/status/:tenantId` |  |
| POST | `/billing/v1/stripe/webhooks` | Note: This endpoint requires raw body for signature verification. Configure Fastify to pass raw body for this route. |
| POST | `/billing/v1/sync/verify-all` | This endpoint should be called by a scheduled job (e.g., every 15 minutes) to verify that all databases are in sync and automatically sync any that are out of sync. |
| POST | `/billing/v1/sync/verify/:tenantId` | POST /billing/v1/sync/verify/:tenantId Useful for manual verification or testing. |
| GET | `/billing/v1/tenant-usage/:tenantId` | Quotas/limits come from entitlement feature-flags. Dashboard and all consumers should call this endpoint exclusively. |
| GET | `/billing/v1/tenants/:tenantId/access` |  |
| POST | `/billing/v1/tenants/:tenantId/access/activate` | - paidThroughDays: days from now for paid_through (default: 365, max: 3650) - note: optional audit note |
| POST | `/billing/v1/tenants/:tenantId/access/block` |  |
| POST | `/billing/v1/tenants/:tenantId/access/unblock` |  |
| POST | `/billing/v1/tier-change/preview` | Returns which add-ons would become incompatible, which flags would be lost, and the billing delta. Use before confirming a downgrade. |
| GET | `/billing/v1/tier/:tenantId` | Use this endpoint instead of /billing/v1/stripe/subscriptions/:tenantId when you need the tier regardless of how it was provisioned. |
| POST | `/billing/v1/tiers/downgrade` |  |
| GET | `/billing/v1/usage/:tenantId` |  |
| GET | `/billing/v1/usage/:tenantId/daily` |  |
| POST | `/feature-flags/disable` | Disable a feature flag for a tenant (admin only) POST /feature-flags/disable |
| POST | `/feature-flags/enable` | Enable a feature flag for a tenant (admin only) POST /feature-flags/enable |
| POST | `/feature-flags/sync/:tenantId` | Sync feature flags from tenant features (migration helper) POST /feature-flags/sync/:tenantId |
| GET | `/feature-flags/tenant/:tenantId` | Get all enabled feature flags for a tenant GET /feature-flags/tenant/:tenantId |
| GET | `/feature-flags/tenant/:tenantId/:flagKey` | Get details of a specific feature flag for a tenant GET /feature-flags/tenant/:tenantId/:flagKey |
| GET | `/infrastructure/v1/activations` | Get all infrastructure activations for a tenant GET /infrastructure/v1/activations |
| POST | `/infrastructure/v1/activations/:activationId/deactivate` | Customer deactivates feature POST /infrastructure/v1/activations/:activationId/deactivate |
| GET | `/infrastructure/v1/activations/:featureType` | Get activation for a specific feature GET /infrastructure/v1/activations/:featureType |
| PUT | `/infrastructure/v1/activations/:featureType/configuration` | Save configuration (draft - no approval needed) PUT /infrastructure/v1/activations/:featureType/configuration |
| POST | `/infrastructure/v1/activations/:featureType/request` | Customer requests activation (triggers 2-tier approval) POST /infrastructure/v1/activations/:featureType/request |
| POST | `/infrastructure/v1/admin/activations/:activationId/activate` | Mark activation as active (called when provisioning completes) POST /infrastructure/v1/admin/activations/:activationId/activate |
| POST | `/infrastructure/v1/admin/activations/:activationId/approve` | Ops approves activation POST /infrastructure/v1/admin/activations/:activationId/approve |
| POST | `/infrastructure/v1/admin/activations/:activationId/provision` | Trigger provisioning for activation POST /infrastructure/v1/admin/activations/:activationId/provision |
| POST | `/infrastructure/v1/admin/activations/:activationId/reject` | Ops rejects activation POST /infrastructure/v1/admin/activations/:activationId/reject |
| GET | `/infrastructure/v1/admin/activations/:activationId/verify-audit` |  |
| POST | `/infrastructure/v1/admin/activations/:activationId/verify-payment` | Verify payment for activation POST /infrastructure/v1/admin/activations/:activationId/verify-payment |
| GET | `/infrastructure/v1/admin/pending-approvals` | Get all pending ops approvals GET /infrastructure/v1/admin/pending-approvals |
| GET | `/infrastructure/v1/status` | Get infrastructure status summary GET /infrastructure/v1/status |

## Crypto Inventory

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crypto/v1/agent-report-bundles` |  |
| POST | `/crypto/v1/agent-reports` | Uses a route-scoped preParsing hook to capture the raw body for HMAC signature verification without affecting other routes. |
| GET | `/crypto/v1/agent-reports/status` | GET /crypto/v1/agent-reports/status Check the number of pending reports for the tenant. |
| GET | `/crypto/v1/agents` | GET /crypto/v1/agents List all registered agents for the tenant. |
| POST | `/crypto/v1/agents` | securely delivered to the agent. Requires tenant_admin role. |
| DELETE | `/crypto/v1/agents/:id` | Delete an agent and all associated nonces. Requires tenant_admin role. |
| GET | `/crypto/v1/agents/:id` | GET /crypto/v1/agents/:id Get a specific agent by ID. |
| POST | `/crypto/v1/agents/:id/rotate` | Rotate the agent's HMAC secret. Returns the new one-time secret. Requires tenant_admin role. |
| PATCH | `/crypto/v1/agents/:id/status` | or "revoked" to permanently revoke access. Requires tenant_admin role. |
| GET | `/crypto/v1/agility/score` | actionable recommendations. Requires at least tenant_viewer role. |
| GET | `/crypto/v1/assets` |  |
| DELETE | `/crypto/v1/assets/:id` |  |
| GET | `/crypto/v1/assets/:id` |  |
| POST | `/crypto/v1/assets/:id/rotate` |  |
| POST | `/crypto/v1/assets/discover` |  |
| POST | `/crypto/v1/assets/import` |  |
| POST | `/crypto/v1/assets/rotate-bulk` |  |
| GET | `/crypto/v1/assets/stats` |  |
| GET | `/crypto/v1/cbom` | KMS, Vault, Edge Gateway, external, host agents, etc. Requires at least tenant_viewer role. |
| POST | `/crypto/v1/certificates/auto-renewal/bulk-enable` | Bulk enable auto-renewal |
| POST | `/crypto/v1/certificates/auto-renewal/check` | Trigger renewal check (scheduled job endpoint) |
| POST | `/crypto/v1/certificates/auto-renewal/disable` | Disable auto-renewal |
| POST | `/crypto/v1/certificates/auto-renewal/enable` | Database-backed auto-renewal management (if pool is available) Enable auto-renewal for a certificate |
| GET | `/crypto/v1/certificates/auto-renewal/status` | Get auto-renewal status |
| GET | `/crypto/v1/certificates/expiring` |  |
| GET | `/crypto/v1/certificates/expiry` |  |
| POST | `/crypto/v1/certificates/renew` |  |
| POST | `/crypto/v1/code-scan-reports` |  |
| GET | `/crypto/v1/code-scan-reports/status` |  |
| GET | `/crypto/v1/compliance/nist-report` | - periodStart (optional): ISO date string for report period start - periodEnd (optional): ISO date string for report period end |
| GET | `/crypto/v1/connected-sources` | Returns a summary of all configured discovery connectors for the tenant, including last sync status, asset counts per source, and coverage gaps. |
| GET | `/crypto/v1/connector-configs` | GET /crypto/v1/connector-configs List all connector configs for the tenant. Configs are redacted. |
| POST | `/crypto/v1/connector-configs` | Create or upsert a connector config. Feature-gated by source type. Requires tenant_operator role. Audit-logged. |
| DELETE | `/crypto/v1/connector-configs/:id` | Delete a connector config. Feature-gated by source type. Requires tenant_admin role. Audit-logged. |
| GET | `/crypto/v1/connector-configs/:id` | GET /crypto/v1/connector-configs/:id Get a specific connector config. Config is redacted. |
| PUT | `/crypto/v1/connector-configs/:id` | Update an existing connector config. Feature-gated by source type. Requires tenant_operator role. Audit-logged. |
| POST | `/crypto/v1/connector-configs/:id/validate` | to the connector config record. Feature-gated by source type. Requires tenant_operator role. Audit-logged. |
| POST | `/crypto/v1/connector-configs/test` | Use this to verify credentials before saving a connector config. Feature-gated by source type. Requires tenant_operator role. Audit-logged. |
| POST | `/crypto/v1/deprecation/acknowledge` |  |
| GET | `/crypto/v1/deprecation/affected-assets` |  |
| GET | `/crypto/v1/deprecation/notifications` |  |
| POST | `/crypto/v1/deprecation/notifications` |  |
| DELETE | `/crypto/v1/deprecation/notifications/:notificationId` |  |
| PATCH | `/crypto/v1/deprecation/notifications/:notificationId` |  |
| GET | `/crypto/v1/deprecation/policies` |  |
| POST | `/crypto/v1/deprecation/policies` |  |
| DELETE | `/crypto/v1/deprecation/policies/:policyId` |  |
| GET | `/crypto/v1/deprecation/policies/:policyId` |  |
| PATCH | `/crypto/v1/deprecation/policies/:policyId` |  |
| GET | `/crypto/v1/deprecation/summary` |  |
| GET | `/crypto/v1/discovery/jobs` |  |
| GET | `/crypto/v1/discovery/jobs/:id` |  |
| GET | `/crypto/v1/discovery/policies` |  |
| POST | `/crypto/v1/discovery/policies` |  |
| GET | `/crypto/v1/discovery/policies/:id` |  |
| PUT | `/crypto/v1/discovery/policies/:id` |  |
| POST | `/crypto/v1/discovery/policies/:id/activate` |  |
| GET | `/crypto/v1/discovery/runs` |  |
| GET | `/crypto/v1/evidence/pack` | tenant_viewer role. The pack is generated on-demand and includes a manifest hash for integrity verification. |
| GET | `/crypto/v1/hardware` |  |
| POST | `/crypto/v1/hardware` |  |
| DELETE | `/crypto/v1/hardware/:hardwareId` |  |
| GET | `/crypto/v1/hardware/:hardwareId` |  |
| PATCH | `/crypto/v1/hardware/:hardwareId` |  |
| GET | `/crypto/v1/hardware/:hardwareId/health` |  |
| POST | `/crypto/v1/hardware/:hardwareId/health` |  |
| GET | `/crypto/v1/hardware/summary` |  |
| DELETE | `/crypto/v1/internal/tenant/:tenantId` | route-coverage check can statically detect this registration. The const is still used for the JWT-hook exemption prefix in server.ts. |
| GET | `/crypto/v1/managed-migration/credentials` |  |
| POST | `/crypto/v1/managed-migration/credentials` |  |
| DELETE | `/crypto/v1/managed-migration/credentials/:id` |  |
| POST | `/crypto/v1/managed-migration/credentials/:id/validate` |  |
| GET | `/crypto/v1/migration-plan` | crypto assets. Returns deprecated algorithms, phased timeline, and effort breakdown. Requires authenticated tenant context (x-qnsp-tenant header or JWT tenantId). |
| POST | `/crypto/v1/migration/asset-actions/:id/confirm-cutover` |  |
| POST | `/crypto/v1/migration/asset-actions/:id/reconcile` |  |
| GET | `/crypto/v1/migration/cutover-progress` |  |
| POST | `/crypto/v1/migration/dry-run` | passed to /execute as the confirmation gate. Gated by migration-execution feature flag. Requires tenant_admin role. |
| POST | `/crypto/v1/migration/execute` | exactly what they previewed in the dry-run. Gated by migration-execution feature flag. Requires tenant_admin role. |
| GET | `/crypto/v1/migration/executions` | List migration executions for the tenant, most recent first. Not gated - read-only access to execution history. |
| GET | `/crypto/v1/migration/executions/:id` | Get a single migration execution by ID. Not gated - read-only. |
| POST | `/crypto/v1/migration/executions/:id/approve` |  |
| GET | `/crypto/v1/migration/executions/:id/asset-actions` |  |
| POST | `/crypto/v1/migration/executions/:id/cancel` | Cancel a pending or in-progress migration execution. Gated by migration-execution feature flag. Requires tenant_admin role. |
| GET | `/crypto/v1/migration/executions/:id/control-events` |  |
| POST | `/crypto/v1/migration/executions/:id/pause` |  |
| GET | `/crypto/v1/migration/executions/:id/reconciliation-events` |  |
| POST | `/crypto/v1/migration/executions/:id/resume` |  |
| GET | `/crypto/v1/migration/executions/:id/waves` |  |
| GET | `/crypto/v1/observations/tls/aggregates` |  |
| POST | `/crypto/v1/observations/tls/aggregates` |  |
| GET | `/crypto/v1/policies` |  |
| POST | `/crypto/v1/policies` |  |
| DELETE | `/crypto/v1/policies/:id` |  |
| GET | `/crypto/v1/policies/:id` |  |
| PUT | `/crypto/v1/policies/:id` |  |
| POST | `/crypto/v1/policies/:id/disable` |  |
| POST | `/crypto/v1/policies/:id/enable` |  |
| POST | `/crypto/v1/policies/evaluate` | Policy evaluation |
| DELETE | `/crypto/v1/posture/reset` | Connector configs (external sources) ARE deleted. Requires tenant_admin role. Audit-logged. |
| GET | `/crypto/v1/pqc-readiness/benchmark` |  |
| POST | `/crypto/v1/pqc-readiness/compare` |  |
| GET | `/crypto/v1/pqc-readiness/recommendations` |  |
| GET | `/crypto/v1/pqc-readiness/score` |  |
| GET | `/crypto/v1/pqc-readiness/score/category/:category` |  |
| GET | `/crypto/v1/pqc-readiness/score/history` |  |
| GET | `/crypto/v1/readiness` |  |
| GET | `/crypto/v1/readiness/timeline` |  |
| GET | `/crypto/v1/rotation-jobs` |  |
| GET | `/crypto/v1/rotation-jobs/:id` |  |
| GET | `/crypto/v1/scan-schedules` |  |
| POST | `/crypto/v1/scan-schedules` |  |
| DELETE | `/crypto/v1/scan-schedules/:id` |  |
| PUT | `/crypto/v1/scan-schedules/:id` |  |
| GET | `/crypto/v1/violations` | Violations |
| POST | `/crypto/v1/violations/:id/acknowledge` |  |
| POST | `/crypto/v1/violations/:id/exception` |  |

## Edge Gateway

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/aws/entitlement/:customerIdentifier` | GET /api/marketplace/aws/entitlement/:customerIdentifier Proxies AWS Marketplace entitlement verification to the internal billing service. |
| POST | `/api/marketplace/aws/metering` | Proxies usage metering requests to the internal billing service. Used for reporting consumption-based usage to AWS Marketplace. |
| POST | `/api/marketplace/aws/resolve-customer` | POST /api/marketplace/aws/resolve-customer Proxies customer resolution requests from the fulfillment page to billing service. |
| GET | `/api/v1/tenants/:tenantId/infrastructure/activations` | Get all infrastructure activations for a tenant GET /api/v1/tenants/:tenantId/infrastructure/activations |
| GET | `/api/v1/tenants/:tenantId/infrastructure/status` | Get infrastructure status for a tenant GET /api/v1/tenants/:tenantId/infrastructure/status |
| POST | `/edge/auth/forgot-account` |  |
| POST | `/edge/auth/forgot-password` |  |
| POST | `/edge/auth/login` |  |
| POST | `/edge/auth/login-identity` | portal's /api/auth/login got 404 from the gateway for every login that omits a workspace ID - i.e. the primary login path was dead. (2026-06-03) |
| POST | `/edge/auth/login/select-tenant` | posts the selectionToken + chosen tenantId here; auth-service exchanges it for a tenant-scoped session. Was likewise unrouted (404) at the gateway. (2026-06-03) |
| POST | `/edge/auth/logout` |  |
| GET | `/edge/auth/me/tenants` | at the edge -> 404 route-not-found -> the cloud BFF (/api/user/tenants) saw the user as having no workspaces. Authenticated (user JWT validated by auth-service). |
| GET | `/edge/auth/oauth/identity` | OAuth-linked identities. The Authorization header carries the shared OAuth session secret (Bearer token), NOT a user JWT. |
| POST | `/edge/auth/oauth/identity` |  |
| POST | `/edge/auth/oauth/session` |  |
| GET | `/edge/auth/oauth/user-by-email` | route the edge returned 404 (route-not-found) -> the BFF treated it as "no user" -> every existing-user OAuth login got "sign up first". |
| POST | `/edge/auth/revoke-all-sessions` | revokeAll path) silently failed to revoke other sessions - a security action that appeared to succeed. Authenticated (user JWT validated by auth-service). |
| POST | `/edge/auth/switch-tenant` | policy-bundle-hash) and Tier B headers (entitlement-decision-id, audit-intent-id) are forwarded so auth-service can include them in its structured audit receipt. |
| POST | `/edge/auth/token/refresh` | the 15-min access token expired mid-session and users were silently logged out (~10-12 min) with no warning. (2026-05-31) |
| POST | `/edge/auth/webauthn/authenticate/complete` |  |
| POST | `/edge/auth/webauthn/authenticate/start` | WebAuthn authentication routes |
| DELETE | `/edge/auth/webauthn/credentials/:credentialId` |  |
| GET | `/edge/auth/webauthn/credentials/:userId` |  |
| POST | `/edge/auth/webauthn/register/complete` |  |
| POST | `/edge/auth/webauthn/register/start` | WebAuthn registration routes |
| GET | `/edge/v1/ai-security/policy` |  |
| PUT | `/edge/v1/ai-security/policy` |  |
| GET | `/edge/v1/ai-security/policy/tenants/:tenantId` |  |
| PUT | `/edge/v1/ai-security/policy/tenants/:tenantId` |  |
| GET | `/edge/v1/entitlements/health` |  |
| GET | `/edge/v1/integrations/providers` | GET /edge/v1/integrations/providers List all available integration providers with their configuration requirements |
| GET | `/edge/v1/integrations/providers/:providerId` | GET /edge/v1/integrations/providers/:providerId Get details for a specific provider including required fields |
| POST | `/edge/v1/integrations/test` | POST /edge/v1/integrations/test Test an integration connection without saving it |
| POST | `/edge/v1/integrations/validate` | POST /edge/v1/integrations/validate Validate integration configuration without testing connection |
| GET | `/edge/v1/observability/upstream` |  |
| PUT | `/edge/v1/observability/upstream` |  |
| POST | `/edge/v1/pqc-tls/rotate` |  |
| POST | `/edge/v1/requests` |  |
| GET | `/edge/v1/routes` |  |
| POST | `/edge/v1/routes` |  |
| PUT | `/edge/v1/routes/:routeId/ai-security/policy` |  |
| GET | `/evidence/ai-intelligence/dashboard-signing-key` |  |
| GET | `/evidence/audit-integrity` |  |
| GET | `/evidence/crypto-posture` |  |
| GET | `/evidence/key-policy` |  |
| GET | `/evidence/tls-mode` |  |
| GET | `/evidence/transport-security` |  |
| GET | `/oauth/vercel/callback` |  |
| GET | `/oauth/vercel/sso` |  |
| POST | `/platform/v1/conformance/sign-evidence-pack` | Response: signature block compatible with attaching as a W3C DataIntegrityProof. |
| GET | `/platform/v1/crypto/algorithms` | GET /platform/v1/crypto/algorithms List all known algorithms with their metadata and lifecycle status. |
| GET | `/platform/v1/crypto/algorithms/:algorithm` | GET /platform/v1/crypto/algorithms/:algorithm Get metadata for a specific algorithm. |
| GET | `/platform/v1/crypto/attestation` | GET /platform/v1/crypto/attestation Generate a signed compliance attestation snapshot. |
| GET | `/platform/v1/crypto/attestation/history` | GET /platform/v1/crypto/attestation/history Get attestation generation history. |
| GET | `/platform/v1/crypto/cbom` | GET /platform/v1/crypto/cbom Generate and return the Cryptographic Bill of Materials. |
| GET | `/platform/v1/crypto/cbom/diff` | GET /platform/v1/crypto/cbom/diff Compare two CBOM snapshots. |
| GET | `/platform/v1/crypto/cbom/download` | GET /platform/v1/crypto/cbom/download Download CBOM as a file. |
| GET | `/platform/v1/crypto/cbom/history` | GET /platform/v1/crypto/cbom/history Get CBOM generation history. |
| GET | `/platform/v1/crypto/compliance` | GET /platform/v1/crypto/compliance Get compliance status summary. |
| GET | `/platform/v1/crypto/migration-plan` | GET /platform/v1/crypto/migration-plan Generate a migration plan for deprecated algorithms. |
| GET | `/platform/v1/crypto/policy` | GET /platform/v1/crypto/policy Returns the current crypto policy configuration. |
| GET | `/platform/v1/crypto/policy/check` | GET /platform/v1/crypto/policy/check Check if an algorithm is allowed by policy. |
| GET | `/platform/v1/crypto/policy/enforcement-log` | GET /platform/v1/crypto/policy/enforcement-log Get recent policy enforcement decisions for audit. |
| GET | `/platform/v1/crypto/policy/presets` | GET /platform/v1/crypto/policy/presets List available policy presets. |
| GET | `/platform/v1/crypto/posture` |  |
| GET | `/platform/v1/crypto/posture/public` |  |
| GET | `/platform/v1/crypto/tls/connection` |  |
| GET | `/platform/v1/crypto/tls/evidence` |  |
| GET | `/platform/v1/crypto/tls/evidence/public` |  |
| GET | `/proxy/auth/health` |  |
| GET | `/proxy/health` | health routing. A structured `warn` log captures which backends were degraded so the alerting signal is preserved. |
| POST | `/public/join-requests` |  |
| GET | `/public/tenant-by-domain/:domain` |  |
| GET | `/public/tenant-by-slug/:slug` | This is used by the login flow to resolve tenant slugs to UUIDs |
| POST | `/v1/ws/publish` | HTTP endpoint for internal services to publish WebSocket messages |
| GET | `/v1/ws/stats` | WebSocket stats endpoint (admin only) |
| POST | `/webhooks/aws-marketplace` | Proxies AWS Marketplace subscription events to the internal billing service. No authentication required - AWS Marketplace uses signature verification. |
| POST | `/webhooks/azure-marketplace` | The raw body is forwarded verbatim so any downstream payload integrity checks remain valid. |
| POST | `/webhooks/gcp-marketplace` | that depends on byte-for-byte content (signature, checksum, base64 of Pub/Sub message.data) continues to work. |
| POST | `/webhooks/github-marketplace` | Proxies GitHub Marketplace marketplace_purchase events to billing-service. No authentication required - GitHub signs deliveries with X-Hub-Signature-256. |
| POST | `/webhooks/stripe` | Proxies Stripe webhook events to the internal billing service. No authentication required - Stripe uses signature verification. |
| POST | `/webhooks/vercel-marketplace` |  |

## KMS

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` |  |
| GET | `/kms/v1/analytics/alert-rules` |  |
| POST | `/kms/v1/analytics/alert-rules` |  |
| DELETE | `/kms/v1/analytics/alert-rules/:ruleId` |  |
| PATCH | `/kms/v1/analytics/alert-rules/:ruleId` |  |
| POST | `/kms/v1/analytics/alerts/:alertId/acknowledge` |  |
| POST | `/kms/v1/analytics/applications/record` |  |
| GET | `/kms/v1/analytics/keys/:keyId/summary` |  |
| GET | `/kms/v1/archived-keys` |  |
| DELETE | `/kms/v1/archived-keys/expired` |  |
| GET | `/kms/v1/byohsm/connections` |  |
| POST | `/kms/v1/byohsm/connections` |  |
| DELETE | `/kms/v1/byohsm/connections/:connectionId` |  |
| GET | `/kms/v1/byohsm/connections/:connectionId` |  |
| PATCH | `/kms/v1/byohsm/connections/:connectionId` |  |
| GET | `/kms/v1/byohsm/connections/:connectionId/operations` |  |
| POST | `/kms/v1/byohsm/connections/:connectionId/validate` |  |
| GET | `/kms/v1/byohsm/keys` |  |
| POST | `/kms/v1/byohsm/keys` |  |
| POST | `/kms/v1/byohsm/pqc/seal` | private key under a non-extractable HSM RSA-OAEP custody key (requires a customer-provisioned BYOHSM connection with an RSA encrypt/decrypt key). |
| POST | `/kms/v1/byohsm/pqc/sign` | (RSA-OAEP-unwraps the content key) and sign, without the PQC key ever persisting in software. |
| POST | `/kms/v1/byohsm/sign` |  |
| POST | `/kms/v1/byohsm/unwrap` |  |
| POST | `/kms/v1/byohsm/verify` |  |
| POST | `/kms/v1/byohsm/wrap` |  |
| GET | `/kms/v1/byok/:keyId` | Get BYOK key |
| POST | `/kms/v1/byok/import` | Import BYOK |
| GET | `/kms/v1/crypto-agility/migration-plans` |  |
| POST | `/kms/v1/crypto-agility/migration-plans` |  |
| GET | `/kms/v1/crypto-agility/migration-plans/:planId` |  |
| PATCH | `/kms/v1/crypto-agility/migration-plans/:planId` |  |
| POST | `/kms/v1/escrow/keys` |  |
| GET | `/kms/v1/escrow/policies` |  |
| POST | `/kms/v1/escrow/policies` |  |
| GET | `/kms/v1/escrow/policies/:policyId` |  |
| PATCH | `/kms/v1/escrow/policies/:policyId` |  |
| GET | `/kms/v1/escrow/recovery/:requestId` |  |
| POST | `/kms/v1/escrow/recovery/approve` |  |
| POST | `/kms/v1/escrow/recovery/execute` |  |
| POST | `/kms/v1/escrow/recovery/initiate` |  |
| POST | `/kms/v1/escrow/recovery/submit-share` |  |
| GET | `/kms/v1/health` |  |
| DELETE | `/kms/v1/internal/tenant/:tenantId` |  |
| GET | `/kms/v1/keys` | List keys |
| POST | `/kms/v1/keys` | Create key |
| DELETE | `/kms/v1/keys/:keyId` | for those, a non-delegated caller gets 202 + a dual-control approval request; a second distinct principal must approve (below) before the revoke executes. |
| GET | `/kms/v1/keys/:keyId` | Get key by ID |
| GET | `/kms/v1/keys/:keyId/approvals/:approvalId` | the approve path dispatches the side effect by the request's resourceType so future gated KMS operations (e.g. escrow release) can reuse it. |
| POST | `/kms/v1/keys/:keyId/approvals/:approvalId/approve` | Checker approves. On quorum the gated operation executes exactly once, dispatched by resourceType (maker != checker enforced by the gate). |
| POST | `/kms/v1/keys/:keyId/approvals/:approvalId/reject` |  |
| DELETE | `/kms/v1/keys/:keyId/policy` |  |
| GET | `/kms/v1/keys/:keyId/policy` |  |
| PUT | `/kms/v1/keys/:keyId/policy` |  |
| GET | `/kms/v1/keys/:keyId/public-key` | and is never returned. Enables publishing/verifying signatures made by KMS-held signing keys (e.g. the PQ coverage register online-downgrade signer). |
| POST | `/kms/v1/keys/:keyId/rotate` | Rotate key |
| POST | `/kms/v1/keys/:keyId/sign` | Sign data with a PQC signature key (ML-DSA / FN-DSA / SLH-DSA) Billable operation: kms.code.sign - gated by pqc-code-signing addon |
| POST | `/kms/v1/keys/:keyId/unwrap` | Unwrap key |
| POST | `/kms/v1/keys/:keyId/upgrade` | Upgrade key algorithm to tenant's PQC default |
| POST | `/kms/v1/keys/:keyId/verify` | Verify a PQC signature |
| POST | `/kms/v1/keys/:keyId/wrap` | Wrap key |
| GET | `/kms/v1/keys/stats` | Key stats (includes keys count and ops this month) |
| GET | `/kms/v1/recovery-requests` |  |
| POST | `/kms/v1/recovery-requests/:requestId/execute` |  |
| POST | `/kms/v1/recovery-requests/:requestId/reject` |  |
| GET | `/kms/v1/rotation-schedules` |  |
| DELETE | `/kms/v1/rotation-schedules/:scheduleId` |  |
| GET | `/kms/v1/rotation-schedules/:scheduleId` |  |
| GET | `/kms/v1/rotation-schedules/upcoming` |  |

## Observability

| Method | Path | Description |
|--------|------|-------------|
| GET | `/observability/v1/anomaly-detection/anomalies/:anomalyId` | Get specific anomaly |
| POST | `/observability/v1/anomaly-detection/anomalies/:anomalyId/acknowledge` | Acknowledge anomaly |
| POST | `/observability/v1/anomaly-detection/anomalies/:anomalyId/resolve` | Resolve anomaly |
| POST | `/observability/v1/anomaly-detection/detect` | Detect anomalies (ad-hoc detection) |
| GET | `/observability/v1/anomaly-detection/rules` | List anomaly detection rules |
| POST | `/observability/v1/anomaly-detection/rules` | Create anomaly detection rule |
| DELETE | `/observability/v1/anomaly-detection/rules/:ruleId` | Delete rule |
| GET | `/observability/v1/anomaly-detection/rules/:ruleId` | Get specific rule |
| PATCH | `/observability/v1/anomaly-detection/rules/:ruleId` | Update rule |
| GET | `/observability/v1/anomaly-detection/rules/:ruleId/baselines` | Get baselines for a rule |
| POST | `/observability/v1/anomaly-detection/rules/:ruleId/baselines` | Submit baseline for a rule |
| GET | `/observability/v1/anomaly-detection/summary` | Get anomaly summary |
| GET | `/observability/v1/costs/allocations` | Query cost allocations with aggregation |
| POST | `/observability/v1/costs/allocations` | Record cost allocation |
| POST | `/observability/v1/costs/allocations/batch` | Batch record cost allocations |
| GET | `/observability/v1/costs/budgets` | List cost budgets |
| POST | `/observability/v1/costs/budgets` | Create cost budget |
| DELETE | `/observability/v1/costs/budgets/:budgetId` | Delete budget |
| GET | `/observability/v1/costs/budgets/:budgetId` | Get budget with current spend |
| PATCH | `/observability/v1/costs/budgets/:budgetId` | Update budget |
| POST | `/observability/v1/costs/reports` | Generate cost report |
| GET | `/observability/v1/costs/summary` | Get cost summary (quick overview) |
| POST | `/observability/v1/dashboards` | Create dashboard |
| DELETE | `/observability/v1/dashboards/:dashboardId` | Delete dashboard |
| GET | `/observability/v1/dashboards/:dashboardId` | Get dashboard with panels |
| PATCH | `/observability/v1/dashboards/:dashboardId` | Update dashboard metadata |
| POST | `/observability/v1/dashboards/:dashboardId/panels` | Add panel to dashboard |
| DELETE | `/observability/v1/dashboards/:dashboardId/panels/:panelId` | Delete panel |
| PATCH | `/observability/v1/dashboards/:dashboardId/panels/:panelId` | Update panel |
| GET | `/observability/v1/dashboards/:dashboardId/shares` | List shares |
| POST | `/observability/v1/dashboards/:dashboardId/shares` | Share dashboard |
| DELETE | `/observability/v1/dashboards/:dashboardId/shares/:shareId` | Remove share |
| GET | `/observability/v1/dashboards/:dashboardId/snapshots` | List snapshots |
| POST | `/observability/v1/dashboards/:dashboardId/snapshots` | Create snapshot |
| GET | `/observability/v1/dashboards/:dashboardId/snapshots/:snapshotId` | Get snapshot |
| POST | `/observability/v1/dashboards/:dashboardId/star` | Star/unstar dashboard |
| POST | `/observability/v1/dashboards/clone` | Clone dashboard from template |
| GET | `/observability/v1/slo-definitions` | List SLO definitions |
| POST | `/observability/v1/slo-definitions` | Database-backed SLO management endpoints (if pool is available) Create SLO definition |
| DELETE | `/observability/v1/slo-definitions/:sloId` | Delete SLO definition |
| GET | `/observability/v1/slo-definitions/:sloId` | Get specific SLO definition |
| PATCH | `/observability/v1/slo-definitions/:sloId` | Update SLO definition |
| GET | `/observability/v1/slo-definitions/:sloId/measurements` | Get SLO measurements |
| GET | `/observability/v1/slos` | Get all SLOs or filter by service |
| POST | `/observability/v1/slos/calculate` | Calculate SLO compliance from metric data |
| GET | `/observability/v1/slos/summary` | Get SLO compliance summary |

## Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/search/v1/analytics/feedback` |  |
| GET | `/search/v1/analytics/metrics` |  |
| GET | `/search/v1/analytics/quality` |  |
| GET | `/search/v1/analytics/queries` |  |
| POST | `/search/v1/analytics/queries` |  |
| GET | `/search/v1/analytics/queries/:queryId` |  |
| GET | `/search/v1/analytics/queries/:queryId/feedback` |  |
| GET | `/search/v1/analytics/summary` |  |
| GET | `/search/v1/documents` |  |
| POST | `/search/v1/documents/index` | both redundant and wrong for api-key callers - their tenant is in x-qnsp-api-key-* headers, not a JWT - sweep 2026-06-13 F40.) |
| POST | `/search/v1/health/alerts` |  |
| POST | `/search/v1/health/alerts/:alertId/acknowledge` |  |
| POST | `/search/v1/health/alerts/:alertId/resolve` |  |
| GET | `/search/v1/health/current` |  |
| GET | `/search/v1/health/indices/:indexName/trends` |  |
| POST | `/search/v1/health/maintenance` |  |
| DELETE | `/search/v1/health/maintenance/:windowId` |  |
| GET | `/search/v1/health/snapshots` |  |
| POST | `/search/v1/health/snapshots` |  |
| GET | `/search/v1/health/summary` |  |
| GET | `/search/v1/indexes` |  |
| POST | `/search/v1/indexes` |  |
| DELETE | `/search/v1/indexes/:indexName` |  |
| POST | `/search/v1/indexes/:indexName/query` |  |
| POST | `/search/v1/indexes/:indexName/vectors` |  |
| DELETE | `/search/v1/internal/tenant/:tenantId` |  |
| GET | `/search/v1/isolation/audit` |  |
| POST | `/search/v1/isolation/audit` |  |
| POST | `/search/v1/isolation/policies` |  |
| DELETE | `/search/v1/isolation/policies/:policyId` |  |
| GET | `/search/v1/isolation/policies/:policyId` |  |
| PATCH | `/search/v1/isolation/policies/:policyId` |  |
| GET | `/search/v1/isolation/summary` |  |
| GET | `/search/v1/isolation/verifications` |  |
| POST | `/search/v1/isolation/verify` |  |
| POST | `/search/v1/isolation/violations` |  |
| POST | `/search/v1/isolation/violations/:violationId/investigate` |  |
| POST | `/search/v1/isolation/violations/:violationId/resolve` |  |
| GET | `/search/v1/optimization/analyze` | Analyze index statistics for a tenant. GET /search/v1/optimization/analyze?tenantId=... |
| POST | `/search/v1/optimization/rebuild` | Rebuild search indices for better performance. POST /search/v1/optimization/rebuild |
| POST | `/search/v1/optimization/vacuum` | Vacuum and analyze the index. POST /search/v1/optimization/vacuum |
| GET | `/search/v1/synonyms` |  |
| POST | `/search/v1/synonyms` |  |
| DELETE | `/search/v1/synonyms/:groupId` |  |
| GET | `/search/v1/synonyms/:groupId` |  |
| PATCH | `/search/v1/synonyms/:groupId` |  |
| DELETE | `/search/v1/synonyms/:groupId/terms` |  |
| POST | `/search/v1/synonyms/:groupId/terms` |  |
| POST | `/search/v1/synonyms/expand` |  |
| GET | `/search/v1/synonyms/export` |  |
| POST | `/search/v1/synonyms/import` |  |
| GET | `/search/v1/synonyms/statistics` |  |

## Security Monitoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/security/v1/alerts` | - Avoid verbs like /resolve, /ack, /mute in path names - Remain read-only for observability purposes |
| POST | `/security/v1/attack-surface/analyze` |  |
| POST | `/security/v1/attack-surface/assets` |  |
| DELETE | `/security/v1/attack-surface/assets/:assetId` |  |
| GET | `/security/v1/attack-surface/assets/:assetId` |  |
| PATCH | `/security/v1/attack-surface/assets/:assetId` |  |
| GET | `/security/v1/attack-surface/connections` |  |
| POST | `/security/v1/attack-surface/connections` |  |
| DELETE | `/security/v1/attack-surface/connections/:connectionId` |  |
| POST | `/security/v1/attack-surface/simulate` |  |
| GET | `/security/v1/attack-surface/summary` |  |
| POST | `/security/v1/breaches` | Detect a breach POST /security/v1/breaches |
| GET | `/security/v1/breaches/:id/notification-requirements` | Check notification requirements GET /security/v1/breaches/:id/notification-requirements |
| POST | `/security/v1/breaches/:id/notify` | Create breach notification POST /security/v1/breaches/:id/notify |
| POST | `/security/v1/compliance/assess` |  |
| GET | `/security/v1/compliance/assessments` |  |
| POST | `/security/v1/compliance/controls` |  |
| DELETE | `/security/v1/compliance/controls/:controlUuid` |  |
| GET | `/security/v1/compliance/controls/:controlUuid` |  |
| PATCH | `/security/v1/compliance/controls/:controlUuid` |  |
| GET | `/security/v1/compliance/controls/:controlUuid/evidence` |  |
| POST | `/security/v1/compliance/controls/:controlUuid/evidence` |  |
| DELETE | `/security/v1/compliance/controls/:controlUuid/evidence/:evidenceId` |  |
| GET | `/security/v1/compliance/mappings` |  |
| POST | `/security/v1/compliance/mappings` |  |
| GET | `/security/v1/compliance/summary` |  |
| GET | `/security/v1/crypto-monitoring/alerts` | GET /security/v1/crypto-monitoring/alerts - the tenant's recent detections, mapped to the cloud portal's CryptoAlert shape. Real rows only. |
| GET | `/security/v1/crypto-monitoring/stats` | GET /security/v1/crypto-monitoring/stats - real aggregations over security_alerts. |
| POST | `/security/v1/detections` |  |
| POST | `/security/v1/key-compromise` | POST /security/v1/key-compromise Report a key compromise incident and trigger automated remediation. |
| GET | `/security/v1/key-compromise/:incidentId` | GET /security/v1/key-compromise/:incidentId Get the status of a key compromise incident. |
| GET | `/security/v1/playbooks` |  |
| POST | `/security/v1/playbooks` |  |
| DELETE | `/security/v1/playbooks/:playbookId` |  |
| GET | `/security/v1/playbooks/:playbookId` |  |
| PATCH | `/security/v1/playbooks/:playbookId` |  |
| POST | `/security/v1/playbooks/execute` |  |
| GET | `/security/v1/playbooks/executions` |  |
| GET | `/security/v1/playbooks/executions/:executionId` | Execution detail incl. per-action dispositions + results (the portal shows WHY each containment action completed/failed/awaits approval; also the audit record of what ran). |
| GET | `/security/v1/playbooks/executions/:executionId/actions` |  |
| POST | `/security/v1/playbooks/executions/:executionId/approve` |  |
| GET | `/security/v1/remediation/executions` | Get remediation execution history for an alert. GET /security/v1/remediation/executions?alertId=... |
| GET | `/security/v1/remediation/rules` | List remediation rules for a tenant. GET /security/v1/remediation/rules?tenantId=... |
| POST | `/security/v1/remediation/rules` | Create a remediation rule. POST /security/v1/remediation/rules |
| GET | `/security/v1/siem/destinations` |  |
| POST | `/security/v1/siem/destinations` |  |
| DELETE | `/security/v1/siem/destinations/:destinationId` |  |
| PATCH | `/security/v1/siem/destinations/:destinationId` |  |
| POST | `/security/v1/siem/dispatch` |  |
| POST | `/security/v1/siem/format` |  |
| GET | `/security/v1/siem/stats` |  |
| POST | `/security/v1/threat-intel/bulk-check` | Bulk check indicators |
| POST | `/security/v1/threat-intel/check` | Check if an indicator is malicious |
| GET | `/security/v1/threat-intel/feeds` | List threat feeds |
| POST | `/security/v1/threat-intel/feeds` | Create a threat feed configuration |
| POST | `/security/v1/threat-intel/feeds/:feedId/refresh` | Trigger feed refresh |
| POST | `/security/v1/threat-intel/indicators` | Report a new indicator |
| GET | `/security/v1/threat-intel/stats` | Get threat intelligence statistics |

## Storage

| Method | Path | Description |
|--------|------|-------------|
| DELETE | `/storage/internal/byok/keys/:tenantId` |  |
| GET | `/storage/internal/byok/keys/:tenantId` |  |
| PUT | `/storage/internal/byok/keys/:tenantId` |  |
| POST | `/storage/internal/rotations` |  |
| GET | `/storage/v1/admin/health` | Health check endpoint for admin operations (platform-admin only; the unauthenticated liveness probe is the top-level /storage/health, registered separately). |
| POST | `/storage/v1/admin/migrate-pqc` | Migration endpoint to update existing documents with PQC metadata. |
| GET | `/storage/v1/admin/test` | Diagnostic endpoint to verify admin routes are mounted (platform-admin only). |
| GET | `/storage/v1/buckets` |  |
| GET | `/storage/v1/buckets/:bucket/objects` |  |
| DELETE | `/storage/v1/buckets/:bucket/objects/:key` |  |
| GET | `/storage/v1/buckets/:bucket/objects/:key` |  |
| PUT | `/storage/v1/buckets/:bucket/objects/:key` |  |
| POST | `/storage/v1/classification/detect-pii` | Detect PII in content (preview without storing) |
| POST | `/storage/v1/classification/objects` | Classify an object |
| GET | `/storage/v1/classification/objects/:objectId` | Get object classification |
| GET | `/storage/v1/classification/policies` | List classification policies |
| POST | `/storage/v1/classification/policies` | Create classification policy |
| DELETE | `/storage/v1/classification/policies/:policyId` | Delete classification policy |
| GET | `/storage/v1/classification/policies/:policyId` | Get classification policy |
| PATCH | `/storage/v1/classification/policies/:policyId` | Update classification policy |
| GET | `/storage/v1/classification/scans` | List scans |
| POST | `/storage/v1/classification/scans` | Start classification scan |
| GET | `/storage/v1/classification/scans/:scanId` | Get scan status |
| GET | `/storage/v1/classification/stats` | Get classification statistics |
| GET | `/storage/v1/compliance/residency/:documentId` | Get all residency proofs for a document. GET /storage/v1/compliance/residency/:documentId |
| POST | `/storage/v1/compliance/residency/:documentId/verify` | Verify a residency proof. POST /storage/v1/compliance/residency/:documentId/verify |
| GET | `/storage/v1/compliance/residency/region/:region` | Get residency proofs for a specific region. GET /storage/v1/compliance/residency/region/:region |
| POST | `/storage/v1/compliance/residency/verify` | Batch verify multiple residency proofs. POST /storage/v1/compliance/residency/verify |
| GET | `/storage/v1/documents` |  |
| POST | `/storage/v1/documents` |  |
| DELETE | `/storage/v1/documents/:documentId` |  |
| GET | `/storage/v1/documents/:documentId` |  |
| PATCH | `/storage/v1/documents/:documentId` | PATCH - Move document to a different folder |
| POST | `/storage/v1/documents/:documentId/collaboration/annotations` | Create an annotation on a document. POST /storage/v1/documents/:documentId/collaboration/annotations |
| POST | `/storage/v1/documents/:documentId/collaboration/comments` | Create a comment on a document. POST /storage/v1/documents/:documentId/collaboration/comments |
| POST | `/storage/v1/documents/:documentId/collaboration/conflicts/resolve` | Resolve a conflict between operations. POST /storage/v1/documents/:documentId/collaboration/conflicts/resolve |
| POST | `/storage/v1/documents/:documentId/collaboration/operations` | Apply an OT operation to a document. POST /storage/v1/documents/:documentId/collaboration/operations |
| POST | `/storage/v1/documents/:documentId/legal-holds` |  |
| DELETE | `/storage/v1/documents/:documentId/legal-holds/:holdId` |  |
| POST | `/storage/v1/documents/:documentId/lifecycle/transitions` |  |
| GET | `/storage/v1/documents/:documentId/policies` |  |
| PATCH | `/storage/v1/documents/:documentId/policies` |  |
| GET | `/storage/v1/documents/:documentId/versions/:version/annotations` | List annotations for a document version. GET /storage/v1/documents/:documentId/versions/:version/annotations |
| GET | `/storage/v1/documents/:documentId/versions/:version/comments` | List comments for a document version. GET /storage/v1/documents/:documentId/versions/:version/comments |
| GET | `/storage/v1/documents/:documentId/versions/:version/content` |  |
| GET | `/storage/v1/documents/:documentId/versions/:version/download` |  |
| GET | `/storage/v1/folders` |  |
| POST | `/storage/v1/folders` |  |
| DELETE | `/storage/v1/folders/:folderId` |  |
| GET | `/storage/v1/folders/:folderId` |  |
| PATCH | `/storage/v1/folders/:folderId` |  |
| POST | `/storage/v1/gdpr/export` | Create a GDPR export request POST /storage/v1/gdpr/export |
| GET | `/storage/v1/gdpr/export/:id` | Get export status GET /storage/v1/gdpr/export/:id |
| GET | `/storage/v1/gdpr/export/:id/download` | Download export GET /storage/v1/gdpr/export/:id/download |
| POST | `/storage/v1/gdpr/export/:id/process` | Process export (generate export data) POST /storage/v1/gdpr/export/:id/process |
| DELETE | `/storage/v1/internal/tenant/:tenantId` |  |
| GET | `/storage/v1/replication/configurations` | List replication configurations |
| POST | `/storage/v1/replication/configurations` | Create replication configuration |
| DELETE | `/storage/v1/replication/configurations/:configId` | Delete replication configuration |
| GET | `/storage/v1/replication/configurations/:configId` | Get replication configuration |
| PATCH | `/storage/v1/replication/configurations/:configId` | Update replication configuration |
| GET | `/storage/v1/replication/health` | Health check for replication across regions |
| POST | `/storage/v1/replication/objects` | Initiate object replication |
| GET | `/storage/v1/replication/objects/:objectId/status` | Get object replication status |
| GET | `/storage/v1/replication/stats` | Get replication statistics |
| POST | `/storage/v1/replication/status/:replicationId/retry` | Retry failed replication |
| POST | `/storage/v1/replication/verify` | Verify replication |
| GET | `/storage/v1/retention/deletions` | List scheduled deletions |
| POST | `/storage/v1/retention/deletions` | Schedule deletion |
| POST | `/storage/v1/retention/deletions/:deletionId/approve` | Approve/deny deletion |
| POST | `/storage/v1/retention/deletions/:deletionId/cancel` | Cancel scheduled deletion |
| POST | `/storage/v1/retention/evaluate` | Evaluate retention for an object |
| GET | `/storage/v1/retention/holds` | List legal holds |
| POST | `/storage/v1/retention/holds` | Create legal hold |
| POST | `/storage/v1/retention/holds/:holdId/release` | Release legal hold |
| GET | `/storage/v1/retention/policies` | List retention policies |
| POST | `/storage/v1/retention/policies` | Create retention policy |
| DELETE | `/storage/v1/retention/policies/:policyId` | Delete retention policy |
| GET | `/storage/v1/retention/policies/:policyId` | Get retention policy |
| PATCH | `/storage/v1/retention/policies/:policyId` | Update retention policy |
| GET | `/storage/v1/retention/stats` | Get retention statistics |
| GET | `/storage/v1/tiering/policies` | List tiering policies |
| POST | `/storage/v1/tiering/policies` | Create a tiering policy |
| DELETE | `/storage/v1/tiering/policies/:policyId` | Delete tiering policy |
| GET | `/storage/v1/tiering/policies/:policyId` | Get tiering policy |
| PATCH | `/storage/v1/tiering/policies/:policyId` | Update tiering policy |
| POST | `/storage/v1/tiering/policies/:policyId/evaluate` | Trigger tiering evaluation (manual run) |
| GET | `/storage/v1/tiering/recommendations` | Get tiering recommendations |
| GET | `/storage/v1/tiering/stats` | Get tiering statistics |
| GET | `/storage/v1/uploads/:uploadId` |  |
| POST | `/storage/v1/uploads/:uploadId/complete` |  |
| PUT | `/storage/v1/uploads/:uploadId/parts/:partId` |  |
| GET | `/storage/v1/usage` |  |

## Tenant

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tenant/v1/health/alerts` |  |
| POST | `/tenant/v1/health/alerts/:alertId/acknowledge` |  |
| POST | `/tenant/v1/health/alerts/:alertId/resolve` |  |
| GET | `/tenant/v1/health/current` |  |
| POST | `/tenant/v1/health/snapshots` |  |
| GET | `/tenant/v1/health/snapshots/:snapshotId` |  |
| GET | `/tenant/v1/health/summary` |  |
| POST | `/tenant/v1/invitations/accept` | Accept an invitation by its one-time token (used by the signup/onboarding flow). |
| POST | `/tenant/v1/isolation/audits` |  |
| GET | `/tenant/v1/isolation/audits/:auditId` |  |
| POST | `/tenant/v1/isolation/audits/:auditId/checks/:checkId/result` |  |
| GET | `/tenant/v1/isolation/current-status` |  |
| POST | `/tenant/v1/isolation/findings/:findingId/remediate` |  |
| GET | `/tenant/v1/isolation/policies` |  |
| POST | `/tenant/v1/isolation/policies` |  |
| DELETE | `/tenant/v1/isolation/policies/:policyId` |  |
| GET | `/tenant/v1/isolation/policies/:policyId` |  |
| GET | `/tenant/v1/isolation/stats` |  |
| GET | `/tenant/v1/onboarding/stats` |  |
| GET | `/tenant/v1/onboarding/templates` |  |
| POST | `/tenant/v1/onboarding/templates` |  |
| DELETE | `/tenant/v1/onboarding/templates/:templateId` |  |
| GET | `/tenant/v1/onboarding/templates/:templateId` |  |
| POST | `/tenant/v1/onboarding/workflows` |  |
| GET | `/tenant/v1/onboarding/workflows/:workflowId` |  |
| POST | `/tenant/v1/onboarding/workflows/:workflowId/action` |  |
| POST | `/tenant/v1/onboarding/workflows/:workflowId/steps/:stepId/result` |  |
| GET | `/tenant/v1/public/by-domain/:domain` |  |
| GET | `/tenant/v1/public/by-id/:id` | Public UUID->tenant resolver. Used by the forgot-account flow (unauthenticated) to turn a tenant UUID into the human-readable slug/name for the reminder email. |
| GET | `/tenant/v1/public/by-slug/:slug` | Public endpoint: Lookup tenant by slug (no auth required) Used by login flow to resolve tenant slugs to UUIDs |
| GET | `/tenant/v1/quotas/current` |  |
| GET | `/tenant/v1/quotas/decisions` |  |
| POST | `/tenant/v1/quotas/forecast` |  |
| GET | `/tenant/v1/quotas/suggestions` |  |
| POST | `/tenant/v1/quotas/suggestions/:suggestionId/decide` |  |
| GET | `/tenant/v1/quotas/thresholds` |  |
| PUT | `/tenant/v1/quotas/thresholds/:quotaType/:quotaName` |  |
| POST | `/tenant/v1/quotas/usage` |  |
| GET | `/tenant/v1/tenants` |  |
| POST | `/tenant/v1/tenants` |  |
| DELETE | `/tenant/v1/tenants/:id` | primitive - used by the purge worker (after cross-service purge) and by billing orphan-tenant cleanup. Irreversible. |
| GET | `/tenant/v1/tenants/:id` |  |
| PATCH | `/tenant/v1/tenants/:id` |  |
| GET | `/tenant/v1/tenants/:id/add-ons` |  |
| POST | `/tenant/v1/tenants/:id/add-ons` | Declarative entropy-source contract. See /trust/entropy. |
| GET | `/tenant/v1/tenants/:id/approvals/:approvalId` | type (crypto-policy-change, tenant-delete, …). The approve path dispatches the side effect by the request's resourceType so new gated operations reuse this. |
| POST | `/tenant/v1/tenants/:id/approvals/:approvalId/approve` | Checker approves. On quorum the gated change is applied exactly once, dispatched by resourceType (maker != checker enforced by the gate). |
| POST | `/tenant/v1/tenants/:id/approvals/:approvalId/reject` |  |
| POST | `/tenant/v1/tenants/:id/cancel-deletion` | Cancel a pending deletion during the grace window - restores the workspace. |
| GET | `/tenant/v1/tenants/:id/crypto-policy` |  |
| PUT | `/tenant/v1/tenants/:id/crypto-policy` |  |
| GET | `/tenant/v1/tenants/:id/crypto-policy-v1` |  |
| PUT | `/tenant/v1/tenants/:id/crypto-policy-v1` |  |
| GET | `/tenant/v1/tenants/:id/crypto-policy-v1/history` |  |
| POST | `/tenant/v1/tenants/:id/crypto-policy-v1/rollback` |  |
| POST | `/tenant/v1/tenants/:id/crypto-policy-v1/tier0/disable` |  |
| POST | `/tenant/v1/tenants/:id/crypto-policy-v1/tier0/enable` |  |
| POST | `/tenant/v1/tenants/:id/crypto-policy-v1/tier4/enable` |  |
| GET | `/tenant/v1/tenants/:id/domains` |  |
| POST | `/tenant/v1/tenants/:id/domains/verification/start` |  |
| POST | `/tenant/v1/tenants/:id/domains/verification/verify` |  |
| GET | `/tenant/v1/tenants/:id/integrations` |  |
| POST | `/tenant/v1/tenants/:id/integrations` |  |
| PATCH | `/tenant/v1/tenants/:id/integrations/:integrationId` |  |
| GET | `/tenant/v1/tenants/:id/invitations` | List invitations - the cloud BFF (app/api/team/management) already calls this and expects { invitations }; it previously 404'd because only POST existed. |
| POST | `/tenant/v1/tenants/:id/invitations` | accepted for wire compatibility but are no longer needed - invitations no longer mutate the signed tenant record. |
| DELETE | `/tenant/v1/tenants/:id/invitations/:invitationId` | Revoke a pending invitation. |
| GET | `/tenant/v1/tenants/:id/join-requests` |  |
| POST | `/tenant/v1/tenants/:id/join-requests` |  |
| POST | `/tenant/v1/tenants/:id/join-requests/:requestId/review` |  |
| POST | `/tenant/v1/tenants/:id/schedule-deletion` | crypto-erase purge). Owner-only is enforced at the cloud BFF; the JWT/edge scope the caller to their own tenant. Status flips to pending_deletion (suspends access). |
| GET | `/tenant/v1/tenants/:id/session-settings` | Get session security settings for a tenant. Returns default settings if none are configured. |
| PUT | `/tenant/v1/tenants/:id/session-settings` | Update session security settings for a tenant. Allows configuring session timeout, idle warnings, tenant switch behavior, etc. |

## Vault

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vault/v1/dynamic-secrets/configs` | List dynamic secret configurations |
| POST | `/vault/v1/dynamic-secrets/configs` | Create a dynamic secret configuration |
| POST | `/vault/v1/dynamic-secrets/configs/:configId/credentials` | Request dynamic credentials - REAL provisioning via engine driver |
| GET | `/vault/v1/dynamic-secrets/configs/:configId/leases` | List active credentials for a config |
| GET | `/vault/v1/dynamic-secrets/engines` | Catalog endpoint - what engines are live + what's planned. Useful for portal UI to render the engine selector with implemented/planned hints. |
| POST | `/vault/v1/dynamic-secrets/leases/:leaseId/renew` | Renew a credential lease |
| POST | `/vault/v1/dynamic-secrets/leases/:leaseId/revoke` | Revoke a credential lease - queues for the lease-maintenance-worker. The worker will call driver.revoke and transition active → revoking → revoked. |
| GET | `/vault/v1/dynamic-secrets/stats` | Get dynamic secrets statistics |
| DELETE | `/vault/v1/internal/tenant/:tenantId` |  |
| POST | `/vault/v1/leakage-detection/incidents` |  |
| GET | `/vault/v1/leakage-detection/incidents/:incidentId` |  |
| PATCH | `/vault/v1/leakage-detection/incidents/:incidentId` |  |
| GET | `/vault/v1/leakage-detection/policies` |  |
| POST | `/vault/v1/leakage-detection/policies` |  |
| DELETE | `/vault/v1/leakage-detection/policies/:policyId` |  |
| GET | `/vault/v1/leakage-detection/policies/:policyId` |  |
| POST | `/vault/v1/leakage-detection/scan` |  |
| GET | `/vault/v1/leakage-detection/scans/:scanId` |  |
| POST | `/vault/v1/leakage-detection/secrets/:secretId/check` |  |
| GET | `/vault/v1/leakage-detection/stats` |  |
| GET | `/vault/v1/versioned-secrets` | ── List versioned secrets (one row per secret_id; latest version's fields) ── |
| POST | `/vault/v1/versioned-secrets` |  |
| GET | `/vault/v1/versioned-secrets/:secretId/audit` |  |
| POST | `/vault/v1/versioned-secrets/:secretId/compare` |  |
| POST | `/vault/v1/versioned-secrets/:secretId/enforce-retention` |  |
| GET | `/vault/v1/versioned-secrets/:secretId/history` |  |
| PUT | `/vault/v1/versioned-secrets/:secretId/retention-policy` |  |
| POST | `/vault/v1/versioned-secrets/:secretId/rollback` |  |
| GET | `/vault/v1/versioned-secrets/:secretId/versions/:version` |  |
| PATCH | `/vault/v1/versioned-secrets/:secretId/versions/:version/state` |  |
| GET | `/vault/v1/versioned-secrets/retention-policies` | ── Named retention policies: list (with appliedSecretCount) ── |
| POST | `/vault/v1/versioned-secrets/retention-policies` | ── Named retention policies: create ── |
| DELETE | `/vault/v1/versioned-secrets/retention-policies/:policyId` | ── Named retention policies: delete (clears the link from referencing secrets) ── |
| GET | `/vault/v1/versioned-secrets/stats` |  |

