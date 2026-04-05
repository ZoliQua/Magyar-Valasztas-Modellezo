#!/usr/bin/env python3
"""
2026-os egyéni jelöltek importálása a vtr.valasztas.hu/ogy2026 API-ból.

A config.json-ból kiolvassuk a verziószámot, majd letöltjük
az EgyeniJeloltek.json-t és a Szervezetek.json-t.

Csak az aktív jelölteket importáljuk (allapot=1).

Futtatás:
    cd scripts && python import_candidates_2026.py
"""

import json
from common import get_db, log, download_file, normalize_party_name

VTR_2026_BASE = "https://vtr.valasztas.hu/ogy2026/data"


def get_version() -> str:
    """Config.json-ból a verzió kiolvasása."""
    path = download_file(f"{VTR_2026_BASE}/config.json", "vtr2026_config.json", force=True)
    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)
    ver = config.get("ver", "")
    log.info(f"  VTR 2026 verzió: {ver}")
    return ver


def download_vtr_list(ver: str, filename: str, local_name: str) -> list:
    """VTR JSON lista letöltése (header+list formátum)."""
    url = f"{VTR_2026_BASE}/{ver}/ver/{filename}"
    path = download_file(url, local_name)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "list" in data:
        return data["list"]
    return data if isinstance(data, list) else []


def main():
    log.info("=== 2026-os jelöltek importálása ===")

    ver = get_version()
    if not ver:
        log.error("Nem sikerült a verziószámot kiolvasni!")
        return

    # Letöltések
    candidates = download_vtr_list(ver, "EgyeniJeloltek.json", "vtr2026_jeloltek.json")
    orgs = download_vtr_list(ver, "Szervezetek.json", "vtr2026_szervezetek.json")

    log.info(f"  {len(candidates)} jelölt, {len(orgs)} szervezet letöltve")

    # Szervezet kód → név leképezés
    org_map: dict[int, str] = {}
    for o in orgs:
        org_map[o.get("szkod", 0)] = o.get("nev", "") or o.get("r_nev", "")

    # Szűrés: csak aktív jelöltek (allapot=1)
    active = [c for c in candidates if str(c.get("allapot", "")) == "1"]
    log.info(f"  {len(active)} aktív jelölt (allapot=1)")

    conn = get_db()

    # 2026-os választás hozzáadása ha még nincs
    conn.execute("""
        INSERT OR IGNORE INTO elections (year, system, total_seats, oevk_seats, list_seats, notes)
        VALUES (2026, 'new', 199, 106, 93, '2026-os országgyűlési választás — jelöltek regisztrálva, eredmények még nincsenek')
    """)

    # Korábbi 2026-os adatok törlése
    conn.execute("DELETE FROM oevk_results WHERE election_year = 2026")

    count = 0
    oevk_candidates: dict[str, list] = {}  # OEVK → jelöltek

    for c in active:
        maz = str(c.get("maz", "")).zfill(2)
        evk = str(c.get("evk", "")).zfill(2)
        oevk_id = f"{maz}_{evk}"

        name = c.get("neve", "")
        dr = c.get("dr_jelzo", "")
        if dr:
            name = f"{dr} {name}"

        # Párt azonosítás
        jlcs_nev = c.get("jlcs_nev", "")
        party_id = normalize_party_name(jlcs_nev)

        # Ha független
        jelolo_szervezetek = c.get("jelolo_szervezetek", [])
        is_independent = (not jelolo_szervezetek) or (jelolo_szervezetek == [0])

        if is_independent:
            party_id = "other"
            jlcs_nev = jlcs_nev or "Független"

        # Listás adatok
        listak = c.get("listak", [])
        has_list = len(listak) > 0

        if oevk_id not in oevk_candidates:
            oevk_candidates[oevk_id] = []
        oevk_candidates[oevk_id].append({
            "name": name,
            "party_id": party_id,
            "jlcs_nev": jlcs_nev,
            "has_list": has_list,
            "ballot_pos": c.get("szavlap_sorsz", 0),
        })

        # Beszúrás oevk_results-ba (votes=0, ez csak regisztráció)
        conn.execute(
            """INSERT INTO oevk_results
               (election_year, oevk_id, oevk_id_2026, party_id, candidate_name, votes, vote_share_pct, is_winner)
               VALUES (?, ?, ?, ?, ?, 0, 0, 0)""",
            (2026, oevk_id, oevk_id, party_id, name)
        )
        count += 1

    conn.commit()

    # Statisztika
    party_counts: dict[str, int] = {}
    for c in active:
        jlcs = c.get("jlcs_nev", "Független")
        pid = normalize_party_name(jlcs)
        party_counts[pid] = party_counts.get(pid, 0) + 1

    log.info(f"\n  {count} jelölt importálva {len(oevk_candidates)} OEVK-ba")
    log.info("  Pártok:")
    for pid, cnt in sorted(party_counts.items(), key=lambda x: -x[1]):
        log.info(f"    {pid}: {cnt} jelölt")

    # Ellenőrzés: minden OEVK-nak van jelöltje?
    oevk_defs = conn.execute("SELECT oevk_id FROM oevk_definitions WHERE valid_from = 2026").fetchall()
    missing = [d[0] for d in oevk_defs if d[0] not in oevk_candidates]
    if missing:
        log.warning(f"  {len(missing)} OEVK jelölt nélkül: {missing[:5]}...")
    else:
        log.info(f"  Minden 106 OEVK-ban van jelölt")

    conn.close()
    log.info("Kész!")


if __name__ == "__main__":
    main()
