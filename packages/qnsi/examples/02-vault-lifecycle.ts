import { randomUUID } from "node:crypto";
import { qnsiClient, reportFailure, stringField } from "./common.js";

async function main(): Promise<void> {
	const qnsi = qnsiClient();
	const secretName = `qnsi-example-${randomUUID()}`;
	const payloadB64 = Buffer.from("replace-with-a-non-production-example-value").toString("base64");
	const created = await qnsi.vault.createSecret(
		{
			name: secretName,
			payloadB64,
			metadata: { example: "vault-lifecycle" },
		},
		{ idempotencyKey: randomUUID() },
	);
	const secretId = stringField(created, "secretId", "id");

	try {
		const metadata = await qnsi.vault.getSecret(secretId);
		const versions = await qnsi.vault.listSecretVersions(secretId);
		console.log(JSON.stringify({ secretId, metadata, versions }, null, 2));
	} finally {
		await qnsi.vault.deleteSecret(secretId);
	}
}

main().catch(reportFailure);
