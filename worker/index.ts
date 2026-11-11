// Worker de Cloudflare: la web es estática y este código solo atiende /api/*.
//
//   /api/aviones  los aviones que capta mi antena ahora mismo
//   /api/estelas  sus últimos 10 minutos, para que la página no empiece vacía
//
// Los datos salen de la Raspberry Pi por un túnel de Cloudflare que solo
// deja pasar aircraft.json (nunca receiver.json, que trae la posición
// exacta). Aquí se cachean 5 s, así que da igual cuánta gente mire la web:
// la Pi recibe como mucho una petición cada 5 s por centro de datos.
import { radar } from "../src/data/radar.ts";
import { normalize, trails, updateHistory, type History } from "./live.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RADAR_ORIGIN?: string; // solo para pruebas en local
}
type Ctx = { waitUntil(promise: Promise<unknown>): void };

const ORIGIN = "https://radar.roypara.com";
const PATH = "/dump1090/data/aircraft.json";
const HISTORY = "https://radar.internal/history";
const TTL = 5; // segundos

const edge = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Un fallo también se cachea 5 s, para no martillear una Pi caída.
      "cache-control": `public, max-age=3, s-maxage=${TTL}`,
    },
  });

// El historial vive en la caché del centro de datos (sin base de datos).
// shortcut: cada centro de datos tiene el suyo y dos peticiones a la vez
// pueden pisarse; basta para dibujar estelas, subir a Durable Objects si hiciera falta.
let memory: History = {};
async function readHistory(): Promise<History> {
  if (!edge) return memory;
  const hit = await edge.match(HISTORY);
  return hit ? ((await hit.json()) as History) : {};
}
function writeHistory(history: History, ctx: Ctx) {
  memory = history;
  ctx.waitUntil(edge?.put(HISTORY, new Response(JSON.stringify(history), { headers: { "cache-control": "max-age=900" } })) ?? Promise.resolve());
}

async function cached(request: Request, ctx: Ctx, make: () => Promise<Response>) {
  const hit = await edge?.match(request);
  if (hit) return hit;
  const res = await make();
  if (edge) ctx.waitUntil(edge.put(request, res.clone()));
  return res;
}

async function planes(env: Env, ctx: Ctx) {
  let raw: unknown;
  try {
    const res = await fetch((env.RADAR_ORIGIN ?? ORIGIN) + PATH, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    raw = await res.json();
  } catch {
    return reply({ error: "offline" }, 503);
  }
  const now = Date.now() / 1000;
  const list = normalize(raw, radar.center, radar.range);
  writeHistory(updateHistory(await readHistory(), list, now), ctx);
  return reply({ planes: list });
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return reply({ error: "method" }, 405);

    if (pathname === "/api/aviones") return cached(request, ctx, () => planes(env, ctx));
    if (pathname === "/api/estelas") {
      return cached(request, ctx, async () => reply({ tracks: trails(await readHistory(), Date.now() / 1000) }));
    }
    return reply({ error: "not found" }, 404);
  },
};
