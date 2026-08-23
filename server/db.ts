import { and, desc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "crypto";
import {
  agentNonces,
  auditLogs,
  GuardEvent,
  GuardPlayer,
  GuardSanction,
  GuardServer,
  InsertUser,
  moderationDetections,
  moderationEvents,
  playerPlatformProfiles,
  players,
  sanctions,
  servers,
  shadowObservations,
  users,
  whitelistedPlayers,
} from "../drizzle/schema";
import { DEFAULT_MODERATION_CONFIG, type AgentEventPayload, type ModerationConfig, type ModerationSignal, type PlatformProfile } from "../shared/guard";
import type { ShadowAssessment } from "./guard/bedrockAware";
import { decryptSensitiveValue, encryptSensitiveValue } from "./guard/security";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı kullanılabilir değil.");
  return db;
}

export function buildUserUpsert(user: InsertUser, ownerOpenId = ENV.ownerOpenId) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } });

  // For an existing account, an OAuth/preview refresh must never downgrade a
  // manually assigned admin role. Only an explicit role request (or the owner
  // self-heal) participates in the duplicate-key update.
  const roleToApply = user.role ?? (user.openId === ownerOpenId ? "admin" : undefined);
  if (roleToApply !== undefined) {
    values.role = roleToApply;
    updateSet.role = roleToApply;
  }
  return { values, updateSet };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { values, updateSet } = buildUserUpsert(user);
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export function parseModerationConfig(settingsJson: string): ModerationConfig {
  try {
    const parsed = JSON.parse(settingsJson) as Partial<ModerationConfig>;
    return {
      ...DEFAULT_MODERATION_CONFIG,
      ...parsed,
      thresholds: { ...DEFAULT_MODERATION_CONFIG.thresholds, ...parsed.thresholds },
      recurrence: { ...DEFAULT_MODERATION_CONFIG.recurrence, ...parsed.recurrence },
      safeguards: { ...DEFAULT_MODERATION_CONFIG.safeguards, ...parsed.safeguards },
      rules: { ...DEFAULT_MODERATION_CONFIG.rules, ...parsed.rules },
      ai: { ...DEFAULT_MODERATION_CONFIG.ai, ...parsed.ai },
      // P0/P3 hard invariant: persisted configuration must never enable movement
      // enforcement. Only observation collection can be toggled for the pilot.
      bedrockAwareObservation: { ...DEFAULT_MODERATION_CONFIG.bedrockAwareObservation, ...parsed.bedrockAwareObservation, enforcementEnabled: false },
    };
  } catch { return DEFAULT_MODERATION_CONFIG; }
}

export function publicServer(server: GuardServer) {
  return { id: server.id, name: server.name, slug: server.slug, agentKeyId: server.agentKeyId, isActive: server.isActive, settings: parseModerationConfig(server.settingsJson), discordConfigured: Boolean(server.discordWebhookEncrypted), createdAt: server.createdAt, updatedAt: server.updatedAt };
}

export async function listGuardServers() {
  const db = await requireDb();
  return (await db.select().from(servers).orderBy(desc(servers.createdAt))).map(publicServer);
}

export async function createGuardServer(input: { name: string; slug: string }) {
  const db = await requireDb();
  const id = randomUUID();
  const rawAgentSecret = `bg_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
  const row = {
    id,
    name: input.name,
    slug: input.slug,
    agentKeyId: `bgk_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    agentSecretEncrypted: encryptSensitiveValue(rawAgentSecret),
    settingsJson: JSON.stringify(DEFAULT_MODERATION_CONFIG),
  };
  await db.insert(servers).values(row);
  await writeAudit({ serverId: id, action: "server.created", target: input.slug, summary: "Yeni BDS sunucusu kaydı oluşturuldu." });
  return { server: publicServer({ ...row, discordWebhookEncrypted: null, isActive: true, createdAt: new Date(), updatedAt: new Date() }), rawAgentSecret };
}

export async function getServerByAgentKey(agentKeyId: string) {
  const db = await requireDb();
  return (await db.select().from(servers).where(eq(servers.agentKeyId, agentKeyId)).limit(1))[0];
}

