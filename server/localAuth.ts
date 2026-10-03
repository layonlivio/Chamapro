import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { User } from "../drizzle/schema";
import { ENV } from "./_core/env";

export const LOCAL_COOKIE_NAME = "chamapro_session";
const secret = new TextEncoder().encode(ENV.cookieSecret || "chamapro-development-secret");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export async function createLocalSession(user: User) {
  return new SignJWT({ userId: user.id, auth: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function getUserIdFromLocalSession(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.userId === "number" ? payload.userId : Number(payload.sub) || null;
  } catch {
    return null;
  }
}

export function getCookieValue(cookieHeader: string | undefined, name: string) {
  return cookieHeader?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function newLocalOpenId() {
  return `local_${randomUUID()}`;
}

export function sessionCookie(token: string) {
  return `${LOCAL_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${ENV.isProduction ? "; Secure" : ""}`;
}

export function expiredSessionCookie() {
  return `${LOCAL_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${ENV.isProduction ? "; Secure" : ""}`;
}
