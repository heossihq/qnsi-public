/**
 * Core types for the source-code cryptography scanner.
 *
 * Design: docs/design/code-crypto-scanner.md. Findings are transport-shaped
 * for the crypto-inventory ingest path: no source-code content beyond the
 * matched rule id and a hash of the matched line ever leaves the scan host.
 */

export type Language =
	| "javascript"
	| "typescript"
	| "python"
	| "java"
	| "kotlin"
	| "go"
	| "c"
	| "cpp"
	| "csharp"
	| "rust"
	| "config";

export type FindingCategory = "asymmetric" | "symmetric" | "hash" | "protocol" | "artifact";

/** Whether the detected primitive is quantum-vulnerable, PQC, or a hybrid. */
export type FindingClassification = "classical" | "pqc" | "hybrid";

export type Confidence = "high" | "medium";

export interface CryptoDetectionRule {
	/** Stable rule id, e.g. "js-node-crypto-generate-keypair-rsa". */
	readonly id: string;
	readonly languages: readonly Language[];
	/**
	 * Matched against a single comment-stripped line. Patterns MUST anchor on
	 * API/import context (e.g. `Cipher.getInstance("RSA`), never on a bare
	 * algorithm word - bare words in prose strings are not usage evidence.
	 */
	readonly pattern: RegExp;
	/**
	 * Canonical algorithm id (matching the crypto-inventory assessor keys,
	 * e.g. "rsa-2048", "ecdsa-p256", "md5"), or an extractor deriving it from
	 * the regex match. Extractors may return null to veto a match.
	 */
	readonly algorithm: string | ((match: RegExpExecArray, line: string) => string | null);
	readonly category: FindingCategory;
	readonly classification: FindingClassification;
	readonly confidence: Confidence;
	/** Library/API family the rule targets, e.g. "node:crypto", "JCA". */
	readonly library: string;
	/**
	 * When true and the canonical algorithm is size-parameterized (rsa/dsa),
	 * the scanner searches a few adjacent lines for a key-size literal.
	 */
	readonly wantsKeySize?: boolean;
}

export interface CodeCryptoFinding {
	/** Repo-relative POSIX path of the file. */
	readonly path: string;
	/** 1-indexed line of the match. */
	readonly line: number;
	readonly language: Language;
	readonly ruleId: string;
	readonly library: string;
	/** Canonical algorithm id, e.g. "rsa-2048", "rsa-unknown", "ml-kem-768". */
	readonly algorithm: string;
	readonly category: FindingCategory;
	readonly classification: FindingClassification;
	readonly confidence: Confidence;
	/** SHA-256 (hex) of the whitespace-normalized matched line. */
	readonly lineHash: string;
	readonly keySize?: number;
	/** True when the file path looks like test code. */
	readonly testContext?: boolean;
}

export interface ScanOptions {
	/** Absolute directory to scan. */
	readonly rootDir: string;
	/** Additional directory names to skip (merged with built-in skip list). */
	readonly excludeDirs?: readonly string[];
	/** Per-file size cap in bytes (default 2 MiB). */
	readonly maxFileBytes?: number;
	/** Cap on total findings (default 50_000) - the scan stops at the cap. */
	readonly maxFindings?: number;
}

export interface ScanSummary {
	readonly filesScanned: number;
	readonly filesSkipped: number;
	readonly findings: readonly CodeCryptoFinding[];
	/** True when maxFindings stopped the scan early (never silently). */
	readonly truncated: boolean;
}
