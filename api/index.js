import app from "./server.mjs";

function restoreOriginalPath(req) {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  const route = requestUrl.searchParams.get("__bg_route");
  const path = requestUrl.searchParams.get("__bg_path");

  if (!route || path === null) return;

  requestUrl.searchParams.delete("__bg_route");
  requestUrl.searchParams.delete("__bg_path");
  const prefix = route === "storage" ? "/manus-storage" : "/api";
  const suffix = path.replace(/^\/+/, "");
  const query = requestUrl.searchParams.toString();
  req.url = `${prefix}/${suffix}${query ? `?${query}` : ""}`;
}

export default function handler(req, res) {
  restoreOriginalPath(req);
  return app(req, res);
}
