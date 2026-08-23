/**
 * BedrockGuard Agent Bridge
 *
 * Çalışma şekli: stdin üzerinden her satırda bir BDS olay JSON'u alır, HTTPS
 * üzerinden imzalı olarak BedrockGuard'a iletir. stdout üzerinden, BDS komut
 * adaptörünün uygulayabileceği yaptırım komutlarını NDJSON olarak verir.
 *
 * `node bedrockguard-agent.mjs config.json < events.ndjson`
 */
import { createHmac, randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";

const configPath = process.argv[2] ?? "config.json";
const config = JSON.parse(await readFile(configPath, "utf8"));
const endpoint = String(config.endpoint ?? "").replace(/\/$/, "");
if (!endpoint.startsWith("https://") || !config.agentKeyId || !config.agentSecret) {
  throw new Error("config.json içinde HTTPS endpoint, agentKeyId ve agentSecret zorunludur.");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function signedHeaders(method, path, body) {
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const canonical = [method.toUpperCase(), path, timestamp, nonce, stableStringify(body ?? {})].join("\n");
  const signature = createHmac("sha256", config.agentSecret).update(canonical).digest("hex");
  return {
    "content-type": "application/json",
    "x-bedrockguard-key-id": config.agentKeyId,
    "x-bedrockguard-timestamp": timestamp,
    "x-bedrockguard-nonce": nonce,
    "x-bedrockguard-signature": signature,
  };
}

async function signedRequest(method, path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: signedHeaders(method, path, body),
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(7000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`BedrockGuard HTTP ${response.status}: ${result.error ?? "unknown"}`);
  return result;
}

async function relayEvent(raw) {
  const event = {
    eventId: raw.eventId ?? randomUUID(),
    occurredAt: raw.occurredAt ?? Date.now(),
    type: raw.type,
    player: { uuid: String(raw.player?.uuid ?? ""), name: String(raw.player?.name ?? "") },
    ...(typeof raw.content === "string" ? { content: raw.content.slice(0, 512) } : {}),
    ...(raw.metadata && typeof raw.metadata === "object" ? { metadata: raw.metadata } : {}),
    // Geyser/Floodgate adaptörleri bu iki alanı şemalı biçimde üretir. Bridge
    // bunları yorumlamaz veya ham paket verisi eklemez; imzalı olarak iletir.
    ...(raw.platform && typeof raw.platform === "object" ? { platform: raw.platform } : {}),
    ...(raw.shadowObservation && typeof raw.shadowObservation === "object" ? { shadowObservation: raw.shadowObservation } : {}),
  };
  if (!event.type || !event.player.uuid || !event.player.name) throw new Error("Olay type, player.uuid ve player.name içermelidir.");
  const result = await signedRequest("POST", "/events", event);
  process.stderr.write(`[BedrockGuard] ${event.type} kabul edildi; puan=${result.score ?? "?"}, karar=${result.decision ?? "?"}\n`);
}

function toBdsCommand(command) {
  const safeName = command.playerName.replace(/["\\]/g, "");
  if (command.action === "warning") return `tellraw "${safeName}" {"rawtext":[{"text":"[BedrockGuard] Uyarı: ${command.reason.slice(0, 120)}"}]}`;
  if (command.action === "kick") return `kick "${safeName}" ${command.reason.slice(0, 120)}`;
  if (command.action === "temp_ban") return `kick "${safeName}" Geçici uzaklaştırma: ${command.reason.slice(0, 110)}`;
  return null;
}

async function pollCommands() {
  try {
    const result = await signedRequest("GET", "/commands", {});
    for (const command of result.commands ?? []) {
      const bdsCommand = toBdsCommand(command);
      process.stdout.write(`${JSON.stringify({ type: "bedrockguard_command", commandId: command.id, bdsCommand, original: command })}\n`);
    }
  } catch (error) {
    process.stderr.write(`[BedrockGuard] Komut kuyruğu okunamadı: ${error.message}\n`);
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", line => {
  if (!line.trim()) return;
  void relayEvent(JSON.parse(line)).catch(error => process.stderr.write(`[BedrockGuard] Olay iletilemedi: ${error.message}\n`));
});
setInterval(() => void pollCommands(), Math.max(2000, Number(config.pollIntervalMs) || 5000));
void pollCommands();
