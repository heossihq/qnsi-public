/**
 * Public PQC benchmark runner — schema v3.
 *
 * v3 (2026-05-14):
 *   - Batched memory measurement (N=200 instances ÷ N for stable per-instance RSS)
 *   - Multi-process concurrency via child_process.fork (real multi-core scaling)
 *   - Noble comparison: side-by-side @heossi/liboqs-native vs @noble/post-quantum
 *
 * v2 added cold-start, single-instance memory (deprecated by v3 batched), and
 * in-process concurrency (kept; still surfaces saturation finding).
 * v1 captured steady-state p50/p95/p99 percentiles.
 *
 * Output: `apps/web/public/pqc-benchmarks/pqc-latest.json` plus historical
 * snapshot `pqc-<UTC>.json`.
 *
 * Run:  pnpm --filter @heossi/qnsi-web-portal run bench:pqc
 *
 * Multi-process mode: the same script forks itself with
 * `PQC_BENCH_CHILD_MODE=1` to spawn workers; each child runs N ops then
 * writes its timing to stdout.
 */
import { type ChildProcess, execSync, fork } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, cpus, platform, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
	ColdStartMeasurement,
	ConcurrencyMeasurement,
	KemBenchmark,
	MemoryFootprint,
	MultiProcessConcurrencyMeasurement,
	NobleComparison,
	OperationMeasurement,
	PqcBenchmarkSuite,
	SignatureBenchmark,
} from "../lib/benchmark-types.js";

const require = createRequire(import.meta.url);
const liboqs = require("@heossi/liboqs-native") as {
	KEM: new (algorithm: string) => KemHandle;
	Sig: new (algorithm: string) => SigHandle;
	version(): string;
	getSupportedKems(): string[];
	getSupportedSignatures(): string[];
};

interface KemHandle {
	generateKeypair(): { publicKey: Buffer; secretKey: Buffer };
	encapsulate(publicKey: Buffer): { ciphertext: Buffer; sharedSecret: Buffer };
	decapsulate(ciphertext: Buffer, secretKey: Buffer): Buffer;
	free(): void;
}

interface SigHandle {
	generateKeypair(): { publicKey: Buffer; secretKey: Buffer };
	sign(message: Buffer, privateKey: Buffer): Buffer;
	verify(message: Buffer, signature: Buffer, publicKey: Buffer): boolean;
	free(): void;
}

interface KemTarget {
	readonly algorithm: string;
	readonly liboqsName: string;
	readonly fipsStandard: string;
	readonly securityCategory: number;
	readonly iterations: number;
}

interface SignatureTarget {
	readonly algorithm: string;
	readonly liboqsName: string;
	readonly fipsStandard: string;
	readonly securityCategory: number;
	readonly iterations: number;
}

const KEM_TARGETS: readonly KemTarget[] = [
	{
		algorithm: "ML-KEM-512",
		liboqsName: "ML-KEM-512",
		fipsStandard: "FIPS 203",
		securityCategory: 1,
		iterations: 500,
	},
	{
		algorithm: "ML-KEM-768",
		liboqsName: "ML-KEM-768",
		fipsStandard: "FIPS 203",
		securityCategory: 3,
		iterations: 500,
	},
	{
		algorithm: "ML-KEM-1024",
		liboqsName: "ML-KEM-1024",
		fipsStandard: "FIPS 203",
		securityCategory: 5,
		iterations: 500,
	},
];

