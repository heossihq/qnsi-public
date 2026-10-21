import { describe, expect, it } from "vitest";
import {
	ALGORITHM_LIFECYCLE_REGISTRY,
	getAlgorithmLifecycle,
	hasScheduleReached,
	isAlgorithmDeprecatedAt,
	isAlgorithmRemovedAt,
	listAlgorithmsByType,
	STANDARDS_BASELINE_VERIFIED_AT,
} from "./algorithm-lifecycle.js";

/**
 * NIST security categories are a property of the parameter set, not of the
 * algorithm family. These guards exist because a missing or mislabelled entry
 * silently floors a tenant policy at level 0 in
 * `@heossihq/qnsi-security`'s level-based checks (crypto-agility-synthesizer,
 * crypto-inventory migration planner).
 */
const EXPECTED_LEVELS: ReadonlyArray<readonly [string, number]> = [
	// FIPS 203 - ML-KEM
	["kyber-512", 1],
	["kyber-768", 3],
	["kyber-1024", 5],
	// FIPS 204 - ML-DSA
	["dilithium-2", 2],
	["dilithium-3", 3],
	["dilithium-5", 5],
	// FIPS 205 - SLH-DSA: 128 -> 1, 192 -> 3, 256 -> 5
	["sphincs-sha2-128f-simple", 1],
	["sphincs-sha2-128s-simple", 1],
	["sphincs-sha2-192f-simple", 3],
	["sphincs-sha2-192s-simple", 3],
	["sphincs-sha2-256f-simple", 5],
	["sphincs-sha2-256s-simple", 5],
	["sphincs-shake-128f-simple", 1],
	["sphincs-shake-128s-simple", 1],
	["sphincs-shake-192f-simple", 3],
	["sphincs-shake-192s-simple", 3],
	["sphincs-shake-256f-simple", 5],
	["sphincs-shake-256s-simple", 5],
	// FIPS 197 / 202 / 180-4 - symmetric and hash floors
	["aes-128-gcm", 1],
	["aes-256-gcm", 5],
	["sha-256", 2],
	["sha3-256", 2],
	["sha-384", 4],
	["sha3-384", 4],
	["sha-512", 5],
	["sha3-512", 5],
];

describe("ALGORITHM_LIFECYCLE_REGISTRY NIST security levels", () => {
	it.each(EXPECTED_LEVELS)("maps %s to NIST level %i", (algorithm, level) => {
		expect(getAlgorithmLifecycle(algorithm)?.securityLevel).toBe(level);
	});

	it("tracks the full 12-parameter-set FIPS 205 matrix", () => {
		const slhDsa = listAlgorithmsByType("signature").filter(
			(meta) => meta.nistStandard === "FIPS 205",
		);
		expect(slhDsa).toHaveLength(12);
	});

	it("covers every level reachable by a finalized PQC parameter set", () => {
		const finalizedPqcLevels = new Set(
			Object.values(ALGORITHM_LIFECYCLE_REGISTRY)
				.filter(
					(meta) =>
						meta.nistStandard === "FIPS 203" ||
						meta.nistStandard === "FIPS 204" ||
						meta.nistStandard === "FIPS 205",
				)
				.map((meta) => meta.securityLevel),
		);
		// Levels 1/2/3/5 are reachable; level 4 is deliberately absent because no
		// ML-KEM, ML-DSA, or SLH-DSA parameter set is defined at category 4.
		expect(finalizedPqcLevels).toStrictEqual(new Set([1, 2, 3, 5]));
	});

	it("rejects algorithms outside the registry instead of assuming a level", () => {
		expect(getAlgorithmLifecycle("made-up-kem")).toBeNull();
	});
});

