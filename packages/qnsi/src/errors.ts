/**
 * Typed error hierarchy for the QNSP SDK.
 *
 * Every method in `@heossi/qnsi` rejects with an instance of one of these
 * classes — never with a bare `Error` or a string. Callers can branch on
 * the failure mode without parsing error messages.
 */

/** Base class — all QNSP SDK errors inherit. */
export class QnsiError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "QnsiError";
	}
}

/** DNS, TLS, timeout, or connection failure reaching the QNSP edge gateway. */
export class QnsiNetworkError extends QnsiError {
	readonly op: string;
	readonly url: string;
	constructor(op: string, url: string, cause?: unknown) {
		super(`qnsp: network error on ${op} ${url}: ${stringifyCause(cause)}`, { cause });
		this.name = "QnsiNetworkError";
		this.op = op;
		this.url = url;
	}
}

/** API key rejected at activation. */
export class QnsiAuthError extends QnsiError {
	readonly code: string | null;
	constructor(message: string, code: string | null = null) {
		super(`qnsp: auth error${code ? ` (${code})` : ""}: ${message}`);
		this.name = "QnsiAuthError";
		this.code = code;
	}
}

/** A QNSP service returned a 4xx/5xx with a structured body. */
export class QnsiApiError extends QnsiError {
	readonly statusCode: number;
	readonly code: string | null;
	readonly body: unknown;
	constructor(
		message: string,
		statusCode: number,
		code: string | null = null,
		body: unknown = null,
	) {
		super(`qnsp: api error ${statusCode}${code ? ` ${code}` : ""}: ${message}`);
		this.name = "QnsiApiError";
		this.statusCode = statusCode;
		this.code = code;
		this.body = body;
	}
}

/** HMAC mismatch, expired/future timestamp, malformed body, or missing fields. */
export class QnsiWebhookError extends QnsiError {
	readonly reason: string;
	constructor(reason: string) {
		super(`qnsp: webhook error: ${reason}`);
		this.name = "QnsiWebhookError";
		this.reason = reason;
	}
}

function stringifyCause(cause: unknown): string {
	if (cause instanceof Error) return cause.message;
	if (typeof cause === "string") return cause;
	return "unknown error";
}
