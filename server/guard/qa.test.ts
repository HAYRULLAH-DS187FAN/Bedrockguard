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
    expect(overview.sanctions.map(item => item.action)).toEqual(["warning"]);
    expect(overview.shadowObservations).toHaveLength(2);
  });

  it("yüksek riskli QA oyuncusu için sohbet kanıtı ile yaptırımsız gölge hareket kanıtını ayırır", () => {
    const detail = qaScenario.detail(QA_SERVER_ID, "qa-alex-0001");
    expect(detail?.player.suspicionScore).toBe(84);
    expect(detail?.evidence).toHaveLength(3);
    expect(detail?.evidence.find(item => item.event.type === "movement")?.detections).toEqual([]);
    expect(detail?.shadowObservations).toEqual([expect.objectContaining({ candidateType: "speed", status: "suppressed", clientFamily: "bedrock_geyser" })]);
    expect(detail?.sanctions).toHaveLength(0);
  });

  it("QA başlığını production dışındaki geliştirme isteğinde kabul eder", () => {
    const enabled = isLocalQaRequest({ header: name => name === "x-bedrockguard-qa" ? "local-scenario" : undefined });
    expect(enabled).toBe(!ENV.isProduction);
    expect(isLocalQaRequest({ header: () => undefined })).toBe(false);
  });
});
