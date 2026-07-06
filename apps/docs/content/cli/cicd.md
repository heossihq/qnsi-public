---
title: CLI in CI/CD
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# CLI in CI/CD

Using QNSI CLI in CI/CD pipelines.

## GitHub Actions

```yaml
name: Deploy with QNSI

on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install QNSI CLI
        run: pnpm add -g @heossi/qnsi-cli
      
      - name: Configure QNSI
        env:
          QNSI_TENANT_ID: ${{ secrets.QNSI_TENANT_ID }}
          QNSI_SERVICE_ID: ${{ secrets.QNSI_SERVICE_ID }}
          QNSI_SERVICE_SECRET: ${{ secrets.QNSI_SERVICE_SECRET }}
        run: |
          # Optional: explicitly request a token (most commands will do this automatically)
          qnsi auth token --service-id $QNSI_SERVICE_ID --service-secret $QNSI_SERVICE_SECRET --output json
      
      - name: Fetch secrets
        run: |
          qnsi vault secrets get $QNSI_SECRET_ID --output json > db-password.json
```

## GitLab CI

```yaml
deploy:
  image: node:20
  before_script:
    - corepack enable && corepack prepare pnpm@10.25.0 --activate && pnpm add -g @heossi/qnsi-cli
  script:
    - qnsi vault secrets get $QNSI_SECRET_ID --output json > api-key.json
  variables:
    QNSI_TENANT_ID: $QNSI_TENANT_ID
```

## Jenkins

```groovy
pipeline {
    agent any
    environment {
        QNSI_TENANT_ID = credentials('qnsi-tenant-id')
        QNSI_SERVICE_ID = credentials('qnsi-service-id')
        QNSI_SERVICE_SECRET = credentials('qnsi-service-secret')
    }
    stages {
        stage('Setup') {
            steps {
                sh 'corepack enable && corepack prepare pnpm@10.25.0 --activate'
                sh 'pnpm add -g @heossi/qnsi-cli'
                sh 'qnsi auth token --service-id $QNSI_SERVICE_ID --service-secret $QNSI_SERVICE_SECRET --output json'
            }
        }
        stage('Deploy') {
            steps {
                sh 'qnsi vault secrets get $QNSI_SECRET_ID --output json > deploy-key.json'
            }
        }
    }
}
```

## CircleCI

```yaml
version: 2.1

jobs:
  deploy:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install QNSI CLI
          command: |
            corepack enable
            corepack prepare pnpm@10.25.0 --activate
            pnpm add -g @heossi/qnsi-cli
      - run:
          name: Fetch secrets
          command: |
            qnsi auth token --service-id $QNSI_SERVICE_ID --service-secret $QNSI_SERVICE_SECRET --output json
            qnsi vault secrets get $QNSI_SECRET_ID --output json
```
