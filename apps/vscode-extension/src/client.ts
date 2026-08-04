import { QnsiClient } from "@heossihq/qnsi";
import * as vscode from "vscode";
import { getPlatformUrl } from "./config";

export const SECRET_KEY = "qnsi.apiKey";

export class NotSignedInError extends Error {
	constructor() {
		super("Not signed in to QNSI");
		this.name = "NotSignedInError";
	}
}

let cached: { client: QnsiClient; apiKey: string; baseUrl: string } | null = null;

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
	return context.secrets.get(SECRET_KEY);
}

export function invalidateClient(): void {
	cached = null;
}

/** Resolve a configured client, or throw NotSignedInError if no API key is stored. */
export async function getClient(context: vscode.ExtensionContext): Promise<QnsiClient> {
	const apiKey = await getApiKey(context);
	if (!apiKey) {
		throw new NotSignedInError();
	}
	const baseUrl = getPlatformUrl();
	if (cached && cached.apiKey === apiKey && cached.baseUrl === baseUrl) {
		return cached.client;
	}
	const client = new QnsiClient({ apiKey, baseUrl });
	cached = { client, apiKey, baseUrl };
	return client;
}

/**
 * Run an action that needs a client. If not signed in, prompt to sign in and return
 * undefined (so callers can no-op gracefully). Other errors propagate.
 */
export async function withClient<T>(
	context: vscode.ExtensionContext,
	fn: (client: QnsiClient) => Promise<T>,
): Promise<T | undefined> {
	let client: QnsiClient;
	try {
		client = await getClient(context);
	} catch (err) {
		if (err instanceof NotSignedInError) {
			const pick = await vscode.window.showWarningMessage("QNSI: sign in to continue.", "Sign In");
			if (pick === "Sign In") {
				await vscode.commands.executeCommand("qnsi.signIn");
			}
			return undefined;
		}
		throw err;
	}
	return fn(client);
}

/** The raw API key + base URL, for the few endpoints the SDK does not yet wrap (Bearer apiKey). */
export async function getRawAuth(
	context: vscode.ExtensionContext,
): Promise<{ apiKey: string; baseUrl: string }> {
	const apiKey = await getApiKey(context);
	if (!apiKey) {
		throw new NotSignedInError();
	}
	return { apiKey, baseUrl: getPlatformUrl() };
}
