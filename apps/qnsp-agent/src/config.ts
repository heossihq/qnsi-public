/**
 * QNSP Agent Configuration
 *
 * Loaded from environment variables or a config file at:
 *   /etc/qnsp-agent/config.env  (Linux/macOS system install)
 *   ./qnsp-agent.env            (local/dev)
 *
 * Required:
 *   QNSP_AGENT_ID       - UUID of the registered agent (from `qnsp-agent register`)
 *   QNSP_AGENT_SECRET   - Bootstrap secret returned at registration (hex, 64 chars)
 *   QNSP_ENDPOINT       - Base URL of the QNSP edge gateway (e.g. https://api.qnsi.heossi.com)
 *   QNSP_TENANT_ID      - Tenant UUID
 *
 * Optional:
 *   QNSP_SCAN_PATHS     - Comma-separated paths to scan (default: /etc/ssl,/home,/root,/var/lib)
 *   QNSP_INTERVAL_SECS  - Report interval in seconds (default: 300)
 *   QNSP_LOG_LEVEL      - silent | error | warn | info | debug (default: info)
 *   QNSP_HOSTNAME       - Override reported hostname (default: os.hostname())
 *   QNSP_STATE_DIR      - Durable queue/checkpoint directory (default: ~/.qnsp-agent/state)
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";

const CONFIG_SEARCH_PATHS = [
	"/etc/qnsp-agent/config.env",
	path.join(os.homedir(), ".qnsp-agent", "config.env"),
	path.join(process.cwd(), "qnsp-agent.env"),
];

function loadEnvFile(): void {
	for (const p of CONFIG_SEARCH_PATHS) {
		if (fs.existsSync(p)) {
			const lines = fs.readFileSync(p, "utf8").split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) continue;
				const eq = trimmed.indexOf("=");
				if (eq < 0) continue;
				const key = trimmed.slice(0, eq).trim();
				const val = trimmed
					.slice(eq + 1)
					.trim()
					.replace(/^["']|["']$/g, "");
				if (key && !(key in process.env)) {
					process.env[key] = val;
				}
			}
			break;
		}
	}
}

const configSchema = z.object({
	QNSP_AGENT_ID: z.string().uuid("QNSP_AGENT_ID must be a valid UUID"),
	QNSP_AGENT_SECRET: z
		.string()
		.regex(/^[0-9a-f]{64}$/i, "QNSP_AGENT_SECRET must be a 64-char hex string"),
	QNSP_ENDPOINT: z.string().url("QNSP_ENDPOINT must be a valid URL"),
	QNSP_TENANT_ID: z.string().uuid("QNSP_TENANT_ID must be a valid UUID"),
	QNSP_SCAN_PATHS: z.string().optional(),
	QNSP_INTERVAL_SECS: z.coerce.number().int().min(30).max(86_400).default(300),
	QNSP_LOG_LEVEL: z.enum(["silent", "error", "warn", "info", "debug"]).default("info"),
	QNSP_HOSTNAME: z.string().optional(),
	QNSP_STATE_DIR: z.string().min(1).optional(),
});

export interface AgentConfig {
	readonly agentId: string;
	readonly agentSecret: string;
	readonly endpoint: string;
	readonly tenantId: string;
	readonly scanPaths: string[];
	readonly intervalSecs: number;
	readonly logLevel: "silent" | "error" | "warn" | "info" | "debug";
	readonly hostname: string;
	readonly stateDir: string;
}

const DEFAULT_SCAN_PATHS = [
	"/etc/ssl",
	"/etc/pki",
	"/etc/ssh",
	"/home",
	"/root",
	"/var/lib/ssl",
	"/var/lib/tls",
	"/opt",
	"/usr/local/etc/ssl",
];

/**
 * QNSI full-rename bridge: users may set QNSI_* (canonical) or legacy QNSP_*
 * variables/config-file keys - mirror each family into the other without
 * overwriting, so the QNSP_-keyed schema below accepts both.
 */
function bridgeQnsiEnv(env: NodeJS.ProcessEnv = process.env): void {
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) continue;
		if (key.startsWith("QNSP_")) {
			const alias = `QNSI_${key.slice("QNSP_".length)}`;
			if (env[alias] === undefined) env[alias] = value;
		} else if (key.startsWith("QNSI_")) {
			const alias = `QNSP_${key.slice("QNSI_".length)}`;
			if (env[alias] === undefined) env[alias] = value;
		}
	}
}

export function loadAgentConfig(): AgentConfig {
	loadEnvFile();
	bridgeQnsiEnv();

	const parsed = configSchema.safeParse(process.env);
	if (!parsed.success) {
		const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
		throw new Error(
			`Invalid agent configuration:\n${issues}\n\nRun 'qnsp-agent configure --help' for setup instructions.`,
		);
	}

	const v = parsed.data;

	const scanPaths = v.QNSP_SCAN_PATHS
		? v.QNSP_SCAN_PATHS.split(",")
				.map((p) => p.trim())
				.filter((p) => p.length > 0)
		: DEFAULT_SCAN_PATHS;

	return {
		agentId: v.QNSP_AGENT_ID,
		agentSecret: v.QNSP_AGENT_SECRET,
		endpoint: v.QNSP_ENDPOINT.replace(/\/$/, ""),
		tenantId: v.QNSP_TENANT_ID,
		scanPaths,
		intervalSecs: v.QNSP_INTERVAL_SECS,
		logLevel: v.QNSP_LOG_LEVEL,
		hostname: v.QNSP_HOSTNAME ?? os.hostname(),
		stateDir: path.resolve(v.QNSP_STATE_DIR ?? path.join(os.homedir(), ".qnsp-agent", "state")),
	};
}

/**
 * Write a config file to the default system path.
 * Used by `qnsp-agent configure` command.
 */
export function writeConfigFile(
	values: {
		agentId: string;
		agentSecret: string;
		endpoint: string;
		tenantId: string;
	},
	targetPath?: string,
): string {
	const dest = targetPath ?? path.join(os.homedir(), ".qnsp-agent", "config.env");
	const dir = path.dirname(dest);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const content = [
		"# QNSP Agent Configuration",
		`# Generated: ${new Date().toISOString()}`,
		"",
		`QNSP_AGENT_ID=${values.agentId}`,
		`QNSP_AGENT_SECRET=${values.agentSecret}`,
		`QNSP_ENDPOINT=${values.endpoint}`,
		`QNSP_TENANT_ID=${values.tenantId}`,
		"",
		"# Optional: override scan paths (comma-separated)",
		"# QNSP_SCAN_PATHS=/etc/ssl,/home,/root",
		"",
		"# Optional: report interval in seconds (default: 300)",
		"# QNSP_INTERVAL_SECS=300",
	].join("\n");

	fs.writeFileSync(dest, content, { mode: 0o600 });
	return dest;
}
