export type GuardEventType =
  | "chat"
  | "command"
  | "player_join"
  | "player_leave"
  | "block_break"
  | "item_gain"
  | "movement"
  | "player_death";

export type DetectionCategory =
  | "profanity"
  | "spam"
  | "advertising"
  | "suspicious_link"
  | "threat_harassment"
  | "banned_word"
  | "unauthorized_command"
  | "movement_anomaly"
  | "block_break_anomaly"
  | "item_gain_anomaly"
  | "ai_risk";

export type RecommendedAction = "normal" | "watch" | "warning" | "kick" | "review" | "temp_ban";

export type ModerationConfig = {
  scoreHalfLifeHours: number;
  thresholds: {
    watch: number;
    intervention: number;
    review: number;
    tempBan: number;
  };
  recurrence: {
    kickAtOrAbove: number;
    minEventsForKick: number;
    minEventsForTempBan: number;
  };
  safeguards: {
    requireDistinctSignalsForIntervention: boolean;
    autoEnforceWarnings: boolean;
    allowAutomatedTempBans: boolean;
  };
  rules: {
    profanityWords: string[];
    bannedWords: string[];
    prohibitedCommands: string[];
    spamWindowSeconds: number;
    spamMessageLimit: number;
    repeatMessageLimit: number;
    maxMovementSpeed: number;
    maxBlocksPerSecond: number;
    maxItemsPerMinute: number;
  };
  ai: {
    enabled: boolean;
    modelPreference: "gpt-5-mini" | "default";
    minimumConfidence: number;
    maxSignalPoints: number;
  };
};

export const DEFAULT_MODERATION_CONFIG: ModerationConfig = {
  scoreHalfLifeHours: 12,
  thresholds: { watch: 40, intervention: 70, review: 90, tempBan: 100 },
  recurrence: { kickAtOrAbove: 82, minEventsForKick: 3, minEventsForTempBan: 4 },
  safeguards: {
    requireDistinctSignalsForIntervention: true,
    autoEnforceWarnings: true,
    allowAutomatedTempBans: false,
  },
  rules: {
    profanityWords: ["aptal", "gerizekali", "salak"],
    bannedWords: [],
    prohibitedCommands: ["op", "deop", "stop", "whitelist", "allowlist", "reload"],
    spamWindowSeconds: 20,
    spamMessageLimit: 5,
    repeatMessageLimit: 3,
    maxMovementSpeed: 16,
    maxBlocksPerSecond: 20,
    maxItemsPerMinute: 256,
  },
  ai: { enabled: false, modelPreference: "gpt-5-mini", minimumConfidence: 0.76, maxSignalPoints: 8 },
};

export type AgentEventPayload = {
  eventId: string;
  occurredAt: number;
  type: GuardEventType;
  player: { uuid: string; name: string };
  content?: string;
  metadata?: Record<string, unknown>;
};

export type ModerationSignal = {
  category: DetectionCategory;
  ruleId: string;
  label: string;
  points: number;
  confidence: number;
  explanation: string;
};

export type ModerationDecision = {
  action: RecommendedAction;
  score: number;
  previousScore: number;
  recentEventCount: number;
  distinctSignals: number;
  requiresConfirmation: boolean;
  rationale: string;
};
