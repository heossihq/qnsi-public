---
title: Changelog
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Changelog

This changelog captures major milestones and curated, high-signal changes.

## Origins

QNSI was conceived, architected, and engineered starting in **Dec 2020**.

## Codebase history

The current QNSI monorepo was bootstrapped in **Nov 2025** as part of an internal consolidation effort.
Earlier iterations of the platform existed in prior internal repositories and design documents.

## Notable changes

### 2025-12

- Docs: migrate docs hub to `apps/docs` and run a multi-batch onboarding accuracy audit
- Edge Gateway: harden public route handling and proxy behavior (signup/login flows, tenant lookup)
- Security: reduce sensitive auth logging and remove committed signing material
- Release engineering: introduce and refine Changesets-based package versioning

### 2025-11

- Bootstrap the monorepo and initial workspace structure
- Introduce automated versioning with Changesets
- Establish package naming and scope conventions (including the `@heossi/qnsi-*` namespace)

## Versioning

Changes follow semantic versioning:
- **Major**: Breaking changes
- **Minor**: New features
- **Patch**: Bug fixes

## Notifications

Subscribe to updates:
- Cloud status dashboard: https://qnsi.heossi.com#overview