const SIGNATURE_TARGETS: readonly SignatureTarget[] = [
	{
		algorithm: "ML-DSA-44",
		liboqsName: "ML-DSA-44",
		fipsStandard: "FIPS 204",
		securityCategory: 2,
		iterations: 200,
	},
	{
		algorithm: "ML-DSA-65",
		liboqsName: "ML-DSA-65",
		fipsStandard: "FIPS 204",
		securityCategory: 3,
		iterations: 200,
	},
	{
		algorithm: "ML-DSA-87",
		liboqsName: "ML-DSA-87",
		fipsStandard: "FIPS 204",
		securityCategory: 5,
		iterations: 100,
	},
	{
		algorithm: "Falcon-512",
		liboqsName: "Falcon-512",
		fipsStandard: "FN-DSA",
		securityCategory: 1,
		iterations: 50,
	},
	{
		algorithm: "SLH-DSA-SHA2-128f",
		liboqsName: "SLH_DSA_PURE_SHA2_128F",
		fipsStandard: "FIPS 205",
		securityCategory: 1,
		iterations: 25,
	},
	{
		algorithm: "SLH-DSA-SHA2-256f",
		liboqsName: "SLH_DSA_PURE_SHA2_256F",
		fipsStandard: "FIPS 205",
		securityCategory: 5,
		iterations: 10,
	},
];

const MESSAGE = Buffer.from(
	"QNSI PQC benchmark — message used for sign/verify rounds. Length is intentionally short " +
		"to mirror typical control-plane payloads (auth tokens, audit signatures, billing meters).",
	"utf8",
);

const COLD_START_SAMPLES = 5;
const CONCURRENCY_LEVELS: readonly number[] = [1, 2, 4, 8, 16];
const CONCURRENCY_OPS_PER_WORKER = 50;
const MEMORY_BATCH_SIZE = 200;
const MULTI_PROCESS_LEVELS: readonly number[] = [1, 2, 4, 8];
const MULTI_PROCESS_OPS_PER_CHILD = 100;

/* ════════════════════════════════════════════════════════════════════ */
/*  Child mode — used by multi-process concurrency measurement          */
/* ════════════════════════════════════════════════════════════════════ */

if (process.env["PQC_BENCH_CHILD_MODE"] === "1") {
	const algorithm = process.env["PQC_BENCH_ALGORITHM"] ?? "";
	const algorithmType = process.env["PQC_BENCH_ALGORITHM_TYPE"] ?? "";
	const ops = Number(process.env["PQC_BENCH_OPS"] ?? 0);
	runChildKeygen(algorithm, algorithmType as "kem" | "sig", ops);
} else {
	void main();
}

function runChildKeygen(liboqsName: string, type: "kem" | "sig", ops: number): void {
	const handle: KemHandle | SigHandle =
		type === "kem" ? new liboqs.KEM(liboqsName) : new liboqs.Sig(liboqsName);
	// Untimed warm-up
	handle.generateKeypair();
	const start = process.hrtime.bigint();
	for (let i = 0; i < ops; i++) {
		handle.generateKeypair();
	}
	const end = process.hrtime.bigint();
	const durationMs = Number(end - start) / 1_000_000;
	handle.free();
	process.stdout.write(JSON.stringify({ ops, durationMs }));
	process.exit(0);
}

/* ════════════════════════════════════════════════════════════════════ */
/*  Parent mode — orchestrates all measurements                          */
/* ════════════════════════════════════════════════════════════════════ */

function measure(
	operation: OperationMeasurement["operation"],
	iterations: number,
	fn: () => void,
): OperationMeasurement {
	fn();
	const timingsMs: number[] = new Array(iterations);
	for (let i = 0; i < iterations; i++) {
		const start = process.hrtime.bigint();
		fn();
		const end = process.hrtime.bigint();
		timingsMs[i] = Number(end - start) / 1_000_000;
	}
	timingsMs.sort((a, b) => a - b);
	const meanMs = timingsMs.reduce((sum, t) => sum + t, 0) / iterations;
	return {
		operation,
		p50Ms: round(timingsMs[Math.floor(iterations * 0.5)] ?? 0),
		p95Ms: round(timingsMs[Math.floor(iterations * 0.95)] ?? 0),
		p99Ms: round(timingsMs[Math.floor(iterations * 0.99)] ?? 0),
		meanMs: round(meanMs),
		opsPerSecond: meanMs > 0 ? Math.round(1000 / meanMs) : 0,
	};
}

