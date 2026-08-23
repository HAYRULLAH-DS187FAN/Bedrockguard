import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addWhitelistEntry,
  confirmSanction,
  createGuardServer,
  createSanction,
  getPlayer,
  getServerById,
  listEventDetections,
  listGuardServers,
  listPlayerEvents,
  listPlayerSanctions,
  listPlayers,
  listRecentEvents,
  listRecentSanctions,
  listWhitelist,
  parseModerationConfig,
  removeWhitelistEntry,
  updateServerConfiguration,
  writeAudit,
} from "./db";
import { DEFAULT_MODERATION_CONFIG } from "../shared/guard";
import { isLocalQaRequest, qaScenario, qaServer, QA_SERVER_ID } from "./guard/qa";

const idInput = z.object({ serverId: z.string().uuid() });
const safeSlug = z.string().min(3).max(80).regex(/^[a-z0-9-]+$/);
const configInput = z.object({
  serverId: z.string().uuid(),
  settings: z.object({
    scoreHalfLifeHours: z.number().min(1).max(720),
    thresholds: z.object({ watch: z.number().min(1).max(100), intervention: z.number().min(1).max(100), review: z.number().min(1).max(100), tempBan: z.number().min(1).max(100) }),
    recurrence: z.object({ kickAtOrAbove: z.number().min(1).max(100), minEventsForKick: z.number().int().min(1).max(20), minEventsForTempBan: z.number().int().min(1).max(20) }),
    safeguards: z.object({ requireDistinctSignalsForIntervention: z.boolean(), autoEnforceWarnings: z.boolean(), allowAutomatedTempBans: z.boolean() }),
    rules: z.object({ profanityWords: z.array(z.string().max(64)).max(100), bannedWords: z.array(z.string().max(64)).max(100), prohibitedCommands: z.array(z.string().max(64)).max(100), spamWindowSeconds: z.number().int().min(5).max(300), spamMessageLimit: z.number().int().min(2).max(30), repeatMessageLimit: z.number().int().min(2).max(20), maxMovementSpeed: z.number().min(1).max(200), maxBlocksPerSecond: z.number().min(1).max(500), maxItemsPerMinute: z.number().min(1).max(10000) }),
    ai: z.object({ enabled: z.boolean(), modelPreference: z.enum(["gpt-5-mini", "default"]), minimumConfidence: z.number().min(0.5).max(1), maxSignalPoints: z.number().int().min(1).max(15) }),
  }),
  discordWebhookUrl: z.string().url().max(500).nullable().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: adminProcedure.input(z.object({ serverId: z.string().uuid().optional() }).optional()).query(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) return qaScenario.overview();
      const [servers, players, events, sanctionRows] = await Promise.all([listGuardServers(), listPlayers(input?.serverId), listRecentEvents(input?.serverId), listRecentSanctions(input?.serverId)]);
      return {
        servers,
        metrics: {
          online: players.filter(player => player.isOnline).length,
          highRisk: players.filter(player => player.suspicionScore >= 70).length,
          pending: sanctionRows.filter(sanction => sanction.status === "pending_confirmation").length,
          eventsToday: events.filter(event => event.occurredAt.getTime() > Date.now() - 86_400_000).length,
        },
        players: players.slice(0, 18),
        events,
        sanctions: sanctionRows,
      };
    }),
  }),
  servers: router({
    list: adminProcedure.query(({ ctx }) => isLocalQaRequest(ctx.req) ? [qaServer] : listGuardServers()),
    create: adminProcedure.input(z.object({ name: z.string().min(3).max(120), slug: safeSlug })).mutation(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) {
        return { server: qaServer, rawAgentSecret: "qa_local_no_agent" };
      }
      const result = await createGuardServer(input);
      await writeAudit({ serverId: result.server.id, actorUserId: ctx.user.id, action: "server.secret_issued", summary: "Agent kimlik bilgisi ilk kez oluşturuldu." });
      return result;
    }),
    getConfiguration: adminProcedure.input(idInput).query(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) {
        if (input.serverId !== QA_SERVER_ID) throw new TRPCError({ code: "NOT_FOUND" });
        return { server: { id: qaServer.id, name: qaServer.name, slug: qaServer.slug, agentKeyId: qaServer.agentKeyId, discordConfigured: false }, settings: qaServer.settings };
      }
      const server = await getServerById(input.serverId);
      if (!server) throw new TRPCError({ code: "NOT_FOUND" });
      return { server: { id: server.id, name: server.name, slug: server.slug, agentKeyId: server.agentKeyId, discordConfigured: Boolean(server.discordWebhookEncrypted) }, settings: parseModerationConfig(server.settingsJson) };
    }),
    updateConfiguration: adminProcedure.input(configInput).mutation(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) return { success: true, qa: true };
      if (!(input.settings.thresholds.watch < input.settings.thresholds.intervention && input.settings.thresholds.intervention <= input.settings.thresholds.review && input.settings.thresholds.review <= input.settings.thresholds.tempBan)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Puan eşikleri artan sırada olmalıdır." });
      }
      await updateServerConfiguration(input);
      await writeAudit({ serverId: input.serverId, actorUserId: ctx.user.id, action: "server.settings_saved", summary: "Moderasyon kuralları, eşikleri veya AI ayarları kaydedildi." });
      return { success: true };
    }),
  }),
  players: router({
    list: adminProcedure.input(z.object({ serverId: z.string().uuid().optional() }).optional()).query(({ input, ctx }) => isLocalQaRequest(ctx.req) ? qaScenario.players(input?.serverId) : listPlayers(input?.serverId)),
    detail: adminProcedure.input(z.object({ serverId: z.string().uuid(), playerUuid: z.string().min(3).max(96) })).query(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) {
        const detail = qaScenario.detail(input.serverId, input.playerUuid);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "QA oyuncusu bulunamadı." });
        return detail;
      }
      const player = await getPlayer(input.serverId, input.playerUuid);
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Oyuncu bulunamadı." });
      const [events, sanctions] = await Promise.all([listPlayerEvents(input.serverId, input.playerUuid), listPlayerSanctions(input.serverId, input.playerUuid)]);
      const evidence = await Promise.all(events.map(async event => ({ event, detections: await listEventDetections(event.id) })));
      return { player, evidence, sanctions };
    }),
  }),
  moderation: router({
    defaults: adminProcedure.query(() => DEFAULT_MODERATION_CONFIG),
    requestManualSanction: adminProcedure.input(z.object({ serverId: z.string().uuid(), playerUuid: z.string().min(3).max(96), action: z.enum(["warning", "kick", "temp_ban", "review"]), reason: z.string().min(5).max(500), durationMinutes: z.number().int().min(5).max(43200).optional() })).mutation(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) return { id: "qa-simulated-request", action: input.action, status: "pending_confirmation", qa: true } as any;
      const player = await getPlayer(input.serverId, input.playerUuid);
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Oyuncu bulunamadı." });
      return createSanction({ ...input, playerName: player.playerName, requiresConfirmation: true, requestedByUserId: ctx.user.id });
    }),
    confirmSanction: adminProcedure.input(z.object({ sanctionId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
      if (isLocalQaRequest(ctx.req)) return { success: true, qa: true };
      await confirmSanction({ sanctionId: input.sanctionId, actorUserId: ctx.user.id });
      return { success: true };
    }),
  }),
  whitelist: router({
    list: adminProcedure.input(idInput).query(({ input, ctx }) => isLocalQaRequest(ctx.req) ? qaScenario.whitelist(input.serverId) : listWhitelist(input.serverId)),
    add: adminProcedure.input(z.object({ serverId: z.string().uuid(), playerUuid: z.string().min(3).max(96), playerName: z.string().min(1).max(64), reason: z.string().min(3).max(240) })).mutation(({ input, ctx }) => isLocalQaRequest(ctx.req) ? Promise.resolve() : addWhitelistEntry({ ...input, actorUserId: ctx.user.id })),
    remove: adminProcedure.input(z.object({ serverId: z.string().uuid(), playerUuid: z.string().min(3).max(96) })).mutation(({ input, ctx }) => isLocalQaRequest(ctx.req) ? Promise.resolve() : removeWhitelistEntry({ ...input, actorUserId: ctx.user.id })),
  }),
});

export type AppRouter = typeof appRouter;
