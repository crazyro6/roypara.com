// Radar 3D en canvas: reproduce a cámara rápida los vuelos grabados.
// Cada avión vuela por su ruta a su altitud real (unida al suelo por una
// línea fina) y deja una estela que se desvanece. La vista empieza cenital
// y se inclina; después deriva despacio y sigue un poco al puntero.

import type { Scene } from "./flights";

const PLAY = 55; // segundos reales que dura una vuelta de la captura
const TRAIL = 600; // segundos de captura que dura la estela
const PITCH = 1.1; // inclinación final, en radianes desde la vista cenital
const ZX = 5; // exageración de la altitud para que se lea
const CAM = 3.2; // distancia de la cámara, en radios del radar

/** Posición interpolada de una ruta en el instante t; null si no está en el aire. */
export function at(p: number[][], t: number): number[] | null {
  if (t < p[0][3] || t > p[p.length - 1][3]) return null;
  let i = 1;
  while (p[i][3] < t) i++;
  const a = p[i - 1];
  const b = p[i];
  const k = (t - a[3]) / (b[3] - a[3] || 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, t];
}

export function mount(root: HTMLElement) {
  const canvas = root.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const data: Scene = JSON.parse(root.querySelector("script")!.textContent!);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hud = root.closest("section, main");
  const clockEl = hud?.querySelector<HTMLElement>("[data-radar-clock]");
  const countEl = hud?.querySelector<HTMLElement>("[data-radar-count]");
  const clock = new Intl.DateTimeFormat(root.dataset.locale, {
    timeZone: root.dataset.tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

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

  // Puntero, en píxeles del canvas.
  let mx = -1e4;
  let my = -1e4;
  addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  });

  // Cámara actual (se actualiza en cada fotograma).
  let sinYaw = 0;
  let cosYaw = 1;
  let sinPitch = 0;
  let cosPitch = 1;
  let zk = 0;
  const proj = (x: number, y: number, z: number): [number, number] => {
    const xr = x * cosYaw - y * sinYaw;
    const yr = x * sinYaw + y * cosYaw;
    const zz = z * zk;
    const s = (CAM * R) / (CAM * R - yr * sinPitch - zz * cosPitch); // perspectiva
    return [cx + xr * s * k, cy + (yr * cosPitch - zz * sinPitch) * s * k];
  };

  const line = (a: [number, number], b: [number, number], alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const dot = (p: [number, number], r: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, 7);
    ctx.fill();
  };
  const ring = (r: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const [X, Y] = proj(Math.sin(a) * r, -Math.cos(a) * r, 0);
      if (i) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    }
    ctx.stroke();
  };

  const t0 = performance.now();
  let yawP = 0;
  let pitchP = 0;
  let hudAt = 0;

  const draw = (now: number) => {
    const el = (now - t0) / 1000;
    const ease = (s: number) => (still ? 1 : 1 - (1 - Math.min(1, el / s)) ** 3);
    const intro = ease(2.8);
    const grow = ease(1.8);
    const u = still ? 1 : (el / PLAY) % 1;
    const T = u * data.dur;
    // Al final de cada vuelta todo se desvanece y vuelve a empezar.
    const env = still ? 1 : Math.min(1, (u * PLAY) / 1.5, ((1 - u) * PLAY) / 1.5);

    const inside = mx >= 0 && mx <= w && my >= 0 && my <= h;
    yawP += ((inside ? (mx / w - 0.5) * 0.45 : 0) - yawP) * 0.04;
    pitchP += ((inside ? (my / h - 0.5) * -0.12 : 0) - pitchP) * 0.04;
    const yaw = 0.35 + (still ? 0 : Math.sin(el / 9) * 0.22) + yawP;
    const pitch = PITCH * intro + pitchP * intro;
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

    // Suelo: anillos que crecen desde el receptor, la N y un pulso.
    for (let i = 1; i <= 4; i++) ring(((R * i) / 4) * grow, i === 4 ? 0.26 : 0.1);
    if (!still) {
      const q = (el % 5) / 5;
      ring(R * q, (1 - q) * 0.2);
    }
    const n = proj(0, -R * 1.09 * grow, 0);
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.5 * intro;
    ctx.fillText("N", n[0], n[1]);
    dot(proj(0, 0, 0), 2, 0.9);

    let active = 0;
    ctx.textAlign = "left";
    for (const { f, p } of data.tracks) {
      const pos = at(p, T) ?? (still ? p[p.length - 1] : null);
      if (!pos) continue;
      active++;

      // Estela: más tenue cuanto más vieja.
      let prev: [number, number] | null = null;
      for (const q of p) {
        if (q[3] > pos[3]) break;
        const age = pos[3] - q[3];
        if (!still && age > TRAIL) continue;
        const pt = proj(q[0], q[1], q[2]);
        if (prev) line(prev, pt, env * 0.55 * (still ? 0.6 : 1 - age / TRAIL));
        prev = pt;
      }
      const head = proj(pos[0], pos[1], pos[2]);
      if (prev) line(prev, head, env * 0.55);

      // Altitud: línea hasta el suelo y su marca.
      const foot = proj(pos[0], pos[1], 0);
      line(head, foot, env * 0.2);
      dot(foot, 1.2, env * 0.35);

      // El avión: el único color de la escena.
      ctx.fillStyle = ctx.shadowColor = amber;
      ctx.shadowBlur = 12;
      dot(head, 2.6, env);
      ctx.shadowBlur = 0;
      ctx.fillStyle = ink;

      // Indicativo: al entrar en escena, y al acercar el puntero (con altitud).
      if (f) {
        const near = Math.hypot(head[0] - mx, head[1] - my) < 48;
        const fresh = still ? 0 : Math.min(1, Math.max(0, 1 - (pos[3] - p[0][3]) / 240) * 3);
        const alpha = near ? 1 : fresh;
        if (alpha > 0.02) {
          ctx.globalAlpha = env * alpha * 0.85;
          ctx.fillText(near ? `${f} · ${Math.round(pos[2] * 10) * 100} m` : f, head[0] + 9, head[1] - 9);
        }
      }
    }
    ctx.globalAlpha = 1;

    if (data.tracks.length && now - hudAt > 200) {
      hudAt = now;
      if (clockEl) clockEl.textContent = clock.format(data.from + T * 1000);
      if (countEl) countEl.textContent = String(active);
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

  if (still) return;
  // Fuera de pantalla no se dibuja.
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const loop = (now: number) => {
    if (visible) draw(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (import.meta.env.DEV) {
  const p = [
    [0, 0, 0, 0],
    [10, 0, 2, 10],
  ];
  const mid = at(p, 5);
  console.assert(mid?.[0] === 5 && mid?.[2] === 1 && at(p, 11) === null && at(p, -1) === null, "radar: at()");
}
