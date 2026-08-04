import { describe, expect, it } from "vitest";

import { stripComments } from "./strip.js";

describe("stripComments - C family", () => {
	it("drops // line comments but keeps code before them", () => {
		const [line] = stripComments(`const x = 1; // uses RSA internally`, "typescript");
		expect(line).toContain("const x = 1;");
		expect(line).not.toContain("RSA");
	});

	it("drops /* block comments */ spanning multiple lines", () => {
		const lines = stripComments(
			["before();", '/* Cipher.getInstance("RSA")', "still comment", "*/ after();"].join("\n"),
			"java",
		);
		expect(lines[0]).toBe("before();");
		expect(lines[1]).not.toContain("RSA");
		expect(lines[2]).not.toContain("still comment");
		expect(lines[3]).toContain("after();");
	});

	it("keeps string literals intact (algorithm names live in strings)", () => {
		const [line] = stripComments(`Cipher.getInstance("RSA/ECB/PKCS1Padding");`, "java");
		expect(line).toContain('"RSA/ECB/PKCS1Padding"');
	});

	it("does not treat // inside a string as a comment", () => {
		const [line] = stripComments(`const url = "https://example.com"; // trailing`, "typescript");
		expect(line).toContain('"https://example.com"');
		expect(line).not.toContain("trailing");
	});
});

describe("stripComments - hash family", () => {
	it("drops # comments but keeps code", () => {
		const [line] = stripComments(`key = rsa.generate_private_key()  # legacy RSA`, "python");
		expect(line).toContain("rsa.generate_private_key()");
		expect(line).not.toContain("legacy");
	});

	it("does not treat # inside a string as a comment", () => {
		const [line] = stripComments(`anchor = "section#fragment"`, "python");
		expect(line).toContain('"section#fragment"');
	});

	it("drops triple-quoted docstring content across lines", () => {
		const lines = stripComments(
			[
				"def f():",
				'    """Docstring mentioning hashlib.md5().',
				'    More text."""',
				"    return 1",
			].join("\n"),
			"python",
		);
		expect(lines[1]).not.toContain("md5");
		expect(lines[2]).not.toContain("More text");
		expect(lines[3]).toContain("return 1");
	});
});
