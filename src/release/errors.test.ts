import { describe, expect, it } from "vitest";
import { PublishError, ReleasesError, ValidationError } from "./errors.js";

describe("release errors", () => {
	it("ValidationError carries a reason discriminator", () => {
		const e = new ValidationError({ reason: "build", message: "build failed" });
		expect(e._tag).toBe("ValidationError");
		expect(e.reason).toBe("build");
	});

	it("PublishError carries a reason discriminator", () => {
		const e = new PublishError({ reason: "publish", message: "publish failed" });
		expect(e._tag).toBe("PublishError");
		expect(e.reason).toBe("publish");
	});

	it("ReleasesError carries a reason discriminator", () => {
		const e = new ReleasesError({ reason: "tag", message: "tag failed" });
		expect(e._tag).toBe("ReleasesError");
		expect(e.reason).toBe("tag");
	});
});
