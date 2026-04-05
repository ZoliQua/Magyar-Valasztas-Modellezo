#!/usr/bin/env python3
"""
2026-os OEVK definíciók és település→OEVK leképezés importálása.

Adatforrás: vtr.valasztas.hu/stat/data/oevk/OevkAdatok-{maz}.json
- 20 megye (maz=01..20), mindegyikben OEVK-k és települések
- Budapest: maz=01, Pest: maz=14

Futtatás:
    cd scripts && python import_oevk_mapping.py
"""

import json
from common import get_db, log, download_file

VTR_STAT_BASE = "https://vtr.valasztas.hu/stat/data/oevk"

# Megye kódok (01-20)
COUNTY_CODES = [str(i).zfill(2) for i in range(1, 21)]

# Megye nevek a kódokhoz
COUNTY_NAMES = {
    "01": "Budapest",
    "02": "Baranya",
    "03": "Bács-Kiskun",
    "04": "Békés",
    "05": "Borsod-Abaúj-Zemplén",
    "06": "Csongrád-Csanád",
    "07": "Fejér",
    "08": "Győr-Moson-Sopron",
    "09": "Hajdú-Bihar",
    "10": "Heves",
    "11": "Jász-Nagykun-Szolnok",
    "12": "Komárom-Esztergom",
    "13": "Nógrád",
    "14": "Pest",
    "15": "Somogy",
    "16": "Szabolcs-Szatmár-Bereg",
    "17": "Tolna",
    "18": "Vas",
    "19": "Veszprém",
    "20": "Zala",
}


def download_county_oevk(maz: str) -> list:
    """Egy megye OEVK adatainak letöltése."""
    url = f"{VTR_STAT_BASE}/OevkAdatok-{maz}.json"
    filename = f"oevk_adatok_{maz}.json"
    path = download_file(url, filename)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # A JSON { "header": ..., "list": [...] } formátumú
    if isinstance(data, dict) and "list" in data:
        return data["list"]
    return data if isinstance(data, list) else []


def main():
    conn = get_db()

    # Korábbi demo adatok törlése
    conn.execute("DELETE FROM oevk_definitions WHERE valid_from = 2026")
    conn.execute("DELETE FROM settlement_oevk_mapping")
    log.info("Korábbi 2026-os OEVK definíciók és leképezések törölve.")

    total_oevk = 0
    total_settlements = 0

    for maz in COUNTY_CODES:
        county_name = COUNTY_NAMES.get(maz, f"Megye {maz}")
        log.info(f"Feldolgozás: {county_name} (maz={maz})")

        try:
            oevk_data = download_county_oevk(maz)
        except Exception as e:
            log.error(f"  Hiba a letöltésnél: {e}")
            continue

        for oevk_entry in oevk_data:
            evk = oevk_entry.get("oevk", 0)
            oevk_id = f"{maz}_{str(evk).zfill(2)}"
            oevk_name = oevk_entry.get("oevk_nev", f"{county_name} {evk}. OEVK")
            seat_city = oevk_entry.get("szekhely_nev", None)
            display_name = f"{county_name} {str(evk).zfill(2)}. OEVK"

            # OEVK definíció beszúrása
            conn.execute(
                """INSERT INTO oevk_definitions
                   (oevk_id, valid_from, valid_to, county, oevk_number, seat_city, display_name)
                   VALUES (?, 2026, NULL, ?, ?, ?, ?)""",
                (oevk_id, county_name, evk, seat_city, display_name)
            )
            total_oevk += 1

            # Települések feldolgozása
            telepulesek = oevk_entry.get("telepulesek", [])
            for tel in telepulesek:
                taz = str(tel.get("taz", ""))
                tel_nev = tel.get("tel_nev", "")
                teljes = tel.get("teljes_tel", "I")  # I = teljes, N = részleges

                # Ha részleges (N), a település több OEVK-ba tartozik
                # A pontos arányt a szavazókörök számából becsüljük
                szavazokorok = tel.get("szavazokorok", [])
                split_ratio = 1.0 if teljes == "I" else None

                if teljes == "N" and szavazokorok:
                    # A split_ratio-t a szavazókörök alapján becsüljük
                    # (pontos arányt később a teljes adat alapján számolhatunk)
                    szkr_count = len(szavazokorok)
                    # Egyelőre None — a pontos arány kiszámításához az összes
                    # OEVK-t kell látnunk amibe a település tartozik
                    split_ratio = None  # Később számoljuk

                conn.execute(
                    """INSERT OR REPLACE INTO settlement_oevk_mapping
                       (settlement_id, settlement_name, county, oevk_id_2026, split_ratio)
                       VALUES (?, ?, ?, ?, ?)""",
                    (taz, tel_nev, county_name, oevk_id, split_ratio)
                )
                total_settlements += 1

    # Split ratio számítás a részleges településeknél
    # Azok a települések amelyek több OEVK-ban is szerepelnek
    partial = conn.execute(
        """SELECT settlement_id, settlement_name, COUNT(*) as oevk_count
           FROM settlement_oevk_mapping
           WHERE split_ratio IS NULL
           GROUP BY settlement_id"""
    ).fetchall()

    for row in partial:
        sid = row[0]
        count = row[2]
        ratio = round(1.0 / count, 4)  # Egyenlő arányú becslés
        conn.execute(
            "UPDATE settlement_oevk_mapping SET split_ratio = ? WHERE settlement_id = ? AND split_ratio IS NULL",
            (ratio, sid)
        )

    if partial:
        log.info(f"  {len(partial)} részleges település split_ratio beállítva ({1}/{len(partial)} egyenlő becslés)")

    conn.commit()
    conn.close()

    log.info(f"=== Összesítés ===")
    log.info(f"  {total_oevk} OEVK definíció importálva (2026)")
    log.info(f"  {total_settlements} település→OEVK leképezés")
    log.info("Kész!")


if __name__ == "__main__":
    main()
