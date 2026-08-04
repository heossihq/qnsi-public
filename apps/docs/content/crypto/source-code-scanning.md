---
title: Source-Code Cryptography Scanning
description: Find classical, post-quantum, and hybrid cryptography usage without uploading source code.
last_updated: 2026-07-20
source_files:
  - /packages/qnsi/src/code-scan/
  - /packages/qnsi/src/cli/commands/crypto-scan.ts
  - /apps/crypto-inventory-service/src/routes/code-scan-reports.ts
  - /apps/crypto-inventory-service/src/connectors/code-repo-connector.ts
---

# Source-Code Cryptography Scanning

`qnsi crypto scan` finds cryptographic usage in a repository before that usage becomes a
runtime blind spot. The scanner runs locally, reads files without executing them, and reports
classical, post-quantum, and hybrid primitives with file, rule, confidence, and line-hash
evidence.

Source code does not leave your environment. A local scan emits results only to stdout or a
file. With `--upload`, QNSI receives normalized findings and repository metadata-not file
contents or matched source lines.

## Install and run locally

Install the published QNSI SDK/CLI:

```bash
pnpm add -g @heossihq/qnsi@0.6.0
qnsi crypto scan ./ --format table
```

Supported output formats:

```bash
# Machine-readable findings
qnsi crypto scan ./ --format json --output qnsi-crypto-findings.json

# Local CBOM projection; no QNSI account or network connection required
qnsi crypto scan ./ --format cbom --output qnsi-code.cbom.json

# Exclude additional generated/vendor directories and cap very large scans
qnsi crypto scan ./ --exclude fixtures,generated --max-findings 5000
```

The scanner skips common dependency, build, VCS, binary, and test-fixture paths by default.
If the finding cap is reached, the result is explicitly marked `truncated`; do not treat a
truncated scan as complete evidence.

## What it detects

The rule set recognizes cryptographic APIs and configuration for:

- classical public-key cryptography such as RSA, DSA, ECDSA, ECDH, and DH;
- deprecated hashes and ciphers such as MD5, SHA-1, DES/3DES, and RC4;
- symmetric encryption and hashing primitives;
- NIST PQC families including ML-KEM, ML-DSA, and SLH-DSA;
- hybrid classical-plus-PQC constructions.

Findings are evidence for review, not an automatic proof of vulnerability. Confidence and
context fields help distinguish a real key-generation path from a named algorithm in
configuration or documentation.

## Upload findings to Crypto Inventory

An administrator first creates a scoped scanner identity in **Cloud Portal → Crypto Posture →
Agents**. The secret is shown once. Configure the CLI without placing the secret in source
control:

```bash
export QNSI_EDGE_GATEWAY_URL=https://api.qnsi.heossi.com
export QNSI_TENANT_ID=<tenant-id>
export QNSI_AGENT_ID=<scanner-agent-id>
export QNSI_AGENT_SECRET=<one-time-scanner-secret>

qnsi crypto scan ./ \
  --upload \
  --repo-id payments-api \
  --repo-name example/payments-api \
  --ref main \
  --commit "$(git rev-parse HEAD)"
```

`--repo-id` is a stable deduplication key. Keep it unchanged across rescans of the same
repository.

The CLI authenticates the exact request body with the scanner credential. QNSI validates the
signature, persists the accepted report in a durable inbox, and returns `202 Accepted` with a
body hash. Rotate or revoke the scanner identity from the Agents page if the credential is
exposed.

## Move findings into the CBOM

An accepted upload is intentionally separate from discovery processing:

1. Open **Cloud Portal → Crypto Posture → Source Code**.
2. Start a discovery run for the `code_repo` source.
3. Wait for the run to reach `completed`.
4. Review assets with source `code_repo` and type `code_usage`.
5. Export or inspect the updated CBOM and PQC-readiness posture.

This boundary provides durable acknowledgement before processing, repeatable discovery, and
an auditable link from scanner report to inventory asset. Repository rescans update the stable
source identity instead of creating an unrelated asset for every run.

## CI example

Use a dedicated scanner identity per CI environment, inject its secret from the CI secret
store, and keep uploads tied to an immutable commit:

```bash
qnsi crypto scan ./ \
  --upload \
  --repo-id payments-api \
  --repo-name example/payments-api \
  --ref "$CI_COMMIT_REF_NAME" \
  --commit "$CI_COMMIT_SHA" \
  --format json \
  --output qnsi-crypto-findings.json
```

Archive the local output as a CI artifact when your evidence policy requires independent
retention. Never echo `QNSI_AGENT_SECRET` or pass it as a literal command-line value in shared
runner logs.

## Limits and interpretation

- The scanner is static and parse-only; it does not execute the repository.
- Dynamic algorithm names, generated code, binaries, and runtime-only configuration may need
  host, TLS, cloud, or active-probe discovery as well.
- Local scanning is available without upload. Hosted ingestion and retained inventory are
  governed by the tenant's code-scan quota and entitlements.
- A completed discovery run is required before uploaded findings are represented as current
  posture evidence.

See [Cryptographic Bill of Materials](../security/cbom) for the combined inventory and
[Governed Migration Execution](../migration/governed-execution) for moving confirmed findings
through controlled remediation.
