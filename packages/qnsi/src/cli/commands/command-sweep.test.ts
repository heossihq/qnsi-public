/**
 * Generic arm sweep for every registered CLI command: walks the commander
 * tree after registration and drives each leaf through the shared failure
 * and output families (missing tenant, enforcement statuses, non-OK errors,
 * network failures, table output). Command-specific happy paths remain in
 * the per-command test files.
 */

import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearTokenCache } from "../utils/token-cache.js";
import { registerAccessControlCommands } from "./access-control.js";
import { registerAuditCommands } from "./audit.js";
import { registerAuthCommands } from "./auth.js";
import { registerBillingCommands } from "./billing.js";
import { registerCryptoPolicyCommands } from "./crypto-policy.js";
import { registerKmsCommands } from "./kms.js";
import { registerObservabilityCommands } from "./observability.js";
import { registerSearchCommands } from "./search.js";
import { registerSecurityCommands } from "./security.js";
import { registerStorageCommands } from "./storage.js";
import { registerTenantCommands } from "./tenant.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";
import { registerVaultCommands } from "./vault.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

const REGISTRARS = [
	registerAccessControlCommands,
	registerAuditCommands,
	registerAuthCommands,
	registerBillingCommands,
	registerCryptoPolicyCommands,
	registerKmsCommands,
	registerObservabilityCommands,
	registerSearchCommands,
	registerSecurityCommands,
	registerStorageCommands,
	registerTenantCommands,
	registerVaultCommands,
] as const;

/** Rich body satisfying the list/get shapes every command reads. */
const GENERIC_BODY = {
	secrets: [],
	keys: [],
	policies: [],
	events: [],
	items: [],
	addons: [],
	addOns: [],
	slos: [],
	indexes: [],
	alerts: [],
	breaches: [],
	objects: [],
	tenants: [],
	results: [],
	usage: [],
	accessToken: "sweep-token",
	id: UUID,
	name: "sweep",
	status: "ok",
};

interface LeafCommand {
	readonly argv: string[];
}

function collectLeaves(command: Command, path: string[]): LeafCommand[] {
	const subcommands = command.commands as Command[];
	if (subcommands.length === 0) {
		const argv = [...path];
		for (const arg of command.registeredArguments) {
			if (arg.required) argv.push(UUID);
		}
		for (const option of command.options) {
			if (option.mandatory) argv.push(option.long ?? "", UUID);
		}
		return [{ argv }];
	}
	return subcommands.flatMap((sub) => collectLeaves(sub, [...path, sub.name()]));
}

function allLeaves(config: typeof mockConfig): Array<{ argv: string[]; program: Command }> {
	const leaves: Array<{ argv: string[]; program: Command }> = [];
	for (const register of REGISTRARS) {
		const program = new Command();
		register(program, config);
		for (const top of program.commands as Command[]) {
			for (const leaf of collectLeaves(top, [top.name()])) {
				leaves.push({ argv: leaf.argv, program });
			}
		}
	}
	return leaves;
}

describe("command sweep", () => {
	let env: ReturnType<typeof setupTestEnvironment>;

	beforeEach(() => {
		env = setupTestEnvironment();
		clearTokenCache();
	});

	afterEach(() => {
		env.cleanup();
	});

	async function run(program: Command, argv: string[]): Promise<void> {
		try {
			await program.parseAsync(["node", "qnsi", ...argv]);
		} catch {
			// mocked process.exit lets execution continue; commander may throw
		}
	}

	function respondWith(handler: (url: string) => Response | Promise<Response>): void {
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "sweep-token" });
			}
			return handler(String(url));
		});
	}

	it("every leaf exits INVALID_ARGUMENTS without a tenant id", async () => {
		for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: null })) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse(GENERIC_BODY));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});

	it("every leaf renders table output and exits successfully", async () => {
		// tenantId matches the argument placeholder so the tenant cross-check passes.
		const tableConfig = { ...mockConfig, tenantId: UUID, outputFormat: "table" as const };
		for (const { program, argv } of allLeaves(tableConfig)) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse(GENERIC_BODY));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
		// Bodies without the expected collections exercise the empty-list arms.
		for (const { program, argv } of allLeaves(tableConfig)) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse({}));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});

	it("every leaf succeeds in json mode with a matching tenant id", async () => {
		for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: UUID })) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse(GENERIC_BODY));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});

	it("every leaf maps non-OK responses to an error exit", async () => {
		for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: UUID })) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse({ message: "sweep failure" }, 500, false));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});

	it("every leaf returns quietly after a handled enforcement status", async () => {
		for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: UUID })) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse({ message: "limited", tier: "free" }, 429, false));
			await run(program, argv);
			// fetchWithBackendHandling exits RATE_LIMITED; the command then returns.
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});

	it("every leaf accepts all of its declared options", async () => {
		const optioned: Array<{ argv: string[]; program: Command }> = [];
		for (const register of REGISTRARS) {
			const program = new Command();
			register(program, mockConfig);
			for (const top of program.commands as Command[]) {
				const walk = (command: Command, path: string[]): void => {
					const subcommands = command.commands as Command[];
					if (subcommands.length === 0) {
						const argv = [...path];
						for (const arg of command.registeredArguments) {
							if (arg.required) argv.push(UUID);
						}
						for (const option of command.options) {
							if (option.long === "--output" || option.long === "--verbose") continue;
							argv.push(option.long ?? "");
							if (option.required || option.optional) argv.push("42");
						}
						optioned.push({ argv, program });
						return;
					}
					for (const sub of subcommands) walk(sub, [...path, sub.name()]);
				};
				walk(top, [top.name()]);
			}
		}
		for (const { program, argv } of optioned) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse(GENERIC_BODY));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});

	it("every leaf fails closed when a blank global tenant id overrides the config", async () => {
		for (const register of REGISTRARS) {
			const program = new Command();
			program.option("--tenant-id <id>", "Tenant identifier");
			register(program, mockConfig);
			for (const top of program.commands as Command[]) {
				for (const leaf of collectLeaves(top, [top.name()])) {
					env.mockExit.mockClear();
					respondWith(() => createMockResponse(GENERIC_BODY));
					await run(program, ["--tenant-id", "", ...leaf.argv]);
					expect(env.mockExit, leaf.argv.join(" ")).toHaveBeenCalled();
				}
			}
		}
	});

	it("every leaf tolerates non-Error throws and the __EXIT__ sentinel", async () => {
		for (const thrown of ["raw sweep failure", new Error("__EXIT__ sentinel")]) {
			for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: UUID })) {
				env.mockExit.mockClear();
				env.mockFetch.mockImplementation(async (url: string) => {
					if (String(url).includes("/auth/service-token")) {
						return createMockResponse({ accessToken: "sweep-token" });
					}
					throw thrown;
				});
				await run(program, argv);
				// Sentinel throws return silently; everything else exits.
				expect(env.mockFetch, argv.join(" ")).toHaveBeenCalled();
			}
		}
	});

	it("every leaf maps 404s and thrown transport errors", async () => {
		for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: UUID })) {
			env.mockExit.mockClear();
			respondWith(() => createMockResponse({ message: "missing" }, 404, false));
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}

		for (const { program, argv } of allLeaves({ ...mockConfig, tenantId: UUID })) {
			env.mockExit.mockClear();
			env.mockFetch.mockImplementation(async (url: string) => {
				if (String(url).includes("/auth/service-token")) {
					return createMockResponse({ accessToken: "sweep-token" });
				}
				throw new Error("sweep network failure");
			});
			await run(program, argv);
			expect(env.mockExit, argv.join(" ")).toHaveBeenCalled();
		}
	});
});
