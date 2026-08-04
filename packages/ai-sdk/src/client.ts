import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type { AiClientTelemetry, AiClientTelemetryConfig } from "./observability.js";
import { createAiClientTelemetry, isAiClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { checkTierAccess, type PricingTier, TierError } from "./tier.js";
import type {
	ActivateModelResponse,
	BiasEvaluation,
	BiasSummary,
	Budget,
	ConfigureDetectionRequest,
	ConfigureDetectionResponse,
	CostAnalytics,
	CostSummary,
	CreateBiasEvaluationRequest,
	CreateBiasEvaluationResponse,
	CreateBudgetRequest,
	CreateBudgetResponse,
	CreateDeploymentRequest,
	CreateDeploymentResponse,
	CreateDetectionPatternRequest,
	CreateDetectionPatternResponse,
	Deployment,
	DeprecateModelResponse,
	DetectionPattern,
	GetCostAnalyticsParams,
	GetFairnessMetricsParams,
	GetFairnessMetricsResponse,
	GetInjectionStatsParams,
	InferenceRequest,
	InferenceResponse,
	InferenceStreamEvent,
	InjectionStats,
	InjectionSummary,
	ListBiasIncidentsParams,
	ListBiasIncidentsResponse,
	ListBudgetsParams,
	ListBudgetsResponse,
	ListCostAlertsParams,
	ListCostAlertsResponse,
	ListDeploymentsParams,
	ListDeploymentsResponse,
	ListEvaluationsParams,
	ListEvaluationsResponse,
	ListInjectionIncidentsParams,
	ListInjectionIncidentsResponse,
	ListModelsParams,
	ListModelsResponse,
	ListPatternsParams,
	ListPatternsResponse,
	ListRecommendationsParams,
	ListRecommendationsResponse,
	ListWorkloadsResponse,
	Model,
	ModelDeploymentRequest,
	RecordBiasIncidentRequest,
	RecordBiasIncidentResponse,
	RegisterArtifactRequest,
	RegisteredArtifact,
	RegisterModelRequest,
	RegisterModelResponse,
	StartEvaluationResponse,
	SubmitWorkloadRequest,
	SubmitWorkloadResponse,
	UpdateModelRequest,
	WorkloadDetail,
} from "./types.js";
import { validateUUID } from "./validation.js";

export interface AiOrchestratorClientOptions {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly tier?: PricingTier;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
	readonly fetchImpl?: typeof fetch;
	readonly telemetry?: AiClientTelemetry | AiClientTelemetryConfig;
}

export { TierError };

export interface ListWorkloadsParams {
	readonly tenantId?: string;
	readonly status?: string;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface CancelWorkloadRequest {
	readonly workloadId: string;
	readonly reason?: string;
}

export class AiOrchestratorClient {
	private readonly baseUrl: URL;
	private readonly apiKey: string;
	private readonly tier: PricingTier | undefined;
	private readonly maxRetries: number;
	private readonly retryDelayMs: number;
	private readonly fetchImpl: typeof fetch;
	private readonly telemetry: AiClientTelemetry | null;
	private readonly targetService: string;
	private activationPromise: Promise<void> | null = null;
	private readonly activationConfig: SdkActivationConfig;
	private resolvedTenantId: string | null = null;

	private async ensureActivated(): Promise<void> {
		if (!this.activationPromise) {
			this.activationPromise = activateSdk(this.activationConfig).then((response) => {
				this.resolvedTenantId = response.tenantId;
			});
		}
		return this.activationPromise;
	}

	constructor(options: AiOrchestratorClientOptions) {
		if (!options.apiKey || options.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP AI SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/ai-sdk",
			);
		}

		const baseUrlNormalized = options.baseUrl.replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP for localhost in development and
		// for internal service-mesh hostnames - e.g. *.internal - which are on a
		// private VPC network and do not require TLS termination at the transport layer).
		if (!baseUrlNormalized.startsWith("https://")) {
			const isLocalhost =
				baseUrlNormalized.startsWith("http://localhost") ||
				baseUrlNormalized.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(baseUrlNormalized);
				isInternalService =
					parsed.protocol === "http:" &&
					(parsed.hostname.endsWith(".internal") ||
						parsed.hostname === "localhost" ||
						parsed.hostname === "127.0.0.1");
			} catch {
				// ignore; invalid URL will be caught later by fetch
			}
			const isDevelopment =
				process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
			if ((!isLocalhost || !isDevelopment) && !isInternalService) {
				throw new Error(
					"baseUrl must use HTTPS in production. HTTP is only allowed for localhost in development.",
				);
			}
		}

		this.baseUrl = new URL(
			baseUrlNormalized.endsWith("/") ? baseUrlNormalized : `${baseUrlNormalized}/`,
		);
		this.apiKey = options.apiKey;
		this.tier = options.tier;
		this.maxRetries = options.maxRetries ?? 3;
		this.retryDelayMs = options.retryDelayMs ?? 1_000;
		this.fetchImpl = options.fetchImpl ?? fetch;

		this.telemetry = options.telemetry
			? isAiClientTelemetry(options.telemetry)
				? options.telemetry
				: createAiClientTelemetry(options.telemetry)
			: null;

		try {
			this.targetService = new URL(baseUrlNormalized).host;
		} catch {
			this.targetService = "ai-orchestrator";
		}

		this.activationConfig = {
			apiKey: options.apiKey,
			sdkId: "ai-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: baseUrlNormalized,
			fetchImpl: options.fetchImpl,
		};
	}

	/**
	 * Check if the current tier has access to AI inference.
	 * Throws TierError if not authorized.
	 */
	private checkInferenceAccess(): void {
		if (this.tier) {
			checkTierAccess("ai-inference", this.tier);
		}
	}

	/**
	 * Check if the current tier has access to AI training.
	 * Throws TierError if not authorized.
	 */
	private checkTrainingAccess(): void {
		if (this.tier) {
			checkTierAccess("ai-training", this.tier);
		}
	}

	/**
	 * Check if the current tier has access to enclaves.
	 * Throws TierError if not authorized.
	 */
	private checkEnclaveAccess(): void {
		if (this.tier) {
			checkTierAccess("enclaves", this.tier);
		}
	}

	async registerArtifact(input: RegisterArtifactRequest): Promise<RegisteredArtifact> {
		await this.ensureActivated();
		return this.request<RegisteredArtifact>("ai/v1/artifacts", {
			method: "POST",
			body: JSON.stringify(input),
		});
	}

	async submitWorkload(input: SubmitWorkloadRequest): Promise<SubmitWorkloadResponse> {
		await this.ensureActivated();
		// Training workloads require enterprise-pro tier
		const isTraining =
			input.name?.toLowerCase().includes("training") ||
			input.name?.toLowerCase().includes("fine-tune");
		if (isTraining) {
			this.checkTrainingAccess();
		}
		// GPU workloads with high resources likely need enclave access
		const needsEnclave = input.resources?.gpu && input.resources.gpu > 0;
		if (needsEnclave) {
			this.checkEnclaveAccess();
		}

		const { idempotencyKey, ...payload } = input;
		const headers: Record<string, string> = {};
		if (idempotencyKey) {
			headers["idempotency-key"] = idempotencyKey;
		}

		const body = JSON.stringify({
			...payload,
			env: payload.env ?? {},
		});

		return this.request<SubmitWorkloadResponse>("ai/v1/workloads", {
			method: "POST",
			headers,
			body,
		});
	}

	async deployModel(request: ModelDeploymentRequest): Promise<SubmitWorkloadResponse> {
		await this.ensureActivated();
		this.checkInferenceAccess();
		const manifestDigest = createHash("sha3-512")
			.update(JSON.stringify(request.manifest))
			.digest("hex");
		const issuedAt = new Date().toISOString();
		const workload: SubmitWorkloadRequest = {
			tenantId: request.tenantId,
			name: `${request.modelName}-deployment`,
			priority: request.priority ?? "normal",
			schedulingPolicy: request.schedulingPolicy ?? "on-demand",
			containerImage: request.runtimeImage,
			command: request.command ?? ["python", "-m", "qnsp.runtime.inference"],
			env: {
				MODEL_NAME: request.modelName,
				MODEL_VERSION: request.manifest.version,
				...request.env,
			},
			resources: request.resources,
			artifacts: [
				{
					artifactId: request.artifactId,
					mountPath: "/models",
					accessMode: "read",
				},
			],
			manifest: {
				pqcSignature: manifestDigest,
				algorithm: "sha3-512",
				issuedAt,
				modelName: request.modelName,
				modelVersion: request.manifest.version,
				artifactId: request.artifactId,
				modelPackage: request.manifest,
			},
			labels: {
				"qnsp.io/model-name": request.modelName,
				"qnsp.io/model-version": request.manifest.version,
				...(request.labels ?? {}),
			},
		};
		return this.submitWorkload(workload);
	}

	async getWorkload(workloadId: string): Promise<WorkloadDetail> {
		await this.ensureActivated();
		validateUUID(workloadId, "workloadId");
		return this.request<WorkloadDetail>(`ai/v1/workloads/${workloadId}`, {
			method: "GET",
		});
	}

	async listWorkloads(params: ListWorkloadsParams = {}): Promise<ListWorkloadsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/workloads", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.status) {
			url.searchParams.set("status", params.status);
		}
		if (params.cursor) {
			url.searchParams.set("cursor", params.cursor);
		}
		if (typeof params.limit === "number") {
			url.searchParams.set("limit", params.limit.toString());
		}

		return this.request<ListWorkloadsResponse>(url, {
			method: "GET",
		});
	}

	async cancelWorkload(input: CancelWorkloadRequest) {
		await this.ensureActivated();
		const init: RequestInit = {
			method: "POST",
		};
		if (input.reason) {
			init.body = JSON.stringify({ reason: input.reason });
		}
		return this.request<{ workloadId: string; status: string; canceledAt: string }>(
			`ai/v1/workloads/${input.workloadId}/cancel`,
			init,
		);
	}

	async invokeInference(request: InferenceRequest): Promise<InferenceResponse> {
		await this.ensureActivated();
		this.checkInferenceAccess();
		return this.request<InferenceResponse>("ai/v1/inference", {
			method: "POST",
			body: JSON.stringify({
				tenantId: request.tenantId,
				modelDeploymentId: request.modelDeploymentId,
				input: request.input,
				priority: request.priority ?? "normal",
			}),
		});
	}

	async *streamInferenceEvents(workloadId: string): AsyncGenerator<InferenceStreamEvent> {
		await this.ensureActivated();
		validateUUID(workloadId, "workloadId");
		const response = await this.requestRaw(`ai/v1/inference/${workloadId}/stream`, {
			method: "GET",
		});
		const body = response.body;
		if (!body) {
			return;
		}

		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) {
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				let newlineIndex = buffer.indexOf("\n");
				while (newlineIndex >= 0) {
					const line = buffer.slice(0, newlineIndex).trim();
					buffer = buffer.slice(newlineIndex + 1);
					if (line.length > 0) {
						yield JSON.parse(line) as InferenceStreamEvent;
					}
					newlineIndex = buffer.indexOf("\n");
				}
			}
			const remaining = buffer.trim();
			if (remaining.length > 0) {
				yield JSON.parse(remaining) as InferenceStreamEvent;
			}
		} finally {
			reader.releaseLock();
		}
	}

	async registerModel(request: RegisterModelRequest): Promise<RegisterModelResponse> {
		await this.ensureActivated();
		return this.request<RegisterModelResponse>("ai/v1/registry/models", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async listModels(params: ListModelsParams = {}): Promise<ListModelsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/registry/models", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.provider) url.searchParams.set("provider", params.provider);
		if (params.modelType) url.searchParams.set("modelType", params.modelType);
		if (params.status) url.searchParams.set("status", params.status);
		if (params.tag) url.searchParams.set("tag", params.tag);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListModelsResponse>(url, { method: "GET" });
	}

	async getModel(modelId: string): Promise<Model> {
		await this.ensureActivated();
		validateUUID(modelId, "modelId");
		const result = await this.request<{ model: Model }>(`ai/v1/registry/models/${modelId}`, {
			method: "GET",
		});
		return result.model;
	}

	async updateModel(modelId: string, updates: UpdateModelRequest): Promise<Model> {
		await this.ensureActivated();
		validateUUID(modelId, "modelId");
		const result = await this.request<{ model: Model }>(`ai/v1/registry/models/${modelId}`, {
			method: "PATCH",
			body: JSON.stringify(updates),
		});
		return result.model;
	}

	async activateModel(modelId: string): Promise<ActivateModelResponse> {
		await this.ensureActivated();
		validateUUID(modelId, "modelId");
		return this.request<ActivateModelResponse>(`ai/v1/registry/models/${modelId}/activate`, {
			method: "POST",
		});
	}

	async deprecateModel(modelId: string): Promise<DeprecateModelResponse> {
		await this.ensureActivated();
		validateUUID(modelId, "modelId");
		return this.request<DeprecateModelResponse>(`ai/v1/registry/models/${modelId}/deprecate`, {
			method: "POST",
		});
	}

	async createDeployment(request: CreateDeploymentRequest): Promise<CreateDeploymentResponse> {
		await this.ensureActivated();
		return this.request<CreateDeploymentResponse>("ai/v1/registry/deployments", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async listDeployments(params: ListDeploymentsParams = {}): Promise<ListDeploymentsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/registry/deployments", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.modelId) {
			validateUUID(params.modelId, "modelId");
			url.searchParams.set("modelId", params.modelId);
		}
		if (params.environment) url.searchParams.set("environment", params.environment);
		if (params.status) url.searchParams.set("status", params.status);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListDeploymentsResponse>(url, { method: "GET" });
	}

	async getDeployment(deploymentId: string): Promise<Deployment> {
		await this.ensureActivated();
		validateUUID(deploymentId, "deploymentId");
		const result = await this.request<{ deployment: Deployment }>(
			`ai/v1/registry/deployments/${deploymentId}`,
			{ method: "GET" },
		);
		return result.deployment;
	}

	async stopDeployment(
		deploymentId: string,
	): Promise<{ id: string; status: "stopped"; stoppedAt: string }> {
		await this.ensureActivated();
		validateUUID(deploymentId, "deploymentId");
		return this.request<{ id: string; status: "stopped"; stoppedAt: string }>(
			`ai/v1/registry/deployments/${deploymentId}/stop`,
			{ method: "POST" },
		);
	}

	async getCostSummary(tenantId?: string): Promise<CostSummary> {
		await this.ensureActivated();
		const url = new URL("ai/v1/costs/summary", this.baseUrl);
		if (tenantId) {
			validateUUID(tenantId, "tenantId");
			url.searchParams.set("tenantId", tenantId);
		}
		return this.request<CostSummary>(url, { method: "GET" });
	}

	async getCostAnalytics(params: GetCostAnalyticsParams): Promise<CostAnalytics> {
		await this.ensureActivated();
		const url = new URL("ai/v1/costs/analytics", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.modelName) url.searchParams.set("modelName", params.modelName);
		if (params.provider) url.searchParams.set("provider", params.provider);
		url.searchParams.set("startDate", params.startDate);
		url.searchParams.set("endDate", params.endDate);
		if (params.groupBy) url.searchParams.set("groupBy", params.groupBy);
		return this.request<CostAnalytics>(url, { method: "GET" });
	}

	async createBudget(request: CreateBudgetRequest): Promise<CreateBudgetResponse> {
		await this.ensureActivated();
		return this.request<CreateBudgetResponse>("ai/v1/costs/budgets", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async listBudgets(params: ListBudgetsParams = {}): Promise<ListBudgetsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/costs/budgets", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.status) url.searchParams.set("status", params.status);
		if (params.budgetType) url.searchParams.set("budgetType", params.budgetType);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListBudgetsResponse>(url, { method: "GET" });
	}

	async getBudget(budgetId: string): Promise<Budget> {
		await this.ensureActivated();
		validateUUID(budgetId, "budgetId");
		const result = await this.request<{ budget: Budget }>(`ai/v1/costs/budgets/${budgetId}`, {
			method: "GET",
		});
		return result.budget;
	}

	async deleteBudget(budgetId: string): Promise<{ id: string; status: "archived" }> {
		await this.ensureActivated();
		validateUUID(budgetId, "budgetId");
		return this.request<{ id: string; status: "archived" }>(`ai/v1/costs/budgets/${budgetId}`, {
			method: "DELETE",
		});
	}

	async getCostAlerts(params: ListCostAlertsParams = {}): Promise<ListCostAlertsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/costs/alerts", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.budgetId) {
			validateUUID(params.budgetId, "budgetId");
			url.searchParams.set("budgetId", params.budgetId);
		}
		if (params.alertType) url.searchParams.set("alertType", params.alertType);
		if (params.severity) url.searchParams.set("severity", params.severity);
		if (params.acknowledged !== undefined)
			url.searchParams.set("acknowledged", String(params.acknowledged));
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListCostAlertsResponse>(url, { method: "GET" });
	}

	async acknowledgeCostAlert(
		alertId: string,
	): Promise<{ id: string; acknowledged: boolean; acknowledgedAt: string }> {
		await this.ensureActivated();
		validateUUID(alertId, "alertId");
		return this.request<{ id: string; acknowledged: boolean; acknowledgedAt: string }>(
			`ai/v1/costs/alerts/${alertId}/acknowledge`,
			{ method: "POST" },
		);
	}

	async getOptimizationRecommendations(
		params: ListRecommendationsParams = {},
	): Promise<ListRecommendationsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/costs/recommendations", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.recommendationType)
			url.searchParams.set("recommendationType", params.recommendationType);
		if (params.status) url.searchParams.set("status", params.status);
		if (params.priority) url.searchParams.set("priority", params.priority);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListRecommendationsResponse>(url, { method: "GET" });
	}

	async acceptRecommendation(
		recommendationId: string,
	): Promise<{ id: string; status: "accepted"; acceptedAt: string }> {
		await this.ensureActivated();
		validateUUID(recommendationId, "recommendationId");
		return this.request<{ id: string; status: "accepted"; acceptedAt: string }>(
			`ai/v1/costs/recommendations/${recommendationId}/accept`,
			{ method: "POST" },
		);
	}

	async createBiasEvaluation(
		request: CreateBiasEvaluationRequest,
	): Promise<CreateBiasEvaluationResponse> {
		await this.ensureActivated();
		return this.request<CreateBiasEvaluationResponse>("ai/v1/bias/evaluations", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async startEvaluation(evaluationId: string): Promise<StartEvaluationResponse> {
		await this.ensureActivated();
		validateUUID(evaluationId, "evaluationId");
		return this.request<StartEvaluationResponse>(`ai/v1/bias/evaluations/${evaluationId}/start`, {
			method: "POST",
		});
	}

	async listEvaluations(params: ListEvaluationsParams = {}): Promise<ListEvaluationsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/bias/evaluations", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.modelName) url.searchParams.set("modelName", params.modelName);
		if (params.modelId) {
			validateUUID(params.modelId, "modelId");
			url.searchParams.set("modelId", params.modelId);
		}
		if (params.evaluationType) url.searchParams.set("evaluationType", params.evaluationType);
		if (params.status) url.searchParams.set("status", params.status);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListEvaluationsResponse>(url, { method: "GET" });
	}

	async getEvaluation(evaluationId: string): Promise<BiasEvaluation> {
		await this.ensureActivated();
		validateUUID(evaluationId, "evaluationId");
		const result = await this.request<{ evaluation: BiasEvaluation }>(
			`ai/v1/bias/evaluations/${evaluationId}`,
			{ method: "GET" },
		);
		return result.evaluation;
	}

	async getBiasIncidents(params: ListBiasIncidentsParams = {}): Promise<ListBiasIncidentsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/bias/incidents", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.modelName) url.searchParams.set("modelName", params.modelName);
		if (params.modelId) {
			validateUUID(params.modelId, "modelId");
			url.searchParams.set("modelId", params.modelId);
		}
		if (params.incidentType) url.searchParams.set("incidentType", params.incidentType);
		if (params.severity) url.searchParams.set("severity", params.severity);
		if (params.status) url.searchParams.set("status", params.status);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListBiasIncidentsResponse>(url, { method: "GET" });
	}

	async recordBiasIncident(
		request: RecordBiasIncidentRequest,
	): Promise<RecordBiasIncidentResponse> {
		await this.ensureActivated();
		return this.request<RecordBiasIncidentResponse>("ai/v1/bias/incidents", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async getFairnessMetrics(
		params: GetFairnessMetricsParams = {},
	): Promise<GetFairnessMetricsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/bias/metrics", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.modelName) url.searchParams.set("modelName", params.modelName);
		if (params.modelId) {
			validateUUID(params.modelId, "modelId");
			url.searchParams.set("modelId", params.modelId);
		}
		if (params.metricName) url.searchParams.set("metricName", params.metricName);
		if (params.startDate) url.searchParams.set("startDate", params.startDate);
		if (params.endDate) url.searchParams.set("endDate", params.endDate);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<GetFairnessMetricsResponse>(url, { method: "GET" });
	}

	async getBiasSummary(tenantId?: string): Promise<BiasSummary> {
		await this.ensureActivated();
		const url = new URL("ai/v1/bias/summary", this.baseUrl);
		if (tenantId) {
			validateUUID(tenantId, "tenantId");
			url.searchParams.set("tenantId", tenantId);
		}
		return this.request<BiasSummary>(url, { method: "GET" });
	}

	async createDetectionPattern(
		request: CreateDetectionPatternRequest,
	): Promise<CreateDetectionPatternResponse> {
		await this.ensureActivated();
		return this.request<CreateDetectionPatternResponse>("ai/v1/security/injection/patterns", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async listPatterns(params: ListPatternsParams = {}): Promise<ListPatternsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/security/injection/patterns", this.baseUrl);
		if (params.patternType) url.searchParams.set("patternType", params.patternType);
		if (params.attackCategory) url.searchParams.set("attackCategory", params.attackCategory);
		if (params.severity) url.searchParams.set("severity", params.severity);
		if (params.enabled !== undefined) url.searchParams.set("enabled", String(params.enabled));
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListPatternsResponse>(url, { method: "GET" });
	}

	async getPattern(patternId: string): Promise<DetectionPattern> {
		await this.ensureActivated();
		validateUUID(patternId, "patternId");
		const result = await this.request<{ pattern: DetectionPattern }>(
			`ai/v1/security/injection/patterns/${patternId}`,
			{ method: "GET" },
		);
		return result.pattern;
	}

	async deletePattern(patternId: string): Promise<{ id: string; deleted: boolean }> {
		await this.ensureActivated();
		validateUUID(patternId, "patternId");
		return this.request<{ id: string; deleted: boolean }>(
			`ai/v1/security/injection/patterns/${patternId}`,
			{ method: "DELETE" },
		);
	}

	async getInjectionIncidents(
		params: ListInjectionIncidentsParams = {},
	): Promise<ListInjectionIncidentsResponse> {
		await this.ensureActivated();
		const url = new URL("ai/v1/security/injection/incidents", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		if (params.attackCategory) url.searchParams.set("attackCategory", params.attackCategory);
		if (params.severity) url.searchParams.set("severity", params.severity);
		if (params.detectionMethod) url.searchParams.set("detectionMethod", params.detectionMethod);
		if (params.actionTaken) url.searchParams.set("actionTaken", params.actionTaken);
		if (params.startDate) url.searchParams.set("startDate", params.startDate);
		if (params.endDate) url.searchParams.set("endDate", params.endDate);
		if (params.cursor) url.searchParams.set("cursor", params.cursor);
		if (typeof params.limit === "number") url.searchParams.set("limit", params.limit.toString());
		return this.request<ListInjectionIncidentsResponse>(url, { method: "GET" });
	}

	async getInjectionStats(params: GetInjectionStatsParams): Promise<InjectionStats> {
		await this.ensureActivated();
		const url = new URL("ai/v1/security/injection/stats", this.baseUrl);
		if (params.tenantId) {
			validateUUID(params.tenantId, "tenantId");
			url.searchParams.set("tenantId", params.tenantId);
		}
		url.searchParams.set("startDate", params.startDate);
		url.searchParams.set("endDate", params.endDate);
		return this.request<InjectionStats>(url, { method: "GET" });
	}

	async getInjectionSummary(tenantId?: string): Promise<InjectionSummary> {
		await this.ensureActivated();
		const url = new URL("ai/v1/security/injection/summary", this.baseUrl);
		if (tenantId) {
			validateUUID(tenantId, "tenantId");
			url.searchParams.set("tenantId", tenantId);
		}
		return this.request<InjectionSummary>(url, { method: "GET" });
	}

	async configureDetection(
		request: ConfigureDetectionRequest,
	): Promise<ConfigureDetectionResponse> {
		await this.ensureActivated();
		return this.request<ConfigureDetectionResponse>("ai/v1/security/injection/configs", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	private async request<T>(path: string | URL, init: RequestInit = {}): Promise<T> {
		const response = await this.requestRaw(path, init);
		if (response.status === 204) {
			return undefined as T;
		}
		return (await response.json()) as T;
	}

	private async requestRaw(path: string | URL, init: RequestInit = {}): Promise<Response> {
		return this.requestRawWithRetry(path, init, 0);
	}

	private async requestRawWithRetry(
		path: string | URL,
		init: RequestInit,
		attempt: number,
	): Promise<Response> {
		const url = typeof path === "string" ? new URL(path, this.baseUrl) : path;
		const headers = new Headers({
			Authorization: `Bearer ${this.apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		});

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers.set("x-qnsp-tenant-id", this.resolvedTenantId);
		}

		if (init.headers) {
			const extra = new Headers(init.headers);
			extra.forEach((value, key) => {
				headers.set(key, value);
			});
		}

		const route = url.pathname;
		const method = (init.method ?? "GET").toUpperCase();
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchImpl(url, {
				...init,
				headers,
			});

			httpStatus = response.status;

			// Handle rate limiting (429) with retry logic
			if (response.status === 429) {
				if (attempt < this.maxRetries) {
					const retryAfterHeader = response.headers.get("Retry-After");
					let delayMs = this.retryDelayMs;

					if (retryAfterHeader) {
						const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
						if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
							delayMs = retryAfterSeconds * 1_000;
						}
					} else {
						// Exponential backoff: 2^attempt * baseDelay, capped at 30 seconds
						delayMs = Math.min(2 ** attempt * this.retryDelayMs, 30_000);
					}

					await new Promise((resolve) => setTimeout(resolve, delayMs));
					return this.requestRawWithRetry(path, init, attempt + 1);
				}

				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new AiOrchestratorError(
					`AI Orchestrator API error: Rate limit exceeded after ${this.maxRetries} retries`,
					429,
				);
			}

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				if (response.status === 401) {
					throw new AiOrchestratorError(
						"QNSP AI Orchestrator API: Authentication failed. " +
							"Verify your token is valid or get a new API key at https://cloud.qnsi.heossi.com/signup " +
							"Docs: https://docs.qnsi.heossi.com/sdk/ai-sdk",
						response.status,
					);
				}
				throw new AiOrchestratorError(
					`AI Orchestrator API error: ${response.status} ${response.statusText}`,
					response.status,
				);
			}

			return response;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			if (this.telemetry) {
				const durationMs = performance.now() - start;
				this.telemetry.record({
					operation: `${method} ${route}`,
					method,
					route,
					target: this.targetService,
					status,
					durationMs,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}
}

export class AiOrchestratorError extends Error {
	public readonly statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = "AiOrchestratorError";
		this.statusCode = statusCode;
	}
}
