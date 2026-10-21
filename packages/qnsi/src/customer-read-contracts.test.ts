import { afterEach, describe, expect, it, vi } from "vitest";
import { Internal } from "./_internal.js";
import { AuthClient } from "./auth.js";
import { BillingClient } from "./billing.js";

afterEach(() => vi.restoreAllMocks());
function fixture() {
	const internal = new Internal({ apiKey: "local-contract-fixture" });
	const tenant = vi.spyOn(internal, "resolveTenantId").mockResolvedValue("tenant/with space");
	const request = vi.spyOn(internal, "request").mockResolvedValue({ source: "fixture" });
	return { internal, tenant, request };
}
describe("customer read surface contracts", () => {
	it.each([0, 100, 1_000_000])(
		"binds credit pagination %i to activated identity",
		async (offset) => {
			const f = fixture();
			expect(await new BillingClient(f.internal).listCustomerCredits(offset)).toEqual({
				source: "fixture",
			});
			expect(f.request).toHaveBeenCalledWith(
				"GET",
				"/proxy/billing/v1/customer-credits/tenant%2Fwith%20space",
				undefined,
				{ query: { offset } },
			);
			expect(f.tenant).toHaveBeenCalledOnce();
		},
	);
	it("defaults credits to the first page and propagates identity failure without a request", async () => {
		const f = fixture();
		await new BillingClient(f.internal).listCustomerCredits();
		expect(f.request.mock.calls[0]?.[3]).toEqual({ query: { offset: 0 } });
		f.request.mockClear();
		f.tenant.mockRejectedValue(new Error("identity unavailable"));
		await expect(new BillingClient(f.internal).listCustomerCredits()).rejects.toThrow(
			"identity unavailable",
		);
		expect(f.request).not.toHaveBeenCalled();
	});
	it.each([-1, 0.5, 1_000_001, NaN, Infinity])(
		"rejects invalid credit offset %s before I/O",
		async (offset) => {
			const f = fixture();
			await expect(new BillingClient(f.internal).listCustomerCredits(offset)).rejects.toThrow(
				RangeError,
			);
			expect(f.tenant).not.toHaveBeenCalled();
			expect(f.request).not.toHaveBeenCalled();
		},
	);
	it.each([1, 24, 168])("uses tenant-scoped federation activity for %i hours", async (hours) => {
		const f = fixture();
		await new AuthClient(f.internal).getFederationAuditActivity(hours);
		expect(f.request).toHaveBeenCalledWith(
			"GET",
			"/proxy/auth/federation/audit/activity",
			undefined,
			{ query: { hours } },
		);
	});
	it("defaults the window and does not swallow upstream denials", async () => {
		const f = fixture();
		await new AuthClient(f.internal).getFederationAuditActivity();
		expect(f.request.mock.calls[0]?.[3]).toEqual({ query: { hours: 24 } });
		f.request.mockRejectedValue(new Error("denied"));
		await expect(new AuthClient(f.internal).getFederationAuditActivity()).rejects.toThrow("denied");
		await expect(new BillingClient(f.internal).listCustomerCredits()).rejects.toThrow("denied");
	});
	it.each([0, 1.5, 169, NaN, Infinity])("rejects invalid audit window %s before I/O", (hours) => {
		const f = fixture();
		expect(() => new AuthClient(f.internal).getFederationAuditActivity(hours)).toThrow(RangeError);
		expect(f.request).not.toHaveBeenCalled();
	});
});
