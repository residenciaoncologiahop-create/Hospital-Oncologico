import { db } from '../../lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ClinicalTrial } from '../../types/clinicalTrials';
import { SyncResult } from './sourcesRegistry';
import { parseStructuredCriteria } from './criteriaParser';

const COLLECTION_NAME = 'clinical_trials';
const LOCAL_STORAGE_KEY = 'clinical_trials_cached_v2';
const LAST_SYNC_KEY = 'clinical_trials_last_sync_v2';
const CHUNK_MANIFEST_KEY = 'clinical_trials_manifest_v2';
const CHUNK_PREFIX = 'clinical_trials_chunk_v2_';

interface ChunkManifest {
  chunkCount: number;
  totalTrials: number;
  timestamp: number;
  compressed: boolean;
}

/**
 * Limpia fragmentos antiguos o huérfanos de sincronizaciones previas
 */
function cleanOldChunks(): void {
  try {
    const rawManifest = localStorage.getItem(CHUNK_MANIFEST_KEY);
    if (rawManifest) {
      const manifest = JSON.parse(rawManifest);
      const count = typeof manifest.chunkCount === 'number' ? manifest.chunkCount : 0;
      for (let i = 0; i < count; i++) {
        localStorage.removeItem(`${CHUNK_PREFIX}${i}`);
      }
      localStorage.removeItem(CHUNK_MANIFEST_KEY);
    }
    for (let i = 0; i < 50; i++) {
      const key = `${CHUNK_PREFIX}${i}`;
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      } else {
        break;
      }
    }
  } catch {
    // Ignorar errores de limpieza
  }
}

/**
 * Comprime texto usando CompressionStream nativo si está disponible en el navegador
 */
async function compressString(text: string): Promise<{ text: string; compressed: boolean }> {
  if (typeof CompressionStream === 'undefined') {
    return { text, compressed: false };
  }
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { text: btoa(binary), compressed: true };
  } catch {
    return { text, compressed: false };
  }
}

/**
 * Descomprime payload base64 usando DecompressionStream nativo
 */
async function decompressString(payload: string, isCompressed: boolean): Promise<string> {
  if (!isCompressed || typeof DecompressionStream === 'undefined') {
    return payload;
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

/**
 * Reconstruye los estudios desde el almacenamiento fragmentado
 */
async function loadChunkedCache(): Promise<{ trials: ClinicalTrial[]; lastSync: number | null } | null> {
  const rawManifest = localStorage.getItem(CHUNK_MANIFEST_KEY);
  if (!rawManifest) return null;

  try {
    const manifest: ChunkManifest = JSON.parse(rawManifest);
    let fullPayload = '';
    for (let i = 0; i < manifest.chunkCount; i++) {
      const chunk = localStorage.getItem(`${CHUNK_PREFIX}${i}`);
      if (chunk === null) {
        return null;
      }
      fullPayload += chunk;
    }

    if (!fullPayload) return null;

    const jsonText = await decompressString(fullPayload, manifest.compressed);
    const trials = JSON.parse(jsonText);

    if (Array.isArray(trials) && trials.length > 0) {
      return {
        trials,
        lastSync: manifest.timestamp || null,
      };
    }
  } catch (e) {
    console.warn('Error al reconstruir caché fragmentado de ensayos:', e);
  }

  return null;
}

/**
 * Asegura que los ensayos dispongan de criterios estructurados.
 * Si provienen de versiones históricas o almacenamiento sin structuredCriteria,
 * los parsea y enriquece en memoria de forma conservadora sin modificar el texto original.
 */
function ensureStructuredCriteria(trials: ClinicalTrial[]): ClinicalTrial[] {
  return trials.map(t => {
    if (!t.structuredCriteria || t.structuredCriteria.length === 0) {
      const { structuredCriteria, ecogMaxAdmissible } = parseStructuredCriteria({
        inclusionLines: t.inclusionCriteria || [],
        exclusionLines: t.exclusionCriteria || [],
        minimumAgeYears: t.minimumAgeYears,
        maximumAgeYears: t.maximumAgeYears,
        sex: t.sex
      });
      return {
        ...t,
        structuredCriteria,
        ecogMaxAdmissible: t.ecogMaxAdmissible ?? ecogMaxAdmissible
      };
    }
    return t;
  });
}

/**
 * Obtiene los ensayos almacenados:
 * 1. Intenta leer el caché estándar anterior (clinical_trials_cached_v2).
 * 2. Si no existe o está vacío, busca y reconstruye el caché fragmentado.
 * 3. Si no hay ningún caché válido, consulta Firestore.
 */
export async function getStoredClinicalTrials(): Promise<{ trials: ClinicalTrial[]; lastSync: number | null }> {
  let cachedTrials: ClinicalTrial[] = [];
  let lastSync: number | null = null;

  // 1. Intentar leer caché actual estándar en una sola clave (compatibilidad con versiones previas)
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const rawSync = localStorage.getItem(LAST_SYNC_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedTrials = ensureStructuredCriteria(parsed);
        if (rawSync) lastSync = parseInt(rawSync, 10);
        return { trials: cachedTrials, lastSync };
      }
    }
  } catch (e) {
    console.warn('Error leyendo localStorage de ensayos estándar:', e);
  }

  // 2. Si no hay en caché estándar, intentar leer desde el caché fragmentado
  try {
    const chunkedResult = await loadChunkedCache();
    if (chunkedResult && chunkedResult.trials.length > 0) {
      return {
        trials: ensureStructuredCriteria(chunkedResult.trials),
        lastSync: chunkedResult.lastSync
      };
    }
  } catch (e) {
    console.warn('Error leyendo caché fragmentado de ensayos:', e);
  }

  // 3. Si no hay ningún caché válido, leer desde Firestore
  try {
    const q = query(collection(db, COLLECTION_NAME), limit(300));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const trials = ensureStructuredCriteria(snapshot.docs.map(d => d.data() as ClinicalTrial));
      await saveToLocalCache(trials, Date.now());
      return { trials, lastSync: Date.now() };
    }
  } catch (err) {
    console.warn('Firestore clinical_trials no disponible o sin conexión:', err);
  }

  return { trials: [], lastSync };
}

