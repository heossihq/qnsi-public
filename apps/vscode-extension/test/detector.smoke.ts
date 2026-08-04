/**
 * Re-runnable smoke proof for the CBOM detection engine (the net-new headline feature).
 * Pure logic - no `vscode` dependency - so it runs under plain Node via esbuild.
 *
 *   pnpm --filter ./apps/vscode-extension run verify:detector
 *
 * Asserts the detector flags representative quantum-vulnerable / broken crypto AND does
 * NOT flag a post-quantum algorithm (no false positive on ml-kem-768).
 */
import { detectInText } from "../src/cbom/detector";

const SAMPLE = [
	'const kp = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });', // RSA api + RSA-2048
	"priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)", // ECC
	'Cipher c = Cipher.getInstance("DES");', // DES
	"digest = md5(payload)", // MD5
	'tls_curve = "x25519"', // Curve25519
	"const kem = 'ml-kem-768' // post-quantum - MUST NOT be flagged",
	"-----BEGIN RSA PRIVATE KEY-----", // PEM
].join("\n");

const findings = detectInText(SAMPLE);
const algos = new Set(findings.map((f) => f.algorithm));
const mustFind = ["RSA", "ECC", "3DES/DES", "MD5", "Curve25519", "RSA private key (PEM)"];
const missing = mustFind.filter((a) => !algos.has(a));
const falsePositives = findings.filter((f) => f.matchText.toLowerCase().includes("ml-kem"));

console.log(
	`detector: ${findings.length} findings across ${algos.size} algorithms: ${[...algos].join(", ")}`,
);

if (missing.length > 0) {
	console.error(`FAIL - expected algorithms not detected: ${missing.join(", ")}`);
	process.exit(1);
}
if (falsePositives.length > 0) {
	console.error(
		`FAIL - post-quantum algorithm wrongly flagged: ${falsePositives.map((f) => f.matchText).join(", ")}`,
	);
	process.exit(1);
}
// Every finding must carry an urgency + a recommendation (no empty guidance).
for (const f of findings) {
	if (!f.recommend || !f.urgency) {
		console.error(`FAIL - finding without guidance: ${JSON.stringify(f)}`);
		process.exit(1);
	}
}
console.log("DETECTOR SMOKE: PASS");
