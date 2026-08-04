import * as vscode from "vscode";
import { getClient, getRawAuth, NotSignedInError } from "./client";
import { logError } from "./output";

function num(o: Record<string, unknown>, ...keys: string[]): number | null {
	for (const k of keys) {
		const v = o[k];
		if (typeof v === "number" && Number.isFinite(v)) {
			return v;
		}
	}
	return null;
}

export class ConformanceStatusBar {
	private readonly item: vscode.StatusBarItem;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.item.text = "$(shield) QNSI";
		this.item.command = "qnsi.conformance.refresh";
		this.item.show();
	}

	async refresh(): Promise<void> {
		let client: Awaited<ReturnType<typeof getClient>>;
		try {
			client = await getClient(this.context);
		} catch (err) {
			if (err instanceof NotSignedInError) {
				this.item.text = "$(shield) QNSI: sign in";
				this.item.command = "qnsi.signIn";
				this.item.tooltip = "Sign in to QNSI";
				return;
			}
			throw err;
		}

		try {
			const activation = await client.ensureActivated();
			this.item.command = "qnsi.conformance.refresh";
			this.item.text = `$(shield) QNSI: ${activation.tier}`;
			const lines = [`Tenant: ${activation.tenantId}`, `Tier: ${activation.tier}`];
			const conf = await this.fetchConformance(activation.tenantId);
			if (conf) {
				lines.push(conf);
			}
			this.item.tooltip = lines.join("\n");
		} catch (err) {
			logError("conformance refresh", err);
			this.item.text = "$(shield) QNSI: error";
			this.item.tooltip = err instanceof Error ? err.message : String(err);
		}
	}

	/** Best-effort: the audit-service conformance stats are not in the SDK; call directly. */
	private async fetchConformance(tenantId: string): Promise<string | null> {
		try {
			const { apiKey, baseUrl } = await getRawAuth(this.context);
			const res = await fetch(
				`${baseUrl}/proxy/audit/v1/conformance/stats?tenantId=${encodeURIComponent(tenantId)}`,
				{
					headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
					signal: AbortSignal.timeout(10_000),
				},
			);
			if (!res.ok) {
				return null;
			}
			const body = (await res.json()) as Record<string, unknown>;
			const passed = num(body, "passed", "passedCount", "passedRuns");
			const failed = num(body, "failed", "failedCount", "failedRuns");
			if (passed === null && failed === null) {
				return null;
			}
			return `Conformance L0-L3: ${passed ?? 0} passed, ${failed ?? 0} failed`;
		} catch (err) {
			logError("conformance stats", err);
			return null;
		}
	}

	dispose(): void {
		this.item.dispose();
	}
}
