import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SelectUser } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SelectUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: SelectUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    console.log("[Context] Authenticated user:", user ? `${user.email} (id: ${user.id})` : "null");
  } catch (error) {
    // Authentication is optional for public procedures.
    console.log("[Context] Authentication failed:", error instanceof Error ? error.message : String(error));
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
