import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
	createSseToken,
	deriveDocumentSseTokens,
	deriveQuerySseTokens,
	type SseDocumentPayload,
} from "./sse.js";

const KEY_BYTES = new Uint8Array(32).fill(7);
const KEY_B64 = Buffer.from(KEY_BYTES).toString("base64");

function payload(overrides?: Partial<SseDocumentPayload>): SseDocumentPayload {
	return {
		tenantId: "tenant-1",
		documentId: "doc-1",
		sourceService: "storage",
		...overrides,
	};
}

describe("createSseToken", () => {
	it("computes HMAC-SHA3-512 base64url, identical for byte and base64 keys", () => {
		const fromBytes = createSseToken(KEY_BYTES, "tenant:tenant-1");
		const fromB64 = createSseToken(KEY_B64, "tenant:tenant-1");
		expect(fromBytes).toBe(fromB64);
		// Independent verification against node:crypto.
		const expected = createHmac("sha3-512", Buffer.from(KEY_BYTES))
			.update("tenant:tenant-1")
			.digest("base64url");
		expect(fromBytes).toBe(expected);
	});
});

describe("deriveDocumentSseTokens", () => {
	it("always derives tenant, document, source, and tag tokens", () => {
		const tokens = deriveDocumentSseTokens(payload({ tags: ["alpha", "beta"] }), KEY_BYTES, {
			includeContent: false,
		});
		expect(tokens).toContain(createSseToken(KEY_BYTES, "tenant:tenant-1"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "document:doc-1"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "source:storage"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "tag:alpha"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "tag:beta"));
		expect(tokens).toHaveLength(5);
	});

	it("derives keyword tokens from title, description, and body by default", () => {
		const tokens = deriveDocumentSseTokens(
			payload({
				title: "Quantum Vault",
				description: "Sealed secrets",
				body: "rotation policies",
			}),
			KEY_BYTES,
		);
		for (const keyword of ["quantum", "vault", "sealed", "secrets", "rotation", "policies"]) {
			expect(tokens, keyword).toContain(createSseToken(KEY_BYTES, `kw:${keyword}`));
		}
	});

	it("skips body keywords when includeBody is false and all keywords when includeContent is false", () => {
		const withTitleOnly = deriveDocumentSseTokens(
			payload({ title: "alpha", body: "bravo" }),
			KEY_BYTES,
			{ includeBody: false },
		);
		expect(withTitleOnly).toContain(createSseToken(KEY_BYTES, "kw:alpha"));
		expect(withTitleOnly).not.toContain(createSseToken(KEY_BYTES, "kw:bravo"));

		const withoutContent = deriveDocumentSseTokens(
			payload({ title: "alpha", body: "bravo" }),
			KEY_BYTES,
			{ includeContent: false },
		);
		expect(withoutContent).not.toContain(createSseToken(KEY_BYTES, "kw:alpha"));
	});

	it("caps keyword tokens at maxContentTokens and drops short tokens", () => {
		const body = Array.from({ length: 20 }, (_v, i) => `keyword${String(i).padStart(2, "0")}`).join(
			" ",
		);
		const tokens = deriveDocumentSseTokens(payload({ body: `ab ${body}` }), KEY_BYTES, {
			maxContentTokens: 5,
		});
		const kwCount = tokens.filter((t) =>
			Array.from({ length: 20 }, (_v, i) =>
				createSseToken(KEY_BYTES, `kw:keyword${String(i).padStart(2, "0")}`),
			).includes(t),
		).length;
		expect(kwCount).toBe(5);
		expect(tokens).not.toContain(createSseToken(KEY_BYTES, "kw:ab"));
	});

	it("flattens metadata primitives, arrays, nested objects, and objects inside arrays", () => {
		const tokens = deriveDocumentSseTokens(
			payload({
				metadata: {
					plain: "value",
					count: 3,
					flag: true,
					missing: null,
					list: ["a", 1, null, { deep: "x" }, undefined],
					nested: { inner: "y" },
					skipped: () => {},
				},
			}),
			KEY_BYTES,
			{ includeContent: false },
		);
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.plain=value"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.count=3"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.flag=true"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.missing=null"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.list[0]=a"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.list[1]=1"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.list[2]=null"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.list[3].deep=x"));
		expect(tokens).toContain(createSseToken(KEY_BYTES, "meta.nested.inner=y"));
	});
});

describe("deriveQuerySseTokens", () => {
	it("emits kw: tokens that intersect the tokens a default-derived document carries", () => {
		const documentTokens = deriveDocumentSseTokens(
			payload({ body: "quantum rotation evidence" }),
			KEY_BYTES,
		);
		const queryTokens = deriveQuerySseTokens("rotation", KEY_BYTES);
		expect(queryTokens).toHaveLength(1);
		expect(documentTokens).toContain(queryTokens[0]);
	});

	it("honors maxTokens and minTokenLength options", () => {
		const capped = deriveQuerySseTokens("alpha bravo charlie delta", KEY_BYTES, { maxTokens: 2 });
		expect(capped).toHaveLength(2);
		const longOnly = deriveQuerySseTokens("ab abcdef", KEY_BYTES, { minTokenLength: 5 });
		expect(longOnly).toHaveLength(1);
		expect(longOnly[0]).toBe(createSseToken(KEY_BYTES, "kw:abcdef"));
	});
});

describe("subpath index", () => {
	it("bridges env aliases on import and re-exports the public surface", async () => {
		const mod = await import("./index.js");
		expect(mod.QnsiVectorStore).toBeDefined();
	});
});
