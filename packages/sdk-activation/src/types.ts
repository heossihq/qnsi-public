/**
 * SDK Activation Types
 *
 * Shared contract between SDK clients and the billing-service activation endpoint.
 * Browser-compatible — no node: imports.
 *
 * @module
 */

import { z } from "zod";

/**
 * SDK identifier sent during activation to identify which package is being used.
 */
export const SdkIdentifierSchema = z.enum([
	"browser-sdk",
	"vault-sdk",
	"storage-sdk",
	"search-sdk",
	"kms-client",
	"ai-sdk",
	"tenant-sdk",
	"billing-sdk",
	"auth-sdk",
	"audit-sdk",
	"access-control-sdk",
	"crypto-inventory-sdk",
	"cryptography",
	"qnsp",
	"qnsp-python",
	"qnsp-go",
	"qnsp-rust",
	"qnsp-jvm",
	"langchain-qnsp",
	"llamaindex-qnsp",
	"autogen-qnsp",
	// QNSI identifiers (2026-07-04 full-rename Phase A1). Dual-accept: the qnsp*
	// values above stay forever so already-published SDK versions keep activating;
	// SDKs switch to sending these from their next publish (0.5.0+).
	"qnsi",
	"qnsi-python",
	"qnsi-go",
	"qnsi-rust",
	"qnsi-jvm",
	"langchain-qnsi",
	"llamaindex-qnsi",
	"autogen-qnsi",
	"mcp-server",
]);

export type SdkIdentifier = z.infer<typeof SdkIdentifierSchema>;

/**
 * Request body for POST /billing/v1/sdk/activate
 */
export const SdkActivationRequestSchema = z.object({
	/** The SDK package requesting activation */
	sdkId: SdkIdentifierSchema,
	/** SDK version string (e.g., "0.1.0") */
	sdkVersion: z.string().min(1).max(32),
	/** Runtime environment. JS family: "browser" | "node" | "edge". Native SDKs: "python" | "go" | "rust" | "jvm". */
	runtime: z.enum(["browser", "node", "edge", "python", "go", "rust", "jvm"]),
});

export type SdkActivationRequest = z.infer<typeof SdkActivationRequestSchema>;

/**
 * Tier limits returned in the activation response.
 * Subset of full TierLimits — only what SDKs need for client-side enforcement.
 */
export const SdkActivationLimitsSchema = z.object({
	storageGB: z.number(),
	apiCalls: z.number(),
	enclavesEnabled: z.boolean(),
	aiTrainingEnabled: z.boolean(),
	aiInferenceEnabled: z.boolean(),
	sseEnabled: z.boolean(),
	vaultEnabled: z.boolean(),
});

export type SdkActivationLimits = z.infer<typeof SdkActivationLimitsSchema>;

/**
 * Successful activation response from billing-service.
 */
export const SdkActivationResponseSchema = z.object({
	/** Whether activation succeeded */
	activated: z.literal(true),
	/** Tenant ID associated with the API key */
	tenantId: z.string().uuid(),
	/** Current pricing tier */
	tier: z.string().min(1),
	/** Tier limits for client-side enforcement */
	limits: SdkActivationLimitsSchema,
	/** Activation token — opaque string, valid for `expiresInSeconds` */
	activationToken: z.string().min(1),
	/** Token validity in seconds (default: 3600 = 1 hour) */
	expiresInSeconds: z.number().int().positive(),
	/** ISO 8601 timestamp of activation */
	activatedAt: z.string().datetime(),
});

export type SdkActivationResponse = z.infer<typeof SdkActivationResponseSchema>;

/**
 * Error response from the activation endpoint.
 */
export const SdkActivationErrorSchema = z.object({
	activated: z.literal(false),
	error: z.string(),
	code: z.enum([
		"INVALID_API_KEY",
		"ACCOUNT_SUSPENDED",
		"TIER_INSUFFICIENT",
		"RATE_LIMITED",
		"SERVICE_UNAVAILABLE",
	]),
});

export type SdkActivationError = z.infer<typeof SdkActivationErrorSchema>;
