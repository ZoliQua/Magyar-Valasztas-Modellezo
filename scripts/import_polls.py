#!/usr/bin/env python3
"""
Közvélemény-kutatások scraping-je az angol Wikipediáról és importálása.

Forrás: https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Hungarian_parliamentary_election

Táblák:
- Table 1: "2026 campaign period" — 5 fő párt, affiliáció, mintaméret
- Table 2: "2024-2026" — 15 párt oszlop, részletesebb

Futtatás:
    cd scripts && python import_polls.py
"""

import re
from bs4 import BeautifulSoup
from common import get_db, log, download_file

WIKI_URL = "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Hungarian_parliamentary_election"

# Oszlopfejlécek → parties.id leképezés
HEADER_PARTY_MAP: dict[str, str] = {
    "fidesz": "fidesz_kdnp",
    "fidesz-kdnp": "fidesz_kdnp",
    "fidesz–kdnp": "fidesz_kdnp",
    "tisza": "tisza",
    "dk": "dk",
    "mi hazánk": "mi_hazank",
    "mi hazank": "mi_hazank",
    "mh": "mi_hazank",
    "mi hazánk mozgalom": "mi_hazank",
    "mkkp": "mkkp",
    "mszp": "mszp",
    "momentum": "other",
    "mm": "other",
    "jobbik": "jobbik",
    "lmp": "lmp",
    "dialogue": "other",
    "párbeszéd": "other",
    "mmm": "other",
    "others": "other",
    "other": "other",
    "lead": "_lead",
}

# Intézet név normalizálás
INSTITUTE_NORMALIZE: dict[str, str] = {
    "median": "Medián",
    "medián": "Medián",
    "závecz": "Závecz Research",
    "závecz research": "Závecz Research",
    "zavecz research": "Závecz Research",
    "zavecz": "Závecz Research",
    "nézőpont": "Nézőpont Intézet",
    "nezopont": "Nézőpont Intézet",
    "nézőpont intézet": "Nézőpont Intézet",
    "idea": "IDEA Intézet",
    "idea intézet": "IDEA Intézet",
    "publicus": "Publicus",
    "republikon": "Republikon Intézet",
    "republikon intézet": "Republikon Intézet",
    "századvég": "Századvég",
    "szazadveg": "Századvég",
    "iránytű": "Iránytű Intézet",
    "iránytu": "Iránytű Intézet",
    "iránytű intézet": "Iránytű Intézet",
    "21 kutatóközpont": "21 Kutatóközpont",
    "21. század": "21. Század Intézet",
    "xxi. század": "21. Század Intézet",
    "xxi. szazad": "21. Század Intézet",
    "alapjogokért központ": "Alapjogokért Központ",
    "alapjogokert kozpont": "Alapjogokért Központ",
    "real-pr 93": "Real-PR 93",
    "policy solutions": "Policy Solutions",
    "tárki": "TÁRKI",
    "tarki": "TÁRKI",
}


def normalize_institute(name: str) -> str:
    lower = name.strip().lower()
    return INSTITUTE_NORMALIZE.get(lower, name.strip())


def parse_pct(text: str) -> float | None:
    """Szám kinyerése cellából (pl. '35', '35.5', '35%', '–')."""
    text = text.strip().replace("–", "").replace("—", "").replace("-", "").replace("%", "")
    text = re.sub(r"\[.*?\]", "", text)  # [citation] eltávolítása
    text = text.strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_date(text: str) -> str | None:
    """Dátum kinyerése (EN formátum: '27-30 Mar 2026', '7-13 Jan 2026')."""
    text = re.sub(r"\[.*?\]", "", text).strip()

    months = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "may": "05", "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "oct": "10", "nov": "11", "dec": "12",
        "january": "01", "february": "02", "march": "03", "april": "04",
        "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12",
    }

    # "27-30 Mar 2026" or "27 Mar 2026" or "Mar 2026"
    match = re.search(r"(\d{1,2})[\s\-–]+(\d{1,2})?\s*(\w+)\s+(\d{4})", text)
    if match:
        day = match.group(2) or match.group(1)  # utolsó nap
        month_name = match.group(3).lower()
        year = match.group(4)
        month = months.get(month_name)
        if month:
            return f"{year}-{month}-{day.zfill(2)}"

    # "Mar 2026" (csak hónap)
    match = re.search(r"(\w+)\s+(\d{4})", text)
    if match:
        month_name = match.group(1).lower()
        year = match.group(2)
        month = months.get(month_name)
        if month:
            return f"{year}-{month}-15"  # hónap közepe

    # "2026-03-20"
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        return match.group(0)

    return None


def parse_sample_size(text: str) -> int | None:
    text = re.sub(r"\[.*?\]", "", text).strip().replace(",", "").replace(" ", "")
    match = re.search(r"(\d+)", text)
    if match:
        return int(match.group(1))
    return None


