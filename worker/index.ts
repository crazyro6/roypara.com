// Worker de Cloudflare: la web es estática y este código solo atiende /api/*.
//
//   /api/aircraft.json  los aviones que capta mi antena, con el formato de tar1090
//   /api/receiver.json  dónde está la antena, pero solo de forma aproximada
//   /api/estelas        sus últimos 10 minutos, para que la página no empiece vacía
//
// Los datos salen de la Raspberry Pi por un túnel de Cloudflare que solo
// deja pasar aircraft.json (nunca receiver.json, que trae la posición
// exacta). Aquí se cachean 5 s, así que da igual cuánta gente mire la web:
// la Pi recibe como mucho una petición cada 5 s por centro de datos.
import { radar } from "../src/data/radar.ts";
import { normalize, publicFeed, trails, updateHistory, type History } from "./live.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RADAR_ORIGIN?: string; // solo para pruebas en local
  ACCESS_ID?: string; // clave de Cloudflare Access: sin ella el túnel no deja entrar a nadie
  ACCESS_SECRET?: string;
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
      "cache-control": `public, s-maxage=${TTL}`, // para la caché del borde; al navegador le llega no-store (ver fresh)
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

// Al servir desde su caché, Cloudflare reescribe max-age con el «Browser Cache
// TTL» de la zona (4 h): el navegador se quedaba con aviones viejos. Lo que
// sale hacia el navegador lleva siempre no-store; s-maxage solo vive en el borde.
function fresh(res: Response) {
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  return out;
}

async function cached(request: Request, ctx: Ctx, make: () => Promise<Response>) {
  const hit = await edge?.match(request);
  if (hit) return fresh(hit);
  const res = await make();
  if (edge) ctx.waitUntil(edge.put(request, res.clone()));
  return fresh(res);
}

async function aircraft(env: Env, ctx: Ctx) {
  let raw: unknown;
  try {
    // La clave solo viaja a mi túnel, nunca a un origen de pruebas.
    const key = !env.RADAR_ORIGIN && env.ACCESS_ID && env.ACCESS_SECRET;
    const res = await fetch((env.RADAR_ORIGIN ?? ORIGIN) + PATH, {
      signal: AbortSignal.timeout(4000),
      headers: key ? { "cf-access-client-id": env.ACCESS_ID!, "cf-access-client-secret": env.ACCESS_SECRET! } : {},
    });
    if (!res.ok) throw new Error(String(res.status));
    raw = await res.json();
  } catch {
    return reply({ error: "offline" }, 503);
  }
  const list = normalize(raw, radar.center, radar.range);
  writeHistory(updateHistory(await readHistory(), list, Date.now() / 1000), ctx);
  return reply(publicFeed(raw));
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return reply({ error: "method" }, 405);

    if (pathname === "/api/aircraft.json") return cached(request, ctx, () => aircraft(env, ctx));
    // Como el receiver.json de tar1090, pero con el centro aproximado del radar.
    if (pathname === "/api/receiver.json") return fresh(reply({ lat: radar.center[0], lon: radar.center[1], refresh: TTL * 1000 }));
    if (pathname === "/api/estelas") {
      return cached(request, ctx, async () => reply({ tracks: trails(await readHistory(), Date.now() / 1000) }));
    }
    return reply({ error: "not found" }, 404);
  },
};
