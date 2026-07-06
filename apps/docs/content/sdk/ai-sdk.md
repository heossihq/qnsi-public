---
title: AI SDK (@heossi/qnsi-ai-sdk)
version: 0.1.11
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/ai-sdk/src/client.ts
  - /packages/ai-sdk/src/types.ts
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-ai-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.ai./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# AI SDK (`@heossi/qnsi-ai-sdk`)

The TypeScript client for `ai-orchestrator`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. Model artifacts and inference data are encrypted with tenant-specific PQC algorithms based on crypto policy.

## Install

```bash
pnpm install @heossi/qnsi-ai-sdk
```

## Create a client

```ts
import { AiOrchestratorClient } from "@heossi/qnsi-ai-sdk";

const ai = new AiOrchestratorClient({
	baseUrl: "http://localhost:8094",
	token: "<access_token>",
	tier: "enterprise-pro", // Optional tier check
});
```

## Register Artifacts

```ts
const artifact = await ai.registerArtifact({
	tenantId: "<tenant_uuid>",
	name: "llama-7b-fine-tuned",
	type: "model",
	sizeBytes: 14000000000,
	checksumSha3: "<sha3_hash>",
	metadata: {
		framework: "pytorch",
		version: "2.0",
	},
});
```

## Submit Workloads

```ts
const workload = await ai.submitWorkload({
	tenantId: "<tenant_uuid>",
	name: "inference-job",
	priority: "high",
	schedulingPolicy: "on-demand",
	containerImage: "qnsi/inference-runtime:latest",
	command: ["python", "-m", "inference"],
	env: {
		MODEL_PATH: "/models/llama-7b",
	},
	resources: {
		cpu: 4,
		memoryMb: 16384,
		gpu: 1,
	},
	artifacts: [
		{
			artifactId: "<artifact_uuid>",
			mountPath: "/models",
			accessMode: "read",
		},
	],
	idempotencyKey: "<unique_key>", // Optional
});
```

## Deploy Models

```ts
const deployment = await ai.deployModel({
	tenantId: "<tenant_uuid>",
	modelName: "llama-7b-fine-tuned",
	artifactId: "<artifact_uuid>",
	runtimeImage: "qnsi/inference-runtime:latest",
	manifest: {
		version: "1.0.0",
		framework: "pytorch",
		inputSchema: { /* ... */ },
		outputSchema: { /* ... */ },
	},
	resources: {
		cpu: 4,
		memoryMb: 16384,
		gpu: 1,
	},
	priority: "normal",
	schedulingPolicy: "on-demand",
});
```

## Invoke Inference

```ts
const result = await ai.invokeInference({
	tenantId: "<tenant_uuid>",
	modelDeploymentId: "<deployment_uuid>",
	input: {
		prompt: "Explain quantum computing",
		maxTokens: 500,
	},
	priority: "normal",
});

console.log(result.output);
```

## Stream Inference Events

```ts
for await (const event of ai.streamInferenceEvents("<workload_uuid>")) {
	switch (event.type) {
		case "token":
			process.stdout.write(event.token);
			break;
		case "complete":
			console.log("\nDone:", event.usage);
			break;
		case "error":
			console.error("Error:", event.message);
			break;
	}
}
```

## Manage Workloads

```ts
// Get workload status
const workload = await ai.getWorkload("<workload_uuid>");
console.log(workload.status); // "pending" | "running" | "completed" | "failed"

// List workloads
const { items, nextCursor } = await ai.listWorkloads({
	tenantId: "<tenant_uuid>",
	status: "running",
	limit: 20,
});

// Cancel workload
await ai.cancelWorkload({
	workloadId: "<workload_uuid>",
	reason: "No longer needed",
});
```

## Tier Access

The SDK validates tier access for premium features:

```ts
import { AiOrchestratorClient, TierError } from "@heossi/qnsi-ai-sdk";

try {
	const ai = new AiOrchestratorClient({
		baseUrl: "http://localhost:8094",
		token: "<token>",
		tier: "dev-starter",
	});
	
	// Training requires enterprise-pro tier
	await ai.submitWorkload({
		name: "fine-tuning-job",
		// ...
	});
} catch (error) {
	if (error instanceof TierError) {
		console.log("Training requires enterprise-pro tier");
	}
}
```

## Model Registry

Register, version, and manage AI models throughout their lifecycle:

```ts
// Register a new model
const model = await ai.registerModel({
	tenantId: "<tenant_uuid>",
	name: "customer-churn-predictor",
	version: "1.0.0",
	provider: "pytorch",
	modelType: "classification",
	servingConfig: {
		framework: "pytorch",
		runtimeImage: "qnsi/pytorch-serve:2.0",
		minInstances: 1,
		maxInstances: 10,
	},
	tags: ["production", "ml-ops"],
});

// List models with filters
const { models, total } = await ai.listModels({
	tenantId: "<tenant_uuid>",
	status: "active",
	provider: "pytorch",
	limit: 50,
});

// Get model details
const modelDetails = await ai.getModel("<model_uuid>");

// Activate a model for production use
await ai.activateModel("<model_uuid>", {
	activationNote: "Passed all validation tests",
});

// Deprecate a model
await ai.deprecateModel("<model_uuid>", {
	deprecationReason: "Superseded by v2.0",
	replacementModelId: "<new_model_uuid>",
	sunsetDate: "2026-06-01",
});
```

