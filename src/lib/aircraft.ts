// Ficha de cada avión. Matrícula y modelo salen de la Pi si tiene la base de
// datos de aviones; la aerolínea y la ruta, de HexDB; la foto, de Planespotters.
// Lo que falte en un sitio se busca en el otro. Se pide una vez por avión.
import type { Plane } from "../../worker/live";

export type Info = Record<"airline" | "model" | "reg" | "route" | "photo" | "photoLink" | "photographer", string | null>;

const json = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
const https = (url: unknown) => (typeof url === "string" && url.startsWith("https://") ? url : null);

const routes = new Map<string, Promise<string | null>>();
/** Ruta de un vuelo por su indicativo, p. ej. «LGW → TFS». Vale null si HexDB no la tiene. */
export const routeOf = (flight: string) => {
  if (!routes.has(flight)) {
    routes.set(
      flight,
      json(`https://hexdb.io/api/v1/route/iata/${encodeURIComponent(flight)}`).then((r) =>
        typeof r?.route === "string" ? r.route.replace("-", " → ") : null,
      ),
    );
  }
  return routes.get(flight)!;
};

const infos = new Map<string, Promise<Info>>();
/** Ficha completa de un avión a partir de lo que manda la Pi. */
export const lookup = ({ hex, flight, r, t, desc, ownOp }: Pick<Plane, "hex" | "flight" | "r" | "t" | "desc" | "ownOp">) => {
  if (!infos.has(hex)) {
    infos.set(
      hex,
      Promise.all([
        json(`https://hexdb.io/api/v1/aircraft/${hex.toUpperCase()}`),
        flight ? routeOf(flight) : null,
        json(`https://api.planespotters.net/pub/photos/hex/${hex}`),
      ]).then(([ac, route, photos]) => {
        const photo = photos?.photos?.[0];
        return {
          airline: ac?.RegisteredOwners || ownOp || null, // manda HexDB; la Pi, de respaldo
          model: desc || ac?.Type || t || ac?.ICAOTypeCode || null,
          reg: r || ac?.Registration || null,
          route,
          photo: https(photo?.thumbnail_large?.src),
          photoLink: https(photo?.link),
          photographer: photo?.photographer || null,
        };
      }),
    );
  }
  return infos.get(hex)!;
};
