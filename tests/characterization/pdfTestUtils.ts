import fs from 'fs';
import path from 'path';
import { vi } from 'vitest';
import { PDFDocument, PDFPage, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { MOCK_FICTITIOUS_DOCTOR } from './fixtures/fictitiousData';

export interface AcroFormRecord {
  type: 'setText' | 'setFontSize' | 'check' | 'uncheck';
  field: string;
  value?: string | number | boolean;
}

export interface DrawTextRecord {
  page: number;
  text: string;
  x?: number;
  y?: number;
  size?: number;
  maxWidth?: number;
  lineHeight?: number;
  color?: string;
}

export interface DrawLineRecord {
  page: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness?: number;
}

export class PdfCharacterizationRecorder {
  acroFormRecords: AcroFormRecord[] = [];
  drawTextRecords: DrawTextRecord[] = [];
  drawLineRecords: DrawLineRecord[] = [];

  private spies: Array<{ mockRestore: () => void }> = [];

  install() {
    this.reset();

    // Etiquetado de páginas al recuperarlas o crearlas
    const origGetPages = PDFDocument.prototype.getPages;
    const origAddPage = PDFDocument.prototype.addPage;

    const getPagesSpy = vi.spyOn(PDFDocument.prototype, 'getPages').mockImplementation(function (this: PDFDocument) {
      const pages = origGetPages.call(this);
      pages.forEach((p, idx) => {
        (p as any).__pageIndex = idx + 1;
      });
      return pages;
    });

    const addPageSpy = vi.spyOn(PDFDocument.prototype, 'addPage').mockImplementation(function (this: PDFDocument, ...args: any[]) {
      const page = (origAddPage as any).apply(this, args);
      const allPages = origGetPages.call(this);
      (page as any).__pageIndex = allPages.length;
      return page;
    });

    const origLoad = PDFDocument.load;
    const loadSpy = vi.spyOn(PDFDocument, 'load').mockImplementation(function (pdf: any, options: any) {
      // Si pdf proviene de otro realm de VM en jsdom y no pasa instanceof, normalizarlo al Uint8Array esperado
      let safePdf = pdf;
      if (!(pdf instanceof Uint8Array) && !(pdf instanceof ArrayBuffer) && typeof pdf !== 'string') {
        if (pdf && pdf.buffer) {
          safePdf = new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
        } else if (pdf && (pdf instanceof (window.ArrayBuffer || ArrayBuffer) || pdf.byteLength !== undefined)) {
          safePdf = new Uint8Array(pdf);
        }
      }
      return origLoad.call(PDFDocument, safePdf, options);
    });
    this.spies.push(loadSpy);

    // Espías para AcroForm (PAMI, Admisión, Renovación)
    const origSetText = PDFTextField.prototype.setText;
    const origSetFontSize = PDFTextField.prototype.setFontSize;
    const origCheck = PDFCheckBox.prototype.check;
    const origUncheck = PDFCheckBox.prototype.uncheck;

    const setTextSpy = vi.spyOn(PDFTextField.prototype, 'setText').mockImplementation(function (this: PDFTextField, text: string) {
      recorder.acroFormRecords.push({
        type: 'setText',
        field: this.getName(),
        value: text,
      });
      return origSetText.call(this, text);
    });

    const setFontSizeSpy = vi.spyOn(PDFTextField.prototype, 'setFontSize').mockImplementation(function (this: PDFTextField, size: number) {
      recorder.acroFormRecords.push({
        type: 'setFontSize',
        field: this.getName(),
        value: size,
      });
      return origSetFontSize.call(this, size);
    });

    const checkSpy = vi.spyOn(PDFCheckBox.prototype, 'check').mockImplementation(function (this: PDFCheckBox) {
      recorder.acroFormRecords.push({
        type: 'check',
        field: this.getName(),
        value: true,
      });
      return origCheck.call(this);
    });

    const uncheckSpy = vi.spyOn(PDFCheckBox.prototype, 'uncheck').mockImplementation(function (this: PDFCheckBox) {
      recorder.acroFormRecords.push({
        type: 'uncheck',
        field: this.getName(),
        value: false,
      });
      return origUncheck.call(this);
    });

    this.spies.push(setTextSpy, setFontSizeSpy, checkSpy, uncheckSpy);

    // Espías para drawText y drawLine (DINADIC, Resumen Clínico)
    const origDrawText = PDFPage.prototype.drawText;
    const origDrawLine = PDFPage.prototype.drawLine;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const recorder = this;

    const drawTextSpy = vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, options: any = {}) {
      const pageNum = (this as any).__pageIndex ?? 1;
      recorder.drawTextRecords.push({
        page: pageNum,
        text,
        x: typeof options.x === 'number' ? Math.round(options.x * 100) / 100 : undefined,
        y: typeof options.y === 'number' ? Math.round(options.y * 100) / 100 : undefined,
        size: typeof options.size === 'number' ? Math.round(options.size * 100) / 100 : undefined,
        maxWidth: typeof options.maxWidth === 'number' ? Math.round(options.maxWidth * 100) / 100 : undefined,
        lineHeight: typeof options.lineHeight === 'number' ? Math.round(options.lineHeight * 100) / 100 : undefined,
        color: options.color ? JSON.stringify(options.color) : undefined,
      });
      return origDrawText.call(this, text, options);
    });

    const drawLineSpy = vi.spyOn(PDFPage.prototype, 'drawLine').mockImplementation(function (this: PDFPage, options: any = {}) {
      const pageNum = (this as any).__pageIndex ?? 1;
      recorder.drawLineRecords.push({
        page: pageNum,
        start: {
          x: Math.round((options.start?.x ?? 0) * 100) / 100,
          y: Math.round((options.start?.y ?? 0) * 100) / 100,
        },
        end: {
          x: Math.round((options.end?.x ?? 0) * 100) / 100,
          y: Math.round((options.end?.y ?? 0) * 100) / 100,
        },
        thickness: options.thickness,
      });
      return origDrawLine.call(this, options);
    });

    this.spies.push(drawTextSpy, drawLineSpy);
  }

  reset() {
    this.acroFormRecords = [];
    this.drawTextRecords = [];
    this.drawLineRecords = [];
  }

  uninstall() {
    this.spies.forEach(s => s.mockRestore());
    this.spies = [];
    this.reset();
  }
}

