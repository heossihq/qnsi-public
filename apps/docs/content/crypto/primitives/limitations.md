---
title: PQC Limitations
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# PQC Limitations

Known limitations and considerations for PQC primitives.

## Size overhead

PQC keys and signatures are larger than classical:

| Comparison | Classical | PQC | Increase |
|------------|-----------|-----|----------|
| Public key | 32 B (Ed25519) | 1952 B (Dilithium3) | 61x |
| Signature | 64 B (Ed25519) | 3293 B (Dilithium3) | 51x |
| KEM ciphertext | 32 B (X25519) | 1088 B (Kyber-768) | 34x |

## Performance overhead

PQC operations are slower:
- Signing: 2-4x slower than Ed25519
- Key exchange: 2-3x slower than X25519

## Implementation complexity

- Larger code size
- More complex constant-time implementations
- Floating-point concerns (Falcon)

## Standards maturity

- FIPS 203/204/205 finalized in 2024
- Implementations still maturing
- Interoperability testing ongoing

## Side-channel considerations

- Constant-time implementations required
- Cache timing attacks possible
- Power analysis on embedded devices

## Bandwidth impact

- Larger TLS handshakes
- Larger JWTs
- More storage for keys

## Mitigation strategies

### Size
- Compress where possible
- Use Falcon for size-critical applications
- Optimize storage and transmission

### Performance
- Hardware acceleration
- Batching operations
- Caching

### Complexity
- Use well-audited libraries (liboqs)
- Regular security updates
- Monitoring and alerting

## Not limitations

- Security: Well-analyzed, conservative parameters
- Standardization: NIST standards finalized
- Availability: Production-ready implementations exist
