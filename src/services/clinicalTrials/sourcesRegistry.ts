import { ClinicalTrial } from '../../types/clinicalTrials';
import { fetchClinicalTrialsGov } from './sources/clinicalTrialsGovAdapter';
import { renisAdapter } from './sources/renisAdapter';
import { unEnsayoParaMiAdapter } from './sources/unEnsayoParaMiAdapter';

export interface SyncSourcesOptions {
  onProgress?: (message: string) => void;
}

export interface SyncResult {
  trials: ClinicalTrial[];
  totalAddedOrUpdated: number;
  cordobaCount: number;
  sourcesUsed: string[];
  timestamp: number;
}

/**
 * Orquestador unificado de fuentes de ensayos clínicos
 * Deduplica estudios por identificador oficial (NCT ID) o identificador de fuente
 */
export async function syncAllTrialSources(options: SyncSourcesOptions = {}): Promise<SyncResult> {
  const { onProgress } = options;
  const trialsMap = new Map<string, ClinicalTrial>();
  const sourcesUsed: string[] = [];

  // 1. Fuente Principal: ClinicalTrials.gov API v2
  if (onProgress) onProgress('Consultando ClinicalTrials.gov API v2 (Argentina)...');
  try {
    const ctGovTrials = await fetchClinicalTrialsGov({
      conditionQuery: 'cancer OR oncology OR neoplasm OR tumor OR carcinoma OR leukemia OR lymphoma',
      locationQuery: 'Argentina',
      recruitingOnly: true,
      maxPages: 4
    });

    for (const trial of ctGovTrials) {
      // Clave única por nctId o id
      const key = trial.nctId || trial.id;
      trialsMap.set(key, trial);
    }
    sourcesUsed.push('clinicaltrials.gov');
    if (onProgress) onProgress(`ClinicalTrials.gov: ${ctGovTrials.length} estudios obtenidos.`);
  } catch (err) {
    console.error('Error al sincronizar ClinicalTrials.gov:', err);
    if (onProgress) onProgress('Aviso: ClinicalTrials.gov tuvo una advertencia temporal de red.');
  }

  // 2. Fuente Secundaria: RENIS / ANMAT (verificada)
  try {
    const renisTrials = await renisAdapter.fetchTrials();
    for (const trial of renisTrials) {
      const key = trial.nctId || trial.id;
      if (!trialsMap.has(key)) {
        trialsMap.set(key, trial);
      }
    }
    if (renisTrials.length > 0) sourcesUsed.push('renis');
  } catch (err) {
    console.warn('RENIS Adapter check:', err);
  }

  // 3. Fuente Terciaria: Un Ensayo para Mí (verificada)
  try {
    const uepmTrials = await unEnsayoParaMiAdapter.fetchTrials();
    for (const trial of uepmTrials) {
      const key = trial.nctId || trial.id;
      if (!trialsMap.has(key)) {
        trialsMap.set(key, trial);
      }
    }
    if (uepmTrials.length > 0) sourcesUsed.push('unensayoparami');
  } catch (err) {
    console.warn('Un Ensayo Para Mi check:', err);
  }

  const allTrials = Array.from(trialsMap.values());
  const cordobaCount = allTrials.filter(t => t.hasCordobaCenter).length;

  return {
    trials: allTrials,
    totalAddedOrUpdated: allTrials.length,
    cordobaCount,
    sourcesUsed,
    timestamp: Date.now()
  };
}
