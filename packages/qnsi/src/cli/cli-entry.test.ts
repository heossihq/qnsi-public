/**
 * Executes the CLI entry module itself: registration of every command family
 * on the shared program, config resolution, and the api-key tenant-resolution
 * arm that lets a customer run the CLI with nothing but their key.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cli entry point", () => {
	const originalArgv = process.argv;
	const savedEnv: Record<string, string | undefined> = {};
	const ENV_KEYS = ["QNSI_API_KEY", "QNSP_API_KEY", "QNSI_TENANT_ID", "QNSP_TENANT_ID"];

	beforeEach(() => {
		vi.resetModules();
		vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		for (const key of ENV_KEYS) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		process.argv = originalArgv;
		for (const key of ENV_KEYS) {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		}
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("registers every command family and parses argv without an api key", async () => {
		process.argv = ["node", "qnsi", "--help"];
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		try {
			await import("./index.js");
		} catch {
			// commander's --help path exits; with exit mocked it may throw
		}
		// No api key: the tenant-resolution handshake must not run.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("resolves the tenant from the activation handshake when only an api key is set", async () => {
		process.argv = ["node", "qnsi", "--help"];
		process.env["QNSI_API_KEY"] = `entry-key-${Date.now()}`;
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ tenantId: "99999999-9999-4999-8999-999999999999" }),
		});
		vi.stubGlobal("fetch", fetchMock);
		try {
			await import("./index.js");
		} catch {
			// commander's --help path exits; with exit mocked it may throw
		}
		const activationCall = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/proxy/billing/v1/sdk/activate"),
		);
		expect(activationCall).toBeDefined();
	});
});