function measureColdStart(
	createHandle: () => { invoke: () => void; free: () => void },
	steadyStateP50Ms: number,
): ColdStartMeasurement {
	const { invoke, free } = createHandle();
	try {
		const firstNMs: number[] = [];
		for (let i = 0; i < COLD_START_SAMPLES; i++) {
			const start = process.hrtime.bigint();
			invoke();
			const end = process.hrtime.bigint();
			firstNMs.push(Number(end - start) / 1_000_000);
		}
		const firstCallMs = firstNMs[0] ?? 0;
		const warmupSamples = firstNMs.slice(1);
		const warmupMedian =
			warmupSamples.length > 0
				? ([...warmupSamples].sort((a, b) => a - b)[Math.floor(warmupSamples.length / 2)] ?? 0)
				: firstCallMs;
		const coldToWarmRatio = steadyStateP50Ms > 0 ? round(firstCallMs / steadyStateP50Ms) : 0;
		return {
			operation: "keygen",
			firstNMs: firstNMs.map(round),
			firstCallMs: round(firstCallMs),
			warmupMedianMs: round(warmupMedian),
			coldToWarmRatio,
		};
	} finally {
		free();
	}
}

/**
 * Batched memory footprint: create N=200 instances + perform 1 keygen per
 * instance, then divide RSS delta by N. This produces a reliable per-instance
 * figure that single-instance measurement (v2) could not provide because
 * single-instance RSS sits at the OS-page noise floor.
 */
function measureMemoryFootprint(
	createHandle: () => { invoke: () => void; free: () => void },
): MemoryFootprint {
	if (global.gc) global.gc();
	const baseline = process.memoryUsage();

	const handles: Array<{ invoke: () => void; free: () => void }> = [];
	for (let i = 0; i < MEMORY_BATCH_SIZE; i++) {
		const h = createHandle();
		h.invoke();
		handles.push(h);
	}
	const post = process.memoryUsage();

	for (const h of handles) h.free();

	const rssDelta = Math.max(0, post.rss - baseline.rss);
	const heapDelta = Math.max(0, post.heapUsed - baseline.heapUsed);

	return {
		batchSize: MEMORY_BATCH_SIZE,
		baselineRssBytes: baseline.rss,
		postBatchRssBytes: post.rss,
		perInstanceRssBytes: Math.round(rssDelta / MEMORY_BATCH_SIZE),
		v8HeapDeltaBytes: heapDelta,
		perInstanceHeapBytes: Math.round(heapDelta / MEMORY_BATCH_SIZE),
	};
}

async function measureConcurrency(
	algorithmFactory: () => { invoke: () => void; free: () => void },
	workers: number,
	baselineOpsPerSecond: number,
): Promise<ConcurrencyMeasurement> {
	const handles = Array.from({ length: workers }, () => algorithmFactory());
	const start = process.hrtime.bigint();
	await Promise.all(
		handles.map(
			(handle) =>
				new Promise<void>((resolve) => {
					setImmediate(() => {
						for (let i = 0; i < CONCURRENCY_OPS_PER_WORKER; i++) handle.invoke();
						resolve();
					});
				}),
		),
	);
	const end = process.hrtime.bigint();
	const durationMs = Number(end - start) / 1_000_000;
	const totalOps = workers * CONCURRENCY_OPS_PER_WORKER;
	const opsPerSecond = durationMs > 0 ? Math.round((totalOps * 1000) / durationMs) : 0;
	const scalingEfficiency =
		baselineOpsPerSecond > 0 ? round(opsPerSecond / (baselineOpsPerSecond * workers)) : 0;
	for (const handle of handles) handle.free();
	return {
		workers,
		operation: "keygen",
		totalOps,
		durationMs: round(durationMs),
		opsPerSecond,
		scalingEfficiency,
	};
}

/**
 * Multi-process concurrency: spawn N child processes via child_process.fork,
 * each runs OPS_PER_CHILD keygens, parent aggregates wall-clock time across
 * all children. This is the measurement that reflects real multi-core
 * scaling on production deployments.
 */
