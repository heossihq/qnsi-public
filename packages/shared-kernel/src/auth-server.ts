import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PqcAlgorithm, PqcProvider } from "@heossi/qnsi-cryptography";
import { z } from "zod";
import {
	type AccessToken,
	type AuthSubject,
	accessTokenSchema,
	authSubjectSchema,
	type CreateAccessTokenOptions,
	type CreateRefreshTokenOptions,
	createAuthSubject,
	type RefreshTokenMetadata,
	refreshTokenMetadataSchema,
} from "./auth-types.js";
import { DEFAULT_TOKEN_TTL_SECONDS, TOKEN_AUDIENCES } from "./constants.js";
import { type JwtPayload, signJwt } from "./jwt.js";

const REFRESH_TOKEN_SECRET_BYTES = 48;
const REFRESH_TOKEN_DELIMITER = ".";

const tenantBoundAuthSubjectSchema = authSubjectSchema.extend({
	tenantId: z.string(),
});

type TenantBoundAuthSubject = z.infer<typeof tenantBoundAuthSubjectSchema>;

export interface RefreshTokenIssue {
	readonly token: string;
	readonly metadata: RefreshTokenMetadata;
}

export function createAccessToken(options: CreateAccessTokenOptions): AccessToken {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + (options.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS);

	return accessTokenSchema.parse({
		tokenId: randomUUID(),
		subject: options.subject,
		issuedAt,
		expiresAt,
		audience: options.audience ?? TOKEN_AUDIENCES.PLATFORM,
	});
}

export interface CreateJwtAccessTokenOptions extends CreateAccessTokenOptions {
	readonly algorithm: PqcAlgorithm;
	readonly privateKey: Uint8Array;
	readonly keyId?: string;
	readonly issuer?: string;
	readonly provider?: PqcProvider;
}

export async function createJwtAccessToken(options: CreateJwtAccessTokenOptions): Promise<string> {
	const accessToken = createAccessToken(options);
	const issuedAt = accessToken.issuedAt;
	const expiresAt = accessToken.expiresAt;

	const payload: JwtPayload = {
		jti: accessToken.tokenId,
		sub: accessToken.subject.id,
		iat: issuedAt,
		exp: expiresAt,
		aud: accessToken.audience,
		...(options.issuer ? { iss: options.issuer } : {}),
		...(accessToken.subject.identityId ? { identity_id: accessToken.subject.identityId } : {}),
		...(accessToken.subject.userId ? { user_id: accessToken.subject.userId } : {}),
		...(accessToken.subject.email ? { email: accessToken.subject.email } : {}),
		...(accessToken.subject.tenantId ? { tenant_id: accessToken.subject.tenantId } : {}),
		...(accessToken.subject.roles.length > 0 ? { roles: accessToken.subject.roles } : {}),
		...(accessToken.subject.tenantPlan ? { tenant_plan: accessToken.subject.tenantPlan } : {}),
	};

	return signJwt({
		payload,
		algorithm: options.algorithm,
		privateKey: options.privateKey,
		...(options.keyId !== undefined ? { keyId: options.keyId } : {}),
		...(options.provider !== undefined ? { provider: options.provider } : {}),
	});
}

export function createRefreshToken(options: CreateRefreshTokenOptions): RefreshTokenIssue {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + (options.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS);

	const subject = createAuthSubject(options.subject);

	if (!subject.tenantId) {
		throw new Error("Refresh tokens require a tenant-scoped subject");
	}

	const tenantSubject: TenantBoundAuthSubject = tenantBoundAuthSubjectSchema.parse(subject);

	const metadata = refreshTokenMetadataSchema.parse({
		tokenId: randomUUID(),
		subject: tenantSubject,
		issuedAt,
		expiresAt,
		audience: options.audience ?? TOKEN_AUDIENCES.PLATFORM,
	});

	const secret = randomBytes(REFRESH_TOKEN_SECRET_BYTES).toString("base64url");
	const token = `${metadata.tokenId}${REFRESH_TOKEN_DELIMITER}${secret}`;

	return {
		token,
		metadata,
	};
}

export function parseRefreshToken(token: string): { tokenId: string; secret: string } {
	const parts = token.split(REFRESH_TOKEN_DELIMITER);
	if (parts.length !== 2) {
		throw new Error("Invalid refresh token format");
	}

	const tokenId = z.string().uuid().parse(parts[0]);
	const secret = parts[1];

	if (!secret) {
		throw new Error("Invalid refresh token secret");
	}

	return {
		tokenId,
		secret,
	};
}

export function hashRefreshTokenSecret(secret: string): string {
	return createHash("sha3-512").update(secret).digest("base64url");
}

export function ensureAuthSubject(input: z.input<typeof authSubjectSchema>): AuthSubject {
	return authSubjectSchema.parse(input);
}
