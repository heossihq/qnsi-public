/**
 * QNSP Auth — JWT issuance, refresh, revocation, WebAuthn passkeys, MFA,
 * federated identity (SAML / OIDC), risk-based authentication. Wraps
 * `apps/auth-service` (`/auth/v1`).
 */

import type { Internal } from "./_internal.js";

const PATH_PREFIX = "/proxy/auth/v1";

export interface LoginRequest {
	readonly email: string;
	readonly password: string;
	readonly tenantId: string;
}

export class AuthClient {
	constructor(private readonly internal: Internal) {}

	login(req: LoginRequest) {
		return this.internal.request("POST", `${PATH_PREFIX}/login`, req);
	}

	refreshToken(refreshToken: string) {
		return this.internal.request("POST", `${PATH_PREFIX}/refresh`, { refreshToken });
	}

	async revoke(refreshToken: string): Promise<void> {
		await this.internal.request("POST", `${PATH_PREFIX}/revoke`, { refreshToken });
	}

	// ── WebAuthn passkeys ────────────────────────────────────────────

	registerPasskeyStart(userId: string, tenantId: string) {
		return this.internal.request("POST", `${PATH_PREFIX}/passkeys/register/start`, {
			userId,
			tenantId,
		});
	}

	registerPasskeyComplete(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/passkeys/register/complete`, body);
	}

	authenticatePasskeyStart(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/passkeys/authenticate/start`, body);
	}

	authenticatePasskeyComplete(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/passkeys/authenticate/complete`, body);
	}

	listPasskeys(userId: string, tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/passkeys`, undefined, {
			query: { userId, tenantId },
		});
	}

	async deletePasskey(credentialId: string): Promise<void> {
		await this.internal.request("DELETE", `${PATH_PREFIX}/passkeys/${credentialId}`);
	}

	// ── MFA ──────────────────────────────────────────────────────────

	mfaChallenge(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/mfa/challenge`, body);
	}

	mfaVerify(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/mfa/verify`, body);
	}

	// ── Federated identity ──────────────────────────────────────────

	federateSAML(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/federate/saml`, body);
	}

	federateOIDC(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/federate/oidc`, body);
	}

	// ── Risk-based auth ──────────────────────────────────────────────

	evaluateRisk(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/risk/evaluate`, body);
	}

	listRiskPolicies(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/risk/policies`, undefined, {
			query: { tenantId },
		});
	}
}
