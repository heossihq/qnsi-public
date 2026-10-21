export interface SearchSecurityEnvelope {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: ReadonlyArray<{
		readonly provider: string;
		readonly algorithm: string;
		readonly value: string;
		readonly publicKey: string;
	}>;
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
}

export interface IndexDocumentRequest {
	readonly tenantId: string;
	readonly documentId: string;
	readonly version: string;
	readonly sourceService: string;
	readonly title?: string | null;
	readonly description?: string | null;
	readonly body?: string | null;
	readonly tags?: readonly string[];
	readonly language?: string;
	readonly metadata?: Record<string, unknown>;
	readonly security: SearchSecurityEnvelope;
	readonly signature: {
		readonly provider: string;
		readonly algorithm: string;
		readonly value: string;
		readonly publicKey: string;
	};
	readonly sseTokens?: readonly string[];
}

export interface SearchQueryRequest {
	readonly tenantId: string;
	readonly query?: string;
	readonly limit?: number;
	readonly cursor?: string | null;
	readonly language?: string;
	readonly sseTokens?: readonly string[];
}

export interface SearchDocumentHit {
	readonly tenantId: string;
	readonly documentId: string;
	readonly version: string;
	readonly title: string | null;
	readonly description: string | null;
	readonly tags: string[];
	readonly metadata: Record<string, unknown>;
	readonly score: number;
	readonly updatedAt: string;
}

export interface SearchQueryResponse {
	readonly items: SearchDocumentHit[];
	readonly nextCursor: string | null;
}

/**
 * Query Analytics Types
 */

export interface RecordQueryRequest {
	readonly tenantId: string;
	readonly query: string;
	readonly resultCount: number;
	readonly latencyMs: number;
	readonly source?: string;
	readonly userId?: string;
	readonly clickedDocumentIds?: readonly string[];
	readonly metadata?: Record<string, unknown>;
}

export interface QueryMetricsRequest {
	readonly tenantId?: string;
	readonly since?: string;
	readonly until?: string;
	readonly groupBy?: "hour" | "day" | "week" | "month";
}

export interface QueryMetrics {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly totalQueries: number;
	readonly uniqueQueries: number;
	readonly avgLatencyMs: number;
	readonly p50LatencyMs: number;
	readonly p95LatencyMs: number;
	readonly p99LatencyMs: number;
	readonly avgResultCount: number;
	readonly zeroResultRate: number;
	readonly clickThroughRate: number;
	readonly timeSeries: readonly {
		readonly timestamp: string;
		readonly queries: number;
		readonly avgLatencyMs: number;
	}[];
}

export interface SearchQualityRequest {
	readonly tenantId?: string;
	readonly since?: string;
	readonly until?: string;
}

export interface SearchQuality {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly relevanceScore: number;
	readonly precisionAtK: {
		readonly k1: number;
		readonly k5: number;
		readonly k10: number;
	};
	readonly meanReciprocalRank: number;
	readonly normalizedDCG: number;
	readonly clickThroughRate: number;
	readonly abandonmentRate: number;
	readonly refinementRate: number;
}

export interface TopQueriesRequest {
	readonly tenantId?: string;
	readonly since?: string;
	readonly until?: string;
	readonly limit?: number;
	readonly zeroResultsOnly?: boolean;
}

export interface TopQuery {
	readonly query: string;
	readonly count: number;
	readonly avgLatencyMs: number;
	readonly avgResultCount: number;
	readonly clickThroughRate: number;
}

export interface TopQueriesResponse {
	readonly items: readonly TopQuery[];
}

/**
 * Synonym Management Types
 */

export type SynonymSerializationFormat = "csv" | "json" | "solr";

/**
 * Stable SDK synonym representation. The client maps the service's `terms` and
 * `enabled` fields to the published `synonyms` and `isExpanded` fields.
 */
export interface SynonymGroup {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly synonyms: readonly string[];
	readonly isExpanded: boolean;
	readonly language?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateSynonymGroupRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly synonyms: readonly string[];
	readonly isExpanded?: boolean;
	readonly language?: string;
}

export interface UpdateSynonymGroupRequest {
	readonly name?: string;
	readonly description?: string;
	readonly synonyms?: readonly string[];
	readonly isExpanded?: boolean;
	readonly language?: string;
}

export interface ListSynonymGroupsRequest {
	readonly tenantId: string;
	readonly language?: string;
	readonly limit?: number;
	/** Nonnegative decimal offset encoded as a cursor. */
	readonly cursor?: string;
}

