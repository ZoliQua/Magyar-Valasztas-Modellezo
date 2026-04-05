"""
Közös segédfüggvények a választási adatimport scriptekhez.
- SQLite kapcsolat
- Pártnevek normalizálása
- Logging
"""

import sqlite3
import os
import logging
from pathlib import Path

# Projekt gyökér és adatbázis elérési út
PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = PROJECT_ROOT / "backend" / "data" / "valasztas.db"
DOWNLOAD_DIR = PROJECT_ROOT / "scripts" / "downloads"

# Logging beállítás
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("valasztas-import")


def get_db() -> sqlite3.Connection:
    """SQLite kapcsolat a projekt adatbázisához."""
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Adatbázis nem található: {DB_PATH}\n"
            "Futtasd először: npx tsx backend/src/db/init.ts"
        )
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def ensure_download_dir() -> Path:
    """Letöltési mappa létrehozása ha nem létezik."""
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return DOWNLOAD_DIR


# Pártnevek normalizálása — a valasztas.hu-n használt nevek → parties.id leképezés
PARTY_NAME_MAP: dict[str, str] = {
    # Fidesz-KDNP variációk
    "fidesz - magyar polgári szövetség-kereszténydemokrata néppárt": "fidesz_kdnp",
    "fidesz-kdnp": "fidesz_kdnp",
    "fidesz - magyar polgári szövetség": "fidesz_kdnp",
    "fidesz-magyar polgári szövetség-kdnp": "fidesz_kdnp",
    "fidesz": "fidesz_kdnp",
    "fidesz-mps": "fidesz_kdnp",
    "fidesz-kdnp-összefogás": "fidesz_kdnp",
    # Tisza
    "tisza párt": "tisza",
    "tisza": "tisza",
    # Mi Hazánk
    "mi hazánk mozgalom": "mi_hazank",
    "mi hazánk": "mi_hazank",
    # DK
    "demokratikus koalíció": "dk",
    "dk": "dk",
    # MKKP
    "magyar kétfarkú kutya párt": "mkkp",
    "mkkp": "mkkp",
    # MSZP
    "magyar szocialista párt": "mszp",
    "mszp": "mszp",
    "mszp-párbeszéd": "mszp",
    "mszp-szdsz": "mszp",
    # Jobbik
    "jobbik magyarországért mozgalom": "jobbik",
    "jobbik": "jobbik",
    # LMP
    "lehet más a politika": "lmp",
    "lmp": "lmp",
    "lmp - magyarország zöld pártja": "lmp",
    # Egységes ellenzék (2022) — a jelölőcsoport neve tartalmazza az összes pártot
    "egységben magyarországért": "egyseges_ellenzek",
    "egység": "egyseges_ellenzek",
    "dk-jobbik-momentum-mszp-lmp-párbeszéd": "egyseges_ellenzek",
    "dk-jobbik-momentum-mszp-lmp": "egyseges_ellenzek",
    "dk-mszp-párbeszéd-momentum-jobbik-lmp": "egyseges_ellenzek",
    # Momentum
    "momentum mozgalom": "other",
    "momentum": "other",
    # Párbeszéd
    "párbeszéd magyarországért": "other",
    "párbeszéd": "other",
    # SZDSZ
    "szabad demokraták szövetsége": "other",
    "szdsz": "other",
    # MDF
    "magyar demokrata fórum": "other",
    "mdf": "other",
}


def normalize_party_name(name: str) -> str:
    """
    Párt nevet normalizál a parties.id-ra.
    Ha nem ismert: 'other'-t ad vissza.
    """
    normalized = name.strip().lower()
    # Direkt keresés
    if normalized in PARTY_NAME_MAP:
        return PARTY_NAME_MAP[normalized]
    # Részleges egyezés — a leghosszabb kulcs nyer (pontosabb egyezés)
    best_match = None
    best_len = 0
    for key, party_id in PARTY_NAME_MAP.items():
        if key in normalized or normalized in key:
            if len(key) > best_len:
                best_match = party_id
                best_len = len(key)
    if best_match:
        return best_match
    return "other"


def ensure_party_exists(conn: sqlite3.Connection, party_id: str) -> None:
    """Ha a párt nem létezik a parties táblában, 'other'-ként kezeljük."""
    row = conn.execute("SELECT id FROM parties WHERE id = ?", (party_id,)).fetchone()
    if not row and party_id != "other":
        log.warning(f"Ismeretlen párt ID: {party_id}, 'other'-ként kezelve.")


def download_file(url: str, filename: str, force: bool = False) -> Path:
    """
    Fájl letöltése URL-ről a downloads mappába.
    Ha már létezik és force=False, nem tölti le újra.
    """
    import requests

    dest = ensure_download_dir() / filename
    if dest.exists() and not force:
        log.info(f"Már letöltve: {filename}")
        return dest

    log.info(f"Letöltés: {url} → {filename}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36"
    }
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    log.info(f"Letöltve: {filename} ({len(resp.content) / 1024:.0f} KB)")
    return dest
