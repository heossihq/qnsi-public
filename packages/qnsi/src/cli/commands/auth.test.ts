import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerAuthCommands } from "./auth.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Auth commands", () => {
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

	describe("auth token", () => {
		it("should request token successfully", async () => {
			env.mockFetch.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }));

			registerAuthCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"auth",
					"token",
					"--service-id",
					"test-service",
					"--service-secret",
					"test-secret",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			// Should print JSON output by default in tests
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/auth/service-token"),
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("test-service"),
				}),
			);
		});

		it("should fail when credentials missing", async () => {
			registerAuthCommands(program, { ...mockConfig, serviceId: null, serviceSecret: null });
			try {
				await program.parseAsync(["node", "test", "auth", "token"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(3); // AUTH_ERROR
		});

		it("should handle 429 rate limit", async () => {
			env.mockFetch.mockResolvedValueOnce(
				createMockResponse(
					{
						error: "Rate limit exceeded",
						message: "Too many requests",
						retryAfter: 60,
					},
					429,
					false,
				),
			);

			registerAuthCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"auth",
					"token",
					"--service-id",
					"test",
					"--service-secret",
					"secret",
				]);
			} catch {
				// expected process.exit
			}

			// Should exit with AUTH_ERROR (3) because auth command handles its own errors
			// or specific error codes if propagated. The current implementation in auth.ts
			// exits with AUTH_ERROR(3) on fetch failure.
			expect(env.mockExit).toHaveBeenCalledWith(3);
		});
	});
});
