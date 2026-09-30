import { describe, it, expect } from 'vitest';
import { 
  evaluateTrialMatch, 
  evaluateSinglePatientTrials, 
  analyzeDoctorPatients 
} from '../src/services/clinicalTrials/trialMatcher';
import { ClinicalTrial, PatientClinicalProfile } from '../src/types/clinicalTrials';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { identifyStaleTrials } = require('../functions/clinicalTrialsSync.js');

describe('TAREA 2: Marcado STALE/ACTIVE y exclusión de ensayos obsoletos', () => {
  const baseTrial: ClinicalTrial = {
    id: 'ctgov_NCT01234567',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT01234567',
    nctId: 'NCT01234567',
    title: 'Estudio de prueba en Cáncer de Mama',
    sponsor: 'Hospital Test',
    status: 'RECRUITING',
    statusLabel: 'Reclutando',
    phase: 'Fase 3',
    phaseNormalized: 'PHASE3',
    conditions: ['Breast Cancer'],
    interventions: ['Trastuzumab'],
    briefSummary: 'Resumen de prueba',
    eligibilityCriteria: 'Inclusion Criteria:\n- Age >= 18',
    inclusionCriteria: ['Age >= 18'],
    exclusionCriteria: [],
    minimumAgeYears: 18,
    sex: 'ALL',
    locations: [],
    hasCordobaCenter: false,
    hasArgentinaCenter: true,
    cordobaCenters: [],
    url: 'https://clinicaltrials.gov/study/NCT01234567',
    lastUpdated: '2026-01-01',
    importedAt: Date.now(),
    tumorTypes: ['mama'],
    biomarkers: []
  };

  const samplePatient: PatientClinicalProfile = {
    patientId: 'p-1',
    hcNumber: 'HC-999',
    name: 'Paciente Test',
    diagnosisRaw: 'Cáncer de mama',
    organOrSite: 'mama',
    age: 45,
    sex: 'FEMALE',
    biomarkersDocumented: [],
    linesDocumented: [],
    priorTreatments: [],
    labsDocumented: {}
  };

  describe('Función pura: identifyStaleTrials', () => {
    const runTimestamp = 1700000000000;

    it('identifica como STALE documentos con lastSyncedAt anterior a la corrida actual', () => {
      const docs = [
        { id: 'trial_active', data: () => ({ lastSyncedAt: runTimestamp, syncStatus: 'ACTIVE' }) },
        { id: 'trial_old', data: () => ({ lastSyncedAt: runTimestamp - 10000, syncStatus: 'ACTIVE' }) }
      ];

      const stale = identifyStaleTrials(docs, runTimestamp);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe('trial_old');
      expect(stale[0].staleSince).toBe(runTimestamp);
    });

    it('identifica como STALE documentos legacy sin el campo lastSyncedAt (undefined o null)', () => {
      const docs = [
        { id: 'trial_no_field', data: () => ({ syncStatus: 'ACTIVE' }) },
        { id: 'trial_null_field', data: () => ({ lastSyncedAt: null }) },
        { id: 'trial_active', data: () => ({ lastSyncedAt: runTimestamp }) }
      ];

      const stale = identifyStaleTrials(docs, runTimestamp);
      expect(stale).toHaveLength(2);
      expect(stale.map((s: { id: string }) => s.id)).toEqual(['trial_no_field', 'trial_null_field']);
    });

    it('no re-agrega a la lista de updates si ya tiene syncStatus === "STALE"', () => {
      const docs = [
        { id: 'trial_already_stale', data: () => ({ lastSyncedAt: runTimestamp - 50000, syncStatus: 'STALE', staleSince: 1600000000000 }) },
        { id: 'trial_active', data: () => ({ lastSyncedAt: runTimestamp }) }
      ];

      const stale = identifyStaleTrials(docs, runTimestamp);
      expect(stale).toHaveLength(0);
    });
  });

  describe('Comportamiento en Pre-Screening y Matcher', () => {
    it('evaluateSinglePatientTrials excluye ensayos con syncStatus === "STALE"', () => {
      const activeTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-active',
        syncStatus: 'ACTIVE'
      };

      const staleTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-stale',
        syncStatus: 'STALE',
        staleSince: Date.now() - 86400000
      };

      const evalResult = evaluateSinglePatientTrials(samplePatient, [activeTrial, staleTrial]);
      // Solo el activo debe estar presente en los resultados
      expect(evalResult.matches.some(m => m.trial.id === 't-active')).toBe(true);
      expect(evalResult.matches.some(m => m.trial.id === 't-stale')).toBe(false);
    });

    it('evaluateTrialMatch clasifica directamente un ensayo STALE como incompatible', () => {
      const staleTrial: ClinicalTrial = {
        ...baseTrial,
        syncStatus: 'STALE',
        staleSince: Date.now()
      };

      const result = evaluateTrialMatch(samplePatient, staleTrial);
      expect(result.category).toBe('not_compatible');
      expect(result.incompatibilities.some(i => i.toLowerCase().includes('no verificado') || i.toLowerCase().includes('obsoleto'))).toBe(true);
    });

    it('analyzeDoctorPatients no evalúa ensayos STALE en la cohorte', () => {
      const staleTrial: ClinicalTrial = {
        ...baseTrial,
        syncStatus: 'STALE'
      };

      const summary = analyzeDoctorPatients([samplePatient], [staleTrial]);
      expect(summary.totalMatchesCount).toBe(0);
      expect(summary.evaluations[0].matches).toHaveLength(0);
    });
  });
});
