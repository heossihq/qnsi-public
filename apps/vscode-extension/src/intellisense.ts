import * as vscode from "vscode";
import { ALGORITHM_TO_NIST, PQC_ALGORITHMS, PQC_NIST_NAMES } from "./cbom/catalog";
import { detectInText } from "./cbom/detector";

const WORD_RE = /[A-Za-z0-9_+./-]+/;

class AlgorithmHoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
		const range = document.getWordRangeAtPosition(position, WORD_RE);
		if (!range) {
			return undefined;
		}
		const word = document.getText(range);
		const lower = word.toLowerCase();

		if (PQC_ALGORITHMS.has(lower) || PQC_NIST_NAMES.has(lower)) {
			const nist = ALGORITHM_TO_NIST[lower] ?? word;
			const md = new vscode.MarkdownString();
			md.appendMarkdown(
				`**${nist}** - post-quantum, quantum-resistant ✅\n\nSafe against Shor's algorithm; a NIST-recognized PQC algorithm.`,
			);
			return new vscode.Hover(md, range);
		}

		// Reuse the detector on the single token to surface a vulnerability hover.
		const finding = detectInText(word)[0];
		if (finding) {
			const md = new vscode.MarkdownString();
			md.appendMarkdown(
				`**${finding.algorithm}** - quantum-vulnerable (${finding.urgency}) ⚠️\n\n${finding.reason}\n\n**Recommended:** ${finding.recommend}`,
			);
			return new vscode.Hover(md, range);
		}
		return undefined;
	}
}

class AlgorithmCompletionProvider implements vscode.CompletionItemProvider {
	private readonly items: vscode.CompletionItem[];

	constructor() {
		this.items = Object.entries(ALGORITHM_TO_NIST).map(([id, nist]) => {
			const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Constant);
			item.detail = `${nist} (post-quantum)`;
			item.documentation = new vscode.MarkdownString(
				`NIST PQC algorithm - **${nist}**. Quantum-resistant.`,
			);
			return item;
		});
	}

	provideCompletionItems(): vscode.CompletionItem[] {
		return this.items;
	}
}

export function registerIntelliSense(context: vscode.ExtensionContext): void {
	const selector: vscode.DocumentSelector = [{ scheme: "file" }, { scheme: "untitled" }];
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(selector, new AlgorithmHoverProvider()),
		vscode.languages.registerCompletionItemProvider(selector, new AlgorithmCompletionProvider()),
	);
}
