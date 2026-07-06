/**
 * @heossi/qnsi-sdk-activation
 *
 * SDK activation and usage metering for QNSP platform SDKs.
 * Ensures all SDK usage is tied to a registered QNSP account.
 *
 * Browser-compatible — no node: imports.
 *
 * @module
 */

export {
	activateSdk,
	clearActivationCache,
	getActivationLimits,
	getCachedActivation,
	type SdkActivationConfig,
	SdkActivationError_,
} from "./activation-client.js";

export {
	type SdkActivationError,
	SdkActivationErrorSchema,
	type SdkActivationLimits,
	SdkActivationLimitsSchema,
	type SdkActivationRequest,
	SdkActivationRequestSchema,
	type SdkActivationResponse,
	SdkActivationResponseSchema,
	type SdkIdentifier,
	SdkIdentifierSchema,
} from "./types.js";
