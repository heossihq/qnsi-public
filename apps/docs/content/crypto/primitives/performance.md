---
title: PQC Performance
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# PQC Performance

Performance characteristics of QNSI's PQC implementations.

## Benchmark environment

- CPU: Modern x86-64 with AVX2
- Implementation: liboqs with optimized backends

## Signature algorithms

| Algorithm | KeyGen | Sign | Verify |
|-----------|--------|------|--------|
| Ed25519 (classical) | 30 μs | 50 μs | 70 μs |
| Dilithium3 | 100 μs | 200 μs | 100 μs |
| Falcon-512 | 50 ms | 5 ms | 100 μs |
| SPHINCS+-128s | 5 ms | 100 ms | 5 ms |

## Key encapsulation

| Algorithm | KeyGen | Encaps | Decaps |
|-----------|--------|--------|--------|
| X25519 (classical) | 30 μs | 30 μs | 30 μs |
| Kyber-768 | 50 μs | 60 μs | 70 μs |

## Size comparison

| Algorithm | Public key | Secret key | Signature/Ciphertext |
|-----------|------------|------------|---------------------|
| Ed25519 | 32 B | 64 B | 64 B |
| Dilithium3 | 1952 B | 4032 B | 3293 B |
| Kyber-768 | 1184 B | 2400 B | 1088 B |

## Throughput

Typical operations per second (single core):

| Operation | Ops/sec |
|-----------|---------|
| Dilithium3 sign | 5,000 |
| Dilithium3 verify | 10,000 |
| Kyber-768 encaps | 15,000 |
| AES-256-GCM encrypt (1KB) | 500,000 |

## Optimization tips

- Batch verification when possible
- Cache public keys
- Use hardware acceleration (AVX2/AVX-512)
- Consider Falcon for verification-heavy workloads
