/**
 * PDF export a szimulációs eredményekhez.
 *
 * Tartalom:
 *  1. Borítólap — cím, dátum, paraméterek
 *  2. Mandátum összesítő — táblázat + többség/kétharmad
 *  3. Parlamenti patkó — SVG kép
 *  4. Magyarország térkép — SVG kép
 *  5. OEVK eredmények — 106 sor
 *  6. Listás bejutók pártonként
 *  7. Teljes 199 fős parlament — ABC rendben
 *  8. Függelék — történeti összehasonlítás, JSON snapshot, swing statisztika, források
 *
 * Használat:
 *   await exportSimulationPdf({ input, result, mpPrediction, parties });
 */

// jspdf + jspdf-autotable dinamikusan töltődik be az exportSimulationPdf-ben,
// hogy ne bloat-olja a kezdeti bundle-t (~800KB megspórolva).
// bundle-dynamic-imports best practice szerint.
import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import type {
  Party,
  SimulationInput,
  SimulationResult,
  MPPrediction,
} from '../types/election';

// Dinamikusan betöltött autoTable függvény — a fő export-nál kapjuk értéket
type AutoTableFn = (doc: jsPDF, options: UserOptions) => void;
let autoTable: AutoTableFn = () => {
  throw new Error('autoTable not loaded yet');
};
import {
  svgToPngDataUrl,
  generateQrCode,
  formatDateTime,
  formatFileDateTime,
  hexToRgb,
  asciiFold as af,
} from './pdfExport.utils';

export interface PdfExportInput {
  input: SimulationInput;
  result: SimulationResult;
  mpPrediction: MPPrediction;
  parties: Party[];
}

// A4 méretek mm-ben
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const COLORS = {
  text: [20, 20, 30] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  border: [209, 213, 219] as [number, number, number],
  headerBg: [31, 41, 55] as [number, number, number],
  headerText: [243, 244, 246] as [number, number, number],
};

/**
 * Segéd: párt név lekérése id alapján
 */
function partyName(parties: Party[], id: string): string {
  const p = parties.find(x => x.id === id);
  return p?.short_name || id;
}

function partyFullName(parties: Party[], id: string): string {
  const p = parties.find(x => x.id === id);
  return p?.full_name || p?.short_name || id;
}

function partyColor(parties: Party[], id: string): string {
  const p = parties.find(x => x.id === id);
  return p?.color || '#999999';
}

// ================= Fázis 2: Borítólap + összesítő + lábléc =================

/**
 * Fejléc és lábléc minden oldalra.
 */
function addHeaderFooter(doc: jsPDF, totalPagesRef: { count: number }, dateStr: string) {
  const pageCount = doc.getNumberOfPages();
  totalPagesRef.count = pageCount;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Fejléc vonal
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 10, PAGE_W - MARGIN, 10);

    // Fejléc szöveg
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(af('Választási Modellező 2026'), MARGIN, 8);
    doc.text(dateStr, PAGE_W - MARGIN, 8, { align: 'right' });

    // Lábléc vonal
    doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);

    // Lábléc szöveg
    doc.text(
      af('Szimulációs eszköz — nem előrejelzés. Forrás: valasztas.hu, vtr.valasztas.hu'),
      MARGIN,
      PAGE_H - 6
    );
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
  }
}

/**
 * 1. Borítólap
 */
