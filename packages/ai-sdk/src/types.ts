export interface RegisterArtifactRequest {
	readonly tenantId: string;
	readonly documentId: string;
	readonly version: number;
}

export interface RegisteredArtifact {
	readonly artifactId: string;
	readonly documentId: string;
	readonly version: number;
	readonly sizeBytes: number;
	readonly checksumSha3: string;
	readonly manifestDigest: string;
	readonly signature: {
		readonly provider: string;
		readonly algorithm: string;
		readonly publicKey: string;
		readonly issuedAt: string;
	};
	readonly createdAt: string;
}

export type WorkloadPriority = "low" | "normal" | "high";
export type SchedulingPolicy = "spot" | "on-demand" | "mixed";
export type WorkloadStatus =
	| "pending"
	| "scheduled"
	| "running"
	| "canceling"
	| "succeeded"
	| "failed"
	| "canceled";

export interface WorkloadArtifactBinding {
	readonly artifactId: string;
	readonly mountPath: string;
	readonly accessMode: "read" | "read-write";
}

export interface WorkloadResources {
	readonly cpu: number;
	readonly memoryGiB: number;
	readonly gpu: number;
	readonly acceleratorType: string;
}

export interface WorkloadManifest {
	readonly pqcSignature: string;
	readonly algorithm: string;
	readonly issuedAt: string;
	readonly [key: string]: unknown;
}

export interface VerifiedAttestationEnvelope {
	readonly version: "qnsi.verified-workload-attestation-envelope.v1";
	readonly status: "verified";
	readonly proof: string;
	readonly signature: string;
	readonly provider: string;
	readonly algorithm: string;
	readonly keyId: string;
	readonly issuedAt: string;
	readonly challengeNonce: string;
}

export interface WorkloadSecurityProfile {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: ReadonlyArray<{ provider: string; algorithm: string }>;
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
	readonly attestationEnvelope?: VerifiedAttestationEnvelope | null;
}

export interface ModelPackageManifestFile {
	readonly path: string;
	readonly sizeBytes: number;
	readonly checksumSha3_512: string;
}

export interface ModelPackageManifest {
	readonly modelName: string;
	readonly version: string;
	readonly createdAt: string;
	readonly files: ReadonlyArray<ModelPackageManifestFile>;
	readonly metadata?: Record<string, unknown>;
}

export interface ModelDeploymentRequest {
	readonly tenantId: string;
	readonly modelName: string;
	readonly artifactId: string;
	readonly artifactVersion: number;
	readonly runtimeImage: string;
	readonly command?: readonly string[];
	readonly env?: Record<string, string>;
	readonly resources: WorkloadResources;
	readonly labels?: Record<string, string>;
	readonly manifest: ModelPackageManifest;
	readonly priority?: WorkloadPriority;
	readonly schedulingPolicy?: SchedulingPolicy;
}

export interface InferenceRequest {
	readonly tenantId: string;
	readonly modelDeploymentId: string;
	readonly input: Record<string, unknown>;
	readonly priority?: WorkloadPriority;
}

export interface InferenceResponse {
	readonly inferenceId: string;
	readonly workloadId: string;
	readonly status: WorkloadStatus;
	readonly acceptedAt: string | null;
	readonly replayed: boolean;
}

export interface InferenceStreamEvent {
	readonly id: number;
	readonly type: string;
	readonly payload: Record<string, unknown>;
	readonly createdAt: string;
}

export interface SubmitWorkloadRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly priority: WorkloadPriority;
	readonly schedulingPolicy: SchedulingPolicy;
	readonly containerImage: string;
	readonly command: readonly string[];
	readonly env?: Record<string, string>;
	readonly resources: WorkloadResources;
	readonly artifacts: readonly WorkloadArtifactBinding[];
	readonly manifest: WorkloadManifest;
	readonly labels?: Record<string, string>;
	readonly idempotencyKey?: string;
}

