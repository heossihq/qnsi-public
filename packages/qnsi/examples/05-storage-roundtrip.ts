import { randomUUID } from "node:crypto";
import { qnsiClient, reportFailure, requiredEnv } from "./common.js";

async function main(): Promise<void> {
	const qnsi = qnsiClient();
	const bucket = requiredEnv("QNSI_BUCKET");
	const key = `public-examples/${randomUUID()}.txt`;
	const expected = new TextEncoder().encode("QNSI public storage roundtrip");

	await qnsi.storage.putObject(
		bucket,
		key,
		{
			data: expected,
			contentType: "text/plain",
			metadata: { example: "storage-roundtrip" },
		},
		{ idempotencyKey: randomUUID() },
	);

	try {
		const [actual, descriptor] = await qnsi.storage.getObject(bucket, key);
		if (!Buffer.from(actual).equals(Buffer.from(expected))) {
			throw new Error("Stored bytes did not round-trip exactly");
		}
		console.log(JSON.stringify({ bucket, key, bytes: actual.byteLength, descriptor }, null, 2));
	} finally {
		await qnsi.storage.deleteObject(bucket, key);
	}
}

main().catch(reportFailure);
