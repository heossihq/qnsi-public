---
title: Billing SDK (qnsi.billing)
version: 0.2.6
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/billing-sdk/src/index.ts
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-billing-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.billing./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Billing SDK (`qnsi.billing`)

The TypeScript client for `billing-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. Provides usage metering, invoice management, revenue analytics, and payment recovery.

## Install

```bash
pnpm install @heossihq/qnsi
```

## Create a client

```ts
import { BillingClient } from "@heossihq/qnsi";

const billing = new BillingClient({
	baseUrl: "https://api.qnsi.heossi.com",
	apiKey: "<access_token>",
});
```

## Ingest Usage Meters

```ts
await billing.ingestMeters({
	meters: [
		{
			tenantId: "<tenant_uuid>",
			source: "storage-service",
			meterType: "storage_bytes",
			quantity: 1073741824, // 1 GB
			unit: "bytes",
			recordedAt: new Date().toISOString(),
			metadata: { tier: "hot" },
			security: {
				controlPlaneTokenSha256: "<hash>",
				pqcSignatures: [],
				hardwareProvider: null,
				attestationStatus: null,
				attestationProof: null,
			},
		},
	],
});
```

## Create Invoices

```ts
const invoice = await billing.createInvoice({
	tenantId: "<tenant_uuid>",
	periodStart: "2026-01-01T00:00:00Z",
	periodEnd: "2026-01-31T23:59:59Z",
	lineItems: [
		{
			description: "Storage (Hot Tier)",
			quantity: 100,
			unitPriceCents: 250, // $2.50 per GB
			totalCents: 25000,
			meterType: "storage_bytes",
		},
		{
			description: "AI Inference",
			quantity: 1000,
			unitPriceCents: 10, // $0.10 per request
			totalCents: 10000,
			meterType: "ai_inference",
		},
	],
	currency: "USD",
	taxesCents: 3500,
	security: {
		controlPlaneTokenSha256: "<hash>",
		pqcSignatures: [],
		hardwareProvider: null,
		attestationStatus: null,
		attestationProof: null,
	},
});
```

## List Invoices

```ts
const { items, nextCursor } = await billing.listInvoices("<tenant_uuid>", {
	limit: 20,
});

// Paginate
let cursor = nextCursor;
while (cursor) {
	const page = await billing.listInvoices("<tenant_uuid>", { cursor });
	// Process page.items
	cursor = page.nextCursor;
}
```

## Revenue Analytics

Analyze revenue across tenants and services:

```ts
// Revenue by tenant
const byTenant = await billing.getRevenueByTenant({
	since: "2026-01-01T00:00:00Z",
	sortBy: "revenue",
	sortOrder: "desc",
	limit: 50,
});
console.log(byTenant.summary.totalRevenueCents);

// Revenue by service
const byService = await billing.getRevenueByService({
	since: "2026-01-01T00:00:00Z",
});
for (const svc of byService.items) {
	console.log(svc.service, svc.percentOfTotal);
}

// Revenue summary with time series
const summary = await billing.getRevenueSummary({
	since: "2026-01-01T00:00:00Z",
	groupBy: "month",
});
console.log(summary.totalRevenueCents, summary.growthPercent);

// MRR metrics
const mrr = await billing.getMRRMetrics();
console.log(mrr.currentMrrCents, mrr.netMrrChangeCents, mrr.growthRate);
```

## Usage Forecasting

Predict future usage and billing:

```ts
// Usage forecast
const usageForecast = await billing.getUsageForecast({
	tenantId: "<tenant_uuid>",
	meterType: "storage_bytes",
	horizonDays: 30,
});
for (const prediction of usageForecast.predictions) {
	console.log(prediction.date, prediction.predictedValue);
}

// Billing forecast
const billingForecast = await billing.getBillingForecast({
	tenantId: "<tenant_uuid>",
	horizonMonths: 3,
});
for (const month of billingForecast.predictions) {
	console.log(month.month, month.predictedAmountCents);
}

// Capacity forecast with recommendations
const capacity = await billing.getCapacityForecast({
	meterType: "ai_inference",
	thresholdPercent: 80,
});
for (const rec of capacity.recommendations) {
	console.log(rec.type, rec.urgency, rec.description);
}
```

## Dunning (Payment Recovery)

Manage failed payments and recovery:

```ts
// Configure dunning schedule
const schedule = await billing.configureDunning({
	name: "Standard Recovery",
	stages: [
		{ stage: "reminder", daysAfterDue: 3, actions: ["email"] },
		{ stage: "warning", daysAfterDue: 7, actions: ["email", "in_app"] },
		{ stage: "final_notice", daysAfterDue: 14, actions: ["email", "phone"] },
		{ stage: "suspension", daysAfterDue: 30, actions: ["suspend"] },
	],
	isDefault: true,
});

