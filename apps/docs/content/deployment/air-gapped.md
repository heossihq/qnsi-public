---
title: Air-Gapped Deployment
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Air-Gapped Deployment

Deploy QNSI in isolated networks without internet access.

## Overview

Air-gapped deployment for:
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

## Licensing

Air-gapped deployments typically require additional licensing and a supported deployment bundle.

## Updates

Updates delivered via:
- Secure media transfer
- Manual image import
- Staged rollout

## Add-on required

Air-gapped add-ons are deployment-specific.
