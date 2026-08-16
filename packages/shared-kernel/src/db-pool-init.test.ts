/**
 * DatabasePoolManager initialization tests with ./db-retry.js mocked, so the
 * async constructor arc (write init, read-replica init loop, failure logging)
 * runs deterministically with no real sockets.
 */

import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { DatabasePoolManager } from "./db-pool-manager.js";
import { createDatabasePoolWithRetry } from "./db-retry.js";

vi.mock("./db-retry.js", () => ({
	createDatabasePoolWithRetry: vi.fn(async () => ({}) as Pool),
}));

const initMock = vi.mocked(createDatabasePoolWithRetry);

const writeUrl = "postgresql://test:test@localhost:5432/test";
const readUrl1 = "postgresql://test:test@localhost:5433/test";
const readUrl2 = "postgresql://test:test@localhost:5434/test";

describe("DatabasePoolManager initialization", () => {
	it("initializes the write pool and each read replica with the shared pool options", async () => {
		initMock.mockClear();
		new DatabasePoolManager({
			writeUrl,
			readUrls: [readUrl1, readUrl2],
			maxConnections: 7,
			idleTimeoutMs: 1_000,
			connectionTimeoutMs: 500,
			retryOptions: { maxRetries: 0 },
		});

		await vi.waitFor(() => expect(initMock).toHaveBeenCalledTimes(3));
		const urls = initMock.mock.calls.map(([config]) => config.connectionString);
		expect(urls).toEqual([writeUrl, readUrl1, readUrl2]);
		for (const [config, retryOptions] of initMock.mock.calls) {
			expect(config).toMatchObject({
				max: 7,
				idleTimeoutMillis: 1_000,
				connectionTimeoutMillis: 500,
			});
			expect(retryOptions).toEqual({ maxRetries: 0 });
		}
	});

	it("applies option defaults when only the write url is given", async () => {
		initMock.mockClear();
		new DatabasePoolManager({ writeUrl });

		await vi.waitFor(() => expect(initMock).toHaveBeenCalledTimes(1));
		expect(initMock.mock.calls[0]?.[0]).toMatchObject({
			connectionString: writeUrl,
			max: 20,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 2_000,
		});
	});

	it("logs initialization failures instead of crashing the constructor", async () => {
		initMock.mockClear();
		initMock.mockRejectedValueOnce(new Error("bootstrap refused"));
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		new DatabasePoolManager({ writeUrl, retryOptions: { maxRetries: 0 } });

		await vi.waitFor(() =>
			expect(consoleError).toHaveBeenCalledWith(
				"[DatabasePoolManager] Failed to initialize pools:",
				expect.any(Error),
			),
		);
		consoleError.mockRestore();
	});

	it("random strategy uses the built-in random index when none is injected", () => {
		const manager = new DatabasePoolManager({ writeUrl, readUrls: [readUrl1, readUrl2] }, "random");
		const fakeRead1 = { totalCount: 1 } as unknown as Pool;
		const fakeRead2 = { totalCount: 2 } as unknown as Pool;
		(manager as unknown as { readPools: unknown[] }).readPools = [fakeRead1, fakeRead2];
		expect([fakeRead1, fakeRead2]).toContain(manager.getReadPool());
	});

	it("random strategy re-rolls in range when the injected index is invalid", () => {
		const manager = new DatabasePoolManager(
			{ writeUrl, readUrls: [readUrl1, readUrl2], randomIndex: () => 2.5 },
			"random",
		);
		const fakeRead1 = { totalCount: 1 } as unknown as Pool;
		const fakeRead2 = { totalCount: 2 } as unknown as Pool;
		(manager as unknown as { readPools: unknown[] }).readPools = [fakeRead1, fakeRead2];
		expect([fakeRead1, fakeRead2]).toContain(manager.getReadPool());
	});

	it("random strategy falls back to the write pool when the slot is empty", () => {
		const manager = new DatabasePoolManager(
			{ writeUrl, readUrls: [readUrl1], randomIndex: () => 0 },
			"random",
		);
		const fakeWrite = {} as unknown as Pool;
		(manager as unknown as { writePool: unknown }).writePool = fakeWrite;
		(manager as unknown as { readPools: unknown[] }).readPools = [undefined];
		expect(manager.getReadPool()).toBe(fakeWrite);
	});

	it("least-connections keeps the earlier pool when a later pool is busier", () => {
		const manager = new DatabasePoolManager(
			{ writeUrl, readUrls: [readUrl1, readUrl2] },
			"least-connections",
		);
		const quiet = { totalCount: 2 } as unknown as Pool;
		const busy = { totalCount: 5 } as unknown as Pool;
		(manager as unknown as { readPools: unknown[] }).readPools = [quiet, busy];
		expect(manager.getReadPool()).toBe(quiet);
	});

	it("least-connections falls back to the write pool when no pool is comparable", () => {
		const manager = new DatabasePoolManager(
			{ writeUrl, readUrls: [readUrl1] },
			"least-connections",
		);
		const fakeWrite = {} as unknown as Pool;
		(manager as unknown as { writePool: unknown }).writePool = fakeWrite;
		(manager as unknown as { readPools: unknown[] }).readPools = [{ totalCount: Number.NaN }];
		expect(manager.getReadPool()).toBe(fakeWrite);
	});

	it("unknown strategy falls back to the write pool when the first slot is empty", () => {
		const manager = new DatabasePoolManager({ writeUrl, readUrls: [readUrl1] });
		const fakeWrite = {} as unknown as Pool;
		(manager as unknown as { writePool: unknown }).writePool = fakeWrite;
		(manager as unknown as { readPools: unknown[] }).readPools = [undefined];
		(manager as unknown as { strategy: string }).strategy = "bogus";
		expect(manager.getReadPool()).toBe(fakeWrite);
	});
});
