import { describe, expect, it } from "vitest";

import * as observability from "./index.js";

describe("package entry point", () => {
	it("re-exports the full observability surface", () => {
		expect(typeof observability.createIntegrityLogger).toBe("function");
		expect(typeof observability.createMeterProvider).toBe("function");
		expect(typeof observability.createTelemetryResource).toBe("function");
		expect(typeof observability.configureNodeTracing).toBe("function");
		expect(typeof observability.enrichMetricAttributes).toBe("function");
	});
});
