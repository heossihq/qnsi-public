import { registerPqcProvider, unregisterPqcProvider } from "@heossi/qnsi-cryptography";
import { createDeterministicTestPqcProvider } from "@heossi/qnsi-cryptography/testing/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createJwtVerifier, signJwt, verifyJwt } from "./jwt.js";

function b64url(input: string): string {
	return Buffer.from(input)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

describe("PQC-JWT", () => {
	const provider = createDeterministicTestPqcProvider({ seed: "jwt-test-seed" });

	beforeAll(() => {
		registerPqcProvider("test-pqc", provider);
	});

	afterAll(() => {
		unregisterPqcProvider("test-pqc");
	});

	it("signs and verifies JWT with Dilithium-2", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });

		const payload = {
			sub: "user-123",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
			tenant_id: "tenant-456",
			roles: ["admin", "user"],
		};

		const token = await signJwt({
			payload,
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			keyId: "test-key-1",
			provider,
		});

		expect(token).toContain(".");
		const parts = token.split(".");
		expect(parts).toHaveLength(3);

		const result = await verifyJwt({
			token,
			publicKey: keyPair.publicKey,
			algorithm: "dilithium-2",
			provider,
		});

		expect(result.valid).toBe(true);
		expect(result.payload?.sub).toBe("user-123");
		expect(result.payload?.["tenant_id"]).toBe("tenant-456");
		expect(result.header?.alg).toBe("Dilithium2");
		expect(result.header?.kid).toBe("test-key-1");
	});

	it("rejects expired tokens", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });

		const payload = {
			sub: "user-123",
			iat: Math.floor(Date.now() / 1000) - 7200,
			exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
		};

		const token = await signJwt({
			payload,
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});

		const result = await verifyJwt({
			token,
			publicKey: keyPair.publicKey,
			algorithm: "dilithium-2",
			provider,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("expired");
	});

	it("rejects invalid signatures", async () => {
		// Use different seeds to ensure different keys
		const provider1 = createDeterministicTestPqcProvider({ seed: "key1-seed" });
		const provider2 = createDeterministicTestPqcProvider({ seed: "key2-seed" });

		const { keyPair: keyPair1 } = await provider1.generateKeyPair({ algorithm: "dilithium-2" });
		const { keyPair: keyPair2 } = await provider2.generateKeyPair({ algorithm: "dilithium-2" });

		const payload = {
			sub: "user-123",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
		};

		const token = await signJwt({
			payload,
			algorithm: "dilithium-2",
			privateKey: keyPair1.privateKey,
			provider: provider1,
		});

		// Try to verify with wrong public key
		const result = await verifyJwt({
			token,
			publicKey: keyPair2.publicKey, // Wrong key
			algorithm: "dilithium-2",
			provider: provider2,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("verification failed");
	});

	it("works with JWT verifier adapter", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });

		const payload = {
			sub: "user-123",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
		};

		const token = await signJwt({
			payload,
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});

		const verifier = createJwtVerifier(provider);
		const result = await verifier.verify(token, keyPair.publicKey, "dilithium-2");

		expect(result.valid).toBe(true);
		expect(result.payload?.sub).toBe("user-123");
	});

	it("rejects tokens that are not yet valid (nbf)", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });

		const now = Math.floor(Date.now() / 1000);
		const token = await signJwt({
			payload: {
				sub: "user-123",
				iat: now,
				exp: now + 3600,
				nbf: now + 600,
			},
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});

		const result = await verifyJwt({
			token,
			publicKey: keyPair.publicKey,
			provider,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("not yet valid");
	});

	it("returns an error for invalid JWT format", async () => {
		const result = await verifyJwt({
			token: "not-a-jwt",
			publicKey: new Uint8Array(),
			provider,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid JWT format");
	});

	it("returns an error for invalid header JSON", async () => {
		const token = `${b64url("notjson")}.${b64url("{}")}.AA`;
		const result = await verifyJwt({
			token,
			publicKey: new Uint8Array(),
			provider,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("Failed to parse JWT header");
	});

	it("returns an error for invalid payload JSON", async () => {
		const header = b64url(JSON.stringify({ alg: "Dilithium2", typ: "JWT" }));
		const token = `${header}.${b64url("notjson")}.AA`;
		const result = await verifyJwt({
			token,
			publicKey: new Uint8Array(),
			provider,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("Failed to parse JWT payload");
	});

	it("rejects unsupported JWT algorithm when algorithm option not provided", async () => {
		const header = b64url(JSON.stringify({ alg: "UnknownAlg", typ: "JWT" }));
		const payload = b64url(JSON.stringify({ sub: "user-123" }));
		const token = `${header}.${payload}.AA`;

		const result = await verifyJwt({
			token,
			publicKey: new Uint8Array(),
			provider,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported JWT algorithm");
	});

	it("infers algorithm from header when algorithm option is omitted", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const payload = {
			sub: "user-123",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
		};

		const token = await signJwt({
			payload,
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});

		const result = await verifyJwt({
			token,
			publicKey: keyPair.publicKey,
			provider,
		});

		expect(result.valid).toBe(true);
		expect(result.payload?.sub).toBe("user-123");
	});
});

describe("PQC-JWT (no provider registered)", () => {
	it("returns a helpful error when no provider exists for verification", async () => {
		const header = b64url(JSON.stringify({ alg: "Dilithium2", typ: "JWT" }));
		const payload = b64url(JSON.stringify({ sub: "user-123" }));
		const token = `${header}.${payload}.AA`;

		const result = await verifyJwt({
			token,
			publicKey: new Uint8Array(),
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("No PQC provider available");
	});
});
