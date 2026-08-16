#!/usr/bin/env node

/**
 * QNSP MCP Server
 *
 * Post-quantum cryptography tools for AI assistants.
 * Connects to the QNSP platform via edge gateway, authenticates with an API key,
 * and exposes tier-gated tools for KMS, Vault, Crypto Inventory, Audit, Search,
 * and platform management.
 *
 * Usage (stdio):
 *   QNSP_API_KEY=your-key qnsi-mcp
 *
 * Configuration:
 *   QNSP_API_KEY          - Required. Get one at https://cloud.qnsi.heossi.com/api-keys
 *   QNSP_PLATFORM_URL     - Optional. Defaults to https://api.qnsi.heossi.com
 */

import { createRequire } from "node:module";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ApiClient } from "./api-client.js";
import { SessionManager } from "./session.js";
import type { ToolContext } from "./tools.js";
import * as tools from "./tools.js";

/**
 * The version this server ACTUALLY is, read from its own package.json.
 *
 * It was hand-typed as "0.1.0" while the package was 0.1.6 - so `initialize` told every AI
 * client the wrong version, and nothing could catch it because a hand-typed number agrees
 * with nothing by construction. (The Python SDK had the identical drift: one package
 * carrying three different versions. See .claude/rules/sdk-wire-contract.md.)
 */
export const PACKAGE_VERSION: string = (() => {
	try {
		const require = createRequire(import.meta.url);
		const pkg = require("../package.json") as { version?: string };
		return pkg.version ?? "0.0.0+unknown";
	} catch {
		return "0.0.0+unknown";
	}
})();

export function registerTools(server: McpServer, ctx: ToolContext): void {
	server.tool(
		"qnsp_kms_generate_key",
		// The catalog is 87 algorithms (24 KEMs + 63 signatures across 13 families) - this said
		// 93. An MCP tool description is a PUBLIC, machine-readable surface: it is exactly what
		// an AI agent reads to decide what QNSI can do, and then repeats to a user.
		"Generate a new post-quantum cryptographic key pair. Supports ML-KEM (Kyber), ML-DSA (Dilithium), Falcon, SPHINCS+, and the full 87-algorithm QNSI PQC catalog.",
		{
			algorithm: tools.kmsGenerateKeySchema.shape.algorithm,
			label: tools.kmsGenerateKeySchema.shape.label,
			metadata: tools.kmsGenerateKeySchema.shape.metadata,
		},
		async (input) => tools.kmsGenerateKey(ctx, tools.kmsGenerateKeySchema.parse(input)),
	);
	server.tool(
		"qnsp_kms_list_keys",
		"List PQC keys in your tenant's key store.",
		{ limit: tools.kmsListKeysSchema.shape.limit },
		async (input) => tools.kmsListKeys(ctx, tools.kmsListKeysSchema.parse(input)),
	);
	server.tool(
		"qnsp_kms_get_key",
		"Get details of a specific PQC key by ID.",
		{ keyId: tools.kmsGetKeySchema.shape.keyId },
		async (input) => tools.kmsGetKey(ctx, tools.kmsGetKeySchema.parse(input)),
	);
	server.tool(
		"qnsp_kms_rotate_key",
		"Rotate a PQC key - generates a new version while preserving the key ID.",
		{ keyId: tools.kmsRotateKeySchema.shape.keyId },
		async (input) => tools.kmsRotateKey(ctx, tools.kmsRotateKeySchema.parse(input)),
	);
	server.tool(
		"qnsp_kms_hspk_seal",
		"HSM-Sealed Post-Quantum Keys (HSPK): generate an ML-DSA-44, ML-DSA-65, or ML-DSA-87 keypair and seal its private key under a non-extractable HSM RSA-OAEP custody key. The HSM protects custody at rest; QNSI performs ML-DSA outside the module. Requires a qualified customer-provisioned PKCS#11 connection with an RSA encrypt/decrypt key. Returns the public key and an opaque sealedKey the caller stores.",
		{
			connectionId: tools.kmsHspkSealSchema.shape.connectionId,
			keyId: tools.kmsHspkSealSchema.shape.keyId,
			algorithm: tools.kmsHspkSealSchema.shape.algorithm,
			oaepHash: tools.kmsHspkSealSchema.shape.oaepHash,
		},
		async (input) => tools.kmsHspkSeal(ctx, tools.kmsHspkSealSchema.parse(input)),
	);
	server.tool(
		"qnsp_kms_hspk_sign",
		"HSPK: unseal a previously sealed ML-DSA private key via the HSM and sign a message in QNSI software. The private key exists in plaintext only transiently in memory during signing. Pass the sealedKey object returned by qnsp_kms_hspk_seal.",
		{
			connectionId: tools.kmsHspkSignSchema.shape.connectionId,
			keyId: tools.kmsHspkSignSchema.shape.keyId,
			sealedKey: tools.kmsHspkSignSchema.shape.sealedKey,
			message: tools.kmsHspkSignSchema.shape.message,
			oaepHash: tools.kmsHspkSignSchema.shape.oaepHash,
		},
		async (input) => tools.kmsHspkSign(ctx, tools.kmsHspkSignSchema.parse(input)),
	);
	server.tool(
		"qnsp_vault_create_secret",
		"Store a secret in the quantum-safe encrypted vault.",
		{
			name: tools.vaultCreateSecretSchema.shape.name,
			value: tools.vaultCreateSecretSchema.shape.value,
			metadata: tools.vaultCreateSecretSchema.shape.metadata,
		},
		async (input) => tools.vaultCreateSecret(ctx, tools.vaultCreateSecretSchema.parse(input)),
	);
	server.tool(
		"qnsp_vault_get_secret",
		"Retrieve a secret from the quantum-safe vault by ID.",
		{ secretId: tools.vaultGetSecretSchema.shape.secretId },
		async (input) => tools.vaultGetSecret(ctx, tools.vaultGetSecretSchema.parse(input)),
	);
	server.tool(
		"qnsp_vault_list_secrets",
		"List secrets in the quantum-safe vault.",
		{ limit: tools.vaultListSecretsSchema.shape.limit },
		async (input) => tools.vaultListSecrets(ctx, tools.vaultListSecretsSchema.parse(input)),
	);
	server.tool(
		"qnsp_crypto_scan",
		"Run the tenant's configured cryptographic discovery connectors and return the resulting discovery runs.",
		{},
		async (input) => tools.cryptoScan(ctx, tools.cryptoScanSchema.parse(input)),
	);
	server.tool(
		"qnsp_crypto_inventory",
		"List cryptographic assets in the inventory (Cryptographic Bill of Materials).",
		{ limit: tools.cryptoInventorySchema.shape.limit },
		async (input) => tools.cryptoInventory(ctx, tools.cryptoInventorySchema.parse(input)),
	);
	server.tool(
		"qnsp_crypto_readiness",
		"Check post-quantum readiness status - identifies vulnerable algorithms and migration paths.",
		{},
		async (input) => tools.cryptoReadiness(ctx, tools.cryptoReadinessSchema.parse(input)),
	);
	server.tool(
		"qnsp_audit_query",
		"Query the immutable audit trail. Filter by topic, source service, or time range.",
		{
			topic: tools.auditQuerySchema.shape.topic,
			sourceService: tools.auditQuerySchema.shape.sourceService,
			limit: tools.auditQuerySchema.shape.limit,
		},
		async (input) => tools.auditQuery(ctx, tools.auditQuerySchema.parse(input)),
	);
	server.tool(
		"qnsp_search_query",
		"Search encrypted documents using SSE-X (Server-Side Encryption with eXtended PQC). Requires dev-pro tier or higher.",
		{ query: tools.searchQuerySchema.shape.query, limit: tools.searchQuerySchema.shape.limit },
		async (input) => tools.searchQuery(ctx, tools.searchQuerySchema.parse(input)),
	);
	server.tool(
		"qnsp_tenant_info",
		"Get your tenant information - plan, region, crypto policy, and metadata.",
		{},
		async (input) => tools.tenantInfo(ctx, tools.tenantInfoSchema.parse(input)),
	);
	server.tool(
		"qnsp_billing_status",
		"Check your current billing tier, feature limits, and upgrade options.",
		{},
		async (input) => tools.billingStatus(ctx, tools.billingStatusSchema.parse(input)),
	);
	server.tool(
		"qnsp_platform_health",
		"Check QNSP platform health status across all services.",
		{},
		async (input) => tools.platformHealth(ctx, tools.platformHealthSchema.parse(input)),
	);
}

