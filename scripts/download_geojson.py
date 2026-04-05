#!/usr/bin/env python3
"""
OEVK GeoJSON térkép letöltése és generálása.

Adatforrás:
- static.valasztas.hu/dyn/oevk_data/oevk.json — OEVK boundary poligonok
- vtr.valasztas.hu/stat/data/oevk/OevkAdatok-{maz}.json — poligonok + település adatok

A valasztas.hu oevk.json-ban a poligonok saját formátumban vannak,
nem standard GeoJSON-ban. Ez a script konvertálja GeoJSON FeatureCollection-né.

Futtatás:
    cd scripts && python download_geojson.py
"""

import json
from pathlib import Path
from common import log, download_file

OEVK_JSON_URL = "https://static.valasztas.hu/dyn/oevk_data/oevk.json"
OUTPUT_PATH = Path(__file__).parent.parent / "frontend" / "src" / "data" / "hungary-oevk.json"

# Megye nevek kódokhoz
COUNTY_NAMES = {
    "01": "Budapest", "02": "Baranya", "03": "Bács-Kiskun", "04": "Békés",
    "05": "Borsod-Abaúj-Zemplén", "06": "Csongrád-Csanád", "07": "Fejér",
    "08": "Győr-Moson-Sopron", "09": "Hajdú-Bihar", "10": "Heves",
    "11": "Jász-Nagykun-Szolnok", "12": "Komárom-Esztergom", "13": "Nógrád",
    "14": "Pest", "15": "Somogy", "16": "Szabolcs-Szatmár-Bereg",
    "17": "Tolna", "18": "Vas", "19": "Veszprém", "20": "Zala",
}


def parse_polygon_string(poly_str: str) -> list[list[list[float]]]:
    """
    Valasztas.hu poligon string → GeoJSON koordináták.

    A valasztas.hu formátum: "lat1 lng1,lat2 lng2,lat3 lng3,..."
    - Vesszővel elválasztott koordinátapárok
    - Szóközzel elválasztott lat és lng a páron belül
    - Több gyűrű ";" vagy "|" karakterrel elválasztva (MultiPolygon esetén)
    """
    if not poly_str or not poly_str.strip():
        return []

    rings = []
    # Több gyűrű elválasztó detektálás
    separators = ["|", ";"]
    parts = [poly_str]
    for sep in separators:
        if sep in poly_str:
            parts = poly_str.split(sep)
            break

    for part in parts:
        part = part.strip()
        if not part:
            continue

        coords = []
        # Formátum: "lat1 lng1,lat2 lng2,lat3 lng3"
        # Vesszővel elválasztott párok, szóközzel elválasztott lat/lng
        pairs = part.split(",")
        for pair in pairs:
            pair = pair.strip()
            if not pair:
                continue
            numbers = pair.split()
            if len(numbers) >= 2:
                try:
                    lat = float(numbers[0])
                    lng = float(numbers[1])
                    # GeoJSON: [longitude, latitude]
                    coords.append([lng, lat])
                except (ValueError, IndexError):
                    continue

        if len(coords) >= 3:
            # Poligon zárása ha nem zárt
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            # GeoJSON RFC 7946: exterior ring MUST be counter-clockwise
            # Ellenőrzés és javítás (Shoelace formula)
            if _is_clockwise(coords):
                coords.reverse()
            rings.append(coords)

    return rings


def _is_clockwise(ring: list[list[float]]) -> bool:
    """Shoelace formula: pozitív = clockwise, negatív = counter-clockwise."""
    total = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        total += (x2 - x1) * (y2 + y1)
    return total > 0


def create_geojson(oevk_data: list) -> dict:
    """OEVK adatokból GeoJSON FeatureCollection generálása."""
    features = []

    for entry in oevk_data:
        maz = str(entry.get("maz", "")).zfill(2)
        evk = entry.get("evk", 0)
        oevk_id = f"{maz}_{str(evk).zfill(2)}"
        county = COUNTY_NAMES.get(maz, f"Megye {maz}")

        # Poligon keresése — különböző mező nevek
        poly_str = (
            entry.get("poligon", "") or
            entry.get("oevk_poligon", "") or
            entry.get("polygon", "") or
            ""
        )

        # Centrum (OEVK központja)
        centrum = entry.get("centrum", "")
        center_coords = None
        if centrum and "," in centrum:
            try:
                lat, lng = centrum.split(",", 1)
                center_coords = [float(lng), float(lat)]
            except (ValueError, IndexError):
                pass

        rings = parse_polygon_string(poly_str)

        if not rings:
            # Ha nincs poligon, pont geometria a centrummal
            if center_coords:
                geometry = {
                    "type": "Point",
                    "coordinates": center_coords
                }
            else:
                log.warning(f"  {oevk_id}: nincs sem poligon, sem centrum — kihagyva")
                continue
        elif len(rings) == 1:
            geometry = {
                "type": "Polygon",
                "coordinates": rings
            }
        else:
            geometry = {
                "type": "MultiPolygon",
                "coordinates": [[ring] for ring in rings]
            }

        feature = {
            "type": "Feature",
            "properties": {
                "oevk_id": oevk_id,
                "county": county,
                "oevk_number": evk,
                "display_name": f"{county} {str(evk).zfill(2)}. OEVK",
            },
            "geometry": geometry
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }


def main():
    log.info("=== OEVK GeoJSON generálása ===")

    # Letöltés
    path = download_file(OEVK_JSON_URL, "oevk_raw.json")
    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    log.info(f"  {len(raw_data)} OEVK rekord betöltve")

    # GeoJSON generálás
    geojson = create_geojson(raw_data)
    feature_count = len(geojson["features"])
    log.info(f"  {feature_count} GeoJSON feature generálva")

    # Geometria típusok statisztika
    geo_types: dict[str, int] = {}
    for f in geojson["features"]:
        t = f["geometry"]["type"]
        geo_types[t] = geo_types.get(t, 0) + 1
    for t, c in geo_types.items():
        log.info(f"    {t}: {c}")

    # Mentés
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    log.info(f"  Mentve: {OUTPUT_PATH} ({size_kb:.0f} KB)")
    log.info("Kész!")


if __name__ == "__main__":
    main()