/**
 * Configura los mocks de entorno del navegador y red para las pruebas de FormManager
 */
export function setupBrowserEnvironmentMocks() {
  // 1. Congelar reloj solo para Date
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));

  // 2. Pre-cargar perfil médico ficticio en localStorage
  const userKey = 'doctor_data_profile_v3_test-doctor-ficticio-uid';
  localStorage.setItem(userKey, JSON.stringify(MOCK_FICTITIOUS_DOCTOR));

  // 3. Mock de fetch para devolver las plantillas desde disco
  const origFetch = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    let relativePath = '';

    if (urlStr.includes('/forms/')) {
      const filename = urlStr.split('/forms/')[1]?.split('?')[0];
      relativePath = path.resolve(process.cwd(), 'public/forms', filename);
    } else if (urlStr.includes('/img/header_logo.png')) {
      relativePath = path.resolve(process.cwd(), 'public/img/header_logo.png');
    }

    if (relativePath && fs.existsSync(relativePath)) {
      const buffer = fs.readFileSync(relativePath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/pdf' }),
        arrayBuffer: async () => arrayBuffer,
        blob: async () => new Blob([arrayBuffer], { type: 'application/pdf' }),
      } as any;
    }

    return origFetch ? origFetch(input) : { ok: false, status: 404 } as any;
  });

  // 4. Stubs para URL y DOM
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-pdf-blob');
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-pdf-blob');
  }

  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  } else {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }

  const clickInterceptor = (e: MouseEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'A' || (e.target as HTMLElement)?.closest('a')) {
      e.preventDefault();
    }
  };
  window.addEventListener('click', clickInterceptor, true);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    this.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
  });
  vi.spyOn(window, 'alert').mockImplementation(() => {});

  return () => {
    window.removeEventListener('click', clickInterceptor, true);
    global.fetch = origFetch;
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  };
}
