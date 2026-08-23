import {
  DEFAULT_MODERATION_CONFIG,
  type AgentEventPayload,
  type ModerationConfig,
  type ModerationDecision,
  type ModerationSignal,
} from "../../shared/guard";

const LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|(?:discord\.gg|discord\.com\/invite|\.ru\b|\.tk\b|\.click\b|\.xyz\b)/i;
const THREAT_PATTERN = /\b(seni\s+(?:bulurum|öldürürüm|yok ederim)|öl\s+git|sana\s+zarar)\b/i;

export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çğıöşü\s/.:_-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesWholeWord(source: string, candidate: string) {
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return false;
  return new RegExp(`(^|\\s)${normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i").test(source);
}

function numericMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function calculateDecayedScore(score: number, scoreUpdatedAt: Date, halfLifeHours: number, now = new Date()) {
  const elapsedHours = Math.max(0, now.getTime() - scoreUpdatedAt.getTime()) / 3_600_000;
  if (halfLifeHours <= 0) return Math.max(0, Math.round(score));
  return Math.max(0, Math.round(score * Math.pow(0.5, elapsedHours / halfLifeHours)));
}

export function assessRules(input: {
  event: AgentEventPayload;
  config?: ModerationConfig;
  recentMessages?: Array<{ content: string | null; occurredAt: Date }>;
  isWhitelisted?: boolean;
}): ModerationSignal[] {
  const config = input.config ?? DEFAULT_MODERATION_CONFIG;
  const event = input.event;
  const content = normalizeText(event.content ?? "");
  const signals: ModerationSignal[] = [];
  const add = (signal: ModerationSignal) => signals.push(signal);

  if (event.type === "chat" && content) {
    const profanity = config.rules.profanityWords.find(word => includesWholeWord(content, word));
    if (profanity) add({ category: "profanity", ruleId: "chat.profanity", label: "Hakaret/küfür", points: 10, confidence: 0.87, explanation: "Yapılandırılmış dil kuralıyla eşleşti." });

    const banned = config.rules.bannedWords.find(word => includesWholeWord(content, word));
    if (banned) add({ category: "banned_word", ruleId: "chat.banned_word", label: "Yasaklı ifade", points: 15, confidence: 0.96, explanation: "Sunucuya özgü yasaklı sözcük listesiyle eşleşti." });

    if (LINK_PATTERN.test(content)) {
      const risky = /(discord\.gg|\.ru\b|\.tk\b|\.click\b|\.xyz\b)/i.test(content);
      add({ category: risky ? "suspicious_link" : "advertising", ruleId: risky ? "chat.suspicious_link" : "chat.advertising", label: risky ? "Şüpheli bağlantı" : "Reklam bağlantısı", points: risky ? 30 : 22, confidence: risky ? 0.91 : 0.78, explanation: "Sohbette bağlantı veya davet kalıbı tespit edildi." });
    }

    if (THREAT_PATTERN.test(content)) add({ category: "threat_harassment", ruleId: "chat.threat", label: "Tehdit/taciz", points: 20, confidence: 0.74, explanation: "Hedefe yönelmiş tehdit kalıbı tespit edildi." });

    const recent = input.recentMessages ?? [];
    const inWindow = recent.filter(message => event.occurredAt - message.occurredAt.getTime() <= config.rules.spamWindowSeconds * 1_000);
    const repeatCount = recent.filter(message => normalizeText(message.content ?? "") === content).length + 1;
    if (inWindow.length + 1 >= config.rules.spamMessageLimit || repeatCount >= config.rules.repeatMessageLimit) {
      add({ category: "spam", ruleId: "chat.flood", label: "Spam/flood", points: 5, confidence: 0.84, explanation: "Kısa zaman aralığında çoklu veya yinelenen mesaj tespit edildi." });
    }
  }

  if (event.type === "command" && event.content) {
    const command = normalizeText(event.content).replace(/^\//, "").split(" ")[0];
    const authorized = event.metadata?.authorized === true;
    if (!authorized && config.rules.prohibitedCommands.includes(command)) {
      add({ category: "unauthorized_command", ruleId: "command.unauthorized", label: "Yetkisiz komut", points: 20, confidence: 0.95, explanation: "Yetkisiz kullanıcı tarafından hassas komut denemesi bildirildi." });
    }
  }

  if (event.type === "movement") {
    const speed = numericMetadata(event.metadata, "speedBlocksPerSecond");
    if (speed !== undefined && speed > config.rules.maxMovementSpeed) add({ category: "movement_anomaly", ruleId: "game.movement_speed", label: "Olağan dışı hız", points: 20, confidence: Math.min(0.95, 0.55 + (speed / config.rules.maxMovementSpeed) * 0.2), explanation: "Ölçülen hız, sunucu eşiğinin üzerinde." });
  }

  if (event.type === "block_break") {
    const rate = numericMetadata(event.metadata, "blocksPerSecond");
    if (rate !== undefined && rate > config.rules.maxBlocksPerSecond) add({ category: "block_break_anomaly", ruleId: "game.block_break_rate", label: "Olağan dışı blok kırma", points: 20, confidence: 0.8, explanation: "Blok kırma hızı tanımlı eşiği aştı." });
  }

  if (event.type === "item_gain") {
    const amount = numericMetadata(event.metadata, "itemsPerMinute");
    if (amount !== undefined && amount > config.rules.maxItemsPerMinute) add({ category: "item_gain_anomaly", ruleId: "game.item_gain_rate", label: "Olağan dışı eşya kazanımı", points: 20, confidence: 0.78, explanation: "Eşya kazanım hızı tanımlı eşiği aştı." });
  }

  // Whitelist düşük etkili sohbet sinyallerini görür, ancak otomatik puana dönüştürmez.
  if (input.isWhitelisted) {
    return signals.map(signal => (signal.category === "spam" || signal.category === "profanity" ? { ...signal, points: 0, explanation: `${signal.explanation} Whitelist koruması nedeniyle puan uygulanmadı.` } : signal));
  }
  return signals;
}

export function decideModeration(input: {
  previousScore: number;
  newScore: number;
  signals: ModerationSignal[];
  recentEventCount: number;
  config?: ModerationConfig;
  isWhitelisted?: boolean;
}): ModerationDecision {
  const config = input.config ?? DEFAULT_MODERATION_CONFIG;
  const distinctSignals = new Set(input.signals.filter(signal => signal.points > 0).map(signal => signal.category)).size;
  const hasNonAiRuleSignal = input.signals.some(signal => signal.category !== "ai_risk" && signal.points > 0);
  const minimumSignalsMet = !config.safeguards.requireDistinctSignalsForIntervention || distinctSignals >= 2 || input.recentEventCount >= config.recurrence.minEventsForKick;
  const base = { score: input.newScore, previousScore: input.previousScore, recentEventCount: input.recentEventCount, distinctSignals };

  if (!hasNonAiRuleSignal && input.signals.some(signal => signal.category === "ai_risk")) {
    return { ...base, action: "normal", requiresConfirmation: false, rationale: "AI sinyali tek başına yaptırım veya uyarı üretmez; doğrulanabilir kural sinyali bekleniyor." };
  }
  if (input.isWhitelisted) return { ...base, action: "watch", requiresConfirmation: false, rationale: "Whitelist kaydı nedeniyle otomatik yaptırım devre dışı; olay izlemeye alındı." };
  if (input.newScore < config.thresholds.watch) return { ...base, action: "normal", requiresConfirmation: false, rationale: "Puan normal aralıkta." };
  if (input.newScore < config.thresholds.intervention) return { ...base, action: "watch", requiresConfirmation: false, rationale: "Puan izleme eşiğinde; yeni kanıt bekleniyor." };
  if (input.newScore >= config.thresholds.review && !minimumSignalsMet) {
    return { ...base, action: "review", requiresConfirmation: true, rationale: "Tekil sinyal koruması nedeniyle yüksek puan insan incelemesine yönlendirildi." };
  }
  if (input.newScore < config.thresholds.review) {
    return { ...base, action: "warning", requiresConfirmation: false, rationale: "Müdahale eşiği aşıldı; uyarı önerildi." };
  }
  if (input.newScore >= config.thresholds.tempBan && input.recentEventCount >= config.recurrence.minEventsForTempBan) {
    return { ...base, action: config.safeguards.allowAutomatedTempBans ? "temp_ban" : "review", requiresConfirmation: !config.safeguards.allowAutomatedTempBans, rationale: "Yüksek puan ve tekrar eden kanıtlar geçici ban incelemesini gerektiriyor." };
  }
  if (input.newScore >= config.recurrence.kickAtOrAbove && input.recentEventCount >= config.recurrence.minEventsForKick) {
    return { ...base, action: "kick", requiresConfirmation: true, rationale: "Puan ve tekrar sayısı kick önerisi için yeterli; yönetici doğrulaması bekleniyor." };
  }
  return { ...base, action: "review", requiresConfirmation: true, rationale: "Yüksek risk tespit edildi; insan incelemesi öneriliyor." };
}
