import { bridgeQnsiEnv } from "../../internal/env-aliases.js";
import type { CliConfig } from "../config.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

export interface AuditLogEntry {
	readonly timestamp: string;
	readonly action: string;
	readonly actor: string;
	readonly resource?: string;
	readonly result: "success" | "failure";
	readonly metadata?: Record<string, unknown>;
}

export class AuditLogger {
	private readonly config: CliConfig;
	private readonly enabled: boolean;

	constructor(config: CliConfig) {
		this.config = config;
		this.enabled = process.env["QNSI_CLI_AUDIT_LOGGING"] === "true";
	}

	async log(entry: Omit<AuditLogEntry, "timestamp">): Promise<void> {
		if (!this.enabled) {
			return;
		}

		const fullEntry: AuditLogEntry = {
			timestamp: new Date().toISOString(),
			...entry,
		};

		try {
			const response = await fetch(`${this.config.auditServiceUrl}/audit/v1/events`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-qnsp-tenant": this.config.tenantId ?? "",
				},
				body: JSON.stringify({
					topic: "cli.operation",
					sourceService: "qnsp-cli",
					...fullEntry,
				}),
			});

			if (!response.ok) {
				console.error(`Failed to log audit event: ${response.status}`);
			}
		} catch (error) {
			console.error(
				"Audit logging failed:",
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	async logCommand(
		command: string,
		args: string[],
		result: "success" | "failure",
		metadata?: Record<string, unknown>,
	): Promise<void> {
		await this.log({
			action: `cli.${command}`,
			actor: this.config.serviceId ?? "unknown",
			resource: args.join(" "),
			result,
			metadata: {
				...metadata,
				command,
				args,
				version: "0.1.0",
			},
		});
	}
}
