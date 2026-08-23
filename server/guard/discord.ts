import { safeLog } from "./security";

export async function notifyDiscord(input: { webhookUrl: string | null; title: string; description: string; severity: "info" | "watch" | "action" }) {
  if (!input.webhookUrl) return { delivered: false, reason: "not_configured" as const };
  try {
    const color = input.severity === "action" ? 0xdc2626 : input.severity === "watch" ? 0xd97706 : 0x2563eb;
    const response = await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "BedrockGuard", embeds: [{ title: input.title, description: input.description.slice(0, 1800), color, timestamp: new Date().toISOString() }] }),
      signal: AbortSignal.timeout(4_500),
    });
    if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
    return { delivered: true as const };
  } catch (error) {
    safeLog("discord_delivery_failed", { error: error instanceof Error ? error.message : "unknown" });
    return { delivered: false as const, reason: "delivery_failed" as const };
  }
}
