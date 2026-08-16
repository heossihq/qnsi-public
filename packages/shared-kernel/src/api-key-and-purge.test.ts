import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
	extractApiKeyContext,
	isApiKeyRequest,
	requireApiKeyScope,
	requireApiKeyScopeAny,
} from "./api-key-auth.js";
import { isValidInternalToken, runTenantPurge } from "./tenant-purge.js";

const FULL_HEADERS = {
	"x-qnsp-api-key-id": "tok-1",
	"x-qnsp-api-key-user": "user-1",
	"x-qnsp-api-key-scopes": "read:kms,write:kms",
	"x-qnsp-tenant": "tenant-1",
};

describe("api-key-auth", () => {
	it("extracts a full context and parses scopes", () => {
		const ctx = extractApiKeyContext(FULL_HEADERS);
		expect(ctx).toMatchObject({
			tokenId: "tok-1",
			userId: "user-1",
			tenantId: "tenant-1",
			scopes: ["read:kms", "write:kms"],
			isApiKey: true,
		});
	});

	it("returns null with no api-key headers and handles array header values", () => {
		expect(extractApiKeyContext({})).toBeNull();
		const ctx = extractApiKeyContext({
			...FULL_HEADERS,
			"x-qnsp-api-key-id": ["tok-array"],
		});
		expect(ctx?.tokenId).toBe("tok-array");
	});

	it("treats empty scopes as an empty list", () => {
		const ctx = extractApiKeyContext({ ...FULL_HEADERS, "x-qnsp-api-key-scopes": "" });
		expect(ctx?.scopes).toEqual([]);
	});

	it("throws on incomplete header sets (partial edge forwarding)", () => {
		expect(() => extractApiKeyContext({ "x-qnsp-api-key-id": "tok-1" })).toThrow(
			/Incomplete API key headers/,
		);
		expect(() =>
			extractApiKeyContext({
				"x-qnsp-api-key-user": "user-1",
				"x-qnsp-api-key-scopes": "a",
			}),
		).toThrow(/Incomplete API key headers/);
	});

	it("isApiKeyRequest and scope requirements", () => {
		expect(isApiKeyRequest(FULL_HEADERS)).toBe(true);
		expect(isApiKeyRequest({})).toBe(false);

		const ctx = extractApiKeyContext(FULL_HEADERS);
		if (!ctx) throw new Error("context expected");
		expect(() => requireApiKeyScope(ctx, "read:kms")).not.toThrow();
		expect(() => requireApiKeyScope(ctx, "admin:tenant")).toThrow(/missing required scope/);
		expect(() => requireApiKeyScopeAny(ctx, ["nope", "write:kms"])).not.toThrow();
		expect(() => requireApiKeyScopeAny(ctx, ["nope", "nada"])).toThrow(/missing required scopes/);
	});
});

describe("tenant-purge", () => {
	function makePool(): Pool {
		const db = newDb();
		db.public.none(`
			CREATE TABLE items (id serial PRIMARY KEY, tenant_id text NOT NULL);
			CREATE TABLE audits (id serial PRIMARY KEY, tenant_id text NOT NULL);
			INSERT INTO items (tenant_id) VALUES ('t1'), ('t1'), ('t2');
			INSERT INTO audits (tenant_id) VALUES ('t1');
		`);
		const { Pool: MemPool } = db.adapters.createPg();
		return new MemPool() as unknown as Pool;
	}

	it("runs ordered statements in one transaction and reports per-table counts", async () => {
		const pool = makePool();
		const result = await runTenantPurge(pool, "t1", [
			"DELETE FROM audits WHERE tenant_id = $1",
			"DELETE FROM items WHERE tenant_id = $1",
		]);
		expect(result).toEqual({
			tenantId: "t1",
			deletedRows: { audits: 1, items: 2 },
			totalRows: 3,
		});
		const remaining = await pool.query("SELECT count(*)::int AS n FROM items");
		expect(remaining.rows[0].n).toBe(1);
	});

	it("rethrows and issues ROLLBACK when a statement fails", async () => {
		// pg-mem executes the ROLLBACK path but does not restore rows the way
		// real Postgres does, so this asserts the failure contract (rethrow),
		// which drives the catch/ROLLBACK/release arc.
		const pool = makePool();
		await expect(
			runTenantPurge(pool, "t1", [
				"DELETE FROM items WHERE tenant_id = $1",
				"DELETE FROM missing_table WHERE tenant_id = $1",
			]),
		).rejects.toThrow();
	});

	it("counts UPDATE statements by table and unmatched statements by snippet", async () => {
		const pool = makePool();
		const result = await runTenantPurge(pool, "t1", [
			"UPDATE audits SET tenant_id = tenant_id WHERE tenant_id = $1",
			"INSERT INTO audits (tenant_id) VALUES ($1)",
		]);
		expect(result.deletedRows["audits"]).toBe(1);
		expect(result.totalRows).toBe(2);
		expect(Object.keys(result.deletedRows)).toHaveLength(2);
	});
});

describe("isValidInternalToken", () => {
	const SECRET = "a-sufficiently-long-internal-token";

	it("accepts the exact token with and without the Bearer prefix", () => {
		expect(isValidInternalToken(`Bearer ${SECRET}`, SECRET)).toBe(true);
		expect(isValidInternalToken(SECRET, SECRET)).toBe(true);
		expect(isValidInternalToken([`Bearer ${SECRET}`], SECRET)).toBe(true);
	});

	it("fails closed on unset or weak expectations and wrong tokens", () => {
		expect(isValidInternalToken(`Bearer ${SECRET}`, undefined)).toBe(false);
		expect(isValidInternalToken(`Bearer ${SECRET}`, "short")).toBe(false);
		expect(isValidInternalToken(undefined, SECRET)).toBe(false);
		expect(isValidInternalToken("Bearer wrong-token-of-equal-len!!!", SECRET)).toBe(false);
		expect(isValidInternalToken("Bearer nope", SECRET)).toBe(false);
	});
});
