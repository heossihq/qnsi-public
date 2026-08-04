import { describe, expect, it } from "vitest";
import { bridgeQnsiEnvVars } from "./env-aliases.js";

describe("bridgeQnsiEnvVars (QNSI full-rename Phase B)", () => {
	it("mirrors QNSP_* to QNSI_* without overwriting", () => {
		const env: NodeJS.ProcessEnv = { QNSP_DATABASE_URL: "postgres://a" };
		bridgeQnsiEnvVars(env);
		expect(env["QNSI_DATABASE_URL"]).toBe("postgres://a");
		expect(env["QNSP_DATABASE_URL"]).toBe("postgres://a");
	});

	it("mirrors QNSI_* back to QNSP_* so legacy schema keys keep working after B3 injection flips", () => {
		const env: NodeJS.ProcessEnv = { QNSI_KMS_URL: "http://kms" };
		bridgeQnsiEnvVars(env);
		expect(env["QNSP_KMS_URL"]).toBe("http://kms");
	});

	it("explicitly-set values always win - the bridge only fills gaps", () => {
		const env: NodeJS.ProcessEnv = {
			QNSP_TOKEN: "old",
			QNSI_TOKEN: "new",
		};
		bridgeQnsiEnvVars(env);
		expect(env["QNSP_TOKEN"]).toBe("old");
		expect(env["QNSI_TOKEN"]).toBe("new");
	});

	it("ignores unrelated variables and undefined values", () => {
		const env: NodeJS.ProcessEnv = { PATH: "/usr/bin", QNSP_EMPTY: undefined };
		bridgeQnsiEnvVars(env);
		expect(Object.keys(env).sort()).toEqual(["PATH", "QNSP_EMPTY"]);
	});
});
