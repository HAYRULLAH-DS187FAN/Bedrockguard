import { DEFAULT_MODERATION_CONFIG } from "../../shared/guard";
import { ENV } from "../_core/env";
import type { User } from "../../drizzle/schema";
import type { listEventDetections, listPlayers, listRecentEvents, listRecentSanctions, listRecentShadowObservations, listWhitelist, publicServer } from "../db";

type QaServer = ReturnType<typeof publicServer>;
type QaPlayers = Awaited<ReturnType<typeof listPlayers>>;
type QaEvents = Awaited<ReturnType<typeof listRecentEvents>>;
type QaSanctions = Awaited<ReturnType<typeof listRecentSanctions>>;
type QaDetections = Awaited<ReturnType<typeof listEventDetections>>;
type QaWhitelist = Awaited<ReturnType<typeof listWhitelist>>;
type QaShadowObservations = Awaited<ReturnType<typeof listRecentShadowObservations>>;

export const QA_SERVER_ID = "a1b2c3d4-1000-4000-8000-000000000001";
export const QA_MODE_HEADER = "x-bedrockguard-qa";
export const QA_AUTH_HEADER = "x-bedrockguard-qa-auth";
export const QA_AUTH_OPEN_ID = "qa-local-auth-open-id";
const now = Date.now();
const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);

export const qaAuthUser: User = {
  id: 0,
  openId: QA_AUTH_OPEN_ID,
  name: "QA Authentication Admin",
  email: null,
  loginMethod: "local-qa",
  role: "admin",
  createdAt: at(1),
  updatedAt: at(1),
  lastSignedIn: at(1),
};

/**
 * This scenario is deliberately memory-only. It is available only while the local
 * dev server runs and cannot be enabled when NODE_ENV is production.
 */
export function isLocalQaRequest(req: { header: (name: string) => string | undefined }) {
  return !ENV.isProduction && (req.header(QA_MODE_HEADER) === "local-scenario" || isLocalQaAuthRequest(req));
}

