import { PDFPage, PDFFont, rgb } from 'pdf-lib';

export const calculateBSA = (weight: string | number, height: string | number): string => {
  const w = parseFloat(weight?.toString().replace(',', '.') || '');
  let h = parseFloat(height?.toString().replace(',', '.') || '');
  if (!isNaN(h) && h > 0 && h < 3) h = Math.round(h * 100);
  if (!isNaN(w) && !isNaN(h) && w > 0 && w <= 350 && h >= 40 && h <= 250) {
    return Math.sqrt((w * h) / 3600).toFixed(2);
  }
  return '';
};

export const cleanDate = (val: string): string => {
  if (!val) return '';
  const match = val.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (match) return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  return val.trim();
};

export interface LineSpec {
  x: number;
  y: number;
  width: number;
}

export const drawOnLines = (
  page: PDFPage,
  text: string,
  lines: LineSpec[],
  font: PDFFont,
  fontSize = 8,
  color = rgb(0, 0, 0)
) => {
  if (!text?.trim() || lines.length === 0) return;

  const words = text.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  let wordIdx = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    if (wordIdx >= words.length) break;

    const line = lines[lineIdx];
    let currentLineText = '';

    while (wordIdx < words.length) {
      const nextWord = words[wordIdx];
      const testText = currentLineText ? `${currentLineText} ${nextWord}` : nextWord;
      const testWidth = font.widthOfTextAtSize(testText, fontSize);

      if (testWidth <= line.width) {
        currentLineText = testText;
        wordIdx++;
      } else {
        // Si una sola palabra excede el ancho de la línea, forzar corte
        if (!currentLineText) {
          currentLineText = nextWord;
          wordIdx++;
        }
        break;
      }
    }

    if (currentLineText) {
      page.drawText(currentLineText, {
        x: line.x,
        y: line.y,
        size: fontSize,
        font,
        color
      });
    }
  }
};

export const drawTextAt = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize = 8.5,
  color = rgb(0, 0, 0)
) => {
  if (!text || !String(text).trim()) return;
  page.drawText(String(text).trim(), {
    x,
    y,
    size: fontSize,
    font,
    color
  });
};

export const drawMark = (
  page: PDFPage,
  x: number,
  y: number,
  size = 10,
  font?: PDFFont,
  color = rgb(0, 0, 0)
) => {
  if (font) {
    page.drawText('X', {
      x,
      y,
      size,
      font,
      color
    });
  } else {
    page.drawLine({
      start: { x, y },
      end: { x: x + size, y: y + size },
      thickness: 1.2,
      color
    });
    page.drawLine({
      start: { x, y: y + size },
      end: { x: x + size, y },
      thickness: 1.2,
      color
    });
  }
};
