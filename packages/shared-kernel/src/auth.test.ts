import { registerPqcProvider, unregisterPqcProvider } from "@heossi/qnsi-cryptography";
import { createDeterministicTestPqcProvider } from "@heossi/qnsi-cryptography/testing/providers";
import { describe, expect, it } from "vitest";

import { createAuthSubject } from "./auth.js";
import {
	createAccessToken,
	createJwtAccessToken,
	createRefreshToken,
	hashRefreshTokenSecret,
	parseRefreshToken,
} from "./auth-server.js";
import { TOKEN_AUDIENCES } from "./constants.js";

describe("shared-kernel/auth", () => {
	it("validates auth subjects", () => {
		const subject = createAuthSubject({
			id: "11111111-1111-1111-8111-111111111111",
			roles: ["admin"],
			tenantId: "22222222-2222-2222-8222-222222222222",
		});

		expect(subject.roles).toContain("admin");
	});

	it("produces signed tokens with defaults", () => {
		const token = createAccessToken({
			subject: createAuthSubject({
				id: "11111111-1111-1111-8111-111111111111",
				roles: [],
			}),
		});

		expect(token.tokenId).toHaveLength(36);
		expect(token.audience).toBe(TOKEN_AUDIENCES.PLATFORM);
		expect(token.expiresAt).toBeGreaterThan(token.issuedAt);
	});

	it("creates and parses refresh tokens", () => {
		const subject = createAuthSubject({
			id: "11111111-1111-1111-8111-111111111111",
			tenantId: "22222222-2222-2222-8222-222222222222",
			roles: ["reader"],
		});

		const { token, metadata } = createRefreshToken({ subject });

		expect(token).toContain(metadata.tokenId);
		expect(metadata.expiresAt).toBeGreaterThan(metadata.issuedAt);

		const parsed = parseRefreshToken(token);
		expect(parsed.tokenId).toBe(metadata.tokenId);

		const hashed = hashRefreshTokenSecret(parsed.secret);
		expect(hashed).toHaveLength(86); // base64url encoded sha3-512 (64 bytes -> 86 chars)
	});

	it("requires tenant-scoped subject for refresh tokens", () => {
		const subject = createAuthSubject({
			id: "11111111-1111-1111-8111-111111111111",
			roles: ["reader"],
		});

		expect(() => createRefreshToken({ subject })).toThrow("tenant-scoped");
	});

	it("parseRefreshToken rejects invalid formats", () => {
		expect(() => parseRefreshToken("no-delimiter")).toThrow("format");
		expect(() => parseRefreshToken("too.many.parts.here")).toThrow("format");
		expect(() => parseRefreshToken("not-a-uuid.secret")).toThrow();
		expect(() => parseRefreshToken("11111111-1111-1111-8111-111111111111.")).toThrow("secret");
	});

	it("creates JWT access token and includes optional issuer/keyId fields", async () => {
		const provider = createDeterministicTestPqcProvider({ seed: "auth-jwt-seed" });
		registerPqcProvider("auth-test-pqc", provider);
		try {
			const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
			const subject = createAuthSubject({
				id: "11111111-1111-1111-8111-111111111111",
				tenantId: "22222222-2222-2222-8222-222222222222",
				roles: ["admin"],
			});

			const token = await createJwtAccessToken({
				subject,
				audience: TOKEN_AUDIENCES.PLATFORM,
				issuer: "qnsp-auth-test",
				keyId: "kid-1",
				algorithm: "dilithium-2",
				privateKey: keyPair.privateKey,
				provider,
			});

			const headerB64 = token.split(".")[0];
			expect(headerB64).toBeTruthy();
		} finally {
			unregisterPqcProvider("auth-test-pqc");
		}
	});
});
