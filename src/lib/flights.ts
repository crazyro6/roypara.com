// Trayectorias de aviones para el radar de la portada.
// Los datos reales salen de mi receptor ADS-B (tools/capture-flights.py)
// y se guardan en src/data/flights.json. Sin ese archivo, en local se usan
// trayectorias de prueba y en producción el radar sale vacío.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type LatLon = [number, number];

export type Capture = {
  from: string; // ISO
  to: string; // ISO
  center?: LatLon; // receptor, redondeado
  tracks: { flight?: string; points: LatLon[] }[];
};

export type Plot = {
  r: number; // radio en km
  rings: number[];
  // bearing: rumbo del último punto visto desde el receptor (0 = norte, en grados).
  tracks: { d: string; start: [number, number]; end: [number, number]; bearing: number; flight?: string }[];
};

const FILE = join(process.cwd(), "src/data/flights.json");

export function loadCapture(): { capture: Capture; sample: boolean } | null {
  if (existsSync(FILE)) return { capture: JSON.parse(readFileSync(FILE, "utf8")), sample: false };
  if (import.meta.env.DEV) return { capture: sampleCapture(), sample: true };
  return null;
}

// Proyección equirectangular en km alrededor del receptor: a esta escala
// (unos cientos de km) el error es despreciable.
const scale = (lat0: number) => [111.32 * Math.cos((lat0 * Math.PI) / 180), 110.57];

export function plot(capture: Capture | undefined, fallback: LatLon, maxTracks = 40): Plot {
  const [lat0, lon0] = capture?.center ?? fallback;
  const [kx, ky] = scale(lat0);

  let far = 0;
  const tracks = (capture?.tracks ?? [])
    .map((t) => {
      const pts: [number, number][] = [];
      for (const [lat, lon] of t.points) {
        const p: [number, number] = [(lon - lon0) * kx, -(lat - lat0) * ky];
        const last = pts.at(-1);
        // Quita puntos casi repetidos para aligerar el SVG.
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.5) pts.push(p);
      }
      return { flight: t.flight?.trim() || undefined, pts };
    })
    .filter((t) => t.pts.length >= 3)
    .sort((a, b) => b.pts.length - a.pts.length)
    .slice(0, maxTracks);

  for (const t of tracks) for (const [x, y] of t.pts) far = Math.max(far, Math.hypot(x, y));
  // Múltiplo de 100 para que los anillos (cuartos) sean números redondos.
  const r = Math.min(400, Math.max(100, Math.ceil(far / 100) * 100));

  return {
    r,
    rings: [0.25, 0.5, 0.75, 1].map((f) => f * r),
    tracks: tracks.map((t) => ({
      d: "M" + t.pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L"),
      start: t.pts[0],
      end: t.pts.at(-1)!,
      bearing: (((Math.atan2(t.pts.at(-1)![0], -t.pts.at(-1)![1]) * 180) / Math.PI + 360) % 360),
      flight: t.flight,
    })),
  };
}

// ------------------------------------------------------------------
// Datos de prueba (solo en desarrollo): rutas casi rectas que cruzan la
// zona, generadas con una semilla fija para que no cambien al recargar.
function sampleCapture(): Capture {
  let seed = 7;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const center: LatLon = [27.84, -15.44];
  const [kx, ky] = scale(center[0]);
  const names = [
    "IBE3842", "RYR5LG", "BTI2KN", "VLG7HA", "EWG9TC", "AEA1023", "TVF84PL", "IBB8402",
    "EZY67QK", "TOM2AB", "CFG1PT", "NAX5LP", "BAW2742", "DLH1AT", "IBB8130", "SAS4471",
  ];
  const toPoint = ([x, y]: [number, number]): LatLon => [center[0] - y / ky, center[1] + x / kx];
  const airport: [number, number] = [9, -12]; // aprox. km al NE del receptor

  const tracks = names.map((flight, i) => {
    const points: LatLon[] = [];
    if (i % 3 === 0) {
      // Aproximación: llega desde lejos y gira hacia la pista.
      const a = rand() * Math.PI * 2;
      const start: [number, number] = [Math.cos(a) * 200, Math.sin(a) * 200];
      const ctrl: [number, number] = [airport[0] + (rand() - 0.5) * 120, airport[1] - 60 + rand() * 40];
      for (let k = 0; k <= 1; k += 0.02) {
        const x = (1 - k) ** 2 * start[0] + 2 * (1 - k) * k * ctrl[0] + k * k * airport[0];
        const y = (1 - k) ** 2 * start[1] + 2 * (1 - k) * k * ctrl[1] + k * k * airport[1];
        points.push(toPoint([x, y]));
      }
    } else {
      // Sobrevuelo: casi recto, sobre todo en el corredor norte–sur.
      const a = Math.PI / 2 + (rand() - 0.5) * 1.2;
      const off = (rand() - 0.5) * 300;
      const bend = (rand() - 0.5) * 0.0008;
      const span = Math.sqrt(Math.max(0, 210 ** 2 - off ** 2));
      const s0 = -span * (0.4 + rand() * 0.6);
      const s1 = span * (0.3 + rand() * 0.7);
      for (let s = s0; s <= s1; s += 4) {
        const o = off + bend * s * s;
        points.push(toPoint([Math.cos(a) * s - Math.sin(a) * o, Math.sin(a) * s + Math.cos(a) * o]));
      }
    }
    return { flight, points };
  });

  return { from: "2026-11-12T10:00:00Z", to: "2026-11-12T11:00:00Z", center, tracks };
}
