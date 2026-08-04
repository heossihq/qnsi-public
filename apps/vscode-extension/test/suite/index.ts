import assert from "node:assert";
import * as vscode from "vscode";

/**
 * In-host runtime checks (run by @vscode/test-electron inside a real VS Code):
 *  - the extension is present and ACTIVATES,
 *  - every contributed command is registered,
 *  - the hover IntelliSense provider actually fires on a quantum-vulnerable token.
 * All offline - no network / API key required.
 */
export async function run(): Promise<void> {
	const ext = vscode.extensions.getExtension("Heossi.qnsi");
	assert.ok(ext, "extension Heossi.qnsi must be present in the host");
	await ext.activate();
	assert.ok(ext.isActive, "extension must activate");

	const cmds = await vscode.commands.getCommands(true);
	const required = [
		"qnsi.signIn",
		"qnsi.signOut",
		"qnsi.scanWorkspace",
		"qnsi.exportCbom",
		"qnsi.showReadiness",
		"qnsi.kms.createKey",
		"qnsi.kms.rotateKey",
		"qnsi.vault.createSecret",
		"qnsi.vault.reveal",
		"qnsi.conformance.refresh",
		"qnsi.configureMcp",
	];
	const missing = required.filter((c) => !cmds.includes(c));
	assert.strictEqual(missing.length, 0, `commands not registered: ${missing.join(", ")}`);

	// Hover provider proves the IntelliSense surface is wired end-to-end in the host.
	const doc = await vscode.workspace.openTextDocument({
		language: "plaintext",
		content: "config: use rsa-2048 keys",
	});
	await vscode.window.showTextDocument(doc);
	const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
		"vscode.executeHoverProvider",
		doc.uri,
		new vscode.Position(0, 14),
	);
	assert.ok(
		Array.isArray(hovers) && hovers.length > 0,
		"hover provider returned guidance for rsa-2048",
	);

	console.log(`QNSI runtime OK: activated, ${required.length} commands registered, hover fired`);
}
