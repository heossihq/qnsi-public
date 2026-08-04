import * as vscode from "vscode";
import { refreshSignedInContext, signIn, signOut } from "./auth";
import { CbomController } from "./cbom/scan";
import { CbomTreeProvider } from "./cbom/tree";
import { getScanOnSave } from "./config";
import { ConformanceStatusBar } from "./conformance";
import { registerIntelliSense } from "./intellisense";
import {
	copyKeyIdCommand,
	createKeyCommand,
	type KeyRow,
	KmsTreeProvider,
	rotateKeyCommand,
} from "./kms";
import { configureMcpCommand } from "./mcp";
import { log } from "./output";
import {
	createSecretCommand,
	revealSecretCommand,
	type SecretRef,
	VaultTreeProvider,
} from "./vault";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	log("QNSI extension activating");
	await refreshSignedInContext(context);

	const cbom = new CbomController(context);
	const cbomTree = new CbomTreeProvider(cbom);
	const kmsTree = new KmsTreeProvider(context);
	const vaultTree = new VaultTreeProvider(context);
	const statusBar = new ConformanceStatusBar(context);

	context.subscriptions.push(
		cbom,
		statusBar,
		vscode.window.registerTreeDataProvider("qnsi.cbom", cbomTree),
		vscode.window.registerTreeDataProvider("qnsi.kms", kmsTree),
		vscode.window.registerTreeDataProvider("qnsi.vault", vaultTree),
	);

	registerIntelliSense(context);

	const refreshSignedInSurfaces = async (): Promise<void> => {
		await Promise.allSettled([kmsTree.refresh(), statusBar.refresh()]);
		vaultTree.refresh();
	};

	context.subscriptions.push(
		vscode.commands.registerCommand("qnsi.signIn", async () => {
			if (await signIn(context)) {
				await refreshSignedInSurfaces();
			}
		}),
		vscode.commands.registerCommand("qnsi.signOut", async () => {
			await signOut(context);
			cbom.clear();
			await refreshSignedInSurfaces();
		}),
		vscode.commands.registerCommand("qnsi.scanWorkspace", () => cbom.scanWorkspace()),
		vscode.commands.registerCommand("qnsi.exportCbom", () => cbom.exportCbom()),
		vscode.commands.registerCommand("qnsi.showReadiness", async () => {
			await cbom.refreshReadiness();
			const r = cbom.readiness;
			void vscode.window.showInformationMessage(
				r
					? `QNSI PQC readiness: ${r.score ?? "n/a"} - ${r.detail}`
					: "QNSI: readiness unavailable.",
			);
		}),
		vscode.commands.registerCommand("qnsi.kms.refresh", () => kmsTree.refresh()),
		vscode.commands.registerCommand("qnsi.kms.createKey", () => createKeyCommand(context, kmsTree)),
		vscode.commands.registerCommand("qnsi.kms.rotateKey", (row?: KeyRow) =>
			rotateKeyCommand(context, kmsTree, row),
		),
		vscode.commands.registerCommand("qnsi.kms.copyId", (row?: KeyRow) => copyKeyIdCommand(row)),
		vscode.commands.registerCommand("qnsi.vault.refresh", () => vaultTree.refresh()),
		vscode.commands.registerCommand("qnsi.vault.createSecret", () =>
			createSecretCommand(context, vaultTree),
		),
		vscode.commands.registerCommand("qnsi.vault.reveal", (ref?: SecretRef) =>
			revealSecretCommand(context, ref),
		),
		vscode.commands.registerCommand("qnsi.conformance.refresh", () => statusBar.refresh()),
		vscode.commands.registerCommand("qnsi.configureMcp", () => configureMcpCommand()),
		vscode.workspace.onDidSaveTextDocument((doc) => {
			if (getScanOnSave()) {
				cbom.scanDocument(doc);
			}
		}),
	);

	// Best-effort initial population if a key is already stored.
	void statusBar.refresh();
	void kmsTree.refresh();

	log("QNSI extension activated");
}

export function deactivate(): void {
	// Subscriptions are disposed by VS Code via context.subscriptions.
}
