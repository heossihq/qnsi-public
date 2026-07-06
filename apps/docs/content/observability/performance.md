---
title: Performance Monitoring
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Performance Monitoring

Monitor and optimize QNSI performance.

## Performance targets

> The figures below are **target service-level objectives (SLOs)**, not measured
> production telemetry. Live latency and throughput are observed per deployment via
> the observability stack (OTEL collector + per-service metrics); query those for
> actual values. Published, reproducible cryptographic benchmarks (ML-KEM/ML-DSA
> operation timings) are at `https://qnsi.heossi.com/benchmarks`.

### Latency (target SLO)
| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| Auth | 50ms | 100ms | 200ms |
| KMS encrypt | 20ms | 50ms | 100ms |
| KMS decrypt | 20ms | 50ms | 100ms |
| Vault read | 30ms | 80ms | 150ms |
| Storage GET | 50ms | 150ms | 300ms |

### Throughput
| Service | Requests/sec |
|---------|--------------|
| Edge gateway | 10,000+ |
| Auth service | 5,000+ |
| KMS service | 2,000+ |
| Vault service | 3,000+ |

## Performance metrics

### Request latency
```
histogram_quantile(0.99, 
  rate(qnsi_request_duration_seconds_bucket[5m])
)
```

### Error rate
```
rate(qnsi_errors_total[5m]) / 
rate(qnsi_requests_total[5m])
```

### Saturation
```
qnsi_active_connections / 
qnsi_max_connections
```

## Performance dashboards

Pre-built Grafana dashboards:
- Service overview
- Request latency
- Error analysis
- Resource utilization

## Performance optimization

### Client-side
- Connection pooling
- Request batching
- Caching responses
- Compression

### Configuration
- Adjust timeouts
- Tune connection limits
- Enable keep-alive

## Benchmarking

Run performance tests:
```bash
qnsi benchmark \
  --operation encrypt \
  --concurrency 10 \
  --duration 60s
```
