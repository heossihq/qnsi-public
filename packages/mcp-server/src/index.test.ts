import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Registration {
	readonly name: string;
	readonly handler: (input: unknown) => Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
	apiConfigs: [] as unknown[],
	apiGet: vi.fn((_path: string) => Promise.resolve({ data: { ok: true } })),
	apiPost: vi.fn((_path: string, _body?: unknown) => Promise.resolve({ data: { ok: true } })),
	connect: vi.fn((_transport: unknown) => Promise.resolve()),
	registrations: [] as Registration[],
	serverMetadata: [] as unknown[],
	sessionActivate: vi.fn(() =>
		Promise.resolve({
			hasFeature: () => true,
			tier: "business",
			tenantId: "00000000-0000-4000-8000-000000000001",
			limits: {
				storageGB: 100,
				apiCalls: 10_000,
				enclavesEnabled: true,
				aiTrainingEnabled: true,
				aiInferenceEnabled: true,
				sseEnabled: true,
				vaultEnabled: true,
			},
		}),
	),
	sessionConfigs: [] as unknown[],
	transportCount: 0,
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
	McpServer: class {
		constructor(metadata: unknown) {
			mocks.serverMetadata.push(metadata);
		}

		tool(name: string, _description: string, _schema: unknown, handler: Registration["handler"]) {
			mocks.registrations.push({ name, handler });
		}

		connect(transport: unknown) {
			return mocks.connect(transport);
		}
	},
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
	StdioServerTransport: class {
		constructor() {
			mocks.transportCount += 1;
		}
	},
}));

vi.mock("./api-client.js", () => ({
	ApiClient: class {
		constructor(config: unknown) {
			mocks.apiConfigs.push(config);
		}

		get(path: string) {
			return mocks.apiGet(path);
		}

		post(path: string, body?: unknown) {
			return mocks.apiPost(path, body);
		}
	},
}));

vi.mock("./session.js", () => ({
	SessionManager: class {
		constructor(config: unknown) {
			mocks.sessionConfigs.push(config);
		}

		activate() {
			return mocks.sessionActivate();
		}
	},
}));

const originalApiKey = process.env["QNSP_API_KEY"];
const originalPlatformUrl = process.env["QNSP_PLATFORM_URL"];

function restoreEnvironment(): void {
	if (originalApiKey === undefined) delete process.env["QNSP_API_KEY"];
	else process.env["QNSP_API_KEY"] = originalApiKey;
	if (originalPlatformUrl === undefined) delete process.env["QNSP_PLATFORM_URL"];
	else process.env["QNSP_PLATFORM_URL"] = originalPlatformUrl;
}