async function measureMultiProcess(
	liboqsName: string,
	type: "kem" | "sig",
	processes: number,
	baselineOpsPerSecond: number,
): Promise<MultiProcessConcurrencyMeasurement> {
	const here = dirname(fileURLToPath(import.meta.url));
	const scriptPath = join(here, "run-pqc-benchmarks.ts");

	const start = process.hrtime.bigint();
	const childPromises = Array.from(
		{ length: processes },
		() =>
			new Promise<{ durationMs: number; ops: number }>((resolve, reject) => {
				const child: ChildProcess = fork(scriptPath, [], {
					env: {
						...process.env,
						PQC_BENCH_CHILD_MODE: "1",
						PQC_BENCH_ALGORITHM: liboqsName,
						PQC_BENCH_ALGORITHM_TYPE: type,
						PQC_BENCH_OPS: String(MULTI_PROCESS_OPS_PER_CHILD),
					},
					execArgv: ["--import", "tsx"],
					stdio: ["ignore", "pipe", "inherit", "ipc"],
				});
				let out = "";
				child.stdout?.on("data", (chunk: Buffer) => {
					out += chunk.toString("utf8");
				});
				child.on("close", (code) => {
					if (code !== 0) {
						reject(new Error(`child process exited with code ${code}`));
						return;
					}
					try {
						const parsed = JSON.parse(out.trim()) as { ops: number; durationMs: number };
						resolve(parsed);
					} catch (err) {
						reject(new Error(`child output unparseable: ${out}: ${err}`));
					}
				});
				child.on("error", reject);
			}),
	);

	const results = await Promise.all(childPromises);
	const end = process.hrtime.bigint();
	const wallClockMs = Number(end - start) / 1_000_000;
	const totalOps = results.reduce((sum, r) => sum + r.ops, 0);
	const opsPerSecond = wallClockMs > 0 ? Math.round((totalOps * 1000) / wallClockMs) : 0;
	const scalingEfficiency =
		baselineOpsPerSecond > 0 ? round(opsPerSecond / (baselineOpsPerSecond * processes)) : 0;

	return {
		processes,
		operation: "keygen",
		opsPerProcess: MULTI_PROCESS_OPS_PER_CHILD,
		totalOps,
		durationMs: round(wallClockMs),
		opsPerSecond,
		scalingEfficiency,
	};
}

/**
 * Noble comparison: same algorithm executed by @noble/post-quantum pure-JS
 * implementation. Returns null when noble doesn't support the algorithm.
 */
