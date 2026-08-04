import { randomUUID } from "node:crypto";
import { qnsiClient, reportFailure } from "./common.js";

async function main(): Promise<void> {
	const qnsi = qnsiClient();
	const exampleRunId = randomUUID();
	const response = await qnsi.audit.logEvent(
		{
			eventType: "developer.example.executed",
			payload: {
				example: "audit-event",
				exampleRunId,
				generatedAt: new Date().toISOString(),
			},
			tags: ["public-example", "non-production-data"],
		},
		{ idempotencyKey: exampleRunId },
	);

	console.log(JSON.stringify({ exampleRunId, response }, null, 2));
}

main().catch(reportFailure);