export async function getServerById(serverId: string) {
  const db = await requireDb();
  return (await db.select().from(servers).where(eq(servers.id, serverId)).limit(1))[0];
}

export function decryptSensitiveValueForServer(server: GuardServer) {
  return decryptSensitiveValue(server.agentSecretEncrypted);
}

export async function updateServerConfiguration(input: { serverId: string; settings: ModerationConfig; discordWebhookUrl?: string | null }) {
  const db = await requireDb();
  const update: { settingsJson: string; discordWebhookEncrypted?: string | null } = { settingsJson: JSON.stringify(input.settings) };
  if (input.discordWebhookUrl !== undefined) update.discordWebhookEncrypted = input.discordWebhookUrl ? encryptSensitiveValue(input.discordWebhookUrl) : null;
  await db.update(servers).set(update).where(eq(servers.id, input.serverId));
  await writeAudit({ serverId: input.serverId, action: "server.configuration_updated", summary: "Moderasyon veya Discord ayarları güncellendi." });
}

export async function getDiscordWebhook(server: GuardServer) {
  return server.discordWebhookEncrypted ? decryptSensitiveValue(server.discordWebhookEncrypted) : null;
}

export async function claimAgentNonce(serverId: string, nonce: string) {
  const db = await requireDb();
  await db.delete(agentNonces).where(lt(agentNonces.expiresAt, new Date()));
  try {
    await db.insert(agentNonces).values({ id: randomUUID(), serverId, nonce, expiresAt: new Date(Date.now() + 3 * 60_000) });
    return true;
  } catch { return false; }
}

export async function getWhitelistEntry(serverId: string, playerUuid: string) {
  const db = await requireDb();
  const row = (await db.select().from(whitelistedPlayers).where(and(eq(whitelistedPlayers.serverId, serverId), eq(whitelistedPlayers.playerUuid, playerUuid))).limit(1))[0];
  if (!row) return undefined;
  if (row.expiresAt && row.expiresAt < new Date()) return undefined;
  return row;
}

export async function listWhitelist(serverId: string) {
  const db = await requireDb();
  return db.select().from(whitelistedPlayers).where(eq(whitelistedPlayers.serverId, serverId)).orderBy(desc(whitelistedPlayers.createdAt));
}

export async function addWhitelistEntry(input: { serverId: string; playerUuid: string; playerName: string; reason: string; actorUserId: number }) {
  const db = await requireDb();
  const row = { id: randomUUID(), serverId: input.serverId, playerUuid: input.playerUuid, playerName: input.playerName, reason: input.reason, createdByUserId: input.actorUserId };
  await db.insert(whitelistedPlayers).values(row).onDuplicateKeyUpdate({ set: { playerName: input.playerName, reason: input.reason, createdByUserId: input.actorUserId } });
  await writeAudit({ serverId: input.serverId, actorUserId: input.actorUserId, action: "whitelist.upsert", target: input.playerUuid, summary: "Whitelist kaydı eklendi veya güncellendi." });
}

export async function removeWhitelistEntry(input: { serverId: string; playerUuid: string; actorUserId: number }) {
  const db = await requireDb();
  await db.delete(whitelistedPlayers).where(and(eq(whitelistedPlayers.serverId, input.serverId), eq(whitelistedPlayers.playerUuid, input.playerUuid)));
  await writeAudit({ serverId: input.serverId, actorUserId: input.actorUserId, action: "whitelist.remove", target: input.playerUuid, summary: "Whitelist kaydı kaldırıldı." });
}

export async function getPlayer(serverId: string, playerUuid: string) {
  const db = await requireDb();
  return (await db.select().from(players).where(and(eq(players.serverId, serverId), eq(players.playerUuid, playerUuid))).limit(1))[0];
}

