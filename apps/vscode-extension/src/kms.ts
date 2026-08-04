import * as vscode from "vscode";
import { withClient } from "./client";
import { logError } from "./output";

export interface KeyRow {
	readonly keyId: string;
	readonly algorithm: string | undefined;
	readonly status: string | undefined;
	readonly raw: Record<string, unknown>;
}

function extractArray(resp: unknown): Record<string, unknown>[] {
	if (Array.isArray(resp)) {
		return resp as Record<string, unknown>[];
	}
	if (resp && typeof resp === "object") {
		for (const k of ["items", "keys", "data", "results"]) {
			const v = (resp as Record<string, unknown>)[k];
			if (Array.isArray(v)) {
				return v as Record<string, unknown>[];
			}
		}
	}
	return [];
}

function str(o: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const k of keys) {
		const v = o[k];
		if (typeof v === "string" && v.length > 0) {
			return v;
		}
	}
	return undefined;
}

const ALGORITHM_CHOICES: ReadonlyArray<{ label: string; description: string; id: string }> = [
	{ label: "ML-KEM-768", description: "kyber-768 · key encapsulation (FIPS 203)", id: "kyber-768" },
	{
		label: "ML-KEM-1024",
		description: "kyber-1024 · key encapsulation (FIPS 203)",
		id: "kyber-1024",
	},
	{ label: "ML-DSA-65", description: "dilithium-3 · signatures (FIPS 204)", id: "dilithium-3" },
	{ label: "ML-DSA-87", description: "dilithium-5 · signatures (FIPS 204)", id: "dilithium-5" },
	{
		label: "FN-DSA-1024",
		description: "falcon-1024 · signatures (FIPS 206 draft)",
		id: "falcon-1024",
	},
	{ label: "AES-256-GCM", description: "symmetric data key", id: "aes-256-gcm" },
];

export class KmsTreeProvider implements vscode.TreeDataProvider<KeyRow> {
	private rows: KeyRow[] = [];
	private readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(private readonly context: vscode.ExtensionContext) {}

	async refresh(): Promise<void> {
		const rows = await withClient(this.context, async (client) => {
			const resp = await client.kms.listKeys({ limit: 100 });
			return extractArray(resp).map(
				(o): KeyRow => ({
					keyId: str(o, "keyId", "id", "key_id") ?? "(unknown)",
					algorithm: str(o, "algorithm", "alg"),
					status: str(o, "status", "state"),
					raw: o,
				}),
			);
		});
		this.rows = rows ?? [];
		this.emitter.fire();
	}

	getChildren(): KeyRow[] {
		return this.rows;
	}

	getTreeItem(row: KeyRow): vscode.TreeItem {
		const item = new vscode.TreeItem(row.keyId, vscode.TreeItemCollapsibleState.None);
		item.description = [row.algorithm, row.status].filter((x) => Boolean(x)).join(" · ");
		item.contextValue = "qnsiKey";
		item.iconPath = new vscode.ThemeIcon("key");
		return item;
	}
}

export async function createKeyCommand(
	context: vscode.ExtensionContext,
	tree: KmsTreeProvider,
): Promise<void> {
	const pick = await vscode.window.showQuickPick(
		ALGORITHM_CHOICES.map((c) => ({ label: c.label, description: c.description, id: c.id })),
		{ title: "Create KMS Key - choose an algorithm", ignoreFocusOut: true },
	);
	if (!pick) {
		return;
	}
	await withClient(context, async (client) => {
		try {
			const created = (await client.kms.createKey({ algorithm: pick.id })) as Record<
				string,
				unknown
			>;
			const id = str(created, "keyId", "id", "key_id") ?? "(created)";
			void vscode.window.showInformationMessage(`QNSI: created KMS key ${id} (${pick.label}).`);
			await tree.refresh();
		} catch (err) {
			logError("kms createKey", err);
			void vscode.window.showErrorMessage(
				`QNSI: create key failed - ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});
}

export async function rotateKeyCommand(
	context: vscode.ExtensionContext,
	tree: KmsTreeProvider,
	row: KeyRow | undefined,
): Promise<void> {
	const keyId = row?.keyId;
	if (!keyId || keyId === "(unknown)") {
		void vscode.window.showWarningMessage("QNSI: select a key to rotate.");
		return;
	}
	const confirm = await vscode.window.showWarningMessage(
		`Rotate KMS key ${keyId}? A new version is created; the key id is preserved.`,
		{ modal: true },
		"Rotate",
	);
	if (confirm !== "Rotate") {
		return;
	}
	await withClient(context, async (client) => {
		try {
			await client.kms.rotateKey(keyId);
			void vscode.window.showInformationMessage(`QNSI: rotated key ${keyId}.`);
			await tree.refresh();
		} catch (err) {
			logError("kms rotateKey", err);
			void vscode.window.showErrorMessage(
				`QNSI: rotate failed - ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});
}

export async function copyKeyIdCommand(row: KeyRow | undefined): Promise<void> {
	if (!row?.keyId) {
		return;
	}
	await vscode.env.clipboard.writeText(row.keyId);
	void vscode.window.showInformationMessage(`QNSI: copied ${row.keyId}.`);
}
