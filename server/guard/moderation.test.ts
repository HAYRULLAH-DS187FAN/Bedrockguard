import { describe, expect, it } from "vitest";
import { DEFAULT_MODERATION_CONFIG, type AgentEventPayload, type ModerationSignal } from "../../shared/guard";
import { assessRules, calculateDecayedScore, decideModeration } from "./moderation";
import { signAgentPayload, signatureMatches, SlidingWindowRateLimiter, stableStringify } from "./security";
import { agentPayloadWithinSecurityLimits } from "./agentApi";

const baseEvent = (overrides: Partial<AgentEventPayload> = {}): AgentEventPayload => ({
  eventId: "evt-test-0001",
  occurredAt: Date.now(),
  type: "chat",
  player: { uuid: "player-1", name: "Alex" },
  ...overrides,
});

describe("BedrockGuard kural motoru", () => {
  it("küfür, reklam ve şüpheli link için beklenen puan sinyallerini üretir", () => {
    const profanity = assessRules({ event: baseEvent({ content: "Sen çok aptal birisin" }) });
    const link = assessRules({ event: baseEvent({ eventId: "evt-test-0002", content: "discord.gg/secret-sunucu" }) });
    expect(profanity).toEqual(expect.arrayContaining([expect.objectContaining({ category: "profanity", points: 10 })]));
    expect(link).toEqual(expect.arrayContaining([expect.objectContaining({ category: "suspicious_link", points: 30 })]));
  });

  it("flood ve yinelenen mesajı düşük etkili spam sinyali olarak değerlendirir", () => {
    const now = Date.now();
    const signals = assessRules({
      event: baseEvent({ content: "elmas ver", occurredAt: now }),
      recentMessages: [
        { content: "elmas ver", occurredAt: new Date(now - 1_000) },
        { content: "elmas ver", occurredAt: new Date(now - 2_000) },
      ],
    });
    expect(signals).toEqual(expect.arrayContaining([expect.objectContaining({ category: "spam", points: 5 })]));
  });

  it("oyun bağlamındaki normal kısa mesaj için yanlış pozitif üretmez", () => {
    const signals = assessRules({ event: baseEvent({ content: "gg, maden girişinde buluşalım" }) });
    expect(signals).toEqual([]);
  });

  it("whitelist kaydı düşük etkili sohbet sinyallerini puansızlaştırır", () => {
    const signals = assessRules({ event: baseEvent({ content: "aptal" }), isWhitelisted: true });
    expect(signals).toEqual(expect.arrayContaining([expect.objectContaining({ category: "profanity", points: 0 })]));
  });

  it("şüphe puanını yarılanma ömrüne göre azaltır", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const twelveHoursEarlier = new Date("2026-08-23T00:00:00.000Z");
    expect(calculateDecayedScore(80, twelveHoursEarlier, 12, now)).toBe(40);
    expect(calculateDecayedScore(80, twelveHoursEarlier, 24, now)).toBeGreaterThan(50);
  });

  it("tek bir güçlü olayda otomatik ban önermez", () => {
    const signals: ModerationSignal[] = [{ category: "suspicious_link", ruleId: "test", label: "link", points: 50, confidence: 1, explanation: "test" }];
    const decision = decideModeration({ previousScore: 50, newScore: 100, signals, recentEventCount: 1, config: DEFAULT_MODERATION_CONFIG });
    expect(decision.action).not.toBe("temp_ban");
    expect(decision.requiresConfirmation).toBe(true);
  });

  it("AI-only sinyalinin tek başına uyarı veya yaptırım üretmesine izin vermez", () => {
    const signals: ModerationSignal[] = [{ category: "ai_risk", ruleId: "ai.message_risk", label: "AI", points: 8, confidence: 0.99, explanation: "test" }];
    const decision = decideModeration({ previousScore: 89, newScore: 97, signals, recentEventCount: 4, config: DEFAULT_MODERATION_CONFIG });
    expect(decision.action).toBe("normal");
    expect(decision.requiresConfirmation).toBe(false);
  });

  it("tekrar eden ve birden çok sinyalli yüksek riskte yalnızca inceleme veya doğrulamalı işlem üretir", () => {
    const signals: ModerationSignal[] = [
      { category: "advertising", ruleId: "a", label: "a", points: 30, confidence: 1, explanation: "a" },
      { category: "threat_harassment", ruleId: "b", label: "b", points: 20, confidence: 1, explanation: "b" },
    ];
    const decision = decideModeration({ previousScore: 55, newScore: 100, signals, recentEventCount: 4, config: DEFAULT_MODERATION_CONFIG });
    expect(["review", "temp_ban"]).toContain(decision.action);
    expect(decision.requiresConfirmation).toBe(true);
  });
});

describe("Agent kimlik doğrulama yardımcıları", () => {
  it("aşırı büyük veya derin Agent metadata gövdelerini reddeder", () => {
    expect(agentPayloadWithinSecurityLimits({ ok: true }, { nested: { one: { two: { three: { four: "too-deep" } } } } })).toBe(false);
    expect(agentPayloadWithinSecurityLimits({ content: "x".repeat(17_000) }, {})).toBe(false);
    expect(agentPayloadWithinSecurityLimits({ ok: true }, { speedBlocksPerSecond: 21, dimension: "overworld" })).toBe(true);
  });

  it("anahtar sırası değişse de kararlı kanonik JSON üretir", () => {
    expect(stableStringify({ b: 1, a: { z: true, x: 2 } })).toBe(stableStringify({ a: { x: 2, z: true }, b: 1 }));
  });

  it("HMAC imzasını doğru istek için kabul eder, farklı gövde için reddeder", () => {
    const parameters = { secret: "test-secret", method: "POST", path: "/events", timestamp: "123", nonce: "nonce-1", body: { eventId: "evt-1", score: 5 } };
    const signature = signAgentPayload(parameters);
    expect(signatureMatches(signature, signature)).toBe(true);
    expect(signatureMatches(signAgentPayload({ ...parameters, body: { eventId: "evt-1", score: 6 } }), signature)).toBe(false);
  });

  it("kaydırmalı pencere hız sınırlaması aşırı Agent çağrılarını engeller", () => {
    const limiter = new SlidingWindowRateLimiter(2, 1_000);
    expect(limiter.allow("agent-a", 1_000)).toBe(true);
    expect(limiter.allow("agent-a", 1_100)).toBe(true);
    expect(limiter.allow("agent-a", 1_200)).toBe(false);
    expect(limiter.allow("agent-a", 2_100)).toBe(true);
  });
});
