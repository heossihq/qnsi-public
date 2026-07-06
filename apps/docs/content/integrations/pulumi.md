---
title: Pulumi Provider
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Pulumi Provider

Manage QNSI resources with Pulumi.

The Pulumi provider is not shipped in this repo.

## Installation

Contact support for infrastructure-as-code options and supported providers.

## Configuration

```bash
pulumi config set qnsi:tenantId <tenant_uuid>
pulumi config set qnsi:serviceId <service-id>
pulumi config set --secret qnsi:serviceSecret <secret>
```

## Resources

Provider resources are deployment-bundle specific.

## Import

```bash
pulumi import qnsi:index:Key encryption-key key-uuid
```
