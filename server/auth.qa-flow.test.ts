import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createContext } from "./_core/context";
import { handleLocalQaLogin, issueLocalQaSession } from "./_core/qaAuth";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { QA_AUTH_HEADER, QA_AUTH_OPEN_ID, QA_SERVER_ID, isLocalQaAuthRequest, qaServer } from "./guard/qa";

function requestWithQaAuth(sessionToken?: string) {
  return {
    protocol: "https",
    headers: sessionToken ? { cookie: `${COOKIE_NAME}=${sessionToken}` } : {},
    header: (name: string) => name === QA_AUTH_HEADER ? "local-auth" : undefined,
  } as never;
}

function responseWithCookieCapture() {
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  return {
    res: { clearCookie: (name: string, options: Record<string, unknown>) => cleared.push({ name, options }) } as never,
    cleared,
  };
}

function responseWithStatusCapture() {
  const statuses: number[] = [];
  return {
    res: {
      status: (status: number) => {
        statuses.push(status);
        return { end: () => undefined };
      },
      cookie: () => undefined,
    } as never,
    statuses,
  };
}

async function qaContext(sessionToken?: string) {
  const { res } = responseWithCookieCapture();
  return createContext({ req: requestWithQaAuth(sessionToken), res } as never);
}

describe("yerel QA authentication akışı", () => {
  it("production modunda QA authentication header’ını kabul etmez", () => {
    const req = { header: (name: string) => name === QA_AUTH_HEADER ? "local-auth" : undefined };
    expect(isLocalQaAuthRequest(req, true)).toBe(false);
    expect(isLocalQaAuthRequest(req, false)).toBe(true);
  });

  it("production benzeri istekte QA login endpoint’ini 404 ile kapatır", async () => {
    const { res, statuses } = responseWithStatusCapture();
    await handleLocalQaLogin(requestWithQaAuth() as never, res, true);
    expect(statuses).toEqual([404]);
  });

  it("production benzeri context’te QA session ile kullanıcı veya admin rota erişimi üretmez", async () => {
    const sessionToken = await issueLocalQaSession();
    const { res } = responseWithCookieCapture();
    const productionContext = await createContext({ req: requestWithQaAuth(sessionToken), res } as never, true);
    expect(productionContext.user).toBeNull();
    await expect(appRouter.createCaller(productionContext).dashboard.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("test kullanıcı login simülasyonu ile session oluşturur, yenilemede korur ve dashboard erişimini verir", async () => {
    const sessionToken = await issueLocalQaSession();
    const firstContext = await qaContext(sessionToken);
    const refreshedContext = await qaContext(sessionToken);

    expect(firstContext.user?.openId).toBe(QA_AUTH_OPEN_ID);
    expect(firstContext.user?.role).toBe("admin");
    expect(refreshedContext.user?.openId).toBe(QA_AUTH_OPEN_ID);

    const firstCaller = appRouter.createCaller(firstContext);
    await expect(firstCaller.auth.me()).resolves.toMatchObject({ openId: QA_AUTH_OPEN_ID, role: "admin" });
    await expect(firstCaller.dashboard.overview()).resolves.toMatchObject({ metrics: { online: 2 } });
    await expect(firstCaller.servers.create({ name: "QA yazmasız sunucu", slug: "qa-no-write" })).resolves.toMatchObject({
      server: { id: "a1b2c3d4-1000-4000-8000-000000000001" },
      rawAgentSecret: "qa_local_no_agent",
    });
    await expect(firstCaller.whitelist.add({ serverId: "a1b2c3d4-1000-4000-8000-000000000001", playerUuid: "qa-no-write-player", playerName: "QA_No_Write", reason: "QA no-op mutasyon kontrolü" })).resolves.toBeUndefined();
    await expect(firstCaller.whitelist.remove({ serverId: QA_SERVER_ID, playerUuid: "qa-no-write-player" })).resolves.toBeUndefined();
    await expect(firstCaller.servers.updateConfiguration({ serverId: QA_SERVER_ID, settings: qaServer.settings, discordWebhookUrl: null })).resolves.toMatchObject({ success: true, qa: true });
    await expect(firstCaller.moderation.requestManualSanction({ serverId: QA_SERVER_ID, playerUuid: "qa-alex-0001", action: "kick", reason: "QA yazmasız yaptırım isteği" })).resolves.toMatchObject({ id: "qa-simulated-request", qa: true });
    await expect(firstCaller.moderation.confirmSanction({ sanctionId: "a1b2c3d4-1000-4000-8000-000000000099" })).resolves.toMatchObject({ success: true, qa: true });
  });

  it("session olmadan korumalı rotayı engeller; logout çerezi temizler ve sonraki erişimi kapatır", async () => {
    const sessionToken = await issueLocalQaSession();
    const { res, cleared } = responseWithCookieCapture();
    const signedInContext = await createContext({ req: requestWithQaAuth(sessionToken), res } as never);
    const signedInCaller = appRouter.createCaller(signedInContext);
    await expect(signedInCaller.auth.logout()).resolves.toEqual({ success: true });
    expect(cleared).toHaveLength(1);
    expect(cleared[0]?.name).toBe(COOKIE_NAME);
    expect(cleared[0]?.options).toMatchObject({ maxAge: -1, httpOnly: true, secure: true });

    const signedOutContext = await qaContext();
    expect(signedOutContext.user).toBeNull();
    const signedOutCaller = appRouter.createCaller(signedOutContext as TrpcContext);
    await expect(signedOutCaller.auth.me()).resolves.toBeNull();
    await expect(signedOutCaller.dashboard.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
