"""Local post-quantum cryptography primitives.

Wraps the open-quantum-safe `liboqs-python` 0.12.0 binding (installed via the
`qnsi[crypto]` extra) so QNSP customers get the full FIPS 203 / 204 / 205
algorithm surface — ML-KEM, ML-DSA, SLH-DSA, Falcon, plus the round-2 NIST
additional signatures (MAYO, CROSS, UOV, SNOVA) — without needing to
write `oqs` calls themselves.

The same liboqs C library that backs the TypeScript `@heossi/qnsi-cryptography`
package powers this module. Outputs are byte-identical between languages —
a Python keypair encapsulated by Python decapsulates correctly in TypeScript
on the other side, and vice versa.

Usage::

    from qnsi.crypto import MlKem, MlDsa

    kem = MlKem("ML-KEM-768")
    public_key, secret_key = kem.keygen()
    ciphertext, shared_secret = kem.encapsulate(public_key)
    recovered = kem.decapsulate(ciphertext, secret_key)
    assert recovered == shared_secret

    sig = MlDsa("ML-DSA-65")
    sig_pk, sig_sk = sig.keygen()
    signature = sig.sign(b"hello", sig_sk)
    assert sig.verify(b"hello", signature, sig_pk)

The classes are deliberately thin — they expose the four / five operations
NIST defines for each scheme. For higher-level patterns (envelope encryption,
signed audit records, key-rotation policies) see the `qnsp.vault`,
`qnsp.kms`, and `qnsp.audit` clients which call QNSP services with these
primitives behind the scenes.

If `liboqs-python` is not installed, importing any class from this module
raises a clear ``ModuleNotFoundError`` pointing at ``pip install
'qnsi[crypto]'``.
"""

from __future__ import annotations

from qnsi.crypto._registry import (
    SUPPORTED_KEMS,
    SUPPORTED_SIGNATURES,
    is_supported_kem,
    is_supported_signature,
)
from qnsi.crypto.kem import KemKeyPair, KemEncapsulation, MlKem
from qnsi.crypto.sig import Falcon, MlDsa, SigKeyPair, SlhDsa

__all__ = [
    "Falcon",
    "KemEncapsulation",
    "KemKeyPair",
    "MlDsa",
    "MlKem",
    "SigKeyPair",
    "SlhDsa",
    "SUPPORTED_KEMS",
    "SUPPORTED_SIGNATURES",
    "is_supported_kem",
    "is_supported_signature",
]
