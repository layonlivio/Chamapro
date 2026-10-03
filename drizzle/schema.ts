import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 180 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  phone: varchar("phone", { length: 32 }),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const professionalProfiles = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ regionIdx: index("professional_profiles_region_idx").on(table.city, table.category) })
);

export const serviceRequests = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ regionIdx: index("service_requests_region_idx").on(table.city, table.category) })
);

export const leadMatches = mysqlTable(
  "lead_matches",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").notNull(),
    professionalId: int("professionalId").notNull(),
    status: mysqlEnum("status", ["new", "viewed", "contacted", "won", "lost"]).default("new").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    viewedAt: timestamp("viewedAt"),
  },
  table => ({
    matchIdx: uniqueIndex("lead_matches_request_professional_idx").on(table.requestId, table.professionalId),
    professionalIdx: index("lead_matches_professional_idx").on(table.professionalId, table.status),
  })
);

export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  professionalId: int("professionalId").notNull(),
  amountCents: int("amountCents"),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["sent", "accepted", "rejected"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 48 }).notNull(),
  proposalId: int("proposalId"),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userIdx: index("notifications_user_idx").on(table.userId, table.readAt, table.createdAt) }));

export const billingRecords = mysqlTable("billing_records", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professionalId").notNull(),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 128 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type ProfessionalProfile = typeof professionalProfiles.$inferSelect;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type LeadMatch = typeof leadMatches.$inferSelect;
