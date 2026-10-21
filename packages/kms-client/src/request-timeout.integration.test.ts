import { once } from "node:events";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { HttpKmsServiceClient } from "./index.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const DATA_KEY = Buffer.alloc(32).toString("base64");

async function closePeer(peer: ReturnType<typeof createServer>): Promise<void> {
	peer.closeAllConnections();
	await new Promise<void>((resolve, reject) => {
		peer.close((error) => (error ? reject(error) : resolve()));
	});
}

describe("HttpKmsServiceClient request deadlines", () => {
	it("rejects invalid request timeout configuration", () => {
		expect(
			() =>
				new HttpKmsServiceClient(
					"http://127.0.0.1:1",
					{ getAuthHeader: async () => undefined },
					{ requestTimeoutMs: 0 },
				),
		).toThrow(new RangeError("requestTimeoutMs must be a positive safe integer"));
	});

	it("aborts a wrap request when the network peer does not respond", async () => {
		const peer = createServer(() => undefined);
		peer.listen(0, "127.0.0.1");
		await once(peer, "listening");

		try {
			const address = peer.address();
			if (!address || typeof address === "string") {
				throw new Error("Loopback peer did not expose a TCP address");
			}
			const client = new HttpKmsServiceClient(
				`http://127.0.0.1:${address.port}`,
				{ getAuthHeader: async () => undefined },
				{ requestTimeoutMs: 50 },
			);
			const startedAt = performance.now();
			await expect(
				client.wrapKey({
					tenantId: TENANT_ID,
					dataKey: DATA_KEY,
					keyId: "request-deadline-key",
				}),
			).rejects.toMatchObject({ name: "TimeoutError" });
			expect(performance.now() - startedAt).toBeLessThan(1_000);
		} finally {
			await closePeer(peer);
		}
	});

	it("composes caller cancellation with the request deadline", async () => {
		let resolveAccepted: (() => void) | undefined;
		const accepted = new Promise<void>((resolve) => {
			resolveAccepted = resolve;
		});
		const peer = createServer(() => resolveAccepted?.());
		peer.listen(0, "127.0.0.1");
		await once(peer, "listening");

		try {
			const address = peer.address();
			if (!address || typeof address === "string") {
				throw new Error("Loopback peer did not expose a TCP address");
			}
			const client = new HttpKmsServiceClient(
				`http://127.0.0.1:${address.port}`,
				{ getAuthHeader: async () => undefined },
				{ requestTimeoutMs: 1_000 },
			);
			const controller = new AbortController();
			const startedAt = performance.now();
			const request = client.wrapKey({
				tenantId: TENANT_ID,
				dataKey: DATA_KEY,
				keyId: "caller-cancellation-key",
				signal: controller.signal,
			});
			await accepted;
			controller.abort();
			await expect(request).rejects.toMatchObject({ name: "AbortError" });
			expect(performance.now() - startedAt).toBeLessThan(1_000);
		} finally {
			await closePeer(peer);
		}
	});
});
