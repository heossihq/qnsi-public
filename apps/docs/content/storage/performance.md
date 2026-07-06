---
title: Storage Performance
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Storage Performance

Performance characteristics of QNSI Storage.

## Throughput

### Upload
| Object size | Throughput |
|-------------|------------|
| < 1 MB | 100+ ops/sec |
| 1-10 MB | 50 ops/sec |
| 10-100 MB | 10 ops/sec |
| > 100 MB | Multipart recommended |

### Download
| Object size | Throughput |
|-------------|------------|
| < 1 MB | 200+ ops/sec |
| 1-10 MB | 100 ops/sec |
| > 10 MB | Streaming recommended |

## Latency

| Operation | P50 | P99 |
|-----------|-----|-----|
| PUT (small) | 50ms | 200ms |
| GET (small) | 20ms | 100ms |
| DELETE | 30ms | 150ms |
| LIST | 50ms | 300ms |

## Multipart uploads

For objects > 100 MB:
- Part size: 5-100 MB
- Parallel uploads: up to 10 parts
- Resume on failure

```
POST /storage/v1/multipart/initiate
PUT /storage/v1/multipart/{uploadId}/parts/{partNumber}
POST /storage/v1/multipart/{uploadId}/complete
```

## Optimization tips

### Uploads
- Use multipart for large objects
- Compress before encryption
- Batch small objects

### Downloads
- Use range requests for partial reads
- Enable client-side caching
- Prefetch predictable access

### Search
- Limit indexed fields
- Use specific queries
- Paginate results
