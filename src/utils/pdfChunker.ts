/**
 * pdfChunker.ts
 *
 * Utilidad de particionamiento inteligente de documentos PDF clínicos.
 * Utiliza pdf-lib en el navegador para dividir documentos extensos (100–150+ páginas)
 * en bloques de páginas independientes con solapamiento seguro, evitando desbordes
 * de contexto, límites de tokens y timeouts de la API.
 */

import { PDFDocument } from 'pdf-lib';

export interface FileData {
  name: string;
  type: string;
  data: string; // Base64
}

export interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  startPage: number;
  endPage: number;
  totalPages: number;
  label: string;
  sourceFileName: string;
  file: FileData;
}

/**
 * Límite máximo seguro en bytes binarios por bloque PDF (~7.5 MB).
 * Al codificarse en Base64, genera un string de ~10 MB, garantizando:
 * - Amplio margen bajo el límite HTTP de Cloud Run (32 MB payload total).
 * - Amplio margen bajo el límite de la Cloud Function (20 MB binario por archivo).
 * - Eficiencia de memoria y tiempo de inferencia en Gemini.
 */
export const MAX_SAFE_CHUNK_BYTES = 7_500_000;

/**
 * Límite máximo admisible para una página o archivo individual (~12 MB binario).
 * En Base64 equivale a ~16 MB. Con el envoltorio JSON de solicitud (~0.5 MB),
 * el tamaño total en el transporte HTTP queda en ~16.5 MB, garantizando:
 * - Cumplimiento estricto del límite de 20 MB binarios de la Cloud Function (LIMITS.inlineDataMaxBytes: 20_000_000).
 * - Margen de seguridad del 48% frente al límite de 32 MB de Cloud Run.
 * - Margen de transporte seguro ante conexiones hospitalarias inestables y prevención de timeouts.
 */
export const MAX_SINGLE_PAGE_BYTES = 12_000_000;

/**
 * Determina el tamaño óptimo del bloque de páginas según la cantidad total de páginas
 * y el tamaño en bytes del documento.
 */
export function calculateOptimalChunkSize(
  totalPages: number,
  totalBytes?: number
): { chunkSize: number; overlap: number } {
  // 1. Tamaño base según cantidad de páginas (evita desborde de tokens y timeouts)
  let pageBasedSize: number;
  let pageBasedOverlap: number;

  if (totalPages <= 18) {
    pageBasedSize = totalPages;
    pageBasedOverlap = 0;
  } else if (totalPages <= 50) {
    pageBasedSize = 15;
    pageBasedOverlap = 1;
  } else if (totalPages <= 120) {
    pageBasedSize = 20;
    pageBasedOverlap = 1;
  } else if (totalPages <= 200) {
    pageBasedSize = 25;
    pageBasedOverlap = 1;
  } else {
    pageBasedSize = 30;
    pageBasedOverlap = 2;
  }

  // 2. Si se proporciona o detecta el peso total del documento, adaptar al peso
  if (totalBytes && totalBytes > 0 && totalPages > 0) {
    const avgBytesPerPage = totalBytes / totalPages;
    if (avgBytesPerPage > 0) {
      const sizeBasedSize = Math.max(1, Math.floor(MAX_SAFE_CHUNK_BYTES / avgBytesPerPage));
      if (sizeBasedSize < pageBasedSize) {
        const overlap = sizeBasedSize <= 2 ? 0 : 1;
        return { chunkSize: sizeBasedSize, overlap };
      }
    }
  }

  return { chunkSize: pageBasedSize, overlap: pageBasedOverlap };
}

/**
 * Convierte un string base64 a Uint8Array de forma segura y eficiente.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Limpiar posibles prefijos data:...;base64,
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Divide un archivo PDF individual en bloques de páginas independientes.
 * Adapta dinámicamente el tamaño de los bloques al peso de las páginas (imágenes/escaneos).
 */
