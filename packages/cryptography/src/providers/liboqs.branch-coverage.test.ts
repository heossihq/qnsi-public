import { describe, expect, it, vi } from "vitest";

import type { PqcAlgorithm } from "../provider.js";
import {
	createLiboqsProviderFactory,
	defaultLoadModule,
	isKemSupported,
	isModuleNotFoundError,
	isSignatureSupported,
	loadLiboqsPackageMetadata,
	normalizeUint8Array,
	resolveImportedModule,
	resolveKemAlias,
	resolveSignatureAlias,
	toInternalKemAlgorithm,
	toInternalSignatureAlgorithm,
} from "./liboqs.js";

describe("liboqs provider - Branch Coverage", () => {
	describe("error handling and edge cases", () => {
		it("normalizes native package metadata and its fallbacks", () => {
			expect(
				loadLiboqsPackageMetadata(() => ({
					liboqsVersion: "0.16.0",
					version: "2.0.0",
					author: "HEOSSI",
				})),
			).toEqual({ version: "0.16.0", author: "HEOSSI" });
			expect(loadLiboqsPackageMetadata(() => ({ version: "2.0.0" }))).toEqual({
				version: "2.0.0",
				author: "Open Quantum Safe",
			});
			expect(loadLiboqsPackageMetadata(() => ({}))).toEqual({
				version: "unavailable",
				author: "Open Quantum Safe",
			});
			expect(
				loadLiboqsPackageMetadata(() => {
					throw new Error("missing metadata");
				}),
			).toEqual({ version: "unavailable", author: "Open Quantum Safe" });
		});

		it("normalizes array-like native outputs", () => {
			expect(normalizeUint8Array([1, 2, 3] as never)).toEqual(new Uint8Array([1, 2, 3]));
		});

		it("maps only missing default-module errors to the installation guidance", async () => {
			const missing = Object.assign(new Error("missing"), { code: "MODULE_NOT_FOUND" });
			await expect(
				defaultLoadModule("@heossihq/liboqs-native", vi.fn(), async () => {
					throw missing;
				}),
			).rejects.toThrow("is not installed");
			const denied = new Error("denied");
			await expect(
				defaultLoadModule("@heossihq/liboqs-native", vi.fn(), async () => {
					throw denied;
				}),
			).rejects.toBe(denied);
		});

		it("fails closed for unavailable aliases and unknown identifiers", () => {
			const rejectingModule = {
				KEM: class {
					constructor() {
						throw new Error("unsupported KEM");
					}
				},
				Sig: class {
					constructor() {
						throw new Error("unsupported signature");
					}
				},
			};
			expect(isKemSupported(rejectingModule as never, "ML-KEM-512")).toBe(false);
			expect(isSignatureSupported(rejectingModule as never, "ML-DSA-44")).toBe(false);
			expect(() => toInternalKemAlgorithm("unknown-kem")).toThrow("Unsupported liboqs KEM");
			expect(() => toInternalSignatureAlgorithm("unknown-sig")).toThrow(
				"Unsupported liboqs signature",
			);
			expect(() => resolveKemAlias(rejectingModule as never, "dilithium-2" as never)).toThrow(
				"No liboqs aliases",
			);
			expect(() => resolveKemAlias(rejectingModule as never, "kyber-512")).toThrow(
				"None of the aliases",
			);
			expect(() => resolveSignatureAlias(rejectingModule as never, "kyber-512" as never)).toThrow(
				"No liboqs aliases",
			);
			expect(() => resolveSignatureAlias(rejectingModule as never, "dilithium-2")).toThrow(
				"None of the aliases",
			);
		});

		it("normalizes direct and default module namespaces", () => {
			const stubModule = { KEM: class {}, Sig: class {} };
			expect(resolveImportedModule(stubModule as never)).toBe(stubModule);
			expect(resolveImportedModule({ default: stubModule } as never)).toBe(stubModule);
		});

		it("loads a custom module through the injected runtime importer", async () => {
			const stubModule = { KEM: class {}, Sig: class {} };
			await expect(
				defaultLoadModule("custom-liboqs", async () => stubModule as never),
			).resolves.toBe(stubModule);
		});

		it("recognizes only supported module-resolution error codes", () => {
			expect(isModuleNotFoundError("not an error")).toBe(false);
			for (const code of [
				"ERR_MODULE_NOT_FOUND",
				"MODULE_NOT_FOUND",
				"ERR_PACKAGE_PATH_NOT_EXPORTED",
			]) {
				const error = Object.assign(new Error(code), { code });
				expect(isModuleNotFoundError(error)).toBe(true);
			}
			expect(isModuleNotFoundError(Object.assign(new Error("denied"), { code: "EACCES" }))).toBe(
				false,
			);
		});

		it("preserves errors from a missing custom runtime module", async () => {
			const factory = createLiboqsProviderFactory();
			await expect(
				factory.create({ configuration: { moduleId: "qnsi-test-missing-liboqs-module" } }),
			).rejects.toThrow();
		});

		it("should handle module loading failure in probe", async () => {
			const loadModule = vi.fn(async () => {
				throw new Error("Module not found");
			});

			const factory = createLiboqsProviderFactory({ loadModule });
			expect(factory.probe).toBeDefined();
			const probe = factory.probe;
			if (!probe) {
				throw new Error("probe is not defined");
			}
			await expect(probe()).rejects.toThrow("Module not found");
		});

		it("should reject when module loading fails during create", async () => {
			const loadModule = vi.fn(async () => {
				throw new Error("Failed to load native module");
			});

			const factory = createLiboqsProviderFactory({ loadModule });

			await expect(factory.create()).rejects.toThrow("Failed to load native module");
		});

		it("should reject unsupported algorithms", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512"],
				getSupportedSignatures: () => ["Dilithium2"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			await expect(
				factory.create({
					algorithms: ["kyber-512", "unsupported-algo" as PqcAlgorithm],
				}),
			).rejects.toThrow("not supported by the liboqs module");
		});

		it("should handle empty algorithm list by using all available", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512", "Kyber768"],
				getSupportedSignatures: () => ["Dilithium2", "Dilithium3"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			const provider = await factory.create({ algorithms: [] });

			expect(provider).toBeDefined();
			expect(provider.name).toBe("liboqs");
		});

		it("should handle undefined algorithms option", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512"],
				getSupportedSignatures: () => ["Dilithium2"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			const provider = await factory.create();

			expect(provider).toBeDefined();
		});

		it("should throw when no algorithms are available", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => [],
				getSupportedSignatures: () => [],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			await expect(factory.create()).rejects.toThrow(
				"No liboqs algorithms are available with the current module configuration",
			);
		});

		it("should handle module without version function", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512"],
				getSupportedSignatures: () => ["Dilithium2"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			const provider = await factory.create();

			expect(provider).toBeDefined();
		});

		it("should handle module without getSupportedKems", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedSignatures: () => ["Dilithium2"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			const provider = await factory.create({ algorithms: ["dilithium-2"] });

			expect(provider).toBeDefined();
		});

		it("should handle module without getSupportedSignatures", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });

			const provider = await factory.create({ algorithms: ["kyber-512"] });

			expect(provider).toBeDefined();
		});

		it("should handle KEM instances with free method", async () => {
			let freedCount = 0;
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
					free() {
						freedCount++;
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512"],
				getSupportedSignatures: () => [],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });
			const provider = await factory.create({ algorithms: ["kyber-512"] });

			await provider.generateKeyPair({ algorithm: "kyber-512" });

			expect(freedCount).toBeGreaterThan(0);
		});

		it("should handle Signature instances with free method", async () => {
			let freedCount = 0;
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
					free() {
						freedCount++;
					}
				},
				getSupportedKems: () => [],
				getSupportedSignatures: () => ["Dilithium2"],
			};

			const loadModule = vi.fn(async () => stubModule);
			const factory = createLiboqsProviderFactory({ loadModule });
			const provider = await factory.create({ algorithms: ["dilithium-2"] });

			await provider.generateKeyPair({ algorithm: "dilithium-2" });

			expect(freedCount).toBeGreaterThan(0);
		});

		it("should handle custom moduleId in configuration", async () => {
			const stubModule = {
				KEM: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					encapsulate() {
						return { ciphertext: new Uint8Array(1), sharedSecret: new Uint8Array(1) };
					}
					decapsulate() {
						return new Uint8Array(1);
					}
				},
				Sig: class {
					constructor(public algorithm: string) {}
					generateKeypair() {
						return { publicKey: new Uint8Array(1), secretKey: new Uint8Array(1) };
					}
					sign() {
						return new Uint8Array(1);
					}
					verify() {
						return true;
					}
				},
				getSupportedKems: () => ["Kyber512"],
				getSupportedSignatures: () => [],
			};

			const loadModule = vi.fn(async (moduleId: string) => {
				expect(moduleId).toBe("custom-liboqs-module");
				return stubModule;
			});

			const factory = createLiboqsProviderFactory({ loadModule });
			const provider = await factory.create({
				configuration: { moduleId: "custom-liboqs-module" },
				algorithms: ["kyber-512"],
			});

			expect(provider).toBeDefined();
			expect(loadModule).toHaveBeenCalledWith("custom-liboqs-module");
		});
	});
});
