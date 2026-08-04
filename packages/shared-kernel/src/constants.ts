export const SERVICE_NAMESPACE = "qnsp" as const;

export const CLASSIFICATION_LEVELS = {
	PUBLIC: "public",
	CONFIDENTIAL: "confidential",
	SECRET: "secret",
	TOP_SECRET: "top-secret",
} as const;

export type ClassificationLevel =
	(typeof CLASSIFICATION_LEVELS)[keyof typeof CLASSIFICATION_LEVELS];

export const TOKEN_AUDIENCES = {
	PLATFORM: "platform",
	INTERNAL_SERVICE: "internal-service",
	EXTERNAL_API: "external-api",
} as const;

export type TokenAudience = (typeof TOKEN_AUDIENCES)[keyof typeof TOKEN_AUDIENCES];

export const DEFAULT_TOKEN_TTL_SECONDS = 60 * 15; // 15 minutes
