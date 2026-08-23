import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  localAdminOpenId,
  localAdminUserFromOpenId,
  resetLocalAdminAttemptsForTests,
  serverOwnerOpenId,
  verifyLocalAdminLogin,
  verifyServerOwnerAccessKey,
} from "./localAdmin";

const originalEmail = process.env.LOCAL_ADMIN_EMAIL;
const originalPassword = process.env.LOCAL_ADMIN_PASSWORD;
const originalJwtSecret = process.env.JWT_SECRET;
const originalOwnerAccessKey = process.env.SERVER_OWNER_ACCESS_KEY;

beforeEach(() => {
  process.env.LOCAL_ADMIN_EMAIL = "admin@bedrockguard.test";
  process.env.LOCAL_ADMIN_PASSWORD = "only-for-automated-tests";
  process.env.JWT_SECRET = "test-local-admin-session-secret-32chars";
  process.env.SERVER_OWNER_ACCESS_KEY = "owner-access-key-for-automated-tests";
  resetLocalAdminAttemptsForTests();
});

afterEach(() => {
  if (originalEmail === undefined) delete process.env.LOCAL_ADMIN_EMAIL;
  else process.env.LOCAL_ADMIN_EMAIL = originalEmail;
  if (originalPassword === undefined) delete process.env.LOCAL_ADMIN_PASSWORD;
  else process.env.LOCAL_ADMIN_PASSWORD = originalPassword;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (originalOwnerAccessKey === undefined) delete process.env.SERVER_OWNER_ACCESS_KEY;
  else process.env.SERVER_OWNER_ACCESS_KEY = originalOwnerAccessKey;
  resetLocalAdminAttemptsForTests();
});

describe("Vercel yerel yönetici girişi", () => {
  it("doğru e-posta ve parolada yalnızca admin rolü döndürür", () => {
    const result = verifyLocalAdminLogin({
      email: "ADMIN@BEDROCKGUARD.TEST",
      password: "only-for-automated-tests",
      requestIp: "203.0.113.10",
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.user).toMatchObject({
        role: "admin",
        loginMethod: "local_password",
        openId: localAdminOpenId("admin@bedrockguard.test"),
      });
    }
  });

  it("yanlış parolayı reddeder ve beş denemeden sonra geçici kilit uygular", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = verifyLocalAdminLogin({
        email: "admin@bedrockguard.test",
        password: "yanlis-parola",
        requestIp: "203.0.113.11",
      });
      expect(result).toMatchObject({ ok: false, reason: "invalid" });
    }

    const locked = verifyLocalAdminLogin({
      email: "admin@bedrockguard.test",
      password: "only-for-automated-tests",
      requestIp: "203.0.113.11",
    });
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
  });

  it("eşleşen yapılandırma yoksa sentetik yönetici kullanıcı üretmez", () => {
    delete process.env.LOCAL_ADMIN_PASSWORD;
    expect(verifyLocalAdminLogin({ email: "admin@bedrockguard.test", password: "x" })).toMatchObject({
      ok: false,
      reason: "not_configured",
    });
    expect(localAdminUserFromOpenId(localAdminOpenId("admin@bedrockguard.test"))).toBeNull();
  });

  it("sunucu sahibi erişim anahtarını admin oturumuna dönüştürür ve hatalı anahtarı kilitler", () => {
    const accepted = verifyServerOwnerAccessKey({
      accessKey: "owner-access-key-for-automated-tests",
      requestIp: "203.0.113.12",
    });
    expect(accepted).toMatchObject({ ok: true });
    if (accepted.ok) {
      expect(accepted.user).toMatchObject({
        role: "admin",
        loginMethod: "owner_access_key",
        openId: serverOwnerOpenId("owner-access-key-for-automated-tests"),
      });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(verifyServerOwnerAccessKey({
        accessKey: "yanlis-owner-anahtari",
        requestIp: "203.0.113.13",
      })).toMatchObject({ ok: false, reason: "invalid" });
    }
    expect(verifyServerOwnerAccessKey({
      accessKey: "owner-access-key-for-automated-tests",
      requestIp: "203.0.113.13",
    })).toMatchObject({ ok: false, reason: "locked" });
  });
});
