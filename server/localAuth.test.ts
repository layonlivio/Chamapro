import { describe, expect, it } from "vitest";
import { createLocalSession, getUserIdFromLocalSession, hashPassword, verifyPassword } from "./localAuth";

describe("local ChamaPro auth", () => {
  it("hashes passwords and rejects incorrect credentials", () => {
    const hash = hashPassword("senha-segura-123");
    expect(hash).not.toContain("senha-segura-123");
    expect(verifyPassword("senha-segura-123", hash)).toBe(true);
    expect(verifyPassword("senha-errada", hash)).toBe(false);
  });

  it("creates a session token that resolves to the user id", async () => {
    const token = await createLocalSession({ id: 42 } as never);
    expect(await getUserIdFromLocalSession(token)).toBe(42);
    expect(await getUserIdFromLocalSession("invalid-token")).toBeNull();
  });
});
