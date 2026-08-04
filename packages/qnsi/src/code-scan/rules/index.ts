import type { CryptoDetectionRule } from "../types.js";
import { artifactRules } from "./artifacts.js";
import { cRules } from "./c.js";
import { csharpRules } from "./csharp.js";
import { goRules } from "./go.js";
import { javaRules } from "./java.js";
import { javascriptRules } from "./javascript.js";
import { pythonRules } from "./python.js";
import { rustRules } from "./rust.js";

/**
 * The complete v1 rule set. RULE_SET_VERSION is reported with every scan so
 * ingested findings are traceable to the rules that produced them.
 */
export const RULE_SET_VERSION = "1.0.0";

export const ALL_RULES: readonly CryptoDetectionRule[] = [
	...javascriptRules,
	...pythonRules,
	...javaRules,
	...goRules,
	...cRules,
	...csharpRules,
	...rustRules,
	...artifactRules,
];
