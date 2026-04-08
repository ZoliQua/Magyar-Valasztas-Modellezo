/**
 * PDF export segédfüggvények.
 *
 * - SVG → PNG konverzió canvas-en keresztül
 * - QR kód generálás
 * - Formázók
 */

import QRCode from 'qrcode';

/**
 * SVG elem kirajzolása canvas-re majd PNG data URI-vá alakítás.
 * @param svg — a forrás SVG elem (pl. document.querySelector('svg'))
 * @param scale — felbontás szorzó (2 = kétszeres minőség)
 */
export async function svgToPngDataUrl(svg: SVGElement, scale = 2): Promise<string> {
  const serializer = new XMLSerializer();
  let svgStr = serializer.serializeToString(svg);

  // XML namespace biztosítása, ha hiányzik
  if (!svgStr.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgStr = svgStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Méret meghatározása: viewBox → width/height
  const viewBox = svg.getAttribute('viewBox');
  let width = parseInt(svg.getAttribute('width') || '0', 10);
  let height = parseInt(svg.getAttribute('height') || '0', 10);
  if ((!width || !height) && viewBox) {
    const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
    width = vbW;
    height = vbH;
  }
  if (!width || !height) {
    const rect = svg.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Nem sikerült canvas kontextust létrehozni');

  // Sötét háttér a PDF-hez
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG betöltési hiba'));
    img.src = dataUrl;
  });

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/**
 * QR kód generálás data URI-ként.
 */
export async function generateQrCode(text: string, size = 100): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
  });
}

/**
 * Dátum formázás: YYYY.MM.DD HH:MM
 */
export function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Dátum formázás fájlnévhez: YYYY-MM-DD_HHMM
 */
export function formatFileDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * Hex szín → RGB array (jsPDF-hez)
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Magyar ékezetes karakterek ASCII-re cserélése.
 * A jsPDF alapértelmezett Helvetica nem támogatja a teljes Unicode-ot,
 * ezért átalakítjuk az ékezeteket — ez egy bridge megoldás,
 * amíg nincs Unicode font embed.
 */
export function asciiFold(text: string): string {
  if (!text) return '';
  return text
    .replace(/[áÁ]/g, c => c === 'Á' ? 'A' : 'a')
    .replace(/[éÉ]/g, c => c === 'É' ? 'E' : 'e')
    .replace(/[íÍ]/g, c => c === 'Í' ? 'I' : 'i')
    .replace(/[óÓ]/g, c => c === 'Ó' ? 'O' : 'o')
    .replace(/[öÖ]/g, c => c === 'Ö' ? 'O' : 'o')
    .replace(/[őŐ]/g, c => c === 'Ő' ? 'O' : 'o')
    .replace(/[úÚ]/g, c => c === 'Ú' ? 'U' : 'u')
    .replace(/[üÜ]/g, c => c === 'Ü' ? 'U' : 'u')
    .replace(/[űŰ]/g, c => c === 'Ű' ? 'U' : 'u');
}
