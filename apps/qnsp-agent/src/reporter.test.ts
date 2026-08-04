import * as crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentConfig } from "./config.js";
import { deriveHmacKey, submitReport, submitReportPayload } from "./reporter.js";

const TEST_SECRET = crypto.randomBytes(32).toString("hex");

const testConfig: AgentConfig = {
	agentId: "00000000-0000-0000-0000-000000000001",
	agentSecret: TEST_SECRET,
	endpoint: "https://api.qnsi.heossi.com",
	tenantId: "00000000-0000-0000-0000-000000000002",
	scanPaths: ["/etc/ssl"],
	intervalSecs: 300,
	logLevel: "silent",
	hostname: "test-host",
	stateDir: "/tmp/qnsp-agent-test-state",
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("deriveHmacKey (agent <-> server HMAC contract)", () => {
	it("derives the canonical key: SHA-256 over the DECODED secret bytes (not the hex UTF-8)", () => {
		const secret = crypto.randomBytes(32).toString("hex");
		// Canonical key the crypto-inventory-service hashSecret must also produce.
		const canonical = crypto.createHash("sha256").update(Buffer.from(secret, "hex")).digest();
		expect(deriveHmacKey(secret).equals(canonical)).toBe(true);
		// The old/wrong derivation (hashing the hex string as UTF-8) must differ.
		const utf8Key = crypto.createHash("sha256").update(secret).digest();
		expect(deriveHmacKey(secret).equals(utf8Key)).toBe(false);
	});
});

describe("reporter", () => {
	it("submits a report and returns accepted result", async () => {
		const mockResult = {
			accepted: true,
			agentId: testConfig.agentId,
			assetCount: 1,
			bodyHash: "abc123",
		};

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ status: 202, json: async () => mockResult }),
		);

		const result = await submitReport(testConfig, [
			{ type: "ssh_key", path: "/home/user/.ssh/id_rsa", algorithm: "RSA", keySize: 2048 },
		]);

		expect(result.accepted).toBe(true);
		expect(result.assetCount).toBe(1);

		const fetchMock = vi.mocked(globalThis.fetch);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.qnsi.heossi.com/proxy/crypto/v1/agent-reports");
		expect(init.method).toBe("POST");

		const headers = init.headers as Record<string, string>;
		expect(headers["x-agent-id"]).toBe(testConfig.agentId);
		expect(headers["x-agent-timestamp"]).toBeDefined();
		expect(headers["x-agent-nonce"]).toBeDefined();
		expect(headers["x-agent-body-hash"]).toMatch(/^[0-9a-f]{64}$/);
		expect(headers["x-agent-signature"]).toMatch(/^[0-9a-f]{64}$/);
		expect(headers["x-qnsp-tenant"]).toBe(testConfig.tenantId);
	});

	it("retries on 5xx errors and eventually throws", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ status: 503, text: async () => "Service Unavailable" }),
		);

		// Start the promise and attach catch handler immediately
		const caught = submitReport(testConfig, []).catch((e: unknown) => e);

		// Advance through all exponential backoff sleeps (1s, 2s, 4s → capped at 30s)
		// MAX_RETRIES=3, delays: attempt 1→2s, attempt 2→4s (2^1=2, 2^2=4)
		await vi.advanceTimersByTimeAsync(60_000);

		const result = await caught;
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).message).toContain("Server error (503)");
		expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3);
	});

	it("does not retry on 4xx client errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ status: 401, text: async () => "Unauthorized" }),
		);

		await expect(submitReport(testConfig, [])).rejects.toThrow("Report rejected (401)");
		expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
	}, 10_000);

	it("retries on network errors and rethrows the last error after exhausting retries", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

		const caught = submitReport(testConfig, []).catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(60_000);

		const result = await caught;
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).message).toContain("ECONNRESET");
		// MAX_RETRIES attempts, each ending in the network-error catch branch.
		expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3);
	});

	it("maps a fetch AbortError to a request-timeout error", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const abort = new Error("The operation was aborted");
		abort.name = "AbortError";
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

		const caught = submitReport(testConfig, []).catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(60_000);

		const result = await caught;
		expect((result as Error).message).toBe("Request timed out");
	});

	it("backs off on a 429 rate-limit response and then succeeds", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const accepted = {
			accepted: true,
			agentId: testConfig.agentId,
			assetCount: 0,
			bodyHash: "hash",
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ status: 429 })
			.mockResolvedValueOnce({ status: 202, json: async () => accepted });
		vi.stubGlobal("fetch", fetchMock);

		const pending = submitReport(testConfig, []);
		await vi.advanceTimersByTimeAsync(60_000);
		const result = await pending;

		expect(result.accepted).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("rejects a queued payload whose agentId does not match the configured agent", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			submitReportPayload(testConfig, {
				agentId: "99999999-9999-4999-8999-999999999999",
				hostname: testConfig.hostname,
				reportedAt: new Date().toISOString(),
				assets: [],
			}),
		).rejects.toThrow("does not match configured agent");
		// It must fail before ever hitting the network.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("tolerates a body-read failure on a 4xx client error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				status: 400,
				text: async () => {
					throw new Error("stream closed");
				},
			}),
		);

		await expect(submitReport(testConfig, [])).rejects.toThrow("Report rejected (400)");
		expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
	});

	it("tolerates a body-read failure on a 5xx server error and retries", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				status: 500,
				text: async () => {
					throw new Error("stream closed");
				},
			}),
		);

		const caught = submitReport(testConfig, []).catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(60_000);

		const result = await caught;
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).message).toContain("Server error (500)");
		expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3);
	});

	it("signs the body correctly - signature is verifiable against server protocol", async () => {
		let capturedHeaders: Record<string, string> = {};
		let capturedBody: Buffer = Buffer.alloc(0);

		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation((_url: string, init: RequestInit) => {
				capturedHeaders = init.headers as Record<string, string>;
				capturedBody = init.body as unknown as Buffer;
				return Promise.resolve({
					status: 202,
					json: async () => ({
						accepted: true,
						agentId: testConfig.agentId,
						assetCount: 0,
						bodyHash: "x",
					}),
				});
			}),
		);

		await submitReport(testConfig, []);

		// Verify body hash matches SHA-256(rawBody)
		const computedBodyHash = crypto.createHash("sha256").update(capturedBody).digest("hex");
		expect(capturedHeaders["x-agent-body-hash"]).toBe(computedBodyHash);

		// Verify HMAC signature matches server-side verifySignature() protocol:
		//   hmacKey = SHA-256(bootstrapSecret_bytes)
		//   sig = HMAC-SHA256(hmacKey, timestamp + "." + nonce + "." + bodyHash)
		const hmacKey = crypto
			.createHash("sha256")
			.update(Buffer.from(testConfig.agentSecret, "hex"))
			.digest();
		const sigPayload = `${capturedHeaders["x-agent-timestamp"]}.${capturedHeaders["x-agent-nonce"]}.${capturedHeaders["x-agent-body-hash"]}`;
		const expectedSig = crypto.createHmac("sha256", hmacKey).update(sigPayload).digest("hex");
		expect(capturedHeaders["x-agent-signature"]).toBe(expectedSig);
	});
});
