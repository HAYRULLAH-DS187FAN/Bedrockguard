import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const servers = mysqlTable(
  "servers",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    agentKeyId: varchar("agentKeyId", { length: 80 }).notNull(),
    agentSecretEncrypted: text("agentSecretEncrypted").notNull(),
    discordWebhookEncrypted: text("discordWebhookEncrypted"),
    settingsJson: text("settingsJson").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    slugUnique: uniqueIndex("servers_slug_unique").on(table.slug),
    agentKeyUnique: uniqueIndex("servers_agent_key_unique").on(table.agentKeyId),
  }),
);

export const players = mysqlTable(
  "players",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    serverId: varchar("serverId", { length: 40 }).notNull(),
    playerUuid: varchar("playerUuid", { length: 96 }).notNull(),
    playerName: varchar("playerName", { length: 64 }).notNull(),
    isOnline: boolean("isOnline").default(false).notNull(),
    suspicionScore: int("suspicionScore").default(0).notNull(),
    scoreUpdatedAt: timestamp("scoreUpdatedAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    flagsJson: text("flagsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    serverPlayerUnique: uniqueIndex("players_server_player_unique").on(table.serverId, table.playerUuid),
    serverRiskIndex: index("players_server_risk_idx").on(table.serverId, table.suspicionScore),
  }),
);

export const moderationEvents = mysqlTable(
  "moderation_events",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    serverId: varchar("serverId", { length: 40 }).notNull(),
    sourceEventId: varchar("sourceEventId", { length: 96 }).notNull(),
    playerUuid: varchar("playerUuid", { length: 96 }).notNull(),
    playerName: varchar("playerName", { length: 64 }).notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    content: text("content"),
    metadataJson: text("metadataJson").notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sourceEventUnique: uniqueIndex("events_server_source_unique").on(table.serverId, table.sourceEventId),
    playerTimeIndex: index("events_server_player_time_idx").on(table.serverId, table.playerUuid, table.occurredAt),
  }),
);

export const moderationDetections = mysqlTable(
  "moderation_detections",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    eventId: varchar("eventId", { length: 40 }).notNull(),
    category: varchar("category", { length: 48 }).notNull(),
    ruleId: varchar("ruleId", { length: 80 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    points: int("points").notNull(),
    confidence: int("confidence").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ eventIndex: index("detections_event_idx").on(table.eventId) }),
);

export const sanctions = mysqlTable(
  "sanctions",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    serverId: varchar("serverId", { length: 40 }).notNull(),
    playerUuid: varchar("playerUuid", { length: 96 }).notNull(),
    playerName: varchar("playerName", { length: 64 }).notNull(),
    eventId: varchar("eventId", { length: 40 }),
    action: mysqlEnum("action", ["warning", "kick", "temp_ban", "review"]).notNull(),
    status: mysqlEnum("status", ["pending_confirmation", "queued", "executed", "failed", "cancelled"])
      .default("pending_confirmation")
      .notNull(),
    requiresConfirmation: boolean("requiresConfirmation").default(true).notNull(),
    reason: text("reason").notNull(),
    durationMinutes: int("durationMinutes"),
    requestedByUserId: int("requestedByUserId"),
    confirmedByUserId: int("confirmedByUserId"),
    confirmedAt: timestamp("confirmedAt"),
    agentAcknowledgedAt: timestamp("agentAcknowledgedAt"),
    executionMessage: text("executionMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    queueIndex: index("sanctions_server_status_idx").on(table.serverId, table.status),
    playerIndex: index("sanctions_server_player_idx").on(table.serverId, table.playerUuid),
  }),
);

export const whitelistedPlayers = mysqlTable(
  "whitelisted_players",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    serverId: varchar("serverId", { length: 40 }).notNull(),
    playerUuid: varchar("playerUuid", { length: 96 }).notNull(),
    playerName: varchar("playerName", { length: 64 }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ serverPlayerUnique: uniqueIndex("whitelist_server_player_unique").on(table.serverId, table.playerUuid) }),
);

export const agentNonces = mysqlTable(
  "agent_nonces",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    serverId: varchar("serverId", { length: 40 }).notNull(),
    nonce: varchar("nonce", { length: 128 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    serverNonceUnique: uniqueIndex("agent_nonces_server_nonce_unique").on(table.serverId, table.nonce),
    expiryIndex: index("agent_nonces_expiry_idx").on(table.expiresAt),
  }),
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    serverId: varchar("serverId", { length: 40 }),
    actorUserId: int("actorUserId"),
    action: varchar("action", { length: 96 }).notNull(),
    target: varchar("target", { length: 160 }),
    summary: text("summary").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ serverTimeIndex: index("audit_server_time_idx").on(table.serverId, table.createdAt) }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type GuardServer = typeof servers.$inferSelect;
export type GuardPlayer = typeof players.$inferSelect;
export type GuardEvent = typeof moderationEvents.$inferSelect;
export type GuardSanction = typeof sanctions.$inferSelect;
