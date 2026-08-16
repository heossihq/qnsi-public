/**
 * Covers the defensive tenant-resolution guard: the activation schema
 * guarantees a uuid tenantId, so an empty resolution is reachable only
 * through a mocked activation module.
 */

import { describe, expect, it, vi } from "vitest";

import { QnsiExecutor } from "./executor.js";

vi.mock("../_activation/index.js", () => ({
	activateSdk: vi.fn(async () => ({ tenantId: "" })),
}));

describe("tenant resolution guard", () => {
	it("fails closed when activation yields no tenant id", async () => {
		const executor = new QnsiExecutor({ apiKey: "guard-key-000001" });
		await expect(executor.execute({ code: "print(1)" })).rejects.toThrow(
			"tenantId could not be resolved",
		);
	});
});
