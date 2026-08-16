/**
 * client/auth/config/output logic against the vscode mock, with the QNSI SDK
 * mocked to a controllable class.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "../test/vscode-api";

const { __resetVscodeMock } = vscode;

import { refreshSignedInContext, signIn, signOut } from "./auth";
import {
	getApiKey,
	getClient,
	getRawAuth,
	invalidateClient,
	NotSignedInError,
	SECRET_KEY,
	withClient,
} from "./client";
import {
	getPlatformUrl,
	getScanExclude,
	getScanInclude,
	getScanMaxFiles,
	getScanOnSave,
} from "./config";
import { getOutput, log, logError } from "./output";

const ensureActivated = vi.fn();

vi.mock("@heossihq/qnsi", () => ({
	QnsiClient: class {
		ensureActivated = ensureActivated;
		constructor(readonly options: { apiKey: string; baseUrl: string }) {}
	},
}));

interface FakeContext {
	secrets: {
		get: ReturnType<typeof vi.fn>;
		store: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	workspaceState: { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
	subscriptions: unknown[];
}

export function fakeContext(apiKey?: string): FakeContext {
	let stored = apiKey;
	return {
		secrets: {
			get: vi.fn(async () => stored),
			store: vi.fn(async (_key: string, value: string) => {
				stored = value;
			}),
			delete: vi.fn(async () => {
				stored = undefined;
			}),
		},
		workspaceState: { get: vi.fn(() => undefined), update: vi.fn(async () => {}) },
		subscriptions: [],
	};
}

type Ctx = Parameters<typeof getClient>[0];

beforeEach(() => {
	__resetVscodeMock();
	invalidateClient();
	ensureActivated.mockReset();
});

describe("config", () => {
	it("returns defaults when nothing is configured", () => {
		expect(getPlatformUrl()).toBe("https://api.qnsi.heossi.com");
		expect(getScanInclude()).toEqual([]);
		expect(getScanExclude()).toEqual([]);
		expect(getScanMaxFiles()).toBe(2000);
		expect(getScanOnSave()).toBe(false);
	});

	it("trims trailing slashes off a configured platform URL", () => {
		vscode.workspace.getConfiguration.mockReturnValue({
			get: vi.fn((key: string) => (key === "platformUrl" ? " https://alt.example// " : undefined)),
		} as never);
		expect(getPlatformUrl()).toBe("https://alt.example");
	});
});

describe("output", () => {
	it("creates the channel once and formats errors", () => {
		const channel = getOutput();
		expect(getOutput()).toBe(channel);
		log("hello");
		logError("ctx", new Error("boom"));
		logError("ctx", "raw failure");
		expect(vscode.window.createOutputChannel).toHaveBeenCalledTimes(1);
	});
});

describe("client", () => {
	it("throws NotSignedInError without a stored key and caches per key+url", async () => {
		const anonymous = fakeContext() as unknown as Ctx;
		await expect(getClient(anonymous)).rejects.toBeInstanceOf(NotSignedInError);
		await expect(getRawAuth(anonymous)).rejects.toBeInstanceOf(NotSignedInError);

		const signedIn = fakeContext("key-1") as unknown as Ctx;
		const first = await getClient(signedIn);
		expect(await getClient(signedIn)).toBe(first);
		await expect(getRawAuth(signedIn)).resolves.toEqual({
			apiKey: "key-1",
			baseUrl: "https://api.qnsi.heossi.com",
		});
		expect(await getApiKey(signedIn)).toBe("key-1");

		invalidateClient();
		expect(await getClient(signedIn)).not.toBe(first);
	});

	it("withClient runs the action when signed in and prompts otherwise", async () => {
		const signedIn = fakeContext("key-2") as unknown as Ctx;
		await expect(withClient(signedIn, async () => "ran")).resolves.toBe("ran");

		const anonymous = fakeContext() as unknown as Ctx;
		vscode.window.showWarningMessage.mockResolvedValueOnce("Sign In");
		await expect(withClient(anonymous, async () => "never")).resolves.toBeUndefined();
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith("qnsi.signIn");

		vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
		await expect(withClient(anonymous, async () => "never")).resolves.toBeUndefined();

		// Non-auth errors propagate untouched.
		await expect(
			withClient(signedIn, async () => {
				throw new Error("backend down");
			}),
		).rejects.toThrow("backend down");
	});
});

describe("auth", () => {
	it("reflects the stored key into the signedIn context", async () => {
		const context = fakeContext("key-3") as unknown as Ctx;
		await expect(refreshSignedInContext(context)).resolves.toBe(true);
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			"setContext",
			"qnsi.signedIn",
			true,
		);
		await expect(refreshSignedInContext(fakeContext() as unknown as Ctx)).resolves.toBe(false);
	});

	it("signs in end to end, rejecting empty input", async () => {
		vscode.window.showInputBox.mockResolvedValueOnce(undefined);
		expect(await signIn(fakeContext() as unknown as Ctx)).toBe(false);
		vscode.window.showInputBox.mockResolvedValueOnce("   ");
		expect(await signIn(fakeContext() as unknown as Ctx)).toBe(false);

		const context = fakeContext();
		vscode.window.showInputBox.mockResolvedValueOnce("  fresh-key  ");
		ensureActivated.mockResolvedValueOnce({ tenantId: "tenant-1", tier: "pro" });
		expect(await signIn(context as unknown as Ctx)).toBe(true);
		expect(context.secrets.store).toHaveBeenCalledWith(SECRET_KEY, "fresh-key");
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("tenant tenant-1"),
		);
	});

	it("discards the key when activation fails, including non-Error failures", async () => {
		const context = fakeContext();
		vscode.window.showInputBox.mockResolvedValueOnce("bad-key");
		ensureActivated.mockRejectedValueOnce(new Error("activation refused"));
		expect(await signIn(context as unknown as Ctx)).toBe(false);
		expect(context.secrets.delete).toHaveBeenCalledWith(SECRET_KEY);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("activation refused"),
		);

		vscode.window.showInputBox.mockResolvedValueOnce("bad-key-2");
		ensureActivated.mockRejectedValueOnce("raw refusal");
		expect(await signIn(context as unknown as Ctx)).toBe(false);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("raw refusal"),
		);
	});

	it("signOut clears the secret and context", async () => {
		const context = fakeContext("key-4");
		await signOut(context as unknown as Ctx);
		expect(context.secrets.delete).toHaveBeenCalledWith(SECRET_KEY);
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("QNSI: signed out.");
	});
});
