// Radar 3D en directo, en canvas y sin librerías. Cada pocos segundos pide
// a /api/aviones los aviones que capta mi antena y los dibuja sobre el mapa
// de las islas, a su altitud, con estela y una línea hasta el suelo. Entre
// dos lecturas se mueven por su rumbo y velocidad. La vista se inclina al
// cargar, se gira arrastrando y, al pulsar un avión, se abre su ficha.

import type { Scene } from "./sky";

const TRAIL = 360; // segundos de estela
const PITCH = 1.1; // inclinación final, en radianes desde la vista cenital
const ZX = 5; // exageración de la altitud para que se lea
const CAM = 3.2; // distancia de la cámara, en radios del radar
const PICK = 22; // radio en px para pulsar un avión
const POLL = 5; // segundos entre lecturas
const POLL_OFFLINE = 15; // y cuando la antena no responde
const HOLD = 15; // segundos máximos de extrapolación sin lectura nueva
const STALE = 14; // sin lectura durante tanto, el avión empieza a desvanecerse
const FADE = 6; // y tarda esto en desaparecer

type XY = [number, number];
type State = "connecting" | "live" | "quiet" | "offline";
type Wire = { h: string; f?: string; x: number; y: number; z: number; s: number; v: XY };
type Plane = {
  h: string;
  f?: string;
  p: number[][]; // lecturas: x, y, z (km), t (s desde que se abrió la página)
  v: XY; // km/s
  born: number;
  hv: number; // 0..1: cuánto está "tocado" por el puntero; sube rápido y baja despacio
  ox: number; // corrección que se disuelve al llegar una lectura nueva
  oy: number;
  to: number;
};

/** Dónde está un avión en el instante T según su última lectura y su velocidad. */
export function predict(last: number[], v: XY, T: number): XY {
  const dt = Math.min(Math.max(T - last[3], 0), HOLD);
  return [last[0] + v[0] * dt, last[1] + v[1] * dt];
}

/** Hover suavizado: sube rápido al tocarlo y baja despacio al apartar el ratón. */
export function hover(hv: number, aim: number, dt: number): number {
  return hv + (aim - hv) * (1 - Math.exp(-dt * (aim ? 14 : 5)));
}

// Ficha del avión: las mismas APIs públicas que uso en mi radar ADS-B.
const json = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
const https = (url: unknown) => (typeof url === "string" && url.startsWith("https://") ? url : null);
const lookups = new Map<string, Promise<Record<string, string | null>>>();
const lookup = (pl: Plane) => {
  if (!lookups.has(pl.h)) {
    lookups.set(
      pl.h,
      Promise.all([
        json(`https://hexdb.io/api/v1/aircraft/${pl.h.toUpperCase()}`),
        pl.f ? json(`https://hexdb.io/api/v1/route/iata/${encodeURIComponent(pl.f)}`) : null,
        json(`https://api.planespotters.net/pub/photos/hex/${pl.h}`),
      ]).then(([ac, route, photos]) => {
        const photo = photos?.photos?.[0];
        return {
          airline: ac?.RegisteredOwners || null,
          model: ac?.Type || ac?.ICAOTypeCode || null,
          reg: ac?.Registration || null,
          route: typeof route?.route === "string" ? route.route.replace("-", " → ") : null,
          photo: https(photo?.thumbnail_large?.src),
          photoLink: https(photo?.link),
          photographer: photo?.photographer || null,
        };
      }),
    );
  }
  return lookups.get(pl.h)!;
};

