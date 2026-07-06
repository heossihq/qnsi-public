interface CachedToken {
	readonly token: string;
	readonly expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

const DEFAULT_TOKEN_TTL_MS = 3600000;

export function getCachedToken(serviceId: string): string | null {
	const cached = tokenCache.get(serviceId);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.token;
	}
	if (cached) {
		tokenCache.delete(serviceId);
	}
	return null;
}

export function setCachedToken(
	serviceId: string,
	token: string,
	ttlMs = DEFAULT_TOKEN_TTL_MS,
): void {
	tokenCache.set(serviceId, {
		token,
		expiresAt: Date.now() + ttlMs,
	});
}

export function clearTokenCache(): void {
	tokenCache.clear();
}
