/**
 * Database Connection Retry Utility
 *
 * Provides retry logic with exponential backoff for database connections
 * to handle transient PostgreSQL connection issues.
 */

import type { Pool, PoolConfig } from "pg";
import { Pool as PgPool } from "pg";

export interface RetryOptions {
	readonly maxRetries?: number;
	readonly initialDelayMs?: number;
	readonly maxDelayMs?: number;
	readonly backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
	maxRetries: 10,
	initialDelayMs: 500,
	maxDelayMs: 30_000,
	backoffMultiplier: 2,
};

/**
 * Retry a database operation with exponential backoff
 */
export async function retryDatabaseOperation<T>(
	operation: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
	let lastError: Error | unknown;

	for (let attempt = 0; attempt <= opts.maxRetries; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;

			// Don't retry on last attempt
			if (attempt === opts.maxRetries) {
				break;
			}

			// Calculate delay with exponential backoff
			const delayMs = Math.min(
				opts.initialDelayMs * opts.backoffMultiplier ** attempt,
				opts.maxDelayMs,
			);

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	throw lastError;
}

/**
 * Create a database pool with retry logic
 */
/**
 * Attach an `error` listener to EVERY client the pool creates.
 *
 * WITHOUT THIS, A TRANSIENT DATABASE SOCKET ERROR KILLS THE PROCESS.
 *
 * `pool.on("error", …)` - which every service already has - only covers clients sitting
 * IDLE in the pool. When a CHECKED-OUT client's socket fails, `pg` emits `error` on the
 * CLIENT (Client._handleErrorEvent). Node's EventEmitter throws on an unhandled `error`
 * event, so the service exits(1). There are 45 `pool.connect()` call sites across the
 * fleet and NOT ONE of them attached a client-level handler.
 *
 * This is not theoretical. kms-service - the most security-critical service we run - died
 * live on 2026-07-14:
 *
 *     Emitted 'error' event on Client instance at:
 *         at Client._handleErrorEvent (…/pg@8.20.0/lib/client.js:393:10)
 *         at TLSSocket._emitTLSError (node:internal/tls/wrap:1141:10)
 *       code: 'ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY'
 *     Node.js v24.18.0
 *
 *     ECS: "Essential container in task exited", exitCode 1, running 0/1
 *     Live: /proxy/kms/health -> HTTP 502
 *
 * A single TLS hiccup on one connection took the whole service down. It was NOT memory
 * (peak 20% of 1024 MB). ECS restarted it, so it self-healed - which is exactly why nobody
 * had noticed: the blast radius is a burst of 502s, and then it looks fine again.
 *
 * A database connection failing is a NORMAL, EXPECTED event. It must be logged and retried,
 * never fatal. Fixing it here fixes every service at once.
 */
function guardClientErrors(pool: Pool, onError?: (error: Error) => void): void {
	pool.on("connect", (client) => {
		client.on("error", (error: Error) => {
			// NON-FATAL, BUT NEVER SILENT.
			//
			// The first version of this guard called `onError?.(error)` and nothing else,
			// with a comment claiming swallowing was fine because the caller's in-flight
			// query rejects with the same error. That was wrong in practice: NO service
			// passes onClientError (grep it), and what the caller actually surfaces is pg's
			// generic wrapper - "Client has encountered a connection error and is not
			// queryable" - which names no cause. So the guard turned a process-killing
			// crash into an INVISIBLE one, and the underlying socket/TLS error (the thing
			// you actually need, e.g. ERR_SSL_COULD_NOT_LOAD_THE_SHARED_LIBRARY) was thrown
			// away. Making a failure non-fatal is not the same as making it disappear.
			//
			// Always emit the real error. A structured logger can be supplied; without one
			// this still reaches stderr and therefore CloudWatch.
			const detail = {
				event: "db.client.error",
				name: error.name,
				message: error.message,
				// pg/OpenSSL attach these; they are the whole diagnosis when TLS is at fault.
				code: (error as NodeJS.ErrnoException).code,
				reason: (error as Error & { reason?: string }).reason,
				library: (error as Error & { library?: string }).library,
			};
			if (onError) {
				onError(error);
			} else {
				console.error(JSON.stringify(detail));
			}
		});
	});
}

export async function createDatabasePoolWithRetry(
	config: PoolConfig,
	options: RetryOptions & { onClientError?: (error: Error) => void } = {},
): Promise<Pool> {
	return retryDatabaseOperation(async () => {
		const pool = new PgPool(config);

		// MUST be attached before the pool hands out its first client.
		guardClientErrors(pool, options.onClientError);

		// Test connection by running a simple query
		const client = await pool.connect();
		try {
			await client.query("SELECT 1");
		} finally {
			client.release();
		}

		return pool;
	}, options);
}

/**
 * Wait for PostgreSQL to become available
 */
export async function waitForPostgres(
	connectionString: string,
	options: RetryOptions = {},
): Promise<void> {
	await retryDatabaseOperation(async () => {
		const pool = new PgPool({ connectionString });
		const client = await pool.connect();
		try {
			await client.query("SELECT 1");
		} finally {
			client.release();
			await pool.end();
		}
	}, options);
}
