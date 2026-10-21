import { QNSI_OPERATIONS } from "@heossihq/qnsi";
import * as vscode from "vscode";
import { getRawAuth, NotSignedInError } from "./client";

/**
 * Full-surface API console: lets an operator call any customer-facing QNSI
 * edge route (/proxy/...) from the editor. The edge gateway enforces
 * authentication, tenant scoping, and billing entitlements per route exactly
 * as it does for the cloud portal - this is a client, not a bypass.
 */
export async function apiRequestCommand(
	context: vscode.ExtensionContext,
	selection?: { method: string; path: string },
): Promise<void> {
	const method =
		selection?.method ??
		(await vscode.window.showQuickPick(["GET", "POST", "PUT", "PATCH", "DELETE"], {
			placeHolder: "QNSI API method",
		}));
	if (!method) return;
	const path =
		selection?.path ??
		(await vscode.window.showInputBox({
			prompt: "Customer-facing edge path",
			value: "/proxy/kms/v1/keys",
			validateInput: (value) =>
				value.startsWith("/proxy/") ? undefined : "Path must start with /proxy/",
		}));
	if (!path) return;
	let body: string | undefined;
	if (method !== "GET") {
		body = await vscode.window.showInputBox({ prompt: "JSON body (optional)" });
	}
	try {
		const { apiKey, baseUrl } = await getRawAuth(context);
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			redirect: "error",
			signal: AbortSignal.timeout(15_000),
			headers: {
				authorization: `Bearer ${apiKey}`,
				"content-type": "application/json",
			},
			...(body ? { body } : {}),
		});
		const text = await response.text();
		const channel = vscode.window.createOutputChannel("QNSI API");
		context.subscriptions.push(channel);
		channel.clear();
		channel.appendLine(`${method} ${path} -> HTTP ${response.status}`);
		channel.appendLine(text);
		channel.show();
	} catch (err) {
		if (err instanceof NotSignedInError) {
			const pick = await vscode.window.showWarningMessage("QNSI: sign in to continue.", "Sign In");
			if (pick === "Sign In") await vscode.commands.executeCommand("qnsi.signIn");
			return;
		}
		vscode.window.showErrorMessage(
			`QNSI API request failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/** Searchable source catalog; it does not attest that an operation is deployed or entitled. */
export async function browseOperationsCommand(context: vscode.ExtensionContext): Promise<void> {
	const selection = await vscode.window.showQuickPick(
		QNSI_OPERATIONS.map((operation) => ({
			label: `${operation.method} ${operation.path}`,
			description: operation.service,
			detail: operation.description,
			operation,
		})),
		{
			title: "QNSI manifest operations (live availability NOT VERIFIED)",
			matchOnDescription: true,
			matchOnDetail: true,
		},
	);
	if (!selection) return;
	let path = selection.operation.path;
	for (const name of selection.operation.pathParameters) {
		const value = await vscode.window.showInputBox({
			prompt: `Path parameter: ${name}`,
			ignoreFocusOut: true,
		});
		if (!value || value === "." || value === "..") return;
		path = path.replace(`:${name}`, encodeURIComponent(value));
	}
	if (selection.operation.method !== "GET") {
		const confirm = await vscode.window.showWarningMessage(
			`Send ${selection.operation.method} ${path}? This can change persistent state. Backend policy and authorization still apply.`,
			{ modal: true },
			"Continue",
		);
		if (confirm !== "Continue") return;
	}
	await apiRequestCommand(context, { method: selection.operation.method, path });
}
