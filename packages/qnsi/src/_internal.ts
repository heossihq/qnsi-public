/**
 * Shared HTTP plumbing + activation cache.
 *
 * Internal — consumers should reach this only via `QnsiClient`. Each
 * service module (vault, kms, audit, …) takes an `Internal` instance
 * in its constructor and calls `internal.request(method, path, …)`.
 */

import { activateSdk, type SdkActivationResponse } from "./_activation/index.js";

import { QnsiApiError, QnsiAuthError, QnsiNetworkError } from "./errors.js";

// QNSI full-rename A1b (2026-07-05): activation now identifies as "qnsi".
// billing-service dual-accepts qnsp/qnsi (live-verified 2026-07-04), so older
// published versions sending "qnsp" keep activating forever.
export const SDK_ID = "qnsi";
// Bump in lockstep with packages/qnsi/package.json `version` (activation
// telemetry label). Same release contract as browser/sdk-package-version.ts.
export const SDK_VERSION = "0.3.0";

const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const EXPIRY_BUFFER_MS = 60_000; // refresh 60 s before expiry

/** Public configuration accepted by `new QnsiClient(opts)`. */
export interface QnsiClientOptions {
	/** API key issued from <https://cloud.qnsi.heossi.com/api-keys>. Required. */
	readonly apiKey: string;
	/** Override the QNSP edge-gateway URL. Defaults to https://api.qnsi.heossi.com. */
	readonly baseUrl?: string;
	/** Per-request timeout in milliseconds. Defaults to 15 000. */
	readonly timeoutMs?: number;
}

/** Cached activation result. */
interface ActivationState {
	readonly response: SdkActivationResponse;
	readonly cachedAt: number;
}

/** Optional per-request overrides. */
export interface RequestOptions {
	readonly idempotencyKey?: string | undefined;
	readonly query?: Record<string, string | number | boolean | undefined> | undefined;
}

export class Internal {
	readonly baseUrl: string;
	readonly timeoutMs: number;
	readonly apiKey: string;

	private cached: ActivationState | null = null;
	private activationPromise: Promise<SdkActivationResponse> | null = null;

