import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept canonical environment variables and legacy-prefixed aliases.
bridgeQnsiEnv();

/**
 * former standalone LangChain integration package
 *
 * LangChain tools for QNSI - governed agents with PQC-encrypted secrets,
 * quantum-safe signing, and immutable audit trails.
 *
 * @example
 * ```typescript
 * import { QnsiToolkit } from "former standalone LangChain integration package";
 *
 * const toolkit = new QnsiToolkit({ apiKey: process.env.QNSI_API_KEY });
 * const tools = toolkit.getTools();
 * ```
 */

export type { QnsiToolkitConfig } from "./toolkit.js";
// Toolkit (recommended entry point)
export { QnsiToolkit } from "./toolkit.js";
export type { QnsiAuditToolConfig } from "./tools/audit.js";
// Individual audit tools
export { QnsiLogAgentActionTool } from "./tools/audit.js";
export type { QnsiKmsToolConfig } from "./tools/kms.js";
// Individual KMS tools
export { QnsiSignDataTool, QnsiVerifySignatureTool } from "./tools/kms.js";
// Individual vault tools
export { QnsiReadSecretTool, QnsiRotateSecretTool, QnsiWriteSecretTool } from "./tools/vault.js";
