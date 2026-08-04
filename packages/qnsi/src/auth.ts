/**
 * QNSI Auth - JWT issuance, refresh, revocation, WebAuthn passkeys, MFA,
 * federated identity (SAML / OIDC), risk-based authentication. Wraps
 * `apps/auth-service` (routes are `/auth/*`, no `/v1` segment).
 */

import type { Internal } from "./_internal.js";

const PATH_PREFIX = "/proxy/auth";

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
		return this.internal.request("POST", `${PATH_PREFIX}/token/refresh`, { refreshToken });
	}

	async revoke(refreshToken: string): Promise<void> {
		await this.internal.request("POST", `${PATH_PREFIX}/token/revoke`, { refreshToken });
	}

	// ── WebAuthn passkeys ────────────────────────────────────────────

	registerPasskeyStart(userId: string, tenantId: string) {
		return this.internal.request("POST", `${PATH_PREFIX}/webauthn/register/start`, {
			userId,
			tenantId,
		});
	}

	registerPasskeyComplete(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/webauthn/register/complete`, body);
	}

	authenticatePasskeyStart(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/webauthn/authenticate/start`, body);
	}

	authenticatePasskeyComplete(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/webauthn/authenticate/complete`, body);
	}

	listPasskeys(userId: string, tenantId: string) {
		return this.internal.request(
			"GET",
			`${PATH_PREFIX}/webauthn/credentials/${userId}`,
			undefined,
			{
				query: { tenantId },
			},
		);
	}

	async deletePasskey(credentialId: string, userId: string): Promise<void> {
		await this.internal.request(
			"DELETE",
			`${PATH_PREFIX}/webauthn/credentials/${credentialId}`,
			undefined,
			{ query: { userId } },
		);
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
		return this.internal.request("POST", `${PATH_PREFIX}/federation/saml/assertion`, body);
	}

	federateOIDC(body: Record<string, unknown>) {
		return this.internal.request("POST", `${PATH_PREFIX}/federation/oidc/callback`, body);
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
