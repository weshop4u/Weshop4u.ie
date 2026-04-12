import type { Request, Response, NextFunction } from "express";
import { authenticateRequestWithJwt } from "./jwt-auth.js";
import { sdk } from "./sdk.js";

/**
 * Middleware to protect admin routes at the server level.
 * Blocks non-admin users from accessing /api/web/admin* paths.
 * 
 * This middleware:
 * 1. Authenticates the user (SDK or JWT)
 * 2. Checks if user role is 'admin'
 * 3. Blocks access with 403 Forbidden if not admin
 * 4. Allows access if admin
 * 
 * Must be placed BEFORE static file middleware to prevent HTML from being served.
 */
export async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let user: any = null;

    // Try SDK authentication first (Manus sandbox)
    try {
      user = await sdk.authenticateRequest(req);
      console.log("[AdminAuth] Authenticated via SDK:", user?.email, "role:", user?.role);
    } catch (sdkError) {
      // Fall back to JWT authentication (production)
      try {
        user = await authenticateRequestWithJwt(req);
        console.log("[AdminAuth] Authenticated via JWT:", user?.email, "role:", user?.role);
      } catch (jwtError) {
        console.log("[AdminAuth] Authentication failed (SDK and JWT)");
        // Not authenticated - deny access
        return res.status(401).json({ error: "Unauthorized: Please log in" });
      }
    }

    // Check if user has admin role
    if (user?.role !== "admin") {
      console.log("[AdminAuth] Access denied - user role is:", user?.role, "email:", user?.email);
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    // User is authenticated and is admin - allow access
    console.log("[AdminAuth] Access granted to admin:", user?.email);
    next();
  } catch (error) {
    console.error("[AdminAuth] Middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
