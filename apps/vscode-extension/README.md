# QNSI for VS Code - Quantum-Native Security Infrastructure

The official editor companion for [QNSI](https://qnsi.heossi.com) - HEOSSI's
Quantum-Native Security Infrastructure: a platform of 18 backend services for
post-quantum key management, encrypted storage, access control, signed audit
evidence, and NIST ACVP conformance. The extension brings that platform into
your editor: find quantum-vulnerable cryptography in your code, manage
post-quantum keys and secrets, get inline algorithm guidance, and expose QNSI's
tools to AI agents - all without leaving VS Code.

## The platform behind the extension

Your QNSI tenant covers the full cryptographic surface, and the extension is
its editor window:

- **PQC algorithms**: ML-KEM, ML-DSA and SLH-DSA (FIPS 203/204/205), HQC
  diversity KEMs, BIKE, FrodoKEM, Classic McEliece, MAYO, CROSS, Falcon/FN-DSA,
  and the rest of the platform catalog - 90 implementations across 14
  algorithm families - plus governed migration for classical RSA, ECDSA, ECDH,
  DH and AES ([algorithm reference](https://qnsi.heossi.com/algorithms)).
- **Transport**: public native-only or hybrid PQC-TLS negotiation is **NOT VERIFIED**.
  PQC application operations do not establish end-to-end PQC transport.
- **Custody**: KMS with BYOHSM custody (AWS CloudHSM and other FIPS 140-3
  HSMs), rotation, and key grants; Vault secrets; encrypted storage.
- **Evidence**: L0-L3 conformance posture against pinned public NIST ACVP
  vectors, with live public evidence at
  [qnsi.heossi.com/verify/conformance](https://qnsi.heossi.com/verify/conformance).

## Features

Server operations use the QNSI edge gateway and require backend authorization and
entitlements. Local workspace analysis is separate from server operations.
Transport and production acceptance require independent evidence.

### Manifest operation browser (unreleased source)

**QNSI: Browse Manifest Operations** searches the shared catalog of 880 manifest
declarations across 15 services. It prompts for and encodes path parameters,
rejects dot segments, and requires confirmation before non-GET requests. The
existing API console displays the response. Requests have a bounded timeout and
reject redirects. Existing KMS, vault, workspace and MCP commands are preserved.

This is discovery and JSON API execution, not a typed UI for every workflow.
Backend payload schemas and authentication modes still apply. Live acceptance,
extension-host acceptance and marketplace publication are **NOT VERIFIED**.

### Cryptographic Bill of Materials (CBOM)
- Scan the workspace for quantum-vulnerable cryptography: RSA, ECDSA, ECDH, DH, DSA,
  classical AES sizes, certificates, and key files, with language-aware detection.
- Findings appear as editor diagnostics with urgency and a recommended post-quantum
  replacement (e.g. RSA-2048 to ML-KEM-768), and roll up into the Crypto Inventory view.
- Export a CycloneDX CBOM at any time; classification and aggregation come from your
  QNSI tenant's crypto-inventory service.

### KMS - post-quantum key management
- Create, list, refresh, rotate, and copy IDs of PQC keys across the platform catalog:
  ML-KEM, ML-DSA and SLH-DSA (FIPS 203/204/205), HQC, BIKE, FrodoKEM, Classic
  McEliece, MAYO, CROSS, and Falcon/FN-DSA across the full 90-algorithm catalog
  (27 KEMs and 63 signatures across 14 families).
- HSPK custody: seal ML-DSA private keys under your own FIPS 140-3 HSM (BYOHSM) and
  sign through the HSM-sealed flow.

### Vault - quantum-safe secrets
- Create, reveal, and refresh secrets stored under per-tenant envelope encryption
  (ML-KEM recipient envelopes; AES-256-GCM data keys established via PQC).

### Conformance posture
- Status-bar view of your tenant's L0-L3 conformance against pinned public NIST ACVP
  vectors - the same evidence published at qnsi.heossi.com/verify/conformance.

### Algorithm intelligence
- Hover any algorithm identifier (kyber-768, dilithium-3, rsa-2048, ...) for its NIST
  standardized name, FIPS status, and recommended PQC migration; completions suggest
  canonical PQC identifiers.

### Agent mode (Model Context Protocol)
- One-click MCP configuration exposes the QNSI tool surface to Kiro, Claude Desktop,
  VS Code, and other MCP clients: 28 tools covering KMS (generate/list/get/rotate,
  HSPK seal/sign), Vault (create/get/list), CBOM scan and crypto inventory/readiness,
  encrypted storage (buckets, objects put/get), encrypted search (indexes, SSE-X text
  query, vector query), the immutable audit trail (WORM ledger queries), access-control
  roles, billing entitlements and invoices, conformance stats, tenant info, billing
  status, and platform health.

### Platform surface
- The extension, SDKs, and MCP server are clients of the same 11-service platform
  (vault, KMS, audit, auth, tenant, access-control, billing, crypto-inventory,
  storage, search, AI) - feature availability follows your billing tier exactly as
  the cloud portal enforces it.


## Getting started

1. Install the extension.
2. Run **QNSI: Sign In (API Key)** from the Command Palette and paste your API key. No key? [Create a free account](https://cloud.qnsi.heossi.com/auth?mode=signup) - no credit card required.
3. Open the **QNSI** view in the activity bar, or run **QNSI: Scan Workspace for Quantum-Vulnerable Crypto**.

Your API key is stored in VS Code's encrypted [Secret Storage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage) - never in settings or files.

## Settings

| Setting | Default | Description |
|---|---|---|
| `qnsi.platformUrl` | `https://api.qnsi.heossi.com` | QNSI platform (edge gateway) base URL. |
| `qnsi.scanOnSave` | `false` | Re-scan a file for quantum-vulnerable crypto on save. |
| `qnsi.scan.include` / `qnsi.scan.exclude` | (source, cert & config globs) | What the workspace scan looks at. |
| `qnsi.scan.maxFiles` | `2000` | Cap on files per scan. |

## About

QNSI is a quantum-native security infrastructure platform: PQC key management, quantum-safe vault and storage, crypto policy enforcement, and cryptographic inventory (CBOM) - built on NIST-standardized algorithms (ML-KEM/FIPS 203, ML-DSA/FIPS 204, SLH-DSA/FIPS 205). Learn more at [qnsi.heossi.com](https://qnsi.heossi.com).

Licensed under Apache-2.0.
