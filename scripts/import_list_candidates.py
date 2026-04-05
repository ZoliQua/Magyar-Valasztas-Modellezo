#!/usr/bin/env python3
"""
2026-os országos/koalíciós listajelöltek importálása.

Az EgyeniJeloltek.json-ból kigyűjti az összes listajelöltet,
és egy list_candidates táblába menti sorszám szerint.

Futtatás:
    cd scripts && python import_list_candidates.py
"""

import json
from common import get_db, log, normalize_party_name

def main():
    log.info("=== 2026-os listajelöltek importálása ===")

    with open("downloads/vtr2026_jeloltek.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
    data = raw["list"] if isinstance(raw, dict) and "list" in raw else raw
    log.info(f"  {len(data)} jelölt betöltve")

    conn = get_db()

    # Tábla létrehozása
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
            FOREIGN KEY (party_id) REFERENCES parties(id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_list_candidates_party ON list_candidates(party_id, position)")
    conn.execute("DELETE FROM list_candidates")

    # Listák összegyűjtése
    lists: dict[int, dict] = {}

    for c in data:
        if str(c.get("allapot", "")) != "1":
            continue
        for lista in c.get("listak", []):
            if not isinstance(lista, dict):
                continue
            tl_id = lista.get("tl_id")
            if not tl_id:
                continue
            jlcs_nev = lista.get("jlcs_nev", "?")
            lista_tip = lista.get("lista_tip", "?")

            if tl_id not in lists:
                lists[tl_id] = {
                    "name": jlcs_nev,
                    "tip": lista_tip,
                    "party_id": normalize_party_name(jlcs_nev),
                    "candidates": {},
                }

            for j in lista.get("jeloltek", []):
                tj_id = j.get("tj_id")
                sorsz = j.get("sorsz", 999)
                neve = j.get("neve", "?")
                if tj_id and tj_id not in lists[tl_id]["candidates"]:
                    lists[tl_id]["candidates"][tj_id] = {
                        "sorsz": sorsz,
                        "neve": neve,
                        "tj_id": tj_id,
                    }

    # Beszúrás
    insert = conn.prepare(
        "INSERT INTO list_candidates (tl_id, party_id, list_name, list_type, position, candidate_name, tj_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ) if hasattr(conn, 'prepare') else None

    total = 0
    for tl_id, info in sorted(lists.items()):
        cands = sorted(info["candidates"].values(), key=lambda x: x["sorsz"])
        party_id = info["party_id"]
        list_name = info["name"]
        list_type = info["tip"]

        log.info(f"  {list_name} ({list_type}): {len(cands)} jelölt → {party_id}")

        for c in cands:
            conn.execute(
                "INSERT INTO list_candidates (tl_id, party_id, list_name, list_type, position, candidate_name, tj_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (tl_id, party_id, list_name, list_type, c["sorsz"], c["neve"], c["tj_id"])
            )
            total += 1

    conn.commit()
    conn.close()

    log.info(f"  Összesen {total} listajelölt importálva {len(lists)} listából")
    log.info("Kész!")

if __name__ == "__main__":
    main()
