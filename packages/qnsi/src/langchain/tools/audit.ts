/**
 * QNSP Audit Tool for LangChain
 *
 * Provides governed agents with immutable, PQC-signed audit trail logging.
 * Every agent action logged here is tamper-evident and cryptographically chained.
 */

import { StructuredTool, type ToolParams } from "@langchain/core/tools";
import { z } from "zod";

export interface QnsiAuditToolConfig {
	/** Base URL for the QNSP API (e.g. https://api.qnsi.heossi.com) */
	readonly baseUrl: string;
	/** API key or Bearer token for authentication */
	readonly apiKey: string;
	/** Tenant ID for all audit events */
	readonly tenantId: string;
	/** Request timeout in milliseconds (default: 15000) */
	readonly timeoutMs?: number;
}

// ─── Log Agent Action ─────────────────────────────────────────────────────────

const logAgentActionSchema = z.object({
	topic: z
		.string()
		.min(1)
		.max(255)
		.describe(
			"The audit topic / event type (e.g. 'agent.decision', 'agent.tool_call', 'agent.output')",
		),
	sourceService: z
		.string()
		.min(1)
		.max(255)
		.describe("The name of the agent or service emitting this event (e.g. 'research-agent')"),
	payload: z
		.record(z.string(), z.unknown())
		.describe(
			"Structured data describing the action - what the agent did, inputs, outputs, reasoning",
		),
	metadata: z
		.record(z.string(), z.unknown())
		.optional()
		.describe("Optional metadata: run ID, model name, token counts, latency, etc."),
});

/**
 * LangChain tool that writes an immutable, PQC-signed audit event to QNSP.
 * Use this to create a tamper-evident record of every significant agent action.
 */
export class QnsiLogAgentActionTool extends StructuredTool {
	override readonly name = "qnsp_log_agent_action";
	override readonly description =
		"Write an immutable, PQC-signed audit event to QNSP. Creates a tamper-evident record of agent actions, decisions, tool calls, and outputs. Use this for compliance, governance, and traceability of agent behavior.";
	override readonly schema = logAgentActionSchema;

	readonly #config: Required<QnsiAuditToolConfig>;

	constructor(config: QnsiAuditToolConfig, fields?: ToolParams) {
		super(fields);
		this.#config = { timeoutMs: 15_000, ...config };
	}

	protected async _call(input: z.infer<typeof logAgentActionSchema>): Promise<string> {
		const url = `${this.#config.baseUrl}/proxy/audit/v1/events`;
		const event: Record<string, unknown> = {
			tenantId: this.#config.tenantId,
			sourceService: input.sourceService,
			topic: input.topic,
			version: "1.0",
			payload: input.payload,
		};
		if (input.metadata !== undefined) {
			event["metadata"] = input.metadata;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.#config.apiKey}`,
				"x-qnsp-tenant-id": this.#config.tenantId,
			},
			body: JSON.stringify({ events: [event] }),
			signal: AbortSignal.timeout(this.#config.timeoutMs),
		});

		if (!response.ok) {
			const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
			throw new Error(
				`Audit ingest failed (${response.status}): ${String(err["message"] ?? "unknown error")}`,
			);
		}

		const result = (await response.json()) as Record<string, unknown>;
		return JSON.stringify({
			accepted: result["accepted"],
			received: result["received"],
			topic: input.topic,
			sourceService: input.sourceService,
			loggedAt: new Date().toISOString(),
		});
	}
}
