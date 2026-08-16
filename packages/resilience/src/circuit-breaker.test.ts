import { describe, expect, it, vi } from "vitest";

import { CircuitBreaker, CircuitBreakerOpenError } from "./index.js";

describe("CircuitBreaker", () => {
	it("executes actions successfully when closed", async () => {
		const breaker = new CircuitBreaker();

		const result = await breaker.execute(async () => "ok");

		expect(result).toBe("ok");
		expect(breaker.getState()).toBe("closed");
		expect(breaker.getFailures()).toBe(0);
	});

	it("opens after failures and blocks subsequent calls", async () => {
		const breaker = new CircuitBreaker({ failureThreshold: 1, timeout: 60_000 });

		await expect(
			breaker.execute(async () => {
				throw new Error("failure");
			}),
		).rejects.toThrowError("failure");

		expect(breaker.getState()).toBe("open");

		await expect(breaker.execute(async () => "should-not-run")).rejects.toBeInstanceOf(
			CircuitBreakerOpenError,
		);
	});

	it("tracks sub-threshold failures and resets them after a closed-state success", async () => {
		const breaker = new CircuitBreaker({ failureThreshold: 2 });
		await expect(
			breaker.execute(async () => {
				throw new Error("transient");
			}),
		).rejects.toThrow("transient");
		expect(breaker.getFailures()).toBe(1);
		expect(breaker.getState()).toBe("closed");

		await expect(breaker.execute(async () => "recovered")).resolves.toBe("recovered");
		expect(breaker.getFailures()).toBe(0);
	});

	it("transitions through half-open and closes after the configured successful calls", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
		const transitions: string[] = [];
		const breaker = new CircuitBreaker({
			failureThreshold: 1,
			timeout: 100,
			halfOpenMaxCalls: 2,
			onStateChange: (state) => transitions.push(state),
		});
		try {
			await expect(
				breaker.execute(async () => {
					throw new Error("open it");
				}),
			).rejects.toThrow("open it");
			vi.advanceTimersByTime(100);

			await expect(breaker.execute(async () => "probe-1")).resolves.toBe("probe-1");
			expect(breaker.getState()).toBe("half-open");
			await expect(breaker.execute(async () => "probe-2")).resolves.toBe("probe-2");
			expect(breaker.getState()).toBe("closed");
			expect(transitions).toEqual(["open", "half-open", "closed"]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("reopens when a half-open probe fails", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
		const breaker = new CircuitBreaker({ failureThreshold: 1, timeout: 1 });
		try {
			await expect(breaker.execute(() => Promise.reject(new Error("first")))).rejects.toThrow(
				"first",
			);
			vi.advanceTimersByTime(1);
			await expect(breaker.execute(() => Promise.reject(new Error("probe")))).rejects.toThrow(
				"probe",
			);
			expect(breaker.getState()).toBe("open");
		} finally {
			vi.useRealTimers();
		}
	});

	it("resets open state and uses the default error message", async () => {
		const breaker = new CircuitBreaker({ failureThreshold: 1, timeout: 60_000 });
		await expect(breaker.execute(() => Promise.reject(new Error("failed")))).rejects.toThrow(
			"failed",
		);
		await expect(breaker.execute(async () => "blocked")).rejects.toThrow("Circuit breaker is open");

		breaker.reset();
		expect(breaker.getState()).toBe("closed");
		expect(breaker.getFailures()).toBe(0);
		await expect(breaker.execute(async () => "ready")).resolves.toBe("ready");
	});
});
