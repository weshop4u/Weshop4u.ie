import { describe, it, expect } from "vitest";

/**
 * Tests for the base64 data URL prefix stripping fix.
 * The bug was: when a data URL (e.g. "data:image/jpeg;base64,/9j/4AAQ...")
 * was passed to Buffer.from(str, "base64"), Node silently decoded the
 * "data:image/jpeg;base64," prefix as garbage bytes prepended to the image.
 */
describe("Base64 Data URL Prefix Stripping", () => {
  // Simulate the fix logic used in stores.uploadLogo and categories.uploadImage
  function stripDataUrlPrefix(base64: string): string {
    let rawBase64 = base64;
    if (rawBase64.includes(",")) {
      rawBase64 = rawBase64.split(",")[1];
    }
    return rawBase64;
  }

  it("should strip data:image/jpeg;base64, prefix", () => {
    const input = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const result = stripDataUrlPrefix(input);
    expect(result).toBe("/9j/4AAQSkZJRg==");
  });

  it("should strip data:image/png;base64, prefix", () => {
    const input = "data:image/png;base64,iVBORw0KGgo=";
    const result = stripDataUrlPrefix(input);
    expect(result).toBe("iVBORw0KGgo=");
  });

  it("should not modify plain base64 without prefix", () => {
    const input = "/9j/4AAQSkZJRg==";
    const result = stripDataUrlPrefix(input);
    expect(result).toBe("/9j/4AAQSkZJRg==");
  });

  it("should produce valid JPEG bytes when prefix is stripped", () => {
    // A minimal JPEG starts with ff d8 ff e0
    const jpegBase64 = "/9j/4AAQ"; // This decodes to ff d8 ff e0 00 10
    const dataUrl = `data:image/jpeg;base64,${jpegBase64}`;

    // Without fix: Buffer.from decodes the prefix as garbage
    const withoutFix = Buffer.from(dataUrl, "base64");
    // The first bytes would be garbage (decoded "data:image/jpeg;base64,")
    expect(withoutFix[0]).not.toBe(0xff); // NOT a valid JPEG start

    // With fix: strip prefix first
    const stripped = stripDataUrlPrefix(dataUrl);
    const withFix = Buffer.from(stripped, "base64");
    expect(withFix[0]).toBe(0xff); // Valid JPEG start
    expect(withFix[1]).toBe(0xd8); // JPEG SOI marker
  });

  it("should produce valid PNG bytes when prefix is stripped", () => {
    // PNG starts with 89 50 4e 47
    const pngBase64 = "iVBORw=="; // This decodes to 89 50 4e 47
    const dataUrl = `data:image/png;base64,${pngBase64}`;

    // With fix
    const stripped = stripDataUrlPrefix(dataUrl);
    const withFix = Buffer.from(stripped, "base64");
    expect(withFix[0]).toBe(0x89); // Valid PNG start
    expect(withFix[1]).toBe(0x50); // 'P'
    expect(withFix[2]).toBe(0x4e); // 'N'
    expect(withFix[3]).toBe(0x47); // 'G'
  });
});
