import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../_activation/index.js", () => ({
	activateSdk: vi.fn().mockResolvedValue({
		activated: true,
		tenantId: "00000000-0000-0000-0000-000000000000",
		tier: "free",
		limits: {
			storageGB: 5,
			apiCalls: 1_000,
			enclavesEnabled: false,
			aiTrainingEnabled: false,
			aiInferenceEnabled: false,
			sseEnabled: false,
			vaultEnabled: true,
		},
		activationToken: "act-browser",
		expiresInSeconds: 3_600,
		activatedAt: "2026-08-16T00:00:00.000Z",
	}),
}));

import {
	decryptAfterDownload,
	deserializeCseEnvelope,
	encryptBeforeUpload,
	serializeCseEnvelope,
} from "./encrypt.js";
import {
	createNobleProvider,
	createNobleProviderFactory,
	registerNobleProvider,
} from "./noble-provider.js";
import {
	detectRuntime,
	getLastActivation,
	initializePqcProvider,
	resetProvider,
} from "./provider-setup.js";
import { verifySignature } from "./sign.js";
import {
	configureTelemetry,
	flushTelemetry,
	getTelemetryConfig,
	isTelemetryEnabled,
	recordTelemetryEvent,
	resetTelemetry,
} from "./telemetry.js";

afterEach(() => {
	resetTelemetry();
	vi.unstubAllGlobals();
});

describe("telemetry", () => {
	it("stays inert until configured and enabled", () => {
		expect(getTelemetryConfig()).toBeNull();
		expect(isTelemetryEnabled()).toBe(false);
		// No handler configured: recording is a no-op.
		recordTelemetryEvent("encrypt", "kyber-768", 5, true, "node");

		const events: unknown[] = [];
		configureTelemetry({ enabled: false, onEvent: (e) => events.push(e) });
		expect(isTelemetryEnabled()).toBe(false);
		recordTelemetryEvent("encrypt", "kyber-768", 5, true, "node");
		expect(events).toHaveLength(0);
	});

	it("records events with and without errors and swallows handler throws", () => {
		const events: Array<Record<string, unknown>> = [];
		configureTelemetry({
			enabled: true,
			onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
		});
		expect(isTelemetryEnabled()).toBe(true);
		expect(getTelemetryConfig()?.enabled).toBe(true);

		recordTelemetryEvent("sign", "dilithium-3", 12, true, "browser");
		recordTelemetryEvent("sign", "dilithium-3", 12, false, "browser", "keygen failed");
		expect(events[0]).toMatchObject({
			operation: "sign",
			algorithm: "dilithium-3",
			success: true,
			runtime: "browser",
		});
		expect(events[0]?.["error"]).toBeUndefined();
		expect(events[1]).toMatchObject({ success: false, error: "keygen failed" });

		configureTelemetry({
			enabled: true,
			onEvent: () => {
				throw new Error("handler boom");
			},
		});
		expect(() => recordTelemetryEvent("sign", "d", 1, true, "node")).not.toThrow();
	});

	it("flushes only when enabled with a handler, swallowing flush errors", async () => {
		await expect(flushTelemetry()).resolves.toBeUndefined();

		const onFlush = vi.fn(async () => {});
		configureTelemetry({ enabled: true, onEvent: () => {}, onFlush });
		await flushTelemetry();
		expect(onFlush).toHaveBeenCalledOnce();

		configureTelemetry({ enabled: true, onEvent: () => {} });
		await expect(flushTelemetry()).resolves.toBeUndefined();

		configureTelemetry({
			enabled: true,
			onEvent: () => {},
			onFlush: async () => {
				throw new Error("flush boom");
			},
		});
		await expect(flushTelemetry()).resolves.toBeUndefined();

		resetTelemetry();
		expect(getTelemetryConfig()).toBeNull();
	});
});

describe("provider-setup runtime detection", () => {
	it("reports node, browser, and edge runtimes", () => {
		expect(detectRuntime()).toBe("node");
		vi.stubGlobal("process", { ...process, versions: undefined });
		vi.stubGlobal("window", {});
		vi.stubGlobal("document", {});
		expect(detectRuntime()).toBe("browser");
		vi.unstubAllGlobals();
		vi.stubGlobal("process", { ...process, versions: undefined });
		expect(detectRuntime()).toBe("edge");
	});

	it("reports no activation before the provider initializes", () => {
		resetProvider();
		expect(getLastActivation()).toBeNull();
	});
});

