/**
 * Minimal structured logger for the QNSP agent.
 * No external dependencies - uses process.stderr for structured output.
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_RANK: Record<LogLevel, number> = {
	silent: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
	currentLevel = level;
}

function log(
	level: Exclude<LogLevel, "silent">,
	msg: string,
	data?: Record<string, unknown>,
): void {
	if (LEVEL_RANK[level] > LEVEL_RANK[currentLevel]) return;
	const entry: Record<string, unknown> = {
		time: new Date().toISOString(),
		level,
		msg,
		...data,
	};
	process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
	error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
	warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
	info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
	debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
};