export interface SubmitWorkloadResponse {
	readonly workloadId: string;
	readonly status: WorkloadStatus;
	readonly replayed: boolean;
	readonly acceptedAt: string | null;
}

export interface WorkloadSummary {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly status: WorkloadStatus;
	readonly priority: WorkloadPriority;
	readonly schedulingPolicy: SchedulingPolicy;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly acceptedAt: string | null;
	readonly completedAt: string | null;
	readonly labels: Record<string, string> | null;
	readonly security: WorkloadSecurityProfile;
}

export interface ListWorkloadsResponse {
	readonly items: readonly WorkloadSummary[];
	readonly nextCursor: string | null;
}

export interface WorkloadDetail extends WorkloadSummary {
	readonly manifest: WorkloadManifest;
	readonly resources: WorkloadResources;
	readonly artifacts: readonly WorkloadArtifactBinding[];
	readonly schedulerMetadata: Record<string, unknown> | null;
}

export type ModelProvider =
	| "openai"
	| "anthropic"
	| "google"
	| "meta"
	| "deepseek"
	| "bedrock"
	| "huggingface"
	| "custom";

export type ModelType =
	| "llm"
	| "embedding"
	| "image"
	| "audio"
	| "multimodal"
	| "classification"
	| "regression";

export type ModelStatus = "draft" | "validating" | "active" | "deprecated" | "archived";

export type DeploymentEnvironment = "development" | "staging" | "production";

export type DeploymentStatus =
	| "pending"
	| "deploying"
	| "running"
	| "scaling"
	| "error"
	| "stopped";

export interface ServingConfig {
	readonly maxBatchSize?: number;
	readonly maxConcurrency?: number;
	readonly timeoutMs?: number;
	readonly cachingEnabled?: boolean;
	readonly streamingEnabled?: boolean;
}

export interface PerformanceMetrics {
	readonly avgLatencyMs?: number;
	readonly p99LatencyMs?: number;
	readonly throughputRps?: number;
	readonly errorRate?: number;
}

export interface TrainingMetadata {
	readonly datasetId?: string;
	readonly epochs?: number;
	readonly learningRate?: number;
	readonly trainedAt?: string;
}

export interface RegisterModelRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly version: string;
	readonly provider: ModelProvider;
	readonly modelType: ModelType;
	readonly description?: string;
	readonly baseModelId?: string;
	readonly capabilities?: readonly string[];
	readonly inputSchema?: Record<string, unknown>;
	readonly outputSchema?: Record<string, unknown>;
	readonly trainingMetadata?: TrainingMetadata;
	readonly servingConfig?: ServingConfig;
	readonly tags?: readonly string[];
}

export interface RegisterModelResponse {
	readonly id: string;
	readonly name: string;
	readonly version: string;
	readonly provider: ModelProvider;
	readonly modelType: ModelType;
	readonly status: ModelStatus;
}

export interface Model {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly version: string;
	readonly provider: ModelProvider;
	readonly modelType: ModelType;
	readonly status: ModelStatus;
	readonly description: string | null;
	readonly baseModelId: string | null;
	readonly capabilities: readonly string[];
	readonly inputSchema: Record<string, unknown> | null;
	readonly outputSchema: Record<string, unknown> | null;
	readonly trainingMetadata: TrainingMetadata | null;
	readonly servingConfig: ServingConfig;
	readonly performanceMetrics: PerformanceMetrics | null;
	readonly tags: readonly string[];
	readonly createdBy: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly activatedAt: string | null;
	readonly deprecatedAt: string | null;
}

