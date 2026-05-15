import { describe, it, expect } from "vitest";

describe("Elavon Credentials", () => {
  it("should have ELAVON_PROCESSOR_ID set", () => {
    const val = process.env.ELAVON_PROCESSOR_ID;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should have ELAVON_PUBLIC_KEY set with pk_ prefix", () => {
    const val = process.env.ELAVON_PUBLIC_KEY;
    expect(val).toBeDefined();
    expect(val!.startsWith("pk_")).toBe(true);
  });

  it("should have ELAVON_SECRET_KEY set with sk_ prefix", () => {
    const val = process.env.ELAVON_SECRET_KEY;
    expect(val).toBeDefined();
    expect(val!.startsWith("sk_")).toBe(true);
  });

  it("should have ELAVON_MERCHANT_ALIAS set", () => {
    const val = process.env.ELAVON_MERCHANT_ALIAS;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should be able to construct valid Base64 auth header", () => {
    const alias = process.env.ELAVON_MERCHANT_ALIAS!;
    const secret = process.env.ELAVON_SECRET_KEY!;
    const encoded = Buffer.from(`${alias}:${secret}`).toString("base64");
    expect(encoded).toBeTruthy();
    // Decode and verify round-trip
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    expect(decoded).toBe(`${alias}:${secret}`);
  });
});
