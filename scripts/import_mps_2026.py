#!/usr/bin/env python3
"""
2026-os országgyűlési képviselők (mandátumosok) és az azóta történt
személycserék importálása.

Források:
  1. Eredeti mandátumosok — a jogerős eredmény (VTR JSON API):
     {szavossz}/szavossz/SzervezetekEredmenye.json → "mandatumok"
       mand_tip "1" = egyéni (OEVK) mandátum, ej_id-vel
       mand_tip "2" = országos listás mandátum, tj_id-vel
       mand_tip "4" = nemzetiségi szószóló (NEM mandátum → kihagyjuk)
  2. Személycserék — scripts/data/mp_changes_2026.json (kézzel gondozott,
     NVB-határozatokra hivatkozik).

Előfeltétel: import_elections.py (2026 eredmények) és import_list_candidates.py.

Az import idempotens: a 2026-os mp_mandates / mp_changes sorokat egy
tranzakcióban újraépíti a forrásokból. Bármely ellenőrzés hibájánál
leáll és semmit nem ír (rollback).

Futtatás:
    cd scripts && python import_mps_2026.py
"""

import json
import sys
from pathlib import Path

from common import get_db, log, download_file

VTR_2026_BASE = "https://vtr.valasztas.hu/ogy2026/data"
YEAR = 2026
CHANGES_FILE = Path(__file__).parent / "data" / "mp_changes_2026.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS mp_changes (
  id TEXT PRIMARY KEY,
  election_year INTEGER NOT NULL,
  decision_ref TEXT NOT NULL,
  decision_date TEXT NOT NULL,
  party_id TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  sources_json TEXT NOT NULL,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);
