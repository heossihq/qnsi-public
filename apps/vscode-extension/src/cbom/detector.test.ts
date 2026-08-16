import { describe, expect, it } from "vitest";
import { ALGORITHM_TO_NIST, PQC_ALGORITHMS, PQC_NIST_NAMES, VULN_RULES } from "./catalog";
import { buildCycloneDxCbom } from "./cyclonedx";
import { type CryptoFinding, compareUrgency, detectInText } from "./detector";

describe("detectInText", () => {
	it("finds vulnerable crypto with precise ranges, skipping empty and huge lines", () => {
		const text = [
			"",
			"const key = generateKeyPairSync('rsa', { modulusLength: 2048 });",
			"x".repeat(4001),
			"use ed25519 for signing",
		].join("\n");
		const findings = detectInText(text);
		const rsa = findings.find((f) => f.algorithm === "RSA");
		expect(rsa).toMatchObject({ urgency: "critical", line: 1 });
		expect(rsa?.startChar).toBeGreaterThan(0);
		expect(findings.some((f) => f.algorithm === "Curve25519" && f.line === 3)).toBe(true);
		// The 4001-char line is skipped even though it contains detectable tokens.
		expect(findings.some((f) => f.line === 2)).toBe(false);
	});

	it("returns nothing for clean PQC-only text", () => {
		expect(detectInText("use ml-kem-768 and ml-dsa-65 everywhere")).toEqual([]);
	});

	it("dedupes identical rule hits and guards zero-width matches via injected rules", () => {
		const dupRule = {
			id: "DUP",
			pattern: "abc",
			flags: "g",
			urgency: "low",
			recommend: "n/a",
			reason: "duplicate-rule fixture",
		} as (typeof VULN_RULES)[number];
		const zeroWidth = {
			...dupRule,
			id: "ZW",
			pattern: "(?=abc)",
		} as (typeof VULN_RULES)[number];
		const findings = detectInText("abc", [dupRule, dupRule, zeroWidth]);
		expect(findings.filter((f) => f.algorithm === "DUP")).toHaveLength(1);
		expect(findings.some((f) => f.algorithm === "ZW")).toBe(true);
	});

	it("appends the global flag only when missing", () => {
		const alreadyGlobal = detectInText("md5 md5", [
			VULN_RULES.find((r) => r.id === "MD5") as (typeof VULN_RULES)[number],
		]);
		expect(alreadyGlobal.length).toBeGreaterThanOrEqual(1);
	});
});

describe("compareUrgency", () => {
	it("orders critical before high before medium before low", () => {
		expect(compareUrgency("critical", "low")).toBeLessThan(0);
		expect(compareUrgency("low", "critical")).toBeGreaterThan(0);
		expect(compareUrgency("high", "high")).toBe(0);
	});
});

describe("catalog", () => {
	it("exposes coherent PQC sets derived from the NIST map", () => {
		expect(PQC_ALGORITHMS.has("kyber-768")).toBe(true);
		expect(PQC_NIST_NAMES.has("ml-kem-768")).toBe(true);
		expect(ALGORITHM_TO_NIST["kyber-768"]).toBe("ML-KEM-768");
		// Every rule regex compiles.
		for (const rule of VULN_RULES) {
			expect(() => new RegExp(rule.pattern, rule.flags)).not.toThrow();
		}
	});
});

describe("buildCycloneDxCbom", () => {
	it("emits CycloneDX 1.6 cryptographic-asset components with evidence", () => {
		const finding: CryptoFinding = {
			algorithm: "RSA",
			urgency: "critical",
			recommend: "ML-KEM-768",
			reason: "Shor breaks RSA.",
			matchText: "rsa-2048",
			line: 4,
			startChar: 2,
			endChar: 10,
		};
		const json = buildCycloneDxCbom(new Map([["/src/a.ts", [finding]]]), "2026-08-17T00:00:00Z");
		const bom = JSON.parse(json) as {
			specVersion: string;
			components: Array<{ type: string; "bom-ref": string; evidence: unknown }>;
		};
		expect(bom.specVersion).toBe("1.6");
		expect(bom.components[0]).toMatchObject({
			type: "cryptographic-asset",
			"bom-ref": "/src/a.ts#L5:RSA",
		});
	});
});
