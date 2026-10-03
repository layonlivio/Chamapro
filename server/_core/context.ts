import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserById } from "../db";
import { getCookieValue, getUserIdFromLocalSession, LOCAL_COOKIE_NAME } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    const token = getCookieValue(opts.req.headers.cookie, LOCAL_COOKIE_NAME);
    const userId = await getUserIdFromLocalSession(token);
    if (userId) user = (await getUserById(userId)) ?? null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
