import type { Express, Request, Response } from "express";
import { COOKIE_NAME } from "../../shared/const";
import { QA_AUTH_OPEN_ID, isLocalQaAuthRequest } from "../guard/qa";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

const QA_SESSION_MS = 30 * 60_000;

export async function issueLocalQaSession() {
  return sdk.createSessionToken(QA_AUTH_OPEN_ID, {
    name: "QA Authentication Admin",
    expiresInMs: QA_SESSION_MS,
  });
}

export async function handleLocalQaLogin(
  req: Request,
  res: Response,
  isProduction = ENV.isProduction
) {
  if (!isLocalQaAuthRequest(req, isProduction)) {
    res.status(404).end();
    return;
  }
  const sessionToken = await issueLocalQaSession();
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req, isProduction), maxAge: QA_SESSION_MS });
  // Deliberately return no token; the session remains HttpOnly.
  res.status(204).end();
}

export function registerLocalQaAuthRoutes(app: Express) {
  app.post("/api/qa-auth/login", async (req: Request, res: Response) => {
    await handleLocalQaLogin(req, res);
  });
}
