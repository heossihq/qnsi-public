import { describe, expect, it, vi } from "vitest";

import { createMockResponse, setupTestEnvironment } from "./commands/test-utils.js";
import { loadConfig } from "./config.js";

describe("loadConfig edge-gateway derivation", () => {
	it("derives service urls through /proxy from the default edge gateway", () => {
		vi.stubEnv("QNSI_KMS_SERVICE_URL", "");
		try {
			const config = loadConfig();
			expect(config.kmsServiceUrl).toBe("https://api.qnsi.heossi.com/proxy");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("falls back to local service defaults when the edge gateway is explicitly blanked", () => {
		vi.stubEnv("QNSI_EDGE_GATEWAY_URL", "");
		vi.stubEnv("QNSI_KMS_SERVICE_URL", "");
		try {
			const config = loadConfig();
			expect(config.kmsServiceUrl).toBe("http://localhost:8095");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("harness table spy captures console.table output", () => {
		const env = setupTestEnvironment();
		try {
			console.table([{ a: 1 }]);
			expect(env.mockTable).toHaveBeenCalledOnce();
		} finally {
			env.cleanup();
		}
	});
});

describe("dotenv gating at module load", () => {
	it("skips dotenv in production unless explicitly requested", async () => {
		const originalNodeEnv = process.env["NODE_ENV"];
		try {
			vi.resetModules();
			process.env["NODE_ENV"] = "production";
			delete process.env["QNSI_LOAD_ENV_FILE_IN_PROD"];
			const prod = await import("./config.js");
			expect(prod.loadConfig().edgeGatewayUrl).toBeDefined();

			vi.resetModules();
			process.env["QNSI_LOAD_ENV_FILE_IN_PROD"] = "true";
			const prodWithFlag = await import("./config.js");
			expect(prodWithFlag.loadConfig().edgeGatewayUrl).toBeDefined();

			vi.resetModules();
			delete process.env["NODE_ENV"];
			delete process.env["QNSI_LOAD_ENV_FILE_IN_PROD"];
			const defaulted = await import("./config.js");
			expect(defaulted.loadConfig().edgeGatewayUrl).toBeDefined();
		} finally {
			if (originalNodeEnv === undefined) {
				delete process.env["NODE_ENV"];
			} else {
				process.env["NODE_ENV"] = originalNodeEnv;
			}
			delete process.env["QNSI_LOAD_ENV_FILE_IN_PROD"];
			vi.resetModules();
		}
	});
});

describe("test-utils harness", () => {
	it("mock responses parse json, expose text, and clone", async () => {
		const response = createMockResponse({ ok: 1 }, 201, true, { "x-h": "v" });
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ ok: 1 });
		expect(await response.text()).toBe(JSON.stringify({ ok: 1 }));
		expect(await response.clone().json()).toEqual({ ok: 1 });
		expect(response.headers.get("x-h")).toBe("v");
	});

	it("cleanup restores an absent NODE_ENV by deleting it", () => {
		const original = process.env["NODE_ENV"];
		delete process.env["NODE_ENV"];
		try {
			const env = setupTestEnvironment();
			expect(process.env["NODE_ENV"]).toBe("development");
			env.cleanup();
			expect(process.env["NODE_ENV"]).toBeUndefined();
		} finally {
			if (original === undefined) {
				delete process.env["NODE_ENV"];
			} else {
				process.env["NODE_ENV"] = original;
			}
			vi.restoreAllMocks();
		}
	});
});