describe("standards provenance", () => {
	it("stamps the baseline verification date", () => {
		expect(STANDARDS_BASELINE_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(Number.isNaN(Date.parse(STANDARDS_BASELINE_VERIFIED_AT))).toBe(false);
	});

	it("names the process stage of every draft algorithm", () => {
		for (const [id, meta] of Object.entries(ALGORITHM_LIFECYCLE_REGISTRY)) {
			if (meta.status !== "NIST_DRAFT") continue;
			expect(meta.processStage, `${id} is a draft without a process stage`).toBeTruthy();
		}
	});

	it("keeps the NIST extra-signature rounds straight as of October 2026", () => {
		// NIST IR 8610 selected 9 Round 3 candidates; CROSS did not advance.
		for (const algorithm of ["mayo-1", "ov-Is", "snova-24-5-4"]) {
			expect(getAlgorithmLifecycle(algorithm)?.processStage).toContain("Round 3");
		}
		expect(getAlgorithmLifecycle("cross-rsdp-128-balanced")?.processStage).toContain(
			"not advanced to Round 3",
		);
		expect(getAlgorithmLifecycle("falcon-1024")?.processStage).toContain("FIPS 206");
		expect(getAlgorithmLifecycle("hqc-128")?.processStage).toContain("draft standard pending");
	});

	it("applies the NIST IR 8547 deprecation and removal schedule to classical algorithms", () => {
		for (const id of [
			"rsa-2048",
			"rsa-4096",
			"ecdsa-p256",
			"ecdsa-p384",
			"ed25519",
			"ecdh-p256",
			"ecdh-p384",
			"dh-2048",
			"rsa-oaep-2048",
		]) {
			const meta = getAlgorithmLifecycle(id);
			expect(meta?.deprecationDate, id).toBe("2030-01-01");
			expect(meta?.removalDate, id).toBe("2035-01-01");
		}
	});

	it("distinguishes deprecation from removal in time", () => {
		const beforeTransition = new Date("2029-12-31T00:00:00.000Z");
		const afterDeprecation = new Date("2031-01-01T00:00:00.000Z");
		const afterRemoval = new Date("2035-01-01T00:00:00.000Z");

		expect(isAlgorithmDeprecatedAt("rsa-2048", beforeTransition)).toBe(false);
		expect(isAlgorithmDeprecatedAt("rsa-2048", afterDeprecation)).toBe(true);
		expect(isAlgorithmRemovedAt("rsa-2048", afterDeprecation)).toBe(false);
		expect(isAlgorithmRemovedAt("rsa-2048", afterRemoval)).toBe(true);
		// Finalized PQC carries no transition deadline.
		expect(isAlgorithmRemovedAt("kyber-768", afterRemoval)).toBe(false);
	});
});

describe("NIST IR 8547 schedule helpers", () => {
	it("hasScheduleReached covers every branch explicitly", () => {
		const at = new Date("2030-06-01T00:00:00.000Z");
		expect(hasScheduleReached(undefined, at)).toBe(false);
		expect(hasScheduleReached("not-a-date", at)).toBe(false);
		expect(hasScheduleReached("2030-01-01", new Date("2029-12-31T00:00:00.000Z"))).toBe(false);
		expect(hasScheduleReached("2030-01-01", at)).toBe(true);
	});

	it("returns false for unknown algorithms on both schedule checks", () => {
		const at = new Date("2040-01-01T00:00:00.000Z");
		expect(isAlgorithmRemovedAt("made-up-kem", at)).toBe(false);
		expect(isAlgorithmDeprecatedAt("made-up-kem", at)).toBe(false);
	});

	it("treats a finalized algorithm with no removal date as never removed", () => {
		expect(isAlgorithmRemovedAt("kyber-768", new Date("2040-01-01T00:00:00.000Z"))).toBe(false);
	});

	it("registry invariant: every deprecated or forbidden entry carries both schedule dates", () => {
		for (const [id, meta] of Object.entries(ALGORITHM_LIFECYCLE_REGISTRY)) {
			if (meta.status !== "DEPRECATED" && meta.status !== "FORBIDDEN") continue;
			expect(meta.deprecationDate, id).toBeTruthy();
			expect(meta.removalDate, id).toBeTruthy();
		}
	});

	it("removes classical algorithms after 2035 through the public check", () => {
		const at = new Date("2035-06-01T00:00:00.000Z");
		expect(isAlgorithmRemovedAt("rsa-2048", at)).toBe(true);
	});
});
