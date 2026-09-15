import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { ClinicalTrial } from '../../types/clinicalTrials';
import { syncAllTrialSources, SyncResult } from './sourcesRegistry';

const COLLECTION_NAME = 'clinical_trials';
const LOCAL_STORAGE_KEY = 'clinical_trials_cached_v1';
const LAST_SYNC_KEY = 'clinical_trials_last_sync_v1';

/**
 * Obtiene los ensayos almacenados (primero desde Firestore, o desde caché local como fallback ultrarrápido)
 */
export async function getStoredClinicalTrials(): Promise<{ trials: ClinicalTrial[]; lastSync: number | null }> {
  let cachedTrials: ClinicalTrial[] = [];
  let lastSync: number | null = null;

  // 1. Intentar leer caché local para respuesta instantánea
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const rawSync = localStorage.getItem(LAST_SYNC_KEY);
    if (rawLocal) {
      cachedTrials = JSON.parse(rawLocal);
    }
    if (rawSync) {
      lastSync = parseInt(rawSync, 10);
    }
  } catch (e) {
    console.warn('Error leyendo localStorage de ensayos:', e);
  }

  // Si ya tenemos caché local, devolverla rápidamente, pero también podemos consultar Firestore
  if (cachedTrials.length > 0) {
    return { trials: cachedTrials, lastSync };
  }

  // 2. Si no hay en caché, intentar leer desde Firestore
  try {
    const q = query(collection(db, COLLECTION_NAME), limit(300));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const trials = snapshot.docs.map(d => d.data() as ClinicalTrial);
      saveToLocalCache(trials, Date.now());
      return { trials, lastSync: Date.now() };
    }
  } catch (err) {
    console.warn('Firestore clinical_trials no disponible o sin conexión:', err);
  }

  return { trials: [], lastSync };
}

/**
 * Guarda en caché local
 */
export function saveToLocalCache(trials: ClinicalTrial[], timestamp: number): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trials));
    localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
  } catch (e) {
    console.warn('No se pudo guardar ensayos en localStorage (límite de cuota):', e);
  }
}

/**
 * Ejecuta la sincronización completa desde las fuentes, actualiza Firestore y la caché local
 */
export async function syncAndStoreTrials(onProgress?: (msg: string) => void): Promise<SyncResult> {
  const syncResult = await syncAllTrialSources({ onProgress });

  if (onProgress) onProgress(`Guardando ${syncResult.trials.length} estudios en base de datos...`);

  // Guardar en caché local
  saveToLocalCache(syncResult.trials, syncResult.timestamp);

  // Intentar guardar en Firestore de forma no bloqueante
  try {
    const batchPromises = syncResult.trials.slice(0, 150).map(trial => {
      const docRef = doc(db, COLLECTION_NAME, trial.id);
      return setDoc(docRef, trial, { merge: true }).catch(err => {
        // Silencioso para evitar romper si hay reglas restrictivas
        console.debug('Error guardando ensayo individual:', trial.id, err);
      });
    });
    await Promise.allSettled(batchPromises);
  } catch (err) {
    console.warn('Aviso: Firestore sincronizado parcialmente o trabajando con caché local:', err);
  }

  if (onProgress) onProgress('Sincronización completada exitosamente.');

  return syncResult;
}
