import { createHash, timingSafeEqual } from "node:crypto";
import type { User } from "../../drizzle/schema";

const OWNER_ACCESS_PREFIX = "server-owner:";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptRecord = { failures: number[]; lockedUntil: number };
type LoginFailure = "not_configured" | "invalid" | "locked";
const attempts = new Map<string, AttemptRecord>();

function hasStrongSessionSecret() {
  return (process.env.JWT_SECRET ?? "").length >= 32;
}

function configuredOwnerKey() {
  const key = process.env.SERVER_OWNER_ACCESS_KEY ?? "";
  return key.length >= 16 && hasStrongSessionSecret() ? key : null;
}

function requestKey(ip: string | undefined) {
  return ip?.trim() || "unknown";
}

function passwordMatches(expected: string, supplied: string) {
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

function fingerprint(secret: string) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 24);
}

function remainingLockout(key: string, now = Date.now()) {
  const record = attempts.get(key);
  if (!record || record.lockedUntil <= now) return 0;
  return record.lockedUntil - now;
}

function registerFailure(key: string, now = Date.now()) {
  const previous = attempts.get(key) ?? { failures: [], lockedUntil: 0 };
  const failures = previous.failures.filter(time => now - time < WINDOW_MS);
  failures.push(now);
  attempts.set(key, {
    failures,
    lockedUntil: failures.length >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
  });
}

function clearFailures(key: string) {
  attempts.delete(key);
}

function resultForFailure(reason: LoginFailure): { ok: false; reason: LoginFailure } {
  return { ok: false, reason };
}

export function serverOwnerOpenId(accessKey: string) {
  return `${OWNER_ACCESS_PREFIX}${fingerprint(accessKey)}`;
}

export function serverOwnerUserFromOpenId(openId: string): User | null {
  const accessKey = configuredOwnerKey();
  if (!accessKey || openId !== serverOwnerOpenId(accessKey)) return null;
  const now = new Date();
  return {
    id: -1,
    openId,
    email: null,
    name: "Sunucu Sahibi",
    loginMethod: "owner_access_key",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export function verifyServerOwnerAccessKey(input: {
  accessKey: string;
  requestIp?: string;
}): { ok: true; user: User } | { ok: false; reason: LoginFailure } {
  const accessKey = configuredOwnerKey();
  if (!accessKey) return resultForFailure("not_configured");

  const key = `owner:${requestKey(input.requestIp)}`;
  if (remainingLockout(key) > 0) return resultForFailure("locked");
  if (!passwordMatches(accessKey, input.accessKey)) {
    registerFailure(key);
    return resultForFailure("invalid");
  }

  clearFailures(key);
  return { ok: true, user: serverOwnerUserFromOpenId(serverOwnerOpenId(accessKey))! };
}

export function resetAccessKeyAttemptsForTests() {
  attempts.clear();
}