def identify_party_columns(headers: list[str]) -> dict[int, str]:
    """Fejléc szövegek alapján pártonkénti oszlop-leképezés."""
    party_cols: dict[int, str] = {}
    for i, h in enumerate(headers):
        lower = h.strip().lower()
        # Több szavas keresés
        for key, party_id in HEADER_PARTY_MAP.items():
            if key in lower:
                if party_id != "_lead":
                    party_cols[i] = party_id
                break
    return party_cols


def normalize_affiliation(text: str) -> str | None:
    """Affiliation normalizálás: 'Government' → 'kormanyparti', 'Independent/opposition' → 'fuggetlen'"""
    lower = text.strip().lower()
    if not lower:
        return None
    if "government" in lower or "kormány" in lower:
        return "kormanyparti"
    if "independent" in lower or "opposition" in lower or "függet" in lower or "ellenzék" in lower:
        return "fuggetlen"
    return None


# Ismert intézetek → affiliation fallback (Wikipedia alapján)
KNOWN_AFFILIATIONS: dict[str, str] = {
    "Medián": "fuggetlen",
    "Závecz Research": "fuggetlen",
    "IDEA Intézet": "fuggetlen",
    "Publicus": "fuggetlen",
    "Republikon Intézet": "fuggetlen",
    "21 Kutatóközpont": "fuggetlen",
    "Iránytű Intézet": "fuggetlen",
    "Iránytű Institute": "fuggetlen",
    "Minerva": "fuggetlen",
    "Forrás Társadalomkutató": "fuggetlen",
    "Vox Populi": "fuggetlen",
    "Policy Solutions": "fuggetlen",
    "TÁRKI": "fuggetlen",
    "taktikaiszavazas.hu": "fuggetlen",
    "Választási földrajz": "fuggetlen",
    "Nézőpont Intézet": "kormanyparti",
    "Magyar Társadalomkutató": "kormanyparti",
    "Alapjogokért Központ": "kormanyparti",
    "21. Század Intézet": "kormanyparti",
    "Századvég": "kormanyparti",
    "Real-PR 93": "kormanyparti",
    "McLaughlin & Associates": "kormanyparti",
}


def scrape_en_wiki() -> list[dict]:
    """Angol Wikipedia közvélemény-kutatási táblázatok scraping-je."""
    log.info("Angol Wikipedia oldal letöltése...")
    path = download_file(WIKI_URL, "wiki_polls_2026_en.html", force=True)

    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table", class_="wikitable")
    log.info(f"  {len(tables)} wikitable találva")

    all_polls: list[dict] = []
    # Intézet → affiliation leképezés (Table 1-ből), később alkalmazzuk a többi táblára is
    institute_affiliation: dict[str, str] = {}

    for table_idx, table in enumerate(tables):
        # Csak az első ~5 táblát nézzük (a pollok ott vannak)
        if table_idx > 5:
            break

        rows = table.find_all("tr")
        if len(rows) < 3:
            continue

        # Fejléc — keresünk th elemeket, beleértve a többsoros fejlécet
        header_texts: list[str] = []
        for row in rows[:3]:  # max 3 fejléc sor
            ths = row.find_all(["th"])
            if len(ths) > 3:
                for th in ths:
                    # Gyűjtsük össze az összes szöveget: visible text + link title + abbr title
                    texts = []
                    for a_tag in th.find_all("a"):
                        t = a_tag.get("title", "")
                        if t:
                            texts.append(t)
                    for abbr in th.find_all("abbr"):
                        t = abbr.get("title", "")
                        if t:
                            texts.append(t)
                    visible = th.get_text(strip=True)
                    if visible:
                        texts.append(visible)
                    text = " ".join(texts) if texts else visible
                    colspan = int(th.get("colspan", 1))
                    header_texts.extend([text] * colspan)
                break

        if len(header_texts) < 5:
            continue

        # Párt oszlopok azonosítása
        party_cols = identify_party_columns(header_texts)
        if len(party_cols) < 2:
            continue

        # Dátum, intézet, mintaméret, affiliation oszlopok keresése
        date_col = None
        institute_col = None
        sample_col = None
        affiliation_col = None
        for i, h in enumerate(header_texts):
            lower = h.lower()
            if date_col is None and ("date" in lower or "fieldwork" in lower or "felmér" in lower):
                date_col = i
            elif institute_col is None and ("firm" in lower or "polling" in lower or "institut" in lower or "kutat" in lower):
                institute_col = i
            elif sample_col is None and ("sample" in lower or "minta" in lower or "size" in lower):
                sample_col = i
            elif affiliation_col is None and ("affiliation" in lower or "client" in lower):
                affiliation_col = i

        if date_col is None:
            date_col = 0
        if institute_col is None:
            institute_col = 1

        log.info(f"  Tábla #{table_idx}: {len(party_cols)} párt: {list(party_cols.values())}, {len(rows)} sor")

        # Adatsorok
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 4:
                continue

            cell_texts = []
            for c in cells:
                cell_texts.append(c.get_text(strip=True))

            # Dátum
            date_text = cell_texts[date_col] if date_col < len(cell_texts) else ""
            poll_date = parse_date(date_text)
            if not poll_date:
                continue

            # "2022 National Election" skip
            if "election" in date_text.lower() or "választás" in date_text.lower():
                continue

            # Intézet
            inst_text = cell_texts[institute_col] if institute_col < len(cell_texts) else ""
            institute = normalize_institute(inst_text)
            if not institute or len(institute) < 2:
                continue
            # Szűrés: ha az intézet név dátum-szerű (pl. "12 Sep 2025"), kihagyjuk
            if re.match(r"^\d+\s+\w+\s+\d{4}", institute):
                continue
            # "Election" sorok kihagyása
            if "election" in institute.lower():
                continue

            # Affiliation (csak a Table 1-ben szerepel direkt módon)
            affiliation = None
            if affiliation_col is not None and affiliation_col < len(cell_texts):
                affiliation = normalize_affiliation(cell_texts[affiliation_col])
                if affiliation:
                    institute_affiliation[institute] = affiliation

            # Ha nincs direkt affiliation, próbáljuk a korábban gyűjtött leképezésből
            if not affiliation:
                affiliation = institute_affiliation.get(institute)
            # Végső fallback: ismert intézetek listájából
            if not affiliation:
                affiliation = KNOWN_AFFILIATIONS.get(institute)

            # Mintaméret
            sample_size = None
            if sample_col and sample_col < len(cell_texts):
                sample_size = parse_sample_size(cell_texts[sample_col])

            # Pártadatok
            parties: dict[str, float] = {}
            for col_idx, party_id in party_cols.items():
                if col_idx < len(cell_texts):
                    pct = parse_pct(cell_texts[col_idx])
                    if pct is not None and 0 < pct <= 80:
                        if party_id not in parties or pct > parties[party_id]:
                            parties[party_id] = pct

            if len(parties) >= 2:
                all_polls.append({
                    "date": poll_date,
                    "institute": institute,
                    "basis": "biztos_partvalaszto",
                    "sample_size": sample_size,
                    "affiliation": affiliation,
                    "parties": parties,
                })

    return all_polls


