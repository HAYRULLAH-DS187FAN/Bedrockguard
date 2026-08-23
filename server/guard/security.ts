import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

function keyMaterial() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Sunucu gizli anahtarı yapılandırılmamış.");
  }
  return createHash("sha256").update(secret || "bedrockguard-development-only").digest();
}

export function encryptSensitiveValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitiveValue(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Şifreli değer geçersiz.");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function signAgentPayload(params: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: unknown;
}) {
  const canonical = [params.method.toUpperCase(), params.path, params.timestamp, params.nonce, stableStringify(params.body ?? {})].join("\n");
  return createHmac("sha256", params.secret).update(canonical).digest("hex");
}

export function signatureMatches(expected: string, received: string | undefined) {
  if (!received || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

export function maskSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(/https?:\/\/([^/\s]+)/gi, (_match, host) => `<url:${host}>`)
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>")
      .replace(/[A-Za-z0-9_-]{24,}/g, "<token>");
  }
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /secret|token|signature|authorization|content|message/i.test(key) ? "<redacted>" : maskSensitive(item),
      ]),
    );
  }
  return value;
}

export function safeLog(event: string, fields: Record<string, unknown> = {}) {
  const safeFields = maskSensitive(fields) as Record<string, unknown>;
  console.info(JSON.stringify({ scope: "bedrockguard", event, ...safeFields }));
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  allow(key: string, now = Date.now()) {
    const recent = (this.buckets.get(key) ?? []).filter(at => at > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.buckets.set(key, recent);
      return false;
    }
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }
}
