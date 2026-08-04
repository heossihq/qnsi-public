/**
 * Shared PostgreSQL SSL configuration for QNSP services.
 *
 * Supports standard sslmode values including verify-full with CA bundle.
 * Used by services that parse DATABASE_URL with sslmode query parameter,
 * and by services that use explicit DATABASE_SSL + DATABASE_SSL_CA_PATH env vars.
 *
 * Production: sslmode=verify-full with AWS RDS CA bundle at /etc/ssl/certs/rds-ca-bundle.pem
 * Local dev:  sslmode=disable or sslmode=require (no CA verification needed)
 *
 * Supported modes:
 *   disable      - SSL off entirely
 *   prefer       - treated as require (Node pg has no "try SSL then fallback" - it's on or off)
 *   require      - SSL on, no certificate verification (rejectUnauthorized=false)
 *   no-verify    - alias for require (SSL on, no verification)
 *   verify-ca    - SSL on, verify server cert against CA, skip hostname match
 *   verify-full  - SSL on, verify server cert against CA + hostname must match cert SAN/CN
 *
 * IP-host guard: verify-full and verify-ca reject IP-literal hostnames at startup because
 * RDS certificates contain DNS SANs, not IP SANs. Connecting via IP would cause a TLS
 * handshake failure at runtime - we fail fast with a clear error instead.
 *
 * Diagnostic logging: opt-in via DB_SSL_DIAGNOSTIC=1 env var. When enabled, logs
 * hostname, resolved SSL mode, and whether CA is configured. No secrets are logged.
 */

import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import type { PoolConfig } from "pg";

/** Default path where the RDS CA bundle is baked into container images. */
const DEFAULT_RDS_CA_PATH = "/etc/ssl/certs/rds-ca-bundle.pem";

/**
 * Supported sslmode values matching PostgreSQL libpq semantics.
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export type PgSslMode =
	| "disable"
	| "prefer"
	| "require"
	| "no-verify"
	| "verify-ca"
	| "verify-full";

export interface PgSslConfig {
	/** SSL mode matching PostgreSQL sslmode parameter. */
	readonly mode: PgSslMode;
	/** Path to CA certificate file. Required for verify-ca and verify-full. */
	readonly caPath?: string | undefined;
	/**
	 * Database hostname for IP-host guard validation.
	 * Required for verify-full and verify-ca to reject IP-literal connections.
	 * If omitted, the IP guard is skipped (caller is responsible).
	 */
	readonly hostname?: string | undefined;
}

/**
 * Validate that a hostname is not an IP literal.
 *
 * RDS certificates use DNS SANs (e.g., *.rds.amazonaws.com), not IP SANs.
 * Connecting via IP address with verify-full or verify-ca would cause a TLS
 * handshake failure. We fail fast with a clear error instead of letting the
 * connection attempt fail with a cryptic OpenSSL error.
 */
function assertNotIpHost(hostname: string, mode: PgSslMode): void {
	if (isIP(hostname) !== 0) {
		throw new Error(
			`[db-ssl] sslmode=${mode} requires a DNS hostname, not an IP address. ` +
				`Got "${hostname}". RDS certificates contain DNS SANs, not IP SANs. ` +
				`Use the RDS endpoint hostname (e.g., mydb.xxxx.us-east-1.rds.amazonaws.com).`,
		);
	}
}

/**
 * Read the CA bundle from disk. Fails fast if the file is missing - we never
 * silently fall back to unverified connections.
 */
function readCaBundle(resolvedCaPath: string, mode: PgSslMode): string {
	try {
		return readFileSync(resolvedCaPath, "utf-8");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(
			`[db-ssl] sslmode=${mode} requires CA bundle at ${resolvedCaPath} but file could not be read: ${message}. ` +
				`Ensure the RDS CA bundle is present in the container image or set DATABASE_SSL_CA_PATH.`,
		);
	}
}

/**
 * Resolve SSL configuration for a pg Pool from a sslmode string and optional CA path.
 *
 * - `disable`:     SSL off
 * - `prefer`:      treated as require - Node pg does not support "try SSL then fallback",
 *                  so prefer is functionally identical to require. SSL on, no cert verification.
 * - `require`:     SSL on, no certificate verification (rejectUnauthorized=false)
 * - `no-verify`:   alias for require (SSL on, no verification)
 * - `verify-ca`:   SSL on, verify server certificate against CA, skip hostname match.
 *                  Implements a checkServerIdentity override that accepts any hostname,
 *                  matching libpq verify-ca semantics (CA trust only, no SAN/CN check).
 * - `verify-full`: SSL on, verify server certificate against CA + hostname match.
 *                  Uses Node's default checkServerIdentity (hostname must match cert SAN/CN).
 *
 * For verify-ca and verify-full, the CA bundle is read synchronously at startup.
 * This is intentional - fail fast if the CA file is missing rather than accepting
 * unverified connections.
 */