export function isLocalQaAuthRequest(
  req: { header: (name: string) => string | undefined },
  isProduction = ENV.isProduction
) {
  return !isProduction && req.header(QA_AUTH_HEADER) === "local-auth";
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

export const qaShadowObservations: QaShadowObservations = [
  { id: "qa-shadow-1", serverId: QA_SERVER_ID, eventId: "qa-event-2", playerUuid: "qa-alex-0001", playerName: "QA_Alex_Risk", clientFamily: "bedrock_geyser", candidateType: "speed", severity: 58, evidenceQuality: 41, platformFit: 18, measurementSource: "geyser_translated", status: "suppressed", suppressionReason: "Bamboo çevresi ve Geyser çeviri yolu nedeniyle hareket kanıtı güvenilir değil.", contextJson: "{\"platform\":{\"clientFamily\":\"bedrock_geyser\",\"source\":\"floodgate\"},\"observation\":{\"sampleCount\":8,\"environmentFlags\":[\"bamboo_nearby\"],\"networkQuality\":\"jittery\"}}", occurredAt: at(9), createdAt: at(9) },
  { id: "qa-shadow-2", serverId: QA_SERVER_ID, eventId: "qa-event-5", playerUuid: "qa-gamma-0003", playerName: "QA_Gamma_Trusted", clientFamily: "java", candidateType: "fly", severity: 51, evidenceQuality: 82, platformFit: 89, measurementSource: "bds_authoritative", status: "observed", suppressionReason: null, contextJson: "{\"platform\":{\"clientFamily\":\"java\",\"source\":\"agent\"},\"observation\":{\"sampleCount\":24,\"environmentFlags\":[],\"networkQuality\":\"stable\"}}", occurredAt: at(50), createdAt: at(50) },
];

const qaPlatformProfiles = {
  "qa-alex-0001": { id: "qa-profile-1", serverId: QA_SERVER_ID, playerUuid: "qa-alex-0001", clientFamily: "bedrock_geyser" as const, confidence: 94, source: "floodgate" as const, identityProvider: "floodgate", proxyPath: "geyser_velocity", clientVersion: null, sessionId: null, observedAt: at(9), createdAt: at(9), updatedAt: at(9) },
  "qa-beta-0002": { id: "qa-profile-2", serverId: QA_SERVER_ID, playerUuid: "qa-beta-0002", clientFamily: "bedrock_direct" as const, confidence: 72, source: "agent" as const, identityProvider: "xbox_live", proxyPath: "direct_bds", clientVersion: null, sessionId: null, observedAt: at(6), createdAt: at(6), updatedAt: at(6) },
  "qa-gamma-0003": { id: "qa-profile-3", serverId: QA_SERVER_ID, playerUuid: "qa-gamma-0003", clientFamily: "java" as const, confidence: 89, source: "agent" as const, identityProvider: "java_online", proxyPath: "unknown", clientVersion: null, sessionId: null, observedAt: at(50), createdAt: at(50), updatedAt: at(50) },
};

const detections: QaDetections = [
  { id: "qa-detect-1", eventId: "qa-event-1", category: "advertising", ruleId: "link.external", label: "Reklam bağlantısı", points: 30, confidence: 96, explanation: "QA senaryosunda harici bağlantı sinyali.", createdAt: at(4) },
  { id: "qa-detect-3", eventId: "qa-event-3", category: "threat_harassment", ruleId: "chat.harassment", label: "Taciz sinyali", points: 10, confidence: 84, explanation: "QA metin sınıflandırma örneği.", createdAt: at(15) },
  { id: "qa-detect-4", eventId: "qa-event-4", category: "spam", ruleId: "chat.flood", label: "Spam / flood", points: 5, confidence: 98, explanation: "QA tekrar sayısı penceresi aşıldı.", createdAt: at(6) },
];

export const qaSanctions: QaSanctions = [
  { id: "qa-sanction-1", serverId: QA_SERVER_ID, playerUuid: "qa-beta-0002", playerName: "QA_Beta_Spam", eventId: "qa-event-4", action: "warning" as const, status: "executed" as const, requiresConfirmation: false, reason: "QA: tekrar eden mesajlara karşı uyarı", durationMinutes: null, requestedByUserId: null, confirmedByUserId: null, confirmedAt: at(5), agentAcknowledgedAt: at(5), executionMessage: "QA simülasyonu — Agent çağrısı yapılmadı.", createdAt: at(6) },
];

const qaWhitelist: QaWhitelist = [{ id: "qa-whitelist-1", serverId: QA_SERVER_ID, playerUuid: "qa-gamma-0003", playerName: "QA_Gamma_Trusted", reason: "QA yanlış-pozitif koruma senaryosu", createdByUserId: 0, expiresAt: null, createdAt: at(180) }];

export const qaScenario = {
  overview() {
    return { servers: [qaServer], metrics: { online: 2, highRisk: 1, pending: 0, eventsToday: qaEvents.length }, players: qaPlayers, events: qaEvents, sanctions: qaSanctions, shadowObservations: qaShadowObservations };
  },
  players: (serverId?: string) => !serverId || serverId === QA_SERVER_ID ? qaPlayers : [],
  playerRows: (serverId?: string) => (!serverId || serverId === QA_SERVER_ID) ? qaPlayers.map(player => ({ player, platformProfile: qaPlatformProfiles[player.playerUuid as keyof typeof qaPlatformProfiles] ?? null })) : [],
  detail(serverId: string, playerUuid: string) {
    const player = qaPlayers.find(item => item.serverId === serverId && item.playerUuid === playerUuid);
    if (!player) return null;
    const events = qaEvents.filter(event => event.serverId === serverId && event.playerUuid === playerUuid);
    return { player, evidence: events.map(event => ({ event, detections: detections.filter(item => item.eventId === event.id) })), sanctions: qaSanctions.filter(item => item.serverId === serverId && item.playerUuid === playerUuid), platformProfile: qaPlatformProfiles[playerUuid as keyof typeof qaPlatformProfiles] ?? null, shadowObservations: qaShadowObservations.filter(item => item.serverId === serverId && item.playerUuid === playerUuid) };
  },
  observations: (serverId?: string) => !serverId || serverId === QA_SERVER_ID ? qaShadowObservations : [],
  whitelist: (serverId: string) => serverId === QA_SERVER_ID ? qaWhitelist : [],
};
