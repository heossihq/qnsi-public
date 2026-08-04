# QNSI - Quantum-Native Security for VS Code

Bring [QNSI](https://qnsi.heossi.com) (Quantum-Native Security Infrastructure by HEOSSI) into your editor. Find quantum-vulnerable cryptography in your code, manage post-quantum keys and secrets, get inline algorithm guidance, and expose QNSI's tools to AI agents - all without leaving VS Code.

## Features

### 🔎 CBOM workspace scan - find quantum-vulnerable crypto
Scan your workspace for cryptographic usage (RSA, ECDSA, ECDH, DH, classical AES sizes, certificates, keys) and classify it against QNSI's crypto-inventory service. Quantum-vulnerable findings appear as editor diagnostics with an urgency and a recommended post-quantum replacement (e.g. *“RSA-2048 → ML-KEM-768”*), and roll up into a **Crypto Inventory (CBOM)** view. Export a CycloneDX CBOM at any time.

> The detector runs locally over your files; classification, urgency and the aggregated CBOM come from your QNSI tenant.

### 💡 Inline algorithm guidance
Hover any algorithm name (`kyber-768`, `dilithium-3`, `rsa-2048`, …) to see its NIST standardized name, FIPS status, and - for classical algorithms - the recommended post-quantum migration. Completions suggest the canonical PQC algorithm identifiers.

### 🔑 KMS & Vault
Browse, create, and rotate post-quantum **KMS keys**, and create/list **Vault secrets**, from a dedicated sidebar - backed by your QNSI tenant.

### ✅ Conformance status
A status-bar item shows your tenant's latest L0-L3 conformance posture at a glance.

### 🤖 MCP for AI agents
One command wires QNSI's [MCP server](https://www.npmjs.com/package/@heossihq/qnsi-mcp) into VS Code's agent mode, giving Copilot/agents 14 QNSI tools (generate PQC keys, scan crypto, query the vault, search encrypted documents, and more).

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

QNSI is a post-quantum cryptography platform: PQC key management, quantum-safe vault and storage, crypto policy enforcement, and cryptographic inventory (CBOM) - built on NIST-standardized algorithms (ML-KEM/FIPS 203, ML-DSA/FIPS 204, SLH-DSA/FIPS 205). Learn more at [qnsi.heossi.com](https://qnsi.heossi.com).

Licensed under Apache-2.0.
