import * as vscode from "vscode";
import { getApiKey, getClient, invalidateClient, SECRET_KEY } from "./client";
import { log, logError } from "./output";

const SIGNED_IN_CTX = "qnsi.signedIn";

/** Sync the `qnsi.signedIn` context key (drives view visibility / welcome content). */
export async function refreshSignedInContext(context: vscode.ExtensionContext): Promise<boolean> {
	const signedIn = Boolean(await getApiKey(context));
	await vscode.commands.executeCommand("setContext", SIGNED_IN_CTX, signedIn);
	return signedIn;
}

export async function signIn(context: vscode.ExtensionContext): Promise<boolean> {
	const apiKey = await vscode.window.showInputBox({
		title: "QNSI Sign In",
		prompt: "Paste your QNSI API key - stored in VS Code's encrypted Secret Storage.",
		password: true,
		ignoreFocusOut: true,
	});
	if (!apiKey || apiKey.trim().length === 0) {
		return false;
	}
	await context.secrets.store(SECRET_KEY, apiKey.trim());
	invalidateClient();
	try {
		const client = await getClient(context);
		const activation = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: "QNSI: activating…" },
			() => client.ensureActivated(),
		);
		await refreshSignedInContext(context);
		log(`signed in: tenant=${activation.tenantId} tier=${activation.tier}`);
		void vscode.window.showInformationMessage(
			`QNSI: signed in - tenant ${activation.tenantId}, tier "${activation.tier}".`,
		);
		return true;
	} catch (err) {
		// Reject the bad key so we never keep an unusable credential.
		logError("sign-in activation", err);
		await context.secrets.delete(SECRET_KEY);
		invalidateClient();
		await refreshSignedInContext(context);
		void vscode.window.showErrorMessage(
			`QNSI: sign-in failed - ${err instanceof Error ? err.message : String(err)}`,
		);
		return false;
	}
}

export async function signOut(context: vscode.ExtensionContext): Promise<void> {
	await context.secrets.delete(SECRET_KEY);
	invalidateClient();
	await refreshSignedInContext(context);
	void vscode.window.showInformationMessage("QNSI: signed out.");
}
