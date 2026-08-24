import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';

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

export const wrapText = (
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont
): string[] => {
  if (!text) return [];
  const words = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
};

export const drawWrappedTextLines = (
  page: PDFPage,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  maxLines: number,
  lineHeight: number,
  fontSize: number,
  font: PDFFont,
  color = rgb(0.1, 0.1, 0.1)
): number => {
  if (!text?.trim()) return startY;
  const lines = wrapText(text.trim(), maxWidth, fontSize, font);
  const visibleLines = lines.slice(0, maxLines);

  visibleLines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: startY - index * lineHeight,
      size: fontSize,
      font,
      color,
    });
  });

  return startY - visibleLines.length * lineHeight;
};

export const drawCheckbox = (
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  checked: boolean,
  label?: string,
  font?: PDFFont,
  fontSize = 9
) => {
  // Draw square box
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  if (checked) {
    // Draw cross 'X' inside box
    const inset = size * 0.2;
    page.drawLine({
      start: { x: x + inset, y: y + inset },
      end: { x: x + size - inset, y: y + size - inset },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: x + inset, y: y + size - inset },
      end: { x: x + size - inset, y: y + inset },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });
  }

  if (label && font) {
    page.drawText(label, {
      x: x + size + 4,
      y: y + 1.5,
      size: fontSize,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
  }
};

export const tryEmbedHeaderLogo = async (
  pdfDoc: PDFDocument,
  page: PDFPage,
  yPos: number,
  maxHeight = 35
): Promise<number> => {
  try {
    const logoUrl = window.location.origin + '/img/header_logo.png';
    const res = await fetch(logoUrl);
    if (res.ok) {
      const bytes = await res.arrayBuffer();
      const png = await pdfDoc.embedPng(bytes);
      const scale = maxHeight / png.height;
      const width = png.width * scale;
      const height = png.height * scale;
      const { width: pageWidth } = page.getSize();
      page.drawImage(png, {
        x: (pageWidth - width) / 2,
        y: yPos - height,
        width,
        height,
      });
      return yPos - height - 12;
    }
  } catch {
    // Fallback if logo not found
  }
  return yPos;
};
