/**
 * Tenant-purge primitives shared by every service's internal
 * `DELETE /<svc>/v1/internal/tenant/:tenantId` endpoint (workspace deletion).
 *
 * Each service supplies its OWN ordered list of tenant-scoped DELETE/UPDATE
 * statements (FK order is load-bearing — see WORKSPACE_DELETION_RUNBOOK.md). This
 * module runs them in one transaction and returns per-table row counts for the
 * certificate-of-destruction audit record. Irreversible — the caller is gated to
 * an internal service token.
 */

import { timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";

export interface TenantPurgeResult {
	readonly tenantId: string;
	/** rows affected per target table (keyed by table name). */
	readonly deletedRows: Record<string, number>;
	readonly totalRows: number;
}

/**
 * Run ordered tenant-scoped statements (each parameterized with $1 = tenantId) in a
 * single transaction. Rolls back on any error. Statement order MUST be preserved —
 * it encodes foreign-key dependencies.
 */
export async function runTenantPurge(
	pool: Pool,
	tenantId: string,
	statements: readonly string[],
): Promise<TenantPurgeResult> {
	const client = await pool.connect();
	const deletedRows: Record<string, number> = {};
	let totalRows = 0;
	try {
		await client.query("BEGIN");
		for (const sql of statements) {
			const result = await client.query(sql, [tenantId]);
			const affected = result.rowCount ?? 0;
			const match = sql.match(/(?:DELETE FROM|UPDATE)\s+([a-z_][a-z0-9_]*)/i);
			const key = match?.[1] ?? sql.slice(0, 48);
			deletedRows[key] = (deletedRows[key] ?? 0) + affected;
			totalRows += affected;
		}
		await client.query("COMMIT");
		return { tenantId, deletedRows, totalRows };
	} catch (error) {
		await client.query("ROLLBACK").catch(() => {});
		throw error;
	} finally {
		client.release();
	}
}

/**
 * Validate an internal service bearer token in constant time. Refuses unset or weak
 * (<24 char) expected tokens — fail closed. Used to gate the internal purge endpoints
 * (the worker presents the shared INTERNAL_TENANT_PURGE_TOKEN). Established pattern:
 * static internal service tokens (e.g. AUDIT_SERVICE_TOKEN).
 */
export function isValidInternalToken(
	authHeader: string | string[] | undefined,
	expected: string | undefined,
): boolean {
	if (!expected || expected.length < 24) return false;
	const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
	if (!header) return false;
	const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
	const expectedBuf = Buffer.from(expected, "utf8");
	const providedBuf = Buffer.from(provided, "utf8");
	if (providedBuf.length !== expectedBuf.length) return false;
	return timingSafeEqual(providedBuf, expectedBuf);
}
