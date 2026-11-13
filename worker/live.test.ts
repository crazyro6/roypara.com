// Comprobación de worker/live.ts:  node worker/live.test.ts
import assert from "node:assert/strict";
import { normalize, publicFeed, trails, updateHistory } from "./live.ts";

const center: [number, number] = [27.84, -15.44];
const raw = {
  aircraft: [
    // 0,1° al norte y 0,1° al este: unos 11 km al NE, a 35.000 pies, rumbo este.
    { hex: "4CA2D6", flight: "RYR5LG ", lat: 27.94, lon: -15.34, alt_baro: 35000, gs: 450, track: 90, seen_pos: 1.26 },
    { hex: "3c743a", lat: 27.85, lon: -15.44, alt_baro: "ground", seen_pos: 2 }, // en tierra, sin indicativo
    { hex: "~abcdef", lat: 27.9, lon: -15.4 }, // no es un código ICAO
    { hex: "zzzzzz", lat: 27.9, lon: -15.4 }, // hex inválido
    { hex: "111111", lat: 40, lon: -3 }, // fuera de alcance
    { hex: "222222", lat: 27.9, lon: -15.4, seen_pos: 99 }, // posición vieja
    { hex: "555555", lat: 27.9, lon: -15.4, seen_pos: 65 }, // sin lectura hace más de un minuto: fuera
    { hex: "777777", lat: 27.9, lon: -15.4, seen_pos: 25 }, // 25 s sin posición es normal con una antena casera: se queda
    { hex: "333333", flight: "<script>", lat: 27.9, lon: -15.4 }, // indicativo raro
    { hex: "444444" }, // sin posición
  ],
};

const planes = normalize(raw, center, 120);
assert.deepEqual(planes.map((p) => p.hex), ["4ca2d6", "3c743a", "777777", "333333"]);

const [a, b, , c] = planes; // c: indicativo raro
assert.equal(a.flight, "RYR5LG");
assert.ok(Math.abs(a.x - 9.8) < 0.2 && Math.abs(a.y + 11.1) < 0.2, `posición ${a.x},${a.y}`);
assert.equal(a.z, 10.67); // 35.000 pies
assert.equal(a.seen_pos, 1.3);
assert.ok(Math.abs(a.v[0] - 0.231) < 0.001 && Math.abs(a.v[1]) < 0.001, `velocidad ${a.v}`); // 450 kt al este
assert.equal(b.z, 0);
assert.equal(b.flight, undefined);
assert.deepEqual(b.v, [0, 0]);
assert.equal(c.flight, undefined);
assert.deepEqual(normalize(null, center, 120), []);
assert.deepEqual(normalize({ aircraft: "no" }, center, 120), []);

// Historial: dedupe por distancia, caducidad a los 10 minutos y edades.
let h = updateHistory({}, planes, 1000);
assert.equal(h["4ca2d6"].length, 1);
assert.equal(h["4ca2d6"][0][3], 999); // 1000 - 1,26 redondeado
h = updateHistory(h, planes, 1005); // no se ha movido: no suma
assert.equal(h["4ca2d6"].length, 1);
h = updateHistory(h, [{ ...a, x: a.x + 3, seen_pos: 0 }], 1010);
assert.equal(h["4ca2d6"].length, 2);
h = updateHistory(h, [], 1700); // pasan 10 minutos: todo caduca
assert.deepEqual(h, {});

const t = trails({ ab12cd: [[1, 2, 3, 990]] }, 1000);
assert.deepEqual(t, { ab12cd: [[1, 2, 3, 10]] });

// tar1090: sale tal cual, menos lo que delata la antena; y la ficha lee lo que traiga la Pi.
const tar = {
  now: 1794568732,
  messages: 6210824,
  aircraft: [
    { hex: "4cae69", type: "adsb_icao", flight: "RYR2SQ  ", r: "EI-DWE", t: "B738", desc: "BOEING 737-800 ", ownOp: "Ryanair", alt_baro: 28225, gs: 389, track: 269.56, baro_rate: -1024, lat: 27.909417, lon: -15.392321, seen_pos: 0.331, r_dst: 4.36, r_dir: 35.8, rr_lat: 27.9, rr_lon: -15.4, rssi: -13.2, mlat: [], inventado: 1 },
    { hex: "3c54a4", type: "mode_s", alt_baro: 17175, seen: 15.5 }, // sin posición: sale en la API, no en el radar
    null,
  ],
};
const pub = publicFeed(tar);
assert.equal(pub.now, tar.now);
assert.equal(pub.messages, tar.messages);
assert.equal(pub.aircraft.length, 2);
for (const k of ["r_dst", "r_dir", "rr_lat", "rr_lon", "inventado"]) assert.ok(!(k in pub.aircraft[0]), k + " no debe salir");
const { r_dst, r_dir, rr_lat, rr_lon, inventado, ...rest } = tar.aircraft[0]!;
assert.deepEqual(pub.aircraft[0], rest); // el resto, con sus nombres y valores
assert.deepEqual(publicFeed(null), { now: undefined, messages: undefined, aircraft: [] });

const [ryr, ...others] = normalize(pub, center, 120); // la página normaliza lo que publica la API
assert.equal(others.length, 0);
assert.deepEqual([ryr.hex, ryr.flight, ryr.r, ryr.t, ryr.desc, ryr.ownOp], ["4cae69", "RYR2SQ", "EI-DWE", "B738", "BOEING 737-800", "Ryanair"]);
assert.equal(ryr.z, 8.6); // 28.225 pies

console.log("worker/live.ts: ok");
