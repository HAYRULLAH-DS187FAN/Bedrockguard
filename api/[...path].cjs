// Dynamic Vercel Function: preserves the original /api/* pathname so Express
// can continue routing tRPC, OAuth, Agent and storage proxy endpoints.
module.exports = require("./server.cjs").default;
