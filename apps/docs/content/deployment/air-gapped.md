---
title: Air-Gapped Deployment
version: 0.1.0
description: Deploy QNSI in isolated networks and transfer signed discovery evidence from disconnected estates.
last_updated: 2026-07-20
copyright: © 2025 HEOSSI. All rights reserved.
source_files:
  - /apps/qnsp-agent/src/scan-checkpoint.ts
  - /apps/qnsp-agent/src/offline-bundle.ts
  - /apps/qnsp-agent/src/spool.ts
  - /apps/crypto-inventory-service/src/routes/offline-agent-bundles.ts
---
# Air-Gapped Deployment

Deploy QNSI in isolated networks without internet access.

## Overview

Air-gapped deployment is intended for:

- Classified environments
- Regulatory requirements
- Maximum security

## Requirements

### Pre-requisites
- All container images pre-loaded
- Offline license file
- HSM with local connectivity
- Internal certificate authority

### Image distribution
```bash
# Export images from a connected build environment
docker save -o images.tar <image1> <image2>

# Import on the air-gapped system
docker load -i images.tar
```

## Installation

### Deployment bundle
Air-gapped Kubernetes deployment artifacts (charts/manifests) are not shipped in this repo.

Contact support for the supported air-gapped deployment bundle and installation procedure.

### Configuration
Configuration examples below are illustrative and depend on your deployment bundle.
```yaml
# values-airgap.yaml
global:
  airgapped: true
  imageRegistry: registry.internal

license:
  type: offline
  file: /etc/qnsi/license.key

updates:
  enabled: false
  
telemetry:
  enabled: false
```

## Offline discovery evidence transfer

Restricted estates that prohibit outbound connectivity can run the host scan locally and move only signed findings across the boundary. Source files and the agent secret are never written into the transfer bundle.

Register the agent through the tenant's Crypto Posture agent page, provision its one-time secret inside the restricted environment, and run:

```bash
qnsp-agent export /secure-transfer/qnsi-scan
```

The scanner checkpoints its deterministic filesystem cursor, resumes after interruption, and writes bounded `*.qnsi-scan.json` evidence bundles with restrictive filesystem permissions. Each bundle contains findings metadata, a SHA-256 payload digest, the tenant and agent identities, and an HMAC-SHA256 signature derived from the registered agent secret.

On a connected transfer host, no agent secret is required. Set only the API endpoint and import either a bundle or the complete directory:

```bash
export QNSI_ENDPOINT=https://api.qnsi.heossi.com
qnsp-agent import /secure-transfer/qnsi-scan
```

The service rejects tenant or agent mismatches, disabled or revoked agents, altered payloads, invalid signatures, and conflicting bundle-ID reuse. Accepted bundles are durably recorded with their payload hash, signature, source agent, linked report ID, bundle creation time, and import time before entering the same inventory discovery path as online agent evidence.

This evidence-transfer workflow is not a substitute for the separately contracted air-gapped QNSI platform deployment bundle described above.

## Licensing

Air-gapped deployments typically require additional licensing and a supported deployment bundle.

## Updates

Updates delivered via:
- Secure media transfer
- Manual image import
- Staged rollout

## Add-on required

Air-gapped add-ons are deployment-specific.
