/**
 * CbomController: document + workspace scanning, readiness, export, and the
 * diagnostics lifecycle - vscode mocked, SDK scripted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "../../test/vscode-api";

const { __resetVscodeMock, Uri } = vscode;

import { invalidateClient } from "../client";
import { CbomController } from "./scan";

const sdk = {
	tenantId: vi.fn(),
	cryptoInventory: { getReadinessScore: vi.fn() },
	ensureActivated: vi.fn(),
};

vi.mock("@heossihq/qnsi", () => ({
	QnsiClient: class {
		tenantId = sdk.tenantId;
		cryptoInventory = sdk.cryptoInventory;
		ensureActivated = sdk.ensureActivated;
	},
}));

type Ctx = ConstructorParameters<typeof CbomController>[0];

function context(apiKey = "key-1"): Ctx {
	return {
		secrets: { get: vi.fn(async () => apiKey), store: vi.fn(), delete: vi.fn() },
		workspaceState: { get: vi.fn(), update: vi.fn() },
		subscriptions: [],
	} as unknown as Ctx;
}

function configure(values: Record<string, unknown>): void {
	vscode.workspace.getConfiguration.mockImplementation(
		() => ({ get: vi.fn((key: string) => values[key]) }) as never,
	);
}

beforeEach(() => {
	__resetVscodeMock();
	invalidateClient();
	sdk.tenantId.mockReset();
	sdk.cryptoInventory.getReadinessScore.mockReset();
});

describe("scanDocument", () => {
	it("sets diagnostics for findings, clears them when clean, ignores non-file docs", () => {
		const controller = new CbomController(context());
		const uri = { scheme: "file", fsPath: "/src/a.ts" };
		controller.scanDocument({ uri, getText: () => "rsa-2048 everywhere" } as never);
		expect(controller.results.get("/src/a.ts")?.length).toBeGreaterThan(0);
		expect(controller.counts().critical).toBeGreaterThan(0);

		controller.scanDocument({ uri, getText: () => "ml-kem-768 only" } as never);
		expect(controller.results.has("/src/a.ts")).toBe(false);

		controller.scanDocument({
			uri: { scheme: "untitled", fsPath: "u" },
			getText: () => "rsa-2048",
		} as never);
		expect(controller.results.size).toBe(0);
		controller.dispose();
	});
});

describe("scanWorkspace", () => {
	it("warns without include globs", async () => {
		const controller = new CbomController(context());
		configure({ "scan.include": [] });
		await controller.scanWorkspace();
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			"QNSI: no scan include globs configured.",
		);
		controller.dispose();
	});

	it("scans matched files, skips binaries/large files, reports counts", async () => {
		const controller = new CbomController(context(""));
		configure({ "scan.include": ["**/*.ts"], "scan.exclude": [] });
		const files = [
			Uri.file("/src/vulnerable.ts"),
			Uri.file("/src/clean.ts"),
			Uri.file("/src/binary.bin"),
			Uri.file("/src/huge.txt"),
			Uri.file("/src/unreadable.ts"),
		];
		vscode.workspace.findFiles.mockResolvedValue(files as never);
		vscode.workspace.fs.readFile.mockImplementation(async (uri: { fsPath: string }) => {
			if (uri.fsPath.endsWith("vulnerable.ts")) return Buffer.from("uses secp256r1 curve");
			if (uri.fsPath.endsWith("clean.ts")) return Buffer.from("uses ml-dsa-65");
			if (uri.fsPath.endsWith("binary.bin")) return Buffer.from([0, 1, 2, 3]);
			if (uri.fsPath.endsWith("huge.txt")) return Buffer.alloc(1_000_001, 97);
			throw new Error("EACCES");
		});
		vscode.window.showWarningMessage.mockResolvedValue(undefined);
		await controller.scanWorkspace();
		expect(controller.results.has("/src/vulnerable.ts")).toBe(true);
		expect(controller.results.size).toBe(1);
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("finding(s)"),
		);
		controller.dispose();
	});

	it("celebrates a clean scan and honors cancellation with multiple globs", async () => {
		const controller = new CbomController(context(""));
		configure({ "scan.include": ["**/*.ts", "**/*.py"], "scan.exclude": ["**/dist/**"] });
		const files = Array.from({ length: 60 }, (_, i) => Uri.file(`/src/f${i}.ts`));
		vscode.workspace.findFiles.mockResolvedValue(files as never);
		vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("clean"));
		let progressReports = 0;
		vscode.window.withProgress.mockImplementation(
			async (
				_options: unknown,
				task: (
					progress: { report: (v: unknown) => void },
					token: { isCancellationRequested: boolean },
				) => Promise<unknown>,
			) =>
				task(
					{
						report: () => {
							progressReports += 1;
						},
					},
					{ isCancellationRequested: false },
				),
		);
		await controller.scanWorkspace();
		expect(progressReports).toBeGreaterThan(0);
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("no quantum-vulnerable"),
		);
		// The multi-glob include and exclude were passed through to findFiles.
		expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
			"{**/*.ts,**/*.py}",
			"{**/dist/**}",
			2000,
		);

		// Cancellation stops before any file is read.
		vscode.workspace.fs.readFile.mockClear();
		vscode.window.withProgress.mockImplementation(
			async (
				_options: unknown,
				task: (
					progress: { report: (v: unknown) => void },
					token: { isCancellationRequested: boolean },
				) => Promise<unknown>,
			) => task({ report: vi.fn() }, { isCancellationRequested: true }),
		);
		await controller.scanWorkspace();
		expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
		controller.dispose();
	});
});

