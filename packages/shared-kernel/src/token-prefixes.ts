/**
 * Opaque-token prefix classification — single source of truth for every
 * service that routes a bearer token by its prefix (auth-service verify,
 * edge-gateway enforcement/proxy).
 *
 * QNSI full-rename Phase A2 (docs/operations/QNSI_FULL_RENAME_RUNBOOK.md):
 * `qnsi_pqc_*` is the canonical prefix family; `qnsp_pqc_*` and the legacy
 * `qnsp_pat_`/`qnsp_api_` families remain accepted FOREVER — issued keys are
 * long-lived credentials and must never stop verifying because of a rename.
 * Verification itself is hash-of-full-token; the prefix only routes type.
 */

export interface OpaqueTokenClass {
	readonly isPat: boolean;
	readonly isApiKey: boolean;
	readonly isServiceAccountKey: boolean;
	readonly isOpsControlKey: boolean;
	/** Pre-PQC legacy families (qnsp_pat_ / qnsp_api_). */
	readonly isLegacyPat: boolean;
	readonly isLegacyApiKey: boolean;
	/** True when the token matches any known opaque-key family. */
	readonly isKnownOpaqueToken: boolean;
}

const PAT_PREFIXES = ["qnsi_pqc_pat_", "qnsp_pqc_pat_"] as const;
const API_KEY_PREFIXES = ["qnsi_pqc_api_", "qnsp_pqc_api_"] as const;
const SERVICE_ACCOUNT_KEY_PREFIXES = ["qnsi_pqc_svc_", "qnsp_pqc_svc_"] as const;
const OPS_CONTROL_KEY_PREFIXES = ["qnsi_pqc_ops_", "qnsp_pqc_ops_"] as const;
const LEGACY_PAT_PREFIX = "qnsp_pat_";
const LEGACY_API_KEY_PREFIX = "qnsp_api_";

function startsWithAny(token: string, prefixes: readonly string[]): boolean {
	return prefixes.some((p) => token.startsWith(p));
}

/** Classify an opaque bearer token by prefix. Accepts qnsi_pqc_*, qnsp_pqc_*, and legacy families. */
export function classifyOpaqueToken(token: string): OpaqueTokenClass {
	const isPat = startsWithAny(token, PAT_PREFIXES);
	const isApiKey = startsWithAny(token, API_KEY_PREFIXES);
	const isServiceAccountKey = startsWithAny(token, SERVICE_ACCOUNT_KEY_PREFIXES);
	const isOpsControlKey = startsWithAny(token, OPS_CONTROL_KEY_PREFIXES);
	const isLegacyPat = token.startsWith(LEGACY_PAT_PREFIX);
	const isLegacyApiKey = token.startsWith(LEGACY_API_KEY_PREFIX);
	return {
		isPat,
		isApiKey,
		isServiceAccountKey,
		isOpsControlKey,
		isLegacyPat,
		isLegacyApiKey,
		isKnownOpaqueToken:
			isPat || isApiKey || isServiceAccountKey || isOpsControlKey || isLegacyPat || isLegacyApiKey,
	};
}
