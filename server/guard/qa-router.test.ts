import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { QA_MODE_HEADER, QA_SERVER_ID } from "./qa";

function createQaContext(): TrpcContext {
  return {
    user: { id: 987, openId: "qa-admin", name: "QA Admin", email: null, loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { header: (name: string) => name === QA_MODE_HEADER ? "local-scenario" : undefined } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("QA router yalıtımı", () => {
  it("QA header ile veri dolu senaryoyu sunar ve yaptırım isteğini veritabanına yazmadan simüle eder", async () => {
    const caller = appRouter.createCaller(createQaContext());
    const overview = await caller.dashboard.overview();
    const simulated = await caller.moderation.requestManualSanction({ serverId: QA_SERVER_ID, playerUuid: "qa-alex-0001", action: "temp_ban", reason: "QA güvenlik akışı doğrulaması" });

    expect(overview.players).toHaveLength(3);
    expect(simulated.id).toBe("qa-simulated-request");
    expect(simulated.status).toBe("pending_confirmation");
  });

  it("QA header ile whitelist mutasyonunu veritabanına dokunmadan tamamlar", async () => {
    const caller = appRouter.createCaller(createQaContext());
    await expect(caller.whitelist.add({ serverId: QA_SERVER_ID, playerUuid: "qa-ephemeral-0004", playerName: "QA_Ephemeral", reason: "Yerel senaryo testi" })).resolves.toBeUndefined();
    await expect(caller.whitelist.remove({ serverId: QA_SERVER_ID, playerUuid: "qa-ephemeral-0004" })).resolves.toBeUndefined();
  });
});
