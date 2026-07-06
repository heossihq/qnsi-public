// Package qnsp is the official Go SDK for the QNSP Quantum-Native Security
// Platform.
//
// QNSP provides post-quantum cryptography (ML-KEM, ML-DSA, SLH-DSA, Falcon
// via liboqs), a PQC-encrypted vault, server-side KMS, and an immutable
// audit trail. This module mirrors the surface of the @heossi/qnsp-* TypeScript and
// `qnsp` Python SDK families: same wire contracts, same algorithm names,
// same FIPS 203/204/205 posture.
//
// # Quick start
//
//	import (
//	    "context"
//	    "os"
//
//	    "github.com/heossihq/qnsi-public/sdks/go/qnsi"
//	)
//
//	c, err := qnsp.NewClient(qnsp.ClientOptions{APIKey: os.Getenv("QNSP_API_KEY")})
//	if err != nil { return err }
//	defer c.Close()
//
//	ctx := context.Background()
//	secret, err := c.Vault().CreateSecret(ctx, vault.CreateSecretRequest{
//	    Name:       "openai-api-key",
//	    PayloadB64: base64.StdEncoding.EncodeToString([]byte("sk-...")),
//	    Algorithm:  "ml-kem-768",
//	})
//
// # Local PQC primitives
//
// The qnsp/crypto subpackage wraps liboqs-go so the algorithm-name surface
// matches the rest of the QNSP ecosystem (TypeScript, Python, Rust). It
// requires the liboqs C library at link time.
//
//	kem, _ := crypto.NewKem("ML-KEM-768")
//	defer kem.Close()
//	pk, sk, _ := kem.Keygen()
//	enc, _    := kem.Encapsulate(pk)
//	ss, _     := kem.Decapsulate(enc.Ciphertext, sk)
//	// ss == enc.SharedSecret
//
// Sign up for a free QNSP account at https://cloud.qnsi.heossi.com/auth.
package qnsp
