#!/usr/bin/env python3
"""Graba las trayectorias que capta el receptor ADS-B para el radar de la web.

Se ejecuta en la Raspberry Pi (solo usa la librería estándar de Python 3):

    python3 capture-flights.py --minutes 60

Lee el aircraft.json de dump1090 / SkyAware / tar1090 cada pocos segundos y,
al terminar (o con Ctrl+C), escribe flights.json. Copia ese archivo a
src/data/flights.json en el repo de la web y vuelve a desplegar.

Cada punto es [lat, lon, altitud en pies, segundos desde el inicio].
No guarda el código hex de los aviones, solo el indicativo y las posiciones.
La posición del receptor se redondea a 2 decimales (~1 km).
"""

import argparse
import json
import time
import urllib.request
from datetime import datetime, timezone

CANDIDATES = [
    "http://localhost:8080/data",  # dump1090-fa / SkyAware
    "http://localhost/skyaware/data",
    "http://localhost/tar1090/data",
    "http://localhost/dump1090/data",
]


def fetch(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.load(r)


def find_base(explicit):
    for base in [explicit] if explicit else CANDIDATES:
        try:
            fetch(f"{base}/aircraft.json")
            return base
        except Exception:
            continue
    raise SystemExit("No encuentro aircraft.json. Pasa la ruta con --base, p. ej. http://localhost:8080/data")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", help="URL de la carpeta que contiene aircraft.json")
    ap.add_argument("--minutes", type=float, default=60)
    ap.add_argument("--interval", type=float, default=5, help="segundos entre lecturas")
    ap.add_argument("--out", default="flights.json")
    args = ap.parse_args()

    base = find_base(args.base)
    center = None
    try:
        rec = fetch(f"{base}/receiver.json")
        if "lat" in rec and "lon" in rec:
            center = [round(rec["lat"], 2), round(rec["lon"], 2)]
    except Exception:
        pass

    tracks = {}  # hex -> {"flight": str, "points": [[lat, lon, alt, t], ...]}
    start = datetime.now(timezone.utc)
    began = time.monotonic()
    end_at = began + args.minutes * 60
    print(f"Grabando desde {base} durante {args.minutes:g} min (Ctrl+C para parar antes)…")

    try:
        while time.monotonic() < end_at:
            try:
                data = fetch(f"{base}/aircraft.json")
            except Exception as e:
                print("Lectura fallida:", e)
                time.sleep(args.interval)
                continue
            for a in data.get("aircraft", []):
                if "lat" not in a or "lon" not in a or a.get("seen_pos", 99) > 10:
                    continue
                t = tracks.setdefault(a["hex"], {"flight": "", "points": []})
                if a.get("flight", "").strip():
                    t["flight"] = a["flight"].strip()
                alt = a.get("alt_baro", a.get("alt_geom"))
                alt = 0 if alt == "ground" else alt if isinstance(alt, (int, float)) else None
                p = [round(a["lat"], 3), round(a["lon"], 3), alt, round(time.monotonic() - began)]
                if not t["points"] or t["points"][-1][:2] != p[:2]:
                    t["points"].append(p)
            print(f"\r{len(tracks)} aviones vistos", end="", flush=True)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass

    out = {
        "from": start.isoformat(timespec="seconds"),
        "to": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        **({"center": center} if center else {}),
        "tracks": [
            {**({"flight": t["flight"]} if t["flight"] else {}), "points": t["points"]}
            for t in tracks.values()
            if len(t["points"]) >= 3
        ],
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"\nGuardadas {len(out['tracks'])} trayectorias en {args.out}")


if __name__ == "__main__":
    main()
