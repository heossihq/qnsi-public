import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentConfig } from "./config.js";
import {
	createOfflineReportBundle,
	listOfflineReportBundles,
	offlineBundleSigningMessage,
	readOfflineReportBundle,
	submitOfflineReportBundle,
	writeOfflineReportBundle,
} from "./offline-bundle.js";
import { createReportPayload, deriveHmacKey } from "./reporter.js";

let directory: string;
let config: AgentConfig;

beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), "qnsi-offline-bundle-"));
	config = {
		agentId: "00000000-0000-4000-8000-000000000001",
		agentSecret: crypto.randomBytes(32).toString("hex"),
		endpoint: "https://api.qnsi.heossi.com",
		tenantId: "00000000-0000-4000-8000-000000000002",
		scanPaths: ["/restricted"],
		intervalSecs: 300,
		logLevel: "silent",
		hostname: "restricted-host",
		stateDir: directory,
	};
});

afterEach(async () => {
	vi.unstubAllGlobals();
	await fs.rm(directory, { recursive: true, force: true });
});

describe("offline scan bundles", () => {
	it("writes a restrictive portable bundle whose signature verifies", async () => {
		const payload = createReportPayload(config, [
			{ type: "ssh_key", path: "/restricted/id_rsa", algorithm: "RSA", keySize: 3072 },
		]);
		const bundle = createOfflineReportBundle(config, payload);
		const file = await writeOfflineReportBundle(directory, bundle);
		const restored = await readOfflineReportBundle(file);
		const expectedSignature = crypto
			.createHmac("sha256", deriveHmacKey(config.agentSecret))
			.update(offlineBundleSigningMessage(restored))
			.digest("hex");

		expect(restored.signature.value).toBe(expectedSignature);
		expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
		expect(await listOfflineReportBundles(directory)).toEqual([file]);
	});

	it("rejects modified findings before import", async () => {
		const bundle = createOfflineReportBundle(config, createReportPayload(config, []));
		const file = await writeOfflineReportBundle(directory, bundle);
		const parsed = JSON.parse(await fs.readFile(file, "utf8")) as {
			payload: { hostname: string };
		};
		parsed.payload.hostname = "modified-host";
		await fs.writeFile(file, JSON.stringify(parsed), "utf8");

		await expect(readOfflineReportBundle(file)).rejects.toThrow("integrity check failed");
	});

	it("imports a bundle without transmitting the agent secret", async () => {
		const bundle = createOfflineReportBundle(config, createReportPayload(config, []));
		const fetchMock = vi.fn().mockResolvedValue({
			status: 202,
			json: async () => ({
				accepted: true,
				bundleId: bundle.bundleId,
				payloadHash: bundle.payloadHash,
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		await submitOfflineReportBundle(config.endpoint, bundle);
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(String(init.body)).not.toContain(config.agentSecret);
		expect(init.headers).toEqual(expect.objectContaining({ "x-qnsp-tenant": config.tenantId }));
	});
});
