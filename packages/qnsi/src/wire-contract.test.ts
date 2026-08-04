/**
 * REGRESSION GUARD: every request body must satisfy the backend's Zod schema.
 *
 * This bug class has now bitten FOUR times in one day, on four different surfaces:
 *
 *   PyPI qnsi      vault.create_secret sent `payloadBase64`; backend requires `payload`
 *   MCP server     qnsp_kms_generate_key omitted keyId + keyType
 *   qnsi CLI       `kms keys create` omitted keyId + keyType
 *   npm SDK        kms.rotateKey sent NO BODY AT ALL
 *
 * The npm one is the subtlest. `rotateKey` passed `undefined` as the body. The central
 * tenantId injection (`withTenantId`) only injects into an OBJECT, so nothing was injected
 * and no body was sent - while the request still carried `content-type: application/json`.
 * Fastify rejects that outright:
 *
 *     400  "Body cannot be empty when content-type is set to 'application/json'"
 *
 * kms.rotateKey had therefore NEVER rotated a key. Proven against production 2026-07-14 with
 * the published SDK: 0 passed, 6 failed, every one a 400.
 *
 * WHY NONE OF THESE ANNOUNCED THEMSELVES: backend Zod objects are NON-STRICT. An unknown
 * field is silently STRIPPED, so a wrong name never produces a helpful error - it produces a
 * MISSING REQUIRED FIELD. And a missing body produces a Fastify parse error that says nothing
 * about which field was wrong. A green unit test proves nothing; only the body does.
 *
 * These assert the BODY THE SDK BUILDS. No network, no credentials.
 */
import { describe, expect, it } from "vitest";
import { KmsClient } from "./kms.js";
import { VaultClient } from "./vault.js";

const TENANT = "155f43f3-bb3f-43be-b62c-0c0c97b5b5b0";

/** Captures what Internal.request() would have sent. */
function spy() {
	const calls: Array<{ method: string; path: string; body: unknown }> = [];
	const internal = {
		request: async (method: string, path: string, body?: unknown) => {
			// Mirror the central tenantId injection: it only touches OBJECT bodies.
			const effective =
				body !== undefined && body !== null && typeof body === "object" && !Array.isArray(body)
					? { tenantId: TENANT, ...(body as Record<string, unknown>) }
					: body;
			calls.push({ method, path, body: effective });
			return {};
		},
	};
	return { internal: internal as never, calls };
}

describe("kms.rotateKey: it sent NO BODY, and had never rotated a key", () => {
	it("sends an object body so the tenantId can be injected", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).rotateKey("key-1");

		const call = calls[0];
		expect(call?.method).toBe("POST");
		// Before the fix this was `undefined` -> no body -> Fastify 400.
		expect(call?.body).toBeTypeOf("object");
		expect(call?.body).not.toBeUndefined();
	});

	it("the body carries the REQUIRED tenantId (rotateKeySchema)", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).rotateKey("key-1");

		expect((calls[0]?.body as Record<string, unknown>)["tenantId"]).toBe(TENANT);
	});

	it("an optional reason is passed through", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).rotateKey("key-1", "scheduled rotation");

		expect((calls[0]?.body as Record<string, unknown>)["reason"]).toBe("scheduled rotation");
	});
});

