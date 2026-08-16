import { z } from "zod";

function generateUUIDv7(): string {
	const timestamp = Date.now();
	const timestampHex = timestamp.toString(16).padStart(12, "0");

	const randomBytes = new Uint8Array(10);
	crypto.getRandomValues(randomBytes);

	const [byte0, , byte2] = randomBytes as unknown as [number, number, number];
	randomBytes[0] = (byte0 & 0x0f) | 0x70;
	randomBytes[2] = (byte2 & 0x3f) | 0x80;

	const randomHex = Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const hex = timestampHex + randomHex;
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const PRIVACY_CLASSIFICATIONS = [
	"PUBLIC",
	"INTERNAL",
	"CONFIDENTIAL",
	"RESTRICTED",
] as const;
export type PrivacyClassification = (typeof PRIVACY_CLASSIFICATIONS)[number];

export const ENVIRONMENTS = ["prod", "staging", "dev"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const privacySchema = z.object({
	classification: z.enum(PRIVACY_CLASSIFICATIONS),
	redactionHints: z.array(z.string()).optional(),
});

export const producerSchema = z.object({
	service: z.string().min(1),
	version: z.string().min(1),
});

export const signatureSchema = z.object({
	algorithm: z.literal("ML-DSA-65"),
	value: z.string().min(1),
	keyId: z.string().min(1),
});

export const spineEventEnvelopeSchema = z.object({
	eventId: z
		.string()
		.uuid()
		.default(() => generateUUIDv7()),
	eventType: z.string().regex(/^[a-z]+\.[a-z_]+\.[a-z_]+\.v\d+$/, {
		message: "Event type must match pattern: {domain}.{entity}.{action}.v{N}",
	}),
	eventVersion: z.string().min(1).default("1"),

	occurredAt: z
		.string()
		.datetime({ offset: true })
		.default(() => new Date().toISOString()),
	emittedAt: z
		.string()
		.datetime({ offset: true })
		.default(() => new Date().toISOString()),

	producer: producerSchema,
	environment: z.enum(ENVIRONMENTS),

	tenantId: z.string().min(1),
	subject: z.string().min(1),

	correlationId: z
		.string()
		.uuid()
		.default(() => generateUUIDv7()),
	causationId: z.string().uuid().nullable().default(null),
	idempotencyKey: z.string().min(1),

	privacy: privacySchema.default(() => ({
		classification: "INTERNAL" as const,
	})),

	payload: z.unknown(),

	signature: signatureSchema.optional(),
});

export type SpineEventEnvelope<TPayload = unknown> = Omit<
	z.infer<typeof spineEventEnvelopeSchema>,
	"payload"
> & {
	payload: TPayload;
};

export type SpineEventProducer = z.infer<typeof producerSchema>;
export type SpineEventPrivacy = z.infer<typeof privacySchema>;
export type SpineEventSignature = z.infer<typeof signatureSchema>;

export interface CreateSpineEventOptions<TPayload> {
	readonly eventType: string;
	readonly eventVersion?: string;
	readonly tenantId: string;
	readonly subject: string;
	readonly payload: TPayload;
	readonly producer: SpineEventProducer;
	readonly environment: Environment;
	readonly correlationId?: string;
	readonly causationId?: string | null;
	readonly idempotencyKey: string;
	readonly privacy?: Partial<SpineEventPrivacy>;
	readonly occurredAt?: string;
}

export function createSpineEvent<TPayload>(
	options: CreateSpineEventOptions<TPayload>,
): SpineEventEnvelope<TPayload> {
	const now = new Date().toISOString();

	const envelope = spineEventEnvelopeSchema.parse({
		eventType: options.eventType,
		eventVersion: options.eventVersion ?? "1",
		occurredAt: options.occurredAt ?? now,
		emittedAt: now,
		producer: options.producer,
		environment: options.environment,
		tenantId: options.tenantId,
		subject: options.subject,
		correlationId: options.correlationId,
		causationId: options.causationId ?? null,
		idempotencyKey: options.idempotencyKey,
		privacy: {
			classification: options.privacy?.classification ?? "INTERNAL",
			redactionHints: options.privacy?.redactionHints,
		},
		payload: options.payload,
	});

	return envelope as SpineEventEnvelope<TPayload>;
}

export function createIdempotencyKey(...parts: string[]): string {
	return parts.join(":");
}

export function parseEventType(eventType: string): {
	domain: string;
	entity: string;
	action: string;
	version: number;
} | null {
	const match = eventType.match(/^([a-z]+)\.([a-z_]+)\.([a-z_]+)\.v(\d+)$/);
	if (!match) return null;

	const [, domain, entity, action, versionStr] = match as RegExpMatchArray &
		[string, string, string, string, string];
	return {
		domain,
		entity,
		action,
		version: parseInt(versionStr, 10),
	};
}

export function isValidEventType(eventType: string): boolean {
	return parseEventType(eventType) !== null;
}
