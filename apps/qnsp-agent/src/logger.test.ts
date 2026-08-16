import { afterEach, describe, expect, it, vi } from "vitest";
import { formatError, logger, setLogLevel } from "./logger.js";

afterEach(() => {
	setLogLevel("info");
	vi.restoreAllMocks();
});

describe("structured logger", () => {
	it("normalizes Error objects and non-Error failures", () => {
		expect(formatError(new Error("structured"))).toBe("structured");
		expect(formatError("plain")).toBe("plain");
	});

	it("emits every severity at debug level with structured context", () => {
		const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		setLogLevel("debug");

		logger.error("error", { code: 1 });
		logger.warn("warn");
		logger.info("info");
		logger.debug("debug");

		expect(write).toHaveBeenCalledTimes(4);
		const entries = write.mock.calls.map(
			([line]) => JSON.parse(String(line)) as Record<string, unknown>,
		);
		expect(entries.map(({ level }) => level)).toEqual(["error", "warn", "info", "debug"]);
		expect(entries[0]).toMatchObject({ msg: "error", code: 1 });
		expect(entries.every(({ time }) => typeof time === "string")).toBe(true);
	});

	it("suppresses messages above the configured rank", () => {
		const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		setLogLevel("silent");

		logger.error("hidden");
		logger.warn("hidden");
		logger.info("hidden");
		logger.debug("hidden");

		expect(write).not.toHaveBeenCalled();
	});

	it("allows errors while suppressing less severe messages", () => {
		const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		setLogLevel("error");

		logger.error("visible");
		logger.warn("hidden");

		expect(write).toHaveBeenCalledOnce();
		expect(String(write.mock.calls[0]?.[0])).toContain('"msg":"visible"');
	});
});
