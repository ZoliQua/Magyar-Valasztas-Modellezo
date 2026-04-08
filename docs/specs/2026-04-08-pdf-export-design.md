# PDF Export — Szimulációs Eredmények

**Dátum:** 2026-04-08
**Státusz:** Jóváhagyva, implementálásra vár
**Szerző:** Zoltán Dul

## 1. Cél

A "Modellezés" oldalon futó szimuláció teljes eredményének exportálása egy letölthető PDF-be,
amely önálló dokumentumként prezentálja a szimuláció bemeneteit, a mandátumelosztást, a térképet,
és a képviselők névsorát.

## 2. Technikai megközelítés

**Kiválasztott opció: `jsPDF` + `jspdf-autotable` + `html2canvas`** (kliens-oldali)

### Új függőségek

```json
"jspdf": "^2.5.2",
"jspdf-autotable": "^3.8.4",
"html2canvas": "^1.4.1"
```

### Font kezelés

- **Roboto** font embed (Unicode, támogatja: á, é, í, ó, ö, ő, ú, ü, ű)
- A font fájl helye: `frontend/public/fonts/Roboto-Regular.ttf` és `Roboto-Bold.ttf`
- jsPDF `addFont()` hívással regisztrálva generáláskor
- Alternatíva: base64-kódolt TTF konstansként a kódban

### SVG → PNG konverzió

- **Parlamenti patkó:** `document.querySelector('svg.hemicycle')` → `XMLSerializer` → data URI → `Image` → `canvas.drawImage()` → `toDataURL('image/png')`
- **Magyarország térkép:** ugyanaz a módszer, nagyobb felbontással (2x scale a jobb minőségért)
- `html2canvas` backup megoldás, ha a natív SVG serializer nem elég

## 3. PDF tartalom (8 szakasz)

### 1. Borítólap

- Cím: **"Választási Szimuláció Eredménye — Magyarország 2026"**
- Alcím: generálás dátuma és ideje (`YYYY.MM.DD HH:MM`)
- **Szimulációs paraméterek összesítő:**
  - Bázisév: 2022
  - Swing mód: "Csak országos" vagy "Egyedi swing"
  - Részvételi arány: X%
  - Listás támogatottság beállítás (táblázat): párt → %
  - Uniform swing értékek (ha manuális mód): párt → ±%
