/**
 * Controllable stand-in for the `vscode` module (aliased in vitest.config.ts).
 * Every interactive surface is a vi.fn the tests script per scenario; value
 * classes (TreeItem, Range, ...) are minimal real implementations so module
 * logic runs unchanged.
 */
import { vi } from "vitest";

export const window = {
	showInputBox: vi.fn(),
	showInformationMessage: vi.fn(),
	showWarningMessage: vi.fn(),
	showErrorMessage: vi.fn(),
	showQuickPick: vi.fn(),
	showTextDocument: vi.fn(),
	withProgress: vi.fn(
		async (
			_options: unknown,
			task: (
				progress: { report: (v: unknown) => void },
				token: { isCancellationRequested: boolean },
			) => Promise<unknown>,
		) => task({ report: vi.fn() }, { isCancellationRequested: false }),
	),
	createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), dispose: vi.fn() })),
	createStatusBarItem: vi.fn(() => ({
		text: "",
		tooltip: "",
		command: "",
		show: vi.fn(),
		dispose: vi.fn(),
	})),
	registerTreeDataProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export const workspace = {
	getConfiguration: vi.fn(() => ({ get: vi.fn(() => undefined) })),
	findFiles: vi.fn(async () => []),
	openTextDocument: vi.fn(async (input: unknown) => ({ input })),
	onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	workspaceFolders: undefined as unknown,
	fs: {
		readFile: vi.fn(),
		writeFile: vi.fn(async () => {}),
		createDirectory: vi.fn(async () => {}),
		stat: vi.fn(),
	},
};

export const commands = {
	registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
	executeCommand: vi.fn(async () => {}),
};

export const env = {
	clipboard: { writeText: vi.fn(async () => {}) },
};

export const languages = {
	createDiagnosticCollection: vi.fn(() => {
		const store = new Map<string, unknown[]>();
		return {
			set: vi.fn((uri: { fsPath: string }, diags: unknown[]) => store.set(uri.fsPath, diags)),
			delete: vi.fn((uri: { fsPath: string }) => store.delete(uri.fsPath)),
			clear: vi.fn(() => store.clear()),
			dispose: vi.fn(),
			store,
		};
	}),
	registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
	registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export class EventEmitter<T> {
	private listeners: Array<(value: T) => void> = [];
	event = (listener: (value: T) => void) => {
		this.listeners.push(listener);
		return { dispose: vi.fn() };
	};
	fire(value?: T): void {
		for (const listener of this.listeners) {
			listener(value as T);
		}
	}
	dispose(): void {
		this.listeners = [];
	}
}

export class Uri {
	private constructor(
		readonly fsPath: string,
		readonly scheme: string = "file",
	) {}
	static file(path: string): Uri {
		return new Uri(path, "file");
	}
	static joinPath(base: Uri, ...segments: string[]): Uri {
		let path = base.fsPath;
		for (const segment of segments) {
			path = segment === ".." ? path.split("/").slice(0, -1).join("/") : `${path}/${segment}`;
		}
		return new Uri(path, base.scheme);
	}
	toString(): string {
		return `${this.scheme}://${this.fsPath}`;
	}
}

export class TreeItem {
	description?: string;
	contextValue?: string;
	iconPath?: unknown;
	tooltip?: string;
	command?: unknown;
	constructor(
		readonly label: unknown,
		readonly collapsibleState?: number,
	) {}
}

export class ThemeIcon {
	static File = new ThemeIcon("file");
	constructor(readonly id: string) {}
}

export class MarkdownString {
	value = "";
	appendMarkdown(text: string): void {
		this.value += text;
	}
}

export class Hover {
	constructor(
		readonly contents: unknown,
		readonly range?: unknown,
	) {}
}

export class CompletionItem {
	detail?: string;
	documentation?: unknown;
	constructor(
		readonly label: string,
		readonly kind?: number,
	) {}
}

export class Position {
	constructor(
		readonly line: number,
		readonly character: number,
	) {}
}

export class Range {
	constructor(
		readonly startLine: number,
		readonly startChar: number,
		readonly endLine: number,
		readonly endChar: number,
	) {}
}

export class Diagnostic {
	source?: string;
	code?: string;
	constructor(
		readonly range: Range,
		readonly message: string,
		readonly severity: number,
	) {}
}

export const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 } as const;
export const StatusBarAlignment = { Left: 1, Right: 2 } as const;
export const ProgressLocation = { Notification: 15 } as const;
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 } as const;
export const CompletionItemKind = { Constant: 20 } as const;

/** Reset all interactive mock state between tests. */
export function __resetVscodeMock(): void {
	for (const group of [window, workspace, commands, languages]) {
		for (const value of Object.values(group)) {
			if (typeof value === "function" && "mockReset" in value) {
				(value as ReturnType<typeof vi.fn>).mockReset();
			}
		}
	}
	env.clipboard.writeText.mockReset();
	for (const fsFn of Object.values(workspace.fs)) {
		fsFn.mockReset();
	}
	workspace.fs.writeFile.mockImplementation(async () => {});
	workspace.fs.createDirectory.mockImplementation(async () => {});
	env.clipboard.writeText.mockImplementation(async () => {});
	workspace.getConfiguration.mockImplementation(() => ({ get: vi.fn(() => undefined) }));
	workspace.findFiles.mockImplementation(async () => []);
	workspace.openTextDocument.mockImplementation(async (input: unknown) => ({ input }));
	workspace.onDidSaveTextDocument.mockImplementation(() => ({ dispose: vi.fn() }));
	workspace.workspaceFolders = undefined;
	commands.registerCommand.mockImplementation(() => ({ dispose: vi.fn() }));
	commands.executeCommand.mockImplementation(async () => {});
	window.withProgress.mockImplementation(
		async (
			_options: unknown,
			task: (
				progress: { report: (v: unknown) => void },
				token: { isCancellationRequested: boolean },
			) => Promise<unknown>,
		) => task({ report: vi.fn() }, { isCancellationRequested: false }),
	);
	window.createOutputChannel.mockImplementation(() => ({ appendLine: vi.fn(), dispose: vi.fn() }));
	window.createStatusBarItem.mockImplementation(() => ({
		text: "",
		tooltip: "",
		command: "",
		show: vi.fn(),
		dispose: vi.fn(),
	}));
	window.registerTreeDataProvider.mockImplementation(() => ({ dispose: vi.fn() }));
	languages.createDiagnosticCollection.mockImplementation(() => {
		const store = new Map<string, unknown[]>();
		return {
			set: vi.fn((uri: { fsPath: string }, diags: unknown[]) => store.set(uri.fsPath, diags)),
			delete: vi.fn((uri: { fsPath: string }) => store.delete(uri.fsPath)),
			clear: vi.fn(() => store.clear()),
			dispose: vi.fn(),
			store,
		};
	});
	languages.registerHoverProvider.mockImplementation(() => ({ dispose: vi.fn() }));
	languages.registerCompletionItemProvider.mockImplementation(() => ({ dispose: vi.fn() }));
}
