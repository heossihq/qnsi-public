"""Digital signatures via liboqs-python - ML-DSA, SLH-DSA, Falcon.

Three classes share an identical surface (keygen, sign, verify) so callers
can swap algorithm families without rewriting code. Each is a thin wrapper
around liboqs-python's ``Signature`` for the relevant scheme.

Example::

    from qnsi.crypto import MlDsa

    sig = MlDsa("ML-DSA-65")
    pk, sk = sig.keygen()
    signature = sig.sign(b"hello", sk)
    assert sig.verify(b"hello", signature, pk)
"""

from __future__ import annotations

from dataclasses import dataclass

from qnsi.crypto._registry import resolve_signature_candidates
from qnsi.crypto.kem import _import_oqs


@dataclass(frozen=True)
class SigKeyPair:
    """Signature keypair."""

    public_key: bytes
    secret_key: bytes


class _BaseSignature:
    """Shared internals for ML-DSA / SLH-DSA / Falcon wrappers."""

    def __init__(self, algorithm: str) -> None:
        candidates = resolve_signature_candidates(algorithm)
        oqs = _import_oqs()
        last_error: Exception | None = None
        chosen: str | None = None
        sig = None
        for candidate in candidates:
            try:
                sig = oqs.Signature(candidate)
                chosen = candidate
                break
            except Exception as exc:
                last_error = exc
                continue
        if sig is None or chosen is None:
            raise RuntimeError(
                f"liboqs build does not expose signature '{algorithm}'. "
                f"Tried: {candidates}. Last error: {last_error}"
            )

        details = sig.details if hasattr(sig, "details") else {}
        self._algorithm = algorithm
        self._liboqs_name = chosen
        self._sig = sig
        self._public_key_bytes = int(details.get("length_public_key", 0))
        self._secret_key_bytes = int(details.get("length_secret_key", 0))
        self._signature_max_bytes = int(details.get("length_signature", 0))

    # ── properties ────────────────────────────────────────────────────────

    @property
    def algorithm(self) -> str:
        return self._algorithm

    @property
    def liboqs_name(self) -> str:
        return self._liboqs_name

    @property
    def public_key_bytes(self) -> int:
        return self._public_key_bytes

    @property
    def secret_key_bytes(self) -> int:
        return self._secret_key_bytes

    @property
    def signature_max_bytes(self) -> int:
        """Maximum signature length per FIPS spec - actual signatures may
        be shorter for variable-length schemes (Falcon)."""
        return self._signature_max_bytes

    # ── operations ────────────────────────────────────────────────────────

    def keygen(self) -> SigKeyPair:
        public_key = bytes(self._sig.generate_keypair())
        secret_key = bytes(self._sig.export_secret_key())
        return SigKeyPair(public_key=public_key, secret_key=secret_key)

    def sign(self, message: bytes, secret_key: bytes) -> bytes:
        if not isinstance(message, (bytes, bytearray)):
            raise TypeError("message must be bytes")
        if not isinstance(secret_key, (bytes, bytearray)):
            raise TypeError("secret_key must be bytes")
        oqs = _import_oqs()
        with oqs.Signature(self._liboqs_name, bytes(secret_key)) as bound:
            return bytes(bound.sign(bytes(message)))

    def verify(self, message: bytes, signature: bytes, public_key: bytes) -> bool:
        if not isinstance(message, (bytes, bytearray)):
            raise TypeError("message must be bytes")
        if not isinstance(signature, (bytes, bytearray)):
            raise TypeError("signature must be bytes")
        if not isinstance(public_key, (bytes, bytearray)):
            raise TypeError("public_key must be bytes")
        return bool(self._sig.verify(bytes(message), bytes(signature), bytes(public_key)))

    # ── lifecycle ─────────────────────────────────────────────────────────

    def close(self) -> None:
        if self._sig is not None:
            try:
                self._sig.free()
            except Exception:
                pass
            self._sig = None  # type: ignore[assignment]

    def __enter__(self):
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def __del__(self) -> None:  # pragma: no cover
        self.close()


class MlDsa(_BaseSignature):
    """ML-DSA (FIPS 204) - module-lattice digital signature.

    Args:
        algorithm: ``"ML-DSA-44"`` (NIST cat 2), ``"ML-DSA-65"`` (cat 3,
            recommended default), or ``"ML-DSA-87"`` (cat 5).
    """


class SlhDsa(_BaseSignature):
    """SLH-DSA (FIPS 205) - stateless hash-based digital signature.

    Conservative choice for regulated workloads - security argument is
    different from lattice-based schemes (relies only on hash-function
    security). Slower than ML-DSA but produces compact public keys.

    Args:
        algorithm: e.g. ``"SLH-DSA-SHA2-128f"`` (fast variant, NIST cat 1)
            or ``"SLH-DSA-SHA2-256f"`` (fast, cat 5). See
            ``qnsp.crypto.SUPPORTED_SIGNATURES`` for the full list.
    """


class Falcon(_BaseSignature):
    """Falcon (NIST PQC selection) - compact lattice-based signature.

    Smaller signatures than ML-DSA at equivalent security; slower keygen.

    Args:
        algorithm: ``"Falcon-512"`` (NIST cat 1) or ``"Falcon-1024"``
            (cat 5).
    """
