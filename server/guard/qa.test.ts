import { describe, expect, it } from "vitest";
import { ENV } from "../_core/env";
import { isLocalQaRequest, qaScenario, QA_SERVER_ID } from "./qa";

describe("yerel QA senaryosu", () => {
  it("dashboard, oyuncular, olaylar ve yaptırımlar için gerçekçi ama etiketli kayıtlar sağlar", () => {
    const overview = qaScenario.overview();
    expect(overview.servers).toHaveLength(1);
    expect(overview.servers[0]?.name).toMatch(/^\[QA\]/);
    expect(overview.players).toHaveLength(3);
    expect(overview.events).toHaveLength(5);
    expect(overview.sanctions.map(item => item.action)).toEqual(expect.arrayContaining(["warning", "kick", "temp_ban"]));
  });

  it("yüksek riskli QA oyuncusu için çoklu kanıt ve yaptırım geçmişi sağlar", () => {
    const detail = qaScenario.detail(QA_SERVER_ID, "qa-alex-0001");
    expect(detail?.player.suspicionScore).toBe(84);
    expect(detail?.evidence).toHaveLength(3);
    expect(detail?.evidence.every(item => item.detections.length > 0)).toBe(true);
    expect(detail?.sanctions).toHaveLength(2);
  });

  it("QA başlığını production dışındaki geliştirme isteğinde kabul eder", () => {
    const enabled = isLocalQaRequest({ header: name => name === "x-bedrockguard-qa" ? "local-scenario" : undefined });
    expect(enabled).toBe(!ENV.isProduction);
    expect(isLocalQaRequest({ header: () => undefined })).toBe(false);
  });
});
