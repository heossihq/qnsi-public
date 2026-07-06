---
title: Searchable Encryption
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/search-service/src/config/env.ts
  - /apps/storage-service/src/config/env.ts
---

# Searchable Encryption

QNSI supports searching encrypted data without decryption via Search Service (port 8101).

## Overview

Searchable Symmetric Encryption (SSE) enables:
- Encrypted storage
- Keyword search on ciphertext
- Privacy-preserving queries

## How it works

### Indexing
1. Extract searchable terms from document
2. Generate encrypted index tokens
3. Store tokens with encrypted document

### Searching
1. Client generates search token from query
2. Server matches tokens without decryption
3. Return matching encrypted documents

## Supported operations

| Operation | Description |
|-----------|-------------|
| Equality | Exact match |
| Prefix | Starts with |
| Range | Numeric ranges |
| Boolean | AND, OR, NOT |

## Index types

### Keyword index
- Individual terms
- Case-insensitive matching
- Stemming optional

### Structured index
- JSON field paths
- Nested object support
- Array element search

## Security properties

- **Forward secrecy**: New documents don't leak info about old queries
- **Backward secrecy**: Old documents don't leak info about new queries (with re-encryption)

## Trade-offs

| Aspect | Impact |
|--------|--------|
| Index size | ~10-20% overhead |
| Query latency | ~2-5x vs plaintext |
| Functionality | Subset of SQL |

## Configuration

Enable SSE per bucket:
```json
{
  "searchableEncryption": {
    "enabled": true,
    "indexFields": ["title", "tags", "metadata.*"]
  }
}
```
