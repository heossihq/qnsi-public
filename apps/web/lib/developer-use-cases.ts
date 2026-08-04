/**
 * Developer use-cases catalog - per-pattern build pages under
 * /developers/use-cases/[slug]. Audience: engineer / architect /
 * platform lead implementing on QNSI. Companion to
 * lib/solutions-catalog.ts (which targets buyers).
 *
 * Each entry powers:
 *   - One row on /developers/use-cases (catalog)
 *   - One programmatic page at /developers/use-cases/[slug]
 *   - One per-page OG via /developers/use-cases/[slug]/opengraph-image.tsx
 *   - TechArticle + HowTo JSON-LD on the detail page
 *
 * Pattern coverage decision: executable snippets are limited to source-linked SDK
 * calls. Architecture-only browser and service-authentication patterns carry empty
 * snippet sets and explicit NOT VERIFIED deployment boundaries.
 *
 * Code snippets reference SDK surfaces in packages/qnsi/src/* and sdks/python/qnsi.
 * Source presence is not independent production evidence.
 */

export interface DeveloperPatternCodeSnippet {
	readonly language: string;
	readonly label: string;
	readonly code: string;
}

export interface DeveloperPatternCapabilityLink {
	readonly capability: string;
	readonly path: string;
}

export interface DeveloperPatternSolutionLink {
	readonly slug: string;
	readonly label: string;
}

export interface DeveloperPattern {
	readonly slug: string;
	readonly name: string;
	readonly longName: string;
	readonly tagline: string;
	readonly summary: string;
	readonly evidenceBoundary: string;
	readonly primarySdk: "typescript" | "python" | "go" | "rust" | "browser" | "cli" | "mcp";
	readonly timeToFirstPqcMinutes: number | null;
	readonly capabilities: readonly DeveloperPatternCapabilityLink[];
	readonly snippets: readonly DeveloperPatternCodeSnippet[];
	readonly relatedSolutions: readonly DeveloperPatternSolutionLink[];
	readonly keywords: readonly string[];
}

