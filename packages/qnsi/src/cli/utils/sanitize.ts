const SENSITIVE_PATTERNS = [
	/Bearer\s+[A-Za-z0-9._-]+/gi,
	/"accessToken"\s*:\s*"[^"]+"/gi,
	/"token"\s*:\s*"[^"]+"/gi,
	/"secret"\s*:\s*"[^"]+"/gi,
	/"password"\s*:\s*"[^"]+"/gi,
	/"apiKey"\s*:\s*"[^"]+"/gi,
	/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi,
	/x-api-key:\s*[A-Za-z0-9._-]+/gi,
];

export function sanitizeOutput(message: string): string {
	let sanitized = message;
	for (const pattern of SENSITIVE_PATTERNS) {
		sanitized = sanitized.replace(pattern, (match) => {
			if (match.includes(":")) {
				const [key] = match.split(":");
				return `${key}: [REDACTED]`;
			}
			if (match.includes("Bearer")) {
				return "Bearer [REDACTED]";
			}
			return match.replace(/"[^"]+"/g, '"[REDACTED]"');
		});
	}
	return sanitized;
}

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
	const sanitized: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		const lowerKey = key.toLowerCase();
		if (
			lowerKey.includes("authorization") ||
			lowerKey.includes("token") ||
			lowerKey.includes("secret") ||
			lowerKey.includes("api-key") ||
			lowerKey.includes("password")
		) {
			sanitized[key] = "[REDACTED]";
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
}
