import { createHash } from "node:crypto";
import { ReadableStream } from "node:stream/web";

import { clearActivationCache } from "@heossi/qnsi-sdk-activation";
import { beforeEach, describe, expect, it } from "vitest";

import { AiOrchestratorClient } from "./client.js";

const ACTIVATION_RESPONSE = {
	activated: true as const,
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

function makeActivationResponse(): Response {
	return new Response(JSON.stringify(ACTIVATION_RESPONSE), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

describe("AiOrchestratorClient", () => {
	beforeEach(() => {
		clearActivationCache();
	});

	it("submits workload requests with resolved headers", async () => {
		const mockFetch: typeof fetch = async (input, init) => {
			const url = new URL(input as string | URL, "https://example.com");
			if (url.pathname === "/billing/v1/sdk/activate") {
				return makeActivationResponse();
			}
			expect(init?.headers).toBeDefined();
			expect(url.pathname).toBe("/ai/v1/workloads");
			return new Response(
				JSON.stringify({
					workloadId: "test-workload",
					status: "scheduled",
					replayed: false,
					acceptedAt: new Date().toISOString(),
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		};

		const client = new AiOrchestratorClient({
			baseUrl: "https://example.com",
			apiKey: "test-token",
			fetchImpl: mockFetch,
		});

		const response = await client.submitWorkload({
			tenantId: "00000000-0000-0000-0000-000000000001",
			name: "unit-test",
			priority: "normal",
			schedulingPolicy: "on-demand",
			containerImage: "registry.example.com/test:latest",
			command: ["bin/run"],
			env: { KEY: "VALUE" },
			resources: {
				cpu: 2,
				memoryGiB: 8,
				gpu: 0,
				acceleratorType: "none",
			},
			artifacts: [],
			manifest: {
				pqcSignature: "deadbeef",
				algorithm: "dilithium-3",
				issuedAt: new Date().toISOString(),
			},
		});

		expect(response.workloadId).toBe("test-workload");
	});

	it("returns workload detail with security profile", async () => {
		const mockFetch: typeof fetch = async (input) => {
			const url = new URL(input as string | URL, "https://example.com");
			if (url.pathname === "/billing/v1/sdk/activate") {
				return makeActivationResponse();
			}
			expect(url.pathname).toBe("/ai/v1/workloads/aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee");
			return new Response(
				JSON.stringify({
					id: "abc",
					tenantId: "00000000-0000-0000-0000-000000000001",
					name: "test",
					status: "scheduled",
					priority: "normal",
					schedulingPolicy: "on-demand",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					acceptedAt: new Date().toISOString(),
					completedAt: null,
					labels: {},
					security: {
						controlPlaneTokenSha256: "deadbeef",
						pqcSignatures: [{ provider: "deterministic-pqc", algorithm: "dilithium-3" }],
						hardwareProvider: "gpu-fleet",
						attestationStatus: "verified",
						attestationProof: "proof",
					},
					manifest: {},
					resources: { cpu: 1, memoryGiB: 4, gpu: 0, acceleratorType: "none" },
					artifacts: [],
					schedulerMetadata: null,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		};

		const client = new AiOrchestratorClient({
			baseUrl: "https://example.com",
			apiKey: "test-token",
			fetchImpl: mockFetch,
		});

		const result = await client.getWorkload("aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee");
		expect(result.security.controlPlaneTokenSha256).toBe("deadbeef");
		expect(result.security.pqcSignatures).toHaveLength(1);
		expect(result.security.hardwareProvider).toBe("gpu-fleet");
		expect(result.security.attestationStatus).toBe("verified");
		expect(result.security.attestationProof).toBe("proof");
	});

	it("lists workloads and surfaces security metadata", async () => {
		const mockFetch: typeof fetch = async (input) => {
			const url = new URL(input as string | URL, "https://example.com");
			if (url.pathname === "/billing/v1/sdk/activate") {
				return makeActivationResponse();
			}
			expect(url.pathname).toBe("/ai/v1/workloads");
			return new Response(
				JSON.stringify({
					items: [
						{
							id: "abc",
							tenantId: "00000000-0000-0000-0000-000000000001",
							name: "test",
							status: "scheduled",
							priority: "normal",
							schedulingPolicy: "on-demand",
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							acceptedAt: new Date().toISOString(),
							completedAt: null,
							labels: {},
							security: {
								controlPlaneTokenSha256: "deadbeef",
								pqcSignatures: [{ provider: "deterministic-pqc", algorithm: "dilithium-3" }],
								hardwareProvider: "gpu-fleet",
								attestationStatus: "verified",
								attestationProof: "proof",
							},
						},
					],
					nextCursor: null,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		};

		const client = new AiOrchestratorClient({
			baseUrl: "https://example.com",
			apiKey: "test-token",
			fetchImpl: mockFetch,
		});

		const result = await client.listWorkloads();
		expect(result.items[0]?.security.controlPlaneTokenSha256).toBe("deadbeef");
		expect(result.items[0]?.security.hardwareProvider).toBe("gpu-fleet");
		expect(result.items[0]?.security.attestationStatus).toBe("verified");
		expect(result.items[0]?.security.attestationProof).toBe("proof");
	});

	it("deploys a model using packaged manifest metadata", async () => {
		const manifest = {
			modelName: "resnet",
			version: "1.0.0",
			createdAt: new Date().toISOString(),
			files: [
				{
					path: "weights.bin",
					sizeBytes: 1024,
					checksumSha3_512: "d3adbeef",
				},
			],
		};
		const digest = createHash("sha3-512").update(JSON.stringify(manifest)).digest("hex");
		const mockFetch: typeof fetch = async (input, init) => {
			const url = new URL(input as string | URL, "https://example.com");
			if (url.pathname === "/billing/v1/sdk/activate") {
				return makeActivationResponse();
			}
			expect(url.pathname).toBe("/ai/v1/workloads");
			const body = JSON.parse(init?.body as string);
			expect(body.name).toBe("resnet-deployment");
			expect(body.manifest.pqcSignature).toBe(digest);
			expect(body.manifest.modelPackage).toEqual(manifest);
			expect(body.env.MODEL_NAME).toBe("resnet");
			return new Response(
				JSON.stringify({
					workloadId: "deployment-workload",
					status: "scheduled",
					replayed: false,
					acceptedAt: new Date().toISOString(),
				}),
				{ status: 200 },
			);
		};

		const client = new AiOrchestratorClient({
			baseUrl: "https://example.com",
			apiKey: "test-token",
			fetchImpl: mockFetch,
		});

		const response = await client.deployModel({
			tenantId: "00000000-0000-0000-0000-000000000001",
			modelName: "resnet",
			artifactId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
			artifactVersion: 1,
			runtimeImage: "registry.example.com/resnet:latest",
			resources: {
				cpu: 4,
				memoryGiB: 16,
				gpu: 1,
				acceleratorType: "nvidia-h100",
			},
			manifest,
		});

		expect(response.workloadId).toBe("deployment-workload");
	});

	it("invokes inference with payload serialization", async () => {
		const mockFetch: typeof fetch = async (input, init) => {
			const url = new URL(input as string | URL, "https://example.com");
			if (url.pathname === "/billing/v1/sdk/activate") {
				return makeActivationResponse();
			}
			expect(url.pathname).toBe("/ai/v1/inference");
			const body = JSON.parse(init?.body as string);
			expect(body.tenantId).toBe("00000000-0000-0000-0000-000000000001");
			expect(body.modelDeploymentId).toBe("deployment-id");
			expect(body.input).toEqual({ prompt: "hello" });
			return new Response(
				JSON.stringify({
					inferenceId: "inference-123",
					workloadId: "workload-xyz",
					status: "scheduled",
					acceptedAt: new Date().toISOString(),
					replayed: false,
				}),
				{ status: 200 },
			);
		};

		const client = new AiOrchestratorClient({
			baseUrl: "https://example.com",
			apiKey: "test-token",
			fetchImpl: mockFetch,
		});

		const result = await client.invokeInference({
			tenantId: "00000000-0000-0000-0000-000000000001",
			modelDeploymentId: "deployment-id",
			input: { prompt: "hello" },
		});

		expect(result.inferenceId).toBe("inference-123");
		expect(result.status).toBe("scheduled");
		expect(result.replayed).toBe(false);
	});

	it("streams inference events", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						`${JSON.stringify({
							id: 1,
							type: "workload.status",
							payload: { status: "scheduled" },
							createdAt: new Date().toISOString(),
						})}\n`,
					),
				);
				controller.enqueue(
					encoder.encode(
						`${JSON.stringify({
							id: 2,
							type: "workload.status",
							payload: {
								status: "succeeded",
								security: {
									controlPlaneTokenSha256: "digest",
									hardwareProvider: "gpu-fleet",
									attestationStatus: "verified",
									attestationProof: "proof",
									pqcSignatures: [],
								},
							},
							createdAt: new Date().toISOString(),
						})}\n`,
					),
				);
				controller.close();
			},
		});

		const mockFetch: typeof fetch = async (input) => {
			const url = new URL(input as string | URL, "https://example.com");
			if (url.pathname === "/billing/v1/sdk/activate") {
				return makeActivationResponse();
			}
			expect(url.pathname).toBe("/ai/v1/inference/11111111-2222-4333-a444-555555555555/stream");
			return new Response(stream, {
				status: 200,
				headers: { "Content-Type": "application/x-ndjson" },
			});
		};

		const client = new AiOrchestratorClient({
			baseUrl: "https://example.com",
			apiKey: "test-token",
			fetchImpl: mockFetch,
		});

		const received: Array<unknown> = [];
		for await (const event of client.streamInferenceEvents(
			"11111111-2222-4333-a444-555555555555",
		)) {
			received.push(event);
		}

		expect(received).toHaveLength(2);
		expect((received[1] as { payload: { security: unknown } }).payload.security).toBeDefined();
	});
});
