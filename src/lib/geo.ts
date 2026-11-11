// Proyección equirectangular en km alrededor de un centro: a esta escala
// (unos cientos de km) el error es despreciable. x = este, y = sur.
export const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export function xy([lat0, lon0]: [number, number], lat: number, lon: number): [number, number] {
  return [(lon - lon0) * 111.32 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110.57];
}
