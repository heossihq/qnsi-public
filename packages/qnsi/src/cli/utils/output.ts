import { sanitizeOutput } from "./sanitize.js";

export function printJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

export function printTable(data: Record<string, unknown>[] | Record<string, unknown>): void {
	if (Array.isArray(data)) {
		if (data.length === 0) {
			console.log("No results");
			return;
		}
		console.table(data);
	} else {
		console.table([data]);
	}
}

export function printError(message: string): void {
	console.error(`Error: ${message}`);
}

export function printSuccess(message: string): void {
	console.log(`✓ ${message}`);
}

export function printVerbose(message: string, verbose: boolean): void {
	if (verbose) {
		const sanitized = sanitizeOutput(message);
		console.log(`[DEBUG] ${sanitized}`);
	}
}
