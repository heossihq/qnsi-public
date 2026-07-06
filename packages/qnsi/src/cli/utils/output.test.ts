import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printError, printJson, printSuccess, printTable, printVerbose } from "./output.js";

describe("output utilities", () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let consoleTableSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		consoleTableSpy = vi.spyOn(console, "table").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("printJson", () => {
		it("should print JSON with proper formatting", () => {
			const data = { key: "value", nested: { foo: "bar" } };
			printJson(data);
			expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
		});

		it("should handle arrays", () => {
			const data = [{ id: 1 }, { id: 2 }];
			printJson(data);
			expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
		});
	});

	describe("printTable", () => {
		it("should print array as table", () => {
			const data = [
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			];
			printTable(data);
			expect(consoleTableSpy).toHaveBeenCalledWith(data);
		});

		it("should print single object as table", () => {
			const data = { id: 1, name: "Alice" };
			printTable(data);
			expect(consoleTableSpy).toHaveBeenCalledWith([data]);
		});

		it("should handle empty array", () => {
			printTable([]);
			expect(consoleLogSpy).toHaveBeenCalledWith("No results");
		});
	});

	describe("printError", () => {
		it("should print error message to stderr", () => {
			printError("Something went wrong");
			expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Something went wrong");
		});
	});

	describe("printSuccess", () => {
		it("should print success message with checkmark", () => {
			printSuccess("Operation completed");
			expect(consoleLogSpy).toHaveBeenCalledWith("✓ Operation completed");
		});
	});

	describe("printVerbose", () => {
		it("should print when verbose is true", () => {
			printVerbose("Debug info", true);
			expect(consoleLogSpy).toHaveBeenCalledWith("[DEBUG] Debug info");
		});

		it("should not print when verbose is false", () => {
			printVerbose("Debug info", false);
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});
	});
});
