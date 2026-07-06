import { beforeEach, describe, expect, it, vi } from "vitest";

// Replace the activation handshake with a vi.fn so these tests assert the
// branching in initializeExternalPqcProvider without a network round-trip.
vi.mock("@heossi/qnsi-sdk-activation", () => ({
	activateSdk: vi.fn(async () => ({ activated: true })),
}));

import { activateSdk } from "@heossi/qnsi-sdk-activation";

import { createTestPqcProvider } from "../testing/providers.js";
import {
	type ExternalPqcProviderFactory,
	initializeExternalPqcProvider,
	listExternalPqcProviders,
	registerExternalPqcProvider,
	unregisterExternalPqcProvider,
} from "./external.js";

const activate = vi.mocked(activateSdk);

function register(name: string): void {
	const factory: ExternalPqcProviderFactory = {
		metadata: { name, supportedAlgorithms: ["kyber-768"] },
		create: async () => createTestPqcProvider(),
	};
	registerExternalPqcProvider(factory);
}

describe("initializeExternalPqcProvider — activation gate (v0.2.0)", () => {
	beforeEach(() => {
		activate.mockClear();
		for (const provider of listExternalPqcProviders()) {
			unregisterExternalPqcProvider(provider.name);
		}
	});

	it("rejects with the v0.2.0 apiKey-required error when called with no options at all", async () => {
		register("act-no-options");
		// No options object → exercises the `options ?? {}` fallback and the
		// not-internal + no-apiKey rejection path.
		await expect(initializeExternalPqcProvider("act-no-options")).rejects.toThrow(
			/requires `options\.apiKey`/,
		);
		expect(activate).not.toHaveBeenCalled();
	});

	it("rejects when apiKey is a blank string and not internal", async () => {
		register("act-blank-key");
		await expect(initializeExternalPqcProvider("act-blank-key", { apiKey: "   " })).rejects.toThrow(
			/free-forever tier/,
		);
		expect(activate).not.toHaveBeenCalled();
	});

	it("rejects when apiKey is a non-string value and not internal", async () => {
		register("act-nonstring-key");
		await expect(
			initializeExternalPqcProvider("act-nonstring-key", {
				apiKey: 12345 as unknown as string,
			}),
		).rejects.toThrow(/requires `options\.apiKey`/);
		expect(activate).not.toHaveBeenCalled();
	});

	it("runs the activation handshake and forwards platformUrl when one is supplied", async () => {
		register("act-with-url");
		const provider = await initializeExternalPqcProvider("act-with-url", {
			apiKey: "qnsp_live_key",
			platformUrl: "https://api.example.test",
		});
		expect(provider).toBeDefined();
		expect(activate).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledWith({
			apiKey: "qnsp_live_key",
			sdkId: "cryptography",
			sdkVersion: "0.2.0",
			platformUrl: "https://api.example.test",
		});
	});

	it("runs the activation handshake without a platformUrl key when none is supplied", async () => {
		register("act-no-url");
		const provider = await initializeExternalPqcProvider("act-no-url", {
			apiKey: "qnsp_live_key",
		});
		expect(provider).toBeDefined();
		expect(activate).toHaveBeenCalledTimes(1);
		const callArg = activate.mock.calls[0]?.[0];
		expect(callArg).toMatchObject({
			apiKey: "qnsp_live_key",
			sdkId: "cryptography",
			sdkVersion: "0.2.0",
		});
		expect(callArg && "platformUrl" in callArg).toBe(false);
	});

	it("skips activation entirely for internal QNSP callers", async () => {
		register("act-internal");
		const provider = await initializeExternalPqcProvider("act-internal", { internal: true });
		expect(provider).toBeDefined();
		expect(activate).not.toHaveBeenCalled();
	});
});
