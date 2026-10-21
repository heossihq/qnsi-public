import { QNSI_OPERATIONS } from "@heossihq/qnsi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "../test/vscode-api";
import { apiRequestCommand, browseOperationsCommand } from "./api-console";
import { invalidateClient } from "./client";

function makeContext(apiKey?: string) {
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

type Context = ReturnType<typeof makeContext>;

beforeEach(() => {
	vscode.__resetVscodeMock();
	invalidateClient();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("apiRequestCommand", () => {
	it("discovers every manifest operation without claiming live availability and supports cancellation", async () => {
		const context = makeContext("key");
		await browseOperationsCommand(context as never);
		const choices = vscode.window.showQuickPick.mock.calls[0]?.[0] as Array<{
			operation: { id: string };
		}>;
		expect(choices.map(({ operation }) => operation.id)).toEqual(
			QNSI_OPERATIONS.map(({ id }) => id),
		);
		expect(vscode.window.showInputBox).not.toHaveBeenCalled();
	});

	it("requires path parameters and confirmation before mutating catalog operations", async () => {
		const context = makeContext("key");
		const operation = QNSI_OPERATIONS.find((item) => item.id === "kms-service.postKeysKeyIdRotate");
		vscode.window.showQuickPick.mockResolvedValue({ operation });
		await browseOperationsCommand(context as never);
		expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
		vscode.window.showInputBox.mockResolvedValueOnce("key/?#");
		await browseOperationsCommand(context as never);
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("/keys/key%2F%3F%23/rotate"),
			{ modal: true },
			"Continue",
		);
		expect(vscode.window.createOutputChannel).not.toHaveBeenCalled();
		for (const value of [".", ".."]) {
			vscode.window.showInputBox.mockResolvedValueOnce(value);
			await browseOperationsCommand(context as never);
		}
		expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
	});

	it.each(["kms-service.getKeys", "kms-service.postKeys"])(
		"invokes selected %s through the existing API console",
		async (operationId) => {
			const context = makeContext("key");
			const operation = QNSI_OPERATIONS.find((item) => item.id === operationId);
			vscode.window.showQuickPick.mockResolvedValueOnce({ operation });
			vscode.window.showWarningMessage.mockResolvedValueOnce("Continue");
			vscode.window.showInputBox.mockResolvedValueOnce("{}");
			const channel = { clear: vi.fn(), appendLine: vi.fn(), show: vi.fn(), dispose: vi.fn() };
			vscode.window.createOutputChannel.mockReturnValueOnce(channel);
			const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}"));
			await browseOperationsCommand(context as never);
			expect(fetchMock).toHaveBeenCalledWith(
				`https://api.qnsi.heossi.com${operation?.path}`,
				expect.objectContaining({ method: operation?.method, redirect: "error" }),
			);
			expect(context.subscriptions).toContain(channel);
		},
	);
	it("returns when method or path selection is cancelled", async () => {
		const context = makeContext("key") as unknown as Context;
		vscode.window.showQuickPick.mockResolvedValueOnce(undefined);
		await apiRequestCommand(context as never);
		expect(vscode.window.showInputBox).not.toHaveBeenCalled();

		vscode.window.showQuickPick.mockResolvedValueOnce("GET");
		vscode.window.showInputBox.mockResolvedValueOnce(undefined);
		await apiRequestCommand(context as never);
		expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
		const options = vscode.window.showInputBox.mock.calls[0]?.[0] as {
			validateInput: (value: string) => string | undefined;
		};
		expect(options.validateInput("/proxy/audit/v1/events")).toBeUndefined();
		expect(options.validateInput("/internal/admin")).toBe("Path must start with /proxy/");
	});

	it.each([
		["GET", undefined],
		["DELETE", '{"reason":"customer-request"}'],
		["POST", '{"name":"value"}'],
		["PUT", ""],
		["PATCH", '{"enabled":true}'],
	] as const)("executes %s and renders the real HTTP response", async (method, body) => {
		const context = makeContext("key") as unknown as Context;
		vscode.window.showQuickPick.mockResolvedValueOnce(method);
		vscode.window.showInputBox.mockResolvedValueOnce("/proxy/kms/v1/keys");
		if (method !== "GET") {
			vscode.window.showInputBox.mockResolvedValueOnce(body);
		}
		const channel = { clear: vi.fn(), appendLine: vi.fn(), show: vi.fn(), dispose: vi.fn() };
		vscode.window.createOutputChannel.mockReturnValueOnce(channel);
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response("response-body", { status: 202 }));

		await apiRequestCommand(context as never);

		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.qnsi.heossi.com/proxy/kms/v1/keys",
			expect.objectContaining({
				method,
				...(body ? { body } : {}),
			}),
		);
		expect(channel.appendLine).toHaveBeenCalledWith(`${method} /proxy/kms/v1/keys -> HTTP 202`);
		expect(channel.appendLine).toHaveBeenCalledWith("response-body");
		expect(channel.show).toHaveBeenCalledOnce();
	});

	it("offers sign-in when authentication is absent", async () => {
		const context = makeContext() as unknown as Context;
		vscode.window.showQuickPick.mockResolvedValue("GET");
		vscode.window.showInputBox.mockResolvedValue("/proxy/kms/v1/keys");
		vscode.window.showWarningMessage.mockResolvedValueOnce("Sign In");

		await apiRequestCommand(context as never);

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith("qnsi.signIn");

		vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
		await apiRequestCommand(context as never);
		expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
	});

	it.each([new Error("network unavailable"), "raw network failure"])(
		"shows non-auth request failures without claiming success",
		async (failure) => {
			const context = makeContext("key") as unknown as Context;
			vscode.window.showQuickPick.mockResolvedValue("GET");
			vscode.window.showInputBox.mockResolvedValue("/proxy/kms/v1/keys");
			vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(failure);

			await apiRequestCommand(context as never);

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				`QNSI API request failed: ${failure instanceof Error ? failure.message : String(failure)}`,
			);
		},
	);
});