export interface ListModelsParams {
	readonly tenantId?: string;
	readonly provider?: ModelProvider;
	readonly modelType?: ModelType;
	readonly status?: ModelStatus;
	readonly tag?: string;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListModelsResponse {
	readonly models: readonly Model[];
	readonly nextCursor: string | null;
}

export interface UpdateModelRequest {
	readonly description?: string;
	readonly capabilities?: readonly string[];
	readonly inputSchema?: Record<string, unknown>;
	readonly outputSchema?: Record<string, unknown>;
	readonly servingConfig?: ServingConfig;
	readonly performanceMetrics?: PerformanceMetrics;
	readonly tags?: readonly string[];
}

export interface ActivateModelResponse {
	readonly id: string;
	readonly status: "active";
	readonly activatedAt: string;
}

export interface DeprecateModelResponse {
	readonly id: string;
	readonly status: "deprecated";
	readonly deprecatedAt: string;
}

export interface ResourceAllocation {
	readonly cpu?: number;
	readonly memoryGiB?: number;
	readonly gpu?: number;
	readonly acceleratorType?: string;
}

export interface AutoscalingConfig {
	readonly targetCpuUtilization?: number;
	readonly targetMemoryUtilization?: number;
	readonly scaleUpCooldownSeconds?: number;
	readonly scaleDownCooldownSeconds?: number;
}

export interface HealthCheckConfig {
	readonly path?: string;
	readonly intervalSeconds?: number;
	readonly timeoutSeconds?: number;
	readonly unhealthyThreshold?: number;
}

export interface CreateDeploymentRequest {
	readonly modelId: string;
	readonly tenantId: string;
	readonly environment: DeploymentEnvironment;
	readonly replicas?: number;
	readonly minReplicas?: number;
	readonly maxReplicas?: number;
	readonly resourceAllocation?: ResourceAllocation;
	readonly autoscalingConfig?: AutoscalingConfig;
	readonly healthCheckConfig?: HealthCheckConfig;
}

export interface CreateDeploymentResponse {
	readonly id: string;
	readonly modelId: string;
	readonly environment: DeploymentEnvironment;
	readonly status: DeploymentStatus;
}

export interface Deployment {
	readonly id: string;
	readonly modelId: string;
	readonly tenantId: string;
	readonly environment: DeploymentEnvironment;
	readonly replicas: number;
	readonly minReplicas: number;
	readonly maxReplicas: number;
	readonly status: DeploymentStatus;
	readonly endpointUrl: string | null;
	readonly resourceAllocation: ResourceAllocation;
	readonly autoscalingConfig: AutoscalingConfig | null;
	readonly healthCheckConfig: HealthCheckConfig | null;
	readonly deployedBy: string;
	readonly deployedAt: string;
	readonly lastHealthCheckAt: string | null;
	readonly stoppedAt: string | null;
}

export interface ListDeploymentsParams {
	readonly tenantId?: string;
	readonly modelId?: string;
	readonly environment?: DeploymentEnvironment;
	readonly status?: DeploymentStatus;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListDeploymentsResponse {
	readonly deployments: readonly Deployment[];
	readonly nextCursor: string | null;
}

export type BudgetType = "daily" | "weekly" | "monthly" | "annual" | "total";
export type BudgetStatus = "active" | "exceeded" | "suspended" | "archived";
export type CostAlertType =
	| "threshold_warning"
	| "budget_exceeded"
	| "anomaly_detected"
	| "rate_spike";
export type CostAlertSeverity = "info" | "warning" | "critical";
export type RecommendationType =
	| "model_switch"
	| "caching"
	| "batching"
	| "prompt_optimization"
	| "rate_limiting"
	| "region_change";
export type RecommendationStatus = "pending" | "accepted" | "rejected" | "implemented";
export type ImplementationEffort = "trivial" | "low" | "medium" | "high";
export type RecommendationPriority = "low" | "medium" | "high";

export interface CostSummary {
	readonly today: {
		readonly requests: number;
		readonly costUsd: number;
	};
	readonly thisMonth: {
		readonly requests: number;
		readonly costUsd: number;
	};
	readonly topModels: readonly {
		readonly modelName: string;
		readonly requests: number;
		readonly costUsd: number;
	}[];
	readonly activeBudgets: readonly Budget[];
}

export interface CostAnalyticsSummary {
	readonly totalRequests: number;
	readonly totalInputTokens: number;
	readonly totalOutputTokens: number;
	readonly totalCostUsd: number;
	readonly avgLatencyMs: number;
}

export interface CostAnalyticsTimeSeriesEntry {
	readonly period: string;
	readonly requestCount: number;
	readonly totalInputTokens: number;
	readonly totalOutputTokens: number;
	readonly totalCostInputUsd: number;
	readonly totalCostOutputUsd: number;
	readonly totalCostUsd: number;
	readonly avgLatencyMs: number;
	readonly cacheHitRate: number;
}

export interface CostAnalytics {
	readonly summary: CostAnalyticsSummary;
	readonly timeSeries: readonly CostAnalyticsTimeSeriesEntry[];
}

export interface GetCostAnalyticsParams {
	readonly tenantId?: string;
	readonly modelName?: string;
	readonly provider?: string;
	readonly startDate: string;
	readonly endDate: string;
	readonly groupBy?: "hour" | "day" | "week" | "month";
}

export interface CreateBudgetRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly budgetType: BudgetType;
	readonly limitUsd: number;
	readonly alertThresholdPercent?: number;
	readonly hardLimit?: boolean;
	readonly modelFilter?: readonly string[];
	readonly providerFilter?: readonly string[];
	readonly periodStart: string;
	readonly periodEnd: string;
}

export interface CreateBudgetResponse {
	readonly id: string;
	readonly name: string;
	readonly budgetType: BudgetType;
	readonly limitUsd: number;
	readonly status: BudgetStatus;
}

export interface Budget {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly budgetType: BudgetType;
	readonly limitUsd: number;
	readonly spentUsd: number;
	readonly remainingUsd: number;
	readonly utilizationPercent: number;
	readonly alertThresholdPercent: number;
	readonly hardLimit: boolean;
	readonly modelFilter: readonly string[] | null;
	readonly providerFilter: readonly string[] | null;
	readonly status: BudgetStatus;
	readonly periodStart: string;
	readonly periodEnd: string;
	readonly createdBy: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ListBudgetsParams {
	readonly tenantId?: string;
	readonly status?: BudgetStatus;
	readonly budgetType?: BudgetType;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListBudgetsResponse {
	readonly budgets: readonly Budget[];
	readonly nextCursor: string | null;
}

export interface CostAlert {
	readonly id: string;
	readonly tenantId: string;
	readonly budgetId: string | null;
	readonly alertType: CostAlertType;
	readonly severity: CostAlertSeverity;
	readonly message: string;
	readonly currentSpendUsd: number;
	readonly thresholdUsd: number | null;
	readonly acknowledged: boolean;
	readonly acknowledgedBy: string | null;
	readonly acknowledgedAt: string | null;
	readonly metadata: Record<string, unknown>;
	readonly createdAt: string;
}

export interface ListCostAlertsParams {
	readonly tenantId?: string;
	readonly budgetId?: string;
	readonly alertType?: CostAlertType;
	readonly severity?: CostAlertSeverity;
	readonly acknowledged?: boolean;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListCostAlertsResponse {
	readonly alerts: readonly CostAlert[];
	readonly nextCursor: string | null;
}

export interface OptimizationRecommendation {
	readonly id: string;
	readonly tenantId: string;
	readonly recommendationType: RecommendationType;
	readonly priority: RecommendationPriority;
	readonly title: string;
	readonly description: string;
	readonly estimatedSavingsUsd: number | null;
	readonly estimatedSavingsPercent: number | null;
	readonly affectedModels: readonly string[];
	readonly implementationEffort: ImplementationEffort | null;
	readonly status: RecommendationStatus;
	readonly acceptedBy: string | null;
	readonly acceptedAt: string | null;
	readonly metadata: Record<string, unknown>;
	readonly createdAt: string;
	readonly expiresAt: string | null;
}

export interface ListRecommendationsParams {
	readonly tenantId?: string;
	readonly recommendationType?: RecommendationType;
	readonly status?: RecommendationStatus;
	readonly priority?: RecommendationPriority;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListRecommendationsResponse {
	readonly recommendations: readonly OptimizationRecommendation[];
	readonly nextCursor: string | null;
}

export type EvaluationType =
	| "demographic_parity"
	| "equalized_odds"
	| "calibration"
	| "counterfactual"
	| "custom";

export type EvaluationStatus = "pending" | "running" | "completed" | "failed";
export type BiasSeverity = "none" | "low" | "medium" | "high" | "critical";
export type BiasIncidentType =
	| "threshold_breach"
	| "trend_degradation"
	| "anomalous_output"
	| "user_report";
export type BiasIncidentStatus =
	| "open"
	| "investigating"
	| "mitigating"
	| "resolved"
	| "false_positive";

export interface CreateBiasEvaluationRequest {
	readonly tenantId: string;
	readonly modelId?: string;
	readonly modelName: string;
	readonly evaluationType: EvaluationType;
	readonly protectedAttribute: string;
	readonly sampleSize: number;
	readonly baselineRate?: number;
	readonly config?: Record<string, unknown>;
}

export interface CreateBiasEvaluationResponse {
	readonly id: string;
	readonly modelName: string;
	readonly evaluationType: EvaluationType;
	readonly protectedAttribute: string;
	readonly status: EvaluationStatus;
}

export interface BiasEvaluation {
	readonly id: string;
	readonly tenantId: string;
	readonly modelId: string | null;
	readonly modelName: string;
	readonly evaluationType: EvaluationType;
	readonly protectedAttribute: string;
	readonly status: EvaluationStatus;
	readonly sampleSize: number;
	readonly baselineRate: number | null;
	readonly metrics: Record<string, unknown> | null;
	readonly biasDetected: boolean | null;
	readonly biasSeverity: BiasSeverity | null;
	readonly recommendations: readonly Record<string, unknown>[] | null;
	readonly config: Record<string, unknown>;
	readonly startedAt: string;
	readonly completedAt: string | null;
	readonly createdBy: string;
}

export interface ListEvaluationsParams {
	readonly tenantId?: string;
	readonly modelName?: string;
	readonly modelId?: string;
	readonly evaluationType?: EvaluationType;
	readonly status?: EvaluationStatus;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListEvaluationsResponse {
	readonly evaluations: readonly BiasEvaluation[];
	readonly nextCursor: string | null;
}

export interface StartEvaluationResponse {
	readonly id: string;
	readonly status: "running";
	readonly startedAt: string;
}

export interface BiasIncident {
	readonly id: string;
	readonly tenantId: string;
	readonly modelId: string | null;
	readonly modelName: string;
	readonly incidentType: BiasIncidentType;
	readonly severity: Exclude<BiasSeverity, "none">;
	readonly protectedAttribute: string;
	readonly description: string;
	readonly affectedGroups: readonly string[];
	readonly evidence: Record<string, unknown>;
	readonly status: BiasIncidentStatus;
	readonly resolution: string | null;
	readonly resolvedBy: string | null;
	readonly resolvedAt: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface RecordBiasIncidentRequest {
	readonly tenantId: string;
	readonly modelId?: string;
	readonly modelName: string;
	readonly incidentType: BiasIncidentType;
	readonly severity: Exclude<BiasSeverity, "none">;
	readonly protectedAttribute: string;
	readonly description: string;
	readonly affectedGroups?: readonly string[];
	readonly evidence?: Record<string, unknown>;
}

export interface RecordBiasIncidentResponse {
	readonly id: string;
	readonly modelName: string;
	readonly incidentType: BiasIncidentType;
	readonly severity: Exclude<BiasSeverity, "none">;
	readonly status: BiasIncidentStatus;
}

export interface ListBiasIncidentsParams {
	readonly tenantId?: string;
	readonly modelName?: string;
	readonly modelId?: string;
	readonly incidentType?: BiasIncidentType;
	readonly severity?: Exclude<BiasSeverity, "none">;
	readonly status?: BiasIncidentStatus;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListBiasIncidentsResponse {
	readonly incidents: readonly BiasIncident[];
	readonly nextCursor: string | null;
}

export interface FairnessMetric {
	readonly id: string;
	readonly tenantId: string;
	readonly modelId: string | null;
	readonly modelName: string;
	readonly metricName: string;
	readonly metricValue: number;
	readonly thresholdMin: number | null;
	readonly thresholdMax: number | null;
	readonly withinThreshold: boolean;
	readonly groupALabel: string;
	readonly groupASize: number;
	readonly groupARate: number;
	readonly groupBLabel: string;
	readonly groupBSize: number;
	readonly groupBRate: number;
	readonly disparityRatio: number | null;
	readonly evaluationId: string | null;
	readonly metadata: Record<string, unknown>;
	readonly recordedAt: string;
}

export interface GetFairnessMetricsParams {
	readonly tenantId?: string;
	readonly modelName?: string;
	readonly modelId?: string;
	readonly metricName?: string;
	readonly startDate?: string;
	readonly endDate?: string;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface GetFairnessMetricsResponse {
	readonly metrics: readonly FairnessMetric[];
	readonly nextCursor: string | null;
}

export interface BiasSummary {
	readonly evaluations: {
		readonly total: number;
		readonly completed: number;
		readonly biasDetected: number;
	};
	readonly incidents: {
		readonly total: number;
		readonly open: number;
		readonly critical: number;
		readonly high: number;
	};
	readonly metricsLast30Days: {
		readonly total: number;
		readonly violations: number;
		readonly avgDisparityRatio: number | null;
	};
	readonly recentOpenIncidents: readonly BiasIncident[];
}

export type InjectionPatternType = "regex" | "keyword" | "semantic" | "behavioral" | "heuristic";
export type InjectionAttackCategory =
	| "jailbreak"
	| "data_exfiltration"
	| "prompt_leak"
	| "instruction_override"
	| "system_prompt_extraction"
	| "context_manipulation"
	| "indirect_injection";
export type InjectionSeverity = "low" | "medium" | "high" | "critical";
export type InjectionDetectionMode = "block" | "sanitize" | "flag" | "monitor";
export type InjectionSensitivityLevel = "low" | "medium" | "high" | "paranoid";
export type InjectionActionTaken = "blocked" | "sanitized" | "flagged" | "allowed_with_warning";

export interface CreateDetectionPatternRequest {
	readonly patternType: InjectionPatternType;
	readonly patternName: string;
	readonly patternValue: string;
	readonly severity: InjectionSeverity;
	readonly description: string;
	readonly attackCategory: InjectionAttackCategory;
	readonly mitreTechniqueId?: string;
	readonly examples?: readonly Record<string, unknown>[];
	readonly enabled?: boolean;
}

export interface CreateDetectionPatternResponse {
	readonly id: string;
	readonly patternName: string;
	readonly patternType: InjectionPatternType;
	readonly attackCategory: InjectionAttackCategory;
	readonly enabled: boolean;
}

export interface DetectionPattern {
	readonly id: string;
	readonly patternType: InjectionPatternType;
	readonly patternName: string;
	readonly patternValue: string;
	readonly severity: InjectionSeverity;
	readonly description: string;
	readonly falsePositiveRate: number | null;
	readonly enabled: boolean;
	readonly attackCategory: InjectionAttackCategory;
	readonly mitreTechniqueId: string | null;
	readonly examples: readonly Record<string, unknown>[];
	readonly createdBy: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ListPatternsParams {
	readonly patternType?: InjectionPatternType;
	readonly attackCategory?: InjectionAttackCategory;
	readonly severity?: InjectionSeverity;
	readonly enabled?: boolean;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListPatternsResponse {
	readonly patterns: readonly DetectionPattern[];
	readonly nextCursor: string | null;
}

export interface InjectionIncident {
	readonly id: string;
	readonly tenantId: string;
	readonly requestId: string;
	readonly modelName: string;
	readonly detectionMethod: string;
	readonly attackCategory: InjectionAttackCategory;
	readonly severity: InjectionSeverity;
	readonly confidenceScore: number;
	/** Reported or rule-based score, not independently calibrated confidence. */
	readonly confidenceBasis?: "unverified_score";
	readonly evidenceSource?: "legacy_unverified" | "analysis_only" | "caller_reported";
	readonly reportedBy?: string | null;
	readonly effectsVerified?: false;
	readonly matchedPatterns: readonly string[];
	readonly actionTaken: InjectionActionTaken;
	readonly promptHash: string;
	readonly promptSnippet: string | null;
	readonly sourceIp: string | null;
	readonly userAgent: string | null;
	readonly principalId: string | null;
	readonly responseStatus: "blocked" | "modified" | "passed" | null;
	readonly metadata: Record<string, unknown>;
	readonly createdAt: string;
}

export interface ListInjectionIncidentsParams {
	readonly tenantId?: string;
	readonly attackCategory?: InjectionAttackCategory;
	readonly severity?: InjectionSeverity;
	readonly detectionMethod?: string;
	readonly actionTaken?: InjectionActionTaken;
	readonly startDate?: string;
	readonly endDate?: string;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface ListInjectionIncidentsResponse {
	readonly incidents: readonly InjectionIncident[];
	readonly nextCursor: string | null;
}

export interface InjectionStats {
	/** Counts retain reported actions; they do not establish executed effects. */
	readonly evidenceBasis?: "reported_or_analysis_only";
	readonly confidenceBasis?: "unverified_score";
	readonly effectsVerified?: false;
	readonly periodStart: string;
	readonly periodEnd: string;
	readonly totalRequests: number;
	readonly blockedRequests: number;
	readonly sanitizedRequests: number;
	readonly flaggedRequests: number;
	readonly avgConfidenceScore: number | null;
	readonly attacksByCategory: Record<InjectionAttackCategory, number>;
	readonly attacksBySeverity: Record<InjectionSeverity, number>;
	readonly topPatterns: readonly {
		readonly pattern: string;
		readonly count: number;
	}[];
}

export interface GetInjectionStatsParams {
	readonly tenantId?: string;
	readonly startDate: string;
	readonly endDate: string;
}

export interface ConfigureDetectionRequest {
	readonly tenantId: string;
	readonly enabled?: boolean;
	readonly detectionMode?: InjectionDetectionMode;
	readonly sensitivityLevel?: InjectionSensitivityLevel;
	readonly mlClassifierEnabled?: boolean;
	readonly semanticAnalysisEnabled?: boolean;
	readonly heuristicChecksEnabled?: boolean;
	readonly customPatterns?: readonly Record<string, unknown>[];
	readonly allowlistPatterns?: readonly Record<string, unknown>[];
	readonly maxPromptLength?: number;
	readonly rateLimitSuspicious?: number;
	readonly webhookUrl?: string;
}

export interface ConfigureDetectionResponse {
	readonly id: string;
	readonly enabled: boolean;
	readonly detectionMode: InjectionDetectionMode;
	readonly sensitivityLevel: InjectionSensitivityLevel;
}

export interface InjectionSummary {
	readonly config: {
		readonly enabled: boolean;
		readonly detectionMode: InjectionDetectionMode;
		readonly sensitivityLevel: InjectionSensitivityLevel;
	} | null;
	readonly today: {
		readonly total: number;
		readonly blocked: number;
	};
	readonly thisWeek: {
		readonly total: number;
		readonly blocked: number;
	};
	readonly recentIncidents: readonly InjectionIncident[];
}
