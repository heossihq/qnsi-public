export class RateLimiter {
	private requests: number[] = [];
	private readonly maxRequests: number;
	private readonly windowMs: number;
	private hasWarned = false;

	constructor(maxRequests = 100, windowMs = 60000) {
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;
	}

	async checkLimit(): Promise<void> {
		const now = Date.now();
		this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs);

		if (this.requests.length >= this.maxRequests * 0.8 && !this.hasWarned) {
			console.warn(
				`⚠️  Warning: Approaching CLI rate limit (${this.requests.length}/${this.maxRequests} requests).\n` +
					`This is a defensive limit to prevent accidental self-DoS.\n` +
					`Your tier-based limits are enforced by backend services.`,
			);
			this.hasWarned = true;
		}

		if (this.requests.length >= this.maxRequests) {
			const oldestRequest = this.requests[0];
			const waitMs = this.windowMs - (now - (oldestRequest ?? now));
			throw new RateLimitError(
				`🛡️  Defensive rate limit exceeded: ${this.maxRequests} requests per ${this.windowMs / 1000}s.\n` +
					`This protects against runaway scripts and bugs.\n` +
					`Your tier-based limits are enforced by backend services.\n` +
					`Retry after ${Math.ceil(waitMs / 1000)}s`,
				waitMs,
			);
		}

		this.requests.push(now);
	}

	reset(): void {
		this.requests = [];
	}

	getRemaining(): number {
		const now = Date.now();
		this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs);
		return Math.max(0, this.maxRequests - this.requests.length);
	}
}

export class RateLimitError extends Error {
	constructor(
		message: string,
		public readonly retryAfterMs: number,
	) {
		super(message);
		this.name = "RateLimitError";
	}
}
