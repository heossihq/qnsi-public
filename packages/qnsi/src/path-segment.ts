/** Encode one resource identifier, refusing URL-normalizing dot segments before HTTP. */
export function encodePathSegment(value: string): string {
	if (typeof value !== "string" || value.length === 0 || value === "." || value === "..") {
		throw new TypeError("Path parameter must be a non-empty identifier, not a dot segment");
	}
	return encodeURIComponent(value);
}