export const DEVELOPER_PATTERNS: readonly DeveloperPattern[] = [
	{
		slug: "legaltech-contract-management",
		name: "LegalTech Contract Management",
		longName: "Build a PQC-Secured Contract Management Platform",
		tagline:
			"Source-linked contract-management integration pattern spanning storage, search, AI, and audit surfaces.",
		summary:
			"Evaluate a source-linked contract-management integration across Vault, SSE-X, AI Orchestrator, and Audit contracts. End-to-end retention, encrypted search, enclave processing, and audit behavior are NOT VERIFIED.",
		evidenceBoundary:
			"Source presence and snippet rendering do not prove mounted routes, encryption semantics, retention, AI isolation, audit coverage, or deployment behavior; all remain NOT VERIFIED.",
		primarySdk: "typescript",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
			{ capability: "SSE-X Encrypted Search", path: "/platform/encrypted-data" },
			{ capability: "AI Orchestrator", path: "/platform/ai-security" },
			{ capability: "Audit Service", path: "/platform/audit-evidence" },
		],
		snippets: [
			{
				language: "typescript",
				label: "Store a contract + index for clause search",
				code: `import { QnsiClient } from "@heossihq/qnsi";

const qnsp = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Source-linked Vault call; PQC envelope execution is NOT VERIFIED
const secret = await qnsp.vault.createSecret({
  name: \`contract:\${contractId}\`,
  payloadB64: pdfBase64,
  retention: { lockUntil: "2055-12-31" },
});

// 2. Extract + index clauses for encrypted search
await qnsp.search.upsertVectors("contracts", [{
  id: contractId,
  vector: clauseEmbedding,
  metadata: { counterparty, signedAt },
}]);

// 3. Audit
await qnsp.audit.logEvent({
  eventType: "contract.created",
  payload: { contractId, secretId: secret.id },
});`,
			},
			{
				language: "typescript",
				label: "Clause search across encrypted index",
				code: `const hits = await qnsp.search.query("contracts", {
  vector: queryEmbedding,
  topK: 20,
  filter: { counterparty: "Acme Corp" },
});

// hits[].id maps back to vault secret IDs - fetch under access control
for (const hit of hits.matches) {
  const secret = await qnsp.vault.getSecret(\`contract:\${hit.id}\`);
  // decrypted plaintext is in secret.payloadB64
}`,
			},
		],
		relatedSolutions: [
			{ slug: "multi-tenant-saas", label: "Multi-tenant SaaS platforms" },
			{ slug: "regulated-finance", label: "Regulated finance" },
		],
		keywords: [
			"LegalTech PQC",
			"contract management encryption",
			"clause search SSE",
			"AI contract analysis encrypted",
			"legal hold PQC",
		],
	},
	{
		slug: "healthcare-phi-records",
		name: "Healthcare PHI / Patient Records",
		longName: "Build a HIPAA-Aligned PHI Records System",
		tagline:
			"Source-linked PHI integration pattern spanning storage, search, tenant isolation, and audit contracts.",
		summary:
			"Evaluate PHI workflows against source-linked Vault, SSE-X, tenant-isolation, and Audit contracts. HIPAA alignment, de-identification, retention, exchange authentication, and end-to-end runtime behavior are NOT VERIFIED.",
		evidenceBoundary:
			"The pattern is not a compliance attestation or deployment proof. PHI protection, policy enforcement, isolation, audit completeness, and runtime behavior remain NOT VERIFIED.",
		primarySdk: "python",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
			{ capability: "SSE-X Encrypted Search", path: "/platform/encrypted-data" },
			{ capability: "Tenant Isolation", path: "/platform/identity-access" },
			{ capability: "Audit Service", path: "/platform/audit-evidence" },
		],
		snippets: [
			{
				language: "python",
				label: "Vault a PHI record + cohort-level encrypted search",
				code: `from qnsi import QnsiClient
import os, base64, json

qnsp = QnsiClient(api_key=os.environ["QNSI_API_KEY"])

# Vault PHI under per-patient key (ML-KEM-768-wrapped AES-256-GCM)
secret = qnsp.vault.create_secret(
    name=f"phi:{patient_mrn}",
    payload_b64=base64.b64encode(json.dumps(phi_record).encode()).decode(),
    metadata={"pqcAlgorithm": "ml-kem-768"},
)

# Cohort search: index a de-identified embedding for cohort discovery
qnsp.search.upsert_vectors(
    index_name="cohorts",
    vectors=[{
        "id": patient_mrn,
        "vector": deidentified_embedding,
        "metadata": {"age_band": "60-70", "icd10_prefix": "E11"},
    }],
)

qnsp.audit.log_event(
    event_type="phi.created",
    payload={"mrn": patient_mrn, "secret_id": secret["id"]},
)`,
			},
		],
		relatedSolutions: [{ slug: "healthcare-life-sciences", label: "Healthcare & life sciences" }],
		keywords: [
			"PHI PQC",
			"HIPAA records encryption",
			"patient records PQC",
			"clinical data encryption",
			"de-identification PQC",
		],
	},
	{
		slug: "investment-broker-dealer-archives",
		name: "Investment & Broker-Dealer Archives",
		longName: "Build WORM-Style Investment Document Archives",
		tagline:
			"Source-linked archive pattern for evaluating retention, audit, and searchable-encryption contracts.",
		summary:
			"Evaluate an archive workflow against source-linked Vault retention, Audit, and SSE-X contracts. WORM enforcement, regulatory alignment, PQC envelopes, and end-to-end runtime behavior are NOT VERIFIED.",
		evidenceBoundary:
			"The pattern is not evidence of WORM enforcement, regulatory compliance, immutable audit coverage, searchable encryption, or deployment behavior; all remain NOT VERIFIED.",
		primarySdk: "typescript",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
			{ capability: "Audit Service", path: "/platform/audit-evidence" },
			{ capability: "SSE-X Encrypted Search", path: "/platform/encrypted-data" },
		],
		snippets: [
			{
				language: "typescript",
				label: "WORM-style retention with SEC 17a-4 compliance",
				code: `import { QnsiClient } from "@heossihq/qnsi";

const qnsp = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Vault with retention lock (immutable until expiry)
const secret = await qnsp.vault.createSecret({
  name: \`trade-confirm:\${tradeId}\`,
  payloadB64: confirmDocBase64,
  retention: {
    lockUntil: "2030-12-31",  // SEC 17a-4: minimum 3 years
    immutable: true,           // WORM enforcement
  },
  metadata: {
    pqcAlgorithm: "ml-kem-768",
    regulatoryClass: "sec-17a-4",
  },
});

// Source-linked Audit call; ML-DSA signing and ingestion are NOT VERIFIED
await qnsp.audit.logEvent({
  eventType: "trade.confirm.archived",
  payload: { tradeId, secretId: secret.id, retainUntil: "2030-12-31" },
});`,
			},
		],
		relatedSolutions: [
			{ slug: "regulated-finance", label: "Regulated finance & banking" },
			{ slug: "insurance-asset-management", label: "Insurance & asset management" },
		],
		keywords: [
			"WORM PQC",
			"SEC 17a-4 PQC",
			"FINRA encryption",
			"broker-dealer archive",
			"investment document retention",
		],
	},
	{
		slug: "multi-tenant-b2b-platform",
		name: "Multi-Tenant B2B Platform",
		longName: "Build a Multi-Tenant B2B Document Platform",
		tagline:
			"Source-linked multi-tenant integration pattern for onboarding, policy, storage, and metering contracts.",
		summary:
			"Evaluate tenant provisioning, policy, Vault, SSE-X, and quota contracts through the published SDK surface. Complete isolation, metering, billing, and end-to-end runtime behavior are NOT VERIFIED.",
		evidenceBoundary:
			"SDK source presence does not prove route reachability, tenant isolation, policy enforcement, quota accounting, billing, or deployment behavior; all remain NOT VERIFIED.",
		primarySdk: "typescript",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Tenant Isolation", path: "/platform/identity-access" },
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
			{ capability: "Per-Tenant Crypto Policy", path: "/platform/key-management" },
			{ capability: "Quota Service", path: "/platform/identity-access" },
		],
		snippets: [
			{
				language: "typescript",
				label: "Provision a tenant + set its crypto policy at signup",
				code: `import { QnsiClient } from "@heossihq/qnsi";

const qnsp = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Self-serve tenant creation (called from your signup handler)
const tenant = await qnsp.tenant.createTenant({
  slug: workspace.slug,
  name: workspace.name,
  // Healthcare/finance customers get strict tier; others default
  cryptoPolicyTier: workspace.industry === "healthcare" ? "strict" : "default",
});

// Subsequent SDK calls scoped to this tenant via the tenant token
const tenantQnsp = new QnsiClient({
  apiKey: process.env.QNSI_API_KEY!,
  tenantId: tenant.id,
});

await tenantQnsp.vault.createSecret({
  name: "first-secret",
  payloadB64: payload,
});`,
			},
		],
		relatedSolutions: [{ slug: "multi-tenant-saas", label: "Multi-tenant SaaS platforms" }],
		keywords: [
			"multi-tenant PQC",
			"B2B SaaS encryption",
			"tenant isolation PQC",
			"per-tenant crypto policy",
		],
	},
	{
		slug: "edtech-secure-lms",
		name: "EdTech Secure LMS",
		longName: "Build a FERPA-Aligned Secure LMS",
		tagline:
			"Source-linked education-record integration pattern for storage, search, isolation, and retention contracts.",
		summary:
			"Evaluate education-record workflows against source-linked Vault, SSE-X, and tenant-isolation contracts. FERPA/PDPA alignment, privacy-safe search, retention, and end-to-end runtime behavior are NOT VERIFIED.",
		evidenceBoundary:
			"The pattern is not a compliance attestation or deployment proof. Record protection, selective indexing, retention, isolation, and runtime behavior remain NOT VERIFIED.",
		primarySdk: "typescript",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
			{ capability: "SSE-X Encrypted Search", path: "/platform/encrypted-data" },
			{ capability: "Tenant Isolation", path: "/platform/identity-access" },
		],
		snippets: [
			{
				language: "typescript",
				label: "Encrypt a transcript + index for instructor search",
				code: `import { QnsiClient } from "@heossihq/qnsi";

const qnsp = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Source-linked Vault call; FERPA alignment and key protection are NOT VERIFIED
const transcript = await qnsp.vault.createSecret({
  name: \`transcript:\${studentId}:\${termId}\`,
  payloadB64: transcriptPdfBase64,
  retention: { lockUntil: "permanent" }, // FERPA: indefinite
});

// Selective index: only de-identified course outcomes, not grades
await qnsp.search.upsertVectors("course-outcomes", [{
  id: \`\${studentId}:\${termId}\`,
  vector: outcomeEmbedding,
  metadata: { courseCode, term: termId }, // no PII
}]);`,
			},
		],
		relatedSolutions: [{ slug: "education-research", label: "Education & research" }],
		keywords: ["EdTech PQC", "FERPA LMS", "student records encryption", "coursework PQC"],
	},
	{
		slug: "govtech-public-records",
		name: "GovTech Public Records",
		longName: "Build a FOIA-Aligned Public Records System",
		tagline:
			"Source-linked public-records pattern for evaluating access, audit, and retention contracts.",
		summary:
			"Evaluate public-records workflows against source-linked Access, Audit, and Vault contracts. FOIA alignment, immutability, retention enforcement, agency isolation, and end-to-end runtime behavior are NOT VERIFIED.",
		evidenceBoundary:
			"The pattern is not evidence of FOIA compliance, authorization enforcement, audit completeness, immutable retention, isolation, or deployment behavior; all remain NOT VERIFIED.",
		primarySdk: "typescript",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Audit Service", path: "/platform/audit-evidence" },
			{ capability: "Access Control Service", path: "/platform/identity-access" },
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
		],
		snippets: [
			{
				language: "typescript",
				label: "FOIA-style request: gate access via RBAC + audit",
				code: `import { QnsiClient } from "@heossihq/qnsi";

const qnsp = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Check access via QNSI access-control-service
const allowed = await qnsp.access.check({
  principal: requesterId,
  resource: \`record:\${recordId}\`,
  action: "read",
});

if (!allowed.granted) {
  await qnsp.audit.logEvent({
    eventType: "foia.access.denied",
    payload: { requesterId, recordId, reason: allowed.reason },
  });
  return { error: "ACCESS_DENIED" };
}

// Source-linked Audit call; ordering and evidence ingestion are NOT VERIFIED
await qnsp.audit.logEvent({
  eventType: "foia.access.granted",
  payload: { requesterId, recordId, foiaRequestId },
});

const record = await qnsp.vault.getSecret(\`record:\${recordId}\`);
return { payload: record.payloadB64 };`,
			},
		],
		relatedSolutions: [
			{ slug: "government-sovereign-cloud", label: "Government & sovereign cloud" },
		],
		keywords: [
			"GovTech PQC",
			"FOIA records PQC",
			"public records encryption",
			"government records audit",
		],
	},
	{
		slug: "ai-agent-mcp-integration",
		name: "AI Agent / MCP Integration",
		longName: "Build a PQC-Authenticated AI Agent via MCP",
		tagline:
			"Source-linked MCP integration pattern for evaluating QNSI tool, signing, and audit contracts.",
		summary:
			"Evaluate QNSI Vault, KMS, Audit, and Crypto Inventory surfaces through the MCP integration contract. Tool-call signing, audit coverage, plaintext handling, and end-to-end runtime behavior are NOT VERIFIED.",
		evidenceBoundary:
			"Package and snippet presence do not prove MCP route reachability, PQC signing, audit effects, secret handling, or deployment behavior; all remain NOT VERIFIED.",
		primarySdk: "mcp",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "MCP Server", path: "/mcp" },
			{ capability: "Audit Service", path: "/platform/audit-evidence" },
			{ capability: "Quantum-Safe Vault", path: "/platform/secrets-management" },
		],
		snippets: [
			{
				language: "json",
				label: "Claude Desktop config - add the QNSI MCP server",
				code: `{
  "mcpServers": {
    "qnsp": {
      "command": "pnpm",
      "args": ["dlx", "@heossihq/qnsi-mcp"],
      "env": {
        "QNSI_API_KEY": "qnsp_pqc_api_..."
      }
    }
  }
}`,
			},
			{
				language: "typescript",
				label: "Programmatic MCP client contract",
				code: `import { QnspMcpClient } from "@heossihq/qnsi-mcp";

const mcp = new QnspMcpClient({ apiKey: process.env.QNSI_API_KEY! });

// Source-linked MCP call; ML-DSA signing and audit effects are NOT VERIFIED
const tools = await mcp.listTools();
// → [{ name: "qnsp_vault_get", ... }, { name: "qnsp_kms_sign", ... }]

const result = await mcp.callTool("qnsp_vault_get", {
  secretId: "openai-key",
});
// Returned payload protection and plaintext handling are NOT VERIFIED`,
			},
		],
		relatedSolutions: [
			{ slug: "sovereign-ai-labs", label: "Sovereign AI labs" },
			{ slug: "multi-tenant-saas", label: "Multi-tenant SaaS" },
		],
		keywords: [
			"MCP PQC",
			"Claude QNSI",
			"AI agent encryption",
			"Model Context Protocol PQC",
			"PQC tool calls",
		],
	},
	{
		slug: "browser-sdk-e2e",
		name: "Browser-to-Vault PQC Reference Architecture",
		longName: "Evaluate a Browser-to-Vault PQC Reference Architecture",
		tagline:
			"Reference architecture for browser-side ML-KEM-768 and a PQC-native vault handoff. Deployed browser-to-vault behavior is NOT VERIFIED.",
		summary:
			"This reference integration describes the intended browser-side ML-KEM-768 boundary and PQC-native continuation into QNSI. The repository does not publish the previously advertised KEM-handoff SDK method, and production edge negotiation plus end-to-end browser-to-vault plaintext handling are NOT VERIFIED. X25519MLKEM768 is permitted only as an explicitly selected composite-interop boundary, never as the native default.",
		evidenceBoundary:
			"No executable handoff contract or independent deployment evidence exists for this architecture. Browser-to-vault confidentiality, PQC continuity, edge negotiation, and plaintext handling remain NOT VERIFIED.",
		primarySdk: "browser",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "Browser PQC Reference Architecture", path: "/platform/developer-security" },
			{ capability: "PQC Transport Architecture", path: "/platform/deployment-resilience" },
			{ capability: "Quantum-Safe Vault Target", path: "/platform/secrets-management" },
		],
		snippets: [],
		relatedSolutions: [
			{ slug: "multi-tenant-saas", label: "Multi-tenant SaaS" },
			{ slug: "healthcare-life-sciences", label: "Healthcare" },
		],
		keywords: [
			"browser PQC primitives",
			"@noble/post-quantum",
			"browser-to-vault PQC architecture",
			"client-side encryption",
			"composite interoperability TLS",
		],
	},
	{
		slug: "service-to-service-mtls",
		name: "Service-to-Service PQC Reference Architecture",
		longName: "Evaluate PQC Authentication Between Internal Services",
		tagline:
			"Reference architecture for PQC-native service authentication and explicit composite interoperability. Production mTLS and ML-DSA SVID behavior is NOT VERIFIED.",
		summary:
			"This reference architecture defines PQC-native confidentiality and authenticity as the internal target. X25519MLKEM768 may appear only at an explicitly selected composite-interop boundary. The repository contains SPIFFE URI policy handling but no verified ML-DSA SVID issuance path; production mesh, mTLS, certificate rotation, and ML-DSA SVID behavior are NOT VERIFIED.",
		evidenceBoundary:
			"No independently verified service-mesh execution path exists for this architecture. PQC mTLS, SVID issuance, certificate rotation, audit coverage, and deployment behavior remain NOT VERIFIED.",
		primarySdk: "go",
		timeToFirstPqcMinutes: null,
		capabilities: [
			{ capability: "PQC Transport Architecture", path: "/platform/deployment-resilience" },
			{ capability: "PQC Key Management (KMS)", path: "/platform/key-management" },
			{ capability: "Audit Service", path: "/platform/audit-evidence" },
		],
		snippets: [],
		relatedSolutions: [
			{ slug: "defense-national-security", label: "Defense & national security" },
			{ slug: "critical-infrastructure", label: "Critical infrastructure" },
			{ slug: "manufacturing-ip-protection", label: "Manufacturing & IP" },
		],
		keywords: [
			"PQC service authentication",
			"composite interoperability TLS",
			"X25519MLKEM768",
			"SPIFFE PQC architecture",
			"service mesh PQC",
		],
	},
] as const;

export function findDeveloperPattern(slug: string): DeveloperPattern | undefined {
	return DEVELOPER_PATTERNS.find((p) => p.slug === slug);
}

export function developerPatternSlugs(): readonly string[] {
	return DEVELOPER_PATTERNS.map((p) => p.slug);
}
