import { createBedrockGuardApp } from "./app";

// This file is bundled by build:vercel. Bundling internal imports avoids the
// Node ESM path resolution problem in a standalone Vercel Function package.
export default createBedrockGuardApp();