async function addCoverPage(doc: jsPDF, data: PdfExportInput, dateStr: string) {
  const { input, parties } = data;

  let y = 30;

  // Színes fejléc sáv
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, PAGE_W, 50, 'F');

  // Főcím
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Választási Szimuláció'), MARGIN, 25);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(af('Magyarország — 2026'), MARGIN, 35);

  // Dátum
  doc.setFontSize(10);
  doc.text(dateStr, PAGE_W - MARGIN, 25, { align: 'right' });

  y = 65;
  doc.setTextColor(...COLORS.text);

  // QR kód — repo link
  try {
    const qrUrl = await generateQrCode('https://github.com/ZoliQua/Magyar-Valasztas-Modellezo', 100);
    doc.addImage(qrUrl, 'PNG', PAGE_W - MARGIN - 30, y, 30, 30);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(af('Forráskód:'), PAGE_W - MARGIN - 30, y + 34);
    doc.text('github.com/ZoliQua', PAGE_W - MARGIN - 30, y + 37);
  } catch {
    // ha nincs QR
  }

  doc.setTextColor(...COLORS.text);

  // Szimulációs paraméterek
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Szimulációs paraméterek'), MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const paramLines = [
    [af('Bázisév:'), `${input.baseYear}`],
    [af('Swing mód:'), input.swingMode === 'auto_swing' ? af('Egyedi swing (OEVK szint)') : af('Csak országos')],
    [af('Részvételi arány:'), `${input.turnoutPct.toFixed(1)}%`],
  ];
  for (const [label, value] of paramLines) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MARGIN + 40, y);
    y += 6;
  }

  y += 5;

  // Listás támogatottság táblázat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(af('Beállított listás támogatottság'), MARGIN, y);
  y += 3;

  const listShareRows = Object.entries(input.listShares)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([pid, v]) => [af(partyName(parties, pid)), `${v.toFixed(1)}%`]);

  autoTable(doc, {
    startY: y,
    head: [[af('Párt'), af('Támogatottság')]],
    body: listShareRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    margin: { left: MARGIN, right: PAGE_W - MARGIN - 120 },
  });

  // Uniform swing értékek, ha van
  const swingEntries = Object.entries(input.uniformSwing || {}).filter(([, v]) => v !== 0);
  if (swingEntries.length > 0 && input.swingMode === 'national') {
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    y = lastY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(af('Uniform swing értékek'), MARGIN, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [[af('Párt'), af('Swing')]],
      body: swingEntries.map(([pid, v]) => [
        af(partyName(parties, pid)),
        `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText },
      columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
      margin: { left: MARGIN, right: PAGE_W - MARGIN - 120 },
    });
  }

  // Alsó magyarázat
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'italic');
  const disclaimer = af(
    'Ez egy modellező eszköz, nem előrejelzés. A uniform swing modell feltételezi, hogy az országos változás ' +
    'minden körzetben egyformán érvényesül, ami a valóságban nem igaz. Az OEVK-szintű eredmények becslések.'
  );
  const lines = doc.splitTextToSize(disclaimer, CONTENT_W);
  doc.text(lines, MARGIN, PAGE_H - 20);
}

/**
 * 2. Mandátum összesítő oldal
 */
function addSummaryPage(doc: jsPDF, data: PdfExportInput) {
  const { result, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Mandátum összesítő'), MARGIN, y);
  y += 10;

  // Többség / kétharmad jelzés
  const majorityPartyId = result.majority;
  const majoritySeats = majorityPartyId ? result.totalSeats[majorityPartyId] || 0 : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  if (majorityPartyId) {
    const majParty = partyFullName(parties, majorityPartyId);
    const [r, g, b] = hexToRgb(partyColor(parties, majorityPartyId));
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const status = result.supermajority ? af('KÉTHARMADOS TÖBBSÉG') : af('EGYSZERŰ TÖBBSÉG');
    doc.text(
      `${status}:  ${af(majParty)}  —  ${majoritySeats} / 199`,
      PAGE_W / 2,
      y + 8,
      { align: 'center' }
    );
    y += 18;
  } else {
    doc.setFillColor(200, 200, 200);
    doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(af('NINCS TÖBBSÉG — Egyik párt sem éri el a 100 mandátumot'), PAGE_W / 2, y + 8, { align: 'center' });
    y += 18;
  }

  doc.setTextColor(...COLORS.text);

  // Mandátum táblázat
  const sortedParties = Object.keys(result.totalSeats)
    .filter(p => (result.totalSeats[p] || 0) > 0)
    .sort((a, b) => (result.totalSeats[b] || 0) - (result.totalSeats[a] || 0));

  const tableRows = sortedParties.map(p => [
    af(partyName(parties, p)),
    `${result.oevkSeats[p] || 0}`,
    `${result.listSeats[p] || 0}`,
    `${result.totalSeats[p] || 0}`,
    Math.round((result.fragmentVotes[p] || 0) / 1000) + 'k',
  ]);

  // Összesítő sor
  const totalOevk = Object.values(result.oevkSeats).reduce((a, b) => a + b, 0);
  const totalList = Object.values(result.listSeats).reduce((a, b) => a + b, 0);
  const totalAll = Object.values(result.totalSeats).reduce((a, b) => a + b, 0);

  autoTable(doc, {
    startY: y,
    head: [[af('Párt'), 'OEVK', af('Lista'), af('Összesen'), af('Töredékszav.')]],
    body: tableRows,
    foot: [[af('Összesen'), `${totalOevk}`, `${totalList}`, `${totalAll}`, '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, halign: 'center' },
    footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right', textColor: COLORS.muted },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (cellData) => {
      // Sor háttér színezése a pártszín alapján (csak body)
      if (cellData.section === 'body' && cellData.column.index === 0) {
        const rowIdx = cellData.row.index;
        const partyId = sortedParties[rowIdx];
        if (partyId) {
          const [r, g, b] = hexToRgb(partyColor(parties, partyId));
          cellData.cell.styles.fillColor = [
            Math.round(r * 0.15 + 255 * 0.85),
            Math.round(g * 0.15 + 255 * 0.85),
            Math.round(b * 0.15 + 255 * 0.85),
          ];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Magyarázat
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'italic');
  doc.text(af('• Egyszerű többséghez 100, kétharmadhoz 133 mandátum szükséges.'), MARGIN, finalY + 8);
  doc.text(af('• A töredékszavazatok a D\'Hondt mandátumelosztás előtti listás szavazatokhoz adódnak hozzá.'), MARGIN, finalY + 13);
}

// ================= Fázis 3: Vizualizációk =================

/**
 * 3. Parlamenti patkó oldal
 */
async function addHemicyclePage(doc: jsPDF, data: PdfExportInput) {
  const { result, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Parlamenti patkó'), MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(af('199 mandátum félkör diagram — prediktált parlamenti összetétel'), MARGIN, y);
  y += 8;

  // SVG keresés a DOM-ban: a HemicycleChart SVG-je
  const hemicycleSvg = document.querySelector<SVGElement>(
    'svg[viewBox="0 0 600 340"]'
  );

  if (hemicycleSvg) {
    try {
      const png = await svgToPngDataUrl(hemicycleSvg, 3);
      // A/4 szélesség ~180mm, patkó aránya 600:340 ~ 1.76
      const imgW = 160;
      const imgH = imgW * (340 / 600);
      const imgX = (PAGE_W - imgW) / 2;
      doc.addImage(png, 'PNG', imgX, y, imgW, imgH);
      y += imgH + 8;
    } catch (err) {
      doc.setFontSize(9);
      doc.setTextColor(200, 50, 50);
      doc.text(af('Térkép rögzítése sikertelen: ') + (err instanceof Error ? err.message : '?'), MARGIN, y);
      y += 10;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(af('Patkó SVG nem található a DOM-ban.'), MARGIN, y);
    y += 10;
  }

  doc.setTextColor(...COLORS.text);

  // Jelmagyarázat
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Jelmagyarázat'), MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const activeParties = Object.entries(result.totalSeats)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  let legendX = MARGIN;
  for (const [pid, seats] of activeParties) {
    const [r, g, b] = hexToRgb(partyColor(parties, pid));
    doc.setFillColor(r, g, b);
    doc.rect(legendX, y - 3, 4, 4, 'F');
    const label = `${af(partyName(parties, pid))}: ${seats}`;
    doc.text(label, legendX + 5, y);
    const textWidth = doc.getTextWidth(label);
    legendX += 5 + textWidth + 8;
    if (legendX > PAGE_W - MARGIN - 40) {
      legendX = MARGIN;
      y += 6;
    }
  }
  y += 10;

  // Magyarázat a vonalakról
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'italic');
  doc.text(
    af('A szaggatott vonalak az egyszerű többség (100 mandátum) és a kétharmad (133 mandátum) határát jelölik.'),
    MARGIN,
    y
  );
}

/**
 * 4. Magyarország térkép oldal
 */
async function addMapPage(doc: jsPDF, data: PdfExportInput) {
  const { result, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Magyarország térkép'), MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(af('106 egyéni választókerület — győztesek'), MARGIN, y);
  y += 8;

  // Térkép SVG keresése
  const mapSvg = document.querySelector<SVGElement>('svg[viewBox="0 0 800 450"]');

  if (mapSvg) {
    try {
      const png = await svgToPngDataUrl(mapSvg, 2.5);
      const imgW = 180;
      const imgH = imgW * (450 / 800);
      const imgX = (PAGE_W - imgW) / 2;
      doc.addImage(png, 'PNG', imgX, y, imgW, imgH);
      y += imgH + 8;
    } catch (err) {
      doc.setFontSize(9);
      doc.setTextColor(200, 50, 50);
      doc.text(af('Térkép rögzítése sikertelen: ') + (err instanceof Error ? err.message : '?'), MARGIN, y);
      y += 10;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(af('Térkép SVG nem található. Nyisd meg a Modellezés oldalt a PDF generálása előtt.'), MARGIN, y);
    y += 10;
  }

  doc.setTextColor(...COLORS.text);

  // Jelmagyarázat + szín intenzitás magyarázat
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Pártok'), MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const activeParties = new Set<string>();
  for (const o of result.oevkResults) activeParties.add(o.winner_party);

  let legendX = MARGIN;
  for (const pid of Array.from(activeParties)) {
    const [r, g, b] = hexToRgb(partyColor(parties, pid));
    doc.setFillColor(r, g, b);
    doc.rect(legendX, y - 3, 4, 4, 'F');
    const label = af(partyName(parties, pid));
    doc.text(label, legendX + 5, y);
    legendX += 5 + doc.getTextWidth(label) + 8;
  }
  y += 8;

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'italic');
  doc.text(
    af('Szín intenzitás: halvány = szoros verseny (< 5%), közepes = 5-15%, erős = biztos győzelem (> 15%)'),
    MARGIN,
    y
  );
}

// ================= Fázis 4: Nagy táblázatok =================

/**
 * 5. OEVK eredmények — 106 soros táblázat
 */
function addOevkResultsPage(doc: jsPDF, data: PdfExportInput) {
  const { result, mpPrediction, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('OEVK eredmények'), MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(af('106 egyéni választókerület győztese — vármegye szerint rendezve'), MARGIN, y);
  y += 6;

  // OEVK-k rendezése vármegye + oevk név szerint
  const sorted = [...result.oevkResults].sort((a, b) => {
    const cmp = a.county.localeCompare(b.county, 'hu');
    return cmp !== 0 ? cmp : a.display_name.localeCompare(b.display_name, 'hu');
  });

  // Jelölt nevek párosítása az MP prediction-ből (OEVK forrás)
  const winnerNames: Record<string, string> = {};
  for (const mp of mpPrediction.mps) {
    if (mp.source === 'oevk' && mp.oevk_id) {
      winnerNames[mp.oevk_id] = mp.name;
    }
  }

  const rows = sorted.map(o => {
    const winnerShare = o.results[0]?.vote_share_pct || 0;
    return [
      af(o.display_name),
      af(o.county),
      af(winnerNames[o.oevk_id] || '-'),
      af(partyName(parties, o.winner_party)),
      `${winnerShare.toFixed(1)}%`,
      `${o.margin.toFixed(1)}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[af('OEVK'), af('Vármegye'), af('Győztes jelölt'), af('Párt'), '%', 'Margin']],
    body: rows,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 32 },
      2: { cellWidth: 55 },
      3: { cellWidth: 25 },
      4: { halign: 'right', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 18 },
    },
    margin: { left: MARGIN, right: MARGIN, top: 15, bottom: 15 },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 3) {
        const rowIdx = cellData.row.index;
        const o = sorted[rowIdx];
        if (o) {
          const [r, g, b] = hexToRgb(partyColor(parties, o.winner_party));
          cellData.cell.styles.fillColor = [
            Math.round(r * 0.2 + 255 * 0.8),
            Math.round(g * 0.2 + 255 * 0.8),
            Math.round(b * 0.2 + 255 * 0.8),
          ];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
      // Margin szín
      if (cellData.section === 'body' && cellData.column.index === 5) {
        const rowIdx = cellData.row.index;
        const o = sorted[rowIdx];
        if (o) {
          if (o.margin < 5) cellData.cell.styles.textColor = [200, 50, 50];
          else if (o.margin < 15) cellData.cell.styles.textColor = [180, 130, 0];
          else cellData.cell.styles.textColor = [30, 130, 30];
        }
      }
    },
  });
}

