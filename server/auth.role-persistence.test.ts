import { describe, expect, it } from "vitest";
import { buildUserUpsert } from "./db";

describe("kullanıcı rolü kalıcılığı", () => {
  it("normal OAuth/preview yenilemesinde role alanını güncellemez", () => {
    const result = buildUserUpsert({ openId: "manually-promoted-admin", lastSignedIn: new Date() }, "project-owner");
    expect(result.values.role).toBeUndefined();
    expect(result.updateSet.role).toBeUndefined();
  });

  it("açık rol isteğini ve sahip hesabı yönetici olarak uygular", () => {
    const explicit = buildUserUpsert({ openId: "member", role: "admin" }, "project-owner");
    const owner = buildUserUpsert({ openId: "project-owner" }, "project-owner");
    expect(explicit.updateSet.role).toBe("admin");
    expect(owner.updateSet.role).toBe("admin");
  });
});
