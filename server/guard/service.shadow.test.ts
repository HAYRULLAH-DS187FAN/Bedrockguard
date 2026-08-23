import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MODERATION_CONFIG, type AgentEventPayload } from "../../shared/guard";

const mocks = vi.hoisted(() => ({
  getPlayer: vi.fn(),
  getWhitelistEntry: vi.fn(),
  listRecentMessages: vi.fn(),
  parseModerationConfig: vi.fn(),
  recordModerationEvent: vi.fn(),
  recordShadowObservation: vi.fn(),
  recordSignals: vi.fn(),
  upsertPlayerPlatformProfile: vi.fn(),
  upsertPlayerAssessment: vi.fn(),
  createSanction: vi.fn(),
  getDiscordWebhook: vi.fn(),
  notifyDiscord: vi.fn(),
}));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getPlayer: mocks.getPlayer,
  getWhitelistEntry: mocks.getWhitelistEntry,
  listRecentMessages: mocks.listRecentMessages,
  parseModerationConfig: mocks.parseModerationConfig,
  recordModerationEvent: mocks.recordModerationEvent,
  recordShadowObservation: mocks.recordShadowObservation,
  recordSignals: mocks.recordSignals,
  upsertPlayerPlatformProfile: mocks.upsertPlayerPlatformProfile,
  upsertPlayerAssessment: mocks.upsertPlayerAssessment,
  createSanction: mocks.createSanction,
  getDiscordWebhook: mocks.getDiscordWebhook,
}));
vi.mock("./discord", () => ({ notifyDiscord: mocks.notifyDiscord }));
vi.mock("./ai", () => ({ getAiRiskSignal: vi.fn() }));

import { buildShadowObservationRecord } from "../db";
import { processAgentEvent } from "./service";

const event: AgentEventPayload = {
  eventId: "service-shadow-0001",
  occurredAt: Date.now(),
  type: "movement",
  player: { uuid: "player-shadow-1", name: "QA_Shadow_Service" },
  platform: { clientFamily: "bedrock_geyser", confidence: 0.94, source: "floodgate", identityProvider: "floodgate", proxyPath: "geyser_velocity", clientVersion: "ignored", sessionId: "ignored-session" },
  shadowObservation: { candidateType: "speed", observedValue: 28, expectedMax: 16, sampleWindowMs: 1000, sampleCount: 12, measurementSource: "geyser_translated", environmentFlags: [], serverEffects: [], networkQuality: "stable", positionTraceDigest: "ignored-position-digest" },
};

describe("P0/P3 hareket servis güvenlik sınırı", () => {
  it("gölge hareket olayında puanı değiştirmez, yaptırım/komut üretmez ve Discord çağırmaz", async () => {
    mocks.getPlayer.mockResolvedValue({ suspicionScore: 73, scoreUpdatedAt: new Date(0) });
    mocks.parseModerationConfig.mockReturnValue(DEFAULT_MODERATION_CONFIG);
    mocks.recordModerationEvent.mockResolvedValue({ id: "stored-shadow-event" });
    mocks.recordShadowObservation.mockResolvedValue({ id: "stored-shadow-observation" });
    const result = await processAgentEvent({ id: "server-1", settingsJson: JSON.stringify(DEFAULT_MODERATION_CONFIG), name: "Test", slug: "test", agentKeyId: "key", agentSecretEncrypted: "secret", discordWebhookEncrypted: null, isActive: true, createdAt: new Date(), updatedAt: new Date() }, event);
    expect(result).toMatchObject({ signals: [], decision: { action: "normal", score: 73, previousScore: 73, requiresConfirmation: false } });
    expect(mocks.upsertPlayerAssessment).not.toHaveBeenCalled();
    expect(mocks.createSanction).not.toHaveBeenCalled();
    expect(mocks.getDiscordWebhook).not.toHaveBeenCalled();
    expect(mocks.notifyDiscord).not.toHaveBeenCalled();
    expect(mocks.recordShadowObservation).toHaveBeenCalledTimes(1);
  });

  it("gölge kaydından ham konum/oturum/istemci ayrıntılarını çıkarır", () => {
    const row = buildShadowObservationRecord({ serverId: "server-1", eventId: "stored-shadow-event", event, assessment: { candidateType: "speed", severity: 100, evidenceQuality: 84, platformFit: 85, status: "observed", profile: event.platform! } });
    expect(row?.contextJson).not.toContain("positionTraceDigest");
    expect(row?.contextJson).not.toContain("sessionId");
    expect(row?.contextJson).not.toContain("clientVersion");
    expect(row?.contextJson).not.toContain("rawPacket");
  });
});
