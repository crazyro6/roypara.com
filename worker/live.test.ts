// Comprobación de worker/live.ts:  node worker/live.test.ts
import assert from "node:assert/strict";
import { normalize, trails, updateHistory } from "./live.ts";

const center: [number, number] = [27.84, -15.44];
const raw = {
  aircraft: [
    // 0,1° al norte y 0,1° al este: unos 11 km al NE, a 35.000 pies, rumbo este.
    { hex: "4CA2D6", flight: "RYR5LG ", lat: 27.94, lon: -15.34, alt_baro: 35000, gs: 450, track: 90, seen_pos: 1.26 },
    { hex: "3c743a", lat: 27.85, lon: -15.44, altitude: "ground", seen_pos: 2 }, // en tierra, sin indicativo
    { hex: "~abcdef", lat: 27.9, lon: -15.4 }, // no es un código ICAO
    { hex: "zzzzzz", lat: 27.9, lon: -15.4 }, // hex inválido
    { hex: "111111", lat: 40, lon: -3 }, // fuera de alcance
    { hex: "222222", lat: 27.9, lon: -15.4, seen_pos: 99 }, // posición vieja
    { hex: "555555", lat: 27.9, lon: -15.4, seen_pos: 25 }, // sin lectura hace 25 s: fuera
    { hex: "666666", lat: 27.9, lon: -15.4, speed: 450, track: 90 }, // dump1090 antiguo: speed en vez de gs
    { hex: "333333", flight: "<script>", lat: 27.9, lon: -15.4 }, // indicativo raro
    { hex: "444444" }, // sin posición
  ],
};

const planes = normalize(raw, center, 120);
assert.deepEqual(planes.map((p) => p.h), ["4ca2d6", "3c743a", "666666", "333333"]);

const [a, b, d, c] = planes; // d: speed antiguo, c: indicativo raro
assert.equal(a.f, "RYR5LG");
assert.ok(Math.abs(a.x - 9.8) < 0.2 && Math.abs(a.y + 11.1) < 0.2, `posición ${a.x},${a.y}`);
assert.equal(a.z, 10.67); // 35.000 pies
assert.equal(a.s, 1.3);
assert.ok(Math.abs(a.v[0] - 0.231) < 0.001 && Math.abs(a.v[1]) < 0.001, `velocidad ${a.v}`); // 450 kt al este
assert.equal(b.z, 0);
assert.equal(b.f, undefined);
assert.deepEqual(b.v, [0, 0]);
assert.equal(c.f, undefined);
assert.ok(Math.abs(d.v[0] - 0.231) < 0.001 && d.v[1] === 0, `speed antiguo ${d.v}`);
assert.deepEqual(normalize(null, center, 120), []);
assert.deepEqual(normalize({ aircraft: "no" }, center, 120), []);

// Historial: dedupe por distancia, caducidad a los 10 minutos y edades.
let h = updateHistory({}, planes, 1000);
assert.equal(h["4ca2d6"].length, 1);
assert.equal(h["4ca2d6"][0][3], 999); // 1000 - 1,26 redondeado
h = updateHistory(h, planes, 1005); // no se ha movido: no suma
assert.equal(h["4ca2d6"].length, 1);
h = updateHistory(h, [{ ...a, x: a.x + 3, s: 0 }], 1010);
assert.equal(h["4ca2d6"].length, 2);
h = updateHistory(h, [], 1700); // pasan 10 minutos: todo caduca
assert.deepEqual(h, {});

const t = trails({ ab12cd: [[1, 2, 3, 990]] }, 1000);
assert.deepEqual(t, { ab12cd: [[1, 2, 3, 10]] });

console.log("worker/live.ts: ok");
