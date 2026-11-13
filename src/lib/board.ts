// Panel de vuelos de «Ahora»: los aviones más cercanos a mi antena, como un
// panel de salidas. Cuando una celda cambia, las letras se barajan un instante
// antes de fijarse. Comparte el sondeo con el radar (src/lib/live.ts).

import { routeOf } from "./aircraft";
import { kick, watch, type Feed, type Wire } from "./live";

const ROWS = 3;
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

type State = "connecting" | "live" | "quiet" | "offline";

const timers = new WeakMap<HTMLElement, number>();

/** Cambia el texto de una celda barajando las letras, como un panel de salidas. */
function flip(el: HTMLElement, text: string, still: boolean) {
  if (el.textContent === text) return;
  clearTimeout(timers.get(el));
  if (still) {
    el.textContent = text;
    return;
  }
  const start = performance.now();
  const step = () => {
    const age = performance.now() - start;
    let out = "";
    let done = true;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      // Signos y espacios van fijos; cada letra se fija un poco después de la anterior.
      if (!/[A-Z0-9]/i.test(c) || age > 140 + i * 55) out += c;
      else {
        out += CHARS[Math.floor(Math.random() * CHARS.length)];
        done = false;
      }
    }
    el.textContent = out;
    if (!done) timers.set(el, window.setTimeout(step, 45));
  };
  step();
}

export function mount(root: HTMLElement) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const locale = root.dataset.locale;
  const labels = JSON.parse(root.dataset.labels!) as Record<Exclude<State, "live">, string>;
  const rows = [...root.querySelectorAll<HTMLElement>("[data-row]")];
  const list = root.querySelector<HTMLElement>("[data-rows]")!;
  const note = root.querySelector<HTMLElement>("[data-note]")!;
  const cell = (row: HTMLElement, name: string) => row.querySelector<HTMLElement>(`[data-c="${name}"]`)!;

  // Cada fila conserva su avión mientras siga entre los más cercanos, para que
  // el panel no se reordene cada vez que dos aviones cambian de sitio.
  const slots: (string | null)[] = Array(ROWS).fill(null);

  const show = (state: State, text = "") => {
    root.dataset.state = state;
    list.hidden = state !== "live";
    note.hidden = state === "live";
    note.textContent = text;
    root.hidden = false;
  };

  const fill = (row: HTMLElement, p: Wire) => {
    row.dataset.h = p.hex;
    row.removeAttribute("data-empty");
    flip(cell(row, "cs"), p.flight ?? p.hex.toUpperCase(), still);
    flip(cell(row, "alt"), `${(Math.round(p.z * 10) * 100).toLocaleString(locale)} m`, still);
    if (!p.flight) return flip(cell(row, "rt"), "—", still);
    routeOf(p.flight).then((route) => {
      if (row.dataset.h === p.hex) flip(cell(row, "rt"), route ?? "—", still);
    });
  };

  const onFeed = (feed: Feed) => {
    if (feed.offline) {
      slots.fill(null);
      return show("offline", labels.offline);
    }
    if (!feed.planes.length) {
      slots.fill(null);
      return show("quiet", labels.quiet);
    }
    const byDist = [...feed.planes].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const near = new Set(byDist.slice(0, ROWS + 1).map((p) => p.hex)); // un puesto de margen
    for (let i = 0; i < ROWS; i++) if (slots[i] && !near.has(slots[i]!)) slots[i] = null;
    for (const p of byDist) {
      const free = slots.indexOf(null);
      if (free < 0) break;
      if (!slots.includes(p.hex)) slots[free] = p.hex;
    }
    rows.forEach((row, i) => {
      const p = feed.planes.find((q) => q.hex === slots[i]);
      if (!p) {
        row.dataset.empty = "";
        delete row.dataset.h;
        return;
      }
      fill(row, p);
    });
    show("live");
  };

  show("connecting", labels.connecting);
  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  }).observe(root);
  watch(onFeed, () => visible);
}
