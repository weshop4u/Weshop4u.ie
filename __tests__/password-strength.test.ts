import { describe, it, expect } from "vitest";
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "../lib/password-strength";

describe("Password Strength Calculator", () => {
  it("should return weak for empty password", () => {
    const result = calculatePasswordStrength("");
    expect(result.strength).toBe("weak");
    expect(result.score).toBe(0);
  });

  it("should return weak for short password with no variety", () => {
    const result = calculatePasswordStrength("abc123");
    expect(result.strength).toBe("fair");
    expect(result.score).toBeGreaterThan(0);
  });

  it("should return fair for password with lowercase and numbers", () => {
    const result = calculatePasswordStrength("password123");
    expect(result.strength).toBe("good");
  });

  it("should return good for password with uppercase, lowercase, and numbers", () => {
    const result = calculatePasswordStrength("Password123");
    expect(result.strength).toBe("strong");
  });

  it("should return strong for password with all character types", () => {
    const result = calculatePasswordStrength("Password123!");
    expect(result.strength).toBe("strong");
  });

  it("should return strong for long password", () => {
    const result = calculatePasswordStrength("verylongpassword1234567890");
    expect(result.strength).toBe("good");
  });

  it("should provide helpful feedback", () => {
    const result = calculatePasswordStrength("password");
    expect(result.feedback).toBeTruthy();
    expect(typeof result.feedback).toBe("string");
  });

  it("should calculate score correctly", () => {
    const weak = calculatePasswordStrength("abc");
    const fair = calculatePasswordStrength("abcdef");
    const good = calculatePasswordStrength("Abcdef123");
    const strong = calculatePasswordStrength("Abcdef123!");

    expect(weak.score).toBeLessThan(fair.score);
    expect(fair.score).toBeLessThan(good.score);
    expect(good.score).toBeLessThan(strong.score);
  });
});

describe("Password Strength Color", () => {
  it("should return red for weak password", () => {
    expect(getPasswordStrengthColor("weak")).toBe("#EF4444");
  });

  it("should return orange for fair password", () => {
    expect(getPasswordStrengthColor("fair")).toBe("#F59E0B");
  });

  it("should return yellow for good password", () => {
    expect(getPasswordStrengthColor("good")).toBe("#FBBF24");
  });

  it("should return green for strong password", () => {
    expect(getPasswordStrengthColor("strong")).toBe("#22C55E");
  });
});

describe("Password Strength Label", () => {
  it("should return correct labels", () => {
    expect(getPasswordStrengthLabel("weak")).toBe("Weak");
    expect(getPasswordStrengthLabel("fair")).toBe("Fair");
    expect(getPasswordStrengthLabel("good")).toBe("Good");
    expect(getPasswordStrengthLabel("strong")).toBe("Strong");
  });
});
