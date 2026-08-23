import type { GuardServer } from "../../drizzle/schema";
import type { AgentEventPayload, ModerationDecision, ModerationSignal } from "../../shared/guard";
import {
  createSanction,
  getDiscordWebhook,
  getPlayer,
  getWhitelistEntry,
  listRecentMessages,
  parseModerationConfig,
  recordModerationEvent,
  recordSignals,
  upsertPlayerAssessment,
} from "../db";
import { getAiRiskSignal } from "./ai";
import { notifyDiscord } from "./discord";
import { assessRules, calculateDecayedScore, decideModeration } from "./moderation";
import { safeLog } from "./security";

export async function processAgentEvent(server: GuardServer, event: AgentEventPayload): Promise<{ decision: ModerationDecision; signals: ModerationSignal[] }> {
  const config = parseModerationConfig(server.settingsJson);
  const knownPlayer = await getPlayer(server.id, event.player.uuid);
  const whitelist = await getWhitelistEntry(server.id, event.player.uuid);
  const recentMessages = event.type === "chat" ? await listRecentMessages(server.id, event.player.uuid, new Date(event.occurredAt - config.rules.spamWindowSeconds * 1_000)) : [];
  const signals = assessRules({ event, config, recentMessages, isWhitelisted: Boolean(whitelist) });

  if (event.type === "chat" && config.ai.enabled) {
    try {
      const aiSignal = await getAiRiskSignal(event.content ?? "", config);
      if (aiSignal) {
        const hasRuleSignal = signals.some(signal => signal.category !== "ai_risk" && signal.points > 0);
        signals.push(hasRuleSignal ? aiSignal : { ...aiSignal, points: 0, explanation: `${aiSignal.explanation} Tek başına kural ihlali olmadığından puan uygulanmadı.` });
      }
    } catch (error) {
      safeLog("ai_signal_unavailable", { serverId: server.id, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  const previousScore = knownPlayer ? calculateDecayedScore(knownPlayer.suspicionScore, knownPlayer.scoreUpdatedAt, config.scoreHalfLifeHours, new Date(event.occurredAt)) : 0;
  const additionalPoints = signals.reduce((sum, signal) => sum + signal.points, 0);
  const score = Math.min(100, previousScore + additionalPoints);
  const recentEventCount = recentMessages.length + 1;
  const decision = decideModeration({ previousScore, newScore: score, signals, recentEventCount, config, isWhitelisted: Boolean(whitelist) });
  const online = event.type === "player_leave" ? false : true;
  await upsertPlayerAssessment({ serverId: server.id, player: event.player, score, online });
  const storedEvent = await recordModerationEvent({ serverId: server.id, event });
  await recordSignals(storedEvent.id, signals);

  if (decision.action !== "normal" && decision.action !== "watch") {
    const action = decision.action === "review" ? "review" : decision.action;
    await createSanction({
      serverId: server.id,
      playerUuid: event.player.uuid,
      playerName: event.player.name,
      eventId: storedEvent.id,
      action,
      requiresConfirmation: decision.requiresConfirmation,
      reason: decision.rationale,
      durationMinutes: action === "temp_ban" ? 60 : undefined,
    });
  }

  if (decision.action !== "normal") {
    const webhookUrl = await getDiscordWebhook(server);
    void notifyDiscord({
      webhookUrl,
      title: `BedrockGuard · ${server.name}`,
      description: `Oyuncu: **${event.player.name}**\nPuan: **${score}/100**\nKarar: **${decision.action}**\nGerekçe: ${decision.rationale}`,
      severity: decision.action === "watch" ? "watch" : "action",
    });
  }
  return { decision, signals };
}