describe("noble provider guards", () => {
	it("refuses algorithms outside the enabled set and non-matching families", async () => {
		const provider = await createNobleProvider({ algorithms: ["kyber-768", "dilithium-3"] });

		await expect(provider.generateKeyPair({ algorithm: "kyber-1024" })).rejects.toThrow(
			"not enabled in this provider instance",
		);
		// An enabled name outside both noble families cannot generate keys.
		const misconfigured = await createNobleProvider({
			algorithms: ["falcon-512" as never],
		});
		await expect(
			misconfigured.generateKeyPair({ algorithm: "falcon-512" as never }),
		).rejects.toThrow("Unsupported algorithm 'falcon-512'");
		await expect(
			provider.encapsulate({ algorithm: "dilithium-3", publicKey: new Uint8Array() }),
		).rejects.toThrow("not a KEM algorithm");
		await expect(
			provider.decapsulate({
				algorithm: "dilithium-3",
				ciphertext: new Uint8Array(),
				privateKey: new Uint8Array(),
			}),
		).rejects.toThrow("not a KEM algorithm");
		await expect(
			provider.sign({
				algorithm: "kyber-768",
				data: new Uint8Array(),
				privateKey: new Uint8Array(),
			}),
		).rejects.toThrow("not a signature algorithm");
		await expect(
			provider.verify({
				algorithm: "kyber-768",
				data: new Uint8Array(),
				signature: new Uint8Array(),
				publicKey: new Uint8Array(),
			}),
		).rejects.toThrow("not a signature algorithm");
	});

	it("factory produces a working provider and the legacy register hook is a no-op", async () => {
		const factory = createNobleProviderFactory();
		const provider = await factory({ algorithms: ["dilithium-3"] });
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-3" });
		const data = new TextEncoder().encode("attest");
		const { signature } = await provider.sign({
			algorithm: "dilithium-3",
			data,
			privateKey: keyPair.privateKey,
		});
		await expect(
			provider.verify({ algorithm: "dilithium-3", data, signature, publicKey: keyPair.publicKey }),
		).resolves.toBe(true);
		expect(registerNobleProvider()).toBeUndefined();
	});
});

describe("sign/encrypt algorithm guards and envelope parsing", () => {
	it("verifySignature refuses non-signature algorithms", async () => {
		await expect(
			verifySignature(new Uint8Array([1]), new Uint8Array([1]), new Uint8Array([1]), "kyber-768"),
		).rejects.toThrow("not a supported signature algorithm");
	});

	it("decryptAfterDownload refuses non-KEM algorithms", async () => {
		await expect(
			decryptAfterDownload(
				{
					algorithm: "dilithium-3",
					kemCiphertext: new Uint8Array(),
					iv: new Uint8Array(12),
					ciphertext: new Uint8Array(),
				} as never,
				new Uint8Array(),
			),
		).rejects.toThrow("not a supported KEM algorithm");
	});

	it("deserializeCseEnvelope rejects every truncation point and round-trips a real envelope", async () => {
		expect(() => deserializeCseEnvelope(new Uint8Array(4))).toThrow("too short");

		const provider = await initializePqcProvider({ apiKey: "envelope-key-000001" });
		const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-768" });
		const envelope = await encryptBeforeUpload(
			new TextEncoder().encode("payload"),
			keyPair.publicKey,
			"kyber-768",
		);
		const serialized = serializeCseEnvelope(envelope);
		const roundTripped = deserializeCseEnvelope(serialized);
		expect(roundTripped.algorithm).toBe("kyber-768");
		const plaintext = await decryptAfterDownload(roundTripped, keyPair.privateKey);
		expect(new TextDecoder().decode(plaintext)).toBe("payload");

		// Truncate at each structural boundary.
		const algLen = new DataView(serialized.buffer).getUint16(0);
		const cases = [
			serialized.slice(0, 2 + algLen - 1), // algorithm bytes cut short
			serialized.slice(0, 2 + algLen + 2), // missing KEM ciphertext length
			serialized.slice(0, 2 + algLen + 4 + 4), // KEM ciphertext cut short
		];
		for (const truncated of cases) {
			if (truncated.length >= 9) {
				expect(() => deserializeCseEnvelope(truncated)).toThrow("Invalid CSE envelope");
			}
		}

		// IV-length truncations: cut immediately after the KEM ciphertext.
		const kemLen = new DataView(serialized.buffer).getUint32(2 + algLen);
		const ivBoundary = 2 + algLen + 4 + kemLen;
		expect(() => deserializeCseEnvelope(serialized.slice(0, ivBoundary))).toThrow(
			"missing IV length",
		);
		expect(() => deserializeCseEnvelope(serialized.slice(0, ivBoundary + 1))).toThrow(
			"IV length exceeds data",
		);
	});
});
