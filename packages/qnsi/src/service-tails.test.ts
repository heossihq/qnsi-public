import { describe, expect, it } from "vitest";

import { AuditClient } from "./audit.js";
import { QnsiApiError, QnsiWebhookError } from "./errors.js";
import { KmsClient } from "./kms.js";
import { StorageClient } from "./storage.js";
import { VaultClient } from "./vault.js";
import { parseQnsiWebhook } from "./webhooks.js";

/** Captures what Internal.request() would have sent and answers from a queue. */
function spy(responses: unknown[] = [{}]) {
	const calls: Array<{ method: string; path: string; body: unknown }> = [];
	const queue = [...responses];
	const internal = {
		request: async (method: string, path: string, body?: unknown) => {
			calls.push({ method, path, body });
			return queue.length > 0 ? queue.shift() : {};
		},
	};
	return { internal: internal as never, calls };
}

const B64_DATA = Buffer.from("payload-bytes").toString("base64");

describe("kms response guards", () => {
	it("decodes present signatures and wrapped/unwrapped material", async () => {
		const { internal } = spy([
			{ signature: B64_DATA },
			{ wrappedKey: B64_DATA },
			{ ciphertextB64: B64_DATA },
			{ dataKey: B64_DATA },
			{ plaintextB64: B64_DATA },
			{ signature: B64_DATA },
		]);
		const kms = new KmsClient(internal);
		expect(Buffer.from(await kms.sign("k1", new Uint8Array([1]))).toString()).toBe("payload-bytes");
		expect(Buffer.from(await kms.wrap("k1", new Uint8Array([1]))).toString()).toBe("payload-bytes");
		// wrappedKey absent, ciphertextB64 fallback
		expect(Buffer.from(await kms.wrap("k1", new Uint8Array([1]))).toString()).toBe("payload-bytes");
		expect(Buffer.from(await kms.unwrap("k1", new Uint8Array([1]))).toString()).toBe(
			"payload-bytes",
		);
		// dataKey absent, plaintextB64 fallback
		expect(Buffer.from(await kms.unwrap("k1", new Uint8Array([1]))).toString()).toBe(
			"payload-bytes",
		);
		expect(
			Buffer.from(await kms.hspkSign("conn-1", "k1", B64_DATA, new Uint8Array([1]))).toString(),
		).toBe("payload-bytes");
	});

	it("throws QnsiApiError when responses omit the cryptographic material", async () => {
		const { internal } = spy([{}, {}, {}, {}]);
		const kms = new KmsClient(internal);
		await expect(kms.sign("k1", new Uint8Array([1]))).rejects.toThrow(
			"kms.sign: response missing signature",
		);
		await expect(kms.wrap("k1", new Uint8Array([1]))).rejects.toThrow(
			"kms.wrap: response missing wrappedKey/ciphertextB64",
		);
		await expect(kms.unwrap("k1", new Uint8Array([1]))).rejects.toThrow(
			"kms.unwrap: response missing dataKey/plaintextB64",
		);
		await expect(kms.hspkSign("conn-1", "k1", B64_DATA, new Uint8Array([1]))).rejects.toThrow(
			"kms.hspkSign: response missing signature",
		);
	});
});

describe("storage response guards", () => {
	it("returns decoded object bytes and rejects responses without dataB64", async () => {
		const { internal } = spy([{ dataB64: B64_DATA, contentType: "text/plain" }, {}]);
		const storage = new StorageClient(internal);
		const [bytes, resp] = await storage.getObject("bucket-1", "key-1");
		expect(Buffer.from(bytes).toString()).toBe("payload-bytes");
		expect(resp).toMatchObject({ contentType: "text/plain" });
		await expect(storage.getObject("bucket-1", "key-1")).rejects.toBeInstanceOf(QnsiApiError);
	});
});

describe("storage putObject optional fields", () => {
	it("defaults the SSE algorithm and includes contentType/metadata only when given", async () => {
		const { internal, calls } = spy([{}, {}]);
		const storage = new StorageClient(internal);
		await storage.putObject("bucket-1", "key-1", { data: new Uint8Array([1, 2]) });
		await storage.putObject("bucket-1", "key-2", {
			data: new Uint8Array([3]),
			sseAlgorithm: "custom-scheme",
			contentType: "application/pdf",
			metadata: { source: "test" },
		});
		const bodies = calls.map((call) => call.body as Record<string, unknown>);
		expect(bodies[0]?.["sseAlgorithm"]).toBeDefined();
		expect(bodies[0]?.["contentType"]).toBeUndefined();
		expect(bodies[0]?.["metadata"]).toBeUndefined();
		expect(bodies[1]).toMatchObject({
			sseAlgorithm: "custom-scheme",
			contentType: "application/pdf",
			metadata: { source: "test" },
		});
	});
});