describe("the fields that broke the other SDKs must be right here", () => {
	it("kms.createKey sends the REQUIRED keyId and keyType", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).createKey({ algorithm: "dilithium-3", purpose: "signing" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["keyId"]).toBeTypeOf("string"); // MCP + CLI both omitted this -> 400
		expect(body["keyType"]).toBe("data");
		expect(body["tenantId"]).toBe(TENANT);
		// `purpose` is not a backend field - it is folded into metadata, never sent top-level.
		expect(body["purpose"]).toBeUndefined();
		expect((body["metadata"] as Record<string, unknown>)["purpose"]).toBe("signing");
	});

	it("kms.createKey sends a first-class `intent` TOP-LEVEL (createKeySchema.intent), without an algorithm", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).createKey({ intent: "signing" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["intent"]).toBe("signing"); // policy resolves the algorithm backend-side
		expect(body["algorithm"]).toBeUndefined(); // intent+algorithm together is a backend 400
		expect(body["tenantId"]).toBe(TENANT);
	});

	it("kms.upgradeKey ALWAYS sends an object body (upgradeKeySchema = { tenantId, reason? })", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).upgradeKey("key-1");

		const call = calls[0];
		expect(call?.method).toBe("POST");
		expect(call?.path).toBe("/proxy/kms/v1/keys/key-1/upgrade");
		// The rotateKey lesson: an undefined body with content-type json is a
		// Fastify 400 - tenantId must have an object to be injected into.
		expect(call?.body).not.toBeUndefined();
		expect((call?.body as Record<string, unknown>)["tenantId"]).toBe(TENANT);

		await new KmsClient(internal).upgradeKey("key-1", "pqc migration");
		expect((calls[1]?.body as Record<string, unknown>)["reason"]).toBe("pqc migration");
	});

	it("vault.createSecret sends `payload`, never `payloadBase64`", async () => {
		const { internal, calls } = spy();
		const b64 = Buffer.from("v").toString("base64");
		await new VaultClient(internal).createSecret({ name: "a-secret", payloadB64: b64 });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["payload"]).toBe(b64); // the Python SDK sent `payloadBase64` -> 500
		expect(body["payloadBase64"]).toBeUndefined();
		expect(body["tenantId"]).toBe(TENANT);
	});
});

describe("kms.hspkSeal / hspkSign: HSPK wire contract (matches the proven byohsm/pqc routes)", () => {
	const SEALED = {
		scheme: "hspk-hsm-cek-aes256gcm-v1",
		algorithm: "ml-dsa-65",
		hsmKeyId: "h",
		wrappedCek: "AA==",
		iv: "AA==",
		ciphertext: "AA==",
		authTag: "AA==",
		publicKey: "AA==",
		sealedAt: "2026-07-19T00:00:00.000Z",
	};

	it("hspkSeal POSTs /proxy/kms/v1/byohsm/pqc/seal with {tenantId, connectionId, keyId, ...}", async () => {
		const { internal, calls } = spy();
		await new KmsClient(internal).hspkSeal({
			connectionId: "conn-1",
			keyId: "rsa-root",
			algorithm: "ml-dsa-65",
			oaepHash: "sha256",
		});
		const call = calls[0];
		expect(call?.method).toBe("POST");
		expect(call?.path).toBe("/proxy/kms/v1/byohsm/pqc/seal");
		const body = call?.body as Record<string, unknown>;
		expect(body["tenantId"]).toBe(TENANT);
		expect(body["connectionId"]).toBe("conn-1");
		expect(body["keyId"]).toBe("rsa-root");
		expect(body["algorithm"]).toBe("ml-dsa-65");
		expect(body["oaepHash"]).toBe("sha256");
	});

	it("hspkSign POSTs /proxy/kms/v1/byohsm/pqc/sign with sealedKey + base64 data", async () => {
		// hspkSign parses resp.signature - return one so it does not throw.
		const calls: Array<{ method: string; path: string; body: unknown }> = [];
		const internal = {
			request: async (method: string, path: string, body?: unknown) => {
				const eff =
					body && typeof body === "object" && !Array.isArray(body)
						? { tenantId: TENANT, ...(body as Record<string, unknown>) }
						: body;
				calls.push({ method, path, body: eff });
				return { signature: Buffer.from("sig").toString("base64") };
			},
		};
		const sig = await new KmsClient(internal as never).hspkSign(
			{ connectionId: "conn-1", keyId: "rsa-root", sealedKey: SEALED, oaepHash: "sha1" },
			new Uint8Array([1, 2, 3]),
		);
		const call = calls[0];
		expect(call?.path).toBe("/proxy/kms/v1/byohsm/pqc/sign");
		const body = call?.body as Record<string, unknown>;
		expect(body["connectionId"]).toBe("conn-1");
		expect(body["keyId"]).toBe("rsa-root");
		expect(body["sealedKey"]).toEqual(SEALED); // nested object, not string-mangled
		expect(body["data"]).toBe(Buffer.from([1, 2, 3]).toString("base64"));
		expect(body["oaepHash"]).toBe("sha1");
		expect(Buffer.from(sig).toString()).toBe("sig"); // decodes the returned signature
	});
});