/**
 * Guarda en caché local:
 * - Primero intenta almacenamiento estándar en una sola clave (si el dataset es pequeño).
 * - Si excede cuota, fragmenta y almacena en chunks con manifiesto.
 * - Solo actualiza clinical_trials_last_sync_v2 si el guardado fue exitoso.
 */
export async function saveToLocalCache(trials: ClinicalTrial[], timestamp: number): Promise<void> {
  // 1. Intentar guardado directo estándar en una sola entrada
  try {
    cleanOldChunks();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trials));
    localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
    return;
  } catch {
    // Si excede la cuota en una sola clave, proceder con el almacenamiento fragmentado
  }

  // 2. Almacenamiento fragmentado (chunked)
  try {
    cleanOldChunks();
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    const rawJson = JSON.stringify(trials);
    const { text: payload, compressed } = await compressString(rawJson);

    const CHUNK_SIZE = 200_000;
    const chunkCount = Math.ceil(payload.length / CHUNK_SIZE);

    for (let i = 0; i < chunkCount; i++) {
      const slice = payload.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      localStorage.setItem(`${CHUNK_PREFIX}${i}`, slice);
    }

    const manifest: ChunkManifest = {
      chunkCount,
      totalTrials: trials.length,
      timestamp,
      compressed,
    };

    localStorage.setItem(CHUNK_MANIFEST_KEY, JSON.stringify(manifest));
    localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
  } catch (e) {
    console.warn('No se pudo guardar ensayos en localStorage fragmentado (límite de cuota):', e);
  }
}

interface SyncFunctionResponse {
  success: boolean;
  totalFetched: number;
  totalSaved: number;
  cordobaCount: number;
  timestamp: number;
  errors: string[] | null;
}

/**
 * Ejecuta la sincronización en backend mediante la Cloud Function syncClinicalTrials,
 * recupera los estudios actualizados desde Firestore y actualiza la caché local.
 */
export async function syncAndStoreTrials(onProgress?: (msg: string) => void): Promise<SyncResult> {
  if (onProgress) onProgress('Iniciando sincronización con el servidor...');

  let fnData: SyncFunctionResponse;
  try {
    const functions = getFunctions();
    const syncFn = httpsCallable<unknown, SyncFunctionResponse>(
      functions,
      'syncClinicalTrials',
      { timeout: 300_000 }
    );

    if (onProgress) onProgress('Sincronizando ensayos oficiales en la nube (ClinicalTrials.gov)...');
    const result = await syncFn({});
    fnData = result.data;
  } catch (err: unknown) {
    console.error('Error al invocar syncClinicalTrials:', err);
    const message = err instanceof Error ? err.message : 'Error de conexión con el servicio de sincronización';
    throw new Error(`Error en sincronización remota: ${message}`);
  }

  if (!fnData || !fnData.success) {
    const detail = fnData?.errors?.join(', ') || 'Respuesta inválida del servidor';
    throw new Error(`La sincronización no pudo completarse: ${detail}`);
  }

  if (onProgress) onProgress(`Sincronización remota completada (${fnData.totalSaved} estudios). Actualizando base de datos local...`);

  // Recuperar los estudios actualizados desde Firestore (solo lectura)
  let trials: ClinicalTrial[] = [];
  try {
    const q = query(collection(db, COLLECTION_NAME), limit(300));
    const snapshot = await getDocs(q);
    trials = ensureStructuredCriteria(snapshot.docs.map(d => d.data() as ClinicalTrial));
  } catch (err: unknown) {
    console.error('Error al leer clinical_trials de Firestore tras sincronización:', err);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Sincronización en la nube exitosa, pero falló la lectura de datos: ${message}`);
  }

  const timestamp = fnData.timestamp || Date.now();

  // Guardar en caché local
  await saveToLocalCache(trials, timestamp);

  const cordobaCount = fnData.cordobaCount ?? trials.filter(t => t.hasCordobaCenter).length;

  if (onProgress) onProgress('Sincronización completada exitosamente.');

  return {
    trials,
    totalAddedOrUpdated: fnData.totalSaved ?? trials.length,
    cordobaCount,
    sourcesUsed: ['clinicaltrials.gov'],
    timestamp,
  };
}
