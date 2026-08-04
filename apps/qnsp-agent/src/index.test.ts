import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loadAgentConfig: vi.fn(),
	writeConfigFile: vi.fn(),
	setLogLevel: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	createOfflineReportBundle: vi.fn(),
	listOfflineReportBundles: vi.fn(),
	readOfflineReportBundle: vi.fn(),
	submitOfflineReportBundle: vi.fn(),
	writeOfflineReportBundle: vi.fn(),
	createReportPayload: vi.fn(),
	listScanCheckpointSummaries: vi.fn(),
	runScan: vi.fn(),
	enqueueReport: vi.fn(),
	flushQueuedReports: vi.fn(),
	listQueuedReports: vi.fn(),
	question: vi.fn(),
	close: vi.fn(),
}));

vi.mock("./config.js", () => ({
	loadAgentConfig: mocks.loadAgentConfig,
	writeConfigFile: mocks.writeConfigFile,
}));
vi.mock("./logger.js", () => ({
	logger: { info: mocks.info, warn: mocks.warn, error: mocks.error },
	setLogLevel: mocks.setLogLevel,
}));
vi.mock("./offline-bundle.js", () => ({
	createOfflineReportBundle: mocks.createOfflineReportBundle,
	listOfflineReportBundles: mocks.listOfflineReportBundles,
	readOfflineReportBundle: mocks.readOfflineReportBundle,
	submitOfflineReportBundle: mocks.submitOfflineReportBundle,
	writeOfflineReportBundle: mocks.writeOfflineReportBundle,
}));
vi.mock("./reporter.js", () => ({ createReportPayload: mocks.createReportPayload }));
vi.mock("./scan-checkpoint.js", () => ({
	listScanCheckpointSummaries: mocks.listScanCheckpointSummaries,
}));
vi.mock("./scanner.js", () => ({ runScan: mocks.runScan }));
vi.mock("./spool.js", () => ({
	enqueueReport: mocks.enqueueReport,
	flushQueuedReports: mocks.flushQueuedReports,
	listQueuedReports: mocks.listQueuedReports,
}));
vi.mock("node:readline/promises", () => ({
	createInterface: () => ({ question: mocks.question, close: mocks.close }),
}));

import {
	main,
	printHelp,
	printStatus,
	printVersion,
	runConfigure,
	runDaemon,
	runOfflineExport,
	runOfflineImport,
	runOnce,
} from "./index.js";

const config = {
	agentId: "agent-1",
	agentSecret: "secret",
	endpoint: "https://api.qnsi.heossi.com",
	tenantId: "tenant-1",
	hostname: "host-1",
	scanPaths: ["/safe"],
	intervalSecs: 300,
	logLevel: "info",
	stateDir: "/state",
};

