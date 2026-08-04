import * as vscode from "vscode";
import type { CryptoFinding } from "./detector";
import type { CbomController } from "./scan";

type Node =
	| { readonly kind: "readiness" }
	| { readonly kind: "summary" }
	| { readonly kind: "file"; readonly fsPath: string }
	| { readonly kind: "finding"; readonly fsPath: string; readonly finding: CryptoFinding };

export class CbomTreeProvider implements vscode.TreeDataProvider<Node> {
	private readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(private readonly controller: CbomController) {
		controller.onDidChange(() => this.emitter.fire());
	}

	getChildren(element?: Node): Node[] {
		if (!element) {
			const roots: Node[] = [];
			if (this.controller.readiness) {
				roots.push({ kind: "readiness" });
			}
			roots.push({ kind: "summary" });
			for (const fsPath of [...this.controller.results.keys()].sort()) {
				roots.push({ kind: "file", fsPath });
			}
			return roots;
		}
		if (element.kind === "file") {
			const findings = this.controller.results.get(element.fsPath) ?? [];
			return findings.map((finding) => ({ kind: "finding", fsPath: element.fsPath, finding }));
		}
		return [];
	}

	getTreeItem(node: Node): vscode.TreeItem {
		switch (node.kind) {
			case "readiness": {
				const r = this.controller.readiness;
				const label =
					r && r.score !== null
						? `PQC readiness: ${r.score}`
						: `PQC readiness: ${r?.detail ?? "n/a"}`;
				const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
				item.iconPath = new vscode.ThemeIcon("graph");
				item.tooltip = r?.detail;
				return item;
			}
			case "summary": {
				const c = this.controller.counts();
				const item = new vscode.TreeItem(
					c.total === 0
						? "No findings - run a scan"
						: `${c.total} findings · ${c.critical} critical · ${c.high} high · ${c.medium} medium`,
					vscode.TreeItemCollapsibleState.None,
				);
				item.iconPath = new vscode.ThemeIcon(c.total === 0 ? "pass" : "warning");
				return item;
			}
			case "file": {
				const findings = this.controller.results.get(node.fsPath) ?? [];
				const item = new vscode.TreeItem(
					vscode.Uri.file(node.fsPath),
					vscode.TreeItemCollapsibleState.Collapsed,
				);
				item.description = String(findings.length);
				item.iconPath = vscode.ThemeIcon.File;
				return item;
			}
			case "finding": {
				const f = node.finding;
				const item = new vscode.TreeItem(
					`${f.algorithm} - line ${f.line + 1}`,
					vscode.TreeItemCollapsibleState.None,
				);
				item.description = f.urgency;
				item.tooltip = `${f.reason}\nRecommended: ${f.recommend}`;
				const dangerous = f.urgency === "critical" || f.urgency === "high";
				item.iconPath = new vscode.ThemeIcon(dangerous ? "warning" : "info");
				item.command = {
					command: "vscode.open",
					title: "Open finding",
					arguments: [
						vscode.Uri.file(node.fsPath),
						{ selection: new vscode.Range(f.line, f.startChar, f.line, f.endChar) },
					],
				};
				return item;
			}
		}
	}
}
