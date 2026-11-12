// Un único sondeo a /api/aviones para toda la página: el radar de la portada,
// el mini radar de la tarjeta y el panel de «Ahora» se suscriben y reparten el
// mismo resultado. Así cada visitante cuesta una consulta cada 5 s, no tres.

export type Wire = { h: string; f?: string; x: number; y: number; z: number; s: number; v: [number, number] };

export type Feed = {
  planes: Wire[]; // última lectura, en km alrededor del centro del radar
  offline: boolean; // la antena no responde
  at: number; // performance.now() de cuando llegó
  history: Record<string, number[][]> | null; // estelas de los últimos 10 min: [x, y, z, hace_s]
};

const POLL = 5; // segundos entre lecturas
const POLL_OFFLINE = 15; // y cuando la antena no responde

type Sub = { cb: (feed: Feed) => void; wants: () => boolean };
const subs = new Set<Sub>();
let feed: Feed | null = null;
let history: Feed["history"] = null;
let historyAsked = false;
let failures = 0;
let busy = false;
let triedAt = -Infinity;
let timer: number | undefined;

const json = (url: string) =>
  fetch(url, { cache: "no-store" }) // nunca la copia del navegador: también salta las de 4 h ya guardadas
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

// Solo se pregunta a la antena si la pestaña se ve y a alguien le interesa.
const active = () => !document.hidden && [...subs].some((s) => s.wants());

async function poll() {
  timer = undefined;
  if (busy) return;
  busy = true;
  triedAt = performance.now();
  try {
    if (!historyAsked) {
      historyAsked = true;
      history = (await json("/api/estelas"))?.tracks ?? null;
    }
    const body = await json("/api/aviones");
    if (!Array.isArray(body?.planes)) throw new Error("sin datos");
    failures = 0;
    feed = { planes: body.planes, offline: false, at: performance.now(), history };
    subs.forEach((s) => s.cb(feed!));
  } catch {
    // Un fallo suelto puede ser la red; dos seguidos, la antena no responde.
    if (++failures >= 2 || feed?.offline) {
      feed = { planes: [], offline: true, at: performance.now(), history };
      subs.forEach((s) => s.cb(feed!));
    }
  } finally {
    busy = false;
    kick();
  }
}

/** Programa la siguiente lectura si hace falta; se llama al cambiar quién mira. */
export function kick() {
  if (timer !== undefined || busy || !active()) return;
  const every = (feed?.offline ? POLL_OFFLINE : POLL) * 1000;
  timer = window.setTimeout(poll, Math.max(0, every - (performance.now() - triedAt)));
}

/** Recibe cada lectura nueva (y de inmediato la última, si ya la hay). */
export function watch(cb: (feed: Feed) => void, wants: () => boolean = () => true) {
  const sub = { cb, wants };
  subs.add(sub);
  if (feed) cb(feed);
  kick();
  return () => subs.delete(sub);
}

document.addEventListener("visibilitychange", kick);
