# Cryptographic Bill of Materials (CBOM)

The Cryptographic Bill of Materials (CBOM) is a machine-verifiable inventory of all cryptographic components, algorithms, and key materials used across the QNSI platform.

## What is CBOM?

CBOM extends the concept of Software Bill of Materials (SBOM) to cryptographic assets. It provides:

- **Complete Inventory** - All cryptographic algorithms, keys, and certificates
- **Lifecycle Tracking** - NIST status and deprecation dates for each algorithm
- **Compliance Assessment** - Automated checks against CNSA 2.0 and FIPS 140-3
- **Tamper Evidence** - SHA3-256 document hash and optional PQC signature
- **Machine Readable** - JSON format for automated processing

## CBOM Specification

QNSI CBOM follows the `QNSI-CBOM-1.0` specification.

### Document Structure

```json
{
  "specVersion": "QNSI-CBOM-1.0",
  "version": "1.0.0",
  "generatedAt": "2025-12-31T06:30:00.000Z",
  "generatedBy": "QNSI CBOM Service",
  "documentHash": "sha3-256:abc123...",
  "platform": {
    "name": "QNSI",
    "version": "1.0.0",
    "environment": "production"
  },
  "components": [...],
  "services": [...],
  "keyMaterials": [...],
  "tlsConfig": {...},
  "compliance": [...],
  "signature": {...}
}
```

### Components

Each cryptographic component includes:

```json
{
  "id": "algorithm:kyber-768",
  "name": "ML-KEM-768",
  "type": "algorithm",
  "algorithm": "kyber-768",
  "nistStatus": "NIST_FINAL",
  "securityLevel": 3,
  "usage": ["kem"],
  "metadata": {
    "nistStandard": "FIPS 203"
  }
}
```

### Service Postures

Each service's cryptographic posture:

```json
{
  "serviceName": "auth-service",
  "version": "1.0.0",
  "pqcProvider": "liboqs",
  "pqcProviderVersion": "0.15.0",
  "algorithms": ["dilithium-2", "kyber-768"]
}
```

### Key Materials

Key material inventory (without sensitive data):

```json
{
  "keyId": "jwt-signing-key-001",
  "algorithm": "dilithium-2",
  "purpose": "signing",
  "origin": "hsm",
  "createdAt": "2025-01-01T00:00:00Z",
  "expiresAt": "2026-01-01T00:00:00Z",
  "isQuantumResistant": true,
  "provenance": {
    "source": "AWS CloudHSM",
    "hsmProtected": true
  }
}
```

### TLS Configuration

```json
{
  "minVersion": "TLS 1.3",
  "cipherSuites": [
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256"
  ],
  "pqcEnabled": true,
  "hybridMode": true
}
```

### Compliance Status

```json
{
  "framework": "CNSA 2.0",
  "status": "compliant",
  "checkedAt": "2025-12-31T06:30:00Z",
  "findings": []
}
```

## Compliance Frameworks

### CNSA 2.0 (NSA Commercial National Security Algorithm Suite)

Checks include:
- PQC-TLS enabled
- No deprecated algorithms in use
- All key materials quantum-resistant

### FIPS 140-3

Checks include:
- NIST-approved algorithms only
- TLS 1.3 minimum version
- Proper key management

## API Usage

### Generate CBOM

```bash
curl -X GET https://api.qnsi.heossi.com/platform/v1/crypto/cbom \
  -H "Authorization: Bearer $TOKEN"
```

### Download CBOM File

```bash
curl -X GET https://api.qnsi.heossi.com/platform/v1/crypto/cbom/download \
  -H "Authorization: Bearer $TOKEN" \
  -o qnsi-cbom-2025-12-31.json
```

### Get Compliance Summary

```bash
curl -X GET https://api.qnsi.heossi.com/platform/v1/crypto/compliance \
  -H "Authorization: Bearer $TOKEN"
```

## Signing and Verification

CBOM documents can be signed with PQC signatures for tamper evidence.

### Signed CBOM Structure

```json
{
  "...cbom fields...",
  "signature": {
    "algorithm": "dilithium-2",
    "provider": "liboqs",
    "value": "base64url-encoded-signature",
    "publicKey": "base64-encoded-public-key",
    "signedAt": "2025-12-31T06:30:00Z",
    "keyId": "cbom-signing-key-001"
  }
}
```

### Verification

To verify a signed CBOM:

1. Extract the signature from the document
2. Remove the signature field from the document
3. Verify the signature against the remaining document using the public key

## Use Cases

### Compliance Reporting

Export CBOM for regulatory compliance documentation:

```bash
curl -X GET https://api.qnsi.heossi.com/platform/v1/crypto/cbom/download \
  -H "Authorization: Bearer $TOKEN" \
  -o "cbom-$(date +%Y-%m-%d).json"
```

### Vulnerability Assessment

Check for deprecated or vulnerable algorithms:

```bash
curl -X GET https://api.qnsi.heossi.com/platform/v1/crypto/compliance \
  -H "Authorization: Bearer $TOKEN" | jq '.compliance[].findings'
```

### Migration Planning

Identify classical algorithms that need migration:

```bash
curl -X GET https://api.qnsi.heossi.com/platform/v1/crypto/attestation \
  -H "Authorization: Bearer $TOKEN" | jq '.deprecatedAlgorithmsInUse'
```

## Best Practices

1. **Regular Export** - Export CBOM at least monthly for compliance records
2. **Automated Monitoring** - Set up alerts for compliance status changes
3. **Version Control** - Store CBOM exports in version control for audit trails
4. **Signature Verification** - Always verify CBOM signatures before trusting
5. **Remediation Tracking** - Track and remediate compliance findings promptly
