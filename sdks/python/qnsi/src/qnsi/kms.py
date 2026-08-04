"""KMS client - server-side PQC key management.

Mirrors the most-used methods of ``@heossihq/qnsi-kms-client`` from the TypeScript
SDK family. Routes verified against ``apps/kms-service/src/routes/keys.ts``:

  POST   /kms/v1/keys                 - createKey
  GET    /kms/v1/keys                 - listKeys
  GET    /kms/v1/keys/{keyId}         - getKey
  POST   /kms/v1/keys/{keyId}/wrap    - wrapKey
  POST   /kms/v1/keys/{keyId}/unwrap  - unwrapKey
  POST   /kms/v1/keys/{keyId}/sign    - signData
  POST   /kms/v1/keys/{keyId}/verify  - verifySignature
  POST   /kms/v1/keys/{keyId}/rotate  - rotateKey
  DELETE /kms/v1/keys/{keyId}         - deleteKey

Server-side keys are tenant-scoped, tier-gated, and (where supported)
backed by an HSM. For local in-process PQC primitives use ``qnsp.crypto``;
that module wraps liboqs-python directly with no server round-trip.
"""

from __future__ import annotations

import base64
import uuid
from typing import Any

from qnsi._service import _ServiceClient


class KmsClient(_ServiceClient):
    """Server-side KMS client.

    Methods accept bytes for any cryptographic input (data, signatures,
    public keys); the client base64-encodes them for the wire and the
    response decodes back where appropriate.
    """

    PATH_PREFIX = "/kms/v1"

    # ── lifecycle ─────────────────────────────────────────────────────────

    def create_key(
        self,
        *,
        algorithm: str,
        key_type: str = "data",
        key_id: str | None = None,
        purpose: str | None = None,
        tenant_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Create a new tenant-scoped key.

        Wire contract (``createKeySchema`` in ``apps/kms-service/src/routes/keys.ts``):
        ``{ tenantId, keyId(required, 1-255), keyType(root|master|data|byok),
        algorithm(default AES-256-GCM), metadata }``. tenantId is injected by the
        base client; ``keyId`` is generated when not supplied; ``keyType`` defaults
        to ``"data"`` (the value used for PQC signing keys).

        Args:
            algorithm: PQC algorithm name - e.g. ``"dilithium-3"`` (ML-DSA-65),
                ``"ml-kem-768"``, ``"falcon-512"``, ``"slh-dsa-sha2-128f"``.
            key_type: ``"data"`` (default), ``"root"``, ``"master"``, or ``"byok"``.
            key_id: Optional caller-supplied id; a uuid4 is generated otherwise.
            purpose: Optional hint (``"signing"`` / ``"encryption"`` / ``"kem"``).
                NOT a backend field - folded into ``metadata``, exactly as the npm,
                Rust, JVM and Go SDKs do. Python was the only SDK that omitted it,
                so cross-language sample code did not port.
        """
        merged_metadata: dict[str, Any] = {**(metadata or {})}
        if purpose:
            merged_metadata["purpose"] = purpose

        body: dict[str, Any] = {
            "keyId": key_id or str(uuid.uuid4()),
            "keyType": key_type,
            "algorithm": algorithm,
        }
        if tenant_id:
            body["tenantId"] = tenant_id
        if merged_metadata:
            body["metadata"] = merged_metadata
        return self._request("POST", "/keys", json=body, idempotency_key=idempotency_key)

    def list_keys(
        self,
        *,
        tenant_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/keys",
            query={"tenantId": tenant_id, "limit": limit, "cursor": cursor},
        )

    def get_key(self, key_id: str, *, tenant_id: str | None = None) -> dict[str, Any]:
        return self._request(
            "GET", f"/keys/{key_id}", query={"tenantId": tenant_id}
        )

    def rotate_key(
        self,
        key_id: str,
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST", f"/keys/{key_id}/rotate", idempotency_key=idempotency_key
        )

    def delete_key(self, key_id: str, *, tenant_id: str) -> None:
        self._request("DELETE", f"/keys/{key_id}", query={"tenantId": tenant_id})

    # ── crypto operations ────────────────────────────────────────────────

    def sign(
        self,
        key_id: str,
        data: bytes,
        *,
        idempotency_key: str | None = None,
    ) -> bytes:
        """Sign ``data`` with the named server-side key.

        Returns the signature as raw bytes. The wire payload uses base64.
        """
        if not isinstance(data, (bytes, bytearray)):
            raise TypeError("data must be bytes")
        # Wire contract: signDataSchema = { tenantId, data(base64), algorithm? };
        # response SignDataResponse = { keyId, signature(base64), algorithm, provider }.
        body = {"data": base64.b64encode(bytes(data)).decode()}
        result = self._request(
            "POST",
            f"/keys/{key_id}/sign",
            json=body,
            idempotency_key=idempotency_key,
        )
        sig_b64 = result.get("signature")
        if not isinstance(sig_b64, str):
            raise ValueError("KMS sign response missing 'signature'")
        return base64.b64decode(sig_b64)

    def verify(self, key_id: str, data: bytes, signature: bytes) -> bool:
        """Verify ``signature`` over ``data`` against the named server-side key."""
        if not isinstance(data, (bytes, bytearray)):
            raise TypeError("data must be bytes")
        if not isinstance(signature, (bytes, bytearray)):
            raise TypeError("signature must be bytes")
        # Wire contract: verifySignatureSchema = { tenantId, data(base64),
        # signature(base64), algorithm? }; response { keyId, valid, algorithm }.
        body = {
            "data": base64.b64encode(bytes(data)).decode(),
            "signature": base64.b64encode(bytes(signature)).decode(),
        }
        result = self._request("POST", f"/keys/{key_id}/verify", json=body)
        return bool(result.get("valid", False))

    def wrap(self, key_id: str, plaintext: bytes) -> bytes:
        """Wrap (encrypt) plaintext using the named server-side key.

        The server returns the wrapped blob - opaque to the caller. Pair
        with :meth:`unwrap` to recover the plaintext.
        """
        if not isinstance(plaintext, (bytes, bytearray)):
            raise TypeError("plaintext must be bytes")
        # Wire contract: wrapKeySchema = { tenantId, dataKey(base64), associatedData? };
        # response { keyId, wrappedKey(base64), algorithm, provider }.
        body = {"dataKey": base64.b64encode(bytes(plaintext)).decode()}
        result = self._request("POST", f"/keys/{key_id}/wrap", json=body)
        wrapped_b64 = result.get("wrappedKey") or result.get("ciphertextB64")
        if not isinstance(wrapped_b64, str):
            raise ValueError("KMS wrap response missing 'wrappedKey'")
        return base64.b64decode(wrapped_b64)

    def unwrap(self, key_id: str, wrapped: bytes) -> bytes:
        """Unwrap a previously-wrapped blob to recover the plaintext."""
        if not isinstance(wrapped, (bytes, bytearray)):
            raise TypeError("wrapped must be bytes")
        # Wire contract: unwrapKeySchema = { tenantId, wrappedKey(base64),
        # associatedData?, providerHint? }; response { dataKey(base64) }.
        body = {"wrappedKey": base64.b64encode(bytes(wrapped)).decode()}
        result = self._request("POST", f"/keys/{key_id}/unwrap", json=body)
        plain_b64 = result.get("dataKey") or result.get("plaintextB64")
        if not isinstance(plain_b64, str):
            raise ValueError("KMS unwrap response missing 'dataKey'")
        return base64.b64decode(plain_b64)