async function measureNobleComparison(
	algorithm: string,
	liboqsKeygenP50: number,
	liboqsKeygenOps: number,
	iterations: number,
): Promise<NobleComparison | null> {
	let nobleKeygen: (() => unknown) | null = null;
	let noteText: string | undefined;

	try {
		if (algorithm.startsWith("ML-KEM-")) {
			const ml = await import("@noble/post-quantum/ml-kem.js");
			const variant =
				algorithm === "ML-KEM-512"
					? ml.ml_kem512
					: algorithm === "ML-KEM-768"
						? ml.ml_kem768
						: ml.ml_kem1024;
			nobleKeygen = () => variant.keygen();
		} else if (algorithm.startsWith("ML-DSA-")) {
			const ml = await import("@noble/post-quantum/ml-dsa.js");
			const variant =
				algorithm === "ML-DSA-44"
					? ml.ml_dsa44
					: algorithm === "ML-DSA-65"
						? ml.ml_dsa65
						: ml.ml_dsa87;
			nobleKeygen = () => variant.keygen();
		} else if (algorithm === "SLH-DSA-SHA2-128f") {
			const slh = await import("@noble/post-quantum/slh-dsa.js");
			nobleKeygen = () => slh.slh_dsa_sha2_128f.keygen();
		} else if (algorithm === "SLH-DSA-SHA2-256f") {
			const slh = await import("@noble/post-quantum/slh-dsa.js");
			nobleKeygen = () => slh.slh_dsa_sha2_256f.keygen();
		} else if (algorithm === "Falcon-512") {
			noteText =
				"Falcon (FN-DSA pending FIPS 206) is not in @noble/post-quantum's catalog as of 0.6.0.";
		}
	} catch (err) {
		noteText = `Failed to load noble variant for ${algorithm}: ${err}`;
	}

	if (!nobleKeygen) {
		return noteText
			? {
					liboqsKeygenP50Ms: liboqsKeygenP50,
					nobleKeygenP50Ms: 0,
					liboqsKeygenOpsPerSecond: liboqsKeygenOps,
					nobleKeygenOpsPerSecond: 0,
					speedupRatio: 0,
					note: noteText,
				}
			: null;
	}

	// Warm-up
	nobleKeygen();
	const sampleCount = Math.min(iterations, 100);
	const timingsMs: number[] = new Array(sampleCount);
	for (let i = 0; i < sampleCount; i++) {
		const start = process.hrtime.bigint();
		nobleKeygen();
		const end = process.hrtime.bigint();
		timingsMs[i] = Number(end - start) / 1_000_000;
	}
	timingsMs.sort((a, b) => a - b);
	const nobleP50 = timingsMs[Math.floor(sampleCount * 0.5)] ?? 0;
	const meanMs = timingsMs.reduce((sum, t) => sum + t, 0) / sampleCount;
	const nobleOps = meanMs > 0 ? Math.round(1000 / meanMs) : 0;
	const speedup = nobleP50 > 0 ? round(nobleP50 / liboqsKeygenP50) : 0;

	return {
		liboqsKeygenP50Ms: liboqsKeygenP50,
		nobleKeygenP50Ms: round(nobleP50),
		liboqsKeygenOpsPerSecond: liboqsKeygenOps,
		nobleKeygenOpsPerSecond: nobleOps,
		speedupRatio: speedup,
	};
}

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}

async function benchmarkKem(target: KemTarget): Promise<KemBenchmark> {
	const kem = new liboqs.KEM(target.liboqsName);
	let result: KemBenchmark;
	try {
		const baseKeypair = kem.generateKeypair();
		const baseEncap = kem.encapsulate(baseKeypair.publicKey);

		const operations: OperationMeasurement[] = [
			measure("keygen", target.iterations, () => kem.generateKeypair()),
			measure("encaps", target.iterations, () => kem.encapsulate(baseKeypair.publicKey)),
			measure("decaps", target.iterations, () =>
				kem.decapsulate(baseEncap.ciphertext, baseKeypair.secretKey),
			),
		];

		const keygenP50 = operations[0]?.p50Ms ?? 0;
		const keygenOpsPerSec = operations[0]?.opsPerSecond ?? 0;

		const coldStart = measureColdStart(() => {
			const handle = new liboqs.KEM(target.liboqsName);
			return { invoke: () => handle.generateKeypair(), free: () => handle.free() };
		}, keygenP50);

		const memoryFootprint = measureMemoryFootprint(() => {
			const handle = new liboqs.KEM(target.liboqsName);
			return { invoke: () => handle.generateKeypair(), free: () => handle.free() };
		});

		const concurrency: ConcurrencyMeasurement[] = [];
		for (const workers of CONCURRENCY_LEVELS) {
			concurrency.push(
				await measureConcurrency(
					() => {
						const handle = new liboqs.KEM(target.liboqsName);
						return { invoke: () => handle.generateKeypair(), free: () => handle.free() };
					},
					workers,
					keygenOpsPerSec,
				),
			);
		}

		const multiProcessConcurrency: MultiProcessConcurrencyMeasurement[] = [];
		for (const processes of MULTI_PROCESS_LEVELS) {
			console.log(`    ↳ multi-process keygen × ${processes}…`);
			multiProcessConcurrency.push(
				await measureMultiProcess(target.liboqsName, "kem", processes, keygenOpsPerSec),
			);
		}

		const nobleComparison = await measureNobleComparison(
			target.algorithm,
			keygenP50,
			keygenOpsPerSec,
			target.iterations,
		);

		result = {
			algorithm: target.algorithm,
			fipsStandard: target.fipsStandard,
			securityCategory: target.securityCategory,
			publicKeyBytes: baseKeypair.publicKey.length,
			secretKeyBytes: baseKeypair.secretKey.length,
			ciphertextBytes: baseEncap.ciphertext.length,
			sharedSecretBytes: baseEncap.sharedSecret.length,
			iterations: target.iterations,
			operations,
			coldStart,
			memoryFootprint,
			concurrency,
			multiProcessConcurrency,
			nobleComparison,
		};
	} finally {
		kem.free();
	}
	return result;
}

