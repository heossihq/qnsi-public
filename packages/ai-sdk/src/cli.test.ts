/**
 * Executes the qnsp-ai CLI entry (commander parses argv at import) against a
 * stubbed gateway: every command, helper parser, security-envelope printer,
 * and error path runs for real without network traffic.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ID = "11111111-1111-4111-a111-111111111111";

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

const SECURITY_FULL = {
	controlPlaneTokenSha256: "digest-1",
	hardwareProvider: "nitro",
	attestationStatus: "verified",
	attestationProof: "p".repeat(100),
	pqcSignatures: [{ provider: "liboqs", algorithm: "ml-dsa-65" }],
};

const fetchMock = vi.fn();
const originalArgv = process.argv;
let stdout: string[];
let stderr: string[];
let dir: string;

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

function armGateway(handler: (url: string) => Response | Promise<Response>): void {
	fetchMock.mockImplementation(async (url: URL | string) => {
		if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
		return handler(String(url));
	});
}

async function runCli(...args: string[]): Promise<void> {
	vi.resetModules();
	process.argv = ["node", "qnsp-ai", ...args];
	await import("./cli.js");
	// parseAsync is fired at module top level; give the action chain a beat.
	await vi.waitFor(() => {
		if (stdout.length === 0 && stderr.length === 0) throw new Error("no output yet");
	});
}

beforeEach(() => {
	clearActivationCache();
	fetchMock.mockReset();
	armGateway(() => jsonResponse({ ok: true }));
	vi.stubGlobal("fetch", fetchMock);
	stdout = [];
	stderr = [];
	vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
		stdout.push(String(chunk));
		return true;
	});
	vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
		stderr.push(String(chunk));
		return true;
	});
	vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
	process.env["QNSP_AI_BASE_URL"] = "https://ai.qnsp.example";
	process.env["QNSP_AI_TOKEN"] = "cli-token";
	dir = mkdtempSync(join(tmpdir(), "qnsp-ai-cli-"));
});

afterEach(() => {
	process.argv = originalArgv;
	process.exitCode = 0;
	delete process.env["QNSP_AI_BASE_URL"];
	delete process.env["QNSP_AI_TOKEN"];
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	rmSync(dir, { recursive: true, force: true });
});

describe("register-artifact", () => {
	it("registers and prints the result", async () => {
		armGateway(() => jsonResponse({ artifactId: ID }));
		await runCli("register-artifact", "--tenant", TENANT, "--document", ID, "--version", "3");
		expect(stdout.join("")).toContain(ID);
		expect(process.exitCode).not.toBe(1);
	});

	it("reports API failures through the CLI error path", async () => {
		armGateway(() => new Response(null, { status: 503, statusText: "Unavailable" }));
		await runCli("register-artifact", "--tenant", TENANT, "--document", ID, "--version", "3");
		expect(stderr.join("")).toContain("Error: AI Orchestrator API error: 503");
		expect(process.exitCode).toBe(1);
	});
});

describe("package-model", () => {
	it("writes a manifest with metadata to the requested output", async () => {
		const modelDir = join(dir, "model");
		writeFileSync(join(dir, "placeholder"), "");
		const { mkdirSync } = await import("node:fs");
		mkdirSync(modelDir);
		writeFileSync(join(modelDir, "weights.bin"), "wwww");
		const out = join(dir, "manifest.json");
		await runCli(
			"package-model",
			"--model-name",
			"resnet",
			"--version",
			"1.0.0",
			"--path",
			modelDir,
			"--metadata",
			'{"framework":"torch"}',
			"--output",
			out,
		);
		const manifest = JSON.parse(readFileSync(out, "utf8")) as {
			modelName: string;
			metadata: Record<string, unknown>;
			files: unknown[];
		};
		expect(manifest.modelName).toBe("resnet");
		expect(manifest.metadata).toEqual({ framework: "torch" });
		expect(manifest.files).toHaveLength(1);
		expect(stdout.join("")).toContain(`written to ${out}`);
	});

	it("reports invalid metadata JSON as a CLI error", async () => {
		await runCli(
			"package-model",
			"--model-name",
			"m",
			"--version",
			"1",
			"--path",
			dir,
			"--metadata",
			"{nope",
		);
		expect(stderr.join("")).toContain("Error:");
		expect(process.exitCode).toBe(1);
	});
});

describe("deploy-model", () => {
	it("deploys with full resource, env, and label options", async () => {
		const manifestPath = join(dir, "m.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				modelName: "resnet",
				version: "2.0.0",
				createdAt: "now",
				files: [],
				metadata: {},
			}),
		);
		armGateway(() =>
			jsonResponse({ workloadId: ID, status: "scheduled", replayed: false, acceptedAt: "now" }),
		);
		await runCli(
			"deploy-model",
			"--tenant",
			TENANT,
			"--artifact",
			ID,
			"--artifact-version",
			"2",
			"--manifest",
			manifestPath,
			"--runtime-image",
			"registry/img:1",
			"--command",
			"python",
			"serve.py",
			"--env",
			"A=1",
			"--env",
			"B=2",
			"--label",
			"team=ml",
			"--cpu",
			"8",
			"--memory",
			"32",
			"--gpu",
			"2",
			"--accelerator-type",
			"nvidia-a10g",
			"--priority",
			"high",
			"--policy",
			"spot",
		);
		const submit = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/workloads"));
		const body = JSON.parse(String((submit?.[1] as RequestInit).body)) as {
			env: Record<string, string>;
			resources: { cpu: number; gpu: number; acceleratorType: string };
			command: string[];
		};
		expect(body.env).toMatchObject({ A: "1", B: "2", MODEL_NAME: "resnet" });
		expect(body.resources).toMatchObject({ cpu: 8, gpu: 2, acceleratorType: "nvidia-a10g" });
		expect(body.command).toEqual(["python", "serve.py"]);
	});

	it("applies resource defaults and a default model name for sparse manifests", async () => {
		const manifestPath = join(dir, "sparse.json");
		writeFileSync(manifestPath, JSON.stringify({ version: "1", files: [], metadata: {} }));
		armGateway(() =>
			jsonResponse({ workloadId: ID, status: "scheduled", replayed: false, acceptedAt: "now" }),
		);
		await runCli(
			"deploy-model",
			"--tenant",
			TENANT,
			"--artifact",
			ID,
			"--artifact-version",
			"1",
			"--manifest",
			manifestPath,
			"--runtime-image",
			"img",
		);
		const submit = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/workloads"));
		const body = JSON.parse(String((submit?.[1] as RequestInit).body)) as {
			name: string;
			resources: { cpu: number; memoryGiB: number; gpu: number; acceleratorType: string };
			command: string[];
		};
		expect(body.name).toBe("model-deployment");
		expect(body.resources).toEqual({ cpu: 4, memoryGiB: 16, gpu: 0, acceleratorType: "none" });
		expect(body.command).toEqual(["python", "-m", "qnsp.runtime.inference"]);
	});

	it("defaults gpu to 1 when an accelerator type is set without a count", async () => {
		const manifestPath = join(dir, "acc.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({ modelName: "m", version: "1", files: [], metadata: {} }),
		);
		armGateway(() =>
			jsonResponse({ workloadId: ID, status: "scheduled", replayed: false, acceptedAt: "now" }),
		);
		await runCli(
			"deploy-model",
			"--tenant",
			TENANT,
			"--artifact",
			ID,
			"--artifact-version",
			"1",
			"--manifest",
			manifestPath,
			"--runtime-image",
			"img",
			"--accelerator-type",
			"nvidia-a10g",
		);
		const submit = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/workloads"));
		const body = JSON.parse(String((submit?.[1] as RequestInit).body)) as {
			resources: { gpu: number };
		};
		expect(body.resources.gpu).toBe(1);
	});
});

describe("submit-workload", () => {
	it("submits a spec file with the CLI idempotency key taking precedence", async () => {
		const specPath = join(dir, "spec.json");
		writeFileSync(
			specPath,
			JSON.stringify({
				tenantId: TENANT,
				name: "batch",
				containerImage: "img",
				idempotencyKey: "from-spec",
			}),
		);
		armGateway(() =>
			jsonResponse({ workloadId: ID, status: "scheduled", replayed: false, acceptedAt: "now" }),
		);
		await runCli("submit-workload", "--spec", specPath, "--idempotency-key", "from-cli");
		const submit = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/workloads"));
		const headers = (submit?.[1] as RequestInit).headers as Headers;
		expect(headers.get("idempotency-key")).toBe("from-cli");

		stdout.length = 0;
		clearActivationCache();
		await runCli("submit-workload", "--spec", specPath);
		const second = fetchMock.mock.calls
			.filter(([u]) => String(u).endsWith("/ai/v1/workloads"))
			.at(-1);
		expect(((second?.[1] as RequestInit).headers as Headers).get("idempotency-key")).toBe(
			"from-spec",
		);
	});
});

describe("status", () => {
	it("prints the security envelope and writes the attestation proof", async () => {
		const proofPath = join(dir, "proof.txt");
		armGateway(() => jsonResponse({ id: ID, status: "running", security: SECURITY_FULL }));
		await runCli("status", ID, "--attestation-proof-file", proofPath);
		const out = stdout.join("");
		expect(out).toContain("Security Envelope");
		expect(out).toContain("nitro");
		expect(out).toContain("…");
		expect(out).toContain("- liboqs (ml-dsa-65)");
		expect(readFileSync(proofPath, "utf8")).toBe("p".repeat(100));
	});

	it("reports defaults for a sparse envelope and skips proof writing without one", async () => {
		const proofPath = join(dir, "missing-proof.txt");
		armGateway(() =>
			jsonResponse({
				id: ID,
				status: "running",
				security: { pqcSignatures: [], attestationProof: "short" },
			}),
		);
		await runCli("status", ID, "--attestation-proof-file", proofPath);
		const out = stdout.join("");
		expect(out).toContain("Control Plane Digest : none");
		expect(out).toContain("Hardware Provider    : unknown");
		expect(out).toContain("PQC Signatures       : none");
		expect(out).toContain("Attestation Proof    : short");

		stdout.length = 0;
		stderr.length = 0;
		clearActivationCache();
		armGateway(() => jsonResponse({ id: ID, status: "running", security: null }));
		await runCli("status", ID, "--attestation-proof-file", proofPath);
		expect(stderr.join("")).toContain("Attestation proof not available");
	});
});

describe("list and cancel", () => {
	it("lists workloads printing envelopes only where present", async () => {
		armGateway(() =>
			jsonResponse({
				items: [
					{ id: "w1", security: SECURITY_FULL },
					{ id: "w2", security: null },
				],
			}),
		);
		await runCli("list", "--tenant", TENANT, "--status", "running", "--limit", "5");
		expect(stdout.join("")).toContain("Security Envelope (w1)");
		expect(stdout.join("")).not.toContain("(w2)");
	});

	it("cancels with and without a reason", async () => {
		armGateway(() => jsonResponse({ workloadId: ID, status: "cancelled", canceledAt: "now" }));
		await runCli("cancel", ID, "--reason", "done");
		expect(stdout.join("")).toContain("cancelled");
		stdout.length = 0;
		clearActivationCache();
		await runCli("cancel", ID);
		expect(stdout.join("")).toContain("cancelled");
	});
});

describe("infer", () => {
	it("invokes with --input and streams events with a security status frame", async () => {
		const encoder = new TextEncoder();
		armGateway((url) => {
			if (url.includes("/stream")) {
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(
							encoder.encode(
								`${JSON.stringify({ type: "log", payload: {} })}\n${JSON.stringify({
									type: "workload.status",
									payload: { security: SECURITY_FULL },
								})}\n`,
							),
						);
						controller.close();
					},
				});
				return new Response(stream, { status: 200 });
			}
			return jsonResponse({ workloadId: ID, status: "scheduled" });
		});
		await runCli(
			"infer",
			"--tenant",
			TENANT,
			"--deployment",
			ID,
			"--input",
			'{"prompt":"hi"}',
			"--priority",
			"low",
			"--stream",
		);
		const out = stdout.join("");
		expect(out).toContain('"workloadId"');
		expect(out).toContain("workload.status");
		expect(out).toContain(`Security Envelope (${ID})`);
	});

	it("reads the payload from --input-file (previously silently ignored)", async () => {
		const payloadPath = join(dir, "payload.json");
		writeFileSync(payloadPath, JSON.stringify({ prompt: "from-file" }));
		armGateway(() => jsonResponse({ workloadId: ID, status: "scheduled" }));
		await runCli("infer", "--tenant", TENANT, "--deployment", ID, "--input-file", payloadPath);
		const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/inference"));
		const body = JSON.parse(String((call?.[1] as RequestInit).body)) as {
			input: { prompt: string };
		};
		expect(body.input.prompt).toBe("from-file");
	});

	it("rejects both payload sources, and neither", async () => {
		const payloadPath = join(dir, "p.json");
		writeFileSync(payloadPath, "{}");
		await runCli(
			"infer",
			"--tenant",
			TENANT,
			"--deployment",
			ID,
			"--input",
			"{}",
			"--input-file",
			payloadPath,
		);
		expect(stderr.join("")).toContain("either --input or --input-file, not both");

		stderr.length = 0;
		clearActivationCache();
		await runCli("infer", "--tenant", TENANT, "--deployment", ID);
		expect(stderr.join("")).toContain("Inference payload is required");
	});
});

describe("remaining command tails", () => {
	it("deploy-model and submit-workload report unreadable files via their catch arms", async () => {
		await runCli(
			"deploy-model",
			"--tenant",
			TENANT,
			"--artifact",
			ID,
			"--artifact-version",
			"1",
			"--manifest",
			join(dir, "missing.json"),
			"--runtime-image",
			"img",
		);
		expect(stderr.join("")).toContain("Error:");
		expect(process.exitCode).toBe(1);

		stderr.length = 0;
		await runCli("submit-workload", "--spec", join(dir, "missing-spec.json"));
		expect(stderr.join("")).toContain("Error:");
	});

	it("status and list surface API failures", async () => {
		armGateway(() => new Response(null, { status: 500, statusText: "Internal" }));
		await runCli("status", ID);
		expect(stderr.join("")).toContain("Error: AI Orchestrator API error: 500");

		stderr.length = 0;
		clearActivationCache();
		armGateway(() => new Response(null, { status: 500, statusText: "Internal" }));
		await runCli("list");
		expect(stderr.join("")).toContain("Error: AI Orchestrator API error: 500");
	});

	it("package-model defaults metadata and the output file name", async () => {
		const modelPath = join(dir, "solo.bin");
		writeFileSync(modelPath, "x");
		const defaultOut = `cli-test-model-${Date.now()}-1.package.json`;
		try {
			await runCli(
				"package-model",
				"--model-name",
				defaultOut.replace("-1.package.json", ""),
				"--version",
				"1",
				"--path",
				modelPath,
			);
			expect(stdout.join("")).toContain(defaultOut);
			expect(JSON.parse(readFileSync(defaultOut, "utf8")).metadata).toEqual({});
		} finally {
			rmSync(defaultOut, { force: true });
		}
	});

	it("status without a proof file skips proof handling and prints a bare header for missing ids", async () => {
		armGateway(() => jsonResponse({ status: "running", security: SECURITY_FULL }));
		await runCli("status", ID);
		const out = stdout.join("");
		expect(out).toContain("Security Envelope:\n");
		expect(out).not.toContain("written to");
	});

	it("stream frames without security do not print an envelope", async () => {
		const encoder = new TextEncoder();
		armGateway((url) => {
			if (url.includes("/stream")) {
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(
							encoder.encode(`${JSON.stringify({ type: "workload.status", payload: {} })}\n`),
						);
						controller.close();
					},
				});
				return new Response(stream, { status: 200 });
			}
			return jsonResponse({ workloadId: ID, status: "scheduled" });
		});
		await runCli("infer", "--tenant", TENANT, "--deployment", ID, "--input", "{}", "--stream");
		expect(stdout.join("")).not.toContain("Security Envelope");
	});
});

describe("client construction and option parsers", () => {
	it("fails without a token", async () => {
		delete process.env["QNSP_AI_TOKEN"];
		await runCli("cancel", ID);
		expect(stderr.join("")).toContain("API token is required");
		expect(process.exitCode).toBe(1);
	});

	it("rejects malformed key=value, numbers, priorities, and policies", async () => {
		const manifestPath = join(dir, "m.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({ modelName: "m", version: "1", files: [], metadata: {} }),
		);
		const base = [
			"deploy-model",
			"--tenant",
			TENANT,
			"--artifact",
			ID,
			"--artifact-version",
			"1",
			"--manifest",
			manifestPath,
			"--runtime-image",
			"img",
		];
		await runCli(...base, "--env", "no-separator");
		expect(stderr.join("")).toContain("key=value");

		stderr.length = 0;
		await runCli(...base, "--cpu", "lots");
		expect(stderr.join("")).toContain("numeric value");

		stderr.length = 0;
		await runCli(...base, "--priority", "urgent");
		expect(stderr.join("")).toContain('"low", "normal", or "high"');

		stderr.length = 0;
		await runCli(...base, "--policy", "cheap");
		expect(stderr.join("")).toContain('"spot", "on-demand", or "mixed"');
	});

	it("falls back to the production base URL when no env or flag provides one", async () => {
		delete process.env["QNSP_AI_BASE_URL"];
		armGateway(() => jsonResponse({ workloadId: ID, status: "cancelled", canceledAt: "now" }));
		await runCli("cancel", ID);
		expect(
			fetchMock.mock.calls.some(([u]) => String(u).startsWith("https://api.qnsi.heossi.com/")),
		).toBe(true);
	});

	it("reports non-Error throws as unknown", async () => {
		armGateway(() => {
			throw "raw gateway string";
		});
		await runCli("cancel", ID);
		expect(stderr.join("")).toContain("Unknown error occurred");
	});
});
