import { createBedrockGuardApp } from "../server/app";

// Vercel routes /api/* and /manus-storage/* to this Node.js Function through
// vercel.json. Express keeps the existing BedrockGuard API contract intact.
export default createBedrockGuardApp();
