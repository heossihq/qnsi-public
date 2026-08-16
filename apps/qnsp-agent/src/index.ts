#!/usr/bin/env node
/**
 * QNSP Host Agent
 *
 * Discovers cryptographic assets on the local host and reports them
 * to the QNSP platform for inventory, exposure analysis, and migration planning.
 *
 * Usage:
 *   qnsp-agent run              # Run once and exit
 *   qnsp-agent daemon           # Run continuously on configured interval
 *   qnsp-agent configure        # Write config file interactively
 *   qnsp-agent status           # Show current config and last report status
 *   qnsp-agent version          # Print version
 *
 * Configuration:
 *   Set env vars or create ~/.qnsp-agent/config.env
 *   Required: QNSP_AGENT_ID, QNSP_AGENT_SECRET, QNSP_ENDPOINT, QNSP_TENANT_ID
 *
 * See: https://docs.qnsi.heossi.com/agents
 */

import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { loadAgentConfig, writeConfigFile } from "./config.js";
import { formatError, logger, setLogLevel } from "./logger.js";
import {
	createOfflineReportBundle,
	listOfflineReportBundles,
	readOfflineReportBundle,
	submitOfflineReportBundle,
	writeOfflineReportBundle,
} from "./offline-bundle.js";
import { createReportPayload } from "./reporter.js";
import { listScanCheckpointSummaries } from "./scan-checkpoint.js";
import { runScan } from "./scanner.js";
import { enqueueReport, flushQueuedReports, listQueuedReports } from "./spool.js";

export const VERSION = "0.1.0";

export async function runOnce(): Promise<void> {
	const config = loadAgentConfig();
	setLogLevel(config.logLevel);

	logger.info("Starting QNSP agent scan", {
		agentId: config.agentId,
		hostname: config.hostname,
		scanPaths: config.scanPaths,
	});

	// Drain prior evidence before starting another scan. This bounds local disk
	// growth during an extended outage while retaining every accepted batch.
	const prior = await flushQueuedReports(config);
	if (prior.remaining > 0) {
		throw new Error(`${prior.remaining} prior report(s) remain queued for durable replay`);
	}

	const result = await runScan(config.scanPaths, config.hostname, {
		stateDir: config.stateDir,
		onAssetBatch: async (assets, batch) => {
			await enqueueReport(config.stateDir, createReportPayload(config, assets, batch.reportedAt));
			logger.info("Scan evidence batch committed to durable spool", {
				scanId: batch.scanId,
				sequence: batch.sequence,
				assetCount: assets.length,
				final: batch.final,
			});
		},
	});

	if (result.errors.length > 0) {
		for (const err of result.errors) {
			logger.warn("Scan warning", { error: err });
		}
	}

	if (result.assetCount === 0) {
		logger.info("No cryptographic assets found in configured scan paths");
	}

	const flushed = await flushQueuedReports(config);
	if (flushed.remaining > 0) {
		throw new Error(`${flushed.remaining} report(s) remain queued for durable replay`);
	}
}

export async function runDaemon(): Promise<void> {
	const config = loadAgentConfig();
	setLogLevel(config.logLevel);

	logger.info("QNSP agent daemon starting", {
		agentId: config.agentId,
		hostname: config.hostname,
		intervalSecs: config.intervalSecs,
	});

	// Run immediately on start, then on interval
	while (true) {
		try {
			await runOnce();
		} catch (err) {
			logger.error("Report cycle failed", { error: formatError(err) });
		}

		logger.info("Sleeping until next scan", { intervalSecs: config.intervalSecs });
		await sleep(config.intervalSecs * 1000);
	}
}

export async function runOfflineExport(outputDirectory: string | undefined): Promise<void> {
	if (!outputDirectory) throw new Error("export requires an output directory");
	const config = loadAgentConfig();
	setLogLevel(config.logLevel);
	let bundleCount = 0;
	const destination = path.resolve(outputDirectory);
	const result = await runScan(config.scanPaths, config.hostname, {
		stateDir: path.join(config.stateDir, "offline-export"),
		onAssetBatch: async (assets, batch) => {
			const payload = createReportPayload(config, assets, batch.reportedAt);
			const bundle = createOfflineReportBundle(config, payload);
			const file = await writeOfflineReportBundle(destination, bundle);
			bundleCount += 1;
			logger.info("Signed offline evidence bundle committed", {
				scanId: batch.scanId,
				sequence: batch.sequence,
				assetCount: assets.length,
				file,
			});
		},
	});
	console.log(
		JSON.stringify({
			scanId: result.scanId,
			bundleCount,
			assetCount: result.assetCount,
			filesScanned: result.filesScanned,
			directoriesScanned: result.directoriesScanned,
			outputDirectory: destination,
		}),
	);
}

export async function runOfflineImport(inputPath: string | undefined): Promise<void> {
	if (!inputPath) throw new Error("import requires a bundle file or directory");
	const endpoint = process.env["QNSI_ENDPOINT"] ?? process.env["QNSP_ENDPOINT"];
	if (!endpoint) throw new Error("import requires QNSI_ENDPOINT");
	const parsedEndpoint = new URL(endpoint);
	if (parsedEndpoint.protocol !== "https:" && parsedEndpoint.hostname !== "localhost") {
		throw new Error("Offline bundle import endpoint must use HTTPS");
	}

	const files = await listOfflineReportBundles(path.resolve(inputPath));
	if (files.length === 0) throw new Error("No offline scan bundles found");
	let accepted = 0;
	for (const file of files) {
		const bundle = await readOfflineReportBundle(file);
		const result = await submitOfflineReportBundle(endpoint, bundle);
		if (
			!result.accepted ||
			result.bundleId !== bundle.bundleId ||
			result.payloadHash !== bundle.payloadHash
		) {
			throw new Error(`Offline bundle acknowledgement mismatch: ${path.basename(file)}`);
		}
		accepted += 1;
	}
	console.log(JSON.stringify({ accepted, inputPath: path.resolve(inputPath) }));
}

