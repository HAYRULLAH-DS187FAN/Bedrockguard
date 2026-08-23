import { describe, expect, it } from "vitest";
import { shouldPromoteOwner } from "./_core/sdk";

describe("sahip rolü iyileştirmesi", () => {
  it("sahip kaydı eski kullanıcı rolündeyse yönetici yükseltmesini ister", () => {
    expect(shouldPromoteOwner("owner-open-id", "user", "owner-open-id")).toBe(true);
  });

  it("başka bir kullanıcıyı veya zaten yöneticiyi yükseltmez", () => {
    expect(shouldPromoteOwner("other-open-id", "user", "owner-open-id")).toBe(false);
    expect(shouldPromoteOwner("owner-open-id", "admin", "owner-open-id")).toBe(false);
  });
});
