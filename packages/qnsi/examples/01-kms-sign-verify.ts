import { randomUUID } from "node:crypto";
import { qnsiClient, reportFailure, stringField } from "./common.js";

async function main(): Promise<void> {
	const qnsi = qnsiClient();
	await qnsi.ensureActivated();

	const created = await qnsi.kms.createKey(
		{
			keyId: `qnsi-example-${randomUUID()}`,
			intent: "signing",
			metadata: { example: "kms-sign-verify" },
		},
		{ idempotencyKey: randomUUID() },
	);
	const keyId = stringField(created, "keyId", "id");

	try {
		const message = new TextEncoder().encode("QNSI public KMS example");
		const signature = await qnsi.kms.sign(keyId, message, { idempotencyKey: randomUUID() });
		const valid = await qnsi.kms.verify(keyId, message, signature);
		if (!valid) throw new Error("Signature verification returned false");
		console.log(JSON.stringify({ keyId, signatureBytes: signature.byteLength, valid }, null, 2));
	} finally {
		await qnsi.kms.deleteKey(keyId);
	}
}

main().catch(reportFailure);
