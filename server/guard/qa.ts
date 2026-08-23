import { DEFAULT_MODERATION_CONFIG } from "../../shared/guard";
import { ENV } from "../_core/env";
import type { listEventDetections, listPlayers, listRecentEvents, listRecentSanctions, listWhitelist, publicServer } from "../db";

type QaServer = ReturnType<typeof publicServer>;
type QaPlayers = Awaited<ReturnType<typeof listPlayers>>;
type QaEvents = Awaited<ReturnType<typeof listRecentEvents>>;
type QaSanctions = Awaited<ReturnType<typeof listRecentSanctions>>;
type QaDetections = Awaited<ReturnType<typeof listEventDetections>>;
type QaWhitelist = Awaited<ReturnType<typeof listWhitelist>>;

export const QA_SERVER_ID = "a1b2c3d4-1000-4000-8000-000000000001";
export const QA_MODE_HEADER = "x-bedrockguard-qa";
const now = Date.now();
const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);

/**
 * This scenario is deliberately memory-only. It is available only while the local
 * dev server runs and cannot be enabled when NODE_ENV is production.
 */
export function isLocalQaRequest(req: { header: (name: string) => string | undefined }) {
  return !ENV.isProduction && req.header(QA_MODE_HEADER) === "local-scenario";
}

const settings = {
  ...DEFAULT_MODERATION_CONFIG,
  ai: { ...DEFAULT_MODERATION_CONFIG.ai, enabled: true, minimumConfidence: 0.72 },
};

export const qaServer: QaServer = {
  id: QA_SERVER_ID,
  name: "[QA] Mobil Moderasyon Laboratuvarı",
  slug: "qa-mobile-lab",
  agentKeyId: "qa_local_no_agent",
  isActive: true,
  settings,
  discordConfigured: false,
  createdAt: at(1_440),
  updatedAt: at(5),
};

