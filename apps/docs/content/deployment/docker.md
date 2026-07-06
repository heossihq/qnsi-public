---
title: Docker Deployment
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /docker-compose.yml
  - /apps/*/src/config/env.ts
---

# Docker Deployment

Run QNSI services with Docker for development and testing.

## Service Ports

From `apps/*/src/config/env.ts`:

| Service | Default Port |
|---------|-------------|
| edge-gateway | 8107 |
| auth-service | 8081 |
| platform-api | 8080 |
| vault-service | 8090 |
| storage-service | 8092 |
| kms-service | 8095 |
| audit-service | 8103 |
| observability-service | 8105 |
| crypto-inventory-service | 8115 |

## Docker Compose

```yaml
services:
  postgres:
    image: postgres:18
    container_name: qnsi-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: qnsi
      POSTGRES_PASSWORD: qnsi-password
    ports:
      - "5432:5432"
    volumes:
      - qnsi-postgres-data:/var/lib/postgresql
    networks:
      - qnsi-net

  redis:
    image: redis:7
    container_name: qnsi-redis
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    ports:
      - "6379:6379"
    volumes:
      - qnsi-redis-data:/data
    networks:
      - qnsi-net

  clamav:
    image: clamav/clamav:1.5.1
    container_name: qnsi-clamav
    platform: linux/amd64
    restart: unless-stopped
    ports:
      - "3310:3310"
    networks:
      - qnsi-net

volumes:
  qnsi-postgres-data:
    external: true
  qnsi-redis-data:
    external: true

networks:
  qnsi-net:
    external: true
```

## Running

```bash
# Start infra dependencies
docker compose up -d

# View logs
docker compose logs -f

# Stop infra dependencies
docker compose down
```

## Starting services

The docker compose file provides infra (Postgres, Redis, ClamAV). Start the Node services from the repo root:
```bash
node scripts/dev/start-backend-cluster.mjs
```

## Limitations

Docker deployment is for:
- Development
- Testing
- Demos

**Not for production use.**

Production requires:
- Kubernetes deployment
- HSM integration
- High availability
