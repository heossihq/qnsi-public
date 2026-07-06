export const APPROVED_PQC_ALGORITHMS = {
	signature: [
		"dilithium-2",
		"dilithium-3",
		"dilithium-5",
		"falcon-512",
		"falcon-1024",
		"sphincs-sha2-128f",
	],
	kem: ["kyber-512", "kyber-768", "kyber-1024"],
} as const;

export type ApprovedSignatureAlgorithm = (typeof APPROVED_PQC_ALGORITHMS.signature)[number];
export type ApprovedKemAlgorithm = (typeof APPROVED_PQC_ALGORITHMS.kem)[number];

export function validatePqcAlgorithm(
	algorithm: string,
	type: "signature" | "kem",
): algorithm is ApprovedSignatureAlgorithm | ApprovedKemAlgorithm {
	const approved = APPROVED_PQC_ALGORITHMS[type];
	return approved.includes(algorithm as never);
}

export function getRecommendedPqcAlgorithm(
	securityLevel: 1 | 3 | 5,
	type: "signature" | "kem",
): string {
	if (type === "signature") {
		switch (securityLevel) {
			case 1:
				return "dilithium-2";
			case 3:
				return "dilithium-3";
			case 5:
				return "dilithium-5";
		}
	} else {
		switch (securityLevel) {
			case 1:
				return "kyber-512";
			case 3:
				return "kyber-768";
			case 5:
				return "kyber-1024";
		}
	}
}

export interface PqcSecurityProfile {
	readonly signatureAlgorithm: ApprovedSignatureAlgorithm;
	readonly kemAlgorithm: ApprovedKemAlgorithm;
	readonly securityLevel: 1 | 3 | 5;
	readonly hybridMode: boolean;
}

export function getDefaultSecurityProfile(): PqcSecurityProfile {
	return {
		signatureAlgorithm: "dilithium-2",
		kemAlgorithm: "kyber-768",
		securityLevel: 3,
		hybridMode: true,
	};
}

export function validateSecurityProfile(profile: Partial<PqcSecurityProfile>): string[] {
	const errors: string[] = [];

	if (
		profile.signatureAlgorithm &&
		!validatePqcAlgorithm(profile.signatureAlgorithm, "signature")
	) {
		errors.push(
			`Invalid signature algorithm: ${profile.signatureAlgorithm}. ` +
				`Approved: ${APPROVED_PQC_ALGORITHMS.signature.join(", ")}`,
		);
	}

	if (profile.kemAlgorithm && !validatePqcAlgorithm(profile.kemAlgorithm, "kem")) {
		errors.push(
			`Invalid KEM algorithm: ${profile.kemAlgorithm}. ` +
				`Approved: ${APPROVED_PQC_ALGORITHMS.kem.join(", ")}`,
		);
	}

	if (profile.securityLevel && ![1, 3, 5].includes(profile.securityLevel)) {
		errors.push(`Invalid security level: ${profile.securityLevel}. Must be 1, 3, or 5.`);
	}

	return errors;
}
