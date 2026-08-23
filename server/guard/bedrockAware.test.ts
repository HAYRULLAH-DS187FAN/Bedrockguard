import { describe, expect, it } from "vitest";
import type { AgentEventPayload } from "../../shared/guard";
import { agentEventInputSchema } from "./agentApi";
import { evaluateShadowObservation, profileForObservation } from "./bedrockAware";
import { parseModerationConfig } from "../db";
import { DEFAULT_MODERATION_CONFIG } from "../../shared/guard";

const movementEvent = (overrides: Partial<AgentEventPayload> = {}): AgentEventPayload => ({
  eventId: "shadow-test-0001",
  occurredAt: Date.now(),
  type: "movement",
  player: { uuid: "shadow-player-1", name: "QA_Shadow" },
  platform: { clientFamily: "bedrock_geyser", confidence: 0.94, source: "floodgate", identityProvider: "floodgate", proxyPath: "geyser_velocity" },
  shadowObservation: {
    candidateType: "speed",
    observedValue: 26,
    expectedMax: 16,
    sampleWindowMs: 1_200,
    sampleCount: 12,
    measurementSource: "geyser_translated",
    environmentFlags: [],
    serverEffects: [],
    networkQuality: "stable",
  },
  ...overrides,
});

describe("Bedrock-aware shadow değerlendirmesi", () => {
  it("yüksek kaliteli Geyser hareket adayını gözlem olarak kayda hazırlar; yaptırım kararı üretmez", () => {
    const assessment = evaluateShadowObservation(movementEvent());
    expect(assessment).toMatchObject({ candidateType: "speed", status: "observed", profile: { clientFamily: "bedrock_geyser" } });
    expect(assessment).not.toHaveProperty("action");
    expect(assessment).not.toHaveProperty("points");
    expect(assessment?.evidenceQuality).toBeGreaterThan(60);
  });

  it.each([["bamboo_nearby"], ["water"], ["elytra"], ["knockback"], ["teleport"]])("meşru hareket bağlamı %s olduğunda adayı bastırır", flag => {
    const assessment = evaluateShadowObservation(movementEvent({ shadowObservation: { ...movementEvent().shadowObservation!, environmentFlags: [flag] } }));
    expect(assessment).toMatchObject({ status: "suppressed" });
    expect(assessment?.suppressionReason).toContain("Çevre");
  });

  it("düşük örnek, jitter ve bilinmeyen platformda yaptırım yerine bastırma uygular", () => {
    const lowSamples = evaluateShadowObservation(movementEvent({ shadowObservation: { ...movementEvent().shadowObservation!, sampleCount: 2 } }));
    const jitter = evaluateShadowObservation(movementEvent({ shadowObservation: { ...movementEvent().shadowObservation!, networkQuality: "jittery" } }));
    const unknown = evaluateShadowObservation(movementEvent({ platform: undefined }));
    expect(lowSamples?.status).toBe("suppressed");
    expect(jitter?.status).toBe("suppressed");
    expect(unknown?.status).toBe("suppressed");
    expect(profileForObservation(movementEvent({ platform: undefined }))).toMatchObject({ clientFamily: "unknown", confidence: 0 });
  });
});

describe("Agent platform ve gölge gözlem sözleşmesi", () => {
  it("sınırlı ve şemalı geçerli platform/gözlem verisini kabul eder", () => {
    const parsed = agentEventInputSchema.safeParse(movementEvent());
    expect(parsed.success).toBe(true);
  });

  it("tanımsız platform ailesini ve serbest biçimli gözlem adayını reddeder", () => {
    const badPlatform = agentEventInputSchema.safeParse({ ...movementEvent(), platform: { ...movementEvent().platform!, clientFamily: "mobile_java" } });
    const badCandidate = agentEventInputSchema.safeParse({ ...movementEvent(), shadowObservation: { ...movementEvent().shadowObservation!, candidateType: "packet_dump" } });
    expect(badPlatform.success).toBe(false);
    expect(badCandidate.success).toBe(false);
  });

  it("gölge gözlemini sohbet gibi hareket dışı olaylarda reddeder", () => {
    const parsed = agentEventInputSchema.safeParse({ ...movementEvent(), type: "chat" });
    expect(parsed.success).toBe(false);
  });
});

describe("P0 yapılandırma güvenlik sınırı", () => {
  it("kalıcı ayardaki yaptırım isteğini yok sayar ve yalnızca gözlem ayarını korur", () => {
    const parsed = parseModerationConfig(JSON.stringify({ ...DEFAULT_MODERATION_CONFIG, bedrockAwareObservation: { enabled: false, enforcementEnabled: true, retentionDays: 7 } }));
    expect(parsed.bedrockAwareObservation).toEqual({ enabled: false, enforcementEnabled: false, retentionDays: 7 });
  });
});
