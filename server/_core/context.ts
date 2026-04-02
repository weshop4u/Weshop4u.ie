import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SelectUser } from "../db";
import { sdk } from "./sdk";
import { authenticateRequestWithJwt } from "./jwt-auth.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SelectUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: SelectUser | null = null;

  try {
    // Try Manus SDK authentication first (for Manus sandbox)
    user = await sdk.authenticateRequest(opts.req);
    console.log("[Context] Authenticated user via SDK:", user ? `${user.email} (id: ${user.id})` : "null");
  } catch (error) {
    // Fall back to JWT authentication (for Render/production)
    try {
      user = await authenticateRequestWithJwt(opts.req);
      console.log("[Context] Authenticated user via JWT:", user ? `${user.email} (id: ${user.id})` : "null");
    } catch (jwtError) {
      // Authentication is optional for public procedures.
      console.log("[Context] Authentication failed (SDK and JWT):", 
        error instanceof Error ? error.message : String(error));
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
