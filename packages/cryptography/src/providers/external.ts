import { activateSdk } from "@heossihq/qnsi-sdk-activation";

import type { PqcAlgorithm, PqcProvider } from "../provider.js";

export interface ExternalPqcProviderMetadata {
	readonly name: string;
	readonly version?: string;
	readonly author?: string;
	readonly homepage?: string;
	readonly supportedAlgorithms: readonly PqcAlgorithm[];
}

/**
 * Activation parameters added in v0.2.0. External consumers must pass
 * `apiKey` - get a free key (no credit card, free-forever tier) at
 * https://cloud.qnsi.heossi.com/auth. See README "Migration from v0.1.x".
 *
 * QNSP backend services (inside the trust boundary, not external consumers)
 * may pass `internal: true` to bypass the activation handshake. This flag is
 * intentionally not advertised in the public marketing surface; setting it
 * outside a QNSP-operated service is a license violation.
 */
export interface ExternalPqcProviderInitOptions {
	/**
	 * QNSP API key. Required for external consumers since v0.2.0. Free signup:
	 * https://cloud.qnsi.heossi.com/auth (free-forever tier - 10 GB storage,
	 * 50,000 API calls/month, 20 KMS keys, 25 vault secrets, no credit card).
	 */
	readonly apiKey?: string;
	/**
	 * QNSP-internal callers ONLY. Set to `true` from inside QNSP-operated
	 * platform services (apps/*) to bypass the activation handshake. External
	 * consumers must use `apiKey`.
	 */
	readonly internal?: boolean;
	/** Override platform URL (defaults to https://api.qnsi.heossi.com). */
	readonly platformUrl?: string;
	readonly algorithms?: readonly PqcAlgorithm[];
	readonly configuration?: Record<string, unknown>;
	readonly logger?: (message: string) => void;
}

export interface ExternalPqcProviderFactory {
	readonly metadata: ExternalPqcProviderMetadata;
	readonly probe?: () => Promise<boolean>;
	readonly create: (options?: ExternalPqcProviderInitOptions) => Promise<PqcProvider>;
}

const externalFactories = new Map<string, ExternalPqcProviderFactory>();

export function registerExternalPqcProvider(factory: ExternalPqcProviderFactory): void {
	externalFactories.set(factory.metadata.name, factory);
}

export function unregisterExternalPqcProvider(name: string): void {
	externalFactories.delete(name);
}

export function listExternalPqcProviders(): ReadonlyArray<ExternalPqcProviderMetadata> {
	return Array.from(externalFactories.values(), (factory) => factory.metadata);
}

const SDK_PACKAGE_VERSION = "0.2.0";

/**
 * Initialize a registered PQC provider. Requires a QNSP API key - performs an
 * activation handshake with the QNSP billing-service to confirm the caller is
 * a registered tenant before returning a working provider.
 *
 * Why activation: QNSP offers a free-forever tier (no credit card, 60-second
 * GitHub/Google/email signup at https://cloud.qnsi.heossi.com/auth). Tying SDK
 * usage to a tenant is the price of using the QNSP-branded SDK; the underlying
 * `@noble/post-quantum` and `@open-quantum-safe/liboqs` libraries are
 * separately Apache-2.0 / MIT and free to use directly without QNSP.
 */
export async function initializeExternalPqcProvider(
	name: string,
	options?: ExternalPqcProviderInitOptions,
): Promise<PqcProvider> {
	const opts = options ?? {};
	const isInternal = opts.internal === true;
	const hasApiKey = typeof opts.apiKey === "string" && (opts.apiKey as string).trim().length > 0;

	if (!isInternal && !hasApiKey) {
		throw new Error(
			"@heossihq/qnsi-cryptography v0.2.0+ requires `options.apiKey`. " +
				"Get a free API key (no credit card, free-forever tier - 10 GB storage, " +
				"50,000 API calls/month, 20 KMS keys, 25 vault secrets) at " +
				"https://cloud.qnsi.heossi.com/auth. " +
				"See README 'Migration from v0.1.x' for details. " +
				"If you only need the underlying primitives without QNSP, use " +
				"@noble/post-quantum or @open-quantum-safe/liboqs directly.",
		);
	}

	const factory = externalFactories.get(name);

	if (!factory) {
		throw new Error(`External PQC provider '${name}' is not registered`);
	}

	if (factory.probe && !(await factory.probe())) {
		throw new Error(`External PQC provider '${name}' probe failed`);
	}

	// Activation handshake - validates the API key against billing-service,
	// returns tier limits, caches the activation token. Throws a typed
	// SdkActivationError if the key is invalid, the account is suspended, or
	// the platform is unreachable. Skipped when `internal === true` (QNSP
	// platform services inside the trust boundary).
	if (!isInternal && hasApiKey) {
		await activateSdk({
			apiKey: opts.apiKey as string,
			sdkId: "cryptography",
			sdkVersion: SDK_PACKAGE_VERSION,
			...(opts.platformUrl !== undefined ? { platformUrl: opts.platformUrl } : {}),
		});
	}

	return factory.create(options);
}
