import { QnsiClient } from "@heossihq/qnsi";

export function qnsiClient(): QnsiClient {
	const apiKey = process.env["QNSI_API_KEY"];
	if (!apiKey) {
		throw new Error("QNSI_API_KEY is required");
	}
	return new QnsiClient({ apiKey });
}

export function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

export function stringField(value: unknown, ...names: readonly string[]): string {
	if (!value || typeof value !== "object") {
		throw new Error(`Expected an object response containing one of: ${names.join(", ")}`);
	}
	const record = value as Record<string, unknown>;
	for (const name of names) {
		if (typeof record[name] === "string") return record[name];
	}
	throw new Error(`Response did not contain a string field named: ${names.join(", ")}`);
}

export function reportFailure(error: unknown): never {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