## Model Deployments

Deploy models to specific environments:

```ts
// Create a deployment
const deployment = await ai.createDeployment({
	tenantId: "<tenant_uuid>",
	modelId: "<model_uuid>",
	name: "churn-predictor-prod",
	environment: "production",
	resources: {
		cpu: 4,
		memoryMb: 16384,
		gpu: 1,
	},
	autoscaling: {
		minReplicas: 2,
		maxReplicas: 20,
		targetCpuUtilization: 70,
		scaleDownDelaySeconds: 300,
	},
});

// List deployments
const { deployments } = await ai.listDeployments({
	tenantId: "<tenant_uuid>",
	environment: "production",
	status: "running",
});

// Get deployment details
const deploymentDetails = await ai.getDeployment("<deployment_uuid>");

// Stop a deployment
await ai.stopDeployment("<deployment_uuid>", {
	reason: "Scheduled maintenance",
});
```

## Cost Optimization

Monitor and optimize AI inference costs:

```ts
// Get cost summary
const summary = await ai.getCostSummary({ tenantId: "<tenant_uuid>" });
console.log(summary);
// {
//   currentPeriodCost: 1250.50,
//   previousPeriodCost: 1180.25,
//   projectedMonthlyCost: 2500.00,
//   costTrend: "increasing",
//   topCostDrivers: [...]
// }

// Get detailed cost analytics
const analytics = await ai.getCostAnalytics({
	tenantId: "<tenant_uuid>",
	startDate: "2026-03-01",
	endDate: "2026-03-20",
	groupBy: "model",
});

// Create a budget
const budget = await ai.createBudget({
	tenantId: "<tenant_uuid>",
	name: "Q1 AI Inference Budget",
	budgetType: "monthly",
	amount: 5000,
	alertThresholds: [50, 75, 90, 100],
	notificationChannels: ["email", "slack"],
});

// List budgets
const { budgets } = await ai.listBudgets({ tenantId: "<tenant_uuid>" });

// Get cost alerts
const { alerts } = await ai.getCostAlerts({
	tenantId: "<tenant_uuid>",
	severity: "high",
	acknowledged: false,
});

// Acknowledge an alert
await ai.acknowledgeCostAlert("<alert_uuid>");

// Get optimization recommendations
const { recommendations } = await ai.getOptimizationRecommendations({
	tenantId: "<tenant_uuid>",
	status: "pending",
});

// Accept a recommendation
await ai.acceptRecommendation("<recommendation_uuid>", {
	implementationNote: "Applying during next maintenance window",
});
```

## Bias Monitoring

Detect and track bias in AI model outputs:

```ts
// Create a bias evaluation
const evaluation = await ai.createBiasEvaluation({
	tenantId: "<tenant_uuid>",
	modelId: "<model_uuid>",
	name: "Q1 Fairness Audit",
	evaluationType: "demographic_parity",
	protectedAttributes: ["gender", "age_group", "ethnicity"],
	targetMetrics: ["accuracy", "false_positive_rate", "false_negative_rate"],
});

// Start the evaluation
await ai.startEvaluation("<evaluation_uuid>");

// List evaluations
const { evaluations } = await ai.listEvaluations({
	tenantId: "<tenant_uuid>",
	status: "completed",
});

// Get evaluation details
const evaluationDetails = await ai.getEvaluation("<evaluation_uuid>");

// Get bias incidents
const { incidents } = await ai.getBiasIncidents({
	tenantId: "<tenant_uuid>",
	severity: "high",
	status: "open",
});

// Record a bias incident manually
await ai.recordBiasIncident({
	tenantId: "<tenant_uuid>",
	modelId: "<model_uuid>",
	incidentType: "disparate_impact",
	severity: "medium",
	description: "Higher rejection rate for age group 50+",
	affectedAttribute: "age_group",
	affectedGroup: "50+",
});

// Get fairness metrics
const { metrics } = await ai.getFairnessMetrics({
	tenantId: "<tenant_uuid>",
	modelId: "<model_uuid>",
});

// Get bias monitoring summary
const biasSummary = await ai.getBiasSummary({ tenantId: "<tenant_uuid>" });
```

## Prompt Injection Detection

Detect and prevent prompt injection attacks:

