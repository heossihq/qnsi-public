/**
 * Final arms: non-auth error propagation out of getClient consumers, the
 * readiness message variants, NIST-name hovers, MCP defaults, tree file
 * items, severity mapping (incl. the new low rule), and sort comparators.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "../test/vscode-api";

const { __resetVscodeMock, Position, Uri } = vscode;

import { type CryptoFinding, detectInText } from "./cbom/detector";
import { CbomController } from "./cbom/scan";
import { CbomTreeProvider } from "./cbom/tree";
import { invalidateClient, withClient } from "./client";
import { ConformanceStatusBar } from "./conformance";
import { activate } from "./extension";
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
		subscriptions: [],
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

describe("non-auth failures propagate", () => {
	it("withClient and the status bar rethrow configuration failures", async () => {
		vscode.workspace.getConfiguration.mockImplementation(() => {
			throw new Error("config subsystem broke");
		});
		await expect(withClient(context(), async () => "never")).rejects.toThrow(
			"config subsystem broke",
		);
		const bar = new ConformanceStatusBar(context());
		await expect(bar.refresh()).rejects.toThrow("config subsystem broke");
		bar.dispose();
	});

	it("counts failed-only conformance stats with a zero passed fallback", async () => {
		sdk.ensureActivated.mockResolvedValue({ tenantId: "tenant-1", tier: "pro" });
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ failedRuns: 4 }), { status: 200 }));
		const bar = new ConformanceStatusBar(context());
		await bar.refresh();
		const item = vscode.window.createStatusBarItem.mock.results.at(-1)?.value as unknown as {
			tooltip: string;
		};
		expect(item.tooltip).toContain("0 passed, 4 failed");
		bar.dispose();
	});
});

describe("readiness message variants", () => {
	it("shows the score when present and n/a when null", async () => {
		const ctx = context();
		sdk.tenantId.mockResolvedValue("tenant-1");
		sdk.kms.listKeys.mockResolvedValue({ items: [] });
		sdk.ensureActivated.mockResolvedValue({ tenantId: "tenant-1", tier: "pro" });
		fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
		await activate(ctx as never);
		const showReadiness = (
			vscode.commands.registerCommand.mock.calls as unknown as Array<[string, () => Promise<void>]>
		).find(([name]) => name === "qnsi.showReadiness")?.[1] as () => Promise<void>;

		sdk.cryptoInventory.getReadinessScore.mockResolvedValueOnce({ score: 88, label: "strong" });
		await showReadiness();
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			"QNSI PQC readiness: 88 - strong",
		);

		sdk.cryptoInventory.getReadinessScore.mockResolvedValueOnce({ label: "unknown state" });
		await showReadiness();
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			"QNSI PQC readiness: n/a - unknown state",
		);
	});

	it("signIn success path refreshes the signed-in surfaces", async () => {
		const ctx = context();
		sdk.ensureActivated.mockResolvedValue({ tenantId: "tenant-1", tier: "pro" });
		sdk.kms.listKeys.mockResolvedValue({ items: [] });
		fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
		await activate(ctx as never);
		const signInCommand = (
			vscode.commands.registerCommand.mock.calls as unknown as Array<[string, () => Promise<void>]>
		).find(([name]) => name === "qnsi.signIn")?.[1] as () => Promise<void>;
		vscode.window.showInputBox.mockResolvedValueOnce("fresh-key");
		await signInCommand();
		expect(sdk.kms.listKeys).toHaveBeenCalled();
	});
});

describe("hover for NIST names", () => {
	it("falls back to the literal word when only the NIST name matches", () => {
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
		const doc = {
			getWordRangeAtPosition: vi.fn(() => ({})),
			getText: vi.fn(() => "ML-KEM-768"),
		};
		const result = hover.provideHover(doc, new Position(0, 0));
		expect((result?.contents as { value: string }).value).toContain("ML-KEM-768");
	});
});

describe("mcp defaults", () => {
	it("merges into a parseable file with no servers or inputs keys", async () => {
		(vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
			{ uri: Uri.file("/repo") },
		];
		vscode.workspace.fs.stat.mockResolvedValue({});
		vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("{}"));
		vscode.window.showInformationMessage.mockResolvedValue(undefined);
		await configureMcpCommand();
		const written = JSON.parse(
			Buffer.from(
				vscode.workspace.fs.writeFile.mock.calls[0]?.at?.(1) as unknown as Uint8Array,
			).toString("utf8"),
		) as { servers: Record<string, unknown>; inputs: unknown[] };
		expect(Object.keys(written.servers)).toEqual(["qnsi"]);
		expect(written.inputs).toHaveLength(1);
	});
});

describe("severity mapping and sorting", () => {
	it("maps medium to Information and low to Hint, sorting multi-finding files", () => {
		const controller = new CbomController(context());
		const text = "blowfish aes-128 md5 rsa-2048";
		expect(
			detectInText(text)
				.map((f) => f.urgency)
				.sort(),
		).toEqual(["critical", "high", "low", "medium"]);
		controller.scanDocument({
			uri: { scheme: "file", fsPath: "/src/mixed.ts" },
			getText: () => text,
		} as never);
		const sorted = controller.results.get("/src/mixed.ts") as CryptoFinding[];
		expect(sorted.map((f) => f.urgency)).toEqual(["critical", "high", "medium", "low"]);
		expect(controller.counts()).toMatchObject({ critical: 1, high: 1, medium: 1, low: 1 });
		controller.dispose();
	});

	it("covers the workspace-scan comparator with a multi-finding file", async () => {
		const controller = new CbomController(context(""));
		vscode.workspace.getConfiguration.mockImplementation(
			() =>
				({
					get: vi.fn((key: string) => (key === "scan.include" ? ["**/*.ts"] : undefined)),
				}) as never,
		);
		vscode.workspace.findFiles.mockResolvedValue([Uri.file("/src/mixed.ts")] as never);
		vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("md5 blowfish"));
		vscode.window.showWarningMessage.mockResolvedValue(undefined);
		await controller.scanWorkspace();
		expect(controller.results.get("/src/mixed.ts")?.map((f) => f.urgency)).toEqual(["high", "low"]);
		controller.dispose();
	});
});

describe("tree file items", () => {
	it("renders a file node with its finding count", () => {
		const controller = new CbomController(context());
		controller.scanDocument({
			uri: { scheme: "file", fsPath: "/src/two.ts" },
			getText: () => "md5 blowfish",
		} as never);
		const tree = new CbomTreeProvider(controller);
		const fileNode = tree.getChildren().find((n) => n.kind === "file");
		const item = tree.getTreeItem(fileNode as never);
		expect(item.description).toBe("2");
		// Direct file item for an unknown path renders zero findings.
		expect(tree.getTreeItem({ kind: "file", fsPath: "/nope" } as never).description).toBe("0");
		// A readiness item rendered with NO readiness at all falls back to n/a.
		controller.readiness = null;
		expect(tree.getTreeItem({ kind: "readiness" } as never).label).toBe("PQC readiness: n/a");
		controller.dispose();
	});
});

describe("detector flag handling", () => {
	it("adds the global flag for rules declared without it", () => {
		const rule = {
			id: "NOG",
			pattern: "abc",
			flags: "i",
			urgency: "low",
			recommend: "n/a",
			reason: "fixture",
		} as Parameters<typeof detectInText>[1] extends readonly (infer R)[] | undefined ? R : never;
		expect(detectInText("ABC abc", [rule])).toHaveLength(2);
	});
});
