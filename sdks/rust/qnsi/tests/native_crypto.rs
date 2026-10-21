#![cfg(feature = "crypto")]

use qnsi::crypto::{kem_algorithm, kem_round_trip, sig_algorithm, sig_round_trip};

#[test]
fn native_kem_round_trips_reject_tampered_ciphertext() {
    for name in ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"] {
        let (pk, sk, mut ciphertext, shared_secret) = kem_round_trip(name).unwrap();
        let kem = oqs::kem::Kem::new(kem_algorithm(name).unwrap()).unwrap();
        assert!(kem.public_key_from_bytes(&pk).is_some());
        let secret_key = kem.secret_key_from_bytes(&sk).unwrap();
        let recovered = kem
            .decapsulate(&secret_key, kem.ciphertext_from_bytes(&ciphertext).unwrap())
            .unwrap();
        assert_eq!(recovered.as_ref(), shared_secret);
        ciphertext[0] ^= 1;
        if let Ok(changed) =
            kem.decapsulate(&secret_key, kem.ciphertext_from_bytes(&ciphertext).unwrap())
        {
            assert_ne!(changed.as_ref(), shared_secret);
        }
        assert!(kem.ciphertext_from_bytes(&[]).is_none());
        assert!(kem.secret_key_from_bytes(&[]).is_none());
    }
    assert!(kem_round_trip("not-an-algorithm").is_err());
}

#[test]
fn native_signature_round_trips_reject_tampering() {
    for name in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"] {
        for message in [b"QNSI signature verification".as_slice(), b"".as_slice()] {
            let (pk, sk, mut signature) = sig_round_trip(name, message).unwrap();
            let sig = oqs::sig::Sig::new(sig_algorithm(name).unwrap()).unwrap();
            let public_key = sig.public_key_from_bytes(&pk).unwrap();
            assert!(sig.secret_key_from_bytes(&sk).is_some());
            sig.verify(
                message,
                sig.signature_from_bytes(&signature).unwrap(),
                &public_key,
            )
            .unwrap();
            assert!(sig
                .verify(
                    b"changed",
                    sig.signature_from_bytes(&signature).unwrap(),
                    &public_key
                )
                .is_err());
            signature[0] ^= 1;
            assert!(sig
                .verify(
                    message,
                    sig.signature_from_bytes(&signature).unwrap(),
                    &public_key
                )
                .is_err());
            assert!(sig.public_key_from_bytes(&[]).is_none());
            assert!(sig.secret_key_from_bytes(&[]).is_none());
        }
    }
    assert!(sig_round_trip("not-an-algorithm", b"message").is_err());
}