CREATE TABLE IF NOT EXISTS mp_mandates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  party_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mandate_type TEXT NOT NULL CHECK (mandate_type IN ('oevk', 'lista')),
  oevk_id TEXT,
  list_position INTEGER,
  granted_by_change_id TEXT,
  ended_by_change_id TEXT,
  end_date TEXT,
  UNIQUE (election_year, party_id, name),
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id),
  FOREIGN KEY (granted_by_change_id) REFERENCES mp_changes(id),
  FOREIGN KEY (ended_by_change_id) REFERENCES mp_changes(id)
);
CREATE INDEX IF NOT EXISTS idx_mp_mandates_year ON mp_mandates(election_year, party_id);
"""


class ImportError_(Exception):
    pass


def norm(name: str) -> str:
    """Névösszevetéshez: nagybetű, 'DR.' előtag és felesleges szóközök nélkül."""
    parts = name.upper().replace("DR.", " ").split()
    return " ".join(parts)


def load_vtr(path: str, local: str) -> list:
    p = download_file(f"{VTR_2026_BASE}/{path}", local)
    with open(p, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data["list"] if isinstance(data, dict) and "list" in data else data


def build_original_mandates(conn) -> tuple[list[dict], dict[str, int]]:
    """Eredeti (jogerős) mandátumosok a VTR adatokból, ellenőrzésekkel."""
    cfg_path = download_file(f"{VTR_2026_BASE}/config.json", "vtr2026_config.json", force=True)
    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    ver, szavossz = cfg.get("ver"), cfg.get("szavossz")
    if not szavossz:
        raise ImportError_("Nincs jogerős szavazatösszesítés (szavossz=null).")
    log.info(f"  ver={ver}  szavossz={szavossz}")

    orgs = load_vtr(f"{szavossz}/szavossz/SzervezetekEredmenye.json", "vtr2026_szervezetek_eredmenye.json")
    candidates = load_vtr(f"{ver}/ver/EgyeniJeloltek.json", "vtr2026_egyeni_jeloltek.json")
    cand_by_ej = {c["ej_id"]: c for c in candidates}

    # tl_id → párt, és tj_id → listajelölt (a list_candidates táblából)
    list_rows = conn.execute(
        "SELECT tl_id, party_id, position, candidate_name, tj_id FROM list_candidates"
    ).fetchall()
    party_by_tl = {r["tl_id"]: r["party_id"] for r in list_rows}
    list_by_tj = {r["tj_id"]: r for r in list_rows if r["tj_id"] is not None}

    # OEVK győztesek a tárolt eredményből (keresztellenőrzéshez)
    winners = {
        r["oevk_id"]: r for r in conn.execute(
            "SELECT oevk_id, party_id, candidate_name FROM oevk_results "
            "WHERE election_year = ? AND is_winner = 1", (YEAR,)
        ).fetchall()
    }

    mandates: list[dict] = []
    official_totals: dict[str, int] = {}
    seen_tl: set[int] = set()

    for org in orgs:
        tl_id = org.get("tl_id")
        mands = [m for m in org.get("mandatumok", []) if m.get("mand_tip") in ("1", "2")]
        if not mands:
            continue
        # Közös lista (pl. Fidesz + KDNP) mindkét szervezetnél szerepel → tl_id szerint egyszer
        if tl_id in seen_tl:
            continue
        seen_tl.add(tl_id)
        party_id = party_by_tl.get(tl_id)
        if not party_id:
            raise ImportError_(f"Ismeretlen lista (tl_id={tl_id}) — futtasd az import_list_candidates.py-t.")
        official_totals[party_id] = org["mand_osszes"]

        for m in mands:
            if m["mand_tip"] == "1":
                c = cand_by_ej.get(m["ej_id"])
                if not c:
                    raise ImportError_(f"Ismeretlen egyéni jelölt: ej_id={m['ej_id']}")
                oevk_id = f"{str(c['maz']).zfill(2)}_{str(c['evk']).zfill(2)}"
                name = f"{c['dr_jelzo']} {c['neve']}" if c.get("dr_jelzo") else c["neve"]
                w = winners.get(oevk_id)
                if not w or norm(w["candidate_name"]) != norm(name) or w["party_id"] != party_id:
                    raise ImportError_(
                        f"OEVK győztes eltérés ({oevk_id}): VTR={name}/{party_id}, "
                        f"DB={w['candidate_name'] + '/' + w['party_id'] if w else 'nincs'}"
                    )
                mandates.append({"party_id": party_id, "name": name, "mandate_type": "oevk",
                                 "oevk_id": oevk_id, "list_position": None})
            else:
                lc = list_by_tj.get(m["tj_id"])
                if not lc or lc["party_id"] != party_id:
                    raise ImportError_(f"Ismeretlen listás jelölt: tj_id={m['tj_id']} ({party_id})")
                mandates.append({"party_id": party_id, "name": lc["candidate_name"], "mandate_type": "lista",
                                 "oevk_id": None, "list_position": lc["position"]})

    counted: dict[str, int] = {}
    for m in mandates:
        counted[m["party_id"]] = counted.get(m["party_id"], 0) + 1
    if counted != official_totals:
        raise ImportError_(f"Mandátumszám eltérés: számolt={counted}, hivatalos={official_totals}")
    if len(mandates) != 199:
        raise ImportError_(f"Összesen {len(mandates)} mandátum (199 helyett)")
    return mandates, official_totals


def apply_changes(conn, mandates: list[dict], changes: list[dict]) -> None:
    """Személycserék alkalmazása időrendben, minden lépés ellenőrzésével."""
    list_lookup = {
        (r["party_id"], r["position"]): r["candidate_name"]
        for r in conn.execute("SELECT party_id, position, candidate_name FROM list_candidates")
    }

    for ch in sorted(changes, key=lambda c: (c["decision_date"], c["id"])):
        party = ch["party_id"]
        if len(ch["outgoing"]) != len(ch["incoming"]):
            raise ImportError_(f"{ch['id']}: a kilépők és belépők száma eltér")

        for person in ch["outgoing"] + ch["incoming"]:
            expected = list_lookup.get((party, person["list_position"]))
            if expected is None or norm(expected) != norm(person["name"]):
                raise ImportError_(
                    f"{ch['id']}: {person['name']} nem a(z) {party} lista "
                    f"{person['list_position']}. helye (ott: {expected})"
                )

        for out in ch["outgoing"]:
            current = [m for m in mandates if m["party_id"] == party and m.get("ended_by_change_id") is None
                       and norm(m["name"]) == norm(out["name"])]
            if len(current) != 1:
                raise ImportError_(f"{ch['id']}: {out['name']} nem aktuális képviselő")
            current[0]["ended_by_change_id"] = ch["id"]
            current[0]["end_date"] = out.get("end_date", ch["decision_date"])

        for inc in ch["incoming"]:
            if any(norm(m["name"]) == norm(inc["name"]) and m["party_id"] == party for m in mandates):
                raise ImportError_(f"{ch['id']}: {inc['name']} már szerepel a mandátumosok között")
            mandates.append({"party_id": party, "name": list_lookup[(party, inc["list_position"])],
                             "mandate_type": "lista", "oevk_id": None,
                             "list_position": inc["list_position"], "granted_by_change_id": ch["id"]})


def main() -> int:
    log.info("=== 2026-os képviselők és személycserék importálása ===")
    with open(CHANGES_FILE, "r", encoding="utf-8") as f:
        changes = json.load(f)["changes"]

    conn = get_db()
    conn.executescript(SCHEMA)
    try:
        mandates, official = build_original_mandates(conn)
        log.info(f"  Eredeti mandátumosok: {len(mandates)} — {official}")
        apply_changes(conn, mandates, changes)

        active: dict[str, int] = {}
        for m in mandates:
            if m.get("ended_by_change_id") is None:
                active[m["party_id"]] = active.get(m["party_id"], 0) + 1
        # Listás mandátum a pártnál marad → a frakcióarány nem változhat
        if active != official:
            raise ImportError_(f"Aktuális létszám eltér a hivatalostól: {active} vs {official}")

        with conn:
            conn.execute("DELETE FROM mp_mandates WHERE election_year = ?", (YEAR,))
            conn.execute("DELETE FROM mp_changes WHERE election_year = ?", (YEAR,))
            for ch in changes:
                conn.execute(
                    """INSERT INTO mp_changes (id, election_year, decision_ref, decision_date, party_id,
                                               reason, note, sources_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (ch["id"], YEAR, ch["decision_ref"], ch["decision_date"], ch["party_id"],
                     ch.get("reason"), ch.get("note"), json.dumps(ch["sources"], ensure_ascii=False)),
                )
            for m in mandates:
                conn.execute(
                    """INSERT INTO mp_mandates (election_year, party_id, name, mandate_type, oevk_id,
                                                list_position, granted_by_change_id, ended_by_change_id, end_date)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (YEAR, m["party_id"], m["name"], m["mandate_type"], m["oevk_id"], m["list_position"],
                     m.get("granted_by_change_id"), m.get("ended_by_change_id"), m.get("end_date")),
                )
    except ImportError_ as e:
        log.error(f"  HIBA — semmi nem került mentésre: {e}")
        return 1
    finally:
        conn.close()

    ended = sum(1 for m in mandates if m.get("ended_by_change_id"))
    log.info(f"  {len(changes)} NVB-esemény, {ended} távozó / {ended} belépő képviselő")
    log.info(f"  Aktuális frakcióarány: {active}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