describe("vault lookup and rotation arms", () => {
	it("getSecretValueByName resolves ids, tolerates misses, and null values", async () => {
		const { internal } = spy([
			{ secrets: [{ name: "hit", id: "sec-1" }] },
			{ value: "resolved" },
			{ secrets: [{ name: "other", id: "sec-2" }] },
			{ secrets: [{ name: "no-id" }] },
			{ secrets: [{ name: "null-value", id: "sec-3" }] },
			{},
		]);
		const vault = new VaultClient(internal);
		expect(await vault.getSecretValueByName("hit")).toBe("resolved");
		expect(await vault.getSecretValueByName("hit-miss")).toBeNull();
		expect(await vault.getSecretValueByName("no-id")).toBeNull();
		expect(await vault.getSecretValueByName("null-value")).toBeNull();

		const { internal: nullInternal } = spy([null]);
		expect(await new VaultClient(nullInternal).getSecretValueByName("anything")).toBeNull();
	});

	it("rotateSecret maps payload and folds algorithm into metadata only when given", async () => {
		const { internal, calls } = spy([{}, {}]);
		const vault = new VaultClient(internal);
		await vault.rotateSecret("sec-1", B64_DATA);
		await vault.rotateSecret("sec-1", B64_DATA, "kyber-768");
		const bodies = calls.map((call) => call.body as Record<string, unknown>);
		expect(bodies[0]).toEqual({ newPayload: B64_DATA });
		expect(bodies[1]).toEqual({ newPayload: B64_DATA, metadata: { algorithm: "kyber-768" } });
	});
});

describe("audit event bodies", () => {
	it("includes tags only when present and non-empty", async () => {
		const { internal, calls } = spy([{}, {}, {}]);
		const audit = new AuditClient(internal);
		await audit.logEvent({ eventType: "cli.test", payload: { n: 1 }, tags: ["a", "b"] });
		await audit.logEvent({ eventType: "cli.test", payload: { n: 2 }, tags: [] });
		await audit.logEvent({ eventType: "cli.test", payload: { n: 3 } });
		const details = calls.map(
			(call) => (call.body as { details: Record<string, unknown> }).details,
		);
		expect(details[0]).toEqual({ n: 1, tags: ["a", "b"] });
		expect(details[1]).toEqual({ n: 2 });
		expect(details[2]).toEqual({ n: 3 });
	});
});

describe("vault createSecret metadata folding", () => {
	it("folds the algorithm into metadata and tolerates missing metadata", async () => {
		const { internal, calls } = spy([{}, {}, {}]);
		const vault = new VaultClient(internal);
		await vault.createSecret({
			name: "secret-1",
			payloadB64: B64_DATA,
			metadata: { owner: "ops" },
			algorithm: "kyber-768",
		});
		await vault.createSecret({ name: "secret-2", payloadB64: B64_DATA });
		await vault.createSecret({ name: "secret-3", payloadB64: B64_DATA, algorithm: "kyber-1024" });
		const bodies = calls.map((call) => call.body as Record<string, unknown>);
		expect(bodies[0]).toEqual({
			name: "secret-1",
			payload: B64_DATA,
			metadata: { owner: "ops", algorithm: "kyber-768" },
		});
		expect(bodies[1]?.["metadata"]).toEqual({});
		expect(bodies[2]?.["metadata"]).toEqual({ algorithm: "kyber-1024" });
	});
});

describe("webhook verification tails", () => {
	const SECRET = "webhook-secret-000001";

	async function signedBody(payload: Record<string, unknown>): Promise<{
		body: string;
		signature: string;
	}> {
		const body = JSON.stringify(payload);
		const { createHmac } = await import("node:crypto");
		return { body, signature: `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}` };
	}

	it("rejects unparseable timestamp headers", async () => {
		const { body, signature } = await signedBody({ event_type: "t", event_id: "e" });
		expect(() =>
			parseQnsiWebhook({
				body,
				signatureHeader: signature,
				secret: SECRET,
				timestampHeader: "not-a-date",
			}),
		).toThrow(new QnsiWebhookError("timestamp header is not RFC3339").message);
	});

	it("accepts byte bodies and honors an injected reference clock", async () => {
		const { body, signature } = await signedBody({ event_type: "t", event_id: "e" });
		const now = new Date("2026-08-16T00:00:00Z");
		const event = parseQnsiWebhook({
			body: new TextEncoder().encode(body),
			signatureHeader: signature,
			secret: SECRET,
			timestampHeader: new Date(now.getTime() - 1_000).toISOString(),
			now,
		});
		expect(event.eventType).toBe("t");
		expect(event.eventId).toBe("e");
	});

	it("rejects bodies that are not valid JSON objects", async () => {
		const { createHmac } = await import("node:crypto");
		const raw = "not-json";
		const signature = `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
		expect(() =>
			parseQnsiWebhook({ body: raw, signatureHeader: signature, secret: SECRET }),
		).toThrow("body is not valid JSON");

		const arrayBody = JSON.stringify([1, 2]);
		const arraySig = `sha256=${createHmac("sha256", SECRET).update(arrayBody).digest("hex")}`;
		expect(() =>
			parseQnsiWebhook({ body: arrayBody, signatureHeader: arraySig, secret: SECRET }),
		).toThrow("body is not a JSON object");

		const nullBody = "null";
		const nullSig = `sha256=${createHmac("sha256", SECRET).update(nullBody).digest("hex")}`;
		expect(() =>
			parseQnsiWebhook({ body: nullBody, signatureHeader: nullSig, secret: SECRET }),
		).toThrow("body is not a JSON object");
	});

	it("rejects payloads without a string event_type", async () => {
		const { body, signature } = await signedBody({ event_id: "e", event_type: 42 });
		expect(() => parseQnsiWebhook({ body, signatureHeader: signature, secret: SECRET })).toThrow(
			"missing event_type",
		);
	});
});
