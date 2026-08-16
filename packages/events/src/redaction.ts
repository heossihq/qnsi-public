import type { SpineEventEnvelope } from "./spine-envelope.js";

export interface RedactionOptions {
	readonly redactValue?: string;
	readonly preserveType?: boolean;
}

const DEFAULT_REDACT_VALUE = "[REDACTED]";

export function redactEventForLogging<TPayload>(
	event: SpineEventEnvelope<TPayload>,
	options: RedactionOptions = {},
): SpineEventEnvelope<unknown> {
	const redactValue = options.redactValue ?? DEFAULT_REDACT_VALUE;
	const hints = event.privacy.redactionHints ?? [];

	if (hints.length === 0) {
		return event as SpineEventEnvelope<unknown>;
	}

	const redactedPayload = redactPaths(event.payload, hints, redactValue, options.preserveType);

	return {
		...event,
		payload: redactedPayload,
	};
}

export function redactPaths(
	obj: unknown,
	paths: readonly string[],
	redactValue: string = DEFAULT_REDACT_VALUE,
	preserveType: boolean = false,
): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj !== "object") {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => redactPaths(item, paths, redactValue, preserveType));
	}

	const result: Record<string, unknown> = {};
	const record = obj as Record<string, unknown>;

	for (const [key, value] of Object.entries(record)) {
		if (shouldRedactKey(key, paths)) {
			result[key] = preserveType ? getTypePreservingRedaction(value) : redactValue;
		} else if (typeof value === "object" && value !== null) {
			result[key] = redactPaths(value, paths, redactValue, preserveType);
		} else {
			result[key] = value;
		}
	}

	return result;
}

function shouldRedactKey(key: string, paths: readonly string[]): boolean {
	const lowerKey = key.toLowerCase();
	return paths.some((path) => {
		const lowerPath = path.toLowerCase();
		if (lowerPath.startsWith("$.")) {
			const fieldName = lowerPath.slice(2).split(".").pop() as string;
			return lowerKey === fieldName.toLowerCase();
		}
		return lowerKey === lowerPath || lowerKey.includes(lowerPath);
	});
}

function getTypePreservingRedaction(value: unknown): unknown {
	if (typeof value === "string") return "***";
	if (typeof value === "number") return 0;
	if (typeof value === "boolean") return false;
	if (Array.isArray(value)) return [];
	if (typeof value === "object" && value !== null) return {};
	return "[REDACTED]";
}

export const COMMON_REDACTION_HINTS = {
	PII: ["email", "phone", "ssn", "address", "name", "dob", "dateOfBirth"],
	CREDENTIALS: ["password", "secret", "apiKey", "token", "key", "credential"],
	FINANCIAL: ["cardNumber", "cvv", "accountNumber", "routingNumber", "iban"],
} as const;

export function getRedactionHintsForClassification(
	classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED",
): string[] {
	switch (classification) {
		case "RESTRICTED":
			return [
				...COMMON_REDACTION_HINTS.PII,
				...COMMON_REDACTION_HINTS.CREDENTIALS,
				...COMMON_REDACTION_HINTS.FINANCIAL,
			];
		case "CONFIDENTIAL":
			return [...COMMON_REDACTION_HINTS.CREDENTIALS, ...COMMON_REDACTION_HINTS.FINANCIAL];
		case "INTERNAL":
			return [...COMMON_REDACTION_HINTS.CREDENTIALS];
		default:
			return [];
	}
}
