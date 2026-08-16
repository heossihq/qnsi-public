#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

import { Command, Option } from "commander";

import { AiOrchestratorClient } from "./client.js";
import { createModelPackageManifest } from "./packaging.js";
import type {
	ModelDeploymentRequest,
	ModelPackageManifest,
	SubmitWorkloadRequest,
	WorkloadResources,
	WorkloadSecurityProfile,
} from "./types.js";

interface GlobalOptions {
	baseUrl?: string;
	token?: string;
}

const program = new Command()
	.name("qnsp-ai")
	.description("CLI for interacting with the QNSP AI Orchestrator")
	.addOption(
		new Option("--base-url <url>", "Base URL for the ai-orchestrator service")
			.env("QNSP_AI_BASE_URL")
			.makeOptionMandatory(false),
	)
	.addOption(
		new Option("--token <token>", "Bearer token with workload scopes")
			.env("QNSP_AI_TOKEN")
			.makeOptionMandatory(false),
	);

program
	.command("register-artifact")
	.description("Register a storage artifact for use in workload submissions")
	.requiredOption("--tenant <tenantId>", "Tenant identifier (UUID)")
	.requiredOption("--document <documentId>", "Storage document identifier (UUID)")
	.requiredOption("--version <version>", "Document version number", (value) =>
		Number.parseInt(value, 10),
	)
	.action(async (options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const result = await client.registerArtifact({
				tenantId: options.tenant,
				documentId: options.document,
				version: Number.parseInt(options.version, 10),
			});
			printJson(result);
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("package-model")
	.description("Generate a model package manifest with SHA3-512 checksums")
	.requiredOption("--model-name <name>", "Model identifier")
	.requiredOption("--version <version>", "Model version string")
	.requiredOption("--path <path>", "Path to model directory or file")
	.option("--metadata <json>", "Additional metadata JSON blob")
	.option("--output <file>", "Output file path for the manifest", (manifestPath) => manifestPath)
	.action(async (options) => {
		try {
			const metadata = options.metadata ? JSON.parse(options.metadata) : undefined;
			const manifest = await createModelPackageManifest({
				modelName: options.modelName,
				version: options.version,
				sourcePath: options.path,
				metadata,
			});
			const outputPath = options.output ?? `${options.modelName}-${options.version}.package.json`;
			await writeFile(outputPath, JSON.stringify(manifest, null, 2));
			process.stdout.write(`Model package manifest written to ${outputPath}\n`);
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("deploy-model")
	.description("Deploy a packaged model artifact through the AI orchestrator")
	.requiredOption("--tenant <tenantId>", "Tenant identifier (UUID)")
	.requiredOption("--artifact <artifactId>", "Artifact identifier")
	.requiredOption("--artifact-version <version>", "Artifact version number", (value) =>
		Number.parseInt(value, 10),
	)
	.requiredOption("--manifest <file>", "Path to generated model package manifest JSON")
	.requiredOption("--runtime-image <image>", "Runtime container image")
	.addOption(
		new Option("--command <value...>", "Override command invocation").default([] as string[]),
	)
	.option("--env <key=value>", "Specify runtime environment variables", collectKeyValue, {})
	.option("--label <key=value>", "Specify workload labels", collectKeyValue, {})
	.option("--cpu <cores>", "Requested vCPU count", parseNumber)
	.option("--memory <gib>", "Requested memory (GiB)", parseNumber)
	.option("--gpu <count>", "Requested GPU count", parseNumber)
	.option("--accelerator-type <type>", "Accelerator type identifier")
	.option("--priority <priority>", "Workload priority", validatePriority)
	.option("--policy <policy>", "Scheduling policy", validatePolicy)
	.action(async (options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const manifestContents = await readFile(options.manifest, "utf-8");
			const manifest = JSON.parse(manifestContents) as ModelPackageManifest;

			const resources = buildResources(options);
			const env =
				options.env && Object.keys(options.env).length > 0
					? (options.env as Record<string, string>)
					: {};
			const labels =
				options.label && Object.keys(options.label).length > 0
					? (options.label as Record<string, string>)
					: {};
			const request: ModelDeploymentRequest = {
				tenantId: options.tenant,
				modelName: manifest.modelName ?? "model",
				artifactId: options.artifact,
				artifactVersion: Number.parseInt(String(options.artifactVersion), 10),
				runtimeImage: options.runtimeImage,
				command:
					Array.isArray(options.command) && options.command.length > 0
						? options.command
						: undefined,
				env,
				resources,
				labels,
				manifest,
				priority: options.priority,
				schedulingPolicy: options.policy,
			};

			const result = await client.deployModel(request);
			printJson(result);
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("submit-workload")
	.description("Submit a workload using a JSON specification file")
	.requiredOption("--spec <file>", "Path to workload specification JSON file")
	.option("--idempotency-key <key>", "Idempotency key for the submission")
	.action(async (options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const contents = await readFile(options.spec, "utf-8");
			const spec = JSON.parse(contents) as SubmitWorkloadRequest;
			const result = await client.submitWorkload({
				...spec,
				idempotencyKey: options.idempotencyKey ?? spec.idempotencyKey,
			});
			printJson(result);
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("status")
	.description("Retrieve the status of a workload")
	.argument("<workloadId>", "Workload identifier")
	.option("--attestation-proof-file <file>", "Write attestation proof output to file")
	.action(async (workloadId, options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const result = await client.getWorkload(workloadId);
			printJson(result);
			printSecurityEnvelope(result.security, result.id);
			await maybeWriteAttestationProof(result.security, options.attestationProofFile);
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("list")
	.description("List workloads for a tenant")
	.option("--tenant <tenantId>", "Tenant identifier (UUID)")
	.option("--status <status>", "Filter by workload status")
	.option("--cursor <cursor>", "Pagination cursor")
	.option("--limit <limit>", "Page size", (value) => Number.parseInt(value, 10))
	.action(async (options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const result = await client.listWorkloads({
				tenantId: options.tenant,
				status: options.status,
				cursor: options.cursor,
				limit: options.limit,
			});
			printJson(result);
			for (const item of result.items) {
				printSecurityEnvelope(item.security, item.id);
			}
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("cancel")
	.description("Request cancellation for a workload")
	.argument("<workloadId>", "Workload identifier")
	.option("--reason <reason>", "Optional cancellation reason")
	.action(async (workloadId, options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const result = await client.cancelWorkload({
				workloadId,
				reason: options.reason,
			});
			printJson(result);
		} catch (error) {
			handleCliError(error);
		}
	});

program
	.command("infer")
	.description("Invoke a model deployment for inference")
	.requiredOption("--tenant <tenantId>", "Tenant identifier (UUID)")
	.requiredOption("--deployment <deploymentId>", "Model deployment identifier")
	.option("--input <json>", "Inference input payload as JSON")
	.option("--input-file <file>", "Path to JSON file containing inference payload")
	.option("--priority <priority>", "Inference workload priority", validatePriority)
	.option("--stream", "Stream inference events until completion")
	.action(async (options, command) => {
		const client = createClient(command.optsWithGlobals());
		try {
			const payload = await resolveInferencePayload(options);
			const result = await client.invokeInference({
				tenantId: options.tenant,
				modelDeploymentId: options.deployment,
				input: payload,
				priority: options.priority,
			});
			printJson(result);
			if (options.stream) {
				await streamInference(client, result.workloadId);
			}
		} catch (error) {
			handleCliError(error);
		}
	});

program.parseAsync(process.argv).catch((error) => {
	handleCliError(error);
});

function createClient(options: GlobalOptions | undefined) {
	// commander binds QNSP_AI_BASE_URL / QNSP_AI_TOKEN into the options via
	// .env(), so a separate process.env fallback here could never run.
	const baseUrl = options?.baseUrl ?? "https://api.qnsi.heossi.com";
	const token = options?.token;
	if (!token) {
		throw new Error("AI orchestrator API token is required (--token or QNSP_AI_TOKEN)");
	}
	return new AiOrchestratorClient({
		baseUrl,
		apiKey: token,
	});
}

function printJson(value: unknown) {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printSecurityEnvelope(
	security: WorkloadSecurityProfile | null | undefined,
	context?: string,
): void {
	if (!security) {
		return;
	}

	const header = context ? `Security Envelope (${context})` : "Security Envelope";
	const digest = security.controlPlaneTokenSha256 ?? "none";
	const hardwareProvider = security.hardwareProvider ?? "unknown";
	const attestationStatus = security.attestationStatus ?? "unknown";
	process.stdout.write(
		`\n${header}:\n` +
			`  Control Plane Digest : ${digest}\n` +
			`  Hardware Provider    : ${hardwareProvider}\n` +
			`  Attestation Status   : ${attestationStatus}\n`,
	);
	if (security.attestationProof) {
		const preview =
			security.attestationProof.length > 80
				? `${security.attestationProof.slice(0, 77)}…`
				: security.attestationProof;
		process.stdout.write(`  Attestation Proof    : ${preview}\n`);
	}
	if (security.pqcSignatures.length > 0) {
		process.stdout.write("  PQC Signatures       :\n");
		for (const signature of security.pqcSignatures) {
			process.stdout.write(`    - ${signature.provider} (${signature.algorithm})\n`);
		}
	} else {
		process.stdout.write("  PQC Signatures       : none\n");
	}
}

async function streamInference(client: AiOrchestratorClient, workloadId: string): Promise<void> {
	for await (const event of client.streamInferenceEvents(workloadId)) {
		process.stdout.write(`${JSON.stringify(event)}\n`);
		if (event.type === "workload.status") {
			const payload = event.payload as {
				security?: WorkloadSecurityProfile | null;
			};
			if (payload.security) {
				printSecurityEnvelope(payload.security, workloadId);
			}
		}
	}
}

async function maybeWriteAttestationProof(
	security: WorkloadSecurityProfile | null | undefined,
	outputPath?: string,
): Promise<void> {
	if (!outputPath) {
		return;
	}
	if (!security?.attestationProof) {
		process.stderr.write(
			"Attestation proof not available for this workload; nothing written to disk.\n",
		);
		return;
	}
	await writeFile(outputPath, security.attestationProof, "utf-8");
	process.stdout.write(`Attestation proof written to ${outputPath}\n`);
}

function handleCliError(error: unknown) {
	if (error instanceof Error) {
		process.stderr.write(`Error: ${error.message}\n`);
	} else {
		process.stderr.write("Unknown error occurred\n");
	}
	process.exitCode = 1;
}

function collectKeyValue(
	value: string,
	previous: Record<string, string> = {},
): Record<string, string> {
	const separatorIndex = value.indexOf("=");
	if (separatorIndex === -1) {
		throw new Error(`Expected key=value format but received "${value}"`);
	}
	const key = value.slice(0, separatorIndex);
	const val = value.slice(separatorIndex + 1);
	return { ...previous, [key]: val };
}

function parseNumber(value: string): number {
	const parsed = Number.parseFloat(value);
	if (Number.isNaN(parsed)) {
		throw new Error(`Expected numeric value but received "${value}"`);
	}
	return parsed;
}

function validatePriority(value: string): "low" | "normal" | "high" {
	if (value !== "low" && value !== "normal" && value !== "high") {
		throw new Error('Priority must be one of "low", "normal", or "high"');
	}
	return value;
}

function validatePolicy(value: string): "spot" | "on-demand" | "mixed" {
	if (value !== "spot" && value !== "on-demand" && value !== "mixed") {
		throw new Error('Policy must be one of "spot", "on-demand", or "mixed"');
	}
	return value;
}

function buildResources(options: Record<string, unknown>): WorkloadResources {
	const acceleratorType =
		typeof options["acceleratorType"] === "string"
			? (options["acceleratorType"] as string)
			: "none";
	return {
		cpu: typeof options["cpu"] === "number" ? (options["cpu"] as number) : 4,
		memoryGiB: typeof options["memory"] === "number" ? (options["memory"] as number) : 16,
		gpu:
			typeof options["gpu"] === "number"
				? (options["gpu"] as number)
				: acceleratorType === "none"
					? 0
					: 1,
		acceleratorType,
	};
}

async function resolveInferencePayload(options: {
	input?: string;
	// commander camelCases --input-file into inputFile; the previous
	// "input-file" key never existed, so the flag was silently ignored.
	inputFile?: string;
}): Promise<Record<string, unknown>> {
	if (options.input && options.inputFile) {
		throw new Error("Provide either --input or --input-file, not both");
	}
	if (options.inputFile) {
		const data = await readFile(options.inputFile, "utf-8");
		return JSON.parse(data) as Record<string, unknown>;
	}
	if (options.input) {
		return JSON.parse(options.input) as Record<string, unknown>;
	}
	throw new Error("Inference payload is required (--input or --input-file)");
}
