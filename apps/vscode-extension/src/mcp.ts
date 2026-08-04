import * as vscode from "vscode";
import { log } from "./output";

/** VS Code agent-mode MCP server entry for the published @heossihq/qnsi-mcp package. */
const SERVER_ENTRY = {
	type: "stdio",
	command: "npx",
	args: ["-y", "@heossihq/qnsi-mcp"],
	// biome-ignore lint/suspicious/noTemplateCurlyInString: VS Code mcp.json requires the literal ${input:...} variable syntax.
	env: { QNSP_API_KEY: "${input:qnsi-api-key}" },
} as const;

const INPUT_ENTRY = {
	id: "qnsi-api-key",
	type: "promptString",
	description: "QNSI API key (https://cloud.qnsi.heossi.com/api-keys)",
	password: true,
} as const;

async function writeJson(uri: vscode.Uri, value: unknown): Promise<void> {
	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
	await vscode.workspace.fs.writeFile(
		uri,
		Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"),
	);
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

/**
 * Wire the QNSI MCP server into VS Code agent mode by adding it to `.vscode/mcp.json`.
 * Merges into an existing parseable file; if the file exists but can't be parsed (e.g. has
 * comments), copies the snippet to the clipboard instead of clobbering it.
 */
export async function configureMcpCommand(): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		void vscode.window.showWarningMessage(
			"QNSI: open a folder first so I can write .vscode/mcp.json.",
		);
		return;
	}
	const mcpUri = vscode.Uri.joinPath(folder.uri, ".vscode", "mcp.json");
	const fresh = { inputs: [INPUT_ENTRY], servers: { qnsi: SERVER_ENTRY } };

	let parsed: Record<string, unknown> | null = null;
	const exists = await fileExists(mcpUri);
	if (exists) {
		try {
			const bytes = await vscode.workspace.fs.readFile(mcpUri);
			const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
			parsed = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
		} catch {
			parsed = null;
		}
		if (parsed === null) {
			await vscode.env.clipboard.writeText(JSON.stringify(fresh, null, 2));
			void vscode.window.showWarningMessage(
				"QNSI: .vscode/mcp.json exists but couldn't be parsed (comments?). The QNSI config is on your clipboard - merge it in.",
			);
			await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(mcpUri));
			return;
		}
	}

	if (parsed) {
		const servers = (parsed["servers"] as Record<string, unknown> | undefined) ?? {};
		if (servers["qnsi"]) {
			const overwrite = await vscode.window.showWarningMessage(
				"QNSI: an 'qnsi' MCP server is already configured. Overwrite it?",
				{ modal: true },
				"Overwrite",
			);
			if (overwrite !== "Overwrite") {
				return;
			}
		}
		servers["qnsi"] = SERVER_ENTRY;
		parsed["servers"] = servers;
		const inputs = Array.isArray(parsed["inputs"]) ? (parsed["inputs"] as unknown[]) : [];
		const hasInput = inputs.some(
			(i) =>
				i !== null &&
				typeof i === "object" &&
				(i as Record<string, unknown>)["id"] === INPUT_ENTRY.id,
		);
		if (!hasInput) {
			inputs.push(INPUT_ENTRY);
		}
		parsed["inputs"] = inputs;
		await writeJson(mcpUri, parsed);
	} else {
		await writeJson(mcpUri, fresh);
	}

	log("configured .vscode/mcp.json with the qnsi MCP server");
	const open = await vscode.window.showInformationMessage(
		"QNSI: MCP server added to .vscode/mcp.json. Start it from VS Code's MCP / agent-mode tools (you'll be prompted for your API key).",
		"Open mcp.json",
	);
	if (open === "Open mcp.json") {
		await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(mcpUri));
	}
}