/**
 * 6. Listás bejutók pártonként
 */
async function addListWinnersPage(doc: jsPDF, data: PdfExportInput) {
  const { result, mpPrediction, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Listás bejutók pártonként'), MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(af('93 listás mandátum D\'Hondt elosztás után — bejutó sorszám szerint'), MARGIN, y);
  y += 8;

  // Listás MP-k csoportosítva pártonként
  const listaByParty: Record<string, typeof mpPrediction.mps> = {};
  for (const mp of mpPrediction.mps) {
    if (mp.source === 'lista') {
      if (!listaByParty[mp.party_id]) listaByParty[mp.party_id] = [];
      listaByParty[mp.party_id].push(mp);
    }
  }

  // Pártok mandátumszám szerint csökkenő
  const sortedPartyIds = Object.keys(listaByParty).sort(
    (a, b) => (result.listSeats[b] || 0) - (result.listSeats[a] || 0)
  );

  for (const pid of sortedPartyIds) {
    const mps = listaByParty[pid] || [];
    if (mps.length === 0) continue;

    // Oldaltörés ha nem fér ki
    if (y > PAGE_H - 50) {
      doc.addPage();
      y = 20;
    }

    const [r, g, b] = hexToRgb(partyColor(parties, pid));
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `${af(partyFullName(parties, pid))}  —  ${mps.length} listás mandátum`,
      MARGIN + 2,
      y + 5.5
    );
    y += 10;

    const rows = mps.map((mp, i) => [
      `${i + 1}.`,
      mp.original_list_position ? `#${mp.original_list_position}` : '-',
      af(mp.name),
    ]);

    autoTable(doc, {
      startY: y,
      head: [[af('Bejutó'), af('Lista poz.'), af('Név')]],
      body: rows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 100, 110], textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { halign: 'right', cellWidth: 20 },
        1: { halign: 'right', cellWidth: 25, textColor: COLORS.muted },
        2: { cellWidth: 'auto' },
      },
      margin: { left: MARGIN, right: MARGIN, top: 15, bottom: 15 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
}

