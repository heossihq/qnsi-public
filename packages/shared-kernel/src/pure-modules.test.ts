import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseAuthJwtClaims } from "./auth-claims.js";
import { canonicalize, canonicalJson } from "./canonical-json.js";
import { computeCanonicalJsonSha3_512, computeReceiptHash, sha3_512_hex } from "./digests.js";
import { classifyOpaqueToken } from "./token-prefixes.js";

describe("canonical-json", () => {
	it("sorts object keys recursively and preserves arrays and scalars", () => {
		expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
			'{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}',
		);
		expect(canonicalize(null)).toBeNull();
		expect(canonicalize(7)).toBe(7);
		expect(canonicalize(["z", "a"])).toEqual(["z", "a"]);
	});

	it("produces identical output for key-order permutations", () => {
		expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
	});
});

describe("digests", () => {
	it("sha3_512_hex matches node crypto for strings and bytes", () => {
		const expected = createHash("sha3-512").update("qnsi").digest("hex");
		expect(sha3_512_hex("qnsi")).toBe(expected);
		expect(sha3_512_hex(new TextEncoder().encode("qnsi"))).toBe(expected);
	});

	it("canonical digests are key-order independent", () => {
		expect(computeCanonicalJsonSha3_512({ a: 1, b: 2 })).toBe(
			computeCanonicalJsonSha3_512({ b: 2, a: 1 }),
		);
	});

	it("computeReceiptHash chains deterministically and binds every field", () => {
		const base = {
			receiptId: "r1",
			tenantId: "t1",
			subjectId: "s1",
			eventType: "kms.sign",
			timestamp: "2026-08-15T00:00:00Z",
			payloadDigest: "pd",
			policyDecisionDigest: "pdd",
			prevReceiptHash: null,
		};
		const first = computeReceiptHash(base);
		expect(computeReceiptHash(base)).toBe(first);
		expect(computeReceiptHash({ ...base, prevReceiptHash: first })).not.toBe(first);
		expect(computeReceiptHash({ ...base, tenantId: null, policyDecisionDigest: null })).not.toBe(
			first,
		);
	});
});

describe("token-prefixes", () => {
	it.each([
		["qnsi_pqc_pat_x", "isPat"],
		["qnsp_pqc_pat_x", "isPat"],
		["qnsi_pqc_api_x", "isApiKey"],
		["qnsp_pqc_api_x", "isApiKey"],
		["qnsi_pqc_svc_x", "isServiceAccountKey"],
		["qnsp_pqc_svc_x", "isServiceAccountKey"],
		["qnsi_pqc_ops_x", "isOpsControlKey"],
		["qnsp_pqc_ops_x", "isOpsControlKey"],
		["qnsp_pat_x", "isLegacyPat"],
		["qnsp_api_x", "isLegacyApiKey"],
	] as const)("classifies %s as %s", (token, flag) => {
		const cls = classifyOpaqueToken(token);
		expect(cls[flag]).toBe(true);
		expect(cls.isKnownOpaqueToken).toBe(true);
	});

	it("rejects unknown tokens entirely", () => {
		const cls = classifyOpaqueToken("Bearer-something-else");
		expect(cls.isKnownOpaqueToken).toBe(false);
		expect(cls.isPat).toBe(false);
		expect(cls.isLegacyApiKey).toBe(false);
	});
});

describe("auth-claims", () => {
	it("parses new-style tokens with explicit identity and user ids", () => {
		const parsed = parseAuthJwtClaims({
			sub: "identity-1",
			identity_id: "identity-1",
			user_id: "user-1",
			tenant_id: "tenant-1",
			roles: ["admin"],
			email: "u@e.com",
			aud: ["platform"],
			iss: "auth-service",
			jti: "jwt-1",
			iat: 1,
			exp: 2,
			tenant_plan: "dev-pro",
		});
		expect(parsed).toMatchObject({
			subjectId: "identity-1",
			identityId: "identity-1",
			userId: "user-1",
			tenantId: "tenant-1",
			roles: ["admin"],
			audiences: ["platform"],
			issuedAt: 1,
			expiresAt: 2,
			tenantPlan: "dev-pro",
		});
	});

	it("parses legacy tokens: sub doubles as identity and user id", () => {
		const parsed = parseAuthJwtClaims({ sub: "user-legacy", aud: "platform" });
		expect(parsed.identityId).toBe("user-legacy");
		expect(parsed.userId).toBe("user-legacy");
		expect(parsed.audiences).toEqual(["platform"]);
	});

	it("identity_id without user_id nulls userId (migration middle state)", () => {
		const parsed = parseAuthJwtClaims({ sub: "identity-1", identity_id: "identity-1" });
		expect(parsed.userId).toBeNull();
	});

	it("handles empty and malformed claim values", () => {
		const parsed = parseAuthJwtClaims({
			sub: "",
			roles: [1, "ok", null],
			aud: 42,
			iat: "not-a-number",
		});
		expect(parsed.subjectId).toBeNull();
		expect(parsed.roles).toEqual(["ok"]);
		expect(parsed.audiences).toEqual([]);
		expect(parsed.issuedAt).toBeNull();
	});
});
