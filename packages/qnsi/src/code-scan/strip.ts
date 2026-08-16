/**
 * Comment stripping - string-aware, per language family.
 *
 * Comments are removed BEFORE rule matching so a migration note that merely
 * mentions a crypto API can never become a finding (the
 * guard-that-reads-its-own-comment failure class, see
 * .claude/rules/toolchain-single-source.md). String literals are KEPT:
 * crypto APIs take algorithm names as string arguments
 * (`Cipher.getInstance("RSA")`), so rules anchor on API context instead.
 */

import type { Language } from "./types.js";

// Every supported language uses c- or hash-style comments; a "none" style had no members.
type CommentStyle = "c" | "hash";

const COMMENT_STYLE: Record<Language, CommentStyle> = {
	javascript: "c",
	typescript: "c",
	java: "c",
	kotlin: "c",
	go: "c",
	c: "c",
	cpp: "c",
	csharp: "c",
	rust: "c",
	python: "hash",
	config: "hash",
};

interface StripState {
	/** Inside a C-style block comment. */
	inBlockComment: boolean;
	/** Python triple-quote delimiter currently open, or null. */
	inTripleQuote: string | null;
}

export function createStripState(): StripState {
	return { inBlockComment: false, inTripleQuote: null };
}

function isEscaped(line: string, index: number): boolean {
	let backslashes = 0;
	for (let i = index - 1; i >= 0 && line[i] === "\\"; i--) {
		backslashes++;
	}
	return backslashes % 2 === 1;
}

/**
 * Strip C-family comments from one line, tracking block-comment state across
 * lines and skipping comment tokens that appear inside string literals.
 */
function stripCFamilyLine(line: string, state: StripState): string {
	let out = "";
	let inString: string | null = null;
	let i = 0;

	while (i < line.length) {
		// The loop bound guarantees the index is in range.
		const ch = line[i] as string;
		const next = line[i + 1] ?? "";

		if (state.inBlockComment) {
			if (ch === "*" && next === "/") {
				state.inBlockComment = false;
				i += 2;
				continue;
			}
			i++;
			continue;
		}

		if (inString !== null) {
			out += ch;
			if (ch === inString && !isEscaped(line, i)) {
				inString = null;
			}
			i++;
			continue;
		}

		if (ch === '"' || ch === "'" || ch === "`") {
			inString = ch;
			out += ch;
			i++;
			continue;
		}

		if (ch === "/" && next === "/") {
			break; // line comment - drop the rest
		}

		if (ch === "/" && next === "*") {
			state.inBlockComment = true;
			i += 2;
			continue;
		}

		out += ch;
		i++;
	}

	return out;
}

/**
 * Strip hash-family comments (Python, YAML, TOML, shell-style configs) from
 * one line, tracking Python triple-quoted blocks across lines and skipping
 * `#` characters that appear inside string literals.
 */
function stripHashFamilyLine(line: string, state: StripState): string {
	let out = "";
	let inString: string | null = null;
	let i = 0;

	while (i < line.length) {
		// The loop bound guarantees the index is in range.
		const ch = line[i] as string;

		if (state.inTripleQuote !== null) {
			if (line.startsWith(state.inTripleQuote, i)) {
				state.inTripleQuote = null;
				i += 3;
				continue;
			}
			i++;
			continue;
		}

		if (inString !== null) {
			out += ch;
			if (ch === inString && !isEscaped(line, i)) {
				inString = null;
			}
			i++;
			continue;
		}

		if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
			state.inTripleQuote = line.slice(i, i + 3);
			i += 3;
			continue;
		}

		if (ch === '"' || ch === "'") {
			inString = ch;
			out += ch;
			i++;
			continue;
		}

		if (ch === "#") {
			break; // comment - drop the rest
		}

		out += ch;
		i++;
	}

	return out;
}

/**
 * Strip comments from a full file, returning one entry per original line so
 * finding line numbers stay 1:1 with the source.
 */
export function stripComments(content: string, language: Language): string[] {
	const style = COMMENT_STYLE[language];
	const lines = content.split(/\r?\n/);

	const state = createStripState();
	const stripped: string[] = [];
	for (const line of lines) {
		if (style === "c") {
			stripped.push(stripCFamilyLine(line, state));
		} else {
			stripped.push(stripHashFamilyLine(line, state));
		}
	}
	return stripped;
}