export function mount(root: HTMLElement) {
  const canvas = root.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const data: Scene & { live: boolean; labels: Record<State, string> } = JSON.parse(
    root.querySelector("script")!.textContent!,
  );
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const locale = root.dataset.locale;

  const stage = root.closest<HTMLElement>("section, main") ?? root;
  const statusEl = stage.querySelector<HTMLElement>("[data-radar-status]");
  const card = stage.querySelector<HTMLElement>("[data-flight-card]");
  const field = (name: string) => card?.querySelector<HTMLElement>(`[data-f="${name}"]`);

  const css = getComputedStyle(root);
  const ink = css.getPropertyValue("--scope-ink").trim() || "#fff";
  const amber = css.getPropertyValue("--track").trim() || "#fb3";
  const R = data.r;

  // Tamaño y encuadre: --cx/--cy (centro) y --rw/--rh (radio máximo) son
  // fracciones del ancho y el alto, definidas en CSS por quien lo usa.
  let w = 0;
  let h = 0;
  let cx = 0;
  let cy = 0;
  let k = 1;
  const frac = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback;

  const t0 = performance.now();
  const clock = () => (performance.now() - t0) / 1000;

  // ---------------------------------------------------------------- datos
  const planes = new Map<string, Plane>();
  let history: Record<string, number[][]> = {}; // estelas recientes, por avión
  let state: State = "connecting";

  const setState = (next: State, n = 0) => {
    state = next;
    stage.dataset.radarState = next;
    if (!statusEl) return;
    statusEl.textContent = data.labels[next].replace("{n}", String(n));
    const shell = statusEl.closest<HTMLElement>("[hidden]");
    if (shell) shell.hidden = false;
  };

  const merge = (pl: Plane) => {
    const old = history[pl.h];
    if (!old) return;
    const first = pl.p[0][3];
    const earlier = old.map(([x, y, z, age]) => [x, y, z, historyAt - age]).filter((q) => q[3] < first);
    pl.p = [...earlier, ...pl.p];
    delete history[pl.h];
  };
  let historyAt = 0;

  const ingest = (list: Wire[], ta: number) => {
    const seen = new Set<string>();
    for (const a of list) {
      seen.add(a.h);
      const ts = ta - a.s;
      const fix = [a.x, a.y, a.z, ts];
      let pl = planes.get(a.h);
      if (!pl) {
        pl = { h: a.h, f: a.f, p: [fix], v: a.v, born: ta, hv: 0, ox: 0, oy: 0, to: ta };
        planes.set(a.h, pl);
        merge(pl);
        continue;
      }
      pl.f ??= a.f;
      pl.v = a.v;
      const last = pl.p.at(-1)!;
      // dump1090 repite la última posición hasta que llega otra: eso no es una lectura nueva.
      if (ts <= last[3] || Math.hypot(a.x - last[0], a.y - last[1]) < 0.05) continue;
      const [cxp, cyp] = display(pl, ta); // dónde se veía hace un instante
      pl.p.push(fix);
      const [nx, ny] = predict(fix, pl.v, ta);
      pl.ox = cxp - nx;
      pl.oy = cyp - ny;
      pl.to = ta;
    }
    // Los que ya no vienen se quedan hasta desvanecerse; después se olvidan.
    for (const [hex, pl] of planes) if (!seen.has(hex) && ta - pl.p.at(-1)![3] > STALE + FADE) planes.delete(hex);
  };

  /** Posición dibujada: la prevista más una corrección que se disuelve en ~1 s. */
  function display(pl: Plane, T: number): XY {
    const [x, y] = predict(pl.p.at(-1)!, pl.v, T);
    const e = Math.exp(-(T - pl.to) / 0.8);
    return [x + pl.ox * e, y + pl.oy * e];
  }

  const alpha = (pl: Plane, T: number) => {
    const born = still ? 1 : Math.min(1, (T - pl.born) / 1.2);
    const idle = T - pl.p.at(-1)![3] - STALE;
    return born * (idle > 0 ? Math.max(0, 1 - idle / FADE) : 1);
  };

  // --------------------------------------------------------------- sondeo
  let failures = 0;
  let busy = false;
  let timer: number | undefined;
  let visible = true;

  const poll = async () => {
    clearTimeout(timer);
    timer = undefined;
    if (busy) return;
    busy = true;
    try {
      const res = await fetch("/api/aviones");
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { planes: Wire[] };
      failures = 0;
      ingest(body.planes, clock());
      const n = visibleCount(clock());
      setState(n ? "live" : "quiet", n);
    } catch {
      // Un fallo suelto puede ser la red; dos seguidos, la antena no responde.
      if (++failures >= 2 || state === "offline") {
        planes.clear();
        setState("offline");
      }
    } finally {
      busy = false;
      if (still) draw(performance.now());
      schedule();
    }
  };
  const schedule = () => {
    if (!visible || document.hidden || timer !== undefined) return;
    timer = window.setTimeout(poll, (state === "offline" ? POLL_OFFLINE : POLL) * 1000);
  };
  const visibleCount = (T: number) => [...planes.values()].filter((pl) => alpha(pl, T) > 0.05).length;

  const loadHistory = async () => {
    const body = (await json("/api/estelas")) as { tracks?: Record<string, number[][]> } | null;
    if (!body?.tracks) return;
    history = body.tracks;
    historyAt = clock();
    for (const pl of planes.values()) merge(pl);
  };

  // ------------------------------------------------------------- interacción
  let mx = -1e4;
  let my = -1e4;
  let drag: { moved: number } | null = null;
  let yawUser = 0;
  let pitchUser = 0;
  let heads: { at: XY; plane: Plane; z: number }[] = [];
  let picked: Plane | null = null;
  const nearest = () => {
    let best: (typeof heads)[number] | null = null;
    let d = PICK;
    for (const hd of heads) {
      const dist = Math.hypot(hd.at[0] - mx, hd.at[1] - my);
      if (dist < d) [best, d] = [hd, dist];
    }
    return best;
  };
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  };

  const select = (plane: Plane | null) => {
    picked = plane;
    if (!card) return;
    card.hidden = !plane;
    if (!plane) return;
    for (const name of ["route", "airline", "model", "reg"]) field(name)!.textContent = "…";
    field("callsign")!.textContent = plane.f ?? plane.h.toUpperCase();
    const img = field("photo") as HTMLImageElement;
    const credit = field("credit") as HTMLAnchorElement;
    img.hidden = credit.hidden = true;
    lookup(plane).then((info) => {
      if (picked !== plane) return;
      for (const name of ["route", "airline", "model", "reg"]) field(name)!.textContent = info[name] ?? "—";
      field("route")!.hidden = !info.route; // sin ruta, un guion grande no aporta nada
      if (info.photo) {
        img.src = info.photo;
        img.hidden = false;
        // Planespotters pide citar al autor y enlazar la foto.
        credit.textContent = `© ${info.photographer ?? "Planespotters"}`;
        credit.href = info.photoLink ?? "https://www.planespotters.net";
        credit.hidden = false;
      }
    });
  };
  card?.querySelector("[data-flight-close]")?.addEventListener("click", () => select(null));
  addEventListener("keydown", (e) => e.key === "Escape" && select(null));

  addEventListener("pointermove", (e) => {
    const px = mx;
    const py = my;
    local(e);
    if (!drag) return;
    drag.moved += Math.abs(mx - px) + Math.abs(my - py);
    yawUser -= (mx - px) * 0.006;
    pitchUser = Math.max(-0.5, Math.min(0.35, pitchUser - (my - py) * 0.003));
    if (still) draw(performance.now());
  });
  stage.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest("a, button, [data-no-drag]")) return;
    local(e);
    drag = { moved: 0 };
  });
  addEventListener("pointerup", (e) => {
    if (!drag) return;
    local(e);
    // Sin arrastre es una pulsación: elige el avión que haya debajo.
    if (drag.moved < 6) select(nearest()?.plane ?? null);
    drag = null;
    if (still) draw(performance.now());
  });
  addEventListener("pointercancel", () => (drag = null));

  // ---------------------------------------------------------------- cámara
  let sinYaw = 0;
  let cosYaw = 1;
  let sinPitch = 0;
  let cosPitch = 1;
  let zk = 0;
  const proj = (x: number, y: number, z: number): XY => {
    const xr = x * cosYaw - y * sinYaw;
    const yr = x * sinYaw + y * cosYaw;
    const zz = z * zk;
    const s = (CAM * R) / (CAM * R - yr * sinPitch - zz * cosPitch); // perspectiva
    return [cx + xr * s * k, cy + (yr * cosPitch - zz * sinPitch) * s * k];
  };

  const line = (a: XY, b: XY, a0: number) => {
    ctx.globalAlpha = a0;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const dot = (p: XY, r: number, a0: number) => {
    ctx.globalAlpha = a0;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, 7);
    ctx.fill();
  };
  const ring = (r: number, a0: number) => {
    ctx.globalAlpha = a0;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const [X, Y] = proj(Math.sin(a) * r, -Math.cos(a) * r, 0);
      if (i) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    }
    ctx.stroke();
  };

  let yawP = 0;
  let pitchP = 0;
  let hudAt = 0;
  let lastDraw = performance.now();

  const draw = (now: number) => {
    const dt = Math.min(0.1, (now - lastDraw) / 1000);
    lastDraw = now;
    const el = (now - t0) / 1000;
    const T = el;
    const ease = (s: number) => (still ? 1 : 1 - (1 - Math.min(1, el / s)) ** 3);
    const intro = ease(2.8);
    const grow = ease(1.8);

    // La vista sigue un poco al puntero, salvo mientras se arrastra.
    const follow = !drag && mx >= 0 && mx <= w && my >= 0 && my <= h;
    yawP += ((follow ? (mx / w - 0.5) * 0.3 : 0) - yawP) * 0.04;
    pitchP += ((follow ? (my / h - 0.5) * -0.1 : 0) - pitchP) * 0.04;
    const yaw = 0.35 + (still ? 0 : Math.sin(el / 9) * 0.18) + yawP + yawUser;
    const pitch = (PITCH + pitchP + pitchUser) * intro;
    sinYaw = Math.sin(yaw);
    cosYaw = Math.cos(yaw);
    sinPitch = Math.sin(pitch);
    cosPitch = Math.cos(pitch);
    zk = ZX * intro;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ctx.fillStyle = ink;
    ctx.font = "11px B612, sans-serif";
    ctx.textBaseline = "middle";

    // Suelo: las islas, los anillos que crecen desde el receptor, la N y un pulso.
    for (const coast of data.land) {
      ctx.beginPath();
      for (const [x, y] of coast) {
        const [X, Y] = proj(x, y, 0);
        ctx.lineTo(X, Y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.06 * grow;
      ctx.fill();
      ctx.globalAlpha = 0.4 * grow;
      ctx.stroke();
    }
    for (let i = 1; i <= 4; i++) ring(((R * i) / 4) * grow, i === 4 ? 0.24 : 0.09);
    if (!still && state !== "offline") {
      const q = (el % 5) / 5;
      ring(R * q, (1 - q) * 0.18);
    }
    const n = proj(0, -R * 1.09 * grow, 0);
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.5 * intro;
    ctx.fillText("N", n[0], n[1]);

    // Punto de referencia: el aeropuerto, con un avión visto desde arriba.
    const [ax, ay] = proj(data.airport.x, data.airport.y, 0);
    const s = 4.5;
    ctx.globalAlpha = 0.75 * grow;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay - 1.4 * s); // fuselaje
    ctx.lineTo(ax, ay + 1.1 * s);
    ctx.moveTo(ax - 1.4 * s, ay + 0.25 * s); // alas
    ctx.lineTo(ax, ay - 0.35 * s);
    ctx.lineTo(ax + 1.4 * s, ay + 0.25 * s);
    ctx.moveTo(ax - 0.6 * s, ay + 1.1 * s); // cola
    ctx.lineTo(ax, ay + 0.75 * s);
    ctx.lineTo(ax + 0.6 * s, ay + 1.1 * s);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22 * grow;
    ctx.beginPath();
    ctx.arc(ax, ay, 11, 0, 7);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.globalAlpha = 0.7 * grow;
    ctx.fillText(data.airport.code, ax + 17, ay);

    heads = [];
    ctx.textAlign = "left";
    for (const pl of planes.values()) {
      const a0 = alpha(pl, T);
      if (a0 <= 0.01) continue;
      const last = pl.p.at(-1)!;
      const [x, y] = display(pl, T);
      const z = last[2];

      // Estela: más tenue cuanto más vieja.
      let prev: XY | null = null;
      for (const q of pl.p) {
        const age = T - q[3];
        if (age > TRAIL) continue;
        const pt = proj(q[0], q[1], q[2]);
        if (prev) line(prev, pt, a0 * 0.55 * (1 - age / TRAIL));
        prev = pt;
      }
      const head = proj(x, y, z);
      if (prev) line(prev, head, a0 * 0.55);
      heads.push({ at: head, plane: pl, z });

      // Altitud: línea hasta el suelo y su marca.
      const foot = proj(x, y, 0);
      line(head, foot, a0 * 0.2);
      dot(foot, 1.2, a0 * 0.35);

      // Hover: entra rápido y sale despacio, así que al apartar el ratón el
      // aro se encoge y el indicativo se desvanece en vez de cortarse.
      const aim = pl === picked || Math.hypot(head[0] - mx, head[1] - my) < PICK ? 1 : 0;
      pl.hv = still ? aim : hover(pl.hv, aim, dt);
      if (pl.hv > 0.01) {
        ctx.globalAlpha = a0 * 0.75 * pl.hv;
        ctx.beginPath();
        ctx.arc(head[0], head[1], 4 + 8 * pl.hv, 0, 7);
        ctx.stroke();
      }
      if (pl === picked) {
        ctx.globalAlpha = a0 * 0.35;
        ctx.beginPath();
        ctx.arc(head[0], head[1], 16, 0, 7);
        ctx.stroke();
      }

      // El avión: el único color de la escena.
      ctx.fillStyle = ctx.shadowColor = amber;
      ctx.shadowBlur = 12 + 6 * pl.hv;
      dot(head, 2.6 + 1.4 * pl.hv, a0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = ink;

      // Indicativo: al aparecer o al tocarlo; se desliza un poco al entrar.
      if (pl.f) {
        const fresh = still ? 0 : Math.min(1, Math.max(0, 1 - (T - pl.born) / 8) * 3);
        const a1 = Math.max(fresh, pl.hv);
        if (a1 > 0.02) {
          ctx.globalAlpha = a0 * a1 * 0.85;
          ctx.fillText(pl.f, head[0] + 8 + 6 * a1, head[1] - 9);
        }
      }
    }
    ctx.globalAlpha = 1;

    stage.style.cursor = drag ? "grabbing" : nearest() ? "pointer" : "";
    const chosen = picked && heads.find((hd) => hd.plane === picked);
    if (picked && !chosen) select(null); // se fue de escena

    if (now - hudAt > 400) {
      hudAt = now;
      if (state === "live" || state === "quiet") {
        const count = heads.length;
        setState(count ? "live" : "quiet", count);
      }
      if (chosen) {
        const [vx, vy] = chosen.plane.v;
        const kmh = Math.hypot(vx, vy) * 3600;
        field("alt")!.textContent = `${(Math.round(chosen.z * 10) * 100).toLocaleString(locale)} m`;
        field("speed")!.textContent = kmh ? `${Math.round(kmh)} km/h` : "—";
        field("heading")!.textContent = kmh ? `${Math.round((Math.atan2(vx, -vy) * 180) / Math.PI + 360) % 360}°` : "—";
      }
    }
  };

  new ResizeObserver(() => {
    const dpr = Math.min(devicePixelRatio, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w * frac("--cx", 0.5);
    cy = h * frac("--cy", 0.5);
    k = Math.min(w * frac("--rw", 0.45), h * frac("--rh", 0.45)) / R;
    if (still) draw(performance.now());
  }).observe(canvas);

  // Fuera de pantalla o con la pestaña oculta no se dibuja ni se pregunta a la antena.
  const resume = () => {
    if (visible && !document.hidden && data.live) poll();
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) resume();
    else select(null);
  }).observe(canvas);
  document.addEventListener("visibilitychange", resume);

  if (data.live) {
    setState("connecting");
    loadHistory().then(() => poll());
  }
  if (still) return;
  const loop = (now: number) => {
    if (visible) draw(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (import.meta.env.DEV) {
  const x = predict([0, 0, 0, 0], [0.1, -0.2], 5);
  console.assert(x[0] === 0.5 && x[1] === -1, "radar: predict()");
  const y = predict([0, 0, 0, 0], [0.1, 0], 60); // se corta en HOLD
  console.assert(y[0] === 0.1 * 15 && predict([1, 1, 0, 9], [1, 1], 3)[0] === 1, "radar: predict() HOLD / pasado");
  // Al apartar el ratón baja de forma gradual (1 → 0,37 → 0,14), nunca de golpe ni por debajo de 0.
  const a = hover(1, 0, 0.2);
  const b = hover(a, 0, 0.2);
  console.assert(Math.abs(a - 0.368) < 0.01 && b < a && b > 0.1 && hover(0, 1, 0.1) > 0.7, "radar: hover()");
}
