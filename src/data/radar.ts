// Dónde está centrado el radar y hasta dónde llega.
// Es una posición aproximada (a ~1 km): no se publica la de la antena.
export const radar = {
  center: [27.84, -15.44] as [number, number], // lat, lon
  range: 120, // km; los aviones más lejanos no se dibujan
  // Punto de referencia sobre el mapa: Aeropuerto de Gran Canaria (GCLP).
  airport: { code: "LPA", lat: 27.9319, lon: -15.3866 },
};
