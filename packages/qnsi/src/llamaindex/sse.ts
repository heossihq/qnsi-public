/**
 * SSE-X token derivation - `@heossihq/qnsi/llamaindex` subpath.
 *
 * Faithful inline of the SSE-X token-derivation crypto from the former
 * `@heossihq/qnsi-search-sdk` `sse.ts` (2026-05-16 consolidation). Only the
 * token-derivation functions are inlined - the former `checkSseAccess`/tier
 * gate is NOT carried over here because the vector store never invoked it
 * (server enforces the SSE entitlement authoritatively), which also lets this
 * subpath avoid a `@heossihq/qnsi-shared-kernel` dependency. Crypto is
 * byte-for-byte preserved: HMAC-SHA3-512 over UTF-8 values, base64url output.
 */

import { Buffer } from "node:buffer";

import { hmac } from "@noble/hashes/hmac.js";
import { sha3_512 } from "@noble/hashes/sha3.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

/** Subset of an index document used for token derivation. */
export interface SseDocumentPayload {
	readonly tenantId: string;
	readonly documentId: string;
	readonly sourceService: string;
	readonly tags?: readonly string[];
	readonly metadata?: Record<string, unknown>;
	readonly body?: string | null;
	readonly title?: string | null;
	readonly description?: string | null;
}

function toBase64Url(bytes: Uint8Array): string {
	return Buffer.from(bytes)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/u, "");
}

function normalizeKey(key: Uint8Array | string): Uint8Array {
	if (typeof key === "string") {
		return Uint8Array.from(Buffer.from(key, "base64"));
	}
	return key;
}

export function createSseToken(key: Uint8Array | string, value: string): string {
	const normalizedKey = normalizeKey(key);
	const mac = hmac(sha3_512, normalizedKey, utf8ToBytes(value));
	return toBase64Url(mac);
}

function flattenMetadata(metadata: Record<string, unknown>, prefix = "meta"): string[] {
	const tokens: string[] = [];
	for (const [key, value] of Object.entries(metadata)) {
		const nextPrefix = `${prefix}.${key}`;
		if (
			value === null ||
			typeof value === "number" ||
			typeof value === "string" ||
			typeof value === "boolean"
		) {
			tokens.push(`${nextPrefix}=${String(value)}`);
		} else if (Array.isArray(value)) {
			value.forEach((entry, index) => {
				if (
					entry === null ||
					typeof entry === "number" ||
					typeof entry === "string" ||
					typeof entry === "boolean"
				) {
					tokens.push(`${nextPrefix}[${index}]=${String(entry)}`);
				} else if (entry && typeof entry === "object") {
					tokens.push(
						...flattenMetadata(entry as Record<string, unknown>, `${nextPrefix}[${index}]`),
					);
				}
			});
		} else if (value && typeof value === "object") {
			tokens.push(...flattenMetadata(value as Record<string, unknown>, nextPrefix));
		}
	}
	return tokens;
}

interface TokenizationOptions {
	readonly maxTokens: number;
	readonly minTokenLength: number;
}

const DEFAULT_TOKENIZATION: TokenizationOptions = {
	maxTokens: 128,
	minTokenLength: 3,
};

function tokenizeContent(
	value: string,
	options: TokenizationOptions = DEFAULT_TOKENIZATION,
	accumulator?: Set<string>,
): Set<string> {
	const tokens = accumulator ?? new Set<string>();
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/u);

	for (const token of normalized) {
		if (!token || token.length < options.minTokenLength) {
			continue;
		}
		tokens.add(token);
		if (tokens.size >= options.maxTokens) {
			break;
		}
	}

	return tokens;
}

export interface DeriveSseOptions {
	readonly includeContent?: boolean;
	readonly includeBody?: boolean;
	readonly maxContentTokens?: number;
	readonly minTokenLength?: number;
}

function normalizeOptions(options?: DeriveSseOptions): Required<DeriveSseOptions> {
	return {
		includeContent: options?.includeContent ?? false,
		includeBody: options?.includeBody ?? false,
		maxContentTokens: options?.maxContentTokens ?? DEFAULT_TOKENIZATION.maxTokens,
		minTokenLength: options?.minTokenLength ?? DEFAULT_TOKENIZATION.minTokenLength,
	};
}

export function deriveDocumentSseTokens(
	payload: SseDocumentPayload,
	key: Uint8Array | string,
	options: DeriveSseOptions = {},
): string[] {
	const tokens = new Set<string>();
	const normalizedOptions = normalizeOptions(options);
	const tokenizationOptions: TokenizationOptions = {
		maxTokens: normalizedOptions.maxContentTokens,
		minTokenLength: normalizedOptions.minTokenLength,
	};
	const add = (raw?: string | null) => {
		if (!raw) {
			return;
		}
		tokens.add(createSseToken(key, raw));
	};

	add(`tenant:${payload.tenantId}`);
	add(`document:${payload.documentId}`);
	add(`source:${payload.sourceService}`);

	for (const tag of payload.tags ?? []) {
		add(`tag:${tag}`);
	}

	if (normalizedOptions.includeContent) {
		const contentTokens = new Set<string>();
		if (payload.title) {
			tokenizeContent(payload.title, tokenizationOptions, contentTokens);
		}
		if (payload.description) {
			tokenizeContent(payload.description, tokenizationOptions, contentTokens);
		}
		if (normalizedOptions.includeBody && payload.body) {
			tokenizeContent(payload.body, tokenizationOptions, contentTokens);
		}

		let count = 0;
		for (const keyword of contentTokens) {
			add(`kw:${keyword}`);
			count += 1;
			if (count >= tokenizationOptions.maxTokens) {
				break;
			}
		}
	}

	const metadata = payload.metadata ?? {};
	for (const entry of flattenMetadata(metadata)) {
		add(entry);
	}

	return Array.from(tokens);
}

export interface DeriveQuerySseOptions {
	readonly maxTokens?: number;
	readonly minTokenLength?: number;
}

export function deriveQuerySseTokens(
	query: string,
	key: Uint8Array | string,
	options: DeriveQuerySseOptions = {},
): string[] {
	const normalized = normalizeOptions({
		includeContent: true,
		includeBody: true,
		maxContentTokens: options.maxTokens ?? 64,
		minTokenLength: options.minTokenLength ?? DEFAULT_TOKENIZATION.minTokenLength,
	});
	const keywordSet = tokenizeContent(query, {
		maxTokens: normalized.maxContentTokens,
		minTokenLength: normalized.minTokenLength,
	});

	return Array.from(keywordSet).map((keyword) => createSseToken(key, `kw:${keyword}`));
}