async function benchmarkSignature(target: SignatureTarget): Promise<SignatureBenchmark> {
	const sig = new liboqs.Sig(target.liboqsName);
	let result: SignatureBenchmark;
	try {
		const baseKeypair = sig.generateKeypair();
		const baseSignature = sig.sign(MESSAGE, baseKeypair.secretKey);

		const operations: OperationMeasurement[] = [
			measure("keygen", target.iterations, () => sig.generateKeypair()),
			measure("sign", target.iterations, () => sig.sign(MESSAGE, baseKeypair.secretKey)),
			measure("verify", target.iterations, () =>
				sig.verify(MESSAGE, baseSignature, baseKeypair.publicKey),
			),
		];

		const keygenP50 = operations[0]?.p50Ms ?? 0;
		const keygenOpsPerSec = operations[0]?.opsPerSecond ?? 0;

		const coldStart = measureColdStart(() => {
			const handle = new liboqs.Sig(target.liboqsName);
			return { invoke: () => handle.generateKeypair(), free: () => handle.free() };
		}, keygenP50);

		const memoryFootprint = measureMemoryFootprint(() => {
			const handle = new liboqs.Sig(target.liboqsName);
			return { invoke: () => handle.generateKeypair(), free: () => handle.free() };
		});

		const concurrency: ConcurrencyMeasurement[] = [];
		for (const workers of CONCURRENCY_LEVELS) {
			concurrency.push(
				await measureConcurrency(
					() => {
						const handle = new liboqs.Sig(target.liboqsName);
						return { invoke: () => handle.generateKeypair(), free: () => handle.free() };
					},
					workers,
					keygenOpsPerSec,
				),
			);
		}

		const multiProcessConcurrency: MultiProcessConcurrencyMeasurement[] = [];
		for (const processes of MULTI_PROCESS_LEVELS) {
			console.log(`    ↳ multi-process keygen × ${processes}…`);
			multiProcessConcurrency.push(
				await measureMultiProcess(target.liboqsName, "sig", processes, keygenOpsPerSec),
			);
		}

		const nobleComparison = await measureNobleComparison(
			target.algorithm,
			keygenP50,
			keygenOpsPerSec,
			target.iterations,
		);

		result = {
			algorithm: target.algorithm,
			fipsStandard: target.fipsStandard,
			securityCategory: target.securityCategory,
			publicKeyBytes: baseKeypair.publicKey.length,
			secretKeyBytes: baseKeypair.secretKey.length,
			signatureBytes: baseSignature.length,
			messageBytes: MESSAGE.length,
			iterations: target.iterations,
			operations,
			coldStart,
			memoryFootprint,
			concurrency,
			multiProcessConcurrency,
			nobleComparison,
		};
	} finally {
		sig.free();
	}
	return result;
}

function getGitSha(): string | null {
	try {
		return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
	} catch {
		return null;
	}
}

function getCpuModel(): string {
	return cpus()[0]?.model ?? "unknown";
}