```ts
// Create a detection pattern
const pattern = await ai.createDetectionPattern({
	tenantId: "<tenant_uuid>",
	name: "System Prompt Override",
	patternType: "regex",
	pattern: "ignore\\s+(previous|above|all)\\s+instructions",
	attackCategory: "instruction_override",
	severity: "critical",
	enabled: true,
});

// List patterns
const { patterns } = await ai.listPatterns({
	tenantId: "<tenant_uuid>",
	enabled: true,
});

// Get pattern details
const patternDetails = await ai.getPattern("<pattern_uuid>");

// Delete a pattern
await ai.deletePattern("<pattern_uuid>");

// Get injection incidents
const { incidents: injectionIncidents } = await ai.getInjectionIncidents({
	tenantId: "<tenant_uuid>",
	severity: "critical",
	since: "2026-03-01",
});

// Get injection statistics
const stats = await ai.getInjectionStats({
	tenantId: "<tenant_uuid>",
	startDate: "2026-03-01",
	endDate: "2026-03-20",
	groupBy: "attack_category",
});

// Get injection summary
const injectionSummary = await ai.getInjectionSummary({ tenantId: "<tenant_uuid>" });

// Configure detection settings
await ai.configureDetection({
	tenantId: "<tenant_uuid>",
	detectionMode: "enforce",
	sensitivityLevel: "high",
	blockOnDetection: true,
	logAllAttempts: true,
});
```

## Key APIs

### Artifacts
- `AiOrchestratorClient.registerArtifact(input)` - Register model artifact

### Workloads
- `AiOrchestratorClient.submitWorkload(input)` - Submit workload
- `AiOrchestratorClient.deployModel(request)` - Deploy model (legacy)
- `AiOrchestratorClient.getWorkload(workloadId)` - Get status
- `AiOrchestratorClient.listWorkloads(params?)` - List workloads
- `AiOrchestratorClient.cancelWorkload(input)` - Cancel workload

### Inference
- `AiOrchestratorClient.invokeInference(request)` - Invoke inference
- `AiOrchestratorClient.streamInferenceEvents(workloadId)` - Stream events

### Model Registry
- `AiOrchestratorClient.registerModel(request)` - Register a new model
- `AiOrchestratorClient.listModels(params?)` - List models with filters
- `AiOrchestratorClient.getModel(modelId)` - Get model details
- `AiOrchestratorClient.updateModel(modelId, request)` - Update model
- `AiOrchestratorClient.activateModel(modelId, request)` - Activate model
- `AiOrchestratorClient.deprecateModel(modelId, request)` - Deprecate model
- `AiOrchestratorClient.createDeployment(request)` - Create deployment
- `AiOrchestratorClient.listDeployments(params?)` - List deployments
- `AiOrchestratorClient.getDeployment(deploymentId)` - Get deployment
- `AiOrchestratorClient.stopDeployment(deploymentId, request)` - Stop deployment

### Cost Optimization
- `AiOrchestratorClient.getCostSummary(params)` - Get cost summary
- `AiOrchestratorClient.getCostAnalytics(params)` - Get cost analytics
- `AiOrchestratorClient.createBudget(request)` - Create budget
- `AiOrchestratorClient.listBudgets(params?)` - List budgets
- `AiOrchestratorClient.getBudget(budgetId)` - Get budget
- `AiOrchestratorClient.deleteBudget(budgetId)` - Delete budget
- `AiOrchestratorClient.getCostAlerts(params?)` - Get cost alerts
- `AiOrchestratorClient.acknowledgeCostAlert(alertId)` - Acknowledge alert
- `AiOrchestratorClient.getOptimizationRecommendations(params?)` - Get recommendations
- `AiOrchestratorClient.acceptRecommendation(recommendationId, request)` - Accept recommendation

### Bias Monitoring
- `AiOrchestratorClient.createBiasEvaluation(request)` - Create evaluation
- `AiOrchestratorClient.startEvaluation(evaluationId)` - Start evaluation
- `AiOrchestratorClient.listEvaluations(params?)` - List evaluations
- `AiOrchestratorClient.getEvaluation(evaluationId)` - Get evaluation
- `AiOrchestratorClient.getBiasIncidents(params?)` - Get incidents
- `AiOrchestratorClient.recordBiasIncident(request)` - Record incident
- `AiOrchestratorClient.getFairnessMetrics(params)` - Get fairness metrics
- `AiOrchestratorClient.getBiasSummary(params)` - Get bias summary

### Prompt Injection
- `AiOrchestratorClient.createDetectionPattern(request)` - Create pattern
- `AiOrchestratorClient.listPatterns(params?)` - List patterns
- `AiOrchestratorClient.getPattern(patternId)` - Get pattern
- `AiOrchestratorClient.deletePattern(patternId)` - Delete pattern
- `AiOrchestratorClient.getInjectionIncidents(params?)` - Get incidents
- `AiOrchestratorClient.getInjectionStats(params)` - Get statistics
- `AiOrchestratorClient.getInjectionSummary(params)` - Get summary
- `AiOrchestratorClient.configureDetection(request)` - Configure detection

### Types
- `SubmitWorkloadRequest` - Workload configuration
- `ModelDeploymentRequest` - Model deployment config
- `InferenceRequest` - Inference input
- `InferenceStreamEvent` - Streaming event
- `TierError` - Tier access error
- `Model` - Model entity
- `Deployment` - Deployment entity
- `CostSummary` - Cost summary data
- `Budget` - Budget configuration
- `BiasEvaluation` - Bias evaluation
- `BiasIncident` - Bias incident
- `DetectionPattern` - Injection detection pattern
- `InjectionIncident` - Injection incident