export interface ListSynonymGroupsResponse {
	readonly items: readonly SynonymGroup[];
	readonly nextCursor: string | null;
}

export interface ExpandTermRequest {
	readonly tenantId: string;
	readonly term: string;
	readonly language?: string;
}

export interface ExpandTermResponse {
	readonly originalTerm: string;
	readonly expandedTerms: readonly string[];
	readonly matchedGroups: readonly string[];
}

export interface ImportSynonymsRequest {
	readonly tenantId: string;
	readonly format: SynonymSerializationFormat;
	/** JSON imports contain a nonempty array of mounted service group objects. */
	readonly data: string;
	readonly replaceExisting?: boolean;
	readonly language?: string;
}

export interface ImportSynonymsResponse {
	readonly imported: number;
	readonly skipped: number;
	readonly errors: readonly string[];
}

export interface ExportSynonymsRequest {
	readonly tenantId: string;
	readonly format: SynonymSerializationFormat;
	readonly language?: string;
}

export interface ExportSynonymsResponse {
	readonly data: string;
	readonly count: number;
	readonly format: SynonymSerializationFormat;
}

/**
 * Index Health Types
 */

export type IndexHealthStatus = "unknown";
export type ReportedIndexAssessment = "healthy" | "degraded" | "unhealthy";
export type HealthAlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type HealthAlertStatus = "active" | "acknowledged" | "resolved";
export type IndexAlertType =
	| "high_fragmentation"
	| "slow_query"
	| "index_lag"
	| "size_threshold"
	| "error_rate"
	| "replication_lag"
	| "memory_pressure"
	| "disk_usage"
	| "custom";

export interface IndexHealthSnapshot {
	readonly id: string;
	readonly tenantId: string;
	readonly indexId: string;
	readonly indexName: string;
	readonly healthStatus: "unknown";
	readonly actualHealthStatus: "unknown";
	readonly reportedAssessment: ReportedIndexAssessment;
	readonly verificationStatus: "unverified";
	readonly measurementSource: "client_reported";
	readonly totalDocuments: number | null;
	readonly totalDocumentsExact: string;
	readonly totalSizeBytes: number | null;
	readonly totalSizeBytesExact: string;
	readonly indexSizeBytes: number | null;
	readonly indexSizeBytesExact: string;
	readonly fragmentationPercent: number;
	readonly avgDocumentSizeBytes: number | null;
	readonly lastIndexedAt: string | null;
	readonly lastOptimizedAt: string | null;
	readonly searchLatencyP50Ms: number | null;
	readonly searchLatencyP95Ms: number | null;
	readonly searchLatencyP99Ms: number | null;
	readonly indexLatencyP50Ms: number | null;
	readonly indexLatencyP95Ms: number | null;
	readonly errorRate: number | null;
	readonly metadata: Readonly<Record<string, unknown>>;
	readonly collectedAt: string;
}