def import_polls_to_db(polls: list[dict]):
    """Adatok importálása az adatbázisba."""
    conn = get_db()

    # Korábbi scrape-elt adatok törlése (Wikipedia forrásúak)
    conn.execute("DELETE FROM polls WHERE source_url LIKE '%wikipedia%'")

    inserted = 0
    skipped = 0

    for poll in polls:
        for party_id, pct in poll["parties"].items():
            exists = conn.execute(
                "SELECT id FROM polls WHERE poll_date = ? AND institute = ? AND party_id = ? AND basis = ?",
                (poll["date"], poll["institute"], party_id, poll["basis"])
            ).fetchone()

            if exists:
                skipped += 1
                continue

            conn.execute(
                """INSERT INTO polls
                   (poll_date, institute, basis, party_id, support_pct, affiliation, sample_size, margin_of_error, source_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (poll["date"], poll["institute"], poll["basis"], party_id, pct,
                 poll.get("affiliation"), poll.get("sample_size"), None, WIKI_URL)
            )
            inserted += 1

    conn.commit()

    # Statisztika
    total = conn.execute("SELECT COUNT(*) FROM polls").fetchone()[0]
    parties = conn.execute(
        "SELECT party_id, COUNT(*), ROUND(AVG(support_pct),1) FROM polls GROUP BY party_id ORDER BY AVG(support_pct) DESC"
    ).fetchall()
    log.info(f"  Adatbázisban összesen: {total} kutatási adat")
    for p in parties:
        log.info(f"    {p[0]}: {p[1]} adat, átl. {p[2]}%")

    conn.close()
    return inserted, skipped


def main():
    log.info("=== Közvélemény-kutatások importálása (EN Wikipedia) ===")

    polls = scrape_en_wiki()
    log.info(f"  {len(polls)} kutatási rekord kinyerve")

    if not polls:
        log.warning("Nem sikerült kutatási adatokat kinyerni!")
        return

    # Példák
    for p in polls[:3]:
        log.info(f"  Példa: {p['date']} | {p['institute']} | {p['parties']}")

    inserted, skipped = import_polls_to_db(polls)
    log.info(f"  {inserted} új adat importálva, {skipped} duplikátum kihagyva")
    log.info("Kész!")


if __name__ == "__main__":
    main()
