/**
 * Guard: the credential-free sandbox context exists only for capability
 * discovery (Smithery). The runtime bootstrap must always require QNSI_API_KEY,
 * and the "sandbox" credential may only appear inside createSandboxServer().
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");

describe("MCP sandbox isolation", () => {
	it("requires QNSI_API_KEY on the runtime bootstrap path", () => {
		expect(source).toMatch(/getRequiredEnv\("QNSI_API_KEY"\)/);
	});

	it("keeps the sandbox credential inside createSandboxServer only", () => {
		const sandboxStart = source.indexOf("export function createSandboxServer");
		const sandboxKey = source.indexOf('apiKey: "sandbox"');
		const bootstrap = source.indexOf('getRequiredEnv("QNSI_API_KEY")');
		expect(sandboxStart).toBeGreaterThan(-1);
		expect(sandboxKey).toBeGreaterThan(sandboxStart);
		expect(bootstrap).toBeGreaterThan(sandboxStart);
		// No sandbox credential may appear before the sandbox factory, i.e. in the
		// shared/imported runtime section of the module.
		expect(source.slice(0, sandboxStart)).not.toContain('"sandbox"');
	});
});
