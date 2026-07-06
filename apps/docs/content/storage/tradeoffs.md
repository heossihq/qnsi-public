---
title: Storage Trade-offs
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Storage Trade-offs

Understanding the trade-offs in encrypted storage.

## Encryption overhead

### Storage size
- ~1-5% overhead for encryption metadata
- ~10-20% for searchable encryption indexes

### Latency
- Encryption: ~1ms per MB
- Decryption: ~1ms per MB
- Key operations: ~5ms

## Searchable encryption trade-offs

### Functionality vs security
| Feature | Plaintext | SSE |
|---------|-----------|-----|
| Full-text search | ✓ | Limited |
| Regex | ✓ | ✗ |
| Fuzzy match | ✓ | Limited |
| Aggregations | ✓ | Limited |
| Joins | ✓ | ✗ |

### Security vs performance
| Security level | Query latency | Index size |
|----------------|---------------|------------|
| Basic SSE | 2x | 1.1x |
| Forward-secure | 3x | 1.2x |
| Fully oblivious | 10x | 2x |

## Client-side vs server-side encryption

| Aspect | CSE | SSE |
|--------|-----|-----|
| Key custody | Client | Server |
| Performance | Client CPU | Server CPU |
| Complexity | Higher | Lower |
| Zero-knowledge | Yes | No |

## Recommendations

### Use CSE when
- Maximum security required
- Regulatory key custody requirements
- Zero-trust model

### Use SSE when
- Simpler integration needed
- Server-side processing required
- Performance critical

### Use searchable encryption when
- Need to query encrypted data
- Can accept functionality limits
- Privacy outweighs convenience
