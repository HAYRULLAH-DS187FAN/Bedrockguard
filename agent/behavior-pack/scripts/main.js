/*
 * BDS Script API adaptörü.
 * @minecraft/server-net deneysel olduğundan manifestteki sürümü kendi BDS
 * sürümünüzde bulunan sürümle eşleştirin. HMAC imzalama, Node Bridge ile
 * uygulanır; bu paket eventleri yerel köprünün okuyabileceği scriptevent
 * akışına aktarır veya desteklenen sürümde doğrudan HTTP adaptörüne bağlanır.
 */
import { system, world } from "@minecraft/server";

const EVENT_NAMESPACE = "bedrockguard:event";

function emit(type, player, content, metadata = {}) {
  const event = {
    eventId: `${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
    occurredAt: Date.now(),
    type,
    player: { uuid: player.id, name: player.name },
    ...(content ? { content: String(content).slice(0, 512) } : {}),
    metadata,
  };
  // Yerel BDS köprünüz bu id'yi dinleyerek events.ndjson akışına dönüştürür.
  system.sendScriptEvent(EVENT_NAMESPACE, JSON.stringify(event));
}

world.beforeEvents.chatSend.subscribe(event => {
  // Yaptırım kararı uzaktan alınır; bu dinleyici konuşmayı tek başına engellemez.
  emit("chat", event.sender, event.message);
});

world.afterEvents.playerBreakBlock.subscribe(event => {
  emit("block_break", event.player, undefined, {
    blockType: event.brokenBlockPermutation?.type?.id ?? "unknown",
    blocksPerSecond: 1,
  });
});

world.afterEvents.playerSpawn.subscribe(event => {
  if (event.initialSpawn) emit("player_join", event.player);
});

world.beforeEvents.playerLeave.subscribe(event => {
  emit("player_leave", event.player);
});
