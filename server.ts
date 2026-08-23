import { createBedrockGuardApp } from "./server/app";

// Vercel detects this root Express entrypoint and runs it as one Node.js
// Function. Static client output is produced to /public by build:vercel.
export default createBedrockGuardApp();
