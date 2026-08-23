import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("session token doğrulaması", () => {
  it("oluşturulan oturum tokenını aynı sunucu anahtarıyla doğrular", async () => {
    const token = await sdk.createSessionToken("qa-auth-open-id", { name: "QA Auth Operator", expiresInMs: 60_000 });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({
      openId: "qa-auth-open-id",
      name: "QA Auth Operator",
    });
  });

  it("geçersiz oturum tokenını kullanıcı üretmeden reddeder", async () => {
    await expect(sdk.verifySession("invalid.session.token")).resolves.toBeNull();
  });
});
