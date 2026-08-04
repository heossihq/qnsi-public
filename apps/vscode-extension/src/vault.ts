import * as vscode from "vscode";
import { withClient } from "./client";
import { logError } from "./output";

const STORE_KEY = "qnsi.vault.secrets";

export interface SecretRef {
	readonly id: string;
	readonly name: string;
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

/**
 * Lists secrets this workspace created through the extension. The SDK exposes secret
 * create/get/rotate by id (not a list-all), so we track ids we minted in workspaceState -
 * an honest, real view rather than guessing an enumeration endpoint.
 */
export class VaultTreeProvider implements vscode.TreeDataProvider<SecretRef> {
	private readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(private readonly context: vscode.ExtensionContext) {}

	private list(): SecretRef[] {
		return this.context.workspaceState.get<SecretRef[]>(STORE_KEY) ?? [];
	}

	async add(ref: SecretRef): Promise<void> {
		const next = [ref, ...this.list().filter((s) => s.id !== ref.id)];
		await this.context.workspaceState.update(STORE_KEY, next);
		this.emitter.fire();
	}

	refresh(): void {
		this.emitter.fire();
	}

	getChildren(): SecretRef[] {
		return this.list();
	}

	getTreeItem(ref: SecretRef): vscode.TreeItem {
		const item = new vscode.TreeItem(ref.name || ref.id, vscode.TreeItemCollapsibleState.None);
		item.description = ref.id;
		item.contextValue = "qnsiSecret";
		item.iconPath = new vscode.ThemeIcon("lock");
		item.tooltip = "Quantum-safe vault secret (created via QNSI for VS Code)";
		return item;
	}
}

export async function createSecretCommand(
	context: vscode.ExtensionContext,
	tree: VaultTreeProvider,
): Promise<void> {
	const name = await vscode.window.showInputBox({
		title: "Create Vault Secret - name",
		prompt: "A label for the secret",
		ignoreFocusOut: true,
	});
	if (!name) {
		return;
	}
	const value = await vscode.window.showInputBox({
		title: "Create Vault Secret - value",
		prompt: "The secret value (PQC-encrypted at rest in the vault)",
		password: true,
		ignoreFocusOut: true,
	});
	if (value === undefined) {
		return;
	}
	await withClient(context, async (client) => {
		try {
			const payloadB64 = Buffer.from(value, "utf8").toString("base64");
			const created = (await client.vault.createSecret({ name, payloadB64 })) as Record<
				string,
				unknown
			>;
			const id = str(created, "secretId", "id") ?? "(created)";
			await tree.add({ id, name });
			void vscode.window.showInformationMessage(`QNSI: created vault secret "${name}" (${id}).`);
		} catch (err) {
			logError("vault createSecret", err);
			void vscode.window.showErrorMessage(
				`QNSI: create secret failed - ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});
}

export async function revealSecretCommand(
	context: vscode.ExtensionContext,
	ref: SecretRef | undefined,
): Promise<void> {
	if (!ref?.id) {
		return;
	}
	await withClient(context, async (client) => {
		try {
			const sec = (await client.vault.getSecret(ref.id)) as Record<string, unknown>;
			const b64 = str(sec, "payloadB64", "payload", "value", "data");
			if (!b64) {
				void vscode.window.showWarningMessage("QNSI: secret has no readable payload field.");
				return;
			}
			let value: string;
			try {
				value = Buffer.from(b64, "base64").toString("utf8");
			} catch {
				value = b64;
			}
			await vscode.env.clipboard.writeText(value);
			void vscode.window.showInformationMessage(
				`QNSI: value of "${ref.name}" copied to clipboard.`,
			);
		} catch (err) {
			logError("vault getSecret", err);
			void vscode.window.showErrorMessage(
				`QNSI: reveal failed - ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});
}
