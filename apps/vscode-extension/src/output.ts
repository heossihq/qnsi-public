import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function getOutput(): vscode.OutputChannel {
	if (!channel) {
		channel = vscode.window.createOutputChannel("QNSI");
	}
	return channel;
}

export function log(message: string): void {
	const ts = new Date().toISOString();
	getOutput().appendLine(`[${ts}] ${message}`);
}

export function logError(context: string, error: unknown): void {
	const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	log(`ERROR ${context}: ${detail}`);
}
