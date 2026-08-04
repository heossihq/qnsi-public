import * as vscode from "vscode";

export function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration("qnsi");
}

export function getPlatformUrl(): string {
	const url = getConfig().get<string>("platformUrl") ?? "https://api.qnsi.heossi.com";
	return url.trim().replace(/\/+$/, "");
}

export function getScanInclude(): string[] {
	return getConfig().get<string[]>("scan.include") ?? [];
}

export function getScanExclude(): string[] {
	return getConfig().get<string[]>("scan.exclude") ?? [];
}

export function getScanMaxFiles(): number {
	return getConfig().get<number>("scan.maxFiles") ?? 2000;
}

export function getScanOnSave(): boolean {
	return getConfig().get<boolean>("scanOnSave") ?? false;
}
