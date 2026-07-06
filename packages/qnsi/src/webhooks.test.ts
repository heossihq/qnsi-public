import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
	MAX_WEBHOOK_SKEW_MS,
	parseQnsiWebhook,
	QnsiWebhookError,
	verifyQnsiWebhookSignature,
} from "./index.js";

const SECRET = "test-shared-secret";

function sign(body: string, secret: string = SECRET): string {
	return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyQnsiWebhookSignature", () => {
	it("succeeds on a matching signature", () => {
		const body = JSON.stringify({ event_type: "key.rotated" });
		expect(() => verifyQnsiWebhookSignature(body, sign(body), SECRET)).not.toThrow();
	});

	it("rejects a tampered body", () => {
		const body = JSON.stringify({ event_type: "key.rotated" });
		const sig = sign(body);
		const tampered = JSON.stringify({ event_type: "key.deleted" });
		expect(() => verifyQnsiWebhookSignature(tampered, sig, SECRET)).toThrow(/signature mismatch/);
	});

	it("rejects a wrong prefix", () => {
		expect(() => verifyQnsiWebhookSignature("{}", "md5=abcd", SECRET)).toThrow(/sha256=/);
	});

	it("rejects non-hex signature payload", () => {
		expect(() => verifyQnsiWebhookSignature("{}", "sha256=not-hex", SECRET)).toThrow(
			QnsiWebhookError,
		);
	});
});

describe("parseQnsiWebhook", () => {
	it("returns a typed event on the happy path", () => {
		const payload = {
			event_type: "key.rotated",
			event_id: "evt-001",
			occurred_at: "2026-04-30T00:00:00Z",
			payload: { keyId: "key-abc", newVersion: 2 },
		};
		const body = JSON.stringify(payload);
		const event = parseQnsiWebhook({
			body,
			signatureHeader: sign(body),
			timestampHeader: new Date().toISOString(),
			secret: SECRET,
		});
		expect(event.eventType).toBe("key.rotated");
		expect(event.eventId).toBe("evt-001");
		expect(event.payload.keyId).toBe("key-abc");
	});

	it("rejects an old timestamp", () => {
		const body = JSON.stringify({ event_type: "x", event_id: "y", payload: {} });
		const old = new Date(Date.now() - 10 * 60_000).toISOString();
		expect(() =>
			parseQnsiWebhook({ body, signatureHeader: sign(body), timestampHeader: old, secret: SECRET }),
		).toThrow(/too old/);
	});

	it("rejects a future timestamp", () => {
		const body = JSON.stringify({ event_type: "x", event_id: "y", payload: {} });
		const future = new Date(Date.now() + 10 * 60_000).toISOString();
		expect(() =>
			parseQnsiWebhook({
				body,
				signatureHeader: sign(body),
				timestampHeader: future,
				secret: SECRET,
			}),
		).toThrow(/future/);
	});

	it("rejects malformed JSON", () => {
		const body = '{"not-valid-json';
		expect(() => parseQnsiWebhook({ body, signatureHeader: sign(body), secret: SECRET })).toThrow(
			/JSON/,
		);
	});

	it("rejects body missing event_id", () => {
		const body = JSON.stringify({ event_type: "x", occurred_at: "z", payload: {} });
		expect(() => parseQnsiWebhook({ body, signatureHeader: sign(body), secret: SECRET })).toThrow(
			/event_id/,
		);
	});

	it("uses MAX_WEBHOOK_SKEW_MS by default", () => {
		expect(MAX_WEBHOOK_SKEW_MS).toBe(5 * 60 * 1000);
	});
});
