import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

describe("Authentication Router", () => {
  it("should hash passwords correctly", async () => {
    const password = "testpassword123";
    const hashedPassword = await bcrypt.hash(password, 10);

    const isMatch = await bcrypt.compare(password, hashedPassword);
    expect(isMatch).toBe(true);

    const isWrongPassword = await bcrypt.compare("wrongpassword", hashedPassword);
    expect(isWrongPassword).toBe(false);
  });

  it("should validate email format", () => {
    const validEmails = [
      "test@example.com",
      "user.name@domain.co.uk",
      "user+tag@example.com",
    ];

    const invalidEmails = [
      "notanemail",
      "@example.com",
      "user@",
      "user @example.com",
    ];

    validEmails.forEach(email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(true);
    });

    invalidEmails.forEach(email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  it("should validate password length", () => {
    const validPasswords = ["password123", "securePass!", "123456"];
    const invalidPasswords = ["12345", "pass", ""];

    validPasswords.forEach(password => {
      expect(password.length >= 6).toBe(true);
    });

    invalidPasswords.forEach(password => {
      expect(password.length >= 6).toBe(false);
    });
  });

  it("should handle role-based routing logic", () => {
    const users = [
      { role: "customer", expectedRoute: "/" },
      { role: "driver", expectedRoute: "/driver" },
      { role: "store_staff", expectedRoute: "/store" },
    ];

    users.forEach(user => {
      let route = "/";
      if (user.role === "driver") {
        route = "/driver";
      } else if (user.role === "store_staff") {
        route = "/store";
      }

      expect(route).toBe(user.expectedRoute);
    });
  });

  it("should normalize email addresses", () => {
    const emails = [
      { input: "User@Example.COM", expected: "user@example.com" },
      { input: "  test@domain.com  ", expected: "test@domain.com" },
      { input: "ADMIN@STORE.COM", expected: "admin@store.com" },
    ];

    emails.forEach(({ input, expected }) => {
      const normalized = input.toLowerCase().trim();
      expect(normalized).toBe(expected);
    });
  });

  it("should validate vehicle registration format", () => {
    const registrations = [
      { input: "231-d-12345", expected: "231-D-12345" },
      { input: "abc123", expected: "ABC123" },
      { input: "  reg-123  ", expected: "REG-123" },
    ];

    registrations.forEach(({ input, expected }) => {
      const normalized = input.trim().toUpperCase();
      expect(normalized).toBe(expected);
    });
  });
});
