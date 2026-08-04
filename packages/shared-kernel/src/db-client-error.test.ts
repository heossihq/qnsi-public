/**
 * REGRESSION GUARD: a transient database socket error must NOT kill the process.
 *
 * PRODUCTION INCIDENT, 2026-07-14. kms-service - the most security-critical service we run -
 * exited(1) and went to 502:
 *
 *     Emitted 'error' event on Client instance at:
 *         at Client._handleErrorEvent (…/pg@8.20.0/lib/client.js:393:10)
 *         at TLSSocket._emitTLSError (node:internal/tls/wrap:1141:10)
 *       code: 'ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY'
 *     Node.js v24.18.0
 *
 *     ECS:  "Essential container in task exited", exitCode 1, running 0/1
 *     Live: /proxy/kms/health -> HTTP 502   (caught by scripts/verify/all-surfaces-e2e.py)
 *
 * WHY IT HAPPENED. Every service attaches `pool.on("error", …)`, and everyone assumed that
 * covered it. It does not: that handler only fires for clients sitting IDLE in the pool.
 * When a CHECKED-OUT client's socket fails, `pg` emits `error` on the CLIENT - and Node's
 * EventEmitter THROWS on an unhandled `error` event. There are 45 `pool.connect()` call
 * sites across the fleet and not one attached a client-level handler.
 *
 * It was not memory (peak 20% of 1024 MB). ECS restarted the task, so the service healed
 * itself - which is precisely why this went unnoticed for so long: the symptom is a burst
 * of 502s and then everything looks fine again.
 *
 * A database connection failing is NORMAL. It must be logged and retried, never fatal.
 *
 * THIS TEST REPRODUCES THE CRASH MECHANISM DIRECTLY. It does not need Postgres: the defect
 * is a Node EventEmitter contract, and asserting on a mock would prove nothing about it.
 */
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

/**
 * The exact shape of the failure: a `pg` Client is an EventEmitter, and pg calls
 * `client.emit("error", err)` from `_handleErrorEvent` when its socket dies.
 */
class FakePgClient extends EventEmitter {}

describe("an unhandled client 'error' event is fatal - this is the mechanism that killed kms", () => {
	it("PROVES the crash: emitting 'error' with NO listener THROWS", () => {
		const client = new FakePgClient();
		const socketError = Object.assign(new Error("could not load the shared library"), {
			code: "ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY",
		});

		// This is what pg does. With no listener, Node re-throws - and in a service that is
		// an uncaught exception, so the process exits(1). Exactly what ECS reported.
		expect(() => client.emit("error", socketError)).toThrow(/could not load the shared library/);
	});

	it("with the guard attached, the same error is captured and the process survives", () => {
		const client = new FakePgClient();
		const captured: Error[] = [];

		// What guardClientErrors installs on every client the pool creates.
		client.on("error", (error: Error) => {
			captured.push(error);
		});

		const socketError = Object.assign(new Error("could not load the shared library"), {
			code: "ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY",
		});

		expect(() => client.emit("error", socketError)).not.toThrow();
		expect(captured).toHaveLength(1);
		expect((captured[0] as { code?: string }).code).toBe(
			"ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY",
		);
	});

	it("a pool-level handler does NOT protect a checked-out client - the false assumption", () => {
		// Every service has `pool.on("error", …)` and believed it was covered.
		const pool = new EventEmitter();
		let poolHandlerCalls = 0;
		pool.on("error", () => {
			poolHandlerCalls++;
		});

		// A client checked out of that pool. pg emits on the CLIENT, not the pool.
		const checkedOut = new FakePgClient();

		expect(() => checkedOut.emit("error", new Error("socket died"))).toThrow(/socket died/);
		expect(poolHandlerCalls).toBe(0); // the pool handler never ran - that is the bug
	});
});

/**
 * The tests above prove the MECHANISM but never call our code - they would still pass if
 * `guardClientErrors` were deleted. These drive the REAL exported `createDatabasePoolWithRetry`
 * through a `pg.Pool` double that behaves like the real one (an EventEmitter that emits
 * "connect" with each client it hands out).
 *
 * The second assertion exists because the FIRST version of the guard called `onError?.(error)`
 * and nothing else. NO service passes onClientError, so the real socket error - the only thing
 * that tells you *why* the connection died - was silently discarded, and all the caller ever
 * saw was pg's causeless "Client has encountered a connection error and is not queryable".
 * Non-fatal must not mean invisible.
 */
describe("createDatabasePoolWithRetry - the REAL guard, not a re-implementation of it", () => {
	it("attaches a client-level error handler, and the error does NOT kill the process", async () => {
		const { pool, issueClient } = await buildPoolViaRealFactory();
		const client = issueClient();

		// Before the fix there was no client listener here at all, so this threw.
		expect(() =>
			client.emit(
				"error",
				Object.assign(new Error("could not load the shared library"), {
					code: "ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY",
				}),
			),
		).not.toThrow();
		expect(client.listenerCount("error")).toBeGreaterThan(0);
		expect(pool).toBeDefined();
	});

	it("LOGS the underlying error instead of swallowing it", async () => {
		const { issueClient } = await buildPoolViaRealFactory();
		const client = issueClient();

		const logged: string[] = [];
		const original = console.error;
		console.error = (...args: unknown[]) => {
			logged.push(args.map(String).join(" "));
		};
		try {
			client.emit(
				"error",
				Object.assign(new Error("could not load the shared library"), {
					code: "ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY",
					reason: "could not load the shared library",
				}),
			);
		} finally {
			console.error = original;
		}

		expect(logged).toHaveLength(1);
		const record = JSON.parse(logged[0] as string) as Record<string, unknown>;
		expect(record["event"]).toBe("db.client.error");
		// The whole point: the CAUSE survives, not just pg's generic wrapper.
		expect(record["code"]).toBe("ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY");
	});
});

/**
 * Build a pool through the REAL `createDatabasePoolWithRetry`, with `pg.Pool` replaced by a
 * double that is at least as capable as the real one (EventEmitter + connect + query). The
 * earlier db-retry mock had NO `.on()` at all - a double LESS capable than the thing it
 * stands in for, which is exactly how a missing EventEmitter contract stays invisible.
 */
async function buildPoolViaRealFactory(): Promise<{
	pool: unknown;
	issueClient: () => FakePgClient;
}> {
	vi.resetModules();
	const clients: FakePgClient[] = [];

	class FakePgPool extends EventEmitter {
		async connect(): Promise<FakePgClient> {
			const client = new FakePgClient();
			clients.push(client);
			this.emit("connect", client); // what pg does for every client it creates
			return client;
		}
	}
	// A client checked out of the pool must answer query() and release().
	Object.assign(FakePgClient.prototype, {
		query: async () => ({ rows: [] }),
		release: () => undefined,
	});

	vi.doMock("pg", () => ({ Pool: FakePgPool }));
	const { createDatabasePoolWithRetry } = await import("./db-retry.js");
	const pool = (await createDatabasePoolWithRetry({})) as unknown as FakePgPool;

	return {
		pool,
		issueClient: () => {
			const client = new FakePgClient();
			pool.emit("connect", client);
			return client;
		},
	};
}
