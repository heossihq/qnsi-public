//! Local PQC primitives via the `oqs` crate (0.11).
//!
//! Available only with the `crypto` feature enabled. The algorithm-name
//! surface mirrors `@heossi/qnsi` (TypeScript), `qnsi.crypto`
//! (Python), and `qnsi/crypto` (Go), so an algorithm string that works
//! in one SDK works everywhere.

use oqs::{kem, sig};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("qnsi/crypto: unknown algorithm {0}")]
    UnknownAlgorithm(String),

    #[error("qnsi/crypto: liboqs error: {0}")]
    LibOqs(String),
}

impl From<oqs::Error> for CryptoError {
    fn from(value: oqs::Error) -> Self {
        CryptoError::LibOqs(value.to_string())
    }
}

/// Resolves a canonical QNSI KEM name to a `oqs::kem::Algorithm`.
pub fn kem_algorithm(name: &str) -> Result<kem::Algorithm, CryptoError> {
    use kem::Algorithm::*;
    Ok(match name {
        "ML-KEM-512" => MlKem512,
        "ML-KEM-768" => MlKem768,
        "ML-KEM-1024" => MlKem1024,
        "Kyber512" => Kyber512,
        "Kyber768" => Kyber768,
        "Kyber1024" => Kyber1024,
        // HQC omitted — disabled upstream (liboqs OQS_ENABLE_KEM_HQC=OFF; CVE-2025-48946).
        "BIKE-L1" => BikeL1,
        "BIKE-L3" => BikeL3,
        "BIKE-L5" => BikeL5,
        "FrodoKEM-640-AES" => FrodoKem640Aes,
        "FrodoKEM-640-SHAKE" => FrodoKem640Shake,
        "FrodoKEM-976-AES" => FrodoKem976Aes,
        "FrodoKEM-976-SHAKE" => FrodoKem976Shake,
        "FrodoKEM-1344-AES" => FrodoKem1344Aes,
        "FrodoKEM-1344-SHAKE" => FrodoKem1344Shake,
        "sntrup761" => NtruPrimeSntrup761,
        "Classic-McEliece-348864" => ClassicMcEliece348864,
        "Classic-McEliece-348864f" => ClassicMcEliece348864f,
        "Classic-McEliece-460896" => ClassicMcEliece460896,
        "Classic-McEliece-460896f" => ClassicMcEliece460896f,
        "Classic-McEliece-6688128" => ClassicMcEliece6688128,
        "Classic-McEliece-6688128f" => ClassicMcEliece6688128f,
        "Classic-McEliece-6960119" => ClassicMcEliece6960119,
        "Classic-McEliece-6960119f" => ClassicMcEliece6960119f,
        "Classic-McEliece-8192128" => ClassicMcEliece8192128,
        "Classic-McEliece-8192128f" => ClassicMcEliece8192128f,
        other => return Err(CryptoError::UnknownAlgorithm(other.to_string())),
    })
}

