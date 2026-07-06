/**
 * QNSI env-var bridge (SDK-local copy — the published package cannot depend
 * on internal workspace libs). Mirrors `QNSI_<NAME>` ↔ `QNSP_<NAME>` in
 * process.env without overwriting explicitly-set values, so:
 *   - users following current docs (`QNSI_API_KEY`, `QNSI_TENANT_ID`, …) work;
 *   - users with legacy `QNSP_*` variables keep working forever.
 * Call once, idempotently, before reading either family.
 */
export function bridgeQnsiEnv(env: NodeJS.ProcessEnv = process.env): void {
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) continue;
		if (key.startsWith("QNSP_")) {
			const alias = `QNSI_${key.slice("QNSP_".length)}`;
			if (env[alias] === undefined) env[alias] = value;
		} else if (key.startsWith("QNSI_")) {
			const alias = `QNSP_${key.slice("QNSI_".length)}`;
			if (env[alias] === undefined) env[alias] = value;
		}
	}
}
