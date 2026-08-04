import type { CryptoFinding } from "./detector";

/**
 * Build a CycloneDX 1.6 CBOM (Cryptographic Bill of Materials) from local scan findings.
 * CycloneDX 1.6 introduced the `cryptographic-asset` component type + `cryptoProperties`.
 */
export function buildCycloneDxCbom(
	results: ReadonlyMap<string, readonly CryptoFinding[]>,
	generatedAt: string,
): string {
	const components: unknown[] = [];
	for (const [fsPath, findings] of results) {
		for (const f of findings) {
			components.push({
				type: "cryptographic-asset",
				name: f.algorithm,
				"bom-ref": `${fsPath}#L${f.line + 1}:${f.algorithm}`,
				cryptoProperties: {
					assetType: "algorithm",
					algorithmProperties: {
						executionEnvironment: "software-plain-ram",
						certificationLevel: ["none"],
					},
				},
				evidence: {
					occurrences: [{ location: fsPath, line: f.line + 1 }],
				},
				properties: [
					{ name: "qnsi:urgency", value: f.urgency },
					{ name: "qnsi:reason", value: f.reason },
					{ name: "qnsi:recommendation", value: f.recommend },
					{ name: "qnsi:match", value: f.matchText },
				],
			});
		}
	}
	const bom = {
		bomFormat: "CycloneDX",
		specVersion: "1.6",
		version: 1,
		metadata: {
			timestamp: generatedAt,
			tools: {
				components: [
					{ type: "application", publisher: "HEOSSI", name: "QNSI for VS Code", group: "Heossi" },
				],
			},
		},
		components,
	};
	return JSON.stringify(bom, null, 2);
}
