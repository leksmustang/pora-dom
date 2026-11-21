import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, stat } from "node:fs/promises";
import { createDatabase } from "./db.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(payload));
}

async function body(request, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("body_too_large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

function bearer(request) {
  const value = request.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function configuredOffers() {
  const raw = process.env.CPA_OFFERS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("CPA_OFFERS_JSON ignored: invalid JSON");
    return [];
  }
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Object.assign(new Error("invalid_snapshot"), { status: 400 });
  const encoded = JSON.stringify(value);
  if (encoded.length > 750_000) throw Object.assign(new Error("snapshot_too_large"), { status: 413 });
  return value;
}

async function nearbyStores(url) {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const query = String(url.searchParams.get("q") || "магазин товаров для дома").slice(0, 120);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw Object.assign(new Error("invalid_coordinates"), { status: 400 });
  const externalUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(query)}&ll=${lon},${lat}&z=13`;
  const key = process.env.YANDEX_PLACES_API_KEY;
  if (!key) return { provider: null, items: [], externalUrl, locationStored: false };
  const api = new URL("https://search-maps.yandex.ru/v1/");
  api.searchParams.set("apikey", key);
  api.searchParams.set("text", query);
  api.searchParams.set("lang", "ru_RU");
  api.searchParams.set("type", "biz");
  api.searchParams.set("ll", `${lon},${lat}`);
  api.searchParams.set("spn", "0.12,0.12");
  api.searchParams.set("rspn", "1");
  api.searchParams.set("results", "5");
  const result = await fetch(api, { signal: AbortSignal.timeout(5000) });
  if (!result.ok) throw Object.assign(new Error("places_provider_error"), { status: 502 });
  const payload = await result.json();
  const items = (payload.features || []).map(feature => ({
    id: feature.properties?.CompanyMetaData?.id || feature.properties?.uri || feature.geometry?.coordinates?.join(","),
    name: feature.properties?.CompanyMetaData?.name || feature.properties?.name,
    address: feature.properties?.CompanyMetaData?.address || feature.properties?.description,
    coordinates: feature.geometry?.coordinates || [],
    url: feature.properties?.CompanyMetaData?.url || externalUrl
  }));
  return { provider: "yandex", items, externalUrl, locationStored: false };
}

export function createAppServer({ databasePath = path.join(projectRoot, "data", "pora-dom.db"), offers = configuredOffers() } = {}) {
  const storage = createDatabase(databasePath);
  storage.syncOffers(offers);
  const buckets = new Map();
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const ip = request.socket.remoteAddress || "unknown";
    const minute = Math.floor(Date.now() / 60_000);
    const bucket = buckets.get(ip) || { minute, count: 0 };
    if (bucket.minute !== minute) { bucket.minute = minute; bucket.count = 0; }
    bucket.count += 1; buckets.set(ip, bucket);
    if (bucket.count > 180) return json(response, 429, { error: "rate_limited" });

    try {
      if (url.pathname === "/api/health") return json(response, 200, { ok: true, service: "pora-dom", version: "0.5" });
      if (url.pathname === "/api/v1/session" && request.method === "POST") {
        const input = await body(request);
        return json(response, 201, storage.createSession(input.displayName));
      }
      if (url.pathname === "/api/v1/offers" && request.method === "GET") {
        const category = String(url.searchParams.get("category") || "all");
        const brand = String(url.searchParams.get("brand") || "");
        return json(response, 200, { items: storage.listOffers(category, brand), attribution: "server_click_id", personalDataShared: false });
      }
      const offerClickMatch = url.pathname.match(/^\/api\/v1\/offers\/([^/]+)\/go$/);
      if (offerClickMatch && request.method === "GET") {
        const click = storage.createPartnerClick(decodeURIComponent(offerClickMatch[1]), url.searchParams.get("placement"));
        if (!click) return json(response, 404, { error: "offer_not_found" });
        response.writeHead(302, {
          Location: click.targetUrl,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        });
        return response.end();
      }
      const offerImpressionMatch = url.pathname.match(/^\/api\/v1\/offers\/([^/]+)\/impression$/);
      if (offerImpressionMatch && request.method === "POST") {
        const impression = storage.recordPartnerImpression(decodeURIComponent(offerImpressionMatch[1]), url.searchParams.get("placement"));
        return impression ? json(response, 201, impression) : json(response, 404, { error: "offer_not_found" });
      }
      if (url.pathname === "/api/v1/stores/nearby" && request.method === "GET") return json(response, 200, await nearbyStores(url));

      const user = storage.authenticate(bearer(request));
      if (url.pathname.startsWith("/api/v1/") && !user) return json(response, 401, { error: "unauthorized" });

      if (url.pathname === "/api/v1/homes" && request.method === "POST") {
        const input = await body(request);
        return json(response, 201, storage.createHome(user.id, input.name, normalizeSnapshot(input.snapshot || {})));
      }
      const homeMatch = url.pathname.match(/^\/api\/v1\/homes\/([^/]+)(?:\/(snapshot|invites))?$/);
      if (homeMatch) {
        const [, homeId, action] = homeMatch;
        if (!action && request.method === "GET") {
          const home = storage.getHome(homeId, user.id);
          return home ? json(response, 200, home) : json(response, 404, { error: "home_not_found" });
        }
        if (action === "snapshot" && request.method === "PUT") {
          const input = await body(request);
          const result = storage.updateHome(homeId, user.id, normalizeSnapshot(input.snapshot), input.version);
          if (result.status === "ok") return json(response, 200, result.home);
          if (result.status === "conflict") return json(response, 409, { error: "version_conflict", current: result.home });
          return json(response, 403, { error: "forbidden" });
        }
        if (action === "invites" && request.method === "POST") {
          const invite = storage.createInvite(homeId, user.id);
          return invite ? json(response, 201, invite) : json(response, 403, { error: "owner_required" });
        }
      }
      const inviteMatch = url.pathname.match(/^\/api\/v1\/invites\/([^/]+)\/join$/);
      if (inviteMatch && request.method === "POST") {
        const home = storage.joinInvite(inviteMatch[1], user.id);
        return home ? json(response, 200, home) : json(response, 404, { error: "invite_invalid" });
      }
      if (url.pathname.startsWith("/api/")) return json(response, 404, { error: "not_found" });

      const pathname = decodeURIComponent(url.pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
      let target = path.resolve(projectRoot, relative);
      if (!target.startsWith(projectRoot + path.sep) && target !== path.join(projectRoot, "index.html")) return json(response, 403, { error: "forbidden" });
      if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      const content = await readFile(target);
      response.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
      response.end(content);
    } catch (error) {
      if (error.code === "ENOENT") return json(response, 404, { error: "not_found" });
      json(response, error.status || 500, { error: error.message === "body_too_large" ? "body_too_large" : error.message === "invalid_json" ? "invalid_json" : "request_failed" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4173);
  createAppServer().listen(port, "127.0.0.1", () => console.log(`Пора: Дом и API запущены: http://127.0.0.1:${port}`));
}