export async function upsertPlayerAssessment(input: { serverId: string; player: AgentEventPayload["player"]; score: number; online?: boolean }) {
  const db = await requireDb();
  const existing = await getPlayer(input.serverId, input.player.uuid);
  const now = new Date();
  if (existing) {
    await db.update(players).set({ playerName: input.player.name, suspicionScore: input.score, scoreUpdatedAt: now, lastSeenAt: now, ...(input.online === undefined ? {} : { isOnline: input.online }) }).where(eq(players.id, existing.id));
    return { ...existing, playerName: input.player.name, suspicionScore: input.score, scoreUpdatedAt: now, lastSeenAt: now, isOnline: input.online ?? existing.isOnline } as GuardPlayer;
  }
  const row = { id: randomUUID(), serverId: input.serverId, playerUuid: input.player.uuid, playerName: input.player.name, suspicionScore: input.score, isOnline: input.online ?? true, scoreUpdatedAt: now, lastSeenAt: now, flagsJson: "[]" };
  await db.insert(players).values(row);
  return { ...row, createdAt: now, updatedAt: now } as GuardPlayer;
}

export async function upsertPlayerPlatformProfile(input: { serverId: string; playerUuid: string; profile: PlatformProfile; observedAt: Date }) {
  const db = await requireDb();
  const values = {
    id: randomUUID(),
    serverId: input.serverId,
    playerUuid: input.playerUuid,
    clientFamily: input.profile.clientFamily,
    confidence: Math.round(Math.max(0, Math.min(1, input.profile.confidence)) * 100),
    identityProvider: input.profile.identityProvider ?? null,
    proxyPath: input.profile.proxyPath ?? null,
    clientVersion: input.profile.clientVersion?.slice(0, 64) ?? null,
    sessionId: input.profile.sessionId?.slice(0, 96) ?? null,
    source: input.profile.source,
    observedAt: input.observedAt,
  };
  await db.insert(playerPlatformProfiles).values(values).onDuplicateKeyUpdate({
    set: {
      clientFamily: values.clientFamily,
      confidence: values.confidence,
      identityProvider: values.identityProvider,
      proxyPath: values.proxyPath,
      clientVersion: values.clientVersion,
      sessionId: values.sessionId,
      source: values.source,
      observedAt: values.observedAt,
    },
  });
  return values;
}

export async function listPlayers(serverId?: string) {
  const db = await requireDb();
  const query = db.select().from(players);
  const result = serverId ? await query.where(eq(players.serverId, serverId)).orderBy(desc(players.suspicionScore)) : await query.orderBy(desc(players.suspicionScore));
  return result;
}

export async function listPlayersWithPlatformProfiles(serverId?: string) {
  const db = await requireDb();
  const query = db.select({ player: players, platformProfile: playerPlatformProfiles }).from(players).leftJoin(playerPlatformProfiles, and(eq(players.serverId, playerPlatformProfiles.serverId), eq(players.playerUuid, playerPlatformProfiles.playerUuid)));
  return serverId
    ? query.where(eq(players.serverId, serverId)).orderBy(desc(players.suspicionScore))
    : query.orderBy(desc(players.suspicionScore));
}

export async function recordModerationEvent(input: { serverId: string; event: AgentEventPayload }) {
  const db = await requireDb();
  const row = { id: randomUUID(), serverId: input.serverId, sourceEventId: input.event.eventId, playerUuid: input.event.player.uuid, playerName: input.event.player.name, type: input.event.type, content: input.event.content?.slice(0, 512) ?? null, metadataJson: JSON.stringify(input.event.metadata ?? {}), occurredAt: new Date(input.event.occurredAt) };
  await db.insert(moderationEvents).values(row);
  return row as GuardEvent;
}

export async function listRecentMessages(serverId: string, playerUuid: string, since: Date) {
  const db = await requireDb();
  return db.select({ content: moderationEvents.content, occurredAt: moderationEvents.occurredAt }).from(moderationEvents).where(and(eq(moderationEvents.serverId, serverId), eq(moderationEvents.playerUuid, playerUuid), eq(moderationEvents.type, "chat"), gte(moderationEvents.occurredAt, since))).orderBy(desc(moderationEvents.occurredAt)).limit(24);
}

