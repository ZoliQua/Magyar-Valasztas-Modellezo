#!/usr/bin/env python3
"""
2026-os országos/koalíciós listajelöltek importálása a ListakEsJeloltek.json-ból.

Ez a fájl tartalmazza a TELJES listákat, beleértve azokat a jelölteket is
akik NEM indulnak egyéniben (pl. Orbán Viktor, Semjén Zsolt).

Futtatás:
    cd scripts && python import_list_candidates.py
"""

import json
from common import get_db, log, download_file, normalize_party_name

VTR_2026_BASE = "https://vtr.valasztas.hu/ogy2026/data"


def get_version() -> str:
    path = download_file(f"{VTR_2026_BASE}/config.json", "vtr2026_config.json", force=True)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f).get("ver", "")


def main():
    log.info("=== 2026-os listajelöltek importálása (ListakEsJeloltek.json) ===")

    ver = get_version()
    if not ver:
        log.error("Nem sikerült a verziószámot kiolvasni!")
        return

    url = f"{VTR_2026_BASE}/{ver}/ver/ListakEsJeloltek.json"
    path = download_file(url, "vtr2026_listak_es_jeloltek.json")
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    entries = raw["list"] if isinstance(raw, dict) and "list" in raw else raw
    log.info(f"  {len(entries)} lista letöltve")

    conn = get_db()

    # Tábla létrehozása/újra
    conn.execute("""
        CREATE TABLE IF NOT EXISTS list_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tl_id INTEGER NOT NULL,
            party_id TEXT NOT NULL,
            list_name TEXT NOT NULL,
            list_type TEXT NOT NULL,
            position INTEGER NOT NULL,
            candidate_name TEXT NOT NULL,
            tj_id INTEGER,
            runs_in_oevk INTEGER DEFAULT 0,
            FOREIGN KEY (party_id) REFERENCES parties(id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_list_candidates_party ON list_candidates(party_id, position)")
    conn.execute("DELETE FROM list_candidates")

    # Egyéni jelöltek betöltése — kik indulnak OEVK-ban?
    oevk_candidates = set()
    oevk_rows = conn.execute(
        "SELECT UPPER(TRIM(candidate_name)) FROM oevk_results WHERE election_year = 2026"
    ).fetchall()
    for row in oevk_rows:
        oevk_candidates.add(row[0])

    total = 0
    for entry in entries:
        tl_id = entry.get("tl_id")
        jlcs_nev = entry.get("jlcs_nev", "?")
        lista_tip = entry.get("lista_tip", "?")
        party_id = normalize_party_name(jlcs_nev)

        # Csak pártlisták (O=országos, K=koalíciós), nem nemzetiségi
        if lista_tip not in ("O", "K"):
            log.info(f"  Kihagyva: {jlcs_nev} (típus: {lista_tip})")
            continue

        jeloltek = entry.get("jeloltek", [])

        # Aktív jelöltek szűrése
        active = [j for j in jeloltek if str(j.get("allapot", "")) == "1"]
        log.info(f"  {jlcs_nev} ({lista_tip}): {len(active)} aktív jelölt (tl_id={tl_id})")

        for j in active:
            sorsz = j.get("sorsz", 999)
            neve = j.get("neve", "?")
            tj_id = j.get("tj_id")
            runs_in_oevk = 1 if neve.upper().strip() in oevk_candidates else 0

            conn.execute(
                """INSERT INTO list_candidates
                   (tl_id, party_id, list_name, list_type, position, candidate_name, tj_id, runs_in_oevk)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (tl_id, party_id, jlcs_nev, lista_tip, sorsz, neve, tj_id, runs_in_oevk)
            )
            total += 1

    conn.commit()

    # Statisztika: top 5 per párt
    for entry in entries:
        if entry.get("lista_tip") not in ("O", "K"):
            continue
        party_id = normalize_party_name(entry.get("jlcs_nev", ""))
        rows = conn.execute(
            "SELECT position, candidate_name, runs_in_oevk FROM list_candidates WHERE party_id = ? ORDER BY position LIMIT 5",
            (party_id,)
        ).fetchall()
        log.info(f"  {entry['jlcs_nev']} top 5:")
        for r in rows:
            oevk_mark = " [OEVK]" if r[2] else ""
            log.info(f"    #{r[0]}: {r[1]}{oevk_mark}")

    conn.close()
    log.info(f"\n  Összesen {total} listajelölt importálva")
    log.info("Kész!")


if __name__ == "__main__":
    main()
