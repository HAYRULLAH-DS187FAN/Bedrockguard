import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetAccessKeyAttemptsForTests,
  serverOwnerOpenId,
  serverOwnerUserFromOpenId,
  verifyServerOwnerAccessKey,
} from "./localAdmin";

const originalJwtSecret = process.env.JWT_SECRET;
const originalOwnerAccessKey = process.env.SERVER_OWNER_ACCESS_KEY;

beforeEach(() => {
  process.env.JWT_SECRET = "test-local-admin-session-secret-32chars";
  process.env.SERVER_OWNER_ACCESS_KEY = "owner-access-key-for-automated-tests";
  resetAccessKeyAttemptsForTests();
});

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (originalOwnerAccessKey === undefined) delete process.env.SERVER_OWNER_ACCESS_KEY;
  else process.env.SERVER_OWNER_ACCESS_KEY = originalOwnerAccessKey;
  resetAccessKeyAttemptsForTests();
});

describe("sunucu sahibi erişim anahtarı", () => {
  it("doğru anahtarı admin oturumuna dönüştürür ve anahtar değiştiğinde önceki oturumu geçersiz sayar", () => {
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

    const oldOpenId = serverOwnerOpenId("owner-access-key-for-automated-tests");
    process.env.SERVER_OWNER_ACCESS_KEY = "rotated-owner-access-key-for-automated-tests";
    expect(serverOwnerUserFromOpenId(oldOpenId)).toBeNull();
  });

  it("yapılandırma yoksa erişimi reddeder; hatalı anahtarı beş denemeden sonra geçici kilitler", () => {
    delete process.env.SERVER_OWNER_ACCESS_KEY;
    expect(verifyServerOwnerAccessKey({ accessKey: "anahtar" })).toMatchObject({
      ok: false,
      reason: "not_configured",
    });

    process.env.SERVER_OWNER_ACCESS_KEY = "owner-access-key-for-automated-tests";
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
