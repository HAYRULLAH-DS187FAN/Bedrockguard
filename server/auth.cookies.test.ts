import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

function request(protocol: string, forwardedProto?: string) {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  } as never;
}

describe("session cookie seçenekleri", () => {
  it("production proxy HTTPS bilgisini aktarmasa bile SameSite=None oturumunu Secure olarak ayarlar", () => {
    expect(getSessionCookieOptions(request("http"), true)).toMatchObject({
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("HTTPS bilgisi aktarılan geliştirme isteğinde güvenli çerez üretir", () => {
    expect(getSessionCookieOptions(request("http", "https"), false).secure).toBe(true);
  });

  it("düz HTTP yerel geliştirme isteğinde Secure niteliğini zorunlu kılmaz", () => {
    expect(getSessionCookieOptions(request("http"), false).secure).toBe(false);
  });
});
