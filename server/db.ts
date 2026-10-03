import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  billingRecords,
  customerProfiles,
  InsertUser,
  leadMatches,
  notifications,
  professionalProfiles,
  proposals,
  serviceRequests,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, newLocalOpenId, verifyPassword } from "./localAuth";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getLocalUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function createLocalUser(input: { name: string; email: string; password: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(users).values({ openId: newLocalOpenId(), name: input.name, email: input.email.toLowerCase(), passwordHash: hashPassword(input.password), loginMethod: "local" });
  return getUserById(Number(result[0].insertId));
}

export async function authenticateLocalUser(email: string, password: string) {
  const user = await getLocalUserByEmail(email);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) return undefined;
  const db = await getDb();
  if (db) await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

export async function getCustomerProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertCustomerProfile(input: { userId: number; phone?: string; city: string; state: string }) {
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

export async function getProfessionalProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertProfessionalProfile(input: { userId: number; displayName: string; phone: string; whatsapp: string; category: string; city: string; state: string; serviceArea?: string; bio?: string }) {
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

export async function createServiceRequest(input: { customerId?: number; nameSnapshot: string; contactPhone?: string; city: string; state: string; category: string; urgency: "flexible" | "next_days" | "soon" | "today"; description: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(serviceRequests).values(input);
  const requestId = Number(result[0].insertId);
  const pros = await db.select({ id: professionalProfiles.id }).from(professionalProfiles).where(and(eq(professionalProfiles.city, input.city), eq(professionalProfiles.category, input.category), eq(professionalProfiles.isActive, true)));
  if (pros.length) await db.insert(leadMatches).values(pros.map(pro => ({ requestId, professionalId: pro.id })));
  return { id: requestId, matchCount: pros.length };
}

export async function listCustomerRequests(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceRequests).where(eq(serviceRequests.customerId, customerId)).orderBy(desc(serviceRequests.createdAt));
}

export async function listProposalsForCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  const requests = await listCustomerRequests(customerId);
  if (!requests.length) return [];
  const rows = await Promise.all(requests.map(async request => {
    const requestProposals = await db.select().from(proposals).where(eq(proposals.requestId, request.id)).orderBy(desc(proposals.createdAt));
    const enriched = await Promise.all(requestProposals.map(async proposal => {
      const profiles = await db.select({ displayName: professionalProfiles.displayName, whatsapp: professionalProfiles.whatsapp, phone: professionalProfiles.phone, category: professionalProfiles.category }).from(professionalProfiles).where(eq(professionalProfiles.id, proposal.professionalId)).limit(1);
      return profiles[0] ? { ...proposal, request, professional: profiles[0] } : null;
    }));
    return enriched.filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null);
  }));
  return rows.flat();
}

export async function listProfessionalLeads(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  const matches = await db.select().from(leadMatches).where(eq(leadMatches.professionalId, professionalId)).orderBy(desc(leadMatches.createdAt));
  const requests = await Promise.all(matches.map(async match => {
    const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.id, match.requestId)).limit(1);
    return rows[0] ? { ...rows[0], matchId: match.id, matchStatus: match.status } : null;
  }));
  return requests.filter((request): request is NonNullable<typeof request> => request !== null);
}

export async function markLeadViewed(userId: number, matchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const profile = await getProfessionalProfile(userId);
  if (!profile) throw new Error("Professional profile not found");
  await db.update(leadMatches).set({ status: "viewed", viewedAt: new Date() }).where(and(eq(leadMatches.id, matchId), eq(leadMatches.professionalId, profile.id)));
  return { success: true };
}

export async function createProposal(input: { userId: number; requestId: number; amountCents?: number; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const profile = await getProfessionalProfile(input.userId);
  if (!profile) throw new Error("Professional profile not found");
  const requestRows = await db.select().from(serviceRequests).where(eq(serviceRequests.id, input.requestId)).limit(1);
  const request = requestRows[0];
  if (!request) throw new Error("Pedido não encontrado");
  const result = await db.insert(proposals).values({ requestId: input.requestId, professionalId: profile.id, amountCents: input.amountCents ?? null, message: input.message });
  if (request.customerId) {
    await db.insert(notifications).values({
      userId: request.customerId,
      type: "proposal_received",
      proposalId: Number(result[0].insertId),
      title: "Nova proposta recebida",
      body: `${profile.displayName} respondeu ao seu pedido de ${request.category}.`,
    });
  }
  return { id: Number(result[0].insertId) };
}

export async function listCustomerNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(20);
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  return { success: true };
}

export async function decideCustomerProposal(input: { userId: number; proposalId: number; decision: "accepted" | "rejected" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select({ proposal: proposals, request: serviceRequests }).from(proposals).innerJoin(serviceRequests, eq(proposals.requestId, serviceRequests.id)).where(and(eq(proposals.id, input.proposalId), eq(serviceRequests.customerId, input.userId))).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Proposta não encontrada");
  if (row.proposal.status !== "sent") throw new Error("Esta proposta já foi decidida");
  await db.update(proposals).set({ status: input.decision }).where(eq(proposals.id, input.proposalId));
  if (input.decision === "accepted") await db.update(serviceRequests).set({ status: "in_progress" }).where(eq(serviceRequests.id, row.request.id));
  return { success: true, status: input.decision };
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { customers: 0, professionals: 0, openRequests: 0, proPlans: 0, recentRequests: [], recentProfessionals: [] };
  const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(customerProfiles);
  const [professionalCount] = await db.select({ count: sql<number>`count(*)` }).from(professionalProfiles);
  const [openRequestCount] = await db.select({ count: sql<number>`count(*)` }).from(serviceRequests).where(eq(serviceRequests.status, "open"));
  const [proCount] = await db.select({ count: sql<number>`count(*)` }).from(professionalProfiles).where(eq(professionalProfiles.plan, "pro"));
  const recentRequests = await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt)).limit(6);
  const recentProfessionals = await db.select().from(professionalProfiles).orderBy(desc(professionalProfiles.createdAt)).limit(6);
  return { customers: Number(customerCount?.count ?? 0), professionals: Number(professionalCount?.count ?? 0), openRequests: Number(openRequestCount?.count ?? 0), proPlans: Number(proCount?.count ?? 0), recentRequests, recentProfessionals };
}

export async function saveBillingRecord(input: { professionalId: number; stripeInvoiceId?: string; stripePaymentIntentId?: string; eventType: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(billingRecords).values({ professionalId: input.professionalId, stripeInvoiceId: input.stripeInvoiceId ?? null, stripePaymentIntentId: input.stripePaymentIntentId ?? null, eventType: input.eventType });
}

export async function listBillingRecords(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfessionalProfile(userId);
  if (!profile) return [];
  return db.select().from(billingRecords).where(eq(billingRecords.professionalId, profile.id)).orderBy(desc(billingRecords.createdAt));
}

export async function activateProfessionalSubscription(userId: number, stripeCustomerId: string | null, stripeSubscriptionId: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(professionalProfiles).set({ plan: "pro", stripeCustomerId, stripeSubscriptionId }).where(eq(professionalProfiles.userId, userId));
}

export async function listAllProfessionals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(professionalProfiles).orderBy(desc(professionalProfiles.createdAt));
}

export async function activateProfessionalPro(professionalId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(professionalProfiles).set({ plan: "pro" }).where(eq(professionalProfiles.id, professionalId));
  return { success: true };
}

export async function deactivateProfessionalPro(professionalId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(professionalProfiles).set({ plan: "free" }).where(eq(professionalProfiles.id, professionalId));
  return { success: true };
}
