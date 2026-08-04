/**
 * Coverage for config.ts `loadEnvFile()` - the config-file discovery + parsing path.
 *
 * `CONFIG_SEARCH_PATHS` is computed at module-evaluation time from `os.homedir()`,
 * so we mock `node:os` and re-import the module (vi.resetModules + vi.doMock) to point
 * the home-directory search path at a throwaway temp dir we control. This exercises the
 * real file read + line parser (comments, blank lines, malformed lines, quoted values,
 * and the "do not override an already-set env var" rule) instead of stubbing it out.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = {
	QNSP_AGENT_ID: "11111111-1111-4111-8111-111111111111",
	QNSP_AGENT_SECRET: "a".repeat(64),
	QNSP_ENDPOINT: "https://api.qnsi.heossi.com",
	QNSP_TENANT_ID: "22222222-2222-4222-8222-222222222222",
};

function clearAgentEnv(): void {
	for (const k of Object.keys(process.env)) {
		if (k.startsWith("QNSP_") || k.startsWith("QNSI_")) delete process.env[k];
	}
}

const savedEnv = { ...process.env };
const tmpDirs: string[] = [];

async function importConfigWithHome(home: string): Promise<typeof import("./config.js")> {
	vi.resetModules();
	vi.doMock("node:os", async (importOriginal) => {
		const actual = await importOriginal<typeof import("node:os")>();
		return { ...actual, homedir: () => home };
	});
	return import("./config.js");
}

function makeHomeWithConfig(lines: string[]): string {
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "qnsp-agent-home-"));
	tmpDirs.push(home);
	const cfgDir = path.join(home, ".qnsp-agent");
	fs.mkdirSync(cfgDir, { recursive: true });
	fs.writeFileSync(path.join(cfgDir, "config.env"), lines.join("\n"), { mode: 0o600 });
	return home;
}

afterEach(() => {
	vi.doUnmock("node:os");
	vi.resetModules();
	clearAgentEnv();
	for (const [k, v] of Object.entries(savedEnv)) {
		if ((k.startsWith("QNSP_") || k.startsWith("QNSI_")) && v !== undefined) process.env[k] = v;
	}
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("loadAgentConfig - config-file discovery (loadEnvFile)", () => {
	it("reads and parses variables from ~/.qnsp-agent/config.env", async () => {
		clearAgentEnv();
		const home = makeHomeWithConfig([
			"# QNSP Agent Configuration",
			"   ", // blank/whitespace line - skipped
			"MALFORMED_LINE_WITHOUT_EQUALS", // no '=' - skipped
			`QNSP_AGENT_ID="${VALID.QNSP_AGENT_ID}"`, // double-quoted value - quotes stripped
			`QNSP_AGENT_SECRET='${VALID.QNSP_AGENT_SECRET}'`, // single-quoted value
			`QNSP_ENDPOINT=${VALID.QNSP_ENDPOINT}`,
			`QNSP_TENANT_ID = ${VALID.QNSP_TENANT_ID} `, // surrounding spaces trimmed
		]);

		const { loadAgentConfig } = await importConfigWithHome(home);
		const cfg = loadAgentConfig();

		expect(cfg.agentId).toBe(VALID.QNSP_AGENT_ID);
		expect(cfg.agentSecret).toBe(VALID.QNSP_AGENT_SECRET);
		expect(cfg.endpoint).toBe(VALID.QNSP_ENDPOINT);
		expect(cfg.tenantId).toBe(VALID.QNSP_TENANT_ID);
	});

	it("never overrides a variable that is already set in the environment", async () => {
		clearAgentEnv();
		// The environment already carries an endpoint; the file must NOT clobber it.
		process.env["QNSP_ENDPOINT"] = "https://preset.qnsi.heossi.com";
		const home = makeHomeWithConfig([
			`QNSP_AGENT_ID=${VALID.QNSP_AGENT_ID}`,
			`QNSP_AGENT_SECRET=${VALID.QNSP_AGENT_SECRET}`,
			"QNSP_ENDPOINT=https://from-file.example.com",
			`QNSP_TENANT_ID=${VALID.QNSP_TENANT_ID}`,
		]);

		const { loadAgentConfig } = await importConfigWithHome(home);
		const cfg = loadAgentConfig();

		// Pre-existing env wins; the other three still come from the file.
		expect(cfg.endpoint).toBe("https://preset.qnsi.heossi.com");
		expect(cfg.agentId).toBe(VALID.QNSP_AGENT_ID);
		expect(cfg.tenantId).toBe(VALID.QNSP_TENANT_ID);
	});
});
