import { createHash, timingSafeEqual } from "node:crypto";
import type { User } from "../../drizzle/schema";

const LOCAL_ADMIN_PREFIX = "local-admin:";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptRecord = { failures: number[]; lockedUntil: number };
const attempts = new Map<string, AttemptRecord>();

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function configuredAdmin() {
  const email = normalizeEmail(process.env.LOCAL_ADMIN_EMAIL ?? "");
  const password = process.env.LOCAL_ADMIN_PASSWORD ?? "";
  const sessionSecret = process.env.JWT_SECRET ?? "";
  // Raw credentials stay only in Vercel encrypted environment storage. Refuse
  // to activate local auth with a weak password or JWT signing key.
  return email && password.length >= 12 && sessionSecret.length >= 32
    ? { email, password }
    : null;
}

function requestKey(ip: string | undefined) {
  return ip?.trim() || "unknown";
}

function passwordMatches(expected: string, supplied: string) {
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
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

export function isLocalAdminConfigured() {
  return Boolean(configuredAdmin());
}

export function localAdminOpenId(email: string) {
  return `${LOCAL_ADMIN_PREFIX}${normalizeEmail(email)}`;
}

export function localAdminUserFromOpenId(openId: string): User | null {
  const admin = configuredAdmin();
  if (!admin || openId !== localAdminOpenId(admin.email)) return null;

  const now = new Date();
  return {
    id: 0,
    openId,
    email: admin.email,
    name: "Vercel Yönetici",
    loginMethod: "local_password",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export function verifyLocalAdminLogin(input: {
  email: string;
  password: string;
  requestIp?: string;
}): { ok: true; user: User } | { ok: false; reason: "not_configured" | "invalid" | "locked" } {
  const admin = configuredAdmin();
  if (!admin) return { ok: false, reason: "not_configured" };

  const key = requestKey(input.requestIp);
  if (remainingLockout(key) > 0) return { ok: false, reason: "locked" };

  const validEmail = normalizeEmail(input.email) === admin.email;
  const validPassword = passwordMatches(admin.password, input.password);
  if (!validEmail || !validPassword) {
    registerFailure(key);
    return { ok: false, reason: "invalid" };
  }

  clearFailures(key);
  return { ok: true, user: localAdminUserFromOpenId(localAdminOpenId(admin.email))! };
}

export function resetLocalAdminAttemptsForTests() {
  attempts.clear();
}