/**
 * Smithery sandbox server for capability scanning.
 * Returns a server with all tools registered using a no-op context
 * so Smithery can discover tool definitions without real credentials.
 */
export function createSandboxServer(): McpServer {
	const noopApi = new ApiClient({
		baseUrl: "https://api.qnsi.heossi.com",
		apiKey: "sandbox",
		tenantId: "sandbox",
	});
	const sandboxGate = {
		hasFeature: () => true,
		tier: "sandbox" as const,
		tenantId: "sandbox",
		limits: {
			storageGB: 0,
			apiCalls: 0,
			enclavesEnabled: true,
			aiTrainingEnabled: true,
			aiInferenceEnabled: true,
			sseEnabled: true,
			vaultEnabled: true,
		},
	};
	const server = new McpServer({ name: "qnsp", version: PACKAGE_VERSION });
	registerTools(server, { api: noopApi, gate: sandboxGate });
	return server;
}

export function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value || value.length === 0) {
		process.stderr.write(
			`Error: ${name} is required. Get your free API key at https://cloud.qnsi.heossi.com/api-keys\n`,
		);
		process.exit(1);
	}
	return value;
}

export async function main(): Promise<void> {
	const apiKey = getRequiredEnv("QNSP_API_KEY");
	const platformUrl = process.env["QNSP_PLATFORM_URL"] ?? "https://api.qnsi.heossi.com";

	// Activate SDK session - resolves API key → tenant ID → tier → limits
	const session = new SessionManager({ apiKey, platformUrl });
	const gate = await session.activate();

	// Create API client for edge gateway calls
	const api = new ApiClient({
		baseUrl: platformUrl,
		apiKey,
		tenantId: gate.tenantId,
	});

	const ctx: ToolContext = { api, gate };

	const server = new McpServer({ name: "qnsp", version: PACKAGE_VERSION });
	registerTools(server, ctx);

	// Start stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

// Only run the stdio server when QNSP_API_KEY is set.
// When Smithery imports this module for capability scanning, it calls
// createSandboxServer() instead - no API key needed for tool discovery.
if (process.env["QNSP_API_KEY"]) {
	main().catch((error) => {
		process.stderr.write(
			`QNSP MCP Server fatal error: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exit(1);
	});
}
