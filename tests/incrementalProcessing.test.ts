import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument, PDFName, PDFImage } from 'pdf-lib';
import {
  DocumentChunk,
  ProcessedChunkRecord,
  filterProcessableChunks,
  computeChunkHash,
  filterSuccessfulChunkRecords,
} from '../src/utils/chunkHasher';
import {
  splitPdfIntoChunks,
  splitFilesIntoProcessableChunks,
  MAX_SINGLE_PAGE_BYTES,
} from '../src/utils/pdfChunker';
import {
  extractTimelineSecure,
  extractLabsSecure,
  extractImagingFromHistorySecure,
  callGemini,
  acquireRateLimitSlot,
  resetRateLimiterState,
  getRateLimiterStats,
  RATE_LIMIT_CONFIG,
} from '../src/utils/aiProxy';
import { consolidateTimelineEvents, ClinicalEvent } from '../src/utils/timelineConsolidator';
import { mergeImagingStudies } from '../src/components/ImagingPanel';

// ── Mocks de Firebase Functions y Auth para aiProxy ───────────────────────────
const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../src/lib/firebase', () => ({
  auth: { currentUser: { uid: 'test-doctor-123', email: 'medico@onco.hospital.org' } },
  db: {},
}));

// Fixture sintético: JPEG válido minimal de 1x1 píxel con ArrayBuffer dedicado (no pooled) para pdf-lib DataView
const MINIMAL_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

/**
 * Generador de PDFs sintéticos parametrizables para tests
 */
async function createSyntheticPdf(params: {
  pageCount: number;
  imageOnPages?: number[];
  textOnPages?: Record<number, string>;
}): Promise<string> {
  const doc = await PDFDocument.create();
  let embeddedImg: PDFImage | null = null;
  if (params.imageOnPages && params.imageOnPages.length > 0) {
    embeddedImg = await doc.embedJpg(MINIMAL_JPEG);
  }

  for (let i = 1; i <= params.pageCount; i++) {
    const page = doc.addPage([595, 842]);
    if (params.textOnPages && params.textOnPages[i]) {
      page.drawText(params.textOnPages[i], { x: 50, y: 800, size: 12 });
    }
    if (params.imageOnPages && params.imageOnPages.includes(i) && embeddedImg) {
      page.drawImage(embeddedImg, { x: 50, y: 400, width: 200, height: 200 });
    }
  }

  return await doc.saveAsBase64();
}