function getNobleVersion(): string {
	// Read the package.json directly from the node_modules path. The package
	// doesn't list ./package.json in its `exports` so the standard
	// `require("@noble/post-quantum/package.json")` fails.
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		// Walk up from apps/web/scripts/ to find the workspace root containing node_modules.
		let cursor = here;
		for (let i = 0; i < 8; i++) {
			const candidate = join(cursor, "node_modules", "@noble", "post-quantum", "package.json");
			try {
				const fs = require("node:fs") as typeof import("node:fs");
				const text = fs.readFileSync(candidate, "utf8");
				const pkg = JSON.parse(text) as { version: string };
				return pkg.version;
			} catch {
				// keep walking
			}
			cursor = dirname(cursor);
		}
		return "unknown";
	} catch {
		return "unknown";
	}
}

async function main(): Promise<void> {
	const supportedKems = new Set(liboqs.getSupportedKems());
	const supportedSigs = new Set(liboqs.getSupportedSignatures());

	for (const target of KEM_TARGETS) {
		if (!supportedKems.has(target.liboqsName)) {
			throw new Error(
				`liboqs build does not expose KEM ${target.liboqsName} (display: ${target.algorithm}).`,
			);
		}
	}
	for (const target of SIGNATURE_TARGETS) {
		if (!supportedSigs.has(target.liboqsName)) {
			throw new Error(
				`liboqs build does not expose Sig ${target.liboqsName} (display: ${target.algorithm}).`,
			);
		}
	}

	console.log(
		`liboqs ${liboqs.version()} + noble ${getNobleVersion()} on ${platform()}/${arch()} — ${getCpuModel()}`,
	);
	console.log(`Schema v3: + multi-process concurrency, batched memory, noble comparison`);

	const kems: KemBenchmark[] = [];
	for (const target of KEM_TARGETS) {
		console.log(`KEM   ${target.algorithm.padEnd(16)} × ${target.iterations}…`);
		kems.push(await benchmarkKem(target));
	}

	const signatures: SignatureBenchmark[] = [];
	for (const target of SIGNATURE_TARGETS) {
		console.log(`Sig   ${target.algorithm.padEnd(20)} × ${target.iterations}…`);
		signatures.push(await benchmarkSignature(target));
	}

	const suite: PqcBenchmarkSuite = {
		schemaVersion: 3,
		generatedAt: new Date().toISOString(),
		gitSha: getGitSha(),
		liboqsVersion: liboqs.version(),
		nobleVersion: getNobleVersion(),
		environment: {
			platform: platform(),
			arch: arch(),
			cpuModel: getCpuModel(),
			cpuCount: cpus().length,
			nodeVersion: process.version,
			totalMemoryGiB: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
		},
		reproducibility: {
			publishedJson: "https://qnsi.heossi.com/pqc-benchmarks/pqc-latest.json",
			publicMirror: "https://github.com/heossihq/qnsi-public",
			publicLibrary: "https://github.com/paulmillr/noble-post-quantum",
			liveSandbox: "https://qnsi.heossi.com/api/sandbox/pqc-runtime",
			readerSnippet:
				"npm i @noble/post-quantum && node --input-type=module -e \"import {ml_kem768} from '@noble/post-quantum/ml-kem.js'; const t=performance.now(); const kp=ml_kem768.keygen(); console.log('keygen ms:', (performance.now()-t).toFixed(3), '— pubkey bytes:', kp.publicKey.length);\"",
			note: "Absolute timings depend on hardware, kernel scheduler, and thermal state. Cross-algorithm ratios are stable. Schema v3 adds multi-process scaling, batched memory measurement, and side-by-side noble comparison.",
		},
		kems,
		signatures,
	};

	const here = dirname(fileURLToPath(import.meta.url));
	const outDir = join(here, "..", "public", "pqc-benchmarks");
	mkdirSync(outDir, { recursive: true });
	const latestPath = join(outDir, "pqc-latest.json");
	const snapshotPath = join(outDir, `pqc-${suite.generatedAt.replace(/[:.]/g, "-")}.json`);
	const json = `${JSON.stringify(suite, null, 2)}\n`;
	writeFileSync(latestPath, json);
	writeFileSync(snapshotPath, json);

	console.log(`\nWrote ${latestPath}`);
	console.log(`Wrote ${snapshotPath}`);
}
