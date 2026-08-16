import { describe, expect, it, vi } from "vitest";

import {
	createDatabasePoolWithRetry,
	retryDatabaseOperation,
	waitForPostgres,
} from "./db-retry.js";

const pgState: {
	instances: Array<{
		connect: ReturnType<typeof vi.fn>;
		end: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
		totalCount: number;
	}>;
	client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
} = {
	instances: [],
	client: { query: vi.fn(), release: vi.fn() },
};

vi.mock("pg", () => {
	class Pool {
		readonly connect: ReturnType<typeof vi.fn>;
		readonly end: ReturnType<typeof vi.fn>;
		/**
		 * The real pg.Pool is an EventEmitter. This mock had no `on`, so it was LESS capable
		 * than the thing it stands for - and the moment createDatabasePoolWithRetry started
		 * attaching the client-error guard (`pool.on("connect", …)`, the fix for the
		 * 2026-07-14 kms-service crash), the test failed with "pool.on is not a function".
		 *
		 * A double that cannot do what the real object does will eventually mislead. It now
		 * records handlers, so the guard is exercised rather than merely tolerated.
		 */
		readonly on: ReturnType<typeof vi.fn>;
		totalCount: number;

		constructor() {
			this.connect = vi.fn(async () => pgState.client);
			this.end = vi.fn(async () => undefined);
			this.on = vi.fn(() => this);
			this.totalCount = 0;
			pgState.instances.push(this);
		}
	}

	return { Pool };
});
describe("shared-kernel/db-retry", () => {
	it("retries operations with backoff until success", async () => {
		vi.useFakeTimers();
		const operation = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("fail-1"))
			.mockRejectedValueOnce(new Error("fail-2"))
			.mockResolvedValueOnce("ok");

		const promise = retryDatabaseOperation(operation, {
			maxRetries: 3,
			initialDelayMs: 10,
			maxDelayMs: 15,
			backoffMultiplier: 2,
		});

		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBe("ok");
		expect(operation).toHaveBeenCalledTimes(3);

		vi.useRealTimers();
	});

	it("throws the last error after max retries", async () => {
		vi.useFakeTimers();
		const operation = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("no"));

		const promise = retryDatabaseOperation(operation, {
			maxRetries: 1,
			initialDelayMs: 1,
			maxDelayMs: 1,
			backoffMultiplier: 2,
		});
		const expectation = expect(promise).rejects.toThrow("no");

		await vi.runAllTimersAsync();
		await expectation;
		expect(operation).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});

	it("creates a database pool and validates it with a test query", async () => {
		pgState.instances.length = 0;
		pgState.client.query.mockClear();
		pgState.client.release.mockClear();

		const pool = await createDatabasePoolWithRetry(
			{ connectionString: "postgresql://test:test@localhost:5432/test" },
			{ maxRetries: 0 },
		);

		expect(pool).toBeDefined();
		expect(pgState.instances.length).toBe(1);
		expect(pgState.instances[0]?.connect).toHaveBeenCalledTimes(1);
		expect(pgState.client.query).toHaveBeenCalledWith("SELECT 1");
		expect(pgState.client.release).toHaveBeenCalledTimes(1);
	});

	it("routes client-level socket errors to onClientError when supplied", async () => {
		pgState.instances.length = 0;
		pgState.client.query.mockClear();
		pgState.client.release.mockClear();

		const onClientError = vi.fn();
		await createDatabasePoolWithRetry(
			{ connectionString: "postgresql://test:test@localhost:5432/test" },
			{ maxRetries: 0, onClientError },
		);

		const instance = pgState.instances[0];
		if (!instance) throw new Error("expected a pool instance");
		const connectCall = instance.on.mock.calls.find(([event]: unknown[]) => event === "connect");
		if (!connectCall) throw new Error("expected a connect handler");
		const fakeClient = { on: vi.fn() };
		(connectCall[1] as (client: unknown) => void)(fakeClient);
		const errorCall = fakeClient.on.mock.calls.find(([event]: unknown[]) => event === "error");
		if (!errorCall) throw new Error("expected a client error handler");

		const socketError = new Error("TLS reset");
		(errorCall[1] as (error: Error) => void)(socketError);
		expect(onClientError).toHaveBeenCalledWith(socketError);
	});

	it("waitForPostgres ends the pool after checking availability", async () => {
		pgState.instances.length = 0;
		pgState.client.query.mockClear();
		pgState.client.release.mockClear();

		await waitForPostgres("postgresql://test:test@localhost:5432/test", { maxRetries: 0 });

		expect(pgState.instances.length).toBe(1);
		expect(pgState.client.query).toHaveBeenCalledWith("SELECT 1");
		expect(pgState.client.release).toHaveBeenCalledTimes(1);
		expect(pgState.instances[0]?.end).toHaveBeenCalledTimes(1);
	});
});
