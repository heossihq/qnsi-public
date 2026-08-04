/**
 * QNSI env-var bridge - Phase B of the full-rename migration
 * (docs/operations/QNSI_FULL_RENAME_RUNBOOK.md).
 *
 * Services call this ONCE at the very top of src/config/env.ts, before the
 * Zod parse. It mirrors every `QNSP_<NAME>` variable to `QNSI_<NAME>` and
 * vice-versa (never overwriting a value that is already set). Consequences:
 *
 *  - B1/B2: code keeps its existing `QNSP_*` schema keys while task defs /
 *    SST still inject `QNSP_*` - behavior is byte-identical.
 *  - B3: task-def/SST injection flips to `QNSI_*` service-by-service with
 *    ZERO code risk - the bridge back-fills the `QNSP_*` names the schemas
 *    still read.
 *  - Phase D: schema keys rename to `QNSI_*` cosmetically; the bridge then
 *    covers any straggling `QNSP_*` injection until it is retired.
 *
 * Explicitly-set values always win: the bridge only fills gaps, so a task def
 * that deliberately sets both names keeps both as-is.
 */
export function bridgeQnsiEnvVars(env: NodeJS.ProcessEnv = process.env): void {
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
