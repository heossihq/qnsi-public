/**
 * The resolvedTenantId guards: the live activation contract always returns a
 * UUID tenant id, so the header-skip arms only run if activation resolves
 * without one. The activation module is mocked to produce exactly that state.
 */
import { activateSdk } from "@heossihq/qnsi-sdk-activation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageClient } from "./index.js";

vi.mock("@heossihq/qnsi-sdk-activation", () => ({
	activateSdk: vi.fn(),
}));

const activateMock = vi.mocked(activateSdk);
const fetchMock = vi.fn();
const TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const DOC = "44444444-4444-4444-a444-444444444444";
const UPLOAD = "11111111-1111-4111-a111-111111111111";

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

beforeEach(() => {
	activateMock.mockReset();
	activateMock.mockResolvedValue({ tenantId: "" } as Awaited<ReturnType<typeof activateSdk>>);
	fetchMock.mockReset();
	// Fresh Response per call: bodies are single-use.
	fetchMock.mockImplementation(async () => jsonResponse({ ok: true }));
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("requests without a resolved tenant id", () => {
	it("omits the auto-injected tenant header on request, uploadPart, and downloadStream", async () => {
		const client = new StorageClient({ apiKey: "k", tenantId: TENANT });

		await client.getTieringStats();
		await client.uploadPart(UPLOAD, 1, new Uint8Array([1]));
		fetchMock.mockResolvedValueOnce(
			new Response(null, { status: 200, headers: { "Content-Length": "0" } }),
		);
		await client.downloadStream(DOC, 1);

		for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
			const headers = init.headers as Record<string, string>;
			// The configured tenant still flows where routes require it explicitly;
			// the activation-resolved auto-injection stays absent.
			expect(
				headers["x-qnsp-tenant-id"] === TENANT || headers["x-qnsp-tenant-id"] === undefined,
			).toBe(true);
		}
	});
});
