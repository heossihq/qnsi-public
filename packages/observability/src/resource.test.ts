import { describe, expect, it, vi } from "vitest";

import { createTelemetryResource } from "./resource.js";

describe("resource", () => {
	it("creates resource with defaults", () => {
		const resource = createTelemetryResource({ serviceName: "observability-test" });
		const attributes = resource.attributes;
		expect(attributes["service.name"]).toBe("observability-test");
		expect(attributes["deployment.environment"]).toBe("development");
	});

	it("applies overrides", () => {
		const resource = createTelemetryResource({
			serviceName: "observability-test",
			serviceVersion: "1.2.3",
			environment: "staging",
			deploymentId: "abc123",
			attributes: { "qnsp.cluster": "cluster-a" },
		});

		expect(resource.attributes["service.version"]).toBe("1.2.3");
		expect(resource.attributes["deployment.environment"]).toBe("staging");
		expect(resource.attributes["deployment.id"]).toBe("abc123");
		expect(resource.attributes["qnsp.cluster"]).toBe("cluster-a");
	});

	it("enables OpenTelemetry diagnostics when requested", async () => {
		const { diag } = await import("@opentelemetry/api");
		const spy = vi.spyOn(diag, "setLogger").mockReturnValue(true as never);
		try {
			createTelemetryResource({ serviceName: "observability-test", diagnosticsEnabled: true });
			expect(spy).toHaveBeenCalledTimes(1);
		} finally {
			spy.mockRestore();
		}
	});
});
