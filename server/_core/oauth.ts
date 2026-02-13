import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByEmail, upsertUser, type SelectUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: { email?: string | null; name?: string | null }): Promise<SelectUser> {
  console.log("[syncUser] Called with:", userInfo);
  
  if (!userInfo.email) {
    console.log("[syncUser] No email provided, throwing error");
    throw new Error("Email is required for user sync");
  }
  
  let user = await getUserByEmail(userInfo.email);
  console.log("[syncUser] getUserByEmail result:", user ? `Found user id=${user.id}, email=${user.email}` : "null");
  
  if (!user) {
    // User doesn't exist in database - create a new customer account
    console.log("[syncUser] Creating new user for:", userInfo.email);
    await upsertUser({
      email: userInfo.email,
      name: userInfo.name || "User",
    });
    // Fetch the newly created user
    user = await getUserByEmail(userInfo.email);
    console.log("[syncUser] After upsert, user:", user ? `id=${user.id}` : "null");
    if (!user) {
      throw new Error("Failed to create user");
    }
  }
  
  // Return existing or newly created user
  console.log("[syncUser] Returning user:", user.id, user.email);
  return user;
}

function buildUserResponse(
  user: {
    id?: number;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    role?: string;
    createdAt?: Date;
    updatedAt?: Date;
  },
) {
  return {
    id: user?.id ?? null,
    email: user?.email ?? null,
    name: user?.name ?? null,
    phone: user?.phone ?? null,
    role: user?.role ?? null,
  };
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the frontend URL (Expo web on port 8081)
      // Cookie is set with parent domain so it works across both 3000 and 8081 subdomains
      const frontendUrl =
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  // Email/password login endpoint that creates a session cookie
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    
    try {
      // Look up user in database
      const user = await getUserByEmail(email);
      
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      
      // Create session token using user's email as identifier
      const sessionToken = await sdk.createSessionToken(email, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      console.log("[Login] Session created for:", email);
      res.json({ success: true, user: buildUserResponse(user), sessionToken });
    } catch (error) {
      console.error("[Login] Failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    console.log("[Logout] Backend logout called");
    
    const cookieOptions = getSessionCookieOptions(req);
    
    // Strategy: Instead of clearing (which might fail due to domain mismatch),
    // OVERWRITE the cookie with an invalid token and immediate expiry
    // This ensures even if the cookie persists, it won't be valid
    res.cookie(COOKIE_NAME, "LOGGED_OUT", {
      ...cookieOptions,
      maxAge: 0, // Expire immediately
    });
    
    // Also try to clear it (belt and suspenders)
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.clearCookie(COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.clearCookie(COOKIE_NAME, { path: "/" });
    
    console.log("[Logout] Cookie invalidated and cleared");
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
