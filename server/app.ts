import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerLocalQaAuthRoutes } from "./_core/qaAuth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerAgentApi } from "./guard/agentApi";

/**
 * Shared HTTP application factory.
 *
 * The managed development server and Vercel's root `server.ts` import this
 * exact factory, so the UI/API/Agent route contract stays identical.
 */
export function createBedrockGuardApp() {
  const app = express();
  app.set("trust proxy", 1);
  // Agent events are intentionally parsed before the general API parser.
  app.use("/api/agent", express.json({ limit: "16kb" }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerLocalQaAuthRoutes(app);
  registerAgentApi(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