export async function splitPdfIntoChunks(
  file: FileData,
  customChunkSize?: number,
  customOverlap?: number,
  onWarning?: (msg: string) => void
): Promise<DocumentChunk[]> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const normalizedFile = isPdf && file.type !== 'application/pdf' ? { ...file, type: 'application/pdf' } : file;

  if (!isPdf || !normalizedFile.data) {
    const rawBytes = normalizedFile.data ? normalizedFile.data.length * 0.75 : 0;
    if (rawBytes > MAX_SINGLE_PAGE_BYTES) {
      throw new Error(
        `El archivo "${file.name}" supera el límite máximo permitido para el transporte seguro (${(rawBytes / 1_000_000).toFixed(1)} MB binario / ${(normalizedFile.data.length / 1_000_000).toFixed(1)} MB en transporte; límite seguro: ${(MAX_SINGLE_PAGE_BYTES / 1_000_000).toFixed(0)} MB binario / ${(MAX_SINGLE_PAGE_BYTES * 4 / 3 / 1_000_000).toFixed(0)} MB en transporte). Reduzca la resolución de la imagen e intente nuevamente.`
      );
    }
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        startPage: 1,
        endPage: 1,
        totalPages: 1,
        label: normalizedFile.name || 'Documento',
        sourceFileName: normalizedFile.name,
        file: normalizedFile,
      },
    ];
  }

  // 1. Obtener bytes reales decodificados
  const bytes = base64ToUint8Array(normalizedFile.data);
  const totalFileBytes = bytes.length;

  // 2. Cargar el documento PDF con pdf-lib (propagar error si no es un PDF válido o está corrupto)
  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (err: any) {
    throw new Error(
      `No se pudo leer ni dividir el documento PDF "${file.name}": formato no válido, archivo dañado o protegido con contraseña (${err.message || 'Error'}).`
    );
  }

  const totalPages = srcDoc.getPageCount();
  if (totalPages === 0) {
    throw new Error(`El archivo PDF "${file.name}" no contiene páginas legibles.`);
  }

  // Si el archivo tiene 1 sola página y excede el límite de transporte seguro
  if (totalPages === 1 && (totalFileBytes > MAX_SINGLE_PAGE_BYTES || normalizedFile.data.length > (MAX_SINGLE_PAGE_BYTES * 4 / 3))) {
    throw new Error(
      `La página única de "${file.name}" supera el límite máximo permitido para el transporte seguro (${(totalFileBytes / 1_000_000).toFixed(1)} MB binario / ${(normalizedFile.data.length / 1_000_000).toFixed(1)} MB en transporte; límite seguro: ${(MAX_SINGLE_PAGE_BYTES / 1_000_000).toFixed(0)} MB binario / ${(MAX_SINGLE_PAGE_BYTES * 4 / 3 / 1_000_000).toFixed(0)} MB en transporte). Reduzca la resolución de la imagen escaneada e intente nuevamente.`
    );
  }

  // 3. Determinar tamaño de bloque considerando páginas y tamaño en bytes
  const { chunkSize: autoChunkSize, overlap: autoOverlap } = calculateOptimalChunkSize(totalPages, totalFileBytes);
  const chunkSize = customChunkSize ?? autoChunkSize;
  const overlap = customOverlap ?? autoOverlap;

  // 4. Si entra completo en un solo bloque y su peso binario es seguro (<= MAX_SAFE_CHUNK_BYTES), devolver sin recrear
  if (totalPages <= chunkSize && totalFileBytes <= MAX_SAFE_CHUNK_BYTES) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        startPage: 1,
        endPage: totalPages,
        totalPages,
        label: `${normalizedFile.name} (Págs. 1-${totalPages})`,
        sourceFileName: normalizedFile.name,
        file: normalizedFile,
      },
    ];
  }

  // 5. Particionamiento progresivo adaptativo
  const chunks: DocumentChunk[] = [];
  let startPage = 1;
  let chunkIndex = 0;
  const baseName = file.name.replace(/\.pdf$/i, '');

  while (startPage <= totalPages) {
    const currentChunkSize = chunkSize;
    let endPage = Math.min(startPage + currentChunkSize - 1, totalPages);
    let chunkBase64 = '';
    let chunkBytes = 0;
    let skipOversizedPage = false;

    // Bucle de adaptación de tamaño progresivo para el bloque actual
    while (true) {
      const pageIndices: number[] = [];
      for (let p = startPage - 1; p < endPage; p++) {
        pageIndices.push(p);
      }

      const chunkDoc = await PDFDocument.create();
      // Normalizar metadatos para estabilidad criptográfica y determinismo de hashes
      chunkDoc.setCreationDate(new Date(0));
      chunkDoc.setModificationDate(new Date(0));
      chunkDoc.setProducer('pdf-lib');
      chunkDoc.setCreator('pdf-lib');

      const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        chunkDoc.addPage(page);
      }

      chunkBase64 = await chunkDoc.saveAsBase64();
      chunkBytes = chunkBase64.length * 0.75;

      // Si el bloque supera el límite seguro y tiene más de 1 página, reducir progresivamente
      if (chunkBytes > MAX_SAFE_CHUNK_BYTES && endPage > startPage) {
        const span = endPage - startPage + 1;
        const reducedSpan = Math.max(1, Math.floor(span / 2));
        endPage = startPage + reducedSpan - 1;
        continue;
      }

      // Si una sola página excede el límite máximo admisible para transporte seguro
      if (endPage === startPage && (chunkBytes > MAX_SINGLE_PAGE_BYTES || chunkBase64.length > (MAX_SINGLE_PAGE_BYTES * 4 / 3))) {
        const warnMsg = `La página ${startPage} de "${file.name}" supera el límite máximo permitido para el transporte seguro (${(chunkBytes / 1_000_000).toFixed(1)} MB binario / ${(chunkBase64.length / 1_000_000).toFixed(1)} MB en transporte; límite seguro: ${(MAX_SINGLE_PAGE_BYTES / 1_000_000).toFixed(0)} MB binario). Reduzca la resolución de la imagen escaneada e intente nuevamente.`;
        if (totalPages === 1) {
          throw new Error(warnMsg);
        }
        // En PDF multipágina: no descartar todo el documento por una página con imagen excesiva
        console.warn(`[pdfChunker] ${warnMsg}`);
        if (onWarning) onWarning(warnMsg);
        startPage++;
        skipOversizedPage = true;
        break;
      }

      break;
    }

    if (skipOversizedPage) {
      continue;
    }

    chunks.push({
      chunkIndex,
      totalChunks: 0, // Se actualizará al final
      startPage,
      endPage,
      totalPages,
      label: `${baseName} (Bloque ${chunkIndex + 1}: Págs. ${startPage}-${endPage} de ${totalPages})`,
      sourceFileName: file.name,
      file: {
        name: `${baseName}_part${chunkIndex + 1}_p${startPage}-${endPage}.pdf`,
        type: 'application/pdf',
        data: chunkBase64,
      },
    });

    chunkIndex++;
    if (endPage >= totalPages) break;

    // Calcular avance considerando overlap sin retroceso infinito
    const actualSpan = endPage - startPage + 1;
    const effectiveOverlap = actualSpan <= 2 ? 0 : overlap;
    const step = Math.max(1, actualSpan - effectiveOverlap);
    startPage += step;
  }

  if (chunks.length === 0) {
    throw new Error(
      `No se pudo procesar ninguna página de "${file.name}" porque todas las páginas superan el límite de transporte seguro (${(MAX_SINGLE_PAGE_BYTES / 1_000_000).toFixed(0)} MB binario). Reduzca la resolución de las imágenes e intente nuevamente.`
    );
  }

  // Actualizar totalChunks
  for (const chunk of chunks) {
    chunk.totalChunks = chunks.length;
  }

  return chunks;
}

/**
 * Procesa un listado de archivos de historia clínica y los transforma en una secuencia
 * de bloques de procesamiento independientes.
 */
export async function splitFilesIntoProcessableChunks(
  files: FileData[],
  customChunkSize?: number,
  onWarning?: (msg: string) => void
): Promise<DocumentChunk[]> {
  if (!files || files.length === 0) return [];

  const allChunks: DocumentChunk[] = [];

  for (const file of files) {
    const fileChunks = await splitPdfIntoChunks(file, customChunkSize, undefined, onWarning);
    allChunks.push(...fileChunks);
  }

  // Renumerar chunkIndex y totalChunks sobre el total global
  const total = allChunks.length;
  return allChunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
    totalChunks: total,
  }));
}