/**
 * 7. Teljes 199 fős parlament — ABC rendben
 */
function addFullParliamentPage(doc: jsPDF, data: PdfExportInput) {
  const { mpPrediction, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Teljes Országgyűlés'), MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(
    af(`199 prediktált képviselő — név szerint rendezve`),
    MARGIN,
    y
  );
  y += 8;

  // ABC rendben
  const sorted = [...mpPrediction.mps].sort((a, b) => a.name.localeCompare(b.name, 'hu'));

  const rows = sorted.map((mp, i) => {
    let source = '';
    if (mp.source === 'oevk') {
      source = af(mp.oevk_name || mp.oevk_id || 'OEVK');
    } else {
      source = `Lista #${mp.list_position}` +
        (mp.original_list_position && mp.original_list_position !== mp.list_position
          ? ` (ered. #${mp.original_list_position})`
          : '');
    }
    return [
      `${i + 1}`,
      af(mp.name),
      af(partyName(parties, mp.party_id)),
      source,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', af('Név'), af('Párt'), af('Forrás')]],
    body: rows,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontSize: 9 },
    columnStyles: {
      0: { halign: 'right', cellWidth: 12, textColor: COLORS.muted },
      1: { cellWidth: 65 },
      2: { cellWidth: 35 },
      3: { cellWidth: 'auto' },
    },
    margin: { left: MARGIN, right: MARGIN, top: 15, bottom: 15 },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 2) {
        const rowIdx = cellData.row.index;
        const mp = sorted[rowIdx];
        if (mp) {
          const [r, g, b] = hexToRgb(partyColor(parties, mp.party_id));
          cellData.cell.styles.fillColor = [
            Math.round(r * 0.2 + 255 * 0.8),
            Math.round(g * 0.2 + 255 * 0.8),
            Math.round(b * 0.2 + 255 * 0.8),
          ];
        }
      }
    },
  });
}

