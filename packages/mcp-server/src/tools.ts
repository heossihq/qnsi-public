/**
 * QNSP MCP Tool Definitions
 *
 * Each tool maps to a QNSP platform API endpoint via the edge gateway.
 * Tools are tier-gated: the session's TierGate checks feature availability
 * before execution. The edge gateway enforces entitlements server-side as well,
 * so client-side checks are a UX optimization (fail fast with a clear message
 * instead of a raw 402/403).
 */

import { z } from "zod";
import type { ApiClient } from "./api-client.js";
import type { TierGate } from "./session.js";

export interface ToolContext {
	readonly api: ApiClient;
	readonly gate: TierGate;
}

export interface ToolResult {
	readonly content: Array<{ type: "text"; text: string }>;
	readonly isError?: boolean;
	readonly [key: string]: unknown;
}

function text(value: string): ToolResult {
	return { content: [{ type: "text", text: value }] };
}

function json(value: unknown): ToolResult {
	return text(JSON.stringify(value, null, 2));
}

function gateError(feature: string, tier: string): ToolResult {
	return {
		content: [
			{
				type: "text",
				text:
					`This feature requires a higher tier. Current tier: ${tier}. ` +
					`Upgrade at https://cloud.qnsi.heossi.com/billing to access ${feature}.`,
			},
		],
		isError: true,
	};
}

// ── KMS Tools ───────────────────────────────────────────────────────────────

export const kmsGenerateKeySchema = z.object({
	algorithm: z
		.string()
		.describe(
			"PQC algorithm (e.g. kyber-768, dilithium-2, falcon-512). See NIST FIPS 203/204/205.",
		),
	label: z.string().optional().describe("Human-readable key label"),
	metadata: z.record(z.string(), z.string()).optional().describe("Key metadata tags"),
});

export async function kmsGenerateKey(
	ctx: ToolContext,
	input: z.infer<typeof kmsGenerateKeySchema>,
): Promise<ToolResult> {
	const { data } = await ctx.api.post("/proxy/kms/v1/keys", {
		tenantId: ctx.gate.tenantId,
		algorithm: input.algorithm,
		label: input.label ?? `mcp-${Date.now()}`,
		metadata: input.metadata ?? {},
	});
	return json(data);
}

export const kmsListKeysSchema = z.object({
	limit: z.number().int().min(1).max(100).optional().describe("Max keys to return (default 20)"),
});

export async function kmsListKeys(
	ctx: ToolContext,
	input: z.infer<typeof kmsListKeysSchema>,
): Promise<ToolResult> {
	const limit = input.limit ?? 20;
	const { data } = await ctx.api.get(
		`/proxy/kms/v1/keys?tenantId=${ctx.gate.tenantId}&limit=${limit}`,
	);
	return json(data);
}

export const kmsGetKeySchema = z.object({
	keyId: z.string().describe("Key ID (UUID)"),
});

export async function kmsGetKey(
	ctx: ToolContext,
	input: z.infer<typeof kmsGetKeySchema>,
): Promise<ToolResult> {
	const { data } = await ctx.api.get(
		`/proxy/kms/v1/keys/${input.keyId}?tenantId=${ctx.gate.tenantId}`,
	);
	return json(data);
}

export const kmsRotateKeySchema = z.object({
	keyId: z.string().describe("Key ID to rotate"),
});

export async function kmsRotateKey(
	ctx: ToolContext,
	input: z.infer<typeof kmsRotateKeySchema>,
): Promise<ToolResult> {
	const { data } = await ctx.api.post(`/proxy/kms/v1/keys/${input.keyId}/rotate`, {
		tenantId: ctx.gate.tenantId,
		reason: "MCP rotation",
	});
	return json(data);
}

// ── Vault Tools ─────────────────────────────────────────────────────────────

export const vaultCreateSecretSchema = z.object({
	name: z.string().describe("Secret name (unique within tenant)"),
	value: z.string().describe("Secret value to encrypt and store"),
	metadata: z.record(z.string(), z.string()).optional().describe("Secret metadata"),
});

export async function vaultCreateSecret(
	ctx: ToolContext,
	input: z.infer<typeof vaultCreateSecretSchema>,
): Promise<ToolResult> {
	if (!ctx.gate.hasFeature("vaultEnabled")) {
		return gateError("Quantum-Safe Vault", ctx.gate.tier);
	}
	const { data } = await ctx.api.post("/proxy/vault/v1/secrets", {
		tenantId: ctx.gate.tenantId,
		name: input.name,
		payload: Buffer.from(input.value).toString("base64"),
		metadata: input.metadata ?? {},
	});
	return json(data);
}

export const vaultGetSecretSchema = z.object({
	secretId: z.string().describe("Secret ID (UUID)"),
});

export async function vaultGetSecret(
	ctx: ToolContext,
	input: z.infer<typeof vaultGetSecretSchema>,
): Promise<ToolResult> {
	if (!ctx.gate.hasFeature("vaultEnabled")) {
		return gateError("Quantum-Safe Vault", ctx.gate.tier);
	}
	const { data } = await ctx.api.get(`/proxy/vault/v1/secrets/${input.secretId}`);
	return json(data);
}

