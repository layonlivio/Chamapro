import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createProposal,
  decideCustomerProposal,
  authenticateLocalUser,
  createLocalUser,
  createServiceRequest,
  getLocalUserByEmail,
  getAdminOverview,
  getCustomerProfile,
  getProfessionalProfile,
  listAllProfessionals,
  listCustomerRequests,
  listCustomerNotifications,
  markNotificationRead,
  listProposalsForCustomer,
  listBillingRecords,
  listProfessionalLeads,
  markLeadViewed,
  upsertCustomerProfile,
  upsertProfessionalProfile,
  activateProfessionalPro,
  deactivateProfessionalPro,
} from "./db";
import { PROFESSIONAL_PLANS, SERVICE_CATEGORIES, URGENCY_OPTIONS } from "./products";
import { createProfessionalCheckout } from "./stripe";
import { createLocalSession, expiredSessionCookie, LOCAL_COOKIE_NAME, sessionCookie } from "./localAuth";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso administrativo necessário." });
  return next();
});

const profileSchema = z.object({
  displayName: z.string().min(2),
  phone: z.string().min(8),
  whatsapp: z.string().min(8),
  category: z.string().min(2),
  city: z.string().min(2),
  state: z.string().length(2),
  serviceArea: z.string().optional(),
  bio: z.string().max(500).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({ name: z.string().min(2).max(120), email: z.string().email(), password: z.string().min(8).max(120) })).mutation(async ({ ctx, input }) => {
      if (await getLocalUserByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado." });
      const user = await createLocalUser(input);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar sua conta." });
      ctx.res.setHeader("Set-Cookie", sessionCookie(await createLocalSession(user)));
      return user;
    }),
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(8).max(120) })).mutation(async ({ ctx, input }) => {
      const user = await authenticateLocalUser(input.email, input.password);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
      ctx.res.setHeader("Set-Cookie", sessionCookie(await createLocalSession(user)));
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (typeof ctx.res.setHeader === "function") ctx.res.setHeader("Set-Cookie", expiredSessionCookie());
      return { success: true } as const;
    }),
  }),

  public: router({
    catalog: publicProcedure.query(() => ({ categories: SERVICE_CATEGORIES, urgency: URGENCY_OPTIONS, plans: PROFESSIONAL_PLANS })),
  }),

  requests: router({
    create: publicProcedure
      .input(z.object({ name: z.string().min(2), contactPhone: z.string().optional(), city: z.string().min(2), state: z.string().length(2), category: z.string().min(2), urgency: z.enum(["flexible", "next_days", "soon", "today"]), description: z.string().min(12) }))
      .mutation(async ({ ctx, input }) => {
        const result = await createServiceRequest({ ...input, nameSnapshot: input.name, customerId: ctx.user?.id });
        return { ...result, message: result.matchCount ? `Pedido enviado para ${result.matchCount} profissional(is) compatível(is).` : "Pedido recebido. Estamos ativando profissionais na sua região." };
      }),
  }),

  customer: router({
    me: protectedProcedure.query(({ ctx }) => getCustomerProfile(ctx.user.id)),
    saveProfile: protectedProcedure.input(z.object({ phone: z.string().optional(), city: z.string().min(2), state: z.string().length(2) })).mutation(({ ctx, input }) => upsertCustomerProfile({ userId: ctx.user.id, ...input })),
    requests: protectedProcedure.query(({ ctx }) => listCustomerRequests(ctx.user.id)),
    proposals: protectedProcedure.query(({ ctx }) => listProposalsForCustomer(ctx.user.id)),
    notifications: protectedProcedure.query(({ ctx }) => listCustomerNotifications(ctx.user.id)),
    markNotificationRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(ctx.user.id, input.notificationId)),
    decideProposal: protectedProcedure.input(z.object({ proposalId: z.number().int().positive(), decision: z.enum(["accepted", "rejected"]) })).mutation(({ ctx, input }) => decideCustomerProposal({ userId: ctx.user.id, ...input })),
  }),

  professional: router({
    me: protectedProcedure.query(({ ctx }) => getProfessionalProfile(ctx.user.id)),
    saveProfile: protectedProcedure.input(profileSchema).mutation(({ ctx, input }) => upsertProfessionalProfile({ userId: ctx.user.id, ...input })),
    leads: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getProfessionalProfile(ctx.user.id);
      return profile ? listProfessionalLeads(profile.id) : [];
    }),
    markViewed: protectedProcedure.input(z.object({ matchId: z.number().int().positive() })).mutation(({ ctx, input }) => markLeadViewed(ctx.user.id, input.matchId)),
    sendProposal: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), amountCents: z.number().int().positive().optional(), message: z.string().min(10) })).mutation(({ ctx, input }) => createProposal({ userId: ctx.user.id, ...input })),
    checkout: protectedProcedure.mutation(({ ctx }) => createProfessionalCheckout({ userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, origin: ctx.req.headers.origin ?? "http://localhost:3000" })),
  }),

  billing: router({
    history: protectedProcedure.query(({ ctx }) => listBillingRecords(ctx.user.id)),
  }),

  admin: router({
    overview: adminProcedure.query(() => getAdminOverview()),
    listProfessionals: adminProcedure.query(() => listAllProfessionals()),
    activatePro: adminProcedure.input(z.object({ professionalId: z.number().int().positive() })).mutation(({ input }) => activateProfessionalPro(input.professionalId)),
    deactivatePro: adminProcedure.input(z.object({ professionalId: z.number().int().positive() })).mutation(({ input }) => deactivateProfessionalPro(input.professionalId)),
  }),
});

export type AppRouter = typeof appRouter;
