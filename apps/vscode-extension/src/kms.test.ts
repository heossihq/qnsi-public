/**
 * KMS + Vault tree providers and commands against the vscode mock with a
 * scripted SDK client.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "../test/vscode-api";

const { __resetVscodeMock } = vscode;

import { invalidateClient } from "./client";
import {
	copyKeyIdCommand,
	createKeyCommand,
	type KeyRow,
	KmsTreeProvider,
	rotateKeyCommand,
} from "./kms";
import { createSecretCommand, revealSecretCommand, VaultTreeProvider } from "./vault";

const sdk = {
	kms: { listKeys: vi.fn(), createKey: vi.fn(), rotateKey: vi.fn() },
	vault: { createSecret: vi.fn(), getSecret: vi.fn() },
	ensureActivated: vi.fn(),
};

vi.mock("@heossihq/qnsi", () => ({
	QnsiClient: class {
		kms = sdk.kms;
		vault = sdk.vault;
		ensureActivated = sdk.ensureActivated;
	},
}));

type Ctx = ConstructorParameters<typeof KmsTreeProvider>[0];

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

beforeEach(() => {
	__resetVscodeMock();
	invalidateClient();
	for (const group of Object.values(sdk)) {
		if (typeof group === "function") continue;
		for (const fn of Object.values(group)) fn.mockReset();
	}
});

describe("KmsTreeProvider", () => {
	it("maps list responses from every accepted shape and renders items", async () => {
		const tree = new KmsTreeProvider(context());
		sdk.kms.listKeys.mockResolvedValueOnce({
			keys: [
				{ keyId: "key-a", algorithm: "kyber-768", status: "active" },
				{ id: "key-b", alg: "dilithium-3" },
				{ something: "unmappable" },
			],
		});
		await tree.refresh();
		const rows = tree.getChildren();
		expect(rows.map((r) => r.keyId)).toEqual(["key-a", "key-b", "(unknown)"]);
		const item = tree.getTreeItem(rows[0] as KeyRow);
		expect(item.description).toBe("kyber-768 · active");
		expect(tree.getTreeItem(rows[2] as KeyRow).description).toBe("");

		// Bare-array and unrecognized-shape responses.
		sdk.kms.listKeys.mockResolvedValueOnce([{ key_id: "key-c", state: "rotating" }]);
		await tree.refresh();
		expect(tree.getChildren()[0]?.keyId).toBe("key-c");
		sdk.kms.listKeys.mockResolvedValueOnce("garbage");
		await tree.refresh();
		expect(tree.getChildren()).toEqual([]);
	});

	it("shows an empty tree when not signed in", async () => {
		const tree = new KmsTreeProvider(context(""));
		vscode.window.showWarningMessage.mockResolvedValue(undefined);
		await tree.refresh();
		expect(tree.getChildren()).toEqual([]);
	});
});

describe("createKeyCommand", () => {
	it("creates a key for the chosen algorithm and refreshes", async () => {
		const tree = new KmsTreeProvider(context());
		vscode.window.showQuickPick.mockResolvedValueOnce({
			label: "ML-KEM-768",
			id: "kyber-768",
		});
		sdk.kms.createKey.mockResolvedValueOnce({ keyId: "new-key" });
		sdk.kms.listKeys.mockResolvedValue({ items: [] });
		await createKeyCommand(context(), tree);
		expect(sdk.kms.createKey).toHaveBeenCalledWith({ algorithm: "kyber-768" });
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("new-key"),
		);
	});

	it("no-ops without a pick and reports failures (Error and raw)", async () => {
		const tree = new KmsTreeProvider(context());
		vscode.window.showQuickPick.mockResolvedValueOnce(undefined);
		await createKeyCommand(context(), tree);
		expect(sdk.kms.createKey).not.toHaveBeenCalled();

		vscode.window.showQuickPick.mockResolvedValueOnce({ label: "x", id: "aes-256-gcm" });
		sdk.kms.createKey.mockRejectedValueOnce(new Error("quota reached"));
		await createKeyCommand(context(), tree);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("quota reached"),
		);

		vscode.window.showQuickPick.mockResolvedValueOnce({ label: "x", id: "aes-256-gcm" });
		sdk.kms.createKey.mockResolvedValueOnce({ unexpected: true });
		sdk.kms.listKeys.mockResolvedValue({ items: [] });
		await createKeyCommand(context(), tree);
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("(created)"),
		);

		vscode.window.showQuickPick.mockResolvedValueOnce({ label: "x", id: "aes-256-gcm" });
		sdk.kms.createKey.mockRejectedValueOnce("raw create failure");
		await createKeyCommand(context(), tree);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("raw create failure"),
		);
	});
});

describe("rotateKeyCommand", () => {
	const row: KeyRow = { keyId: "key-a", algorithm: "kyber-768", status: "active", raw: {} };

	it("requires a selected, known key and a modal confirmation", async () => {
		const tree = new KmsTreeProvider(context());
		await rotateKeyCommand(context(), tree, undefined);
		await rotateKeyCommand(context(), tree, { ...row, keyId: "(unknown)" });
		expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(2);

		vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
		await rotateKeyCommand(context(), tree, row);
		expect(sdk.kms.rotateKey).not.toHaveBeenCalled();
	});

	it("rotates on confirmation and reports failures", async () => {
		const tree = new KmsTreeProvider(context());
		vscode.window.showWarningMessage.mockResolvedValueOnce("Rotate");
		sdk.kms.rotateKey.mockResolvedValueOnce({});
		sdk.kms.listKeys.mockResolvedValue({ items: [] });
		await rotateKeyCommand(context(), tree, row);
		expect(sdk.kms.rotateKey).toHaveBeenCalledWith("key-a");

		vscode.window.showWarningMessage.mockResolvedValueOnce("Rotate");
		sdk.kms.rotateKey.mockRejectedValueOnce(new Error("rotation refused"));
		await rotateKeyCommand(context(), tree, row);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("rotation refused"),
		);

		vscode.window.showWarningMessage.mockResolvedValueOnce("Rotate");
		sdk.kms.rotateKey.mockRejectedValueOnce("raw rotate failure");
		await rotateKeyCommand(context(), tree, row);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("raw rotate failure"),
		);
	});
});

describe("copyKeyIdCommand", () => {
	it("copies the id and ignores empty rows", async () => {
		await copyKeyIdCommand(undefined);
		expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
		await copyKeyIdCommand({ keyId: "key-a", algorithm: undefined, status: undefined, raw: {} });
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith("key-a");
	});
});

describe("VaultTreeProvider + commands", () => {
	it("tracks minted secrets in workspaceState and renders items", async () => {
		const ctx = context();
		const tree = new VaultTreeProvider(ctx);
		expect(tree.getChildren()).toEqual([]);
		await tree.add({ id: "sec-1", name: "db-password" });
		await tree.add({ id: "sec-1", name: "db-password (renamed)" });
		expect(tree.getChildren()).toHaveLength(1);
		const item = tree.getTreeItem({ id: "sec-1", name: "db-password" });
		expect(item.description).toBe("sec-1");
		expect(tree.getTreeItem({ id: "sec-2", name: "" }).label).toBe("sec-2");
		tree.refresh();
	});

	it("creates a secret end to end, aborting on cancelled prompts", async () => {
		const ctx = context();
		const tree = new VaultTreeProvider(ctx);
		vscode.window.showInputBox.mockResolvedValueOnce(undefined);
		await createSecretCommand(ctx, tree);
		vscode.window.showInputBox.mockResolvedValueOnce("db-password");
		vscode.window.showInputBox.mockResolvedValueOnce(undefined);
		await createSecretCommand(ctx, tree);
		expect(sdk.vault.createSecret).not.toHaveBeenCalled();

		vscode.window.showInputBox.mockResolvedValueOnce("db-password");
		vscode.window.showInputBox.mockResolvedValueOnce("hunter2");
		sdk.vault.createSecret.mockResolvedValueOnce({ secretId: "sec-9" });
		await createSecretCommand(ctx, tree);
		expect(sdk.vault.createSecret).toHaveBeenCalledWith({
			name: "db-password",
			payloadB64: Buffer.from("hunter2", "utf8").toString("base64"),
		});
		expect(tree.getChildren()[0]).toEqual({ id: "sec-9", name: "db-password" });

		vscode.window.showInputBox.mockResolvedValueOnce("other");
		vscode.window.showInputBox.mockResolvedValueOnce("v");
		sdk.vault.createSecret.mockRejectedValueOnce(new Error("vault down"));
		await createSecretCommand(ctx, tree);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("vault down"),
		);

		vscode.window.showInputBox.mockResolvedValueOnce("other2");
		vscode.window.showInputBox.mockResolvedValueOnce("v");
		sdk.vault.createSecret.mockRejectedValueOnce("raw vault failure");
		await createSecretCommand(ctx, tree);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("raw vault failure"),
		);

		vscode.window.showInputBox.mockResolvedValueOnce("anon");
		vscode.window.showInputBox.mockResolvedValueOnce("v");
		sdk.vault.createSecret.mockResolvedValueOnce({ odd: true });
		await createSecretCommand(ctx, tree);
		expect(tree.getChildren()[0]?.id).toBe("(created)");
	});

	it("reveals a secret to the clipboard with base64 and fallback decoding", async () => {
		const ctx = context();
		await revealSecretCommand(ctx, undefined);
		expect(sdk.vault.getSecret).not.toHaveBeenCalled();

		sdk.vault.getSecret.mockResolvedValueOnce({
			payloadB64: Buffer.from("s3cret", "utf8").toString("base64"),
		});
		await revealSecretCommand(ctx, { id: "sec-1", name: "db" });
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith("s3cret");

		sdk.vault.getSecret.mockResolvedValueOnce({ nothing: true });
		await revealSecretCommand(ctx, { id: "sec-2", name: "empty" });
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			"QNSI: secret has no readable payload field.",
		);

		sdk.vault.getSecret.mockRejectedValueOnce(new Error("not found"));
		await revealSecretCommand(ctx, { id: "sec-3", name: "gone" });
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("not found"),
		);

		sdk.vault.getSecret.mockRejectedValueOnce("raw reveal failure");
		await revealSecretCommand(ctx, { id: "sec-4", name: "gone" });
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("raw reveal failure"),
		);
	});
});