	constructor(opts: QnsiClientOptions) {
		if (!opts.apiKey || opts.apiKey.trim().length === 0) {
			throw new QnsiAuthError("api key required (sign up at https://cloud.qnsi.heossi.com/auth)");
		}
		this.apiKey = opts.apiKey;
		this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
		this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	/** Force the activation handshake to run now. */
	async ensureActivated(): Promise<SdkActivationResponse> {
		const cached = this.cached;
		if (cached !== null) {
			const expiresAtMs = parseExpiresAt(cached.response);
			if (expiresAtMs - Date.now() > EXPIRY_BUFFER_MS) {
				return cached.response;
			}
		}
		return this.refreshActivation();
	}

	/** The activated tenant id (for endpoints that require the tenant in the URL path). */
	async resolveTenantId(): Promise<string> {
		return (await this.ensureActivated()).tenantId;
	}

	/** Drop the cached activation; the next request will re-handshake. */
	invalidateActivation(): void {
		this.cached = null;
		this.activationPromise = null;
	}

	private async refreshActivation(): Promise<SdkActivationResponse> {
		if (this.activationPromise) {
			return this.activationPromise;
		}
		this.activationPromise = activateSdk({
			apiKey: this.apiKey,
			sdkId: SDK_ID,
			sdkVersion: SDK_VERSION,
			platformUrl: this.baseUrl,
		})
			.then((response) => {
				this.cached = { response, cachedAt: Date.now() };
				this.activationPromise = null;
				return response;
			})
			.catch((err: unknown) => {
				this.activationPromise = null;
				throw err;
			});
		return this.activationPromise;
	}

	/**
	 * Authenticated request against the QNSP edge gateway. JSON in, JSON
	 * out. A 401 invalidates the activation cache and retries once.
	 *
	 * @param method  HTTP method (GET / POST / PUT / PATCH / DELETE)
	 * @param path    Path under the base URL, including the service prefix
	 *                (e.g. "/vault/v1/secrets")
	 * @param body    JSON body for non-GET methods. `undefined` to omit.
	 * @param options Per-request options (idempotency key, query string)
	 */
	async request<T = Record<string, unknown>>(
		method: string,
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<T> {
		const activation = await this.ensureActivated();
		// Backend write schemas (vault/kms/...) REQUIRE tenantId (uuid) and scope the
		// request to it. The SDK already knows the activated tenant, so inject it into
		// object bodies centrally rather than per-method. Caller-supplied tenantId wins.
		const effectiveBody = withTenantId(body, activation.tenantId);
		// Backend GET endpoints (e.g. GET /kms/v1/keys/:id, /crypto/v1/assets) read tenantId from
		// the QUERY string, not a body, and 400 without it. The body injection above cannot help a
		// GET (no body), so also inject the activated tenant into the query (reaudit 2026-06-13
		// #29/#31). Caller-supplied query tenantId wins; the edge validates it == the api-key tenant.
		const effectiveOptions = withTenantIdQuery(options, activation.tenantId);

		let response = await this.send(method, path, effectiveBody, effectiveOptions);
		if (response.status === 401) {
			this.invalidateActivation();
			const reactivated = await this.ensureActivated();
			response = await this.send(
				method,
				path,
				withTenantId(body, reactivated.tenantId),
				withTenantIdQuery(options, reactivated.tenantId),
			);
		}

		const text = await safeReadText(response);

		if (!response.ok) {
			throw parseApiError(response.status, text);
		}

		if (response.status === 204 || text.length === 0) {
			return {} as T;
		}

		try {
			return JSON.parse(text) as T;
		} catch {
			throw new QnsiApiError("response is not valid JSON", response.status);
		}
	}

	private async send(
		method: string,
		path: string,
		body: unknown,
		options: RequestOptions | undefined,
	): Promise<Response> {
		const url = buildUrl(this.baseUrl, path, options?.query);
		const headers: Record<string, string> = {
			authorization: `Bearer ${this.apiKey}`,
			accept: "application/json",
		};
		const init: RequestInit = { method, headers };
		if (body !== undefined) {
			headers["content-type"] = "application/json";
			init.body = JSON.stringify(body);
		}
		if (options?.idempotencyKey) {
			headers["idempotency-key"] = options.idempotencyKey;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		init.signal = controller.signal;
		try {
			return await fetch(url, init);
		} catch (err) {
			throw new QnsiNetworkError(method, url, err);
		} finally {
			clearTimeout(timer);
		}
	}
}

/**
 * Inject the activated tenantId into a plain-object JSON body if not already set.
 * Backend write schemas require tenantId (uuid); leaving it to each method is what
 * let "missing tenantId" 400s ship. Non-object bodies (undefined, arrays, strings)
 * pass through unchanged.
 */
/**
 * Inject the activated tenantId into the request query string (for GET endpoints that read it
 * from the query and 400 without it). Returns the options unchanged when no tenant is known or the
 * caller already supplied a query tenantId (caller wins). Reaudit 2026-06-13 #29/#31.
 */
function withTenantIdQuery(
	options: RequestOptions | undefined,
	tenantId: string,
): RequestOptions | undefined {
	if (!tenantId) return options;
	const query = options?.query;
	if (query && query["tenantId"] !== undefined) return options;
	return { ...options, query: { ...(query ?? {}), tenantId } };
}

function withTenantId(body: unknown, tenantId: string): unknown {
	if (
		body === undefined ||
		body === null ||
		typeof body !== "object" ||
		Array.isArray(body) ||
		!tenantId
	) {
		return body;
	}
	const obj = body as Record<string, unknown>;
	if (obj["tenantId"] !== undefined) return body;
	return { tenantId, ...obj };
}

function buildUrl(base: string, path: string, query: RequestOptions["query"]): string {
	let url = `${base}${path}`;
	if (query) {
		const usp = new URLSearchParams();
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined) continue;
			usp.set(key, String(value));
		}
		const encoded = usp.toString();
		if (encoded.length > 0) {
			url += url.includes("?") ? `&${encoded}` : `?${encoded}`;
		}
	}
	return url;
}

async function safeReadText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}

function parseApiError(status: number, raw: string): QnsiApiError {
	let body: unknown = null;
	try {
		body = JSON.parse(raw);
	} catch {
		body = raw;
	}
	let code: string | null = null;
	let message = `HTTP ${status}`;
	if (body && typeof body === "object") {
		const obj = body as Record<string, unknown>;
		if (typeof obj["code"] === "string") code = obj["code"];
		if (typeof obj["message"] === "string") {
			message = obj["message"];
		} else if (typeof obj["error"] === "string") {
			message = obj["error"];
		}
	} else if (typeof raw === "string" && raw.length > 0) {
		message = raw;
	}
	return new QnsiApiError(message, status, code, body);
}

function parseExpiresAt(response: SdkActivationResponse): number {
	const { expiresAt } = response as unknown as { expiresAt?: string | number };
	if (typeof expiresAt === "number") return expiresAt;
	if (typeof expiresAt === "string") {
		const parsed = Date.parse(expiresAt);
		if (!Number.isNaN(parsed)) return parsed;
	}
	// Conservative default — 5 minutes from now.
	return Date.now() + 5 * 60_000;
}