export function resolvePgSsl(config: PgSslConfig): PoolConfig["ssl"] {
	const { mode, caPath, hostname } = config;

	if (mode === "disable") {
		return false;
	}

	// prefer is treated as require in Node pg - there is no "try SSL then fallback" behavior.
	// no-verify is an explicit alias for require (SSL on, no cert verification).
	if (mode === "prefer" || mode === "require" || mode === "no-verify") {
		return { rejectUnauthorized: false };
	}

	if (mode === "verify-ca" || mode === "verify-full") {
		// IP-host guard: reject IP-literal hostnames for cert-verifying modes
		if (hostname) {
			assertNotIpHost(hostname, mode);
		}

		const resolvedCaPath = caPath ?? process.env["DATABASE_SSL_CA_PATH"] ?? DEFAULT_RDS_CA_PATH;
		const ca = readCaBundle(resolvedCaPath, mode);

		if (mode === "verify-ca") {
			// verify-ca: validate the server certificate against the CA chain but do NOT
			// check that the hostname matches the certificate's SAN/CN entries.
			// This matches libpq verify-ca semantics.
			return {
				rejectUnauthorized: true,
				ca,
				checkServerIdentity: () => undefined,
			};
		}

		// verify-full: validate CA chain AND hostname match (Node's default behavior).
		return {
			rejectUnauthorized: true,
			ca,
		};
	}

	// Unsupported mode - fail closed. Do not silently degrade to a weaker mode.
	throw new Error(
		`[db-ssl] unsupported sslmode="${mode}". ` +
			`Supported values: disable, prefer, require, no-verify, verify-ca, verify-full.`,
	);
}

/**
 * Log a one-time SSL diagnostic at startup. Safe for production - no secrets, no credentials.
 * Only logs: hostname, resolved SSL mode, whether CA is configured.
 *
 * Opt-in: only emits output when DB_SSL_DIAGNOSTIC=1 is set in the environment.
 * This avoids log noise in prod while remaining available for deployment debugging.
 */
function logSslDiagnostic(hostname: string, mode: PgSslMode, caConfigured: boolean): void {
	if (process.env["DB_SSL_DIAGNOSTIC"] !== "1") {
		return;
	}
	console.log(`[db-ssl] host=${hostname} sslmode=${mode} ca_configured=${caConfigured}`);
}

/**
 * Parse a PostgreSQL connection URL and extract SSL configuration.
 *
 * Reads `sslmode` and `sslrootcert` from the URL query parameters, removes them
 * (pg library doesn't parse them), and returns a PoolConfig with the correct SSL settings.
 *
 * This replaces the duplicated `parsePostgresUrl` functions across auth-service,
 * vault-service, and storage-service.
 */
export function parsePostgresUrl(url: string): PoolConfig {
	const parsedUrl = new URL(url);
	const sslmode = (parsedUrl.searchParams.get("sslmode") ?? "prefer") as PgSslMode;
	const sslrootcert = parsedUrl.searchParams.get("sslrootcert") ?? undefined;

	// Remove SSL params from URL - pg library doesn't parse them
	parsedUrl.searchParams.delete("sslmode");
	parsedUrl.searchParams.delete("sslrootcert");

	const ssl = resolvePgSsl({ mode: sslmode, caPath: sslrootcert, hostname: parsedUrl.hostname });
	const caConfigured =
		typeof ssl === "object" && ssl !== null && "ca" in ssl && typeof ssl.ca === "string";

	logSslDiagnostic(parsedUrl.hostname, sslmode, caConfigured);

	return {
		connectionString: parsedUrl.toString(),
		ssl,
	};
}

/**
 * Build SSL config from environment variables (for services using *_DATABASE_SSL pattern).
 *
 * Reads:
 * - sslMode: the DATABASE_SSL env var value
 * - caPath: optional DATABASE_SSL_CA_PATH override (defaults to /etc/ssl/certs/rds-ca-bundle.pem)
 * - dbHost: optional hostname for diagnostic logging and IP-host guard (no credentials - safe for prod logs)
 */
export function resolvePgSslFromEnv(
	sslMode: string,
	caPath?: string,
	dbHost?: string,
): PoolConfig["ssl"] {
	const mode = normalizeSslMode(sslMode);
	const ssl = resolvePgSsl({ mode, caPath, hostname: dbHost });
	const caConfigured =
		typeof ssl === "object" && ssl !== null && "ca" in ssl && typeof ssl.ca === "string";

	logSslDiagnostic(dbHost ?? "env-var-pattern", mode, caConfigured);

	return ssl;
}

/**
 * Normalize various SSL mode strings to our canonical PgSslMode type.
 * Throws on unrecognized values - fail closed, do not silently degrade.
 */
function normalizeSslMode(raw: string): PgSslMode {
	const lower = raw.toLowerCase().trim();
	if (lower === "disable" || lower === "off" || lower === "false" || lower === "0") {
		return "disable";
	}
	if (lower === "prefer") {
		return "prefer";
	}
	if (lower === "require") {
		return "require";
	}
	if (lower === "no-verify") {
		return "no-verify";
	}
	if (lower === "verify-ca") {
		return "verify-ca";
	}
	if (lower === "verify-full") {
		return "verify-full";
	}
	throw new Error(
		`[db-ssl] unsupported sslmode="${raw}". ` +
			`Supported values: disable, off, false, 0, prefer, require, no-verify, verify-ca, verify-full.`,
	);
}