describe("agent CLI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.loadAgentConfig.mockReturnValue(config);
		mocks.flushQueuedReports.mockResolvedValue({ submitted: 0, remaining: 0 });
		mocks.createReportPayload.mockReturnValue({ report: true });
		mocks.runScan.mockResolvedValue({
			scanId: "scan-1",
			assets: [],
			assetCount: 0,
			filesScanned: 0,
			directoriesScanned: 1,
			errors: [],
		});
	});

	it("runs a scan, durably spools each evidence batch, and flushes it", async () => {
		mocks.runScan.mockImplementation(async (_paths, _hostname, options) => {
			await options.onAssetBatch([{ type: "key" }], {
				scanId: "scan-1",
				sequence: 0,
				reportedAt: "2026-07-17T00:00:00.000Z",
				final: true,
			});
			return {
				scanId: "scan-1",
				assets: [],
				assetCount: 1,
				filesScanned: 1,
				directoriesScanned: 1,
				errors: ["unreadable path"],
			};
		});

		await runOnce();

		expect(mocks.enqueueReport).toHaveBeenCalledWith("/state", { report: true });
		expect(mocks.warn).toHaveBeenCalledWith("Scan warning", { error: "unreadable path" });
		expect(mocks.flushQueuedReports).toHaveBeenCalledTimes(2);
	});

	it("refuses to start or finish while evidence remains queued", async () => {
		mocks.flushQueuedReports.mockResolvedValueOnce({ submitted: 0, remaining: 2 });
		await expect(runOnce()).rejects.toThrow("2 prior report(s)");

		mocks.flushQueuedReports
			.mockResolvedValueOnce({ submitted: 0, remaining: 0 })
			.mockResolvedValueOnce({ submitted: 0, remaining: 1 });
		await expect(runOnce()).rejects.toThrow("1 report(s)");
	});

	it("exports signed offline batches and prints an evidence summary", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		mocks.createOfflineReportBundle.mockReturnValue({ bundleId: "bundle-1" });
		mocks.writeOfflineReportBundle.mockResolvedValue("/out/bundle-1.json");
		mocks.runScan.mockImplementation(async (_paths, _hostname, options) => {
			await options.onAssetBatch([{ type: "key" }], {
				scanId: "scan-1",
				sequence: 0,
				reportedAt: "2026-07-17T00:00:00.000Z",
				final: true,
			});
			return { scanId: "scan-1", assetCount: 1, filesScanned: 1, directoriesScanned: 1 };
		});

		await expect(runOfflineExport(undefined)).rejects.toThrow("output directory");
		await runOfflineExport("/out");
		expect(mocks.writeOfflineReportBundle).toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(expect.stringContaining('"bundleCount":1'));
		log.mockRestore();
	});

	it("imports only acknowledged offline evidence over a secure endpoint", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const originalEndpoint = process.env["QNSI_ENDPOINT"];
		process.env["QNSI_ENDPOINT"] = "https://api.qnsi.heossi.com";
		mocks.listOfflineReportBundles.mockResolvedValue(["/in/one.json"]);
		mocks.readOfflineReportBundle.mockResolvedValue({
			bundleId: "bundle-1",
			payloadHash: "hash-1",
		});
		mocks.submitOfflineReportBundle.mockResolvedValue({
			accepted: true,
			bundleId: "bundle-1",
			payloadHash: "hash-1",
		});

		await expect(runOfflineImport(undefined)).rejects.toThrow("bundle file");
		await runOfflineImport("/in");
		expect(log).toHaveBeenCalledWith(expect.stringContaining('"accepted":1'));

		process.env["QNSI_ENDPOINT"] = "http://remote.example";
		await expect(runOfflineImport("/in")).rejects.toThrow("must use HTTPS");
		process.env["QNSI_ENDPOINT"] = "https://api.qnsi.heossi.com";
		mocks.listOfflineReportBundles.mockResolvedValueOnce([]);
		await expect(runOfflineImport("/empty")).rejects.toThrow("No offline");
		mocks.listOfflineReportBundles.mockResolvedValueOnce(["/in/one.json"]);
		mocks.submitOfflineReportBundle.mockResolvedValueOnce({ accepted: false });
		await expect(runOfflineImport("/in")).rejects.toThrow("acknowledgement mismatch");

		if (originalEndpoint === undefined) delete process.env["QNSI_ENDPOINT"];
		else process.env["QNSI_ENDPOINT"] = originalEndpoint;
		log.mockRestore();
	});

	it("writes interactive configuration and always closes readline", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		mocks.question
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("tenant-1")
			.mockResolvedValueOnce("agent-1")
			.mockResolvedValueOnce("secret");
		mocks.writeConfigFile.mockReturnValue("/home/user/.qnsp-agent/config.env");

		await runConfigure();
		expect(mocks.writeConfigFile).toHaveBeenCalledWith({
			agentId: "agent-1",
			agentSecret: "secret",
			endpoint: "https://api.qnsi.heossi.com",
			tenantId: "tenant-1",
		});
		expect(mocks.close).toHaveBeenCalledOnce();
		log.mockRestore();
	});

	it("prints status without exposing the agent secret", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		mocks.listScanCheckpointSummaries.mockResolvedValue([{ scanId: "scan-1" }]);
		mocks.listQueuedReports.mockResolvedValue([{ id: "queued-1" }]);

		await printStatus();
		const output = String(log.mock.calls[0]?.[0]);
		expect(output).toContain('"queuedReportCount": 1');
		expect(output).not.toContain("secret");

		mocks.loadAgentConfig.mockImplementationOnce(() => {
			throw new Error("invalid config");
		});
		await expect(printStatus()).rejects.toThrow("invalid config");
		log.mockRestore();
	});

	it("runDaemon runs an initial cycle immediately then waits for the configured interval", async () => {
		vi.useFakeTimers();
		try {
			const daemon = runDaemon();
			daemon.catch(() => undefined); // loops forever - never resolves; guard the float

			// Flush microtasks: the first cycle should complete up to the interval sleep.
			await vi.advanceTimersByTimeAsync(0);
			expect(mocks.info).toHaveBeenCalledWith(
				"QNSP agent daemon starting",
				expect.objectContaining({ intervalSecs: 300 }),
			);
			expect(mocks.runScan).toHaveBeenCalledTimes(1);
			expect(mocks.info).toHaveBeenCalledWith("Sleeping until next scan", { intervalSecs: 300 });

			// Advancing one interval must trigger a second cycle - proving the loop + sleep.
			await vi.advanceTimersByTimeAsync(300_000);
			expect(mocks.runScan).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("runDaemon logs a failed report cycle and keeps looping", async () => {
		vi.useFakeTimers();
		try {
			mocks.flushQueuedReports.mockRejectedValueOnce(new Error("cycle boom"));
			const daemon = runDaemon();
			daemon.catch(() => undefined);

			await vi.advanceTimersByTimeAsync(0);
			expect(mocks.error).toHaveBeenCalledWith("Report cycle failed", { error: "cycle boom" });
			// A thrown cycle must not stop the daemon - it still schedules the next sleep.
			expect(mocks.info).toHaveBeenCalledWith("Sleeping until next scan", { intervalSecs: 300 });
		} finally {
			vi.useRealTimers();
		}
	});

	it("runOfflineImport fails fast when no endpoint is configured", async () => {
		const savedI = process.env["QNSI_ENDPOINT"];
		const savedP = process.env["QNSP_ENDPOINT"];
		delete process.env["QNSI_ENDPOINT"];
		delete process.env["QNSP_ENDPOINT"];
		try {
			await expect(runOfflineImport("/in")).rejects.toThrow("QNSI_ENDPOINT");
		} finally {
			if (savedI !== undefined) process.env["QNSI_ENDPOINT"] = savedI;
			if (savedP !== undefined) process.env["QNSP_ENDPOINT"] = savedP;
		}
	});

	it("dispatches the daemon/export/import/configure/status subcommands", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

		// status
		mocks.listScanCheckpointSummaries.mockResolvedValue([]);
		mocks.listQueuedReports.mockResolvedValue([]);
		await main(["node", "qnsp-agent", "status"]);
		expect(mocks.listScanCheckpointSummaries).toHaveBeenCalled();

		// configure
		mocks.question.mockResolvedValue("");
		mocks.writeConfigFile.mockReturnValue("/home/user/.qnsp-agent/config.env");
		await main(["node", "qnsp-agent", "configure"]);
		expect(mocks.writeConfigFile).toHaveBeenCalled();

		// export
		await main(["node", "qnsp-agent", "export", "/out"]);
		expect(mocks.runScan).toHaveBeenCalled();

		// import
		const savedEndpoint = process.env["QNSI_ENDPOINT"];
		process.env["QNSI_ENDPOINT"] = "https://api.qnsi.heossi.com";
		mocks.listOfflineReportBundles.mockResolvedValue(["/in/one.json"]);
		mocks.readOfflineReportBundle.mockResolvedValue({ bundleId: "b", payloadHash: "h" });
		mocks.submitOfflineReportBundle.mockResolvedValue({
			accepted: true,
			bundleId: "b",
			payloadHash: "h",
		});
		await main(["node", "qnsp-agent", "import", "/in"]);
		expect(mocks.submitOfflineReportBundle).toHaveBeenCalled();
		if (savedEndpoint === undefined) delete process.env["QNSI_ENDPOINT"];
		else process.env["QNSI_ENDPOINT"] = savedEndpoint;

		// daemon (loops forever - drive one cycle with fake timers, then abandon)
		vi.useFakeTimers();
		try {
			const daemon = main(["node", "qnsp-agent", "daemon"]);
			daemon.catch(() => undefined);
			await vi.advanceTimersByTimeAsync(0);
			expect(mocks.runScan).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}

		log.mockRestore();
	});

	it("dispatches documented commands and rejects unknown commands", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		await main(["node", "qnsp-agent", "run"]);
		await main(["node", "qnsp-agent", "version"]);
		await main(["node", "qnsp-agent", "--version"]);
		await main(["node", "qnsp-agent", "-v"]);
		await main(["node", "qnsp-agent", "help"]);
		await main(["node", "qnsp-agent", "--help"]);
		await main(["node", "qnsp-agent", "-h"]);
		await main(["node", "qnsp-agent"]);
		expect(() => printVersion()).not.toThrow();
		expect(() => printHelp()).not.toThrow();
		await expect(main(["node", "qnsp-agent", "unknown"])).rejects.toThrow("Unknown command");
		expect(error).toHaveBeenCalledWith("Unknown command: unknown");
		log.mockRestore();
		error.mockRestore();
	});
});
