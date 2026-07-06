export interface SecurityHeaders {
	readonly "Strict-Transport-Security"?: string;
	readonly "X-Content-Type-Options"?: string;
	readonly "X-Frame-Options"?: string;
	readonly "X-XSS-Protection"?: string;
	readonly "Content-Security-Policy"?: string;
	readonly "Referrer-Policy"?: string;
	readonly "Permissions-Policy"?: string;
}

export function getRecommendedSecurityHeaders(): SecurityHeaders {
	return {
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"X-XSS-Protection": "1; mode=block",
		"Content-Security-Policy":
			"default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Permissions-Policy": "geolocation=(), microphone=(), camera=()",
	};
}

export function validateSecurityHeaders(headers: Record<string, string>): {
	missing: string[];
	weak: Array<{ header: string; issue: string }>;
} {
	const recommended = getRecommendedSecurityHeaders();
	const missing: string[] = [];
	const weak: Array<{ header: string; issue: string }> = [];

	for (const header of Object.keys(recommended)) {
		if (!headers[header]) {
			missing.push(header);
		} else {
			const value = headers[header];
			if (header === "Strict-Transport-Security" && !value?.includes("max-age")) {
				weak.push({ header, issue: "Missing max-age directive" });
			}
			if (header === "Content-Security-Policy" && value === "default-src *") {
				weak.push({ header, issue: "Too permissive - allows all sources" });
			}
		}
	}

	return { missing, weak };
}
