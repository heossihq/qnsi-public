/**
 * File walker + rule matcher. Parse-only: files are read as text, comments
 * are stripped, rules are matched line-by-line. Nothing is executed and no
 * network is touched - scanning an untrusted repository is safe by
 * construction.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { canonicalRsa, findKeySizeNear } from "./canonical.js";
import { ALL_RULES } from "./rules/index.js";
import { stripComments } from "./strip.js";
import type {
	CodeCryptoFinding,
	CryptoDetectionRule,
	Language,
	ScanOptions,
	ScanSummary,
} from "./types.js";

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_FINDINGS = 50_000;
const BINARY_SNIFF_BYTES = 8 * 1024;

/** Directories never worth scanning (build output, VCS, dependencies). */
const SKIP_DIRS: ReadonlySet<string> = new Set([
	".git",
	".hg",
	".svn",
	"node_modules",
	"vendor",
	"dist",
	"build",
	"out",
	"target",
	"bin",
	"obj",
	".next",
	".turbo",
	"coverage",
	"__pycache__",
	".venv",
	"venv",
	".terraform",
]);

const SKIP_FILES: ReadonlySet<string> = new Set([
	"pnpm-lock.yaml",
	"package-lock.json",
	"yarn.lock",
	"Cargo.lock",
	"go.sum",
	"poetry.lock",
	"uv.lock",
]);

const EXTENSION_LANGUAGE: Record<string, Language> = {
	".js": "javascript",
	".mjs": "javascript",
	".cjs": "javascript",
	".jsx": "javascript",
	".ts": "typescript",
	".mts": "typescript",
	".cts": "typescript",
	".tsx": "typescript",
	".py": "python",
	".java": "java",
	".kt": "kotlin",
	".kts": "kotlin",
	".go": "go",
	".c": "c",
	".h": "c",
	".cc": "cpp",
	".cpp": "cpp",
	".cxx": "cpp",
	".hpp": "cpp",
	".hh": "cpp",
	".cs": "csharp",
	".rs": "rust",
	".yaml": "config",
	".yml": "config",
	".toml": "config",
	".json": "config",
	".conf": "config",
	".cfg": "config",
	".ini": "config",
	".properties": "config",
	".pem": "config",
	".crt": "config",
	".cer": "config",
	".pub": "config",
};

const TEST_PATH_SEGMENTS = ["test", "tests", "__tests__", "spec", "specs", "testdata", "fixtures"];
const TEST_FILE_PATTERN = /(\.test\.|\.spec\.|_test\.(?:go|py|rb)$|Tests?\.(?:java|kt|cs)$)/;

export function detectLanguage(fileName: string): Language | null {
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".min.js") || lower.endsWith(".min.mjs")) {
		return null; // minified bundles: line-based findings are meaningless
	}
	const dot = lower.lastIndexOf(".");
	if (dot === -1) {
		return fileName === "Dockerfile" ? "config" : null;
	}
	return EXTENSION_LANGUAGE[lower.slice(dot)] ?? null;
}

export function isTestPath(relativePath: string): boolean {
	const posixPath = relativePath.split(sep).join("/");
	const segments = posixPath.toLowerCase().split("/");
	if (segments.some((segment) => TEST_PATH_SEGMENTS.includes(segment))) {
		return true;
	}
	const base = segments[segments.length - 1] ?? "";
	return TEST_FILE_PATTERN.test(base);
}

function looksBinary(buffer: Buffer): boolean {
	const limit = Math.min(buffer.length, BINARY_SNIFF_BYTES);
	for (let i = 0; i < limit; i++) {
		if (buffer[i] === 0) {
			return true;
		}
	}
	return false;
}

export function hashLine(line: string): string {
	const normalized = line.trim().replace(/\s+/g, " ");
	return createHash("sha256").update(normalized).digest("hex");
}

