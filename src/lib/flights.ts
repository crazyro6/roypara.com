// Datos de vuelos para el radar de la portada.
// Los reales salen de mi receptor ADS-B (tools/capture-flights.py) y se
// guardan en src/data/flights.json. Sin ese archivo, en local se usan
// rutas de prueba y en producción el radar sale vacío.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** [lat, lon, altitud en pies (o null), segundos desde el inicio] */
type Fix = [number, number, number | null, number];

export type Capture = {
  from: string; // ISO
  to: string; // ISO
  center?: [number, number]; // receptor, redondeado
  tracks: { flight?: string; points: Fix[] }[];
};

/** Lo que recibe el canvas: todo en km alrededor del receptor. */
export type Scene = {
  r: number; // radio en km
  from: number; // inicio de la captura, epoch ms
  dur: number; // duración en segundos
  // p: [x (este), y (sur), z (altitud), t (segundos)]
  tracks: { f?: string; p: number[][] }[];
};

const FILE = join(process.cwd(), "src/data/flights.json");

export function loadCapture(): { capture: Capture; sample: boolean } | null {
  if (existsSync(FILE)) return { capture: JSON.parse(readFileSync(FILE, "utf8")), sample: false };
  if (import.meta.env.DEV) return { capture: sampleCapture(), sample: true };
  return null;
}

// Proyección equirectangular en km: a esta escala el error es despreciable.
const scale = (lat0: number) => [111.32 * Math.cos((lat0 * Math.PI) / 180), 110.57];
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export function scene(capture: Capture | undefined, fallback: [number, number], maxTracks = 80): Scene {
  const [lat0, lon0] = capture?.center ?? fallback;
  const [kx, ky] = scale(lat0);

  let far = 0;
  const tracks = (capture?.tracks ?? [])
    .map((t) => {
      const p: number[][] = [];
      let z = 0;
      for (const [lat, lon, alt, s] of t.points) {
        const x = (lon - lon0) * kx;
        const y = -(lat - lat0) * ky;
        if (alt != null) z = alt * 0.0003048; // sin altitud, se mantiene la última
        const last = p.at(-1);
        // Quita puntos casi repetidos para aligerar la página.
        if (last && Math.hypot(x - last[0], y - last[1]) < 2.5) continue;
        if (last && s <= last[3]) continue; // el tiempo siempre avanza
        p.push([round(x, 1), round(y, 1), round(z, 2), Math.round(s)]);
        far = Math.max(far, Math.hypot(x, y));
      }
      return { f: t.flight?.trim() || undefined, p };
    })
    .filter((t) => t.p.length >= 3)
    .sort((a, b) => b.p.length - a.p.length)
    .slice(0, maxTracks);

  const from = capture ? Date.parse(capture.from) : 0;
  return {
    // Múltiplo de 100 para que los anillos (cuartos) sean números redondos.
    r: Math.min(400, Math.max(100, Math.ceil(far / 100) * 100)),
    from,
    dur: capture ? Math.max(1, Math.round((Date.parse(capture.to) - from) / 1000)) : 1,
    tracks,
  };
}

// ------------------------------------------------------------------
// Datos de prueba (solo en desarrollo), con semilla fija: sobrevuelos a
// altitud de crucero y aproximaciones que bajan hasta el aeropuerto.
function sampleCapture(): Capture {
  let seed = 7;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const center: [number, number] = [27.84, -15.44];
  const [kx, ky] = scale(center[0]);
  const DUR = 3600;
  const names = [
    "IBE3842", "RYR5LG", "BTI2KN", "VLG7HA", "EWG9TC", "AEA1023", "TVF84PL", "IBB8402",
    "EZY67QK", "TOM2AB", "CFG1PT", "NAX5LP", "BAW2742", "DLH1AT", "IBB8130", "SAS4471",
  ];
  const airport: [number, number] = [9, -12]; // aprox. km al NE del receptor

  const tracks = names.map((flight, i) => {
    const xyz: [number, number, number][] = []; // km, km, pies
    let kmPerStep: number;
    if (i % 3 === 0) {
      // Aproximación: llega desde lejos, gira hacia la pista y baja.
      const a = rand() * Math.PI * 2;
      const start = [Math.cos(a) * 230, Math.sin(a) * 230];
      const ctrl = [airport[0] + (rand() - 0.5) * 120, airport[1] - 60 + rand() * 40];
      for (let k = 0; k <= 1.0001; k += 0.02) {
        const x = (1 - k) ** 2 * start[0] + 2 * (1 - k) * k * ctrl[0] + k * k * airport[0];
        const y = (1 - k) ** 2 * start[1] + 2 * (1 - k) * k * ctrl[1] + k * k * airport[1];
        xyz.push([x, y, 26000 * (1 - k) ** 1.4]);
      }
      kmPerStep = 4.6;
    } else {
      // Sobrevuelo: casi recto, sobre todo en el corredor norte–sur.
      const a = Math.PI / 2 + (rand() - 0.5) * 1.2;
      const off = (rand() - 0.5) * 360;
      const bend = (rand() - 0.5) * 0.0008;
      const span = Math.sqrt(Math.max(0, 250 ** 2 - off ** 2));
      const alt = 33000 + Math.floor(rand() * 5) * 2000;
      const dir = rand() > 0.5 ? 1 : -1;
      for (let s = -span; s <= span; s += 5) {
        const o = off + bend * s * s;
        xyz.push([Math.cos(a) * s * dir - Math.sin(a) * o, Math.sin(a) * s * dir + Math.cos(a) * o, alt]);
      }
      kmPerStep = 5;
    }
    // ~830 km/h en crucero, más lento en aproximación.
    const secPerStep = (kmPerStep / (i % 3 === 0 ? 520 : 830)) * 3600;
    const t0 = rand() * DUR * 1.1 - DUR * 0.25;
    const points = xyz
      .map(([x, y, alt], n): Fix => [center[0] - y / ky, center[1] + x / kx, alt, t0 + n * secPerStep])
      .filter((p) => p[3] >= 0 && p[3] <= DUR);
    return { flight, points };
  });

  return { from: "2026-11-12T10:00:00Z", to: "2026-11-12T11:00:00Z", center, tracks };
}