export async function listPlayerEvents(serverId: string, playerUuid: string) {
  const db = await requireDb();
  return db.select().from(moderationEvents).where(and(eq(moderationEvents.serverId, serverId), eq(moderationEvents.playerUuid, playerUuid))).orderBy(desc(moderationEvents.occurredAt)).limit(120);
}

export async function listRecentEvents(serverId?: string) {
  const db = await requireDb();
  const query = db.select().from(moderationEvents);
  return serverId ? query.where(eq(moderationEvents.serverId, serverId)).orderBy(desc(moderationEvents.occurredAt)).limit(40) : query.orderBy(desc(moderationEvents.occurredAt)).limit(40);
}

export async function recordSignals(eventId: string, signals: ModerationSignal[]) {
  if (!signals.length) return;
  const db = await requireDb();
  await db.insert(moderationDetections).values(signals.map(signal => ({ id: randomUUID(), eventId, category: signal.category, ruleId: signal.ruleId, label: signal.label, points: signal.points, confidence: Math.round(signal.confidence * 100), explanation: signal.explanation })));
}

export function buildShadowObservationRecord(input: { serverId: string; eventId: string; event: AgentEventPayload; assessment: ShadowAssessment }) {
  const observation = input.event.shadowObservation;
  if (!observation) return;
  // Persist only the aggregate fields needed for later review. Deliberately
  // exclude session/client identifiers and any position-trace digest from the
  // observation context; raw packets are never part of this contract.
  const safePlatform = {
    clientFamily: input.assessment.profile.clientFamily,
    confidence: input.assessment.profile.confidence,
    source: input.assessment.profile.source,
    ...(input.assessment.profile.identityProvider ? { identityProvider: input.assessment.profile.identityProvider } : {}),
    ...(input.assessment.profile.proxyPath ? { proxyPath: input.assessment.profile.proxyPath } : {}),
  };
  const safeObservation = {
    candidateType: observation.candidateType,
    ...(observation.observedValue !== undefined ? { observedValue: observation.observedValue } : {}),
    ...(observation.expectedMin !== undefined ? { expectedMin: observation.expectedMin } : {}),
    ...(observation.expectedMax !== undefined ? { expectedMax: observation.expectedMax } : {}),
    sampleWindowMs: observation.sampleWindowMs,
    sampleCount: observation.sampleCount,
    measurementSource: observation.measurementSource,
    environmentFlags: observation.environmentFlags,
    serverEffects: observation.serverEffects,
    networkQuality: observation.networkQuality,
  };
  return {
    id: randomUUID(),
    serverId: input.serverId,
    eventId: input.eventId,
    playerUuid: input.event.player.uuid,
    playerName: input.event.player.name,
    clientFamily: input.assessment.profile.clientFamily,
    candidateType: input.assessment.candidateType,
    severity: input.assessment.severity,
    evidenceQuality: input.assessment.evidenceQuality,
    platformFit: input.assessment.platformFit,
    measurementSource: observation.measurementSource,
    status: input.assessment.status,
    suppressionReason: input.assessment.suppressionReason ?? null,
    contextJson: JSON.stringify({ platform: safePlatform, observation: safeObservation }),
    occurredAt: new Date(input.event.occurredAt),
  };
}

export async function recordShadowObservation(input: { serverId: string; eventId: string; event: AgentEventPayload; assessment: ShadowAssessment }) {
  const row = buildShadowObservationRecord(input);
  if (!row) return;
  const db = await requireDb();
  await db.insert(shadowObservations).values(row);
  return row;
}

export async function listRecentShadowObservations(serverId?: string) {
  const db = await requireDb();
  const query = db.select().from(shadowObservations);
  return serverId
    ? query.where(eq(shadowObservations.serverId, serverId)).orderBy(desc(shadowObservations.occurredAt)).limit(80)
    : query.orderBy(desc(shadowObservations.occurredAt)).limit(80);
}

export async function getPlayerPlatformProfile(serverId: string, playerUuid: string) {
  const db = await requireDb();
  return (await db.select().from(playerPlatformProfiles).where(and(eq(playerPlatformProfiles.serverId, serverId), eq(playerPlatformProfiles.playerUuid, playerUuid))).limit(1))[0];
}

