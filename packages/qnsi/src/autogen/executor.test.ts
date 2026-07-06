/**
 * QnsiExecutor unit tests.
 *
 * The executor was folded in from the former standalone
 * `@heossi/qnsi-autogen-qnsp`; its workload submit/get HTTP is now inlined,
 * so these tests mock `globalThis.fetch` (the real seam) rather than the
 * former `@heossi/qnsi-ai-sdk` client. Same behaviors asserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QnsiExecutorConfig } from "./executor.js";
import { QnsiExecutor } from "./executor.js";

// ─── fetch test double ────────────────────────────────────────────────────────

interface FakeResponseSpec {
	readonly status?: number;
	readonly body: unknown;
}

function jsonResponse(spec: FakeResponseSpec): Response {
	const status = spec.status ?? 200;
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => JSON.stringify(spec.body),
	} as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** First call = submit (POST /ai/v1/workloads); subsequent = getWorkload (GET). */
function expectSubmitBody(): Record<string, unknown> {
	const call = fetchMock.mock.calls[0];
	expect(call).toBeDefined();
	const [url, init] = call as [string, RequestInit];
	expect(String(url)).toContain("/ai/v1/workloads");
	expect(init.method).toBe("POST");
	return JSON.parse(String(init.body)) as Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_CONFIG: QnsiExecutorConfig = {
	apiKey: "qnsp_test_key",
	tenantId: "tenant-uuid-5678",
	pollIntervalMs: 0,
	pollTimeoutMs: 5_000,
};

function makeExecutor(overrides?: Partial<QnsiExecutorConfig>): QnsiExecutor {
	return new QnsiExecutor({ ...BASE_CONFIG, ...overrides });
}

function makeWorkloadDetail(status: string, overrides?: Record<string, unknown>) {
	return {
		id: "workload-abc",
		tenantId: "tenant-uuid-5678",
		name: "autogen-python-test",
		status,
		priority: "normal",
		schedulingPolicy: "spot",
		createdAt: "2026-04-07T00:00:00Z",
		updatedAt: "2026-04-07T00:00:01Z",
		acceptedAt: "2026-04-07T00:00:00Z",
		completedAt: "2026-04-07T00:00:01Z",
		labels: {},
		security: {
			controlPlaneTokenSha256: null,
			pqcSignatures: [{ provider: "liboqs", algorithm: "ML-DSA-87" }],
			hardwareProvider: "aws-nitro",
			attestationStatus: "verified",
			attestationProof: "proof-abc123",
		},
		manifest: { pqcSignature: "", algorithm: "none", issuedAt: "2026-04-07T00:00:00Z" },
		resources: { cpu: 1, memoryGiB: 2, gpu: 0, acceleratorType: "nvidia-a100" },
		artifacts: [],
		schedulerMetadata: null,
		...overrides,
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("QnsiExecutor", () => {
	describe("execute()", () => {
		it("submits workload and returns result after polling to succeeded", async () => {
			fetchMock
				.mockResolvedValueOnce(
					jsonResponse({
						body: {
							workloadId: "workload-abc",
							status: "pending",
							replayed: false,
							acceptedAt: "2026-04-07T00:00:00Z",
						},
					}),
				)
				.mockResolvedValueOnce(jsonResponse({ body: makeWorkloadDetail("succeeded") }));

			const executor = makeExecutor();
			const result = await executor.execute({ code: "print('hello')", language: "python" });

			expect(result.workloadId).toBe("workload-abc");
			expect(result.status).toBe("succeeded");
			expect(result.replayed).toBe(false);
			expect(result.attestationProof).toBe("proof-abc123");
			expect(result.hardwareProvider).toBe("aws-nitro");
			expect(result.completedAt).toBe("2026-04-07T00:00:01Z");
		});

		it("returns immediately when submit returns a terminal status (replayed)", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					body: {
						workloadId: "workload-xyz",
						status: "succeeded",
						replayed: true,
						acceptedAt: "2026-04-06T00:00:00Z",
					},
				}),
			);

			const executor = makeExecutor();
			const result = await executor.execute({
				code: "print('idempotent')",
				idempotencyKey: "key-123",
			});

			expect(result.workloadId).toBe("workload-xyz");
			expect(result.status).toBe("succeeded");
			expect(result.replayed).toBe(true);
			expect(result.attestationProof).toBeNull();
			expect(fetchMock).toHaveBeenCalledTimes(1);
			// idempotency key travels as the header, not the body
			const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>)["idempotency-key"]).toBe("key-123");
			expect(JSON.parse(String(init.body))).not.toHaveProperty("idempotencyKey");
		});

		it("polls multiple times before reaching terminal state", async () => {
			fetchMock
				.mockResolvedValueOnce(
					jsonResponse({
						body: {
							workloadId: "workload-poll",
							status: "pending",
							replayed: false,
							acceptedAt: null,
						},
					}),
				)
				.mockResolvedValueOnce(jsonResponse({ body: makeWorkloadDetail("scheduled") }))
				.mockResolvedValueOnce(jsonResponse({ body: makeWorkloadDetail("running") }))
				.mockResolvedValueOnce(jsonResponse({ body: makeWorkloadDetail("succeeded") }));

			const executor = makeExecutor();
			const result = await executor.execute({ code: "import time; time.sleep(1)" });

			// 1 submit + 3 polls
			expect(fetchMock).toHaveBeenCalledTimes(4);
			expect(result.status).toBe("succeeded");
		});

		it("uses correct command for bash language", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					body: { workloadId: "w1", status: "succeeded", replayed: false, acceptedAt: null },
				}),
			);
			await makeExecutor().execute({ code: "echo hello", language: "bash" });
			expect(expectSubmitBody().command).toEqual(["bash", "-c", "echo hello"]);
		});

		it("uses correct command for javascript language", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					body: { workloadId: "w1", status: "succeeded", replayed: false, acceptedAt: null },
				}),
			);
			await makeExecutor().execute({ code: "console.log('hi')", language: "javascript" });
			expect(expectSubmitBody().command).toEqual(["node", "-e", "console.log('hi')"]);
		});

		it("passes env vars to the workload", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					body: { workloadId: "w1", status: "succeeded", replayed: false, acceptedAt: null },
				}),
			);
			await makeExecutor().execute({
				code: "print(os.environ['MY_VAR'])",
				env: { MY_VAR: "secret-value" },
			});
			expect(expectSubmitBody().env).toEqual({ MY_VAR: "secret-value" });
		});

		it("uses on-demand scheduling when gpu > 0", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					body: { workloadId: "w1", status: "succeeded", replayed: false, acceptedAt: null },
				}),
			);
			await makeExecutor({ gpu: 1 }).execute({ code: "import torch" });
			const body = expectSubmitBody();
			expect(body.schedulingPolicy).toBe("on-demand");
			expect((body.resources as Record<string, unknown>).gpu).toBe(1);
		});

		it("uses spot scheduling when gpu is 0", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					body: { workloadId: "w1", status: "succeeded", replayed: false, acceptedAt: null },
				}),
			);
			await makeExecutor().execute({ code: "print('cpu only')" });
			expect(expectSubmitBody().schedulingPolicy).toBe("spot");
		});

		it("throws on unsupported language", async () => {
			const executor = makeExecutor();
			await expect(
				// @ts-expect-error — intentionally passing invalid language
				executor.execute({ code: "SELECT 1", language: "sql" }),
			).rejects.toThrow("Unsupported language: sql");
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("throws when poll timeout is exceeded", async () => {
			fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
				if (init.method === "POST") {
					return jsonResponse({
						body: { workloadId: "w-slow", status: "running", replayed: false, acceptedAt: null },
					});
				}
				return jsonResponse({ body: makeWorkloadDetail("running") });
			});

			const executor = makeExecutor({ pollTimeoutMs: 50, pollIntervalMs: 10 });
			await expect(executor.execute({ code: "import time; time.sleep(999)" })).rejects.toThrow(
				"did not complete within",
			);
		});

		it("propagates submit errors", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ status: 400, body: { message: "AI API error: bad request" } }),
			);
			const executor = makeExecutor();
			await expect(executor.execute({ code: "print('x')" })).rejects.toThrow(
				"AI API error: bad request",
			);
		});

		it("handles missing security profile gracefully", async () => {
			fetchMock
				.mockResolvedValueOnce(
					jsonResponse({
						body: { workloadId: "w1", status: "pending", replayed: false, acceptedAt: null },
					}),
				)
				.mockResolvedValueOnce(
					jsonResponse({ body: makeWorkloadDetail("succeeded", { security: null }) }),
				);

			const result = await makeExecutor().execute({ code: "print('x')" });
			expect(result.attestationProof).toBeNull();
			expect(result.hardwareProvider).toBeNull();
		});
	});
});
