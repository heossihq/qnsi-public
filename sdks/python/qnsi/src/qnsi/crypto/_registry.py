"""Algorithm name registry - display names ↔ liboqs identifiers.

liboqs-python 0.16.0.1 accepts the FIPS-canonical names for ML-KEM / ML-DSA and
loads whatever liboqs C library is available on the host. liboqs 0.16.0 exposes
SLH-DSA under underscore-uppercase identifiers such as
``SLH_DSA_PURE_SHA2_128F`` and HQC under ``HQC-1`` / ``HQC-3`` / ``HQC-5``;
this module hides those runtime names from callers.

Mirrors the TypeScript `packages/cryptography/src/providers/liboqs.ts`
mapping so the two SDKs accept identical algorithm strings.
"""

from __future__ import annotations

# Public name → list of liboqs candidate names (try in order, first match wins).
KEM_ALGORITHMS: dict[str, tuple[str, ...]] = {
    # FIPS 203 - ML-KEM
    "ML-KEM-512": ("ML-KEM-512", "Kyber512"),
    "ML-KEM-768": ("ML-KEM-768", "Kyber768"),
    "ML-KEM-1024": ("ML-KEM-1024", "Kyber1024"),
    # NIST round 4 + others (KEMs only)
    "HQC-128": ("HQC-1", "HQC-128"),
    "HQC-192": ("HQC-3", "HQC-192"),
    "HQC-256": ("HQC-5", "HQC-256"),
    "BIKE-L1": ("BIKE-L1",),
    "BIKE-L3": ("BIKE-L3",),
    "BIKE-L5": ("BIKE-L5",),
    "FrodoKEM-640-AES": ("FrodoKEM-640-AES",),
    "FrodoKEM-640-SHAKE": ("FrodoKEM-640-SHAKE",),
    "FrodoKEM-976-AES": ("FrodoKEM-976-AES",),
    "FrodoKEM-976-SHAKE": ("FrodoKEM-976-SHAKE",),
    "FrodoKEM-1344-AES": ("FrodoKEM-1344-AES",),
    "FrodoKEM-1344-SHAKE": ("FrodoKEM-1344-SHAKE",),
    "Classic-McEliece-348864": ("Classic-McEliece-348864",),
    "Classic-McEliece-460896": ("Classic-McEliece-460896",),
    "Classic-McEliece-6688128": ("Classic-McEliece-6688128",),
}

SIGNATURE_ALGORITHMS: dict[str, tuple[str, ...]] = {
    # FIPS 204 - ML-DSA
    "ML-DSA-44": ("ML-DSA-44", "Dilithium2"),
    "ML-DSA-65": ("ML-DSA-65", "Dilithium3"),
    "ML-DSA-87": ("ML-DSA-87", "Dilithium5"),
    # FIPS 205 - SLH-DSA. liboqs 0.16.0 ships these under the underscore-
    # uppercase internal identifiers. Older builds may still expose SPHINCS+.
    "SLH-DSA-SHA2-128f": (
        "SLH_DSA_PURE_SHA2_128F",
        "SPHINCS+-SHA2-128f-simple",
    ),
    "SLH-DSA-SHA2-128s": (
        "SLH_DSA_PURE_SHA2_128S",
        "SPHINCS+-SHA2-128s-simple",
    ),
    "SLH-DSA-SHA2-192f": (
        "SLH_DSA_PURE_SHA2_192F",
        "SPHINCS+-SHA2-192f-simple",
    ),
    "SLH-DSA-SHA2-192s": (
        "SLH_DSA_PURE_SHA2_192S",
        "SPHINCS+-SHA2-192s-simple",
    ),
    "SLH-DSA-SHA2-256f": (
        "SLH_DSA_PURE_SHA2_256F",
        "SPHINCS+-SHA2-256f-simple",
    ),
    "SLH-DSA-SHA2-256s": (
        "SLH_DSA_PURE_SHA2_256S",
        "SPHINCS+-SHA2-256s-simple",
    ),
    "SLH-DSA-SHAKE-128f": (
        "SLH_DSA_PURE_SHAKE_128F",
        "SPHINCS+-SHAKE-128f-simple",
    ),
    "SLH-DSA-SHAKE-128s": (
        "SLH_DSA_PURE_SHAKE_128S",
        "SPHINCS+-SHAKE-128s-simple",
    ),
    "SLH-DSA-SHAKE-192f": (
        "SLH_DSA_PURE_SHAKE_192F",
        "SPHINCS+-SHAKE-192f-simple",
    ),
    "SLH-DSA-SHAKE-192s": (
        "SLH_DSA_PURE_SHAKE_192S",
        "SPHINCS+-SHAKE-192s-simple",
    ),
    "SLH-DSA-SHAKE-256f": (
        "SLH_DSA_PURE_SHAKE_256F",
        "SPHINCS+-SHAKE-256f-simple",
    ),
    "SLH-DSA-SHAKE-256s": (
        "SLH_DSA_PURE_SHAKE_256S",
        "SPHINCS+-SHAKE-256s-simple",
    ),
    # Falcon (NIST PQC selection)
    "Falcon-512": ("Falcon-512",),
    "Falcon-1024": ("Falcon-1024",),
    # NIST additional signatures round 2 (subset)
    "MAYO-1": ("MAYO-1",),
    "MAYO-3": ("MAYO-3",),
    "MAYO-5": ("MAYO-5",),
    "CROSS-RSDP-128-balanced": ("CROSS-RSDP-128-balanced",),
    "CROSS-RSDP-256-balanced": ("CROSS-RSDP-256-balanced",),
}

SUPPORTED_KEMS: frozenset[str] = frozenset(KEM_ALGORITHMS.keys())
SUPPORTED_SIGNATURES: frozenset[str] = frozenset(SIGNATURE_ALGORITHMS.keys())


def is_supported_kem(algorithm: str) -> bool:
    """Return ``True`` if ``algorithm`` is a public KEM name."""
    return algorithm in SUPPORTED_KEMS


def is_supported_signature(algorithm: str) -> bool:
    """Return ``True`` if ``algorithm`` is a public signature name."""
    return algorithm in SUPPORTED_SIGNATURES


def resolve_kem_candidates(algorithm: str) -> tuple[str, ...]:
    """Return the liboqs candidate names for a KEM algorithm.

    Raises ``ValueError`` if the public name is not registered.
    """
    candidates = KEM_ALGORITHMS.get(algorithm)
    if not candidates:
        raise ValueError(
            f"Unknown KEM algorithm '{algorithm}'. Supported: {sorted(SUPPORTED_KEMS)[:5]}…"
        )
    return candidates


def resolve_signature_candidates(algorithm: str) -> tuple[str, ...]:
    """Return the liboqs candidate names for a signature algorithm.

    Raises ``ValueError`` if the public name is not registered.
    """
    candidates = SIGNATURE_ALGORITHMS.get(algorithm)
    if not candidates:
        raise ValueError(
            f"Unknown signature algorithm '{algorithm}'. Supported: "
            f"{sorted(SUPPORTED_SIGNATURES)[:5]}…"
        )
    return candidates
