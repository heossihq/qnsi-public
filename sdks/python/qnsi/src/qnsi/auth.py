"""QNSP Auth - JWT issuance, refresh, revocation, WebAuthn passkeys, MFA,
federated identity (SAML / OIDC), risk-based authentication."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class AuthClient(_ServiceClient):
    """Auth client. Wraps ``apps/auth-service`` (``/auth``)."""

    PATH_PREFIX = "/auth"

    def login(
        self,
        *,
        email: str,
        password: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        body = {"email": email, "password": password, "tenantId": tenant_id}
        return self._request("POST", "/login", json=body)

    def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        return self._request("POST", "/refresh", json={"refreshToken": refresh_token})

    def revoke(self, refresh_token: str) -> None:
        self._request("POST", "/revoke", json={"refreshToken": refresh_token})

    # ── WebAuthn passkeys ────────────────────────────────────────────

    def register_passkey_start(self, *, user_id: str, tenant_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            "/passkeys/register/start",
            json={"userId": user_id, "tenantId": tenant_id},
        )

    def register_passkey_complete(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/passkeys/register/complete", json=body)

    def authenticate_passkey_start(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/passkeys/authenticate/start", json=body)

    def authenticate_passkey_complete(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/passkeys/authenticate/complete", json=body)

    def list_passkeys(self, *, user_id: str, tenant_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            "/passkeys",
            query={"userId": user_id, "tenantId": tenant_id},
        )

    def delete_passkey(self, credential_id: str) -> None:
        self._request("DELETE", f"/passkeys/{credential_id}")

    # ── MFA ──────────────────────────────────────────────────────────

    def mfa_challenge(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/mfa/challenge", json=body)

    def mfa_verify(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/mfa/verify", json=body)

    # ── Federated identity ──────────────────────────────────────────

    def federate_saml(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/federate/saml", json=body)

    def federate_oidc(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/federate/oidc", json=body)

    # ── Risk-based auth ──────────────────────────────────────────────

    def evaluate_risk(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/risk/evaluate", json=body)

    def list_risk_policies(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", "/risk/policies", query={"tenantId": tenant_id})
