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
 * Determina el tamaño óptimo del bloque de páginas según la cantidad total de páginas.
 * Permite mantener la cantidad total de bloques entre 3 y 10 para respetar los
 * límites de tasa (rate limits) y obtener la máxima resolución de extracción.
 */
export function calculateOptimalChunkSize(totalPages: number): { chunkSize: number; overlap: number } {
  if (totalPages <= 18) {
    return { chunkSize: totalPages, overlap: 0 };
  }
  if (totalPages <= 50) {
    return { chunkSize: 15, overlap: 1 };
  }
  if (totalPages <= 120) {
    return { chunkSize: 20, overlap: 1 };
  }
  if (totalPages <= 200) {
    return { chunkSize: 25, overlap: 1 };
  }
  return { chunkSize: 30, overlap: 2 };
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
 * Si el archivo no es un PDF o tiene pocas páginas, devuelve un único bloque.
 */
export async function splitPdfIntoChunks(
  file: FileData,
  customChunkSize?: number,
  customOverlap?: number
): Promise<DocumentChunk[]> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf || !file.data) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        startPage: 1,
        endPage: 1,
        totalPages: 1,
        label: file.name || 'Documento',
        sourceFileName: file.name,
        file,
      },
    ];
  }

  try {
    const bytes = base64ToUint8Array(file.data);
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    if (totalPages === 0) {
      return [
        {
          chunkIndex: 0,
          totalChunks: 1,
          startPage: 1,
          endPage: 1,
          totalPages: 1,
          label: file.name,
          sourceFileName: file.name,
          file,
        },
      ];
    }

    const { chunkSize: autoChunkSize, overlap: autoOverlap } = calculateOptimalChunkSize(totalPages);
    const chunkSize = customChunkSize ?? autoChunkSize;
    const overlap = customOverlap ?? autoOverlap;

    // Si entra completo en un solo bloque, devolver sin recrear
    if (totalPages <= chunkSize) {
      return [
        {
          chunkIndex: 0,
          totalChunks: 1,
          startPage: 1,
          endPage: totalPages,
          totalPages,
          label: `${file.name} (Págs. 1-${totalPages})`,
          sourceFileName: file.name,
          file,
        },
      ];
    }

    const chunks: DocumentChunk[] = [];
    let startPage = 1;
    let chunkIndex = 0;
    const step = Math.max(1, chunkSize - overlap);

    while (startPage <= totalPages) {
      const endPage = Math.min(startPage + chunkSize - 1, totalPages);

      // Índices 0-indexed para pdf-lib copyPages
      const pageIndices: number[] = [];
      for (let p = startPage - 1; p < endPage; p++) {
        pageIndices.push(p);
      }

      const chunkDoc = await PDFDocument.create();
      const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        chunkDoc.addPage(page);
      }

      const chunkBase64 = await chunkDoc.saveAsBase64();
      const baseName = file.name.replace(/\.pdf$/i, '');

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
      startPage += step;
    }

    // Actualizar totalChunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  } catch (err) {
    console.warn(`[pdfChunker] Error al analizar páginas de "${file.name}". Se procesará completo:`, err);
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        startPage: 1,
        endPage: 1,
        totalPages: 1,
        label: file.name,
        sourceFileName: file.name,
        file,
      },
    ];
  }
}

/**
 * Procesa un listado de archivos de historia clínica y los transforma en una secuencia
 * de bloques de procesamiento independientes.
 */
export async function splitFilesIntoProcessableChunks(
  files: FileData[],
  customChunkSize?: number
): Promise<DocumentChunk[]> {
  if (!files || files.length === 0) return [];

  const allChunks: DocumentChunk[] = [];

  for (const file of files) {
    const fileChunks = await splitPdfIntoChunks(file, customChunkSize);
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
