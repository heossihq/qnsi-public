/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests when a service is failing
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
	readonly failureThreshold?: number; // Number of failures before opening
	readonly timeout?: number; // Time in ms before attempting half-open
	readonly halfOpenMaxCalls?: number; // Max calls in half-open state before closing
	readonly onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreakerOpenError extends Error {
	constructor(message = "Circuit breaker is open") {
		super(message);
		this.name = "CircuitBreakerOpenError";
	}
}

export class CircuitBreaker {
	private state: CircuitState = "closed";
	private failures = 0;
	private lastFailureTime?: Date;
	private halfOpenCalls = 0;
	private readonly options: {
		readonly failureThreshold: number;
		readonly timeout: number;
		readonly halfOpenMaxCalls: number;
		readonly onStateChange?: (state: CircuitState) => void;
	};

	constructor(options: CircuitBreakerOptions = {}) {
		this.options = {
			failureThreshold: options.failureThreshold ?? 5,
			timeout: options.timeout ?? 60_000,
			halfOpenMaxCalls: options.halfOpenMaxCalls ?? 3,
			...(options.onStateChange ? { onStateChange: options.onStateChange } : {}),
		};
	}

	/**
	 * Execute a function with circuit breaker protection
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		// Check if circuit is open
		if (this.state === "open") {
			const now = Date.now();
			const lastFailure = (this.lastFailureTime as Date).getTime();
			const elapsed = now - lastFailure;

			// Try to transition to half-open
			if (elapsed >= this.options.timeout) {
				this.transitionTo("half-open");
			} else {
				throw new CircuitBreakerOpenError();
			}
		}

		// Execute the function
		try {
			const result = await fn();

			// Success - reset failures and close circuit if half-open
			if (this.state === "half-open") {
				this.halfOpenCalls++;
				if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
					this.transitionTo("closed");
				}
			} else {
				this.failures = 0;
			}

			return result;
		} catch (error) {
			// Failure - increment failure count
			this.failures++;
			this.lastFailureTime = new Date();

			// Open circuit if threshold reached
			if (this.failures >= this.options.failureThreshold) {
				this.transitionTo("open");
			}

			throw error;
		}
	}

	/**
	 * Get current circuit state
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * Get current failure count
	 */
	getFailures(): number {
		return this.failures;
	}

	/**
	 * Reset circuit breaker to closed state
	 */
	reset(): void {
		this.state = "closed";
		this.failures = 0;
		this.halfOpenCalls = 0;
		delete this.lastFailureTime;
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: CircuitState): void {
		this.state = newState;

		if (newState === "half-open") {
			this.halfOpenCalls = 0;
		} else if (newState === "closed") {
			this.failures = 0;
			this.halfOpenCalls = 0;
		}

		// Notify state change
		if (this.options.onStateChange) {
			this.options.onStateChange(newState);
		}
	}
}
