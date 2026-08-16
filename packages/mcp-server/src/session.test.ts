import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const activation = vi.hoisted(() => ({ activateSdk: vi.fn() }));

vi.mock("@heossihq/qnsi/activation", () => ({
	activateSdk: activation.activateSdk,
}));

const response = {
	activated: true as const,
	tenantId: "00000000-0000-4000-8000-000000000001",
	tier: "business",
	limits: {
		storageGB: 100,
		apiCalls: 10_000,
		enclavesEnabled: true,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: false,
	},
	activationToken: "activation-token",
	expiresInSeconds: 3600,
	activatedAt: "2026-08-14T00:00:00.000Z",
};

describe("SessionManager", () => {
	beforeEach(() => {
		vi.resetModules();
		activation.activateSdk.mockReset();
		activation.activateSdk.mockResolvedValue(response);
	});

	afterEach(() => {
		vi.doUnmock("node:fs");
	});

	it("rejects access before activation", async () => {
		const { SessionManager } = await import("./session.js");
		const session = new SessionManager({ apiKey: "key" });

		expect(session.isActivated).toBe(false);
		expect(() => session.getTierGate()).toThrow("Session not activated");
		expect(() => session.tenantId).toThrow("Session not activated");
		expect(() => session.tier).toThrow("Session not activated");
	});

	it("activates against the default platform and exposes a live tier gate", async () => {
		const { SessionManager } = await import("./session.js");
		const session = new SessionManager({ apiKey: "key" });

		const gate = await session.activate();

		expect(activation.activateSdk).toHaveBeenCalledWith({
			apiKey: "key",
			sdkId: "mcp-server",
			sdkVersion: "0.2.0",
			platformUrl: "https://api.qnsi.heossi.com",
		});
		expect(session.isActivated).toBe(true);
		expect(session.tenantId).toBe(response.tenantId);
		expect(session.tier).toBe("business");
		expect(gate.tenantId).toBe(response.tenantId);
		expect(gate.tier).toBe("business");
		expect(gate.limits).toBe(response.limits);
		expect(gate.hasFeature("sseEnabled")).toBe(true);
		expect(gate.hasFeature("vaultEnabled")).toBe(false);
	});

	it("uses an explicit platform URL", async () => {
		const { SessionManager } = await import("./session.js");
		const session = new SessionManager({
			apiKey: "key",
			platformUrl: "https://platform.example",
		});

		await session.activate();

		expect(activation.activateSdk).toHaveBeenCalledWith(
			expect.objectContaining({ platformUrl: "https://platform.example" }),
		);
	});

	it("falls back when package metadata has no version", async () => {
		vi.doMock("node:fs", () => ({ readFileSync: () => "{}" }));
		const { SessionManager } = await import("./session.js");

		await new SessionManager({ apiKey: "key" }).activate();

		expect(activation.activateSdk).toHaveBeenCalledWith(
			expect.objectContaining({ sdkVersion: "0.0.0" }),
		);
	});

	it("falls back when package metadata cannot be read", async () => {
		vi.doMock("node:fs", () => ({
			readFileSync: () => {
				throw new Error("unreadable");
			},
		}));
		const { SessionManager } = await import("./session.js");

		await new SessionManager({ apiKey: "key" }).activate();

		expect(activation.activateSdk).toHaveBeenCalledWith(
			expect.objectContaining({ sdkVersion: "0.0.0" }),
		);
	});
});
