// Lo que la portada sabe del radar antes de que lleguen los aviones:
// el alcance y las costas de las islas, ya proyectadas en km.
import islands from "@/data/islands.json"; // costas de Canarias (Natural Earth, dominio público)
import { radar } from "@/data/radar";
import { round, xy } from "./geo";

export type Scene = { r: number; land: number[][][]; airport: { code: string; x: number; y: number } };

export function scene(): Scene {
  const land = (islands as number[][][])
    .map((ring) =>
      ring.map(([lon, lat]) => {
        const [x, y] = xy(radar.center, lat, lon);
        return [round(x, 1), round(y, 1)];
      }),
    )
    // Solo las islas que caen cerca del radar.
    .filter((ring) => ring.some(([x, y]) => Math.hypot(x, y) < radar.range * 2.2));
  const [x, y] = xy(radar.center, radar.airport.lat, radar.airport.lon);
  return { r: radar.range, land, airport: { code: radar.airport.code, x: round(x, 1), y: round(y, 1) } };
}
