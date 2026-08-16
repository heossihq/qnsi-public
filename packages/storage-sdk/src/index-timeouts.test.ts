/**
 * The real timeout arms: each client operation arms an AbortController timer;
 * these tests let the timer FIRE (signal-aware hanging fetch + fake timers)
 * instead of hand-throwing AbortError, so the setTimeout callbacks execute.
 */
import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageEventsClient } from "./events.js";
import { StorageClient } from "./index.js";

const TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const DOC = "44444444-4444-4444-a444-444444444444";
const UPLOAD = "11111111-1111-4111-a111-111111111111";

const ACTIVATION = {
	activated: true,
	tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
	tier: "dev-pro",
	activationToken: "tok_test",
	expiresInSeconds: 3600,
	activatedAt: new Date().toISOString(),
	limits: {
		storageGB: 50,
		apiCalls: 100_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
};

const fetchMock = vi.fn();

/** Resolves activation immediately; hangs everything else until aborted. */
function hangingGateway(url: string, init?: RequestInit): Promise<Response> {
	if (String(url).includes("/sdk/activate")) {
		return Promise.resolve(
			new Response(JSON.stringify(ACTIVATION), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
	}
	return new Promise((_, reject) => {
		init?.signal?.addEventListener("abort", () => {
			const error = new Error("This operation was aborted");
			error.name = "AbortError";
			reject(error);
		});
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	clearActivationCache();
	fetchMock.mockReset();
	fetchMock.mockImplementation(hangingGateway);
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("timeout timers actually fire", () => {
	it("request() aborts after timeoutMs", async () => {
		const client = new StorageClient({
			apiKey: "k",
			tenantId: TENANT,
			timeoutMs: 250,
		});
		const pending = client.getTieringStats().catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(300);
		expect(String(await pending)).toContain("Request timeout after 250ms");
	});

	it("uploadPart() aborts after timeoutMs", async () => {
		const client = new StorageClient({
			apiKey: "k",
			tenantId: TENANT,
			timeoutMs: 250,
		});
		const pending = client.uploadPart(UPLOAD, 1, new Uint8Array([1])).catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(300);
		expect(String(await pending)).toContain("Request timeout after 250ms");
	});

	it("downloadStream() aborts after timeoutMs", async () => {
		const client = new StorageClient({
			apiKey: "k",
			tenantId: TENANT,
			timeoutMs: 250,
		});
		const pending = client.downloadStream(DOC, 1).catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(300);
		expect(String(await pending)).toContain("Request timeout after 250ms");
	});

	it("fetchEvents() aborts after timeoutMs", async () => {
		const client = new StorageEventsClient({
			baseUrl: "https://storage.qnsp.example",
			timeoutMs: 250,
		});
		fetchMock.mockImplementation(
			(_url: string, init?: RequestInit) =>
				new Promise((_, reject) => {
					init?.signal?.addEventListener("abort", () => {
						const error = new Error("This operation was aborted");
						error.name = "AbortError";
						reject(error);
					});
				}),
		);
		const pending = client.fetchEvents("topic").catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(300);
		expect(String(await pending)).toContain("Event request timeout after 250ms");
	});
});
