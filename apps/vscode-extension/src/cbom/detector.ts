import { type Urgency, VULN_RULES } from "./catalog";

export interface CryptoFinding {
	/** Algorithm / API id (e.g. "RSA", "ECC", "MD5"). */
	readonly algorithm: string;
	readonly urgency: Urgency;
	readonly recommend: string;
	readonly reason: string;
	readonly matchText: string;
	/** 0-based line. */
	readonly line: number;
	readonly startChar: number;
	readonly endChar: number;
}

/**
 * Scan source text for quantum-vulnerable / broken cryptography. Pure + synchronous so it
 * can run on a single document (on-save / on-open) or over many files in a workspace scan.
 * Operates line-by-line so each match carries a precise editor range.
 */
export function detectInText(
	text: string,
	rules: readonly (typeof VULN_RULES)[number][] = VULN_RULES,
): CryptoFinding[] {
	const findings: CryptoFinding[] = [];
	const lines = text.split(/\r?\n/);
	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		if (line === undefined || line.length === 0 || line.length > 4000) {
			continue; // skip empty + pathologically long (minified) lines
		}
		for (const rule of rules) {
			const flags = rule.flags.includes("g") ? rule.flags : `${rule.flags}g`;
			const re = new RegExp(rule.pattern, flags);
			let match: RegExpExecArray | null = re.exec(line);
			while (match !== null) {
				const matchText = match[0];
				findings.push({
					algorithm: rule.id,
					urgency: rule.urgency,
					recommend: rule.recommend,
					reason: rule.reason,
					matchText,
					line: lineNo,
					startChar: match.index,
					endChar: match.index + matchText.length,
				});
				if (match.index === re.lastIndex) {
					re.lastIndex++; // guard against zero-width matches
				}
				match = re.exec(line);
			}
		}
	}
	return dedupe(findings);
}

/** Collapse overlapping matches at the same position (different rules can both hit). */
function dedupe(findings: CryptoFinding[]): CryptoFinding[] {
	const seen = new Set<string>();
	const out: CryptoFinding[] = [];
	for (const f of findings) {
		const key = `${f.line}:${f.startChar}:${f.endChar}:${f.algorithm}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		out.push(f);
	}
	return out;
}

const URGENCY_RANK: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function compareUrgency(a: Urgency, b: Urgency): number {
	return URGENCY_RANK[a] - URGENCY_RANK[b];
}
