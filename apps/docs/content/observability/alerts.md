---
title: Alerts
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Alerts

Configure alerts for QNSI platform events.

> **Scope:** The YAML fragments below are **illustrative** patterns. They are not a guarantee that each rule is deployed in production. For cloud-portal bootstrap outages (`/api/session/bootstrap` 503), see `docs/operations/portal-bootstrap-observability.md` in the monorepo — **ai-orchestrator** auto-remediation and optional `ALERT_WEBHOOK_URL` are **not** wired to that path unless you add explicit alarms or integrations.

## Alert types

### Threshold alerts
Trigger when metric crosses threshold:
```yaml
- alert: HighErrorRate
  expr: rate(qnsi_errors_total[5m]) > 0.01
  for: 5m
  labels:
    severity: critical
```

### Anomaly alerts
Trigger on unusual patterns:
```yaml
- alert: UnusualTraffic
  expr: |
    qnsi_requests_total > 
    avg_over_time(qnsi_requests_total[7d]) * 2
```

### Availability alerts
Trigger on service unavailability:
```yaml
- alert: ServiceDown
  expr: up{job="qnsi"} == 0
  for: 1m
```

## Built-in alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| High error rate | >1% errors | critical |
| High latency | p99 > 1s | warning |
| Rate limit spike | >100/min | warning |
| Auth failures | >10/min | warning |
| Service unhealthy | health != ok | critical |

## Alert destinations

### Webhook
```json
{
  "type": "webhook",
  "url": "https://alerts.example.com/webhook",
  "headers": {"Authorization": "Bearer ..."}
}
```

### Email
```json
{
  "type": "email",
  "recipients": ["ops@example.com"]
}
```

### PagerDuty
```json
{
  "type": "pagerduty",
  "routingKey": "..."
}
```

### Slack
```json
{
  "type": "slack",
  "webhookUrl": "https://hooks.slack.com/..."
}
```

## Alert management

Alert management APIs are not shipped in this repo.

## PDP / edge enforcement (deployed alarms)

When `enable_pdp_service` and `enable_pdp_edge_enforcement_observability` are true, Terraform provisions CloudWatch alarms described in `docs/operations/pdp-edge-enforcement-observability.md` (PDP snapshot stale and materialization degraded via log metric filters on the PDP log group). Edge `edge_enforcement_degraded_privileged_denied_total` is on the **dashboard** (alarms cannot use `SEARCH` on that signal in CloudWatch). Wire SNS with `pdp_edge_enforcement_observability_alarm_sns_topic_arns` in `infra/terraform/variables.tf`.
