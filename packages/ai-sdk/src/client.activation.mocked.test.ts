/**
 * The resolvedTenantId guard: live activation always returns a UUID tenant,
 * so the header-skip arm only runs when activation resolves without one.
 */
import { activateSdk } from "@heossihq/qnsi-sdk-activation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiOrchestratorClient } from "./client.js";

vi.mock("@heossihq/qnsi-sdk-activation", () => ({
	activateSdk: vi.fn(),
}));

const activateMock = vi.mocked(activateSdk);
const fetchMock = vi.fn();

beforeEach(() => {
	activateMock.mockReset();
	activateMock.mockResolvedValue({ tenantId: "" } as Awaited<ReturnType<typeof activateSdk>>);
	fetchMock.mockReset();
	fetchMock.mockImplementation(
		async () =>
			new Response(JSON.stringify({ items: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("requests without a resolved tenant id", () => {
	it("omits the auto-injected tenant header", async () => {
		const client = new AiOrchestratorClient({
			baseUrl: "https://ai.qnsp.example",
			apiKey: "k",
			fetchImpl: fetchMock as unknown as typeof fetch,
		});
		await client.listWorkloads();
		const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers;
		expect(headers.get("x-qnsp-tenant-id")).toBeNull();
	});
});