// ================= Fázis 5: Függelék =================

/**
 * 2022 tényleges mandátum eredmények (valasztas.hu hivatalos adat)
 * A 199-es rendszerben.
 */
const ACTUAL_2022: Record<string, { oevk: number; list: number }> = {
  fidesz_kdnp: { oevk: 87, list: 48 },
  egyseges_ellenzek: { oevk: 19, list: 38 }, // ez a tisza elődje 2026-ra
  mi_hazank: { oevk: 0, list: 6 },
  other: { oevk: 0, list: 1 }, // nemzetiségi
};

/**
 * 8. Függelék: történeti összehasonlítás + JSON snapshot + swing statisztika + források
 */
function addAppendixPage(doc: jsPDF, data: PdfExportInput) {
  const { input, result, parties } = data;

  doc.addPage();
  let y = 20;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Függelék'), MARGIN, y);
  y += 10;

  // --- 1. Történeti összehasonlítás: 2022 tény vs 2026 projekció ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(af('2022 tényleges vs. 2026 projekció'), MARGIN, y);
  y += 4;

  // Megfeleltetés: egyseges_ellenzek (2022) → tisza (2026)
  const compareRows: (string | number)[][] = [];
  const partiesToCompare = ['fidesz_kdnp', 'tisza', 'mi_hazank', 'other'];

  for (const pid of partiesToCompare) {
    const actual = pid === 'tisza' ? ACTUAL_2022.egyseges_ellenzek : ACTUAL_2022[pid];
    if (!actual) continue;
    const actualTotal = actual.oevk + actual.list;
    const projection = result.totalSeats[pid] || 0;
    const delta = projection - actualTotal;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

    compareRows.push([
      af(partyName(parties, pid)) + (pid === 'tisza' ? af(' (2022: Egys. ell.)') : ''),
      `${actualTotal}`,
      `${actual.oevk}`,
      `${actual.list}`,
      `${projection}`,
      `${result.oevkSeats[pid] || 0}`,
      `${result.listSeats[pid] || 0}`,
      deltaStr,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [[
      af('Párt'),
      af('2022 össz'),
      '2022 OEVK',
      af('2022 lista'),
      af('2026 projekció'),
      '2026 OEVK',
      af('2026 lista'),
      af('Változás'),
    ]],
    body: compareRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 7) {
        const txt = String(cellData.cell.raw || '');
        if (txt.startsWith('+')) cellData.cell.styles.textColor = [30, 130, 30];
        else if (txt.startsWith('-')) cellData.cell.styles.textColor = [200, 50, 50];
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'italic');
  doc.text(
    af('Megjegyzés: 2022-ben az Egységes Ellenzék nyerte el a nem-Fidesz mandátumokat. 2026-ra a Tisza vette át ezt a szerepet.'),
    MARGIN,
    y
  );
  y += 8;

  // --- 2. OEVK swing statisztika ---
  if (y > PAGE_H - 80) { doc.addPage(); y = 20; }
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(af('OEVK szintű swing statisztika'), MARGIN, y);
  y += 6;

  const margins = result.oevkResults.map(o => o.margin);
  const avgMargin = margins.reduce((s, m) => s + m, 0) / (margins.length || 1);
  const tightCount = margins.filter(m => m < 5).length;
  const safeCount = margins.filter(m => m > 15).length;
  const mediumCount = margins.length - tightCount - safeCount;

  // Top 5 legszorosabb
  const tightest = [...result.oevkResults].sort((a, b) => a.margin - b.margin).slice(0, 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const statLines = [
    [af('Átlagos margin:'), `${avgMargin.toFixed(1)}%`],
    [af('Szoros körzetek (< 5%):'), `${tightCount}`],
    [af('Közepes (5-15%):'), `${mediumCount}`],
    [af('Biztos körzetek (> 15%):'), `${safeCount}`],
  ];
  for (const [label, value] of statLines) {
    doc.setFont('helvetica', 'normal');
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, MARGIN + 60, y);
    y += 5;
  }
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(af('Legszorosabb 5 körzet'), MARGIN, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [[af('OEVK'), af('Vármegye'), af('Győztes'), 'Margin']],
    body: tightest.map(o => [
      af(o.display_name),
      af(o.county),
      af(partyName(parties, o.winner_party)),
      `${o.margin.toFixed(1)}%`,
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontSize: 8 },
    columnStyles: { 3: { halign: 'right', textColor: [200, 50, 50], fontStyle: 'bold' } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // --- 3. Szimulációs bemenet JSON snapshot ---
  if (y > PAGE_H - 60) { doc.addPage(); y = 20; }
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(af('Szimulációs bemenet (reprodukálhatósághoz)'), MARGIN, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.setTextColor(...COLORS.text);
  const jsonStr = JSON.stringify(input, null, 2);
  const jsonLines = jsonStr.split('\n').map(line => af(line));

  // Háttér keret
  const boxHeight = Math.min(jsonLines.length * 3.2 + 4, PAGE_H - y - 30);
  doc.setFillColor(245, 245, 250);
  doc.rect(MARGIN, y, CONTENT_W, boxHeight, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGIN, y, CONTENT_W, boxHeight, 'S');

  let lineY = y + 4;
  for (const line of jsonLines) {
    if (lineY > y + boxHeight - 2) break;
    doc.text(line, MARGIN + 2, lineY);
    lineY += 3.2;
  }
  y += boxHeight + 6;

  // --- 4. Adatforrások ---
  if (y > PAGE_H - 50) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(af('Adatforrások'), MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const sources = [
    af('• 2022 választási eredmények: vtr.valasztas.hu/ogy2022 (Nemzeti Választási Iroda JSON API)'),
    af('• 2018 OEVK eredmények: beágyazva a 2022-es VTR-ben (ElozoOevkEredmenyek.json)'),
    af('• 2014 listás eredmények: static.valasztas.hu (valasztasi_eredmenyek_1990-2024.zip)'),
    af('• 2026 OEVK definíciók és települések: vtr.valasztas.hu/stat (106 OEVK, 3207 település)'),
    af('• 2026 egyéni + listás jelöltek: vtr.valasztas.hu/ogy2026 (651 OEVK + 875 listás)'),
    af('• OEVK határok térkép: static.valasztas.hu/dyn/oevk_data/oevk.json (106 poligon)'),
    af('• Közvélemény-kutatások: EN Wikipedia (Opinion polling for the 2026 Hungarian parliamentary election)'),
  ];
  for (const s of sources) {
    doc.text(s, MARGIN, y);
    y += 5;
  }
  y += 4;

  // --- 5. Disclaimer ---
  doc.setFillColor(254, 243, 199);
  doc.rect(MARGIN, y, CONTENT_W, 25, 'F');
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, 25, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(120, 80, 0);
  doc.text(af('Figyelmeztetés'), MARGIN + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 60, 0);
  const disclaimer = af(
    'Ez egy modellező eszköz, nem előrejelzés. A uniform swing modell feltételezi, hogy az országos változás ' +
    'minden körzetben egyformán érvényesül, ami a valóságban nem igaz. Az OEVK-szintű eredmények becslések, ' +
    'különösen a 2026-ra átrajzolt körzetekben. A közvélemény-kutatások mintavételi hibával terheltek.'
  );
  const lines = doc.splitTextToSize(disclaimer, CONTENT_W - 6);
  doc.text(lines, MARGIN + 3, y + 10);
}

// ================= Fő export függvény =================

export async function exportSimulationPdf(data: PdfExportInput): Promise<void> {
  // Dinamikus import — a PDF könyvtárak csak gombnyomáskor töltődnek be
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const JsPDF = jsPdfModule.default;
  autoTable = autoTableModule.default as AutoTableFn;

  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('helvetica', 'normal');

  const now = new Date();
  const dateStr = formatDateTime(now);

  // 1. Borítólap
  await addCoverPage(doc, data, dateStr);

  // 2. Összesítő
  addSummaryPage(doc, data);

  // 3. Parlamenti patkó
  await addHemicyclePage(doc, data);

  // 4. Magyarország térkép
  await addMapPage(doc, data);

  // 5. OEVK eredmények
  addOevkResultsPage(doc, data);

  // 6. Listás bejutók pártonként
  await addListWinnersPage(doc, data);

  // 7. Teljes 199 fős parlament
  addFullParliamentPage(doc, data);

  // 8. Függelék
  addAppendixPage(doc, data);

  // Fejléc / lábléc minden oldalra
  const pagesRef = { count: 0 };
  addHeaderFooter(doc, pagesRef, dateStr);

  // Mentés
  const filename = `valasztas_szimulacio_${formatFileDateTime(now)}.pdf`;
  doc.save(filename);
}