- **QR kód** a repo linkjére a bal alsó sarokban (opcionális extra #4)

### 2. Mandátum összesítő

- **Nagy összegző táblázat:**
  | Párt | OEVK mand. | Lista mand. | Össz. | Töredékszav. |
- Többség jelzése: sáv a szöveg alján "Többség: TISZA (110/199)" vagy "Nincs többség"
- Kétharmad státusz: "✓ Kétharmad" / "✗ Nincs kétharmad"
- Egyszerű többséghez szükséges/hiányzó mandátumok

### 3. Parlamenti patkó (vizualizáció)

- SVG → PNG beágyazva, szélesség kb. 160mm
- Alcím: "199 mandátum félkör diagram"
- Többségi vonal és 2/3-os vonal megtartva

### 4. Magyarország térkép

- OEVK poligonok színezve a győztes párt színével
- Margin-intenzitás (halvány = szoros, erős = biztos)
- Jelmagyarázat alatta: pártszínek + magyarázó
- Alcím: "106 egyéni választókerület győztesei"

### 5. OEVK eredmények táblázat (106 sor)

- **Rendezés:** vármegye ABC + OEVK sorszám
- **Oszlopok:** OEVK név | Vármegye | Győztes jelölt | Párt | Vote% | Margin
- `jspdf-autotable` kezeli az oldaltörést
- Fejléc sticky minden oldalon
- Sor-háttér: halvány pártszín
- **Csak győztesek szerepelnek** (nem top 3)

### 6. Listás mandátumok pártonként

- Minden párt külön blokk:
  - Párt név + szín + mandátumszám + töredékszavazat
  - **Bejutó listás jelöltek** táblázat:
    | # effektív | # eredeti | Név |
  - Max 93 sor a listásokhoz összesen

### 7. Teljes 199 fős országgyűlés

- **Rendezés: ABC szerint (név alapján)**
- **Oszlopok:** # | Név | Párt | Forrás (OEVK neve vagy "Lista #X")
- Többoldalas táblázat
- Alcímmel: "Prediktált képviselők — 199 fő (106 egyéni + 93 listás)"

### 8. Függelék / Lábléc

- **Történeti összehasonlítás (extra #1):**
  - Kis táblázat: 2022 tényleges mandátumok vs. 2026 projekció
  - Változás pártonként
- **Szimulációs bemenet snapshot (extra #2):**
  - Teljes `SimulationInput` JSON szövegként (tömörített/formázott)
  - "Ezzel a bemenettel reprodukálható az eredmény"
- **OEVK swing statisztika (extra #3):**
  - Átlagos margin
  - Legszorosabb 5 körzet (margin < 3%)
  - Biztos körzetek száma (margin > 15%)
- **Adatforrások:**
  - valasztas.hu (2022 alapadatok)
  - vtr.valasztas.hu/ogy2026 (2026 jelöltek)
  - EN Wikipedia (kutatások)
- **Disclaimer:** "Ez modellezési eszköz, nem előrejelzés..."
- **Lábléc minden oldalon:** "Választási Modellező 2026 — oldal X / Y"

## 4. UI integráció

### Gomb helye

**Jobb felső header** — a meglévő "Mentés" és "Betöltés" gombok mellé egy új **"PDF Export"** gomb.

```tsx
<Header>
  <h1>Választási Modellező 2026</h1>
  <div>
    <button>Mentés</button>
    <button>Betöltés</button>
    <button>PDF Export</button>  {/* ÚJ */}
  </div>
</Header>
```

### Viselkedés

1. Kattintás → loading indicator ("PDF generálása...")
2. Háttérben:
   - Jelenlegi `result` + `mpPrediction` + `input` felhasználása (nincs új API hívás)
   - SVG-k kirajzolása canvas-ra
   - Táblázatok generálása
3. Sikeres generálás → automatikus letöltés
4. Fájlnév: `valasztas_szimulacio_YYYY-MM-DD_HHMM.pdf`

### Hibakezelés

- Ha a `result` vagy `mpPrediction` `null` (még nem futott szimuláció) → gomb letiltva
- Ha a generálás hibára fut → toast/alert: "PDF generálás sikertelen: [hiba]"

## 5. Fájl struktúra

### Új fájlok

```
frontend/src/services/pdfExport.ts         — fő generáló függvény
frontend/src/services/pdfExport.utils.ts   — SVG→PNG, font betöltés, helper-ek
frontend/public/fonts/Roboto-Regular.ttf   — unicode font
frontend/public/fonts/Roboto-Bold.ttf      — unicode font bold
```

### Módosított fájlok

```
frontend/package.json                       — új függőségek
frontend/src/components/layout/Header.tsx   — PDF Export gomb
frontend/src/components/simulation/SimulationPanel.tsx  — onExportPdf callback
```

## 6. API felület

```typescript
// pdfExport.ts
export interface PdfExportInput {
  input: SimulationInput;
  result: SimulationResult;
  mpPrediction: MPPrediction;
  parties: Party[];
}

export async function exportSimulationPdf(data: PdfExportInput): Promise<void>;
```

## 7. Kockázatok és nyitott kérdések

- **Font méret:** a Roboto TTF ~170KB per variant, 2 variant = ~340KB bundle méret növekedés.
  Ha túl sok, használhatunk Helvetica-t és a magyar karakterek helyett ASCII megfelelőket
  (pl. "á" → "a") — de ez csúnya. Inkább vállaljuk a font méret költséget.

- **SVG térkép rögzítése:** a 106 poligon serializer-en át jó eséllyel működik,
  de ha gondot okoz, `html2canvas` fallback.

- **Többoldalas táblázatok:** `jspdf-autotable` natívan kezeli, de a fejléc sticky-zését
  és a sor háttérszínezést tesztelni kell.

- **Teljesítmény:** ~200 táblázat sor + 2 SVG kép → várhatóan 1-3 másodperc alatt generálódik.

## 8. Jóváhagyott döntések

A `brainstorming` során megválaszolt kérdések:

| Kérdés | Válasz |
|--------|--------|
| Melyik technikai opció? | **A) jsPDF + jspdf-autotable + html2canvas** |
| Gomb helye? | **Jobb felső header** |
| Opcionális extrák? | **1, 2, 3, 4 — igen / 5 — nem** |
| OEVK jelöltek szintje? | **Csak győztesek** |

## 9. Implementációs fázisok

### Fázis 1: Alapozás
- Függőségek telepítése
- Roboto font bekerül a `public/fonts/`-ba
- `pdfExport.ts` skeleton

### Fázis 2: Content building
- Borítólap + paraméterek
- Összesítő táblázat
- Lábléc minden oldalon

### Fázis 3: Vizualizációk
- SVG → PNG helper
- Patkó és térkép beillesztése

### Fázis 4: Nagy táblázatok
- 106 OEVK eredmény
- 93 listás mandátum pártonként
- 199 fős ABC lista

### Fázis 5: Függelék + integráció
- Történeti összehasonlítás
- JSON snapshot
- Swing statisztika
- Header gomb bekötése
- Tesztelés

---

*Ez a specifikáció a jóváhagyott alapdokumentum. Bármilyen eltérés az implementáció során a spec frissítését igényli.*
