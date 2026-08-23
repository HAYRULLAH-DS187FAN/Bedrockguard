import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

const originalJwtSecret = process.env.JWT_SECRET;
const originalOwnerAccessKey = process.env.SERVER_OWNER_ACCESS_KEY;

function createPublicContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  return {
    ctx: {
      user: null,
      req: {
        protocol: "https",
        ip: "203.0.113.42",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
      } as TrpcContext["res"],
    },
    cookies,
  };
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-session-secret-with-at-least-thirty-two-characters";
  process.env.SERVER_OWNER_ACCESS_KEY = "owner-access-key-for-router-tests";
});

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (originalOwnerAccessKey === undefined) delete process.env.SERVER_OWNER_ACCESS_KEY;
  else process.env.SERVER_OWNER_ACCESS_KEY = originalOwnerAccessKey;
});

describe("auth.ownerKeyLogin", () => {
  it("tek giriş prosedürü olarak anahtar oturumu kurar ve oturum admin kullanıcıya çözülür", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.ownerKeyLogin({
      accessKey: "owner-access-key-for-router-tests",
    });

    expect(result.user).toMatchObject({ role: "admin", loginMethod: "owner_access_key" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      options: { httpOnly: true, secure: true, sameSite: "none", maxAge: 4 * 60 * 60 * 1000 },
    });

    const authenticated = await sdk.authenticateRequest({
      headers: { cookie: `${COOKIE_NAME}=${cookies[0]!.value}` },
    } as TrpcContext["req"], true);
    expect(authenticated).toMatchObject({ role: "admin", loginMethod: "owner_access_key" });

    const legacyToken = await sdk.signSession({ openId: "legacy-user", appId: "legacy", name: "Legacy" });
    await expect(sdk.authenticateRequest({
      headers: { cookie: `${COOKIE_NAME}=${legacyToken}` },
    } as TrpcContext["req"], true)).rejects.toThrow("Yalnızca sunucu sahibi erişim anahtarıyla oluşturulan oturumlar kabul edilir");
  });
});
