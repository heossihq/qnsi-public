import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

/**
 * `@heossi/qnsi/autogen` — AutoGen function executor for QNSP.
 *
 * Submits code workloads to QNSP AI orchestrator enclaves with PQC
 * attestation. Folded in from the former standalone
 * `@heossi/qnsi-autogen-qnsp` package (2026-05-16).
 *
 * @example
 * ```typescript
 * import { QnsiExecutor } from "@heossi/qnsi/autogen";
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
