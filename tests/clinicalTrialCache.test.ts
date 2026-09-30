import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  isCacheFresh, 
  getStoredClinicalTrials, 
  saveToLocalCache,
  getLocalCachedTrials
} from '../src/services/clinicalTrials/clinicalTrialStorage';
import { ClinicalTrial } from '../src/types/clinicalTrials';

// Mock de Firestore para controlar las pruebas de red/fallback
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn()
}));

vi.mock('../src/lib/firebase', () => ({
  db: {}
}));

import { getDocs } from 'firebase/firestore';

describe('TAREA 4: Caché con vencimiento de 24h y respaldo resiliente', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const sampleTrial: ClinicalTrial = {
    id: 'ctgov_NCT99999999',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT99999999',
    title: 'Estudio de prueba Caché',
    sponsor: 'Test Sponsor',
    status: 'RECRUITING',
    statusLabel: 'Reclutando',
    phase: 'Fase 2',
    phaseNormalized: 'PHASE2',
    conditions: ['Melanoma'],
    interventions: [],
    briefSummary: 'Resumen',
    eligibilityCriteria: '',
    inclusionCriteria: [],
    exclusionCriteria: [],
    sex: 'ALL',
    locations: [],
    hasCordobaCenter: false,
    hasArgentinaCenter: true,
    cordobaCenters: [],
    url: 'https://test',
    lastUpdated: '2026-01-01',
    importedAt: Date.now(),
    tumorTypes: ['melanoma'],
    biomarkers: [],
    lastSyncedAt: 1700000000000
  };

  describe('Función pura: isCacheFresh', () => {
    const now = 1700000000000;

    it('devuelve true si lastSync está dentro de las 24 horas', () => {
      const oneHourAgo = now - 60 * 60 * 1000;
      const twentyThreeHoursAgo = now - 23 * 60 * 60 * 1000;
      const exactlyTwentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

      expect(isCacheFresh(oneHourAgo, now)).toBe(true);
      expect(isCacheFresh(twentyThreeHoursAgo, now)).toBe(true);
      expect(isCacheFresh(exactlyTwentyFourHoursAgo, now)).toBe(true);
    });

    it('devuelve false si lastSync tiene más de 24 horas', () => {
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

      expect(isCacheFresh(twentyFiveHoursAgo, now)).toBe(false);
      expect(isCacheFresh(threeDaysAgo, now)).toBe(false);
    });

    it('devuelve false si lastSync es nulo, indefinido, NaN o futuro', () => {
      expect(isCacheFresh(null, now)).toBe(false);
      expect(isCacheFresh(undefined, now)).toBe(false);
      expect(isCacheFresh(NaN, now)).toBe(false);
      expect(isCacheFresh(now + 10000, now)).toBe(false);
    });
  });

  describe('Flujo de getStoredClinicalTrials con expiración y fallback', () => {
    it('si el caché local tiene menos de 24h, lo devuelve directamente sin consultar Firestore', async () => {
      const freshSync = Date.now() - 2 * 60 * 60 * 1000; // 2 horas atrás
      await saveToLocalCache([sampleTrial], freshSync);

      const result = await getStoredClinicalTrials();
      expect(result.trials).toHaveLength(1);
      expect(result.trials[0].id).toBe(sampleTrial.id);
      expect(result.lastSync).toBe(freshSync);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('si el caché local tiene más de 24h, ignora localStorage y lee desde Firestore usando max lastSyncedAt', async () => {
      const expiredSync = Date.now() - 26 * 60 * 60 * 1000; // 26 horas atrás
      await saveToLocalCache([sampleTrial], expiredSync);

      const firestoreTimestamp1 = 1710000000000;
      const firestoreTimestamp2 = 1715000000000;

      const firestoreDoc1: ClinicalTrial = { ...sampleTrial, id: 't-1', lastSyncedAt: firestoreTimestamp1 };
      const firestoreDoc2: ClinicalTrial = { ...sampleTrial, id: 't-2', lastSyncedAt: firestoreTimestamp2 };

      // Mock de respuesta Firestore con datos frescos
      (getDocs as any).mockResolvedValueOnce({
        empty: false,
        docs: [
          { data: () => firestoreDoc1 },
          { data: () => firestoreDoc2 }
        ]
      });

      const result = await getStoredClinicalTrials();
      expect(getDocs).toHaveBeenCalledTimes(1);
      expect(result.trials).toHaveLength(2);
      // No debe ser Date.now(), sino el máximo lastSyncedAt de los documentos
      expect(result.lastSync).toBe(firestoreTimestamp2);

      // Debe haber actualizado el caché local con el nuevo maxLastSyncedAt
      const cached = await getLocalCachedTrials();
      expect(cached?.lastSync).toBe(firestoreTimestamp2);
    });

    it('si el caché local expiró (>24h) y Firestore falla, usa el caché viejo como respaldo resiliente', async () => {
      const expiredSync = Date.now() - 30 * 60 * 60 * 1000;
      await saveToLocalCache([sampleTrial], expiredSync);

      // Mock de falla de red en Firestore
      (getDocs as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await getStoredClinicalTrials();
      // Respaldo resiliente: devuelve los datos que estaban en el caché expirado
      expect(result.trials).toHaveLength(1);
      expect(result.trials[0].id).toBe(sampleTrial.id);
      expect(result.lastSync).toBe(expiredSync);
    });
  });
});
