---
title: SIEM Integrations
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# SIEM Integrations

Integrate QNSI audit logs with Security Information and Event Management systems.

## Supported SIEMs

| SIEM | Integration method | Format |
|------|-------------------|--------|
| Splunk | HTTP Event Collector | JSON |
| Elastic | Logstash/Beats | JSON |
| QRadar | Syslog/LEEF | LEEF |
| Sentinel | Azure Event Hub | JSON |
| Sumo Logic | HTTP Source | JSON |
| Datadog | HTTP API | JSON |

## Splunk integration

SIEM integrations are deployment-specific.

### Splunk field mapping
```
| rename actor.email as user
| rename resource.id as object_id
| rename eventType as action
```

## Elastic integration

### Logstash config
```ruby
input {
  http {
    port => 8080
    codec => json
  }
}

filter {
  date {
    match => ["timestamp", "ISO8601"]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "qnsi-audit-%{+YYYY.MM.dd}"
  }
}
```

## QRadar integration

Syslog forwarding is deployment-specific.

## Real-time streaming

Real-time streaming is deployment-specific.