function resolveAlgorithm(
	rule: CryptoDetectionRule,
	match: RegExpExecArray,
	line: string,
	strippedLines: readonly string[],
	lineIndex: number,
): { algorithm: string; keySize: number | null } | null {
	const base = typeof rule.algorithm === "function" ? rule.algorithm(match, line) : rule.algorithm;
	if (base === null || base.length === 0) {
		return null;
	}

	if (!rule.wantsKeySize) {
		return { algorithm: base, keySize: null };
	}

	const keySize = findKeySizeNear(strippedLines, lineIndex);
	if (base.startsWith("rsa")) {
		return { algorithm: canonicalRsa(keySize), keySize };
	}
	if (base.startsWith("dsa") && keySize === 1024) {
		return { algorithm: "dsa-1024", keySize };
	}
	return { algorithm: base, keySize };
}

/**
 * Scan a single file's content. Exported for tests, the CLI's single-file
 * mode, and future host integrations (qnsp-agent).
 */
export function scanFileContent(
	relativePath: string,
	content: string,
	language: Language,
): CodeCryptoFinding[] {
	const rules = ALL_RULES.filter((rule) => rule.languages.includes(language));
	if (rules.length === 0) {
		return [];
	}

	const strippedLines = stripComments(content, language);
	const findings: CodeCryptoFinding[] = [];
	const testContext = isTestPath(relativePath);
	const seen = new Set<string>();

	for (let i = 0; i < strippedLines.length; i++) {
		const line = strippedLines[i] ?? "";
		if (line.length === 0) {
			continue;
		}
		for (const rule of rules) {
			// Fresh exec per line: rule patterns are not /g, so lastIndex is 0.
			const match = rule.pattern.exec(line);
			if (!match) {
				continue;
			}
			const resolved = resolveAlgorithm(rule, match, line, strippedLines, i);
			if (!resolved) {
				continue;
			}
			const dedupKey = `${rule.id}:${i}`;
			if (seen.has(dedupKey)) {
				continue;
			}
			seen.add(dedupKey);
			findings.push({
				path: relativePath.split(sep).join("/"),
				line: i + 1,
				language,
				ruleId: rule.id,
				library: rule.library,
				algorithm: resolved.algorithm,
				category: rule.category,
				classification: rule.classification,
				confidence: rule.confidence,
				lineHash: hashLine(line),
				...(resolved.keySize !== null ? { keySize: resolved.keySize } : {}),
				...(testContext ? { testContext: true } : {}),
			});
		}
	}

	return findings;
}

/** Recursively scan a directory tree. */
export async function scanDirectory(options: ScanOptions): Promise<ScanSummary> {
	const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
	const maxFindings = options.maxFindings ?? DEFAULT_MAX_FINDINGS;
	const skipDirs = new Set([...SKIP_DIRS, ...(options.excludeDirs ?? [])]);

	const findings: CodeCryptoFinding[] = [];
	let filesScanned = 0;
	let filesSkipped = 0;
	let truncated = false;

	async function walk(dir: string): Promise<void> {
		if (truncated) {
			return;
		}
		const entries = await readdir(dir, { withFileTypes: true });
		// Deterministic order - identical trees produce identical summaries.
		entries.sort((a, b) => a.name.localeCompare(b.name));

		for (const entry of entries) {
			if (truncated) {
				return;
			}
			const fullPath = join(dir, entry.name);
			if (entry.isSymbolicLink()) {
				filesSkipped++;
				continue; // never follow symlinks out of the scan root
			}
			if (entry.isDirectory()) {
				if (skipDirs.has(entry.name)) {
					continue;
				}
				await walk(fullPath);
				continue;
			}
			if (!entry.isFile()) {
				continue;
			}
			if (SKIP_FILES.has(entry.name)) {
				filesSkipped++;
				continue;
			}
			const language = detectLanguage(entry.name);
			if (!language) {
				filesSkipped++;
				continue;
			}
			const info = await stat(fullPath);
			if (info.size > maxFileBytes) {
				filesSkipped++;
				continue;
			}
			const buffer = await readFile(fullPath);
			if (looksBinary(buffer)) {
				filesSkipped++;
				continue;
			}

			filesScanned++;
			const relPath = relative(options.rootDir, fullPath);
			const fileFindings = scanFileContent(relPath, buffer.toString("utf8"), language);
			for (const finding of fileFindings) {
				if (findings.length >= maxFindings) {
					truncated = true;
					break;
				}
				findings.push(finding);
			}
		}
	}

	await walk(options.rootDir);

	return { filesScanned, filesSkipped, findings, truncated };
}
