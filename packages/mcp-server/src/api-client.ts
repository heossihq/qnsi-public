/**
 * QNSP API Client
 *
 * Thin HTTP client for calling QNSP platform APIs through the edge gateway.
 * All requests include the API key as Bearer token and tenant ID header.
 * The edge gateway handles entitlement enforcement, quota checks, and PQC signing.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiClientConfig {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly tenantId: string;
	readonly timeoutMs?: number;
}

export interface ApiResponse<T = unknown> {
	readonly ok: boolean;
	readonly status: number;
	readonly data: T;
}

export class ApiClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly tenantId: string;
	private readonly timeoutMs: number;

	constructor(config: ApiClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		this.apiKey = config.apiKey;
		this.tenantId = config.tenantId;
		this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	async get<T = unknown>(path: string): Promise<ApiResponse<T>> {
		return this.request<T>("GET", path);
	}

	async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
		return this.request<T>("POST", path, body);
	}

	async patch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
		return this.request<T>("PATCH", path, body);
	}

	async del<T = unknown>(path: string): Promise<ApiResponse<T>> {
		return this.request<T>("DELETE", path);
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
		const url = `${this.baseUrl}${path}`;
		const headers: Record<string, string> = {
			authorization: `Bearer ${this.apiKey}`,
			"x-qnsp-tenant": this.tenantId,
			"x-qnsp-tenant-id": this.tenantId,
			"x-tenant-id": this.tenantId,
			"content-type": "application/json",
			"user-agent": "qnsi-mcp-server/0.2.0",
		};

		const response = await fetch(url, {
			method,
			headers,
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
			signal: AbortSignal.timeout(this.timeoutMs),
		});

		const text = await response.text();
		let data: T;
		try {
			data = JSON.parse(text) as T;
		} catch {
			data = text as unknown as T;
		}

		if (!response.ok) {
			const msg =
				typeof data === "object" && data !== null && "message" in data
					? String((data as Record<string, unknown>)["message"])
					: `HTTP ${response.status}`;
			throw new QnspApiError(msg, response.status, data);
		}

		return { ok: true, status: response.status, data };
	}
}

export class QnspApiError extends Error {
	readonly statusCode: number;
	readonly body: unknown;

	constructor(message: string, statusCode: number, body: unknown) {
		super(message);
		this.name = "QnspApiError";
		this.statusCode = statusCode;
		this.body = body;
	}
}