// Check dunning status
const status = await billing.getDunningStatus("<tenant_uuid>");
console.log(status.status, status.totalOutstandingCents);

// Retry a failed payment
const retry = await billing.retryPayment({
	paymentId: "<payment_uuid>",
	forceRetry: true,
});
if (retry.success) {
	console.log("Payment recovered:", retry.transactionId);
}

// Resolve dunning case
await billing.resolveDunning({
	paymentId: "<payment_uuid>",
	resolution: "waived",
	note: "One-time courtesy waiver",
});

// Get dunning metrics
const metrics = await billing.getDunningMetrics();
console.log(metrics.recoveryRate, metrics.totalRecoveredCents);
```

## Credits System

Manage promotional credits and refunds:

```ts
// Create a credit
const credit = await billing.createCredit({
	tenantId: "<tenant_uuid>",
	type: "promotional",
	amountCents: 5000, // $50
	description: "Welcome credit",
	expiresAt: "2026-12-31T23:59:59Z",
});

// Check balance
const balance = await billing.getCreditBalance("<tenant_uuid>");
console.log(balance.totalAvailableCents);

// Apply credit to invoice
const applied = await billing.applyCredit({
	tenantId: "<tenant_uuid>",
	invoiceId: "<invoice_uuid>",
	amountCents: 2500,
});
console.log(applied.remainingInvoiceAmountCents);

// Create a promotion
const promo = await billing.createPromotion({
	code: "WELCOME50",
	name: "Welcome Offer",
	creditAmountCents: 5000,
	maxRedemptions: 1000,
	validUntil: "2026-06-30T23:59:59Z",
	eligibility: { newTenantsOnly: true },
});

// Redeem a promotion
const redemption = await billing.redeemPromotion({
	tenantId: "<tenant_uuid>",
	promotionCode: "WELCOME50",
});
if (redemption.success) {
	console.log("Credit applied:", redemption.credit?.amountCents);
}

// Get credit history
const history = await billing.getCreditHistory({
	tenantId: "<tenant_uuid>",
	limit: 50,
});
```

## Key APIs

### Usage Metering
- `BillingClient.ingestMeters(request)` - Batch ingest usage meters

### Invoice Management
- `BillingClient.createInvoice(request)` - Create invoice from line items
- `BillingClient.listInvoices(tenantId, options?)` - List tenant invoices

### Revenue Analytics
- `BillingClient.getRevenueByTenant(request?)` - Revenue breakdown by tenant
- `BillingClient.getRevenueByService(request?)` - Revenue breakdown by service
- `BillingClient.getRevenueSummary(request?)` - Revenue summary with trends
- `BillingClient.getMRRMetrics(request?)` - Monthly recurring revenue metrics

### Usage Forecasting
- `BillingClient.getUsageForecast(request?)` - Predict usage trends
- `BillingClient.getBillingForecast(request?)` - Predict billing amounts
- `BillingClient.getCapacityForecast(request?)` - Capacity planning forecasts

### Dunning
- `BillingClient.configureDunning(request)` - Configure recovery schedule
- `BillingClient.retryPayment(request)` - Retry failed payment
- `BillingClient.resolveDunning(request)` - Resolve dunning case
- `BillingClient.getDunningStatus(tenantId)` - Get tenant dunning status
- `BillingClient.getDunningMetrics(request?)` - Get recovery metrics

### Credits
- `BillingClient.createCredit(request)` - Create a credit
- `BillingClient.getCreditBalance(tenantId)` - Get available credits
- `BillingClient.applyCredit(request)` - Apply credit to invoice
- `BillingClient.createPromotion(request)` - Create promotion code
- `BillingClient.redeemPromotion(request)` - Redeem promotion
- `BillingClient.getCreditHistory(request)` - Get credit transactions

### Types
- `Meter` - Usage meter with security envelope
- `Invoice` - Invoice with line items and totals
- `RevenueSummary` - Revenue analytics data
- `DunningSchedule` - Payment recovery configuration
- `Credit` - Credit balance entry
- `Promotion` - Promotional offer