describe("MCP server entrypoint", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("node:module");
		delete process.env["QNSP_API_KEY"];
		delete process.env["QNSP_PLATFORM_URL"];
		mocks.apiConfigs.length = 0;
		mocks.registrations.length = 0;
		mocks.serverMetadata.length = 0;
		mocks.sessionConfigs.length = 0;
		mocks.transportCount = 0;
		mocks.apiGet.mockClear();
		mocks.apiPost.mockClear();
		mocks.connect.mockClear();
		mocks.sessionActivate.mockClear();
	});

	afterEach(() => {
		restoreEnvironment();
	});

	it("creates a credential-free sandbox and registers every tool", async () => {
		const { createSandboxServer, PACKAGE_VERSION } = await import("./index.js");

		const server = createSandboxServer();

		expect(server).toBeDefined();
		expect(PACKAGE_VERSION).toBe("0.2.0");
		expect(mocks.serverMetadata).toContainEqual({ name: "qnsp", version: "0.2.0" });
		expect(mocks.apiConfigs).toContainEqual({
			baseUrl: "https://api.qnsi.heossi.com",
			apiKey: "sandbox",
			tenantId: "sandbox",
		});
		expect(mocks.registrations).toHaveLength(17);
		expect(new Set(mocks.registrations.map(({ name }) => name)).size).toBe(17);
	});

	it("executes all registered tool adapters through parsed public inputs", async () => {
		const { createSandboxServer } = await import("./index.js");
		createSandboxServer();
		const inputByName: Record<string, unknown> = {
			qnsp_kms_generate_key: { algorithm: "ml-dsa-65" },
			qnsp_kms_list_keys: {},
			qnsp_kms_get_key: { keyId: "key-id" },
			qnsp_kms_rotate_key: { keyId: "key-id" },
			qnsp_kms_hspk_seal: { connectionId: "connection", keyId: "hsm-key" },
			qnsp_kms_hspk_sign: {
				connectionId: "connection",
				keyId: "hsm-key",
				sealedKey: { algorithm: "ml-dsa-65" },
				message: "message",
			},
			qnsp_vault_create_secret: { name: "name", value: "value" },
			qnsp_vault_get_secret: { secretId: "secret" },
			qnsp_vault_list_secrets: {},
			qnsp_crypto_scan: {},
			qnsp_crypto_inventory: {},
			qnsp_crypto_readiness: {},
			qnsp_audit_query: {},
			qnsp_search_query: { query: "query" },
			qnsp_tenant_info: {},
			qnsp_billing_status: {},
			qnsp_platform_health: {},
		};

		for (const registration of mocks.registrations) {
			await expect(registration.handler(inputByName[registration.name])).resolves.toBeDefined();
		}
	});

	it("validates required environment values without logging secrets", async () => {
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
		const { getRequiredEnv } = await import("./index.js");

		process.env["PRESENT"] = "value";
		expect(getRequiredEnv("PRESENT")).toBe("value");
		delete process.env["MISSING"];
		expect(getRequiredEnv("MISSING")).toBeUndefined();
		expect(stderr).toHaveBeenCalledWith(expect.stringContaining("MISSING is required"));
		expect(exit).toHaveBeenCalledWith(1);
		delete process.env["PRESENT"];
	});

	it("starts an activated stdio server with the default platform URL", async () => {
		const { main } = await import("./index.js");
		process.env["QNSP_API_KEY"] = "secret";

		await main();

		expect(mocks.sessionConfigs).toEqual([
			{ apiKey: "secret", platformUrl: "https://api.qnsi.heossi.com" },
		]);
		expect(mocks.apiConfigs).toEqual([
			{
				baseUrl: "https://api.qnsi.heossi.com",
				apiKey: "secret",
				tenantId: "00000000-0000-4000-8000-000000000001",
			},
		]);
		expect(mocks.registrations).toHaveLength(17);
		expect(mocks.transportCount).toBe(1);
		expect(mocks.connect).toHaveBeenCalledOnce();
	});

	it("uses an explicitly configured platform URL", async () => {
		const { main } = await import("./index.js");
		process.env["QNSP_API_KEY"] = "secret";
		process.env["QNSP_PLATFORM_URL"] = "https://platform.example";

		await main();

		expect(mocks.sessionConfigs).toContainEqual({
			apiKey: "secret",
			platformUrl: "https://platform.example",
		});
	});

	it("auto-starts when credentials are present", async () => {
		process.env["QNSP_API_KEY"] = "secret";

		await import("./index.js");
		await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
	});

	it.each([
		[new Error("activation failed"), "activation failed"],
		["unstructured failure", "unstructured failure"],
	])("reports auto-start failures without exposing credentials", async (failure, message) => {
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
		mocks.sessionActivate.mockRejectedValueOnce(failure);
		process.env["QNSP_API_KEY"] = "secret";

		await import("./index.js");
		await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));

		expect(stderr).toHaveBeenCalledWith(`QNSP MCP Server fatal error: ${message}\n`);
		expect(stderr.mock.calls.flat().join("")).not.toContain("secret");
	});

	it("uses the unknown version when package metadata omits it", async () => {
		vi.doMock("node:module", () => ({ createRequire: () => () => ({}) }));

		const { PACKAGE_VERSION } = await import("./index.js");

		expect(PACKAGE_VERSION).toBe("0.0.0+unknown");
	});

	it("uses the unknown version when package metadata cannot be loaded", async () => {
		vi.doMock("node:module", () => ({
			createRequire: () => () => {
				throw new Error("unreadable");
			},
		}));

		const { PACKAGE_VERSION } = await import("./index.js");

		expect(PACKAGE_VERSION).toBe("0.0.0+unknown");
	});
});
