import type { FastifyBaseLogger } from "fastify";
import { describe, expect, it } from "vitest";

import { createIntegrityLogger } from "./logging.js";

type Call = { level: string; obj: Record<string, unknown>; msg: string | undefined };

function recordingLogger(calls: Call[]): FastifyBaseLogger {
	const record =
		(level: string) =>
		(obj: unknown, msg?: string): void => {
			calls.push({ level, obj: obj as Record<string, unknown>, msg });
		};
	const logger = {
		info: record("info"),
		error: record("error"),
		warn: record("warn"),
		debug: record("debug"),
		trace: record("trace"),
		fatal: record("fatal"),
		child: () => logger,
		level: "info",
		silent: () => {},
	};
	return logger as unknown as FastifyBaseLogger;
}

describe("createIntegrityLogger", () => {
	it("enriches every log level with provenance and PQC fields", () => {
		const calls: Call[] = [];
		const logger = createIntegrityLogger(recordingLogger(calls), {
			sourceService: "edge-gateway",
			pqc: { algorithm: "ml-dsa-65", keyId: "key-1", provider: "liboqs" },
		});

		logger.info({ a: 1 }, "info msg");
		logger.error({ b: 2 }, "error msg");
		logger.warn({ c: 3 }, "warn msg");
		logger.debug({ d: 4 }, "debug msg");
		logger.trace({ e: 5 }, "trace msg");
		logger.fatal({ f: 6 }, "fatal msg");

		expect(calls).toHaveLength(6);
		for (const call of calls) {
			const provenance = call.obj["provenance"] as Record<string, unknown>;
			const pqc = call.obj["pqc"] as Record<string, unknown>;
			expect(provenance["sourceService"]).toBe("edge-gateway");
			expect(pqc["pqc.algorithm"]).toBe("ml-dsa-65");
			expect(pqc["pqc.key_id"]).toBe("key-1");
			expect(pqc["pqc.provider"]).toBe("liboqs");
		}
		expect(calls[0]?.obj["a"]).toBe(1);
		expect(calls[0]?.msg).toBe("info msg");
	});

	it("treats non-object first arguments as empty metadata on every level", () => {
		const calls: Call[] = [];
		const logger = createIntegrityLogger(recordingLogger(calls), { sourceService: "svc" });

		logger.info("just a string" as never);
		logger.error(null as never);
		logger.warn("w" as never);
		logger.debug("d" as never);
		logger.trace("t" as never);
		logger.fatal("f" as never);

		expect(calls).toHaveLength(6);
		for (const call of calls) {
			expect((call.obj["provenance"] as Record<string, unknown>)["sourceService"]).toBe("svc");
		}
	});

	it("wraps child loggers so enrichment survives child()", () => {
		const calls: Call[] = [];
		const logger = createIntegrityLogger(recordingLogger(calls), { sourceService: "svc" });

		const child = logger.child({ component: "x" });
		child.warn({ y: 1 }, "from child");

		expect(calls[0]?.level).toBe("warn");
		expect((calls[0]?.obj["provenance"] as Record<string, unknown>)["sourceService"]).toBe("svc");
	});
});
