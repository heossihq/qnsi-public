/**
 * Status bar + MCP config + intellisense + scan/tree + extension activation,
 * all against the vscode mock with a scripted SDK.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "../test/vscode-api";

const { __resetVscodeMock, Position, Uri } = vscode;

import { CbomController } from "./cbom/scan";
import { CbomTreeProvider } from "./cbom/tree";
import { invalidateClient } from "./client";
import { ConformanceStatusBar } from "./conformance";
import { activate, deactivate } from "./extension";
import { registerIntelliSense } from "./intellisense";
import { configureMcpCommand } from "./mcp";

const sdk = {
	ensureActivated: vi.fn(),
	tenantId: vi.fn(),
	cryptoInventory: { getReadinessScore: vi.fn() },
	kms: { listKeys: vi.fn() },
	vault: {},
};

vi.mock("@heossihq/qnsi", () => ({
	QnsiClient: class {
		ensureActivated = sdk.ensureActivated;
		tenantId = sdk.tenantId;
		cryptoInventory = sdk.cryptoInventory;
		kms = sdk.kms;
		vault = sdk.vault;
	},
}));

type Ctx = ConstructorParameters<typeof ConformanceStatusBar>[0];

function context(apiKey = "key-1"): Ctx {
	const state = new Map<string, unknown>();
	return {
		secrets: { get: vi.fn(async () => apiKey), store: vi.fn(), delete: vi.fn() },
		workspaceState: {
			get: vi.fn((key: string) => state.get(key)),
			update: vi.fn(async (key: string, value: unknown) => {
				state.set(key, value);
			}),
		},
		subscriptions: [] as Array<{ dispose?: () => void }>,
	} as unknown as Ctx;
}

const fetchMock = vi.fn();

beforeEach(() => {
	__resetVscodeMock();
	invalidateClient();
	sdk.ensureActivated.mockReset();
	sdk.tenantId.mockReset();
	sdk.cryptoInventory.getReadinessScore.mockReset();
	sdk.kms.listKeys.mockReset();
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

describe("ConformanceStatusBar", () => {
	function lastStatusItem() {
		return vscode.window.createStatusBarItem.mock.results.at(-1)?.value as unknown as {
			text: string;
			tooltip: string;
			command: string;
			dispose: ReturnType<typeof vi.fn>;
		};
	}

	it("prompts sign-in when no key is stored", async () => {
		const bar = new ConformanceStatusBar(context(""));
		await bar.refresh();
		const item = lastStatusItem();
		expect(item.text).toBe("$(shield) QNSI: sign in");
		expect(item.command).toBe("qnsi.signIn");
		bar.dispose();
		expect(item.dispose).toHaveBeenCalled();
	});

	it("shows the tier with conformance stats from the audit service", async () => {
		sdk.ensureActivated.mockResolvedValue({ tenantId: "tenant-1", tier: "pro" });
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ passed: 12, failed: 1 }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const bar = new ConformanceStatusBar(context());
		await bar.refresh();
		const item = lastStatusItem();
		expect(item.text).toBe("$(shield) QNSI: pro");
		expect(item.tooltip).toContain("Conformance L0-L3: 12 passed, 1 failed");
	});

	it("degrades honestly on stats variants and activation failure", async () => {
		sdk.ensureActivated.mockResolvedValue({ tenantId: "tenant-1", tier: "pro" });
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
		const bar = new ConformanceStatusBar(context());
		await bar.refresh();
		expect(lastStatusItem().tooltip).not.toContain("Conformance");

		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ irrelevant: true }), { status: 200 }),
		);
		await bar.refresh();
		expect(lastStatusItem().tooltip).not.toContain("Conformance");

		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ passedCount: 3 }), { status: 200 }),
		);
		await bar.refresh();
		expect(lastStatusItem().tooltip).toContain("3 passed, 0 failed");

		fetchMock.mockRejectedValueOnce(new Error("network down"));
		await bar.refresh();
		expect(lastStatusItem().text).toBe("$(shield) QNSI: pro");

		sdk.ensureActivated.mockRejectedValueOnce(new Error("activation broke"));
		await bar.refresh();
		expect(lastStatusItem().text).toBe("$(shield) QNSI: error");
		expect(lastStatusItem().tooltip).toBe("activation broke");

		sdk.ensureActivated.mockRejectedValueOnce("raw activation failure");
		await bar.refresh();
		expect(lastStatusItem().tooltip).toBe("raw activation failure");
	});
});

describe("configureMcpCommand", () => {
	it("requires an open folder", async () => {
		await configureMcpCommand();
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("open a folder"),
		);
	});

	function openFolder(): void {
		(vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
			{ uri: Uri.file("/repo") },
		];
	}

	it("writes a fresh mcp.json when none exists and opens it on request", async () => {
		openFolder();
		vscode.workspace.fs.stat.mockRejectedValue(new Error("missing"));
		vscode.window.showInformationMessage.mockResolvedValueOnce("Open mcp.json");
		await configureMcpCommand();
		const [uri, bytes] = vscode.workspace.fs.writeFile.mock.calls[0] as unknown as [
			{ fsPath: string },
			Uint8Array,
		];
		expect(uri.fsPath).toBe("/repo/.vscode/mcp.json");
		const written = JSON.parse(Buffer.from(bytes).toString("utf8")) as {
			servers: { qnsi: { command: string } };
			inputs: unknown[];
		};
		expect(written.servers.qnsi.command).toBe("npx");
		expect(written.inputs).toHaveLength(1);
		expect(vscode.window.showTextDocument).toHaveBeenCalled();
	});

	it("merges into an existing parseable config, prompting before overwrite", async () => {
		openFolder();
		vscode.workspace.fs.stat.mockResolvedValue({});
		vscode.workspace.fs.readFile.mockResolvedValue(
			Buffer.from(JSON.stringify({ servers: { other: {} }, inputs: [{ id: "existing" }] })),
		);
		vscode.window.showInformationMessage.mockResolvedValue(undefined);
		await configureMcpCommand();
		const merged = JSON.parse(
			Buffer.from(
				vscode.workspace.fs.writeFile.mock.calls[0]?.at?.(1) as unknown as Uint8Array,
			).toString("utf8"),
		) as { servers: Record<string, unknown>; inputs: Array<{ id: string }> };
		expect(Object.keys(merged.servers).sort()).toEqual(["other", "qnsi"]);
		expect(merged.inputs.map((i) => i.id)).toEqual(["existing", "qnsi-api-key"]);

		// Existing qnsi server: declining the overwrite leaves the file untouched.
		vscode.workspace.fs.readFile.mockResolvedValue(
			Buffer.from(JSON.stringify({ servers: { qnsi: { old: true } } })),
		);
		vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
		vscode.workspace.fs.writeFile.mockClear();
		await configureMcpCommand();
		expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();

		// Accepting the overwrite rewrites the entry and reuses the existing input.
		vscode.window.showWarningMessage.mockResolvedValueOnce("Overwrite");
		vscode.workspace.fs.readFile.mockResolvedValue(
			Buffer.from(
				JSON.stringify({ servers: { qnsi: { old: true } }, inputs: [{ id: "qnsi-api-key" }] }),
			),
		);
		await configureMcpCommand();
		expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
	});

	it("copies the snippet instead of clobbering an unparseable file", async () => {
		openFolder();
		vscode.workspace.fs.stat.mockResolvedValue({});
		vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("// commented json"));
		await configureMcpCommand();
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("qnsi-api-key"),
		);
		expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();

		// A parseable non-object (e.g. a JSON string) takes the same clipboard path.
		vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from('"just a string"'));
		await configureMcpCommand();
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
	});
});

describe("intellisense", () => {
	function providers() {
		registerIntelliSense(context());
		const hover = (
			vscode.languages.registerHoverProvider.mock.calls[0] as unknown as [
				unknown,
				{
					provideHover: (
						doc: unknown,
						pos: InstanceType<typeof Position>,
					) => { contents: { value: string } } | undefined;
				},
			]
		)[1];
		const completion = (
			vscode.languages.registerCompletionItemProvider.mock.calls[0] as unknown as [
				unknown,
				{ provideCompletionItems: () => unknown[] },
			]
		)[1];
		return { hover, completion };
	}

	function docWith(word: string | undefined) {
		return {
			getWordRangeAtPosition: vi.fn(() => (word === undefined ? undefined : { word })),
			getText: vi.fn(() => word ?? ""),
		};
	}

	it("hovers PQC algorithms as safe and vulnerable ones with guidance", () => {
		const { hover, completion } = providers();
		const pqc = hover.provideHover(docWith("kyber-768"), new Position(0, 1));
		expect((pqc?.contents as { value: string }).value).toContain("ML-KEM-768");
		expect((pqc?.contents as { value: string }).value).toContain("quantum-resistant");

		const vulnerable = hover.provideHover(docWith("ed25519"), new Position(0, 1));
		expect((vulnerable?.contents as { value: string }).value).toContain("quantum-vulnerable");

		expect(hover.provideHover(docWith("wholesome"), new Position(0, 1))).toBeUndefined();
		expect(hover.provideHover(docWith(undefined), new Position(0, 1))).toBeUndefined();

		expect(completion.provideCompletionItems().length).toBeGreaterThan(5);
	});
});

describe("CbomTreeProvider", () => {
	it("renders readiness, summary, files, and findings", () => {
		const controller = new CbomController(context());
		const tree = new CbomTreeProvider(controller);
		// Empty state: summary only.
		expect(tree.getChildren().map((n) => n.kind)).toEqual(["summary"]);
		expect(tree.getTreeItem({ kind: "summary" }).label as string).toContain("No findings");

		controller.results.set("/src/b.ts", [
			{
				algorithm: "RSA",
				urgency: "critical",
				recommend: "ML-KEM-768",
				reason: "Shor.",
				matchText: "rsa-2048",
				line: 0,
				startChar: 0,
				endChar: 8,
			},
			{
				algorithm: "MD5",
				urgency: "medium",
				recommend: "SHA3-256",
				reason: "Broken hash.",
				matchText: "md5",
				line: 2,
				startChar: 1,
				endChar: 4,
			},
		]);
		controller.readiness = { score: 82, detail: "on track" };
		const roots = tree.getChildren();
		expect(roots.map((n) => n.kind)).toEqual(["readiness", "summary", "file"]);
		expect(tree.getTreeItem(roots[0] as never).label as string).toBe("PQC readiness: 82");
		expect(tree.getTreeItem(roots[1] as never).label as string).toContain("2 findings");

		const findings = tree.getChildren(roots[2]);
		expect(findings).toHaveLength(2);
		const critical = tree.getTreeItem(findings[0] as never);
		expect(critical.label).toBe("RSA - line 1");
		expect(critical.description).toBe("critical");
		const medium = tree.getTreeItem(findings[1] as never);
		expect(medium.description).toBe("medium");

		// Null-score readiness falls back to the detail, and unknown-file children are empty.
		controller.readiness = { score: null, detail: "unavailable" };
		expect(tree.getTreeItem({ kind: "readiness" }).label as string).toBe(
			"PQC readiness: unavailable",
		);
		expect(tree.getChildren({ kind: "file", fsPath: "/nope" })).toEqual([]);
		expect(tree.getChildren({ kind: "summary" })).toEqual([]);
		controller.dispose();
	});
});

describe("extension activation", () => {
	it("activates, registers every command, and drives the scan-on-save hook", async () => {
		const ctx = context("");
		vscode.window.showWarningMessage.mockResolvedValue(undefined);
		await activate(ctx as never);
		const commandNames = vscode.commands.registerCommand.mock.calls.map(
			(call) => (call as unknown as [string])[0],
		);
		expect(commandNames).toEqual(
			expect.arrayContaining([
				"qnsi.signIn",
				"qnsi.signOut",
				"qnsi.scanWorkspace",
				"qnsi.exportCbom",
				"qnsi.showReadiness",
				"qnsi.kms.refresh",
				"qnsi.kms.createKey",
				"qnsi.kms.rotateKey",
				"qnsi.kms.copyId",
				"qnsi.vault.refresh",
				"qnsi.vault.createSecret",
				"qnsi.vault.reveal",
				"qnsi.conformance.refresh",
				"qnsi.configureMcp",
			]),
		);

		// Fire each registered command callback (not signed in -> graceful paths).
		vscode.window.showInputBox.mockResolvedValue(undefined);
		vscode.window.showQuickPick.mockResolvedValue(undefined);
		for (const [, callback] of vscode.commands.registerCommand.mock.calls as unknown as Array<
			[string, (...args: unknown[]) => unknown]
		>) {
			await callback(undefined);
		}

		// The save hook scans only when scanOnSave is enabled.
		const onSave = (
			vscode.workspace.onDidSaveTextDocument.mock.calls[0] as unknown as [(doc: unknown) => void]
		)[0];
		const doc = {
			uri: { scheme: "file", fsPath: "/src/saved.ts" },
			getText: () => "generateKeyPairSync('rsa'",
		};
		onSave(doc);
		vscode.workspace.getConfiguration.mockImplementation(
			() => ({ get: vi.fn((key: string) => key === "scanOnSave") }) as never,
		);
		onSave(doc);
		deactivate();
	});
});
