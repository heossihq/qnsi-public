import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept canonical environment variables and legacy-prefixed aliases.
bridgeQnsiEnv();

/**
 * `@heossihq/qnsi/autogen` - AutoGen function executor for QNSI.
 *
 * Submits code workloads to QNSI AI orchestrator enclaves with PQC
 * attestation. Folded in from the former standalone
 * `former standalone AutoGen integration package` package (2026-05-16).
 *
 * @example
 * ```typescript
 * import { QnsiExecutor } from "@heossihq/qnsi/autogen";
 *
 * const executor = new QnsiExecutor({ apiKey: process.env.QNSI_API_KEY });
 * const result = await executor.execute({ code: "print('Hello')", language: "python" });
 * ```
 */

export type {
	ExecuteCodeRequest,
	ExecuteCodeResult,
	QnsiExecutorConfig,
	SubmitWorkloadRequest,
	WorkloadDetail,
	WorkloadStatus,
} from "./executor.js";
export { QnsiExecutor } from "./executor.js";