/// Resolves a canonical QNSI signature name to a `oqs::sig::Algorithm`.
///
/// SLH-DSA names map to the FIPS-205 names (`SphincsSha2*`, `SphincsShake*`)
/// in oqs 0.11.
pub fn sig_algorithm(name: &str) -> Result<sig::Algorithm, CryptoError> {
    use sig::Algorithm::*;
    Ok(match name {
        "ML-DSA-44" => MlDsa44,
        "ML-DSA-65" => MlDsa65,
        "ML-DSA-87" => MlDsa87,
        "Dilithium2" => Dilithium2,
        "Dilithium3" => Dilithium3,
        "Dilithium5" => Dilithium5,
        "Falcon-512" => Falcon512,
        "Falcon-1024" => Falcon1024,

        "SLH-DSA-SHA2-128f" => SphincsSha2128fSimple,
        "SLH-DSA-SHA2-128s" => SphincsSha2128sSimple,
        "SLH-DSA-SHA2-192f" => SphincsSha2192fSimple,
        "SLH-DSA-SHA2-192s" => SphincsSha2192sSimple,
        "SLH-DSA-SHA2-256f" => SphincsSha2256fSimple,
        "SLH-DSA-SHA2-256s" => SphincsSha2256sSimple,

        "SLH-DSA-SHAKE-128f" => SphincsShake128fSimple,
        "SLH-DSA-SHAKE-128s" => SphincsShake128sSimple,
        "SLH-DSA-SHAKE-192f" => SphincsShake192fSimple,
        "SLH-DSA-SHAKE-192s" => SphincsShake192sSimple,
        "SLH-DSA-SHAKE-256f" => SphincsShake256fSimple,
        "SLH-DSA-SHAKE-256s" => SphincsShake256sSimple,

        "MAYO-1" => Mayo1,
        "MAYO-2" => Mayo2,
        "MAYO-3" => Mayo3,
        "MAYO-5" => Mayo5,

        "cross-rsdp-128-balanced" => CrossRsdp128Balanced,
        "cross-rsdp-128-fast" => CrossRsdp128Fast,
        "cross-rsdp-128-small" => CrossRsdp128Small,
        "cross-rsdp-192-balanced" => CrossRsdp192Balanced,
        "cross-rsdp-192-fast" => CrossRsdp192Fast,
        "cross-rsdp-192-small" => CrossRsdp192Small,
        "cross-rsdp-256-balanced" => CrossRsdp256Balanced,
        "cross-rsdp-256-fast" => CrossRsdp256Fast,
        "cross-rsdp-256-small" => CrossRsdp256Small,
        "cross-rsdpg-128-balanced" => CrossRsdpg128Balanced,
        "cross-rsdpg-128-fast" => CrossRsdpg128Fast,
        "cross-rsdpg-128-small" => CrossRsdpg128Small,
        "cross-rsdpg-192-balanced" => CrossRsdpg192Balanced,
        "cross-rsdpg-192-fast" => CrossRsdpg192Fast,
        "cross-rsdpg-192-small" => CrossRsdpg192Small,
        "cross-rsdpg-256-balanced" => CrossRsdpg256Balanced,
        "cross-rsdpg-256-fast" => CrossRsdpg256Fast,
        "cross-rsdpg-256-small" => CrossRsdpg256Small,

        other => return Err(CryptoError::UnknownAlgorithm(other.to_string())),
    })
}

/// Convenience round-trip: KEM keygen + encapsulate + decapsulate.
///
/// Returns `(public_key, secret_key, ciphertext, shared_secret)` where
/// `decapsulate(secret_key, ciphertext) == shared_secret`. Mostly useful
/// for tests; production code should call the underlying `oqs::kem::Kem`
/// directly when the keypair lifecycle matters.
pub fn kem_round_trip(name: &str) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>, Vec<u8>), CryptoError> {
    let alg = kem_algorithm(name)?;
    oqs::init();
    let kem = kem::Kem::new(alg)?;
    let (pk, sk) = kem.keypair()?;
    let (ct, ss) = kem.encapsulate(&pk)?;
    let ss2 = kem.decapsulate(&sk, &ct)?;
    let ss_bytes = ss.into_vec();
    let ss2_bytes = ss2.into_vec();
    if ss_bytes != ss2_bytes {
        return Err(CryptoError::LibOqs("KEM round-trip produced mismatched shared secrets".into()));
    }
    Ok((pk.into_vec(), sk.into_vec(), ct.into_vec(), ss_bytes))
}

/// Convenience round-trip: signature keygen + sign + verify.
pub fn sig_round_trip(name: &str, message: &[u8]) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>), CryptoError> {
    let alg = sig_algorithm(name)?;
    oqs::init();
    let s = sig::Sig::new(alg)?;
    let (pk, sk) = s.keypair()?;
    let signature = s.sign(message, &sk)?;
    s.verify(message, &signature, &pk)?;
    Ok((pk.into_vec(), sk.into_vec(), signature.into_vec()))
}
