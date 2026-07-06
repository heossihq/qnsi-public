import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerObservabilityCommands } from "./observability.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Observability commands", () => {
	let program: Command;
	let env: ReturnType<typeof setupTestEnvironment>;

	beforeEach(() => {
		env = setupTestEnvironment();
		program = new Command();
		clearTokenCache();
	});

	afterEach(() => {
		env.cleanup();
	});

	describe("observability slos list", () => {
		it("should list SLOs successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						slos: [{ id: "slo-1", name: "Availability" }],
					}),
				);

			registerObservabilityCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "observability", "slos", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/observability/v1/slos"),
				expect.objectContaining({
					headers: expect.objectContaining({
						"x-qnsp-tenant": "test-tenant",
					}),
				}),
			);
		});
	});

	describe("observability otlp status", () => {
		it("should get OTLP status successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						status: "healthy",
					}),
				);

			registerObservabilityCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "observability", "otlp", "status"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/health"),
				expect.any(Object),
			);
		});
	});
});