export async function listPlayerShadowObservations(serverId: string, playerUuid: string) {
  const db = await requireDb();
  return db.select().from(shadowObservations).where(and(eq(shadowObservations.serverId, serverId), eq(shadowObservations.playerUuid, playerUuid))).orderBy(desc(shadowObservations.occurredAt)).limit(80);
}

export async function listEventDetections(eventId: string) {
  const db = await requireDb();
  return db.select().from(moderationDetections).where(eq(moderationDetections.eventId, eventId));
}

export async function listPlayerSanctions(serverId: string, playerUuid: string) {
  const db = await requireDb();
  return db.select().from(sanctions).where(and(eq(sanctions.serverId, serverId), eq(sanctions.playerUuid, playerUuid))).orderBy(desc(sanctions.createdAt));
}

export async function listRecentSanctions(serverId?: string) {
  const db = await requireDb();
  const query = db.select().from(sanctions);
  return serverId ? query.where(eq(sanctions.serverId, serverId)).orderBy(desc(sanctions.createdAt)).limit(40) : query.orderBy(desc(sanctions.createdAt)).limit(40);
}

export async function createSanction(input: { serverId: string; playerUuid: string; playerName: string; eventId?: string; action: "warning" | "kick" | "temp_ban" | "review"; requiresConfirmation: boolean; reason: string; durationMinutes?: number; requestedByUserId?: number }) {
  const db = await requireDb();
  const row = { id: randomUUID(), serverId: input.serverId, playerUuid: input.playerUuid, playerName: input.playerName, eventId: input.eventId ?? null, action: input.action, status: input.requiresConfirmation ? "pending_confirmation" as const : "queued" as const, requiresConfirmation: input.requiresConfirmation, reason: input.reason, durationMinutes: input.durationMinutes ?? null, requestedByUserId: input.requestedByUserId ?? null };
  await db.insert(sanctions).values(row);
  await writeAudit({ serverId: input.serverId, actorUserId: input.requestedByUserId, action: `sanction.${input.action}.requested`, target: input.playerUuid, summary: input.reason });
  return row as GuardSanction;
}

export async function confirmSanction(input: { sanctionId: string; actorUserId: number }) {
  const db = await requireDb();
  const sanction = (await db.select().from(sanctions).where(eq(sanctions.id, input.sanctionId)).limit(1))[0];
  if (!sanction || sanction.status !== "pending_confirmation") throw new Error("Yaptırım doğrulanabilir durumda değil.");
  await db.update(sanctions).set({ status: "queued", confirmedByUserId: input.actorUserId, confirmedAt: new Date() }).where(eq(sanctions.id, input.sanctionId));
  await writeAudit({ serverId: sanction.serverId, actorUserId: input.actorUserId, action: `sanction.${sanction.action}.confirmed`, target: sanction.playerUuid, summary: "Yaptırım kuyrukta uygulanmak üzere doğrulandı." });
}

export async function getQueuedSanctions(serverId: string) {
  const db = await requireDb();
  return db.select().from(sanctions).where(and(eq(sanctions.serverId, serverId), eq(sanctions.status, "queued"))).orderBy(sanctions.createdAt).limit(10);
}

export async function acknowledgeSanction(input: { sanctionId: string; serverId: string; succeeded: boolean; message?: string }) {
  const db = await requireDb();
  await db.update(sanctions).set({ status: input.succeeded ? "executed" : "failed", agentAcknowledgedAt: new Date(), executionMessage: input.message?.slice(0, 240) ?? null }).where(and(eq(sanctions.id, input.sanctionId), eq(sanctions.serverId, input.serverId), eq(sanctions.status, "queued")));
}

export async function writeAudit(input: { serverId?: string | null; actorUserId?: number | null; action: string; target?: string | null; summary: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({ id: randomUUID(), serverId: input.serverId ?? null, actorUserId: input.actorUserId ?? null, action: input.action, target: input.target ?? null, summary: input.summary.slice(0, 500) });
}
