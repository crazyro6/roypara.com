// Contribuciones de GitHub del último año, obtenidas en tiempo de build.
// Si la API no responde, devuelve null y la sección no se renderiza.

export type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type Contributions = { total: number; days: Day[] };

const cache = new Map<string, Promise<Contributions | null>>();

export function getContributions(user: string): Promise<Contributions | null> {
  if (!cache.has(user)) cache.set(user, load(user));
  return cache.get(user)!;
}

async function load(user: string): Promise<Contributions | null> {
  try {
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      total: { lastYear: number };
      contributions: Day[];
    };
    if (!Array.isArray(json.contributions) || json.contributions.length === 0) {
      throw new Error("sin datos");
    }
    return { total: json.total.lastYear, days: json.contributions };
  } catch (err) {
    console.warn(`[github] No se pudieron cargar las contribuciones: ${err}`);
    return null;
  }
}
