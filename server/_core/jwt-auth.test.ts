import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, extractToken } from "./jwt-auth";
import type { Request } from "express";

describe("JWT Authentication", () => {
  const testSecret = "test-jwt-secret-key-for-testing";
  
  beforeAll(() => {
    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = testSecret;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  describe("verifyToken", () => {
    it("should verify a valid JWT token", () => {
      const payload = {
        userId: 1,
        email: "test@example.com",
        name: "Test User",
        role: "customer",
      };

      const token = jwt.sign(payload, testSecret, { expiresIn: "1y" });
      const verified = verifyToken(token);

      expect(verified).toBeTruthy();
      expect(verified?.userId).toBe(1);
      expect(verified?.email).toBe("test@example.com");
      expect(verified?.name).toBe("Test User");
      expect(verified?.role).toBe("customer");
    });

    it("should return null for invalid token", () => {
      const verified = verifyToken("invalid-token");
      expect(verified).toBeNull();
    });

    it("should return null for expired token", () => {
      const payload = {
        userId: 1,
        email: "test@example.com",
      };

      const token = jwt.sign(payload, testSecret, { expiresIn: "-1h" });
      const verified = verifyToken(token);

      expect(verified).toBeNull();
    });

    it("should return null when JWT_SECRET is not set", () => {
      delete process.env.JWT_SECRET;
      const payload = { userId: 1, email: "test@example.com" };
      const token = jwt.sign(payload, testSecret);
      const verified = verifyToken(token);
      expect(verified).toBeNull();
      process.env.JWT_SECRET = testSecret;
    });
  });

  describe("extractToken", () => {
    it("should extract token from Authorization header", () => {
      const req = {
        headers: {
          authorization: "Bearer test-token-123",
        },
        cookies: {},
      } as unknown as Request;

      const token = extractToken(req);
      expect(token).toBe("test-token-123");
    });

    it("should extract token from cookie", () => {
      const req = {
        headers: {},
        cookies: {
          "weshop4u-session": "cookie-token-456",
        },
      } as unknown as Request;

      const token = extractToken(req);
      expect(token).toBe("cookie-token-456");
    });

    it("should prefer Authorization header over cookie", () => {
      const req = {
        headers: {
          authorization: "Bearer header-token",
        },
        cookies: {
          "weshop4u-session": "cookie-token",
        },
      } as unknown as Request;

      const token = extractToken(req);
      expect(token).toBe("header-token");
    });

    it("should return null when no token is provided", () => {
      const req = {
        headers: {},
        cookies: {},
      } as unknown as Request;

      const token = extractToken(req);
      expect(token).toBeNull();
    });

    it("should handle Authorization header with different cases", () => {
      const req = {
        headers: {
          Authorization: "Bearer case-insensitive-token",
        },
        cookies: {},
      } as unknown as Request;

      const token = extractToken(req);
      expect(token).toBe("case-insensitive-token");
    });
  });
});
