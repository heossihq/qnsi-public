import { describe, expect, it } from "vitest";
import { encodePathSegment } from "./path-segment.js";

describe("path parameter boundaries", () => {
	it("preserves ordinary identifiers and encodes reserved characters and Unicode", () => {
		expect(encodePathSegment("key.id-1_~")).toBe("key.id-1_~");
		expect(encodePathSegment("key/?# &%β")).toBe("key%2F%3F%23%20%26%25%CE%B2");
	});
	it.each(["", ".", "..", null, undefined, 1])(
		"rejects invalid identifier %s before request building",
		(value) => {
			expect(() => encodePathSegment(value as string)).toThrow(TypeError);
		},
	);
});