export const qaPlayers: QaPlayers = [
  { id: "qa-player-1", serverId: QA_SERVER_ID, playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", isOnline: true, suspicionScore: 84, scoreUpdatedAt: at(2), lastSeenAt: at(1), flagsJson: "[\"advertising\",\"movement\"]", createdAt: at(540), updatedAt: at(2) },
  { id: "qa-player-2", serverId: QA_SERVER_ID, playerUuid: "qa-beta-0002", playerName: "QA_Beta_Spam", isOnline: true, suspicionScore: 53, scoreUpdatedAt: at(6), lastSeenAt: at(3), flagsJson: "[\"flood\"]", createdAt: at(420), updatedAt: at(6) },
  { id: "qa-player-3", serverId: QA_SERVER_ID, playerUuid: "qa-gamma-0003", playerName: "QA_Gamma_Trusted", isOnline: false, suspicionScore: 12, scoreUpdatedAt: at(90), lastSeenAt: at(45), flagsJson: "[\"whitelisted\"]", createdAt: at(360), updatedAt: at(90) },
];

export const qaEvents: QaEvents = [
  { id: "qa-event-1", serverId: QA_SERVER_ID, sourceEventId: "qa-evidence-1001", playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", type: "chat", content: "[QA] Kontrol edilen reklam bağlantısı: test.invalid", metadataJson: "{\"qa\":true,\"channel\":\"global\"}", occurredAt: at(4), createdAt: at(4) },
  { id: "qa-event-2", serverId: QA_SERVER_ID, sourceEventId: "qa-evidence-1002", playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", type: "movement", content: null, metadataJson: "{\"qa\":true,\"speedBlocksPerSecond\":41}", occurredAt: at(9), createdAt: at(9) },
  { id: "qa-event-3", serverId: QA_SERVER_ID, sourceEventId: "qa-evidence-1003", playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", type: "chat", content: "[QA] Tekrarlanan rahatsız edici ifade örneği", metadataJson: "{\"qa\":true,\"channel\":\"global\"}", occurredAt: at(15), createdAt: at(15) },
  { id: "qa-event-4", serverId: QA_SERVER_ID, sourceEventId: "qa-evidence-2001", playerUuid: "qa-beta-0002", playerName: "QA_Beta_Spam", type: "chat", content: "[QA] Aynı mesaj tekrar testi", metadataJson: "{\"qa\":true,\"repeatCount\":6}", occurredAt: at(6), createdAt: at(6) },
  { id: "qa-event-5", serverId: QA_SERVER_ID, sourceEventId: "qa-evidence-3001", playerUuid: "qa-gamma-0003", playerName: "QA_Gamma_Trusted", type: "chat", content: "[QA] Whitelist koruma testi", metadataJson: "{\"qa\":true}", occurredAt: at(50), createdAt: at(50) },
];

const detections: QaDetections = [
  { id: "qa-detect-1", eventId: "qa-event-1", category: "advertising", ruleId: "link.external", label: "Reklam bağlantısı", points: 30, confidence: 96, explanation: "QA senaryosunda harici bağlantı sinyali.", createdAt: at(4) },
  { id: "qa-detect-2", eventId: "qa-event-2", category: "suspicious_behavior", ruleId: "movement.speed", label: "Olağan dışı hareket", points: 20, confidence: 91, explanation: "QA hareket hızı eşiği aşıldı.", createdAt: at(9) },
  { id: "qa-detect-3", eventId: "qa-event-3", category: "threat_harassment", ruleId: "chat.harassment", label: "Taciz sinyali", points: 10, confidence: 84, explanation: "QA metin sınıflandırma örneği.", createdAt: at(15) },
  { id: "qa-detect-4", eventId: "qa-event-4", category: "spam", ruleId: "chat.flood", label: "Spam / flood", points: 5, confidence: 98, explanation: "QA tekrar sayısı penceresi aşıldı.", createdAt: at(6) },
];

export const qaSanctions: QaSanctions = [
  { id: "qa-sanction-1", serverId: QA_SERVER_ID, playerUuid: "qa-beta-0002", playerName: "QA_Beta_Spam", eventId: "qa-event-4", action: "warning" as const, status: "executed" as const, requiresConfirmation: false, reason: "QA: tekrar eden mesajlara karşı uyarı", durationMinutes: null, requestedByUserId: null, confirmedByUserId: null, confirmedAt: at(5), agentAcknowledgedAt: at(5), executionMessage: "QA simülasyonu — Agent çağrısı yapılmadı.", createdAt: at(6) },
  { id: "qa-sanction-2", serverId: QA_SERVER_ID, playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", eventId: "qa-event-2", action: "kick" as const, status: "pending_confirmation" as const, requiresConfirmation: true, reason: "QA: birleşik reklam ve hareket sinyalleri", durationMinutes: null, requestedByUserId: null, confirmedByUserId: null, confirmedAt: null, agentAcknowledgedAt: null, executionMessage: "QA simülasyonu — yürütme devre dışı.", createdAt: at(3) },
  { id: "qa-sanction-3", serverId: QA_SERVER_ID, playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", eventId: "qa-event-3", action: "temp_ban" as const, status: "pending_confirmation" as const, requiresConfirmation: true, reason: "QA: örnek geçici ban inceleme kaydı", durationMinutes: 60, requestedByUserId: null, confirmedByUserId: null, confirmedAt: null, agentAcknowledgedAt: null, executionMessage: "QA simülasyonu — gerçek ban uygulanmaz.", createdAt: at(1) },
];

const qaWhitelist: QaWhitelist = [{ id: "qa-whitelist-1", serverId: QA_SERVER_ID, playerUuid: "qa-gamma-0003", playerName: "QA_Gamma_Trusted", reason: "QA yanlış-pozitif koruma senaryosu", createdByUserId: 0, expiresAt: null, createdAt: at(180) }];

export const qaScenario = {
  overview() {
    return { servers: [qaServer], metrics: { online: 2, highRisk: 1, pending: 2, eventsToday: qaEvents.length }, players: qaPlayers, events: qaEvents, sanctions: qaSanctions };
  },
  players: (serverId?: string) => !serverId || serverId === QA_SERVER_ID ? qaPlayers : [],
  detail(serverId: string, playerUuid: string) {
    const player = qaPlayers.find(item => item.serverId === serverId && item.playerUuid === playerUuid);
    if (!player) return null;
    const events = qaEvents.filter(event => event.serverId === serverId && event.playerUuid === playerUuid);
    return { player, evidence: events.map(event => ({ event, detections: detections.filter(item => item.eventId === event.id) })), sanctions: qaSanctions.filter(item => item.serverId === serverId && item.playerUuid === playerUuid) };
  },
  whitelist: (serverId: string) => serverId === QA_SERVER_ID ? qaWhitelist : [],
};