export interface RecordHealthSnapshotRequest {
	readonly tenantId: string;
	readonly indexId: string;
	readonly indexName: string;
	readonly totalDocuments: number | string;
	readonly totalSizeBytes: number | string;
	readonly indexSizeBytes: number | string;
	readonly fragmentationPercent: number;
	readonly avgDocumentSizeBytes?: number | null;
	readonly lastIndexedAt?: string | null;
	readonly lastOptimizedAt?: string | null;
	readonly searchLatencyP50Ms?: number | null;
	readonly searchLatencyP95Ms?: number | null;
	readonly searchLatencyP99Ms?: number | null;
	readonly indexLatencyP50Ms?: number | null;
	readonly indexLatencyP95Ms?: number | null;
	readonly errorRate?: number | null;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GetIndexHealthRequest {
	readonly tenantId: string;
}

export interface CurrentIndexHealth {
	readonly tenantId: string;
	readonly overallStatus: "unknown";
	readonly actualHealthStatus: "unknown";
	readonly verificationStatus: "unverified";
	readonly summary: {
		readonly totalIndices: number;
		readonly actualHealthStatus: "unknown";
		readonly reportedAssessmentCounts: Readonly<Record<ReportedIndexAssessment, number>>;
		readonly activeReportedAlerts: number;
	};
	readonly indices: readonly IndexHealthSnapshot[];
	readonly alerts: readonly HealthAlert[];
}

export interface HealthAlert {
	readonly id: string;
	readonly tenantId: string;
	readonly indexId: string | null;
	readonly indexName: string;
	readonly alertType: IndexAlertType;
	readonly severity: HealthAlertSeverity;
	readonly status: HealthAlertStatus;
	readonly message: string;
	readonly thresholdValue: number | null;
	readonly currentValue: number | null;
	readonly metadata: Readonly<Record<string, unknown>>;
	readonly reportingSource: "client_reported";
	readonly verificationStatus: "unverified";
	readonly triggeredAt: string;
	readonly acknowledgedAt: string | null;
	readonly acknowledgedBy: string | null;
	readonly acknowledgedNotes: string | null;
	readonly resolvedAt: string | null;
	readonly resolvedBy: string | null;
	readonly resolutionNotes: string | null;
}

export interface ListHealthAlertsRequest {
	readonly tenantId?: string;
	readonly status?: HealthAlertStatus;
	readonly severity?: HealthAlertSeverity;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface ListHealthAlertsResponse {
	readonly items: readonly HealthAlert[];
	readonly nextCursor: string | null;
}

export interface AcknowledgeAlertRequest {
	readonly alertId: string;
	readonly tenantId: string;
	readonly notes?: string;
}

export type MaintenanceType =
	| "optimize"
	| "reindex"
	| "vacuum"
	| "compact"
	| "analyze"
	| "backup"
	| "restore";
export type MaintenanceScheduleStatus =
	| "scheduled"
	| "overdue"
	| "cancelled"
	| "recorded_in_progress"
	| "recorded_completed";

export interface MaintenanceWindow {
	readonly id: string;
	readonly tenantId: string;
	readonly indexId: string | null;
	readonly indexName: string | null;
	readonly maintenanceType: MaintenanceType;
	readonly scheduledAt: string;
	readonly estimatedDurationMinutes: number | null;
	readonly scheduleStatus: MaintenanceScheduleStatus;
	readonly executionStatus: "unavailable" | "unverified_record";
	readonly executionStatusReason: string;
	readonly recordedStartedAt: string | null;
	readonly recordedCompletedAt: string | null;
	readonly metadata: Readonly<Record<string, unknown>>;
	readonly createdAt: string;
	readonly createdBy: string | null;
	readonly cancelledAt: string | null;
	readonly cancelledBy: string | null;
	readonly observedAt: string;
}

export interface CreateMaintenanceWindowRequest {
	readonly tenantId: string;
	readonly indexId: string;
	readonly indexName: string;
	readonly maintenanceType: MaintenanceType;
	readonly scheduledAt: string;
	readonly estimatedDurationMinutes?: number;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Isolation Types
 */

export type IsolationLevel = "strict" | "standard" | "relaxed";
export type IsolationPolicyStatus = "active" | "paused" | "disabled";

export interface IsolationPolicy {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly level: IsolationLevel;
	readonly status: IsolationPolicyStatus;
	readonly rules: readonly {
		readonly field: string;
		readonly operator: "equals" | "not_equals" | "contains" | "not_contains";
		readonly value: string;
	}[];
	readonly enforcementMode: "audit" | "enforce";
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateIsolationPolicyRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly level: IsolationLevel;
	readonly rules?: readonly {
		readonly field: string;
		readonly operator: "equals" | "not_equals" | "contains" | "not_contains";
		readonly value: string;
	}[];
	readonly enforcementMode?: "audit" | "enforce";
}

export interface ListIsolationPoliciesRequest {
	readonly tenantId?: string;
	readonly status?: IsolationPolicyStatus;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface ListIsolationPoliciesResponse {
	readonly items: readonly IsolationPolicy[];
	readonly nextCursor: string | null;
}

export interface IsolationViolation {
	readonly id: string;
	readonly tenantId: string;
	readonly policyId: string;
	readonly severity: "low" | "medium" | "high" | "critical";
	readonly description: string;
	readonly query?: string;
	readonly documentIds?: readonly string[];
	readonly detectedAt: string;
	readonly resolvedAt?: string;
}

export interface ReportViolationRequest {
	readonly tenantId: string;
	readonly policyId: string;
	readonly severity: "low" | "medium" | "high" | "critical";
	readonly description: string;
	readonly query?: string;
	readonly documentIds?: readonly string[];
}

export interface IsolationVerificationResult {
	readonly runId: string;
	readonly tenantId: string;
	readonly status: "running" | "completed" | "failed";
	readonly totalChecks: number;
	readonly passedChecks: number;
	readonly failedChecks: number;
	readonly violations: readonly IsolationViolation[];
	readonly startedAt: string;
	readonly completedAt?: string;
}

export interface RunIsolationVerificationRequest {
	readonly tenantId: string;
	readonly policyIds?: readonly string[];
	readonly sampleSize?: number;
}
