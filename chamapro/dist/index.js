// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 180 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  phone: varchar("phone", { length: 32 }),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var professionalProfiles = mysqlTable(
  "professional_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    serviceArea: varchar("serviceArea", { length: 240 }),
    bio: text("bio"),
    plan: mysqlEnum("plan", ["free", "pro"]).default("free").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
    stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => ({ regionIdx: index("professional_profiles_region_idx").on(table.city, table.category) })
);
var serviceRequests = mysqlTable(
  "service_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId"),
    nameSnapshot: varchar("nameSnapshot", { length: 160 }).notNull(),
    contactPhone: varchar("contactPhone", { length: 32 }),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    urgency: mysqlEnum("urgency", ["flexible", "next_days", "soon", "today"]).default("flexible").notNull(),
    description: text("description").notNull(),
    status: mysqlEnum("status", ["open", "in_progress", "closed"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => ({ regionIdx: index("service_requests_region_idx").on(table.city, table.category) })
);
var leadMatches = mysqlTable(
  "lead_matches",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").notNull(),
    professionalId: int("professionalId").notNull(),
    status: mysqlEnum("status", ["new", "viewed", "contacted", "won", "lost"]).default("new").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    viewedAt: timestamp("viewedAt")
  },
  (table) => ({
    matchIdx: uniqueIndex("lead_matches_request_professional_idx").on(table.requestId, table.professionalId),
    professionalIdx: index("lead_matches_professional_idx").on(table.professionalId, table.status)
  })
);
var proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  professionalId: int("professionalId").notNull(),
  amountCents: int("amountCents"),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["sent", "accepted", "rejected"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var billingRecords = mysqlTable("billing_records", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professionalId").notNull(),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 128 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/localAuth.ts
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
var LOCAL_COOKIE_NAME = "chamapro_session";
var secret = new TextEncoder().encode(ENV.cookieSecret || "chamapro-development-secret");
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
async function createLocalSession(user) {
  return new SignJWT({ userId: user.id, auth: "local" }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime("30d").sign(secret);
}
async function getUserIdFromLocalSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.userId === "number" ? payload.userId : Number(payload.sub) || null;
  } catch {
    return null;
  }
}
function getCookieValue(cookieHeader, name) {
  return cookieHeader?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}
function newLocalOpenId() {
  return `local_${randomUUID()}`;
}
function sessionCookie(token) {
  return `${LOCAL_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${ENV.isProduction ? "; Secure" : ""}`;
}
function expiredSessionCookie() {
  return `${LOCAL_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${ENV.isProduction ? "; Secure" : ""}`;
}

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? /* @__PURE__ */ new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== void 0 || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}
async function getLocalUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}
async function createLocalUser(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(users).values({ openId: newLocalOpenId(), name: input.name, email: input.email.toLowerCase(), passwordHash: hashPassword(input.password), loginMethod: "local" });
  return getUserById(Number(result[0].insertId));
}
async function authenticateLocalUser(email, password) {
  const user = await getLocalUserByEmail(email);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) return void 0;
  const db = await getDb();
  if (db) await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, user.id));
  return user;
}
async function getCustomerProfile(userId) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  return rows[0];
}
async function upsertCustomerProfile(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getCustomerProfile(input.userId);
  if (existing) {
    await db.update(customerProfiles).set({ phone: input.phone ?? null, city: input.city, state: input.state }).where(eq(customerProfiles.userId, input.userId));
    return { ...existing, ...input };
  }
  const result = await db.insert(customerProfiles).values({ userId: input.userId, phone: input.phone ?? null, city: input.city, state: input.state });
  return { id: Number(result[0].insertId), ...input };
}
async function getProfessionalProfile(userId) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
  return rows[0];
}
async function upsertProfessionalProfile(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalized = { ...input, serviceArea: input.serviceArea ?? null, bio: input.bio ?? null };
  const existing = await getProfessionalProfile(input.userId);
  if (existing) {
    await db.update(professionalProfiles).set(normalized).where(eq(professionalProfiles.userId, input.userId));
    return { ...existing, ...normalized };
  }
  const result = await db.insert(professionalProfiles).values(normalized);
  return { id: Number(result[0].insertId), ...normalized, plan: "free", isActive: true };
}
async function createServiceRequest(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(serviceRequests).values(input);
  const requestId = Number(result[0].insertId);
  const pros = await db.select({ id: professionalProfiles.id }).from(professionalProfiles).where(and(eq(professionalProfiles.city, input.city), eq(professionalProfiles.category, input.category), eq(professionalProfiles.isActive, true)));
  if (pros.length) await db.insert(leadMatches).values(pros.map((pro) => ({ requestId, professionalId: pro.id })));
  return { id: requestId, matchCount: pros.length };
}
async function listCustomerRequests(customerId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceRequests).where(eq(serviceRequests.customerId, customerId)).orderBy(desc(serviceRequests.createdAt));
}
async function listProfessionalLeads(professionalId) {
  const db = await getDb();
  if (!db) return [];
  const matches = await db.select().from(leadMatches).where(eq(leadMatches.professionalId, professionalId)).orderBy(desc(leadMatches.createdAt));
  const requests = await Promise.all(matches.map(async (match) => {
    const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.id, match.requestId)).limit(1);
    return rows[0] ? { ...rows[0], matchId: match.id, matchStatus: match.status } : null;
  }));
  return requests.filter((request) => request !== null);
}
async function markLeadViewed(userId, matchId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const profile = await getProfessionalProfile(userId);
  if (!profile) throw new Error("Professional profile not found");
  await db.update(leadMatches).set({ status: "viewed", viewedAt: /* @__PURE__ */ new Date() }).where(and(eq(leadMatches.id, matchId), eq(leadMatches.professionalId, profile.id)));
  return { success: true };
}
async function createProposal(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const profile = await getProfessionalProfile(input.userId);
  if (!profile) throw new Error("Professional profile not found");
  const result = await db.insert(proposals).values({ requestId: input.requestId, professionalId: profile.id, amountCents: input.amountCents ?? null, message: input.message });
  return { id: Number(result[0].insertId) };
}
async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { customers: 0, professionals: 0, openRequests: 0, proPlans: 0, recentRequests: [], recentProfessionals: [] };
  const [customerCount] = await db.select({ count: sql`count(*)` }).from(customerProfiles);
  const [professionalCount] = await db.select({ count: sql`count(*)` }).from(professionalProfiles);
  const [openRequestCount] = await db.select({ count: sql`count(*)` }).from(serviceRequests).where(eq(serviceRequests.status, "open"));
  const [proCount] = await db.select({ count: sql`count(*)` }).from(professionalProfiles).where(eq(professionalProfiles.plan, "pro"));
  const recentRequests = await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt)).limit(6);
  const recentProfessionals = await db.select().from(professionalProfiles).orderBy(desc(professionalProfiles.createdAt)).limit(6);
  return { customers: Number(customerCount?.count ?? 0), professionals: Number(professionalCount?.count ?? 0), openRequests: Number(openRequestCount?.count ?? 0), proPlans: Number(proCount?.count ?? 0), recentRequests, recentProfessionals };
}
async function saveBillingRecord(input) {
  const db = await getDb();
  if (!db) return;
  await db.insert(billingRecords).values({ professionalId: input.professionalId, stripeInvoiceId: input.stripeInvoiceId ?? null, stripePaymentIntentId: input.stripePaymentIntentId ?? null, eventType: input.eventType });
}
async function listBillingRecords(userId) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfessionalProfile(userId);
  if (!profile) return [];
  return db.select().from(billingRecords).where(eq(billingRecords.professionalId, profile.id)).orderBy(desc(billingRecords.createdAt));
}
async function activateProfessionalSubscription(userId, stripeCustomerId, stripeSubscriptionId) {
  const db = await getDb();
  if (!db) return;
  await db.update(professionalProfiles).set({ plan: "pro", stripeCustomerId, stripeSubscriptionId }).where(eq(professionalProfiles.userId, userId));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT as SignJWT2, jwtVerify as jwtVerify2 } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret2 = ENV.cookieSecret;
    return new TextEncoder().encode(secret2);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT2({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify2(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/products.ts
var PROFESSIONAL_PLANS = [
  {
    id: "free",
    name: "Essencial",
    price: "R$ 0",
    cadence: "para come\xE7ar",
    description: "O essencial para validar seu perfil e receber os primeiros pedidos.",
    features: ["Perfil profissional", "Leads limitados da sua regi\xE3o", "Contato direto pelo WhatsApp"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 29,90",
    cadence: "por m\xEAs",
    description: "Mais alcance para transformar pedidos locais em agenda cheia.",
    features: ["Mais oportunidades por regi\xE3o", "Perfil em destaque", "Estat\xEDsticas de convers\xE3o", "Suporte priorit\xE1rio"]
  }
];
var SERVICE_CATEGORIES = [
  "El\xE9trica",
  "Encanamento",
  "Ar-condicionado",
  "C\xE2meras e seguran\xE7a",
  "Automa\xE7\xE3o residencial",
  "Marcenaria / montagem",
  "Limpeza",
  "Manuten\xE7\xE3o geral",
  "Outro"
];
var URGENCY_OPTIONS = [
  { value: "flexible", label: "Sem urg\xEAncia" },
  { value: "next_days", label: "Nos pr\xF3ximos dias" },
  { value: "soon", label: "O quanto antes" },
  { value: "today", label: "Hoje" }
];

// server/stripe.ts
import Stripe from "stripe";
import { eq as eq2 } from "drizzle-orm";
function getStripe() {
  const secret2 = process.env.STRIPE_SECRET_KEY;
  if (!secret2) return null;
  return new Stripe(secret2);
}
async function createProfessionalCheckout(input) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe ainda n\xE3o foi configurado em Settings \u2192 Payment.");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email ?? void 0,
    client_reference_id: String(input.userId),
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: 2990,
          recurring: { interval: "month" },
          product_data: {
            name: "ChamaPro Pro",
            description: "Mais oportunidades de servi\xE7o na sua regi\xE3o."
          }
        },
        quantity: 1
      }
    ],
    metadata: {
      user_id: String(input.userId),
      customer_email: input.email ?? "",
      customer_name: input.name ?? ""
    },
    success_url: `${input.origin}/profissional?checkout=success`,
    cancel_url: `${input.origin}/profissional?checkout=cancelled`
  });
  return { url: session.url };
}
async function handleStripeWebhook(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n\xE3o configurado");
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return { verified: true };
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
    if (userId) {
      await activateProfessionalSubscription(userId, customerId, subscriptionId);
      const profile = await getProfessionalProfile(userId);
      if (profile) await saveBillingRecord({ professionalId: profile.id, eventType: event.type });
    }
  }
  if (event.type === "invoice.paid" || event.type === "payment_intent.succeeded") {
    const object = event.data.object;
    const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
    if (customerId) {
      const db = await getDb();
      if (db) {
        const profiles = await db.select().from(professionalProfiles).where(eq2(professionalProfiles.stripeCustomerId, customerId)).limit(1);
        const profile = profiles[0];
        if (profile) {
          await saveBillingRecord({
            professionalId: profile.id,
            stripeInvoiceId: event.type === "invoice.paid" ? object.id : void 0,
            stripePaymentIntentId: event.type === "payment_intent.succeeded" ? object.id : void 0,
            eventType: event.type
          });
        }
      }
    }
  }
  return { received: true };
}

