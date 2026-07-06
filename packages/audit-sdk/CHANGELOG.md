# @heossi/qnsi-audit-sdk

## 0.3.4

### Patch Changes

- b4fdcc2: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 70dc524: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 1ac5429: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- df20f70: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 27b9194: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- dbee41f: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 3607257: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- c567906: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 1ad6813: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 54f677d: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- d311fc1: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 8b8c331: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- dbfd5fd: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- d588b14: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- e88fb5d: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- aaa11cc: docs: add GitHub and Google OAuth sign-up links and update platform sign-in references across all published SDKs; add OAuth/Social Sign-In section to @heossi/qnsi-auth-sdk; add README to @heossi/qnsi-agent
- Updated dependencies [1ac5429]
- Updated dependencies [1ac5429]
- Updated dependencies [59ec933]
- Updated dependencies [1ad6813]
- Updated dependencies [54f677d]
- Updated dependencies [d311fc1]
- Updated dependencies [8b8c331]
- Updated dependencies [dbfd5fd]
- Updated dependencies [e88fb5d]
- Updated dependencies [aaa11cc]
  - @heossi/qnsi-sdk-activation@0.1.3

## 0.3.0

### Minor Changes

- Enforce mandatory API key at SDK construction time (BREAKING)

  - All SDK clients (except @heossi/qnsi-browser) now require `apiKey` at
    construction time. Constructors throw a clear error with signup URL,
    free tier details, and documentation link if apiKey is missing or empty.
  - Removed runtime 401 no-apiKey checks — validation is now fail-fast at
    construction, not at request time.
  - Removed conditional `if (apiKey)` guards on Authorization headers —
    headers are always set since apiKey is guaranteed non-empty.
  - @heossi/qnsi-kms-client: `apiToken` parameter is now required in the string
    overload of `HttpKmsServiceClient` constructor.
  - @heossi/qnsi-browser: Added opt-in telemetry module (`configureTelemetry`,
    `recordTelemetryEvent`, `flushTelemetry`) for usage analytics without
    collecting PII or cryptographic material. No API key required (local-only
    PQC crypto).
  - Updated cloud portal SDK factory functions to always pass apiKey.
  - Updated crypto-inventory-service internal callers to always pass apiKey.
  - Updated all SDK documentation examples to include apiKey.
  - Updated developer hub quickstart code examples.

### Patch Changes

- ad6d0d4: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- b7599c7: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- be1dd80: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- Enterprise-grade SDK hardening across all API-calling SDKs:

  1. **Constructor validation**: Runtime guards for required API key/token with developer-friendly error messages
  2. **HTTPS enforcement**: All SDKs reject non-HTTPS baseUrl in production (HTTP allowed only for localhost in development/test)
  3. **Rate limiting with retry**: 429 handling with Retry-After header support, exponential backoff (2^attempt \* baseDelay, capped 30s), configurable maxRetries (default 3) and retryDelayMs (default 1000)
  4. **Error message sanitization**: HTTP error responses no longer leak server error body text; errors report status code and status text only
  5. **Input validation**: UUID validation via Zod for all tenant/resource ID parameters (storage-sdk, search-sdk, kms-client, ai-sdk)
  6. **Telemetry hooks**: OpenTelemetry-based observability with configurable OTLP export, request counters, failure counters, and duration histograms (auth-sdk, crypto-inventory-sdk, kms-client, ai-sdk, search-sdk)

- 7256284: SDK onboarding error messages and edge gateway universal auth enforcement

  - All 12 SDKs now return developer-friendly 401 error messages with signup URL
    (https://cloud.qnsi.heossi.com/signup) and documentation links when API key
    is missing and backend returns 401
  - Edge gateway service proxy now enforces authentication on ALL non-health,
    non-public proxy routes (previously only tenant-service and ai-orchestrator
    intelligence routes required auth)
  - Updated proxy enforcement E2E test to include auth header for entitlement
    enforcement test (correctly expects 403 after auth, not 401 before auth)

## 0.2.0

### Minor Changes

- Add tenant crypto policy integration and PQC algorithm utilities to all SDKs.

  ### @heossi/qnsi-tenant-sdk

  - Added crypto policy management APIs: `getTenantCryptoPolicy()`, `upsertTenantCryptoPolicy()`
  - Added algorithm query methods: `getAllowedKemAlgorithms()`, `getAllowedSignatureAlgorithms()`, `getDefaultKemAlgorithm()`, `getDefaultSignatureAlgorithm()`
  - Added `CRYPTO_POLICY_ALGORITHMS` tier configurations
  - Added `toNistAlgorithmName()` and `ALGORITHM_TO_NIST` utilities

  ### @heossi/qnsi-storage-sdk

  - Added `PqcMetadata` interface with `algorithmNist` field
  - `initiateUpload()` now returns NIST algorithm name
  - Added `toNistAlgorithmName()` utility

  ### @heossi/qnsi-auth-sdk

  - Added `PqcSignatureMetadata` interface
  - Added `toNistAlgorithmName()` and `ALGORITHM_TO_NIST` for signature algorithms

  ### @heossi/qnsi-vault-sdk

  - Enhanced `VaultSecretPqcMetadata` with `algorithmNist` field
  - Added `toNistAlgorithmName()` utility

  ### @heossi/qnsi-kms-client

  - Added `KmsPqcMetadata` interface
  - `wrapKey()` now returns `algorithmNist` field
  - Added `toNistAlgorithmName()` utility

  ### @heossi/qnsi-audit-sdk

  - Added `toNistAlgorithmName()` and `ALGORITHM_TO_NIST` for signature algorithms

  ### @heossi/qnsi-access-control-sdk

  - Added `toNistAlgorithmName()` and `ALGORITHM_TO_NIST` for signature algorithms

  ### Documentation

  - Updated all SDK documentation with crypto policy integration examples
  - Added algorithm naming conventions (internal vs NIST)

## 0.1.0

### Minor Changes

- 77d95ce: Initial public release of QNSP TypeScript SDK packages.

### Patch Changes

- 2fac7bd: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