describe("refreshReadiness", () => {
	it("stores the score, keeps nulls honest, and preserves state in vendor-signed-out mode", async () => {
		const controller = new CbomController(context());
		sdk.tenantId.mockResolvedValue("tenant-1");
		sdk.cryptoInventory.getReadinessScore.mockResolvedValueOnce({
			score: 71,
			status: "improving",
		});
		await controller.refreshReadiness();
		expect(controller.readiness).toEqual({ score: 71, detail: "improving" });

		sdk.cryptoInventory.getReadinessScore.mockResolvedValueOnce({ odd: true });
		await controller.refreshReadiness();
		expect(controller.readiness).toEqual({ score: null, detail: "Readiness retrieved" });

		sdk.cryptoInventory.getReadinessScore.mockRejectedValueOnce(new Error("service down"));
		await controller.refreshReadiness();
		expect(controller.readiness).toBeNull();

		// Signed out: withClient yields undefined and the last readiness stays.
		const signedOut = new CbomController(context(""));
		vscode.window.showWarningMessage.mockResolvedValue(undefined);
		signedOut.readiness = { score: 5, detail: "stale" };
		await signedOut.refreshReadiness();
		expect(signedOut.readiness).toEqual({ score: 5, detail: "stale" });
		controller.dispose();
		signedOut.dispose();
	});
});

describe("exportCbom and clear", () => {
	it("exports scanned findings as a CycloneDX document, refusing empty exports", async () => {
		const controller = new CbomController(context());
		await controller.exportCbom();
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("run a workspace scan first"),
		);

		controller.scanDocument({
			uri: { scheme: "file", fsPath: "/src/a.ts" },
			getText: () => "rsa-4096",
		} as never);
		await controller.exportCbom();
		const opened = vscode.workspace.openTextDocument.mock.calls[0]?.[0] as {
			language: string;
			content: string;
		};
		expect(opened.language).toBe("json");
		expect(JSON.parse(opened.content).bomFormat).toBe("CycloneDX");
		expect(vscode.window.showTextDocument).toHaveBeenCalled();

		controller.clear();
		expect(controller.results.size).toBe(0);
		expect(controller.readiness).toBeNull();
		controller.dispose();
	});
});
