/**
 * QNSP Toolkit for LangChain
 *
 * A pre-configured set of QNSP tools for governed AI agents.
 * Provides PQC-encrypted secrets, quantum-safe signing, and immutable audit trails
 * as a single composable toolkit.
 *
 * @example
 * ```typescript
 * import { QnsiToolkit } from "@heossihq/qnsi-langchain-qnsp";
 * import { ChatOpenAI } from "@langchain/openai";
 * import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
 *
 * const toolkit = new QnsiToolkit({
 *   apiKey: process.env.QNSI_API_KEY,
 * });
 *
 * const agent = createToolCallingAgent({
 *   llm: new ChatOpenAI({ model: "gpt-4o" }),
 *   tools: toolkit.getTools(),
 *   prompt,
 * });
 * ```
 */

import type { StructuredTool } from "@langchain/core/tools";
import { activateSdk } from "../_activation/index.js";
import { bridgeQnsiEnv } from "../internal/env-aliases.js";
import type { QnsiAuditToolConfig } from "./tools/audit.js";
import { QnsiLogAgentActionTool } from "./tools/audit.js";
import type { QnsiKmsToolConfig } from "./tools/kms.js";
import { QnsiSignDataTool, QnsiVerifySignatureTool } from "./tools/kms.js";
import { QnsiReadSecretTool, QnsiRotateSecretTool, QnsiWriteSecretTool } from "./tools/vault.js";
import { VaultClient } from "./vault-client.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

const SDK_VERSION = "0.3.0";

export interface QnsiToolkitConfig {
	/**
	 * QNSP API key. Get one at https://cloud.qnsi.heossi.com/api-keys
	 * The API key carries the tenant ID - no separate tenantId needed.
	 */
	readonly apiKey: string;
	/**
	 * Tenant ID. Required for KMS and audit operations.
	 * If omitted, defaults to empty string (tenant resolved from API key by edge gateway).
	 */
	readonly tenantId?: string;
	/**
	 * Base URL for the QNSP API.
	 * Defaults to https://api.qnsi.heossi.com
	 */
	readonly baseUrl?: string;
	/**
	 * Request timeout in milliseconds.
	 * Defaults to 15000 (15 seconds).
	 */
	readonly timeoutMs?: number;
	/**
	 * Which tool categories to include.
	 * Defaults to all categories.
	 */
	readonly include?: ReadonlyArray<"vault" | "kms" | "audit">;
}

/**
 * QNSP Toolkit - a composable set of LangChain tools for governed AI agents.
 *
 * Provides:
 * - Vault tools: read, write, and rotate PQC-encrypted secrets
 * - KMS tools: sign and verify data with quantum-safe algorithms
 * - Audit tools: write immutable, PQC-signed audit events
 */
export class QnsiToolkit {
	readonly #apiKey: string;
	#tenantId: string;
	readonly #baseUrl: string;
	readonly #timeoutMs: number;
	readonly #include: ReadonlyArray<"vault" | "kms" | "audit">;
	readonly #vaultClient: VaultClient;
	#activated: boolean = false;

	constructor(config: QnsiToolkitConfig) {
		this.#apiKey = config.apiKey;
		this.#tenantId = config.tenantId ?? "";
		this.#baseUrl = config.baseUrl ?? "https://api.qnsi.heossi.com";
		this.#timeoutMs = config.timeoutMs ?? 15_000;
		this.#include = config.include ?? ["vault", "kms", "audit"];

		this.#vaultClient = new VaultClient({
			baseUrl: this.#baseUrl,
			apiKey: this.#apiKey,
			timeoutMs: this.#timeoutMs,
		});
	}

	/**
	 * One-shot activation handshake against billing-service. Validates the API
	 * key, captures tenantId + tier, caches the activation token. Required:
	 * call `await toolkit.activate()` before `toolkit.getTools()` - `getTools()`
	 * throws otherwise.
	 *
	 * Idempotent - repeat calls are cheap (cached) and only re-fetch when the
	 * activation token approaches expiry.
	 */
	async activate(): Promise<void> {
		const activation = await activateSdk({
			apiKey: this.#apiKey,
			sdkId: "langchain-qnsi",
			sdkVersion: SDK_VERSION,
			platformUrl: this.#baseUrl,
		});
		// If the caller did not specify tenantId, inherit it from activation
		// so KMS and audit tools have a tenant-scoped header without an extra
		// constructor argument.
		if (this.#tenantId === "") {
			this.#tenantId = activation.tenantId;
		}
		// Inject the resolved tenant into the inlined vault client so its
		// requests carry the x-qnsp-tenant-id header (the former
		// @heossihq/qnsi-vault-sdk did this via its own internal activation;
		// here the single langchain-qnsp activation covers it).
		this.#vaultClient.setTenantId(this.#tenantId);
		this.#activated = true;
	}

	#assertActivated(): void {
		if (!this.#activated) {
			throw new Error(
				"@heossihq/qnsi-langchain-qnsp: call `await toolkit.activate()` once before `getTools()`. " +
					"This validates your QNSP API key and resolves the tenant ID. " +
					"Free signup (no credit card): https://cloud.qnsi.heossi.com/auth",
			);
		}
	}

	/** Returns all configured QNSP tools for use with a LangChain agent. */
	getTools(): StructuredTool[] {
		this.#assertActivated();
		const tools: StructuredTool[] = [];

		if (this.#include.includes("vault")) {
			tools.push(...this.getVaultTools());
		}
		if (this.#include.includes("kms")) {
			tools.push(...this.getKmsTools());
		}
		if (this.#include.includes("audit")) {
			tools.push(...this.getAuditTools());
		}

		return tools;
	}

	/** Returns only the vault tools (read, write, rotate secrets). */
	getVaultTools(): StructuredTool[] {
		this.#assertActivated();
		return [
			new QnsiReadSecretTool(this.#vaultClient),
			new QnsiWriteSecretTool(this.#vaultClient),
			new QnsiRotateSecretTool(this.#vaultClient),
		];
	}

	/** Returns only the KMS tools (sign, verify). */
	getKmsTools(): StructuredTool[] {
		this.#assertActivated();
		const kmsConfig: QnsiKmsToolConfig = {
			baseUrl: this.#baseUrl,
			apiKey: this.#apiKey,
			tenantId: this.#tenantId,
			timeoutMs: this.#timeoutMs,
		};
		return [new QnsiSignDataTool(kmsConfig), new QnsiVerifySignatureTool(kmsConfig)];
	}

	/** Returns only the audit tool (log agent actions). */
	getAuditTools(): StructuredTool[] {
		this.#assertActivated();
		const auditConfig: QnsiAuditToolConfig = {
			baseUrl: this.#baseUrl,
			apiKey: this.#apiKey,
			tenantId: this.#tenantId,
			timeoutMs: this.#timeoutMs,
		};
		return [new QnsiLogAgentActionTool(auditConfig)];
	}

	/** True once `activate()` has resolved successfully. */
	get isActivated(): boolean {
		return this.#activated;
	}
}
