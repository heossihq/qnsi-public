import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearActivationCache } from "./_activation/index.js";
import { QnsiClient } from "./client.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
beforeEach(() => clearActivationCache());
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

// Controlled HTTP fixtures exercise the real shared client; not live assurance.
function setup() {
	const calls: Array<{
		method: string;
		path: string;
		query: URLSearchParams;
		body: unknown;
		headers: Headers;
	}> = [];
	const response = { status: 200, body: {} as Record<string, unknown> };
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === "/billing/v1/sdk/activate")
				return Response.json({
					activated: true,
					tenantId: TENANT,
					tier: "free",
					limits: {
						storageGB: 10,
						apiCalls: 50000,
						enclavesEnabled: false,
						aiTrainingEnabled: false,
						aiInferenceEnabled: false,
						sseEnabled: true,
						vaultEnabled: true,
					},
					activationToken: "owned-test-token",
					expiresInSeconds: 3600,
					activatedAt: new Date().toISOString(),
				});
			calls.push({
				method: init?.method ?? "GET",
				path: url.pathname,
				query: url.searchParams,
				body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
				headers: new Headers(init?.headers),
			});
			return Response.json(response.body, { status: response.status });
		}),
	);
	return {
		client: new QnsiClient({ apiKey: "owned-test-key", baseUrl: "https://owned.example.test" }),
		calls,
		response,
	};
}

it("uses approved-reference config fields and catalog filters through shared activation", async () => {
	const { client, calls, response } = setup();
	response.body = { engines: [] };
	expect(await client.vault.listDynamicSecretEngines()).toEqual({ engines: [] });
	for (const request of [
		{ name: "owned", engineType: "postgresql", connectionRef: "approved-test-reference" },
		{
			name: "owned",
			engineType: "postgresql",
			connectionRef: "approved-test-reference",
			secretType: "database",
			roleTemplate: {},
			defaultTtlSeconds: 60,
			maxTtlSeconds: 120,
			tenantId: "explicit-tenant",
		},
	]) {
		response.status = 201;
		response.body = { id: "owned-config" };
		await client.vault.createDynamicSecretConfig(request, {
			idempotencyKey: "owned-config-idempotency",
		});
		expect(calls.at(-1)).toMatchObject({
			method: "POST",
			path: "/proxy/vault/v1/dynamic-secrets/configs",
			body: { ...request, tenantId: "tenantId" in request ? request.tenantId : TENANT },
		});
		expect(calls.at(-1)?.headers.get("idempotency-key")).toBe("owned-config-idempotency");
	}
	response.status = 200;
	for (const query of [undefined, { engineType: "postgresql" }, { secretType: "database" }]) {
		await client.vault.listDynamicSecretConfigs(query);
		expect(calls.at(-1)?.query.get("engineType")).toBe(query?.engineType ?? null);
		expect(calls.at(-1)?.query.get("secretType")).toBe(query?.secretType ?? null);
	}
	response.status = 503;
	response.body = { error: "DYNAMIC_SECRET_STATS_UNAVAILABLE" };
	await expect(client.vault.getDynamicSecretStats()).rejects.toMatchObject({ statusCode: 503 });
});

it("preserves engine credentials, recovery states, encoded IDs and queued revocation", async () => {
	const { client, calls, response } = setup();
	for (const request of [undefined, { ttlSeconds: 60, metadata: { scope: "owned" } }]) {
		response.body = { leaseId: "owned-lease", credentials: { sessionToken: "owned-test-session" } };
		expect(await client.vault.requestCredentials("config/encoded", request)).toEqual(response.body);
		expect(calls.at(-1)).toMatchObject({
			method: "POST",
			path: "/proxy/vault/v1/dynamic-secrets/configs/config%2Fencoded/credentials",
			body: { ...request, tenantId: TENANT },
		});
	}
	for (const include of [undefined, false, true]) {
		response.body = { leases: [{ status: "revoking", metadata: null }] };
		expect(await client.vault.listLeases("config/encoded", include)).toEqual(response.body);
		expect(calls.at(-1)?.query.get("includeAllStatuses")).toBe(
			include === undefined ? null : String(include),
		);
	}
	for (const ttlSeconds of [undefined, 120]) {
		await client.vault.renewLease("lease/encoded", ttlSeconds);
		expect(calls.at(-1)).toMatchObject({
			method: "POST",
			path: "/proxy/vault/v1/dynamic-secrets/leases/lease%2Fencoded/renew",
			body: ttlSeconds === undefined ? { tenantId: TENANT } : { tenantId: TENANT, ttlSeconds },
		});
	}
	response.status = 202;
	response.body = { leaseId: "owned-lease", status: "revoking" };
	expect(await client.vault.revokeLease("lease/encoded")).toEqual(response.body);
});

it("retains secret methods and honors inventory tenant/source arguments", async () => {
	const { client, calls } = setup();
	await client.vault.getSecret("secret/encoded");
	await client.vault.getSecretValue("secret/encoded");
	await client.vault.getSecretVersion("secret/encoded", 1);
	await client.vault.rotateSecret("secret/encoded", "Zg==");
	await client.vault.deleteSecret("secret/encoded");
	await client.vault.listSecretVersions("secret/encoded");
	expect(calls.map((call) => call.path)).toEqual([
		"/proxy/vault/v1/secrets/secret%2Fencoded",
		"/proxy/vault/v1/secrets/secret%2Fencoded/value",
		"/proxy/vault/v1/secrets/secret%2Fencoded/versions/1",
		"/proxy/vault/v1/secrets/secret%2Fencoded/rotate",
		"/proxy/vault/v1/secrets/secret%2Fencoded",
		"/proxy/vault/v1/secrets/secret%2Fencoded/versions",
	]);
	for (const tenant of [undefined, "explicit-tenant", ""]) {
		await client.cryptoInventory.getAssetStats(tenant);
		expect(calls.at(-1)?.query.get("tenantId")).toBe(tenant ?? TENANT);
		await client.cryptoInventory.getReadinessScore(tenant);
		expect(calls.at(-1)?.query.get("tenantId")).toBe(tenant ?? TENANT);
	}
	await client.cryptoInventory.discoverAssets({ source: "code_repo" });
	expect(calls.at(-1)?.body).toEqual({ source: "code_repo", tenantId: TENANT });
});

it("rejects invalid identifiers and versions before activation or HTTP", () => {
	const { client, calls } = setup();
	for (const id of ["", ".", "..", null, undefined, true, 5] as never[])
		for (const operation of [
			() => client.vault.getSecret(id),
			() => client.vault.getSecretValue(id),
			() => client.vault.getSecretVersion(id, 1),
			() => client.vault.rotateSecret(id, "Zg=="),
			() => client.vault.deleteSecret(id),
			() => client.vault.listSecretVersions(id),
			() => client.vault.requestCredentials(id),
			() => client.vault.listLeases(id),
			() => client.vault.renewLease(id),
			() => client.vault.revokeLease(id),
		])
			expect(operation).toThrow(TypeError);
	for (const version of [
		0,
		-1,
		1.5,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.MAX_SAFE_INTEGER + 1,
	])
		expect(() => client.vault.getSecretVersion("owned", version)).toThrow(TypeError);
	expect(calls).toHaveLength(0);
	expect(fetch).not.toHaveBeenCalled();
});
