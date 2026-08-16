/**
 * Covers the scan-failure catch's non-Error arm: the real scanDirectory only
 * rejects with fs Errors, so the String(err) branch is reachable only through
 * a mocked scanner. Every real behavior is tested unmocked in
 * command-tails.test.ts and crypto-scan.test.ts.
 */

import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCryptoScanCommands } from "./crypto-scan.js";
import { mockConfig, setupTestEnvironment } from "./test-utils.js";

vi.mock("../../code-scan/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("../../code-scan/index.js")>();
	return {
		...original,
		scanDirectory: vi.fn(async () => {
			throw "raw scanner fault";
		}),
	};
});

describe("crypto scan non-Error failure", () => {
	let env: ReturnType<typeof setupTestEnvironment>;

	beforeEach(() => {
		env = setupTestEnvironment();
	});

	afterEach(() => {
		env.cleanup();
	});

	it("stringifies non-Error scanner faults", async () => {
		const program = new Command();
		registerCryptoScanCommands(program, mockConfig);
		try {
			await program.parseAsync(["node", "qnsi", "crypto", "scan", "/tmp"]);
		} catch {
			// mocked exit
		}
		expect(env.mockError.mock.calls.join(" ")).toContain("Scan failed: raw scanner fault");
	});
});
