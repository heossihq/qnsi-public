---
title: SPHINCS+ (SLH-DSA)
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# SPHINCS+ (SLH-DSA)

SPHINCS+ is a stateless hash-based signature scheme standardized as SLH-DSA.

## Overview

- **Type**: Digital Signature Algorithm
- **Standard**: FIPS 205 (SLH-DSA)
- **Security basis**: Hash functions only

## Key properties

- **Stateless**: No state to manage between signatures
- **Conservative**: Security relies only on hash functions
- **Large signatures**: Trade-off for simplicity

## Parameter sets

| Variant | Security | Public key | Signature |
|---------|----------|------------|-----------|
| SPHINCS+-128s | Level 1 | 32 bytes | 7856 bytes |
| SPHINCS+-128f | Level 1 | 32 bytes | 17088 bytes |
| SPHINCS+-256s | Level 5 | 64 bytes | 29792 bytes |
| SPHINCS+-256f | Level 5 | 64 bytes | 49856 bytes |

`s` = small (slower, smaller signatures)
`f` = fast (faster, larger signatures)

## QNSI usage

- **Use cases**: Long-term signatures, archival
- **Fallback**: When lattice assumptions are questioned

## Advantages

- Minimal cryptographic assumptions
- Well-understood security
- No complex mathematics

## Disadvantages

- Very large signatures
- Slower than lattice-based schemes

## When to use SPHINCS+

- Maximum conservatism required
- Long-term document signatures
- Regulatory requirements for hash-based
- Backup/fallback algorithm