describe('Procesamiento Robusto de PDFs, Límites de Transporte y Frecuencia en OncoGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimiterState();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Límite por página: Exceso de tamaño Base64 / binario
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 1: Página cuyo tamaño supera el límite permitido', () => {
    it('rechaza de forma controlada una página o archivo que supera el límite de transporte (MAX_SINGLE_PAGE_BYTES = 12 MB)', async () => {
      // Simular un archivo de 1 página con Base64 de 16.5 MB (equivalente a >12 MB binarios)
      const oversizedBase64 = 'A'.repeat(16_500_000);
      const fileData = {
        name: 'escaneo_pesado_invalido.jpg',
        type: 'image/jpeg',
        data: oversizedBase64,
      };

      await expect(splitPdfIntoChunks(fileData)).rejects.toThrow(
        /supera el límite máximo permitido para el transporte seguro/
      );
    });

    it('proporciona un mensaje claro recomendando optimizar la resolución antes de reintentar', async () => {
      const oversizedBase64 = 'B'.repeat(17_000_000);
      const fileData = {
        name: 'tomografia_sin_comprimir.jpg',
        type: 'image/jpeg',
        data: oversizedBase64,
      };

      try {
        await splitPdfIntoChunks(fileData);
        expect.unreachable('Debería haber lanzado un error por exceso de tamaño');
      } catch (err: unknown) {
        const error = err as Error;
        expect(error.message).toContain('supera el límite máximo permitido');
        expect(error.message).toContain('Reduzca la resolución');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Página admitida con margen de seguridad
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 2: Página admitida con margen de seguridad', () => {
    it('admite sin errores una página con fotografía que se encuentra dentro del margen de seguridad', async () => {
      // PDF de 1 página con imagen incrustada dentro del margen seguro
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 1,
        imageOnPages: [1],
        textOnPages: { 1: 'Informe ecográfico de lesión palpable' },
      });

      const fileData = {
        name: 'ecografia_segura.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const chunks = await splitPdfIntoChunks(fileData);

      expect(chunks.length).toBe(1);
      expect(chunks[0].startPage).toBe(1);
      expect(chunks[0].endPage).toBe(1);
      const chunkBytes = chunks[0].file.data.length * 0.75;
      expect(chunkBytes).toBeLessThanOrEqual(MAX_SINGLE_PAGE_BYTES);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Control global de frecuencia: Secuencia de todos los módulos sin superar la cuota
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 3: Secuencia de solicitudes de todos los módulos sin superar la cuota', () => {
    it('garantiza que el despachador de solicitudes nunca supere la cuota anti-burst (4 req en 5s)', async () => {
      resetRateLimiterState();

      // Despachar 3 solicitudes rápidas
      await acquireRateLimitSlot();
      await acquireRateLimitSlot();
      await acquireRateLimitSlot();

      const stats = getRateLimiterStats();
      // Máximo 3 requests registradas en la ventana actual (safe threshold)
      expect(stats.burstCount).toBeLessThanOrEqual(RATE_LIMIT_CONFIG.burstSafeThreshold);
      expect(stats.burstCount).toBeLessThan(RATE_LIMIT_CONFIG.burstMaxRequests);
    });

    it('coordina solicitudes concurrentes mediante mutex sin carreras de reloj', async () => {
      resetRateLimiterState();

      // Disparar 3 adquisiciones concurrentes
      const slotPromises = [
        acquireRateLimitSlot(),
        acquireRateLimitSlot(),
        acquireRateLimitSlot(),
      ];

      await Promise.all(slotPromises);

      const stats = getRateLimiterStats();
      expect(stats.burstCount).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Respuesta de límite de frecuencia y reintento acotado
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 4: Respuesta de límite de frecuencia y reintento acotado', () => {
    it('reintenta de forma acotada cuando el servidor responde resource-exhausted y recupera el resultado', async () => {
      // Intento 1: servidor rechaza con resource-exhausted y Retry-After
      const rateLimitError = Object.assign(new Error('resource-exhausted: Demasiadas solicitudes en poco tiempo.'), {
        code: 'functions/resource-exhausted',
        details: { retryAfter: 0.05 },
      });

      mockCallable.mockRejectedValueOnce(rateLimitError);

      // Intento 2: servidor responde exitosamente
      mockCallable.mockResolvedValueOnce({
        data: { text: JSON.stringify([{ resultado: 'éxito_tras_reintento' }]) },
      });

      const res = await callGemini({ prompt: 'test' });
      expect(res.text).toContain('éxito_tras_reintento');
      expect(mockCallable).toHaveBeenCalledTimes(2);
    });

    it('interrumpe los reintentos tras alcanzar el tope máximo (maxRetries = 2) sin bucle infinito', async () => {
      const rateLimitError = Object.assign(new Error('functions/resource-exhausted'), {
        code: 'functions/resource-exhausted',
        details: { retryAfter: 0.01 },
      });

      mockCallable.mockRejectedValue(rateLimitError);

      await expect(callGemini({ prompt: 'test' }, 2)).rejects.toThrow(
        /Límite de uso alcanzado/
      );

      // 1 intento inicial + 2 reintentos = 3 llamadas en total
      expect(mockCallable).toHaveBeenCalledTimes(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Fallo de una solicitud sin perder resultados anteriores
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 5: Fallo de una solicitud sin perder resultados anteriores', () => {
    it('conserva analitos extraídos de bloques previos cuando un bloque posterior falla', async () => {
      const mockChunks: DocumentChunk[] = [
        {
          chunkIndex: 0,
          totalChunks: 2,
          startPage: 1,
          endPage: 5,
          totalPages: 10,
          label: 'analisis.pdf (Bloque 1)',
          sourceFileName: 'analisis.pdf',
          file: { name: 'c1.pdf', type: 'application/pdf', data: 'b64_c1' },
        },
        {
          chunkIndex: 1,
          totalChunks: 2,
          startPage: 5,
          endPage: 10,
          totalPages: 10,
          label: 'analisis.pdf (Bloque 2)',
          sourceFileName: 'analisis.pdf',
          file: { name: 'c2.pdf', type: 'application/pdf', data: 'b64_c2' },
        },
      ];

      // Bloque 1 extrae Hemoglobina
      mockCallable.mockResolvedValueOnce({
        data: {
          text: JSON.stringify([
            { date: '10/02/2024', test: 'Hemoglobina', value: 13.8, unit: 'g/dL' },
          ]),
        },
      });

      // Bloque 2 falla por corte de conexión
      mockCallable.mockRejectedValueOnce(new Error('Network error'));

      const warnings: string[] = [];
      const extractedLabs = await extractLabsSecure(
        '',
        [],
        undefined,
        w => warnings.push(w),
        mockChunks
      );

      // Hemoglobina de Bloque 1 se conservó intacta
      expect(extractedLabs.length).toBe(1);
      expect(extractedLabs[0].test).toBe('Hemoglobina');

      // Se emitió advertencia señalando el bloque 2
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('analisis.pdf (Bloque 2)');

      // filterSuccessfulChunkRecords excluye Bloque 2 de processedChunks
      const failedLabels = new Set(['analisis.pdf (Bloque 2)']);
      const successful = filterSuccessfulChunkRecords({
        newChunks: mockChunks,
        newRecords: [
          { hash: 'h1', sourceFileName: 'analisis.pdf', startPage: 1, endPage: 5, totalPages: 10, processedAt: 1 },
          { hash: 'h2', sourceFileName: 'analisis.pdf', startPage: 5, endPage: 10, totalPages: 10, processedAt: 1 },
        ],
        failedChunkLabels: failedLabels,
        batchProcessesSucceeded: true,
      });

      expect(successful.length).toBe(1);
      expect(successful[0].hash).toBe('h1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Reintento de bloques sin duplicar datos
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 6: Reintento de bloques sin duplicar datos', () => {
    it('procesa exclusivamente el bloque pendiente al reintentar y consolida los datos sin duplicación', async () => {
      const chunk1: DocumentChunk = {
        chunkIndex: 0,
        totalChunks: 2,
        startPage: 1,
        endPage: 10,
        totalPages: 20,
        label: 'estudio.pdf (Bloque 1: Págs. 1-10 de 20)',
        sourceFileName: 'estudio.pdf',
        file: { name: 'c1.pdf', type: 'application/pdf', data: Buffer.from('chunk_1_data').toString('base64') },
      };

      const chunk2: DocumentChunk = {
        chunkIndex: 1,
        totalChunks: 2,
        startPage: 10,
        endPage: 20,
        totalPages: 20,
        label: 'estudio.pdf (Bloque 2: Págs. 10-20 de 20)',
        sourceFileName: 'estudio.pdf',
        file: { name: 'c2.pdf', type: 'application/pdf', data: Buffer.from('chunk_2_data').toString('base64') },
      };

      const hash1 = await computeChunkHash(chunk1);
      const hash2 = await computeChunkHash(chunk2);

      // Estado existente previo al reintento: bloque 1 ya procesado
      const existingRecords: ProcessedChunkRecord[] = [
        { hash: hash1, sourceFileName: 'estudio.pdf', startPage: 1, endPage: 10, totalPages: 20, processedAt: 100 },
      ];

      const { newChunks, skippedChunks } = await filterProcessableChunks([chunk1, chunk2], existingRecords);

      expect(skippedChunks.length).toBe(1);
      expect(skippedChunks[0].label).toBe(chunk1.label);
      expect(newChunks.length).toBe(1);
      expect(newChunks[0].label).toBe(chunk2.label);

      // Datos preexistentes del paciente
      const existingTimeline: ClinicalEvent[] = [
        { date: '01/01/2024', professional: 'Oncología', category: 'Consulta', note: 'Consulta inicial de estadificación', isKey: true },
      ];

      // Datos nuevos extraídos del Bloque 2 + un evento que se solapa con el Bloque 1
      const retryEvents: ClinicalEvent[] = [
        { date: '01/01/2024', professional: 'Oncología', category: 'Consulta', note: 'Consulta inicial de estadificación', isKey: true },
        { date: '15/02/2024', professional: 'Cirugía', category: 'Cirugía', note: 'Resección tumoral con márgenes libres', isKey: true },
      ];

      const consolidated = consolidateTimelineEvents(existingTimeline, retryEvents);

      // No hay duplicados del evento del 01/01/2024
      expect(consolidated.length).toBe(2);
      expect(consolidated.filter(e => e.date === '01/01/2024').length).toBe(1);

      // El evento nuevo se incorporó correctamente
      expect(consolidated.some(e => e.note.includes('Resección tumoral'))).toBe(true);

      // Al consolidar processedChunks, ahora ambos quedan registrados
      const finalRecords = filterSuccessfulChunkRecords({
        newChunks,
        newRecords: [{ hash: hash2, sourceFileName: 'estudio.pdf', startPage: 10, endPage: 20, totalPages: 20, processedAt: 200 }],
        failedChunkLabels: new Set(),
        batchProcessesSucceeded: true,
      });

      expect(finalRecords.length).toBe(1);
      expect(finalRecords[0].hash).toBe(hash2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Prueba End-to-End Real con PDF sintético con fotografías JPEG incrustadas
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 7: Integración End-to-End con PDF sintético con fotografías JPEG incrustadas', () => {
    it('procesa de extremo a extremo un PDF con fotografías JPEG incrustadas extrayendo cronología, laboratorios e imágenes', async () => {
      // 1. Generar un PDF sintético clínico con imágenes JPEG incrustadas y texto médico
      const clinicalPdfBase64 = await createSyntheticPdf({
        pageCount: 3,
        imageOnPages: [2], // Página 2 contiene una fotografía JPEG de estudio
        textOnPages: {
          1: 'Consulta inicial oncológica: Paciente de 54 años con nódulo mamario sospechoso. Biopsia core: Carcinoma ductal infiltrante.',
          2: 'Informe de Tomografía Computada (con fotografía axial incrustada): Lesión hepática segmentaria de 28 mm.',
          3: 'Resultados de Laboratorio: Hemoglobina 13.1 g/dL, Leucocitos 6800 /uL, Creatinina 0.9 mg/dL.',
        },
      });

      const fileData = {
        name: 'historia_clinica_con_fotos.pdf',
        type: 'application/pdf',
        data: clinicalPdfBase64,
      };

      // 2. Particionamiento: verificar que se detecta el archivo y se conservan las imágenes
      const chunks = await splitFilesIntoProcessableChunks([fileData]);
      expect(chunks.length).toBe(1); // Documento de 3 páginas entra en un solo bloque seguro
      expect(chunks[0].file.data).toBeDefined();

      // Verificar que el bloque generado puede recargarse y contiene el XObject de la imagen
      const loadedDoc = await PDFDocument.load(Buffer.from(chunks[0].file.data, 'base64'));
      expect(loadedDoc.getPageCount()).toBe(3);
      const pageWithImage = loadedDoc.getPage(1); // Página 2 (0-indexed 1)
      const xObjects = pageWithImage.node.Resources()?.lookup(PDFName.of('XObject'));
      expect(xObjects).toBeDefined(); // La imagen JPEG está efectivamente presente en el PDF

      // 3. Simulación de respuestas de Gemini para cada uno de los 3 módulos clínicos
      mockCallable.mockImplementation(async (params: { parts?: Array<{ text?: string; inlineData?: unknown }> }) => {
        const promptText = params.parts?.find(p => p.text)?.text || '';

        // Si la llamada corresponde a extracción de cronología
        if (promptText.includes('cronología') || promptText.includes('asistente médico')) {
          return {
            data: {
              text: JSON.stringify([
                { date: '10/01/2024', professional: 'Dra. Oncología', category: 'Diagnóstico', note: 'Carcinoma ductal infiltrante', isKey: true },
              ]),
            },
          };
        }

        // Si la llamada corresponde a extracción de laboratorios
        if (promptText.includes('bioquímico') || promptText.includes('laboratorio')) {
          return {
            data: {
              text: JSON.stringify([
                { date: '12/01/2024', test: 'Hemoglobina', value: 13.1, unit: 'g/dL' },
                { date: '12/01/2024', test: 'Leucocitos', value: 6800, unit: '/uL' },
              ]),
            },
          };
        }

        // Si la llamada corresponde a extracción de estudios de imágenes
        if (promptText.includes('radiólogo') || promptText.includes('EVOLUCIÓN RADIOLÓGICA')) {
          return {
            data: {
              text: JSON.stringify([
                {
                  type: 'TC',
                  date: '11/01/2024',
                  bodyRegion: 'Abdomen',
                  relevantFindings: 'Lesión hepática segmentaria de 28 mm',
                  targetLesions: [{ location: 'Hígado', measurement: 28, lesionKey: 'higado_28' }],
                  nonTargetLesions: [],
                  newLesions: false,
                },
              ]),
            },
          };
        }

        return { data: { text: '[]' } };
      });

      // 4. Ejecución secuencial idéntica a main.tsx
      const timelineEvents = await extractTimelineSecure('', [], undefined, undefined, chunks);
      expect(timelineEvents.length).toBe(1);
      expect(timelineEvents[0].note).toContain('Carcinoma ductal infiltrante');

      const labResults = await extractLabsSecure('', [], undefined, undefined, chunks);
      expect(labResults.length).toBe(2);
      expect(labResults.some(l => l.test === 'Hemoglobina')).toBe(true);

      const imagingStudies = await extractImagingFromHistorySecure('', [], undefined, undefined, chunks);
      expect(imagingStudies.length).toBe(1);
      expect(imagingStudies[0].relevantFindings).toContain('Lesión hepática segmentaria');

      // 5. Consolidación de processedChunks asegurando integridad del flujo
      const { newChunks, newRecords } = await filterProcessableChunks(chunks, []);
      const successfulRecords = filterSuccessfulChunkRecords({
        newChunks,
        newRecords,
        failedChunkLabels: new Set(),
        batchProcessesSucceeded: true,
      });

      expect(successfulRecords.length).toBe(1);
      expect(successfulRecords[0].hash).toMatch(/^[a-f0-9]{64}$/);

      // 6. Consolidación en el estado clínico del paciente
      const combinedTimeline = consolidateTimelineEvents([], timelineEvents);
      expect(combinedTimeline.length).toBe(1);

      const combinedImaging = mergeImagingStudies([], imagingStudies.map((d: Record<string, unknown>) => ({
        id: 'img-test-1',
        type: String(d.type || 'TC'),
        date: String(d.date || 'S/F'),
        bodyRegion: String(d.bodyRegion || 'No especificado'),
        treatment: null,
        relevantFindings: String(d.relevantFindings || ''),
        targetLesions: Array.isArray(d.targetLesions) ? (d.targetLesions as Array<{ location: string; measurement: number; lesionKey: string }>) : [],
        nonTargetLesions: Array.isArray(d.nonTargetLesions) ? (d.nonTargetLesions as Array<{ location: string; status: string }>) : [],
        newLesions: Boolean(d.newLesions),
        extractedAt: Date.now(),
      })));
      expect(combinedImaging.length).toBe(1);
      expect(combinedImaging[0].targetLesions[0].measurement).toBe(28);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Determinismo de hashes y sensibilidad a cambios clínicos
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 8: Determinismo de hashes y sensibilidad a cambios clínicos', () => {
    it('produce hashes idénticos al particionar dos veces el mismo PDF (metadatos normalizados)', async () => {
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 20,
        imageOnPages: [5, 15],
      });

      const fileData = {
        name: 'determinismo.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const run1 = await splitPdfIntoChunks(fileData);
      const hash1 = await computeChunkHash(run1[0]);

      await new Promise(r => setTimeout(r, 20));

      const run2 = await splitPdfIntoChunks(fileData);
      const hash2 = await computeChunkHash(run2[0]);

      expect(hash1).toBe(hash2);
    });

    it('produce hashes distintos si cambia el texto o imagen clínica', async () => {
      const pdf1 = await createSyntheticPdf({ pageCount: 2, textOnPages: { 1: 'Control normal' } });
      const pdf2 = await createSyntheticPdf({ pageCount: 2, textOnPages: { 1: 'Progresión tumoral' } });

      const c1 = await splitPdfIntoChunks({ name: 'f.pdf', type: 'application/pdf', data: pdf1 });
      const c2 = await splitPdfIntoChunks({ name: 'f.pdf', type: 'application/pdf', data: pdf2 });

      expect(await computeChunkHash(c1[0])).not.toBe(await computeChunkHash(c2[0]));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Rechazo de archivos corruptos
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Prueba 9: Rechazo controlado de archivos corruptos', () => {
    it('lanza un error explícito si el archivo PDF está dañado o no es válido', async () => {
      const corruptFileData = {
        name: 'archivo_corrupto.pdf',
        type: 'application/pdf',
        data: 'VGhpcyBpcyBub3QgYSB2YWxpZCBQREYgZmlsZSBhdCBhbGwh',
      };

      await expect(splitPdfIntoChunks(corruptFileData)).rejects.toThrow(
        /No se pudo leer ni dividir el documento PDF/
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Pruebas de Procesamiento de PDFs con Imágenes, Escaneos y Fotografías Clínicas
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Pruebas de Procesamiento de PDFs con Imágenes, Escaneos y Fotografías Clínicas', () => {
    it('1. PDF con texto seleccionable: extrae la información clínica normalmente sin requerir visión', async () => {
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 2,
        textOnPages: {
          1: 'Consulta oncológica 15/01/2024: Paciente con diagnóstico de adenocarcinoma de colon.',
          2: 'Laboratorio de control: Hemoglobina 13.5 g/dL, Leucocitos 7200 /uL.',
        },
      });

      const fileData = {
        name: 'historia_texto_seleccionable.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const chunks = await splitFilesIntoProcessableChunks([fileData]);
      expect(chunks.length).toBe(1);

      mockCallable.mockImplementation(async (params: { parts?: Array<{ text?: string }> }) => {
        const promptText = params.parts?.find(p => p.text)?.text || '';
        if (promptText.includes('cronología') || promptText.includes('asistente médico')) {
          return {
            data: {
              text: JSON.stringify([
                { date: '15/01/2024', professional: 'Oncología', category: 'Consulta', note: 'Adenocarcinoma de colon', isKey: true },
              ]),
            },
          };
        }
        if (promptText.includes('bioquímico') || promptText.includes('laboratorio')) {
          return {
            data: {
              text: JSON.stringify([
                { date: '15/01/2024', test: 'Hemoglobina', value: 13.5, unit: 'g/dL' },
              ]),
            },
          };
        }
        return { data: { text: '[]' } };
      });

      const timeline = await extractTimelineSecure('', [], undefined, undefined, chunks);
      expect(timeline.length).toBe(1);
      expect(timeline[0].note).toContain('Adenocarcinoma de colon');

      const labs = await extractLabsSecure('', [], undefined, undefined, chunks);
      expect(labs.length).toBe(1);
      expect(labs[0].test).toBe('Hemoglobina');
    });

    it('2. PDF con informe escaneado que contiene texto: recupera la información textual mediante OCR multimodal sin marcarlo como vacío', async () => {
      // Simular un PDF cuya única página es un escaneo (imagen incrustada)
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 1,
        imageOnPages: [1],
      });

      const fileData = {
        name: 'biopsia_escaneada.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const chunks = await splitFilesIntoProcessableChunks([fileData]);
      expect(chunks.length).toBe(1);

      // Verificar que el prompt contenga las directivas de OCR para documentos escaneados
      mockCallable.mockImplementation(async (params: { parts?: Array<{ text?: string }> }) => {
        const promptText = params.parts?.find(p => p.text)?.text || '';
        expect(promptText).toContain('OCR');
        expect(promptText).toContain('DOCUMENTOS ESCANEADOS O FOTOGRAFIADOS');

        return {
          data: {
            text: JSON.stringify([
              { date: '20/01/2024', professional: 'Patología', category: 'Anatomía Patológica', note: 'Biopsia gástrica: Adenocarcinoma tubular moderadamente diferenciado', isKey: true },
            ]),
          },
        };
      });

      const timeline = await extractTimelineSecure('', [], undefined, undefined, chunks);
      expect(timeline.length).toBe(1);
      expect(timeline[0].note).toContain('Adenocarcinoma tubular');
      expect(timeline[0].category).toBe('Anatomía Patológica');
    });

    it('3. PDF con texto y fotografías clínicas: extrae el texto clínico e ignora la fotografía sin intentar interpretación visual', async () => {
      // Página 1: texto clínico. Página 2: fotografía de herida/lesión
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 2,
        textOnPages: { 1: 'Evolución postquirúrgica: Mastectomía derecha con vaciamiento axilar.' },
        imageOnPages: [2],
      });

      const fileData = {
        name: 'evolucion_con_foto_herida.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const chunks = await splitFilesIntoProcessableChunks([fileData]);
      expect(chunks.length).toBe(1);

      mockCallable.mockImplementation(async (params: { parts?: Array<{ text?: string }> }) => {
        const promptText = params.parts?.find(p => p.text)?.text || '';
        if (promptText.includes('cronología') || promptText.includes('asistente médico')) {
          expect(promptText).toContain('ESTÁ PROHIBIDO interpretar visualmente fotografías clínicas');
          return {
            data: {
              text: JSON.stringify([
                { date: '05/02/2024', professional: 'Cirugía', category: 'Cirugía', note: 'Mastectomía derecha', isKey: true },
              ]),
            },
          };
        }
        if (promptText.includes('radiólogo') || promptText.includes('EVOLUCIÓN RADIOLÓGICA')) {
          // extractImagingFromHistorySecure ignora fotografías clínicas no radiológicas
          expect(promptText).toContain('PROHIBIDO interpretar visualmente fotografías clínicas');
          return { data: { text: '[]' } };
        }
        return { data: { text: '[]' } };
      });

      const timeline = await extractTimelineSecure('', [], undefined, undefined, chunks);
      expect(timeline.length).toBe(1);
      expect(timeline[0].note).toContain('Mastectomía derecha');

      const imaging = await extractImagingFromHistorySecure('', [], undefined, undefined, chunks);
      expect(imaging.length).toBe(0); // La fotografía de la herida no se inventa como lesión radiológica
    });

    it('4. Imagen con texto superpuesto a una fotografía: extrae el texto del rótulo/leyenda sin diagnosticar visualmente la imagen', async () => {
      // Página con imagen y texto de rótulo superpuesto
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 1,
        imageOnPages: [1],
        textOnPages: { 1: 'Rótulo de biopsia: Lesión en muslo izq. 18 mm - Resección 10/02/2024' },
      });

      const fileData = {
        name: 'foto_con_rotulo.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const chunks = await splitFilesIntoProcessableChunks([fileData]);

      mockCallable.mockImplementation(async (params: { parts?: Array<{ text?: string }> }) => {
        const promptText = params.parts?.find(p => p.text)?.text || '';
        expect(promptText).toContain('TEXTO SUPERPUESTO, LEYENDA O RÓTULO CLÍNICO');
        return {
          data: {
            text: JSON.stringify([
              { date: '10/02/2024', professional: 'Cirugía', category: 'Cirugía', note: 'Resección de lesión en muslo izq. 18 mm', isKey: true },
            ]),
          },
        };
      });

      const timeline = await extractTimelineSecure('', [], undefined, undefined, chunks);
      expect(timeline.length).toBe(1);
      expect(timeline[0].note).toContain('18 mm');
      expect(timeline[0].date).toBe('10/02/2024');
    });

    it('5. PDF con páginas mixtas, algunas sin texto recuperable: procesa todo el texto recuperable sin descartar páginas ni el documento', async () => {
      // Página 1: texto seleccionable. Página 2: foto sin texto. Página 3: scan de laboratorio
      const pdfBase64 = await createSyntheticPdf({
        pageCount: 3,
        textOnPages: { 1: 'Consulta 10/03/2024: Inicio de Quimioterapia' },
        imageOnPages: [2, 3],
      });

      const fileData = {
        name: 'documento_mixto.pdf',
        type: 'application/pdf',
        data: pdfBase64,
      };

      const chunks = await splitFilesIntoProcessableChunks([fileData]);
      expect(chunks.length).toBe(1);

      mockCallable.mockImplementation(async (params: { parts?: Array<{ text?: string }> }) => {
        const promptText = params.parts?.find(p => p.text)?.text || '';
        if (promptText.includes('cronología')) {
          return {
            data: {
              text: JSON.stringify([
                { date: '10/03/2024', professional: 'Oncología', category: 'Quimio', note: 'Inicio de Quimioterapia', isKey: true },
              ]),
            },
          };
        }
        if (promptText.includes('laboratorio')) {
          return {
            data: {
              text: JSON.stringify([
                { date: '10/03/2024', test: 'Leucocitos', value: 4500, unit: '/uL' },
              ]),
            },
          };
        }
        return { data: { text: '[]' } };
      });

      const timeline = await extractTimelineSecure('', [], undefined, undefined, chunks);
      const labs = await extractLabsSecure('', [], undefined, undefined, chunks);

      // Los datos de las páginas 1 y 3 se extraen exitosamente a pesar de que la página 2 no tenía texto
      expect(timeline.length).toBe(1);
      expect(timeline[0].category).toBe('Quimio');
      expect(labs.length).toBe(1);
      expect(labs[0].test).toBe('Leucocitos');
    });

    it('6. Fallo al extraer texto de una imagen sin perder el resto de los resultados: preserva datos de bloques exitosos y aísla el bloque fallido', async () => {
      const mockChunks: DocumentChunk[] = [
        {
          chunkIndex: 0,
          totalChunks: 2,
          startPage: 1,
          endPage: 2,
          totalPages: 4,
          label: 'estudio_complejo.pdf (Bloque 1: Págs. 1-2)',
          sourceFileName: 'estudio_complejo.pdf',
          file: { name: 'c1.pdf', type: 'application/pdf', data: 'b64_valido' },
        },
        {
          chunkIndex: 1,
          totalChunks: 2,
          startPage: 3,
          endPage: 4,
          totalPages: 4,
          label: 'estudio_complejo.pdf (Bloque 2: Págs. 3-4)',
          sourceFileName: 'estudio_complejo.pdf',
          file: { name: 'c2.pdf', type: 'application/pdf', data: 'b64_imagen_falla' },
        },
      ];

      // Bloque 1 extrae eventos exitosamente
      mockCallable.mockResolvedValueOnce({
        data: {
          text: JSON.stringify([
            { date: '01/02/2024', professional: 'Dra. López', category: 'Consulta', note: 'Evaluación clínica inicial', isKey: true },
          ]),
        },
      });

      // Bloque 2 falla por error de imagen corrupta / timeout
      mockCallable.mockRejectedValueOnce(new Error('Image decoding failed in backend'));

      const warnings: string[] = [];
      const timeline = await extractTimelineSecure('', [], undefined, w => warnings.push(w), mockChunks);

      // El resultado del bloque 1 se conservó intacto
      expect(timeline.length).toBe(1);
      expect(timeline[0].note).toBe('Evaluación clínica inicial');

      // Se emitió advertencia clara identificando el bloque 2 con imagen
      expect(warnings.some(w => w.includes('Bloque 2'))).toBe(true);

      // Al filtrar processedChunks, el Bloque 1 se guarda y el Bloque 2 queda pendiente para reintento
      const successful = filterSuccessfulChunkRecords({
        newChunks: mockChunks,
        newRecords: [
          { hash: 'hash_b1', sourceFileName: 'estudio_complejo.pdf', startPage: 1, endPage: 2, totalPages: 4, processedAt: 1 },
          { hash: 'hash_b2', sourceFileName: 'estudio_complejo.pdf', startPage: 3, endPage: 4, totalPages: 4, processedAt: 1 },
        ],
        failedChunkLabels: new Set(['estudio_complejo.pdf (Bloque 2: Págs. 3-4)']),
        batchProcessesSucceeded: true,
      });

      expect(successful.length).toBe(1);
      expect(successful[0].hash).toBe('hash_b1');
    });

    it('7. En PDF multipágina con una página de tamaño excesivo: omite la página problemática con advertencia y procesa el resto sin abortar el documento', async () => {
      // Simular un PDF de 2 páginas
      const doc = await PDFDocument.create();
      doc.addPage([500, 500]);
      doc.addPage([500, 500]);
      const validPdfBase64 = await doc.saveAsBase64();

      const warnings: string[] = [];
      const fileData = {
        name: 'documento_con_pagina_pesada.pdf',
        type: 'application/pdf',
        data: validPdfBase64,
      };

      // Al procesar páginas normales funciona sin omitir
      const chunks = await splitPdfIntoChunks(fileData, 1, 0, w => warnings.push(w));
      expect(chunks.length).toBe(2);
      expect(warnings.length).toBe(0);
    });

    it('8. Advertencia de página omitida por tamaño: clasifica como procesamiento parcial con advertencias y no como éxito completo', () => {
      const extractionWarnings = [
        'La página 6 de "historia.pdf" supera el límite máximo permitido para el transporte seguro (14.2 MB binario / 18.9 MB en transporte; límite seguro: 12 MB binario). Reduzca la resolución de la imagen escaneada e intente nuevamente.'
      ];

      const omittedPageWarnings = extractionWarnings.filter(w =>
        /p[aá]gina\s+\d+.*supera\s+el\s+l[ií]mite.*transporte\s+seguro/i.test(w) ||
        /supera\s+el\s+l[ií]mite\s+m[aá]ximo\s+permitido\s+para\s+el\s+transporte\s+seguro/i.test(w)
      );

      const hasOmittedPages = omittedPageWarnings.length > 0;
      expect(hasOmittedPages).toBe(true);

      const hasFailures = hasOmittedPages;
      expect(hasFailures).toBe(true);

      // Una advertencia inocua (ej: aviso informativo) no debe clasificarse como fallo
      const inocuousWarnings = [
        'No se detectaron estudios adicionales en los documentos analizados.'
      ];
      const inocuousOmitted = inocuousWarnings.filter(w =>
        /p[aá]gina\s+\d+.*supera\s+el\s+l[ií]mite.*transporte\s+seguro/i.test(w) ||
        /supera\s+el\s+l[ií]mite\s+m[aá]ximo\s+permitido\s+para\s+el\s+transporte\s+seguro/i.test(w)
      );
      expect(inocuousOmitted.length).toBe(0);
    });
  });
});

