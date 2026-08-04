import type { Mock, MockInstance } from "vitest";
import { vi } from "vitest";
import type { CliConfig } from "../config.js";

/** Explicit return type for setupTestEnvironment to avoid non-portable inferred types from @vitest/spy. */
export interface TestEnvironment {
	readonly mockFetch: Mock;
	readonly mockExit: MockInstance;
	readonly mockLog: MockInstance;
	readonly mockError: MockInstance;
	readonly mockTable: MockInstance;
	readonly cleanup: () => void;
}

// Helper to create Response objects that can be cloned
export function createMockResponse(
	data: unknown,
	status = 200,
	ok = true,
	headers: Record<string, string> = {},
): Response {
	const body = JSON.stringify(data);
	const responseHeaders = new Headers(headers);

	// Create a response that mimics the Fetch API Response object
	// tailored for our tests which use clone()
	return {
		ok,
		status,
		headers: responseHeaders,
		json: async () => JSON.parse(body),
		text: async () => body,
		clone() {
			return createMockResponse(data, status, ok, headers);
		},
	} as unknown as Response;
}

export const mockConfig: CliConfig = {
	edgeGatewayUrl: null,
	cloudPortalUrl: "https://cloud.qnsi.heossi.com",
	authServiceUrl: "http://localhost:8081",
	// null = exercise the service-account path, which is what these tests cover.
	// The api-key path is covered separately (utils/auth.test.ts).
	apiKey: null,
	serviceId: "test-service-id",
	serviceSecret: "test-secret",
	tenantId: "test-tenant",
	kmsServiceUrl: "http://localhost:8095",
	vaultServiceUrl: "http://localhost:8090",
	auditServiceUrl: "http://localhost:8103",
	tenantServiceUrl: "http://localhost:8108",
	billingServiceUrl: "http://localhost:8106/billing",
	accessControlServiceUrl: "http://localhost:8102",
	securityMonitoringServiceUrl: "http://localhost:8104",
	storageServiceUrl: "http://localhost:8092",
	searchServiceUrl: "http://localhost:8101",
	observabilityServiceUrl: "http://localhost:8105",
	outputFormat: "json",
	verbose: false,
};

export function setupTestEnvironment(): TestEnvironment {
	const mockFetch = vi.fn();
	const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
	const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
	const mockError = vi.spyOn(console, "error").mockImplementation(() => {});
	const mockTable = vi.spyOn(console, "table").mockImplementation(() => {});

	// Intercept global fetch
	global.fetch = mockFetch as unknown as typeof fetch;

	// Override process.stdin.isTTY
	Object.defineProperty(process.stdin, "isTTY", {
		value: false,
		configurable: true,
	});

	// Reset NODE_ENV to development to avoid HTTPS validation exit
	const originalNodeEnv = process.env["NODE_ENV"];
	process.env["NODE_ENV"] = "development";

	return {
		mockFetch,
		mockExit,
		mockLog,
		mockError,
		mockTable,
		cleanup: () => {
			if (originalNodeEnv === undefined) {
				delete process.env["NODE_ENV"];
			} else {
				process.env["NODE_ENV"] = originalNodeEnv;
			}
			vi.restoreAllMocks();
		},
	};
}
