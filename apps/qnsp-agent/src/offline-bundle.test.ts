import * as crypto from "node:crypto";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentConfig } from "./config.js";
import {
	assertOfflineReportBundle,
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
	it("rejects a payload belonging to another agent", () => {
		const payload = {
			...createReportPayload(config, []),
			agentId: "00000000-0000-4000-8000-000000000099",
		};
		expect(() => createOfflineReportBundle(config, payload)).toThrow("payload agent mismatch");
	});

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

	it("rejects every required structure-field failure", () => {
		const valid = createOfflineReportBundle(config, createReportPayload(config, []));
		const invalidValues: unknown[] = [
			null,
			{ ...valid, version: 2 },
			{ ...valid, bundleId: "" },
			{ ...valid, tenantId: "" },
			{ ...valid, agentId: "" },
			{ ...valid, createdAt: "" },
			{ ...valid, payload: null },
			{ ...valid, payloadHash: "" },
			{ ...valid, signature: { ...valid.signature, algorithm: "RSA" } },
			{ ...valid, signature: { ...valid.signature, value: "invalid" } },
		];

		for (const value of invalidValues) {
			expect(() => assertOfflineReportBundle(value)).toThrow(/not an object|structure is invalid/);
		}
	});

	it("rejects a bundle whose envelope and payload name different agents", () => {
		const valid = createOfflineReportBundle(config, createReportPayload(config, []));
		const mismatched = {
			...valid,
			agentId: "00000000-0000-4000-8000-000000000099",
		};
		expect(() => assertOfflineReportBundle(mismatched)).toThrow("bundle agent mismatch");
	});

	it("lists a direct file and filters and orders directory entries", async () => {
		const firstBundle = createOfflineReportBundle(config, createReportPayload(config, []));
		const secondBundle = createOfflineReportBundle(config, createReportPayload(config, []));
		const first = path.join(directory, `b-${firstBundle.bundleId}.qnsi-scan.json`);
		const second = path.join(directory, `a-${secondBundle.bundleId}.qnsi-scan.json`);
		await fs.writeFile(first, JSON.stringify(firstBundle));
		await fs.writeFile(second, JSON.stringify(secondBundle));
		await fs.writeFile(path.join(directory, "ignored.txt"), "ignored");

		expect(await listOfflineReportBundles(first)).toEqual([first]);
		expect(await listOfflineReportBundles(directory)).toEqual([second, first]);
	});

	it("rejects a non-file, non-directory input", async () => {
		const specialFileStat = {
			isFile: () => false,
			isDirectory: () => false,
		};
		await expect(listOfflineReportBundles("/special", async () => specialFileStat)).rejects.toThrow(
			"input must be a file or directory",
		);
	});

	it("cleans an interrupted staging write and preserves the original error", async () => {
		const valid = createOfflineReportBundle(config, createReportPayload(config, []));
		const sortableTimestamp = valid.createdAt.replace(/[^0-9]/g, "");
		const stagingPath = path.join(
			directory,
			`${sortableTimestamp}-${valid.bundleId}.qnsi-scan.json.pending-write`,
		);
		const failingBundle = {
			...valid,
			toJSON() {
				fsSync.unlinkSync(stagingPath);
				throw new Error("serialization failed");
			},
		};

		await expect(writeOfflineReportBundle(directory, failingBundle)).rejects.toThrow(
			"serialization failed",
		);
		await expect(fs.stat(stagingPath)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("supports the Windows persistence path without directory fsync", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
		Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
		try {
			const bundle = createOfflineReportBundle(config, createReportPayload(config, []));
			await writeOfflineReportBundle(directory, bundle);
		} finally {
			if (descriptor) Object.defineProperty(process, "platform", descriptor);
		}
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

	it("reports a non-202 import response with its status and body", async () => {
		const bundle = createOfflineReportBundle(config, createReportPayload(config, []));
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ status: 409, text: async () => "duplicate bundle" }),
		);

		await expect(submitOfflineReportBundle(`${config.endpoint}/`, bundle)).rejects.toThrow(
			"Offline bundle import rejected (409): duplicate bundle",
		);
	});
});