export async function runConfigure(): Promise<void> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log("\nQNSP Agent Configuration\n");
	console.log(
		"You need an agent registered in the QNSP portal (Crypto Posture → Host Agents → Register Agent).",
	);
	console.log("The portal will provide your Agent ID and Secret.\n");

	try {
		const endpoint = await rl.question("QNSP Endpoint URL [https://api.qnsi.heossi.com]: ");
		const tenantId = await rl.question("Tenant ID (UUID): ");
		const agentId = await rl.question("Agent ID (UUID from portal): ");
		const agentSecret = await rl.question("Agent Secret (hex from portal): ");

		const dest = writeConfigFile({
			agentId: agentId.trim(),
			agentSecret: agentSecret.trim(),
			endpoint: endpoint.trim() || "https://api.qnsi.heossi.com",
			tenantId: tenantId.trim(),
		});

		console.log(`\nConfiguration written to: ${dest}`);
		console.log("Run 'qnsp-agent run' to test the connection.\n");
	} finally {
		rl.close();
	}
}

export async function printStatus(): Promise<void> {
	try {
		const config = loadAgentConfig();
		const [activeScans, queuedReports] = await Promise.all([
			listScanCheckpointSummaries(config.stateDir),
			listQueuedReports(config.stateDir),
		]);
		console.log(
			JSON.stringify(
				{
					agentId: config.agentId,
					endpoint: config.endpoint,
					tenantId: config.tenantId,
					hostname: config.hostname,
					scanPaths: config.scanPaths,
					intervalSecs: config.intervalSecs,
					logLevel: config.logLevel,
					stateDir: config.stateDir,
					activeScans,
					queuedReportCount: queuedReports.length,
				},
				null,
				2,
			),
		);
	} catch (err) {
		console.error(formatError(err));
		throw err;
	}
}

export function printVersion(): void {
	console.log(`qnsp-agent ${VERSION} (${os.platform()}/${os.arch()})`);
}

export function printHelp(): void {
	console.log(`
qnsp-agent ${VERSION} - QNSP Host Agent

USAGE
  qnsp-agent <command> [options]

COMMANDS
  run         Scan the host and submit a report, then exit
  daemon      Run continuously, submitting reports on the configured interval
  export DIR  Scan without network access and write signed portable evidence bundles
  import PATH Verify and upload a bundle file or directory from a connected transfer host
  configure   Interactive setup wizard - writes ~/.qnsp-agent/config.env
  status      Print current configuration (no secrets)
  version     Print version
  help        Print this help

CONFIGURATION
  Set environment variables or create a config file at:
    ~/.qnsp-agent/config.env
    /etc/qnsp-agent/config.env

  Required variables:
    QNSP_AGENT_ID       Agent UUID (from QNSP portal)
    QNSP_AGENT_SECRET   64-char hex secret (from QNSP portal, shown once)
    QNSP_ENDPOINT       https://api.qnsi.heossi.com
    QNSP_TENANT_ID      Your tenant UUID

  Optional variables:
    QNSP_SCAN_PATHS     Comma-separated paths (default: /etc/ssl,/etc/ssh,/home,...)
    QNSP_INTERVAL_SECS  Report interval for daemon mode (default: 300)
    QNSP_LOG_LEVEL      silent|error|warn|info|debug (default: info)
    QNSP_HOSTNAME       Override reported hostname
    QNSP_STATE_DIR      Durable report/checkpoint directory

QUICK START
  1. Register an agent in the QNSP portal:
       Crypto Posture → Host Agents → Register Agent
  2. Configure the agent:
       qnsp-agent configure
  3. Test the connection:
       qnsp-agent run
  4. Run as a daemon (or use systemd/launchd):
       qnsp-agent daemon

SYSTEMD EXAMPLE
  [Unit]
  Description=QNSP Host Agent
  After=network.target

  [Service]
  ExecStart=/usr/local/bin/qnsp-agent daemon
  EnvironmentFile=/etc/qnsp-agent/config.env
  Restart=always
  RestartSec=30

  [Install]
  WantedBy=multi-user.target
`);
}

export interface AgentCommandRuntime {
	readonly runDaemon: typeof runDaemon;
}

const DEFAULT_COMMAND_RUNTIME: AgentCommandRuntime = { runDaemon };

export async function main(
	argv: readonly string[] = process.argv,
	runtime: AgentCommandRuntime = DEFAULT_COMMAND_RUNTIME,
): Promise<void> {
	const command = argv[2] ?? "help";

	switch (command) {
		case "run":
			await runOnce();
			break;
		case "daemon":
			await runtime.runDaemon();
			break;
		case "export":
			await runOfflineExport(argv[3]);
			break;
		case "import":
			await runOfflineImport(argv[3]);
			break;
		case "configure":
			await runConfigure();
			break;
		case "status":
			await printStatus();
			break;
		case "version":
		case "--version":
		case "-v":
			printVersion();
			break;
		case "help":
		case "--help":
		case "-h":
			printHelp();
			break;
		default:
			console.error(`Unknown command: ${command}`);
			printHelp();
			throw new Error(`Unknown command: ${command}`);
	}
}

const isDirectExecution =
	process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
	main().catch((err) => {
		logger.error("Fatal error", { error: formatError(err) });
		process.exitCode = 1;
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
