import type { Express, Request, Response } from "express";
import { z } from "zod";
import { acknowledgeSanction, claimAgentNonce, decryptSensitiveValueForServer, getQueuedSanctions, getServerByAgentKey } from "../db";
import type { AgentEventPayload } from "../../shared/guard";
import { processAgentEvent } from "./service";
import { signatureMatches, signAgentPayload, SlidingWindowRateLimiter, safeLog } from "./security";

const platformProfileSchema = z.object({
  clientFamily: z.enum(["java", "bedrock_direct", "bedrock_geyser", "unknown"]),
  confidence: z.number().min(0).max(1),
  identityProvider: z.enum(["floodgate", "xbox_live", "java_online", "offline", "unknown"]).optional(),
  proxyPath: z.enum(["direct_bds", "geyser_standalone", "geyser_velocity", "geyser_bungeecord", "unknown"]).optional(),
  clientVersion: z.string().max(64).optional(),
  sessionId: z.string().min(8).max(96).optional(),
  source: z.enum(["bds", "geyser", "floodgate", "agent"]),
}).strict();

const shadowObservationSchema = z.object({
  candidateType: z.enum(["speed", "fly", "packet_integrity", "movement_unknown"]),
  observedValue: z.number().finite().optional(),
  expectedMin: z.number().finite().optional(),
  expectedMax: z.number().finite().optional(),
  sampleWindowMs: z.number().int().min(100).max(60_000),
  sampleCount: z.number().int().min(1).max(200),
  measurementSource: z.enum(["bds_authoritative", "geyser_translated", "proxy_observed", "agent_derived"]),
  environmentFlags: z.array(z.string().min(1).max(48)).max(16),
  serverEffects: z.array(z.string().min(1).max(48)).max(16),
  networkQuality: z.enum(["stable", "jittery", "loss_suspected", "unknown"]),
  positionTraceDigest: z.string().max(128).optional(),
}).strict();

export const agentEventInputSchema = z.object({
  eventId: z.string().min(8).max(96),
  occurredAt: z.number().int().positive(),
  type: z.enum(["chat", "command", "player_join", "player_leave", "block_break", "item_gain", "movement", "player_death"]),
  player: z.object({ uuid: z.string().min(3).max(96), name: z.string().min(1).max(64) }),
  content: z.string().max(512).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  platform: platformProfileSchema.optional(),
  shadowObservation: shadowObservationSchema.optional(),
}).superRefine((event, ctx) => {
  if (event.shadowObservation && event.type !== "movement") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["shadowObservation"], message: "shadowObservation yalnızca movement olaylarında kabul edilir" });
  }
});

const acknowledgementSchema = z.object({ sanctionId: z.string().uuid(), succeeded: z.boolean(), message: z.string().max(240).optional() });
const rateLimiter = new SlidingWindowRateLimiter(180, 60_000);
const timestampSkewMs = 2 * 60_000;
const maxAgentPayloadBytes = 16 * 1024;

export function agentPayloadWithinSecurityLimits(body: unknown, metadata: unknown) {
  return Buffer.byteLength(JSON.stringify(body ?? {}), "utf8") <= maxAgentPayloadBytes && hasSafeMetadata(metadata ?? {});
}

function hasSafeMetadata(value: unknown, depth = 0): boolean {
  if (depth > 3) return false;
  if (value === null || typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return value.length <= 256;
  if (Array.isArray(value)) return value.length <= 16 && value.every(item => hasSafeMetadata(item, depth + 1));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length <= 20 && entries.every(([key, item]) => key.length <= 64 && hasSafeMetadata(item, depth + 1));
  }
  return false;
}

async function authenticateAgent(req: Request, res: Response): Promise<{ server: Awaited<ReturnType<typeof getServerByAgentKey>>; secret: string } | null> {
  const keyId = req.header("x-bedrockguard-key-id")?.trim();
  const timestamp = req.header("x-bedrockguard-timestamp")?.trim();
  const nonce = req.header("x-bedrockguard-nonce")?.trim();
  const signature = req.header("x-bedrockguard-signature")?.trim();
  if (!keyId || !timestamp || !nonce || !signature || nonce.length > 128) {
    res.status(401).json({ error: "missing_agent_auth" });
    return null;
  }
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > timestampSkewMs) {
    res.status(401).json({ error: "stale_agent_timestamp" });
    return null;
  }
  if (!rateLimiter.allow(keyId)) {
    res.status(429).json({ error: "agent_rate_limited" });
    return null;
  }
  const server = await getServerByAgentKey(keyId);
  if (!server || !server.isActive) {
    res.status(401).json({ error: "unknown_or_inactive_agent" });
    return null;
  }
  const secret = decryptSensitiveValueForServer(server);
  const expected = signAgentPayload({ secret, method: req.method, path: req.path, timestamp, nonce, body: req.body ?? {} });
  if (!signatureMatches(expected, signature)) {
    safeLog("agent_signature_rejected", { keyId, path: req.path });
    res.status(401).json({ error: "invalid_agent_signature" });
    return null;
  }
  const firstUse = await claimAgentNonce(server.id, nonce);
  if (!firstUse) {
    res.status(409).json({ error: "replayed_agent_request" });
    return null;
  }
  return { server, secret };
}

export function registerAgentApi(app: Express) {
  app.post("/api/agent/events", async (req, res) => {
    try {
      const agent = await authenticateAgent(req, res);
      if (!agent) return;
      const parsed = agentEventInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_event_payload", details: parsed.error.issues.map(issue => issue.path.join(".")) });
        return;
      }
      if (!agentPayloadWithinSecurityLimits(req.body, parsed.data.metadata)) {
        res.status(413).json({ error: "event_payload_exceeds_security_limits" });
        return;
      }
      const result = await processAgentEvent(agent.server, parsed.data as AgentEventPayload);
      res.status(202).json({ accepted: true, score: result.decision.score, decision: result.decision.action, requiresConfirmation: result.decision.requiresConfirmation });
    } catch (error) {
      safeLog("agent_event_isolated_failure", { error: error instanceof Error ? error.message : "unknown" });
      res.status(202).json({ accepted: true, processing: "deferred" });
    }
  });

  app.get("/api/agent/commands", async (req, res) => {
    try {
      const agent = await authenticateAgent(req, res);
      if (!agent) return;
      const commands = await getQueuedSanctions(agent.server.id);
      res.json({ commands: commands.map(command => ({ id: command.id, action: command.action, playerUuid: command.playerUuid, playerName: command.playerName, reason: command.reason, durationMinutes: command.durationMinutes })) });
    } catch (error) {
      safeLog("agent_commands_isolated_failure", { error: error instanceof Error ? error.message : "unknown" });
      res.status(503).json({ error: "commands_unavailable" });
    }
  });

  app.post("/api/agent/commands/ack", async (req, res) => {
    try {
      const agent = await authenticateAgent(req, res);
      if (!agent) return;
      const parsed = acknowledgementSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_acknowledgement" });
        return;
      }
      await acknowledgeSanction({ ...parsed.data, serverId: agent.server.id });
      res.json({ acknowledged: true });
    } catch (error) {
      safeLog("agent_command_ack_isolated_failure", { error: error instanceof Error ? error.message : "unknown" });
      res.status(503).json({ error: "acknowledgement_unavailable" });
    }
  });
}
