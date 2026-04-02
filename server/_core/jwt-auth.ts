import jwt from "jsonwebtoken";
import type { Request } from "express";
import { COOKIE_NAME } from "../../shared/const.js";
import { getUserById } from "../db.js";

export interface JwtPayload {
  userId: number;
  email: string;
  name?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Extract JWT token from request (cookie or Authorization header)
 */
export function extractToken(req: Request): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  // Try cookie
  const cookies = req.cookies as Record<string, string> | undefined;
  if (cookies && COOKIE_NAME in cookies) {
    return cookies[COOKIE_NAME];
  }

  return null;
}

/**
 * Verify JWT token and return payload
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("[JWT] JWT_SECRET not configured");
      return null;
    }

    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    return payload;
  } catch (error) {
    console.error("[JWT] Token verification failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Authenticate request using JWT token
 * Returns user from database if token is valid
 */
export async function authenticateRequestWithJwt(req: Request) {
  const token = extractToken(req);
  if (!token) {
    throw new Error("No token provided");
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new Error("Invalid token");
  }

  // Fetch user from database to ensure they still exist
  const user = await getUserById(payload.userId);
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
