import { describe, it, expect } from "vitest";

describe("PUBLIC_URL environment variable", () => {
  it("should be set and be a valid HTTPS URL", () => {
    const publicUrl = process.env.PUBLIC_URL;
    expect(publicUrl).toBeDefined();
    expect(publicUrl).toBeTruthy();
    expect(publicUrl!.startsWith("https://")).toBe(true);
  });

  it("should not end with a trailing slash", () => {
    const publicUrl = process.env.PUBLIC_URL!;
    expect(publicUrl.endsWith("/")).toBe(false);
  });

  it("should produce a valid tracking URL when combined with order ID", () => {
    const publicUrl = process.env.PUBLIC_URL!;
    const trackingUrl = `${publicUrl}/track/123`;
    expect(trackingUrl).toMatch(/^https:\/\/.+\/track\/123$/);
  });
});