// server/routers.ts
var adminProcedure2 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Acesso administrativo necess\xE1rio." });
  return next();
});
var profileSchema = z2.object({
  displayName: z2.string().min(2),
  phone: z2.string().min(8),
  whatsapp: z2.string().min(8),
  category: z2.string().min(2),
  city: z2.string().min(2),
  state: z2.string().length(2),
  serviceArea: z2.string().optional(),
  bio: z2.string().max(500).optional()
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure.input(z2.object({ name: z2.string().min(2).max(120), email: z2.string().email(), password: z2.string().min(8).max(120) })).mutation(async ({ ctx, input }) => {
      if (await getLocalUserByEmail(input.email)) throw new TRPCError3({ code: "CONFLICT", message: "Este email j\xE1 est\xE1 cadastrado." });
      const user = await createLocalUser(input);
      if (!user) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar sua conta." });
      ctx.res.setHeader("Set-Cookie", sessionCookie(await createLocalSession(user)));
      return user;
    }),
    login: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string().min(8).max(120) })).mutation(async ({ ctx, input }) => {
      const user = await authenticateLocalUser(input.email, input.password);
      if (!user) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
      ctx.res.setHeader("Set-Cookie", sessionCookie(await createLocalSession(user)));
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (typeof ctx.res.setHeader === "function") ctx.res.setHeader("Set-Cookie", expiredSessionCookie());
      return { success: true };
    })
  }),
  public: router({
    catalog: publicProcedure.query(() => ({ categories: SERVICE_CATEGORIES, urgency: URGENCY_OPTIONS, plans: PROFESSIONAL_PLANS }))
  }),
  requests: router({
    create: publicProcedure.input(z2.object({ name: z2.string().min(2), contactPhone: z2.string().optional(), city: z2.string().min(2), state: z2.string().length(2), category: z2.string().min(2), urgency: z2.enum(["flexible", "next_days", "soon", "today"]), description: z2.string().min(12) })).mutation(async ({ ctx, input }) => {
      const result = await createServiceRequest({ ...input, nameSnapshot: input.name, customerId: ctx.user?.id });
      return { ...result, message: result.matchCount ? `Pedido enviado para ${result.matchCount} profissional(is) compat\xEDvel(is).` : "Pedido recebido. Estamos ativando profissionais na sua regi\xE3o." };
    })
  }),
  customer: router({
    me: protectedProcedure.query(({ ctx }) => getCustomerProfile(ctx.user.id)),
    saveProfile: protectedProcedure.input(z2.object({ phone: z2.string().optional(), city: z2.string().min(2), state: z2.string().length(2) })).mutation(({ ctx, input }) => upsertCustomerProfile({ userId: ctx.user.id, ...input })),
    requests: protectedProcedure.query(({ ctx }) => listCustomerRequests(ctx.user.id))
  }),
  professional: router({
    me: protectedProcedure.query(({ ctx }) => getProfessionalProfile(ctx.user.id)),
    saveProfile: protectedProcedure.input(profileSchema).mutation(({ ctx, input }) => upsertProfessionalProfile({ userId: ctx.user.id, ...input })),
    leads: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getProfessionalProfile(ctx.user.id);
      return profile ? listProfessionalLeads(profile.id) : [];
    }),
    markViewed: protectedProcedure.input(z2.object({ matchId: z2.number().int().positive() })).mutation(({ ctx, input }) => markLeadViewed(ctx.user.id, input.matchId)),
    sendProposal: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), amountCents: z2.number().int().positive().optional(), message: z2.string().min(10) })).mutation(({ ctx, input }) => createProposal({ userId: ctx.user.id, ...input })),
    checkout: protectedProcedure.mutation(({ ctx }) => createProfessionalCheckout({ userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, origin: ctx.req.headers.origin ?? "http://localhost:3000" }))
  }),
  billing: router({
    history: protectedProcedure.query(({ ctx }) => listBillingRecords(ctx.user.id))
  }),
  admin: router({
    overview: adminProcedure2.query(() => getAdminOverview())
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  if (!user) {
    const token = getCookieValue(opts.req.headers.cookie, LOCAL_COOKIE_NAME);
    const userId = await getUserIdFromLocalSession(token);
    if (userId) user = await getUserById(userId) ?? null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.post("/api/stripe/webhook", express2.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      return res.status(400).json({ error: "Missing Stripe signature" });
    }
    try {
      const result = await handleStripeWebhook(req.body, signature);
      return res.json(result);
    } catch (error) {
      console.error("[Stripe] Webhook error", error);
      return res.status(400).json({ error: "Webhook verification failed" });
    }
  });
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