describe("QNSI service clients emit only canonically mounted manifest routes", () => {
	it("covers every public service-client method and resolves every emitted request exactly once", async () => {
		const { readFile } = await import("node:fs/promises");
		const { fileURLToPath } = await import("node:url");
		const { resolveServiceProxyDescriptor, resolveServiceProxyManifestRoute } = await import(
			"@heossihq/qnsi-enforcement-contract/service-proxy-descriptors"
		);
		const { AccessClient } = await import("./access.js");
		const { AiClient } = await import("./ai.js");
		const { AuditClient } = await import("./audit.js");
		const { AuthClient } = await import("./auth.js");
		const { BillingClient } = await import("./billing.js");
		const { CryptoInventoryClient } = await import("./crypto-inventory.js");
		const { SearchClient } = await import("./search.js");
		const { StorageClient } = await import("./storage.js");
		const { TenantClient } = await import("./tenant.js");

		type CapturedCall = { method: string; path: string; body: unknown };
		const calls: CapturedCall[] = [];
		const responseFor = (method: string, requestPath: string): Record<string, unknown> => {
			if (requestPath.endsWith("/sign"))
				return { signature: Buffer.from("sig").toString("base64") };
			if (requestPath.endsWith("/verify")) return { valid: true };
			if (requestPath.endsWith("/wrap"))
				return { wrappedKey: Buffer.from("wrapped").toString("base64") };
			if (requestPath.endsWith("/unwrap"))
				return { dataKey: Buffer.from("plain").toString("base64") };
			if (
				method === "GET" &&
				requestPath.includes("/proxy/storage/v1/buckets/") &&
				requestPath.includes("/objects/")
			) {
				return { dataB64: Buffer.from("object").toString("base64") };
			}
			if (method === "GET" && requestPath === "/proxy/vault/v1/secrets") {
				return { secrets: [{ id: "secret-id", name: "named-secret" }] };
			}
			if (requestPath.endsWith("/value")) return { value: "secret-value" };
			return {};
		};
		const internal = {
			resolveTenantId: async () => TENANT,
			request: async (method: string, requestPath: string, body?: unknown) => {
				calls.push({ method, path: requestPath, body });
				return responseFor(method, requestPath);
			},
		} as never;

		const access = new AccessClient(internal);
		const ai = new AiClient(internal);
		const audit = new AuditClient(internal);
		const auth = new AuthClient(internal);
		const billing = new BillingClient(internal);
		const cryptoInventory = new CryptoInventoryClient(internal);
		const kms = new KmsClient(internal);
		const search = new SearchClient(internal);
		const storage = new StorageClient(internal);
		const tenant = new TenantClient(internal);
		const vault = new VaultClient(internal);

		const publicMethods = (client: object): string[] =>
			Object.getOwnPropertyNames(Object.getPrototypeOf(client))
				.filter((name) => name !== "constructor")
				.sort();
		expect(publicMethods(access)).toEqual(
			[
				"assignRole",
				"checkPermission",
				"createRole",
				"deleteRole",
				"getRole",
				"listRoles",
				"revokeRoleAssignment",
			].sort(),
		);
		expect(publicMethods(ai)).toEqual(
			[
				"activateModel",
				"cancelWorkload",
				"deployModel",
				"getModel",
				"getWorkload",
				"invokeInference",
				"listModels",
				"listWorkloads",
				"registerArtifact",
				"registerModel",
				"submitWorkload",
				"updateModel",
			].sort(),
		);
		expect(publicMethods(audit)).toEqual(["ingestEvents", "listEvents", "logEvent"].sort());
		expect(publicMethods(auth)).toEqual(
			[
				"authenticatePasskeyComplete",
				"authenticatePasskeyStart",
				"deletePasskey",
				"evaluateRisk",
				"federateOIDC",
				"federateSAML",
				"listPasskeys",
				"listRiskPolicies",
				"login",
				"mfaChallenge",
				"mfaVerify",
				"refreshToken",
				"registerPasskeyComplete",
				"registerPasskeyStart",
				"revoke",
			].sort(),
		);
		expect(publicMethods(billing)).toEqual(
			[
				"getCreditBalance",
				"getEntitlements",
				"getInvoice",
				"ingestMeter",
				"ingestMeters",
				"listInvoices",
			].sort(),
		);
		expect(publicMethods(cryptoInventory)).toEqual(
			[
				"discoverAssets",
				"getAsset",
				"getAssetStats",
				"getCbom",
				"getPqcReadinessRecommendations",
				"getPqcReadinessScore",
				"getReadinessScore",
				"importAssets",
				"listAssets",
				"listDiscoveryRuns",
			].sort(),
		);
		expect(publicMethods(kms)).toEqual(
			[
				"createKey",
				"deleteKey",
				"getKey",
				"hspkSeal",
				"hspkSign",
				"listKeys",
				"rotateKey",
				"sign",
				"unwrap",
				"upgradeKey",
				"verify",
				"wrap",
			].sort(),
		);
		expect(publicMethods(search)).toEqual(
			["createIndex", "deleteIndex", "listIndexes", "query", "upsertVectors"].sort(),
		);
		expect(publicMethods(storage)).toEqual(
			["deleteObject", "getObject", "listBuckets", "listObjects", "putObject"].sort(),
		);
		expect(publicMethods(tenant)).toEqual(
			[
				"createTenant",
				"getCryptoPolicy",
				"getCurrentHealth",
				"getCurrentQuotas",
				"getTenant",
				"listTenants",
				"updateTenant",
				"upsertCryptoPolicy",
			].sort(),
		);
		expect(publicMethods(vault)).toEqual(
			[
				"createSecret",
				"deleteSecret",
				"getSecret",
				"getSecretValue",
				"getSecretValueByName",
				"getSecretVersion",
				"listSecretVersions",
				"listSecrets",
				"rotateSecret",
			].sort(),
		);

		const security = {
			controlPlaneTokenSha256: null,
			pqcSignatures: [
				{
					provider: "test-provider",
					algorithm: "ml-dsa-65",
					value: "signature",
					publicKey: "public-key",
				},
			],
			hardwareProvider: null,
			attestationStatus: null,
			attestationProof: null,
		};
		const issuedAt = "2026-07-26T00:00:00.000Z";

		await access.createRole({ name: "reader", permissions: ["read"] });
		await access.getRole("role-id");
		await access.listRoles();
		await access.deleteRole("role-id");
		await access.assignRole({ roleId: "role-id", subjectId: "subject-id" });
		await access.revokeRoleAssignment("assignment-id");
		await access.checkPermission({ subjectId: "subject-id", permission: "read" });

		await ai.registerModel({
			name: "model",
			version: "1",
			provider: "custom",
			modelType: "llm",
		});
		await ai.listModels();
		await ai.getModel("model-id");
		await ai.updateModel("model-id", { description: "updated" });
		await ai.activateModel("model-id");
		await ai.deployModel({ modelId: TENANT, environment: "development" });
		await ai.submitWorkload({
			name: "workload",
			priority: "normal",
			schedulingPolicy: "on-demand",
			containerImage: "registry.example.test/model@sha256:digest",
			command: ["run"],
			env: {},
			resources: { cpu: 1, memoryGiB: 1, gpu: 0, acceleratorType: "cpu" },
			artifacts: [],
			manifest: { algorithm: "ml-dsa-65", pqcSignature: "signature", issuedAt },
		});
		await ai.getWorkload("workload-id");
		await ai.listWorkloads();
		await ai.cancelWorkload("workload-id");
		await ai.invokeInference({ modelDeploymentId: TENANT, input: { prompt: "test" } });
		await ai.registerArtifact({ documentId: TENANT, version: 1 });

		await audit.logEvent({ eventType: "test", payload: {} });
		await audit.ingestEvents([{ eventType: "test", payload: {} }]);
		await audit.listEvents();

		await auth.login({ email: "user@example.test", password: "password", tenantId: TENANT });
		await auth.refreshToken("refresh-token");
		await auth.revoke("refresh-token");
		await auth.registerPasskeyStart("user-id", TENANT);
		await auth.registerPasskeyComplete({ userId: "user-id" });
		await auth.authenticatePasskeyStart({ tenantId: TENANT });
		await auth.authenticatePasskeyComplete({ tenantId: TENANT });
		await auth.listPasskeys("user-id", TENANT);
		await auth.deletePasskey("credential-id", "user-id");
		await auth.mfaChallenge({ tenantId: TENANT });
		await auth.mfaVerify({ tenantId: TENANT });
		await auth.federateSAML({ providerId: "provider-id" });
		await auth.federateOIDC({ providerId: "provider-id" });
		await auth.evaluateRisk({ tenantId: TENANT });
		await auth.listRiskPolicies(TENANT);

		const meter = {
			source: "storage-service",
			meterType: "storage.bytes",
			quantity: 1,
			unit: "bytes",
			currency: "USD" as const,
			recordedAt: issuedAt,
			metadata: {},
			security,
		};
		await billing.getEntitlements();
		await billing.ingestMeter(meter);
		await billing.ingestMeters([meter]);
		await billing.listInvoices();
		await billing.getInvoice("invoice-id");
		await billing.getCreditBalance(TENANT);

		await cryptoInventory.listAssets();
		await cryptoInventory.getAsset("asset-id");
		await cryptoInventory.getAssetStats();
		await cryptoInventory.discoverAssets({ targets: ["target"] });
		await cryptoInventory.getReadinessScore();
		await cryptoInventory.getPqcReadinessScore();
		await cryptoInventory.getPqcReadinessRecommendations();
		await cryptoInventory.getCbom();
		await cryptoInventory.listDiscoveryRuns();
		await cryptoInventory.importAssets({ assets: [] });

		await kms.createKey({ intent: "signing" });
		await kms.upgradeKey("key-id");
		await kms.listKeys();
		await kms.getKey("key-id");
		await kms.rotateKey("key-id");
		await kms.deleteKey("key-id");
		await kms.sign("key-id", new Uint8Array([1]));
		await kms.verify("key-id", new Uint8Array([1]), new Uint8Array([2]));
		await kms.wrap("key-id", new Uint8Array([1]));
		await kms.unwrap("key-id", new Uint8Array([1]));
		const sealedKey = {
			scheme: "hspk-hsm-cek-aes256gcm-v1",
			algorithm: "ml-dsa-65",
			hsmKeyId: "hsm-key",
			wrappedCek: "AA==",
			iv: "AA==",
			ciphertext: "AA==",
			authTag: "AA==",
			publicKey: "AA==",
			sealedAt: "2026-07-19T00:00:00.000Z",
		};
		await kms.hspkSeal({ connectionId: "connection-id", keyId: "hsm-key" });
		await kms.hspkSign(
			{ connectionId: "connection-id", keyId: "hsm-key", sealedKey },
			new Uint8Array([1]),
		);

		await search.createIndex({ name: "index", dimensions: 3 });
		await search.listIndexes();
		await search.deleteIndex("index");
		await search.upsertVectors("index", [{ id: "vector", values: [1, 2, 3] }]);
		await search.query("index", { vector: [1, 2, 3], topK: 1 });

		await storage.putObject("bucket", "key", { data: new Uint8Array([1]) });
		await storage.getObject("bucket", "key");
		await storage.deleteObject("bucket", "key");
		await storage.listObjects("bucket");
		await storage.listBuckets();

		await tenant.createTenant({ name: "Tenant", slug: "tenant", security });
		await tenant.getTenant(TENANT);
		await tenant.updateTenant(TENANT, { name: "Updated", security });
		await tenant.listTenants();
		await tenant.getCryptoPolicy(TENANT);
		await tenant.upsertCryptoPolicy(TENANT, { policyTier: "default" });
		await tenant.getCurrentHealth(TENANT);
		await tenant.getCurrentQuotas(TENANT);

		await vault.createSecret({ name: "secret", payloadB64: "AA==" });
		await vault.getSecret("secret-id");
		await vault.getSecretValue("secret-id");
		await vault.listSecrets();
		await vault.getSecretValueByName("named-secret");
		await vault.getSecretVersion("secret-id", 1);
		await vault.rotateSecret("secret-id", "AA==");
		await vault.deleteSecret("secret-id");
		await vault.listSecretVersions("secret-id");

		const callFor = (method: string, path: string) =>
			calls.find((call) => call.method === method && call.path === path);
		expect(callFor("POST", "/proxy/ai/v1/registry/models")?.body).toMatchObject({
			modelType: "llm",
		});
		expect(callFor("POST", "/proxy/ai/v1/workloads")?.body).toMatchObject({
			name: "workload",
			priority: "normal",
			schedulingPolicy: "on-demand",
		});
		expect(callFor("POST", "/proxy/ai/v1/inference")?.body).toEqual({
			modelDeploymentId: TENANT,
			input: { prompt: "test" },
		});
		expect(callFor("POST", "/proxy/ai/v1/artifacts")?.body).toEqual({
			documentId: TENANT,
			version: 1,
		});
		expect(callFor("POST", "/proxy/auth/token/revoke")?.body).toEqual({
			refreshToken: "refresh-token",
		});
		const meterCalls = calls.filter(
			(call) => call.method === "POST" && call.path === "/proxy/billing/v1/meters",
		);
		expect(meterCalls).toHaveLength(2);
		for (const call of meterCalls) {
			expect(call.body).toMatchObject({
				meters: [
					{
						tenantId: TENANT,
						source: "storage-service",
						meterType: "storage.bytes",
						security,
					},
				],
			});
		}
		expect(callFor("POST", "/proxy/tenant/v1/tenants")?.body).toMatchObject({
			slug: "tenant",
			security,
		});
		expect(callFor("PATCH", `/proxy/tenant/v1/tenants/${TENANT}`)?.body).toMatchObject({
			name: "Updated",
			security,
		});

		expect(calls).toHaveLength(93);
		const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
		const manifests = new Map<string, { routes: Array<{ method: string; path: string }> }>();
		for (const call of calls) {
			const externalPath = new URL(call.path, "https://edge.example.test").pathname;
			const descriptor = resolveServiceProxyDescriptor(externalPath);
			expect(descriptor.manifestDirectory, `${call.method} ${externalPath}`).not.toBeNull();
			const directory = descriptor.manifestDirectory as string;
			let manifest = manifests.get(directory);
			if (!manifest) {
				manifest = JSON.parse(
					await readFile(`${repoRoot}apps/${directory}/service.manifest.json`, "utf8"),
				) as { routes: Array<{ method: string; path: string }> };
				manifests.set(directory, manifest);
			}
			expect(
				resolveServiceProxyManifestRoute(descriptor, manifest.routes, call.method, externalPath),
				`${call.method} ${externalPath}`,
			).toBeDefined();
		}
	});
});
