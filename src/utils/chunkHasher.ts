/**
 * chunkHasher.ts
 *
 * Utilidad de cálculo de huellas determinísticas (hashes) y filtrado incremental
 * de bloques de historias clínicas (DocumentChunk).
 *
 * Permite identificar de manera determinística qué bloques ya fueron procesados
 * previamente para un paciente y enviar a Gemini exclusivamente los bloques nuevos.
 */

import { DocumentChunk } from './pdfChunker';

export interface ProcessedChunkRecord {
  hash: string;
  sourceFileName?: string;
  startPage?: number;
  endPage?: number;
  totalPages?: number;
  processedAt: number;
}

export interface ChunkFilterResult {
  newChunks: DocumentChunk[];
  skippedChunks: DocumentChunk[];
  newRecords: ProcessedChunkRecord[];
}

/**
 * Calcula un hash SHA-256 determinístico sobre una cadena de texto o base64.
 * Utiliza Web Crypto API en entornos modernos (navegador / Node 18+) con
 * fallback determinístico de compatibilidad.
 */
export async function computeContentHash(content: string): Promise<string> {
  const clean = content.trim();

  // 1. Web Crypto API estándar (navegadores modernos y Node 18+)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(clean);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Si falla Web Crypto por contexto inseguro, continuar al fallback
    }
  }

  // 2. Node.js crypto si está disponible (entornos de pruebas / SSR)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
      return nodeCrypto.createHash('sha256').update(clean).digest('hex');
    }
  } catch {
    // Entorno puro navegador sin require
  }

  // 3. Fallback determinístico (FNV-1a 64-bit extendido) para entornos sin Web Crypto
  return fnv1a64Hex(clean);
}

/**
 * Hash determinístico de 64 bits FNV-1a como fallback de emergencia.
 */
function fnv1a64Hex(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x01000193);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `fnv_${part1}${part2}`;
}

/**
 * Genera la huella determinística de un DocumentChunk a partir de su contenido real (base64 de páginas).
 * Es totalmente independiente del nombre del archivo o del orden de subida.
 */
export async function computeChunkHash(chunk: DocumentChunk): Promise<string> {
  const rawData = chunk.file?.data || '';
  const cleanBase64 = rawData.includes(',') ? rawData.split(',')[1] : rawData;
  return computeContentHash(cleanBase64);
}

/**
 * Compara los bloques procesables actuales contra el historial de bloques ya procesados
 * del paciente. Separa los bloques nuevos de los ya procesados y descarta además
 * duplicados dentro del mismo lote de carga.
 */
export async function filterProcessableChunks(
  chunks: DocumentChunk[],
  existingRecords?: ProcessedChunkRecord[]
): Promise<ChunkFilterResult> {
  const existingHashes = new Set<string>((existingRecords || []).map(r => r.hash));
  const newChunks: DocumentChunk[] = [];
  const skippedChunks: DocumentChunk[] = [];
  const newRecords: ProcessedChunkRecord[] = [];
  const seenInBatch = new Set<string>();

  for (const chunk of chunks) {
    const hash = await computeChunkHash(chunk);

    if (existingHashes.has(hash)) {
      // Bloque ya analizado previamente en consultas anteriores
      skippedChunks.push(chunk);
    } else if (seenInBatch.has(hash)) {
      // Bloque duplicado dentro del mismo lote de archivos cargados
      skippedChunks.push(chunk);
    } else {
      // Bloque nuevo que debe ser analizado por Gemini
      seenInBatch.add(hash);
      newChunks.push(chunk);
      newRecords.push({
        hash,
        sourceFileName: chunk.sourceFileName || chunk.file?.name,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        totalPages: chunk.totalPages,
        processedAt: Date.now(),
      });
    }
  }

  return { newChunks, skippedChunks, newRecords };
}
