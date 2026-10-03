import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user?: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: { origin: "https://chamapro.test" } } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("ChamaPro product contracts", () => {
  it("exposes the service catalog and monetization plans publicly", async () => {
    const catalog = await appRouter.createCaller(context()).public.catalog();
    expect(catalog.categories).toContain("Elétrica");
    expect(catalog.urgency).toHaveLength(4);
    expect(catalog.plans.find(plan => plan.id === "pro")?.price).toBe("R$ 29,90");
  });

  it("requires authentication for customer profile access", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.customer.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication for received customer proposals", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.customer.proposals()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication for customer notifications and proposal decisions", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.customer.notifications()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.customer.decideProposal({ proposalId: 1, decision: "accepted" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks non-admin users from the operational overview", async () => {
    const caller = appRouter.createCaller(context({
      id: 20,
      openId: "regular-user",
      name: "Cliente",
      email: "cliente@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks non-admin users from professional plan management", async () => {
    const caller = appRouter.createCaller(context({
      id: 21,
      openId: "regular-professional",
      name: "Profissional",
      email: "profissional@example.com",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    await expect(caller.admin.listProfessionals()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.activatePro({ professionalId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