export const vaultListSecretsSchema = z.object({
	limit: z.number().int().min(1).max(100).optional().describe("Max secrets to return"),
});

export async function vaultListSecrets(
	ctx: ToolContext,
	input: z.infer<typeof vaultListSecretsSchema>,
): Promise<ToolResult> {
	if (!ctx.gate.hasFeature("vaultEnabled")) {
		return gateError("Quantum-Safe Vault", ctx.gate.tier);
	}
	const limit = input.limit ?? 20;
	const { data } = await ctx.api.get(
		`/proxy/vault/v1/secrets?tenantId=${ctx.gate.tenantId}&limit=${limit}`,
	);
	return json(data);
}

// ── Crypto Inventory (CBOM) Tools ───────────────────────────────────────────

export const cryptoScanSchema = z.object({
	scope: z
		.enum(["full", "keys", "certificates", "algorithms"])
		.optional()
		.describe("Scan scope (default: full)"),
});

export async function cryptoScan(
	ctx: ToolContext,
	input: z.infer<typeof cryptoScanSchema>,
): Promise<ToolResult> {
	const scope = input.scope ?? "full";
	const { data } = await ctx.api.get(
		`/proxy/crypto/v1/discovery/jobs?tenantId=${ctx.gate.tenantId}&limit=10&scope=${encodeURIComponent(scope)}`,
	);
	return json(data);
}

export const cryptoInventorySchema = z.object({
	limit: z.number().int().min(1).max(100).optional().describe("Max items to return"),
});

export async function cryptoInventory(
	ctx: ToolContext,
	input: z.infer<typeof cryptoInventorySchema>,
): Promise<ToolResult> {
	const limit = input.limit ?? 50;
	const { data } = await ctx.api.get(
		`/proxy/crypto/v1/discovery/jobs?tenantId=${ctx.gate.tenantId}&limit=${limit}`,
	);
	return json(data);
}

export const cryptoReadinessSchema = z.object({});

export async function cryptoReadiness(
	ctx: ToolContext,
	_input: z.infer<typeof cryptoReadinessSchema>,
): Promise<ToolResult> {
	const { data } = await ctx.api.get(`/proxy/crypto/v1/readiness?tenantId=${ctx.gate.tenantId}`);
	return json(data);
}

// ── Audit Tools ─────────────────────────────────────────────────────────────

export const auditQuerySchema = z.object({
	topic: z.string().optional().describe("Filter by event topic"),
	sourceService: z.string().optional().describe("Filter by source service"),
	limit: z.number().int().min(1).max(100).optional().describe("Max events to return"),
});

export async function auditQuery(
	ctx: ToolContext,
	input: z.infer<typeof auditQuerySchema>,
): Promise<ToolResult> {
	const params = new URLSearchParams();
	if (input.topic) params.set("topic", input.topic);
	if (input.sourceService) params.set("sourceService", input.sourceService);
	params.set("tenantId", ctx.gate.tenantId);
	params.set("limit", String(input.limit ?? 20));
	const { data } = await ctx.api.get(`/proxy/audit/v1/events?${params.toString()}`);
	return json(data);
}

// ── Search Tools (SSE-X) ────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
	query: z.string().describe("Search query text"),
	limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
});

export async function searchQuery(
	ctx: ToolContext,
	input: z.infer<typeof searchQuerySchema>,
): Promise<ToolResult> {
	if (!ctx.gate.hasFeature("sseEnabled")) {
		return gateError("Encrypted Search (SSE-X)", ctx.gate.tier);
	}
	const params = new URLSearchParams();
	params.set("tenantId", ctx.gate.tenantId);
	params.set("q", input.query);
	params.set("limit", String(input.limit ?? 10));
	const { data } = await ctx.api.get(`/proxy/search/v1/documents?${params.toString()}`);
	return json(data);
}

// ── Tenant & Billing Info Tools ─────────────────────────────────────────────

export const tenantInfoSchema = z.object({});

export async function tenantInfo(
	ctx: ToolContext,
	_input: z.infer<typeof tenantInfoSchema>,
): Promise<ToolResult> {
	const { data } = await ctx.api.get(`/proxy/tenant/v1/tenants/${ctx.gate.tenantId}`);
	return json(data);
}

export const billingStatusSchema = z.object({});

export async function billingStatus(
	ctx: ToolContext,
	_input: z.infer<typeof billingStatusSchema>,
): Promise<ToolResult> {
	return json({
		tenantId: ctx.gate.tenantId,
		tier: ctx.gate.tier,
		limits: ctx.gate.limits,
		upgradeUrl: "https://cloud.qnsi.heossi.com/billing",
	});
}

// ── Health Tools ────────────────────────────────────────────────────────────

export const platformHealthSchema = z.object({});

export async function platformHealth(
	ctx: ToolContext,
	_input: z.infer<typeof platformHealthSchema>,
): Promise<ToolResult> {
	const { data } = await ctx.api.get("/proxy/health");
	return json(data);
}
