import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

// Downloads VS Code, launches it with this extension loaded, and runs the in-host suite
// (dist/test/suite/index.cjs). Exits non-zero on any assertion failure.
//
// ELECTRON_RUN_AS_NODE MUST BE UNSET, or this suite cannot run at all.
//
// VS Code sets ELECTRON_RUN_AS_NODE=1 for processes spawned from its own extension host and
// integrated terminal. That variable tells an Electron binary to behave as plain Node - so the
// VS Code we download launches as Node, which rejects VS Code's CLI flags with
// "bad option: --extensions-dir" and the run dies with exit code 9.
//
// It is a poisoned inherited env var, not a bad download and not a version problem: the same
// binary reports Node's version (v22.18.0) with the variable set, and VS Code's version without
// it. Anyone running `pnpm test` from a VS Code terminal - or any agent running inside the
// extension host - hits this. Turbo's cache hid it until a genuine re-run.
delete process.env.ELECTRON_RUN_AS_NODE;
const here = fileURLToPath(new URL(".", import.meta.url));
const extensionDevelopmentPath = `${here}..`;
const extensionTestsPath = `${here}../dist/test/suite/index.cjs`;

try {
	let vscodeExecutablePath = await downloadAndUnzipVSCode();
	if (!existsSync(vscodeExecutablePath) && process.platform === "darwin") {
		const renamedExecutablePath = resolve(dirname(vscodeExecutablePath), "Code");
		if (existsSync(renamedExecutablePath)) {
			vscodeExecutablePath = renamedExecutablePath;
		}
	}

	await runTests({
		extensionDevelopmentPath,
		extensionTestsPath,
		vscodeExecutablePath,
	});
	console.log("RUNTIME TESTS: PASS");
} catch (err) {
	console.error("RUNTIME TESTS: FAIL", err);
	process.exit(1);
}
