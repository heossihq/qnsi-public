/**
 * Inlined copy of @heossihq/qnsi-sdk-activation (workspace package, not published).
 * Bundled here so @heossihq/qnsi has no external @heossihq/qnsi-* dependencies.
 * Keep this folder in sync with packages/sdk-activation/src/ when changes
 * land upstream - both files are minimal (activation-client.ts +
 * types.ts) so a manual diff is tractable.
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
