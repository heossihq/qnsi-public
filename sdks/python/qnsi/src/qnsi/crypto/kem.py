"""ML-KEM (FIPS 203) and other KEMs via liboqs-python.

The class is intentionally thin - three operations (keygen, encapsulate,
decapsulate) and three readable size attributes. Higher-level patterns
(envelope encryption, key wrapping) live in `qnsp.kms`.

Examples::

    from qnsi.crypto import MlKem

    # ML-KEM-768 (NIST security category 3 - recommended default)
    kem = MlKem("ML-KEM-768")
    pk, sk = kem.keygen()
    ciphertext, shared = kem.encapsulate(pk)
    recovered = kem.decapsulate(ciphertext, sk)
    assert recovered == shared

    # Sizes match FIPS 203 Table 3
    assert kem.public_key_bytes == 1184
    assert kem.ciphertext_bytes == 1088
    assert kem.shared_secret_bytes == 32
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from qnsi.crypto._registry import resolve_kem_candidates

if TYPE_CHECKING:  # pragma: no cover
    pass


@dataclass(frozen=True)
class KemKeyPair:
    """ML-KEM (or other KEM) keypair."""

    public_key: bytes
    secret_key: bytes


@dataclass(frozen=True)
class KemEncapsulation:
    """Output of a single encapsulate() call."""

    ciphertext: bytes
    shared_secret: bytes


_LIBOQS_INSTALL_HINT: Final = (
    "Install the QNSP local-crypto extra:\n"
    "  pip install 'qnsi[crypto]'\n\n"
    "This pulls in liboqs-python==0.12.0 which expects the liboqs C library "
    "to be available on your system. Easiest paths:\n"
    "  - macOS:    brew install liboqs\n"
    "  - Debian:   apt install liboqs-dev\n"
    "  - From src: https://github.com/open-quantum-safe/liboqs (cmake build)\n"
    "  - QNSP monorepo dev: tooling/liboqs-src/build/ already provides this."
)


def _import_oqs():
    try:
        import oqs  # type: ignore[import-not-found]
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "qnsp.crypto requires liboqs-python (the open-quantum-safe Python "
            "binding) but it is not installed.\n\n" + _LIBOQS_INSTALL_HINT
        ) from exc
    return oqs


class MlKem:
    """ML-KEM (FIPS 203) - module-lattice key encapsulation mechanism.

    Wraps liboqs-python's ``KeyEncapsulation`` so QNSP customers get a
    minimal, typed surface that mirrors the TypeScript ``MlKem`` class in
    ``@heossihq/qnsi-cryptography``.

    Args:
        algorithm: One of ``"ML-KEM-512"``, ``"ML-KEM-768"`` (default for
            most QNSP tiers - NIST security category 3), or
            ``"ML-KEM-1024"``. Other liboqs-supported KEMs (BIKE, FrodoKEM,
            Classic-McEliece) are also accepted; see
            ``qnsp.crypto.SUPPORTED_KEMS``.

    Raises:
        ModuleNotFoundError: liboqs-python isn't installed. Run
            ``pip install 'qnsi[crypto]'``.
        ValueError: ``algorithm`` is not a registered public name.
        RuntimeError: The installed liboqs build does not expose the
            requested algorithm (rare; means the liboqs binary on the
            system was compiled without that scheme). The error message
            lists the names tried.
    """

    def __init__(self, algorithm: str) -> None:
        candidates = resolve_kem_candidates(algorithm)
        oqs = _import_oqs()
        # Probe each candidate name until one is supported by the linked
        # liboqs build. liboqs.is_kem_enabled / liboqs.get_enabled_kem_mechanisms
        # may not exist on older bindings, so we try-and-construct.
        last_error: Exception | None = None
        chosen: str | None = None
        kem = None
        for candidate in candidates:
            try:
                kem = oqs.KeyEncapsulation(candidate)
                chosen = candidate
                break
            except Exception as exc:  # liboqs raises a generic Exception
                last_error = exc
                continue
        if kem is None or chosen is None:
            raise RuntimeError(
                f"liboqs build does not expose KEM '{algorithm}'. "
                f"Tried: {candidates}. Last error: {last_error}"
            )

        # Pull sizes from liboqs (`details`) so they always match the
        # underlying spec - no inline literals that drift from FIPS 203.
        details = kem.details if hasattr(kem, "details") else {}
        self._algorithm = algorithm
        self._liboqs_name = chosen
        self._kem = kem
        self._public_key_bytes = int(details.get("length_public_key", 0))
        self._secret_key_bytes = int(details.get("length_secret_key", 0))
        self._ciphertext_bytes = int(details.get("length_ciphertext", 0))
        self._shared_secret_bytes = int(details.get("length_shared_secret", 0))

    # ── properties ────────────────────────────────────────────────────────

    @property
    def algorithm(self) -> str:
        """The public algorithm name passed at construction."""
        return self._algorithm

    @property
    def liboqs_name(self) -> str:
        """The liboqs identifier actually in use (may differ from `algorithm`)."""
        return self._liboqs_name

    @property
    def public_key_bytes(self) -> int:
        return self._public_key_bytes

    @property
    def secret_key_bytes(self) -> int:
        return self._secret_key_bytes

    @property
    def ciphertext_bytes(self) -> int:
        return self._ciphertext_bytes

    @property
    def shared_secret_bytes(self) -> int:
        return self._shared_secret_bytes

    # ── operations ────────────────────────────────────────────────────────

    def keygen(self) -> KemKeyPair:
        """Generate a fresh ``(public_key, secret_key)`` pair."""
        public_key = bytes(self._kem.generate_keypair())
        # liboqs-python stores the secret key inside the KEM object after
        # generate_keypair(); export it explicitly so callers control its
        # lifecycle. ``export_secret_key`` is the binding's accessor.
        secret_key = bytes(self._kem.export_secret_key())
        return KemKeyPair(public_key=public_key, secret_key=secret_key)

    def encapsulate(self, public_key: bytes) -> KemEncapsulation:
        """Encapsulate a fresh shared secret to a recipient public key."""
        if not isinstance(public_key, (bytes, bytearray)):
            raise TypeError("public_key must be bytes")
        ciphertext, shared_secret = self._kem.encap_secret(bytes(public_key))
        return KemEncapsulation(
            ciphertext=bytes(ciphertext),
            shared_secret=bytes(shared_secret),
        )

    def decapsulate(self, ciphertext: bytes, secret_key: bytes) -> bytes:
        """Recover the shared secret from a ciphertext + recipient secret key.

        Note: liboqs-python binds the secret key into the KEM object created
        at construction. To decapsulate against an externally-supplied
        secret key we instantiate a fresh KEM bound to that key, then
        decapsulate, then dispose. This keeps the API stateless from the
        caller's perspective (mirrors the TypeScript surface).
        """
        if not isinstance(ciphertext, (bytes, bytearray)):
            raise TypeError("ciphertext must be bytes")
        if not isinstance(secret_key, (bytes, bytearray)):
            raise TypeError("secret_key must be bytes")
        oqs = _import_oqs()
        with oqs.KeyEncapsulation(self._liboqs_name, bytes(secret_key)) as bound:
            return bytes(bound.decap_secret(bytes(ciphertext)))

    # ── lifecycle ─────────────────────────────────────────────────────────

    def close(self) -> None:
        """Release the underlying liboqs context. Idempotent."""
        if self._kem is not None:
            try:
                self._kem.free()
            except Exception:
                pass
            self._kem = None  # type: ignore[assignment]

    def __enter__(self) -> MlKem:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def __del__(self) -> None:  # pragma: no cover
        self.close()
