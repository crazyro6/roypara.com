// Lógica pura del radar en directo: del aircraft.json de dump1090 a lo que
// necesita la página, y el historial de estelas. Sin nada del entorno.
import { round, xy } from "../src/lib/geo.ts";

/** Lo que recibe la página de cada avión, en km alrededor del centro del radar. */
export type Plane = {
  h: string; // código hex (público: lo emite el propio avión)
  f?: string; // indicativo
  x: number; // este
  y: number; // sur
  z: number; // altitud
  s: number; // segundos desde la última posición
  v: [number, number]; // velocidad en km/s (este, sur)
};

/** Una posición del historial: x, y, z en km y t en segundos (epoch). */
export type Fix = [number, number, number, number];
export type History = Record<string, Fix[]>;

type Raw = {
  hex?: unknown;
  flight?: unknown;
  lat?: unknown;
  lon?: unknown;
  seen_pos?: unknown;
  gs?: unknown; // nudos (dump1090-fa)
  speed?: unknown; // nudos (dump1090 antiguo, el de mi Pi)
  track?: unknown;
  alt_baro?: unknown;
  altitude?: unknown;
  alt_geom?: unknown;
};

const KT = 0.000514444; // km/s por nudo
const FT = 0.0003048; // km por pie
const KEEP = 600; // segundos de historial
const MIN_STEP = 1.5; // km mínimos entre dos puntos del historial

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function normalize(raw: unknown, center: [number, number], range: number): Plane[] {
  const list = (raw as { aircraft?: Raw[] } | null)?.aircraft;
  const out: Plane[] = [];
  for (const a of Array.isArray(list) ? list : []) {
    // Solo códigos ICAO de 6 cifras (fuera TIS-B y similares): además se
    // usan en URLs de otras APIs, así que se validan aquí.
    if (typeof a.hex !== "string" || !/^[0-9a-f]{6}$/i.test(a.hex) || !num(a.lat) || !num(a.lon)) continue;
    const s = num(a.seen_pos) ? a.seen_pos : 0;
    if (s > 60) continue; // más de un minuto sin posición: se da por perdido (dump1090 hace algo parecido)
    const [x, y] = xy(center, a.lat, a.lon);
    if (Math.hypot(x, y) > range) continue;

    const alt = [a.alt_baro, a.altitude, a.alt_geom].find((v) => v !== undefined);
    const z = num(alt) ? Math.max(0, alt) * FT : 0; // "ground" y desconocida: al suelo
    const kt = num(a.gs) ? a.gs : num(a.speed) ? a.speed : 0;
    const speed = num(a.track) ? kt * KT : 0;
    const rad = ((num(a.track) ? a.track : 0) * Math.PI) / 180;
    const flight = typeof a.flight === "string" ? a.flight.trim().toUpperCase() : "";

    out.push({
      h: a.hex.toLowerCase(),
      f: /^[A-Z0-9]{2,8}$/.test(flight) ? flight : undefined,
      x: round(x, 1),
      y: round(y, 1),
      z: round(z, 2),
      s: round(s, 1),
      v: [round(Math.sin(rad) * speed, 3) || 0, round(-Math.cos(rad) * speed, 3) || 0], // || 0 evita el -0
    });
  }
  return out;
}

/** Añade las posiciones nuevas y olvida lo que tiene más de 10 minutos. */
export function updateHistory(history: History, planes: Plane[], now: number): History {
  const out: History = {};
  for (const [hex, pts] of Object.entries(history)) {
    const kept = pts.filter((p) => p[3] > now - KEEP);
    if (kept.length) out[hex] = kept;
  }
  for (const p of planes) {
    const t = Math.round(now - p.s);
    const pts = (out[p.h] ??= []);
    const last = pts.at(-1);
    if (last && (t <= last[3] || Math.hypot(p.x - last[0], p.y - last[1]) < MIN_STEP)) continue;
    pts.push([p.x, p.y, p.z, t]);
  }
  return out;
}

/** El historial para la página: en vez de la hora, cuántos segundos hace. */
export function trails(history: History, now: number): Record<string, number[][]> {
  const out: Record<string, number[][]> = {};
  for (const [hex, pts] of Object.entries(history)) {
    out[hex] = pts.map(([x, y, z, t]) => [x, y, z, Math.max(0, Math.round(now - t))]);
  }
  return out;
}
