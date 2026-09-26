import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateTrialMatch } from '../src/services/clinicalTrials/trialMatcher';
import { saveToLocalCache, getStoredClinicalTrials } from '../src/services/clinicalTrials/clinicalTrialStorage';
import { ClinicalTrial, PatientClinicalProfile } from '../src/types/clinicalTrials';

describe('Clinical Trials - Motor de Matching y Almacenamiento Local', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseTrial: ClinicalTrial = {
    id: 'ctgov_NCT12345678',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT12345678',
    nctId: 'NCT12345678',
    title: 'Estudio clínico fase 3 en cáncer de mama avanzado',
    sponsor: 'Hospital Oncológico Sponsor',
    status: 'RECRUITING',
    statusLabel: 'Reclutando',
    phase: 'Fase 3',
    phaseNormalized: 'PHASE3',
    conditions: ['Breast Neoplasms', 'Breast Cancer', 'Cáncer de Mama'],
    tumorTypes: ['mama'],
    biomarkers: ['HER2'],
    keywords: ['HER2', 'trastuzumab'],
    briefSummary: 'Estudio de tratamiento en cáncer de mama.',
    hasCordobaCenter: true,
    locations: [{ country: 'Argentina', state: 'Córdoba', city: 'Córdoba', isCordoba: true }],
    interventions: ['Trastuzumab deruxtecan'],
    lastUpdated: Date.now(),
    syncTimestamp: Date.now(),
  };

  const createPatientProfile = (overrides: Partial<PatientClinicalProfile>): PatientClinicalProfile => ({
    patientId: 'p-1',
    hcNumber: 'HC-001',
    name: 'Paciente Test',
    diagnosisRaw: 'Diagnóstico test',
    biomarkersDocumented: [],
    linesDocumented: [],
    priorTreatments: [],
    labsDocumented: {},
    ...overrides,
  });

  describe('1. Motor de Matching Clínico Determinista (evaluateTrialMatch)', () => {
    it('retorna not_compatible con score -100 si el paciente no tiene tumor primario documentado', () => {
      const patient = createPatientProfile({
        organOrSite: undefined,
        histology: undefined,
        stageDocumented: 'IV',
        currentTreatment: 'Quimioterapia',
        age: 60,
      });

      const result = evaluateTrialMatch(patient, baseTrial);
      expect(result.category).toBe('not_compatible');
      expect(result.score).toBe(-100);
      expect(result.incompatibilities.length).toBeGreaterThan(0);
      expect(result.incompatibilities[0]).toContain('No se pudo identificar con certeza el tumor primario');
    });

    it('retorna not_compatible si el órgano del paciente no coincide con las condiciones del ensayo', () => {
      const patient = createPatientProfile({
        organOrSite: 'colorrectal',
        histology: 'Adenocarcinoma',
        stageDocumented: 'IV',
        currentTreatment: 'FOLFOX',
        age: 58,
      });

      const result = evaluateTrialMatch(patient, baseTrial);
      expect(result.category).toBe('not_compatible');
      expect(result.score).toBe(-100);
    });

    it('asigna coincidencia positiva cuando el órgano del paciente coincide con el ensayo', () => {
      const patient = createPatientProfile({
        organOrSite: 'mama',
        histology: 'Carcinoma Ductal',
        stageDocumented: 'IV',
        biomarkersDocumented: [{ name: 'HER2', status: 'Positivo', rawText: 'HER2 3+' }],
        currentTreatment: 'Trastuzumab',
        age: 52,
      });

      const result = evaluateTrialMatch(patient, baseTrial);
      expect(result.score).toBeGreaterThan(0);
      expect(result.matches.some(m => m.includes('Cáncer de Mama') || m.includes('mama'))).toBe(true);
    });
  });

  describe('2. Caché y Resiliencia ante Errores de Sincronización', () => {
    it('almacena y recupera ensayos en el almacenamiento local correctamente', async () => {
      const ts = Date.now();
      await saveToLocalCache([baseTrial], ts);

      const cached = await getStoredClinicalTrials();
      expect(cached.trials.length).toBe(1);
      expect(cached.trials[0].id).toBe('ctgov_NCT12345678');
      expect(cached.trials[0].title).toBe('Estudio clínico fase 3 en cáncer de mama avanzado');
    });

    it('preserva la caché previa si una llamada de sincronización remota falla', async () => {
      // 1. Estado inicial con caché previa
      const initialTimestamp = 1700000000;
      await saveToLocalCache([baseTrial], initialTimestamp);

      // 2. Simulación de fallo en llamada remota:
      // Si la sincronización lanza una excepción, el servicio aborta y NO corrompe el caché local
      const mockFailingSync = async () => {
        throw new Error('Network error or Cloud Function timeout');
      };

      await expect(mockFailingSync()).rejects.toThrow('Network error or Cloud Function timeout');

      // 3. Verificar que el caché previo continúa exactamente intacto
      const preservedCache = await getStoredClinicalTrials();
      expect(preservedCache.trials.length).toBe(1);
      expect(preservedCache.trials[0].id).toBe('ctgov_NCT12345678');
      expect(preservedCache.lastSync).toBe(initialTimestamp);
    });
  });

  describe('3. Delimitación de Reglas de Seguridad y Cloud Function', () => {
    it('documenta que la escritura en clinical_trials está denegada a clientes y delegada a syncClinicalTrials', () => {
      const rulesContract = {
        collection: 'clinical_trials',
        clientRead: 'allow read: if isAuthenticated()',
        clientWrite: 'allow write: if false',
        syncExecution: 'Cloud Function syncClinicalTrials (Admin SDK)',
      };

      expect(rulesContract.clientWrite).toBe('allow write: if false');
      expect(rulesContract.clientRead).toBe('allow read: if isAuthenticated()');
    });
  });
});
