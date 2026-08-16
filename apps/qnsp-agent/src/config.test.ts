import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bridgeQnsiEnv, loadAgentConfig, writeConfigFile } from "./config.js";

const VALID = {
	QNSP_AGENT_ID: "11111111-1111-4111-8111-111111111111",
	QNSP_AGENT_SECRET: "a".repeat(64),
	QNSP_ENDPOINT: "https://api.qnsi.heossi.com",
	QNSP_TENANT_ID: "22222222-2222-4222-8222-222222222222",
};

function clearAgentEnv(): void {
	for (const k of Object.keys(process.env)) {
		if (k.startsWith("QNSP_") || k.startsWith("QNSI_")) {
			delete process.env[k];
		}
	}
}

let tmpDir: string;
const savedEnv = { ...process.env };

beforeEach(() => {
	clearAgentEnv();
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qnsp-agent-cfg-"));
});

afterEach(() => {
	clearAgentEnv();
	// restore any pre-existing QNSP_/QNSI_ vars the host had
	for (const [k, v] of Object.entries(savedEnv)) {
		if ((k.startsWith("QNSP_") || k.startsWith("QNSI_")) && v !== undefined) {
			process.env[k] = v;
		}
	}
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadAgentConfig", () => {
	it("bridges both naming families without overwriting explicit aliases", () => {
		const env: NodeJS.ProcessEnv = {
			QNSP_ALPHA: "legacy",
			QNSI_ALPHA: "canonical",
			QNSP_BETA: "legacy-only",
			QNSI_GAMMA: "canonical-only",
			QNSP_UNSET: undefined,
		};

		bridgeQnsiEnv(env);

		expect(env["QNSP_ALPHA"]).toBe("legacy");
		expect(env["QNSI_ALPHA"]).toBe("canonical");
		expect(env["QNSI_BETA"]).toBe("legacy-only");
		expect(env["QNSP_GAMMA"]).toBe("canonical-only");
		expect(env["QNSI_UNSET"]).toBeUndefined();
	});

	it("loads a valid config from QNSP_* env with sensible defaults", () => {
		Object.assign(process.env, VALID);

		const cfg = loadAgentConfig();
		expect(cfg.agentId).toBe(VALID.QNSP_AGENT_ID);
		expect(cfg.agentSecret).toBe(VALID.QNSP_AGENT_SECRET);
		expect(cfg.endpoint).toBe(VALID.QNSP_ENDPOINT);
		expect(cfg.tenantId).toBe(VALID.QNSP_TENANT_ID);
		expect(cfg.intervalSecs).toBe(300);
		expect(cfg.logLevel).toBe("info");
		expect(cfg.scanPaths.length).toBeGreaterThan(0);
		expect(typeof cfg.hostname).toBe("string");
		expect(cfg.stateDir).toBe(path.join(os.homedir(), ".qnsp-agent", "state"));
	});

	it("resolves a custom durable state directory", () => {
		Object.assign(process.env, { ...VALID, QNSP_STATE_DIR: path.join(tmpDir, "agent-state") });
		expect(loadAgentConfig().stateDir).toBe(path.join(tmpDir, "agent-state"));
	});

	it("strips a trailing slash from the endpoint", () => {
		Object.assign(process.env, { ...VALID, QNSP_ENDPOINT: "https://api.qnsi.heossi.com/" });
		expect(loadAgentConfig().endpoint).toBe("https://api.qnsi.heossi.com");
	});

	it("bridges QNSI_* variables into the QNSP_* schema (full-rename compatibility)", () => {
		process.env["QNSI_AGENT_ID"] = VALID.QNSP_AGENT_ID;
		process.env["QNSI_AGENT_SECRET"] = VALID.QNSP_AGENT_SECRET;
		process.env["QNSI_ENDPOINT"] = VALID.QNSP_ENDPOINT;
		process.env["QNSI_TENANT_ID"] = VALID.QNSP_TENANT_ID;

		const cfg = loadAgentConfig();
		expect(cfg.agentId).toBe(VALID.QNSP_AGENT_ID);
		expect(cfg.tenantId).toBe(VALID.QNSP_TENANT_ID);
	});

	it("parses and trims a custom comma-separated scan-path list", () => {
		Object.assign(process.env, {
			...VALID,
			QNSP_SCAN_PATHS: " /etc/ssl , /home ,, /root ",
		});
		expect(loadAgentConfig().scanPaths).toEqual(["/etc/ssl", "/home", "/root"]);
	});

	it("honours QNSP_HOSTNAME override and log level / interval overrides", () => {
		Object.assign(process.env, {
			...VALID,
			QNSP_HOSTNAME: "scanner-01",
			QNSP_LOG_LEVEL: "debug",
			QNSP_INTERVAL_SECS: "600",
		});
		const cfg = loadAgentConfig();
		expect(cfg.hostname).toBe("scanner-01");
		expect(cfg.logLevel).toBe("debug");
		expect(cfg.intervalSecs).toBe(600);
	});

	it("rejects an invalid agent id with a descriptive error", () => {
		Object.assign(process.env, { ...VALID, QNSP_AGENT_ID: "not-a-uuid" });
		expect(() => loadAgentConfig()).toThrow(/Invalid agent configuration/);
	});

	it("rejects a malformed secret (not 64-char hex)", () => {
		Object.assign(process.env, { ...VALID, QNSP_AGENT_SECRET: "tooshort" });
		expect(() => loadAgentConfig()).toThrow(/QNSP_AGENT_SECRET/);
	});

	it("rejects an out-of-range report interval", () => {
		Object.assign(process.env, { ...VALID, QNSP_INTERVAL_SECS: "5" });
		expect(() => loadAgentConfig()).toThrow(/Invalid agent configuration/);
	});
});

describe("writeConfigFile", () => {
	it("writes a 0600 config file that loadAgentConfig can consume", () => {
		const dest = path.join(tmpDir, "config.env");
		const written = writeConfigFile(
			{
				agentId: VALID.QNSP_AGENT_ID,
				agentSecret: VALID.QNSP_AGENT_SECRET,
				endpoint: VALID.QNSP_ENDPOINT,
				tenantId: VALID.QNSP_TENANT_ID,
			},
			dest,
		);

		expect(written).toBe(dest);
		expect(fs.existsSync(dest)).toBe(true);
		const mode = fs.statSync(dest).mode & 0o777;
		expect(mode).toBe(0o600);

		const contents = fs.readFileSync(dest, "utf8");
		expect(contents).toContain(`QNSP_AGENT_ID=${VALID.QNSP_AGENT_ID}`);
		expect(contents).toContain(`QNSP_ENDPOINT=${VALID.QNSP_ENDPOINT}`);
	});

	it("creates the parent directory when it does not exist", () => {
		const dest = path.join(tmpDir, "nested", "dir", "config.env");
		writeConfigFile(
			{
				agentId: VALID.QNSP_AGENT_ID,
				agentSecret: VALID.QNSP_AGENT_SECRET,
				endpoint: VALID.QNSP_ENDPOINT,
				tenantId: VALID.QNSP_TENANT_ID,
			},
			dest,
		);
		expect(fs.existsSync(dest)).toBe(true);
	});
});
