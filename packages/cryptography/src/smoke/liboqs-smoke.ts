import { Buffer } from "node:buffer";
import process from "node:process";

import type { PqcAlgorithm, PqcProvider } from "../provider.js";
import { initializeExternalPqcProvider } from "../providers/index.js";

/**
 * Core NIST-finalized algorithms (always tested).
 */
const CORE_ALGORITHMS: readonly PqcAlgorithm[] = [
	"kyber-512",
	"kyber-768",
	"kyber-1024",
	"dilithium-2",
	"dilithium-3",
	"dilithium-5",
	"falcon-512",
	"falcon-1024",
	"sphincs-shake-128f-simple",
	"sphincs-shake-256f-simple",
] as const;

/**
 * Extended algorithms — one representative per family.
 * These are probed opportunistically; failures in non-strict mode are warnings.
 */
const EXTENDED_ALGORITHMS: readonly PqcAlgorithm[] = [
	// SLH-DSA SHA2 variants
	"sphincs-sha2-128f-simple",
	"sphincs-sha2-256f-simple",
	// HQC omitted — disabled in the liboqs build (OQS_ENABLE_KEM_HQC=OFF; CVE-2025-48946).
	// BIKE
	"bike-l1",
	// Classic McEliece
	"mceliece-348864",
	// FrodoKEM
	"frodokem-640-aes",
	// NTRU
	"ntru-hps-2048-509",
	"ntru-hrss-701",
	// NTRU-Prime
	"sntrup761",
	// MAYO
	"mayo-1",
	// CROSS
	"cross-rsdp-128-fast",
	// UOV
	"ov-Is",
	// SNOVA
	"snova-24-5-4",
] as const;

const ALL_ALGORITHMS: readonly PqcAlgorithm[] = [...CORE_ALGORITHMS, ...EXTENDED_ALGORITHMS];

const KEM_ALGORITHMS = new Set<PqcAlgorithm>([
	"kyber-512",
	"kyber-768",
	"kyber-1024",
	"bike-l1",
	"mceliece-348864",
	"frodokem-640-aes",
	"ntru-hps-2048-509",
	"ntru-hrss-701",
	"sntrup761",
]);

const SIGNATURE_ALGORITHMS = new Set<PqcAlgorithm>([
	"dilithium-2",
	"dilithium-3",
	"dilithium-5",
	"falcon-512",
	"falcon-1024",
	"sphincs-shake-128f-simple",
	"sphincs-shake-256f-simple",
	"sphincs-sha2-128f-simple",
	"sphincs-sha2-256f-simple",
	"mayo-1",
	"cross-rsdp-128-fast",
	"ov-Is",
	"snova-24-5-4",
]);

function parseAlgorithms(): PqcAlgorithm[] {
	const raw = process.env["PQC_SMOKE_ALGORITHMS"];
	if (!raw || raw.trim().length === 0) {
		return [...ALL_ALGORITHMS];
	}

	const requested = raw
		.split(",")
		.map((token) => token.trim())
		.filter((token): token is string => token.length > 0);

	const invalid = requested.filter(
		(algorithm): algorithm is string => !ALL_ALGORITHMS.includes(algorithm as PqcAlgorithm),
	);

	if (invalid.length > 0) {
		throw new Error(
			`Unknown PQC algorithms in PQC_SMOKE_ALGORITHMS: ${invalid.join(", ")}. ` +
				`Supported algorithms: ${ALL_ALGORITHMS.join(", ")}`,
		);
	}

	return [...new Set(requested as PqcAlgorithm[])];
}

async function run(): Promise<void> {
	const algorithms = parseAlgorithms();
	const strictMode = process.env["PQC_SMOKE_STRICT"] === "true";

	let provider: PqcProvider;
	try {
		provider = await initializeExternalPqcProvider("liboqs", { algorithms });
	} catch (error) {
		console.error("Failed to initialise liboqs provider for PQC smoke probes.");
		console.error(error);
		if (strictMode) {
			process.exit(1);
		} else {
			console.warn(
				"Skipping PQC smoke probes because liboqs is unavailable. " +
					"Set PQC_SMOKE_STRICT=true to enforce strict mode.",
			);
			return;
		}
	}

	const encoder = new TextEncoder();
	const failures: Array<{ algorithm: PqcAlgorithm; reason: string }> = [];
	const successes: PqcAlgorithm[] = [];

	for (const algorithm of algorithms) {
		try {
			const { keyPair } = await provider.generateKeyPair({ algorithm });

			if (KEM_ALGORITHMS.has(algorithm)) {
				const capsule = await provider.encapsulate({
					algorithm,
					publicKey: keyPair.publicKey,
				});

				const sharedSecret = await provider.decapsulate({
					algorithm,
					privateKey: keyPair.privateKey,
					ciphertext: capsule.ciphertext,
				});

				if (Buffer.compare(sharedSecret, capsule.sharedSecret) !== 0) {
					throw new Error("Derived shared secret did not match encapsulated value");
				}
			}

			if (SIGNATURE_ALGORITHMS.has(algorithm)) {
				const payload = encoder.encode(`qnsp::smoke:${algorithm}`);
				const signature = await provider.sign({
					algorithm,
					data: payload,
					privateKey: keyPair.privateKey,
				});

				const verified = await provider.verify({
					algorithm,
					data: payload,
					signature: signature.signature,
					publicKey: keyPair.publicKey,
				});

				if (!verified) {
					throw new Error("Signature verification failed");
				}
			}

			const digest = await provider.hash(encoder.encode(`qnsp::probe:${algorithm}`));
			if (digest.digest.byteLength === 0) {
				throw new Error("Provider returned empty digest");
			}

			successes.push(algorithm);
		} catch (error) {
			failures.push({
				algorithm,
				reason: error instanceof Error ? error.message : "unknown error",
			});
		}
	}

	const coreFailures = failures.filter((f) =>
		(CORE_ALGORITHMS as readonly string[]).includes(f.algorithm),
	);
	const extendedFailures = failures.filter(
		(f) => !(CORE_ALGORITHMS as readonly string[]).includes(f.algorithm),
	);

	if (coreFailures.length > 0) {
		console.error("CRITICAL: Core PQC algorithm smoke probes failed:");
		for (const failure of coreFailures) {
			console.error(`  - ${failure.algorithm}: ${failure.reason}`);
		}
	}

	if (extendedFailures.length > 0) {
		console.warn(
			"Extended PQC algorithm smoke probes failed (liboqs build may not include these):",
		);
		for (const failure of extendedFailures) {
			console.warn(`  - ${failure.algorithm}: ${failure.reason}`);
		}
	}

	if (coreFailures.length > 0) {
		if (strictMode) {
			process.exit(1);
		} else {
			console.warn(
				"Core PQC smoke probes completed with failures in non-strict mode. " +
					"Set PQC_SMOKE_STRICT=true to enforce failure on probe errors.",
			);
			return;
		}
	}

	if (extendedFailures.length > 0 && strictMode) {
		console.warn(
			`Extended algorithm failures in strict mode: ${extendedFailures.map((f) => f.algorithm).join(", ")}. ` +
				"These algorithms may not be compiled into the current liboqs build.",
		);
	}

	console.log(
		`PQC smoke probes completed: ${successes.length}/${algorithms.length} algorithms passed ` +
			`(${coreFailures.length} core failures, ${extendedFailures.length} extended failures)`,
	);
	console.log(`Verified algorithms: ${successes.join(", ")}`);
}

await run();
