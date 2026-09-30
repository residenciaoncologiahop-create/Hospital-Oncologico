import { describe, it, expect } from 'vitest';
import { 
  evaluateTrialMatch, 
  evaluateSinglePatientTrials, 
  analyzeDoctorPatients 
} from '../src/services/clinicalTrials/trialMatcher';
import { ClinicalTrial, PatientClinicalProfile } from '../src/types/clinicalTrials';

describe('FASE B: Exclusión de ensayos no oncológicos en Matcher y Pre-screening', () => {
  const baseTrial: ClinicalTrial = {
    id: 'ctgov_NCT00000001',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT00000001',
    nctId: 'NCT00000001',
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
    url: 'https://clinicaltrials.gov/study/NCT00000001',
    lastUpdated: '2026-01-01',
    importedAt: Date.now(),
    tumorTypes: ['mama'],
    biomarkers: []
  };

  const samplePatient: PatientClinicalProfile = {
    patientId: 'p-1',
    hcNumber: 'HC-12345',
    name: 'Paciente Test Mama',
    diagnosisRaw: 'Carcinoma ductal infiltrante de mama',
    organOrSite: 'mama',
    age: 50,
    sex: 'FEMALE',
    biomarkersDocumented: [],
    linesDocumented: [],
    priorTreatments: [],
    labsDocumented: {}
  };

  describe('evaluateTrialMatch', () => {
    it('clasifica directamente un ensayo con isOncology === false como incompatible ("not_compatible")', () => {
      const nonOncologyTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-fabry',
        title: 'Fabry Disease Outcome Survey',
        conditions: ['Fabry Disease'],
        tumorTypes: [],
        isOncology: false
      };

      const result = evaluateTrialMatch(samplePatient, nonOncologyTrial);
      expect(result.category).toBe('not_compatible');
      expect(result.categoryBadge).toBe('🔴');
      expect(result.incompatibilities.some(i => i.toLowerCase().includes('no oncológico'))).toBe(true);
    });

    it('evalúa normalmente un ensayo oncológico confirmado (isOncology === true)', () => {
      const oncologyTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-onc',
        isOncology: true
      };

      const result = evaluateTrialMatch(samplePatient, oncologyTrial);
      expect(result.category).not.toBe('not_compatible');
    });

    it('evalúa como oncológico por defecto un ensayo sin el campo isOncology (retrocompatibilidad / undefined)', () => {
      const legacyTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-legacy'
        // isOncology no está definido (undefined)
      };

      const result = evaluateTrialMatch(samplePatient, legacyTrial);
      // No debe ser rechazado por motivo de no oncológico
      expect(result.incompatibilities.some(i => i.toLowerCase().includes('no oncológico'))).toBe(false);
      expect(result.category).not.toBe('not_compatible');
    });
  });

  describe('evaluateSinglePatientTrials', () => {
    it('excluye ensayos con isOncology === false de los resultados de matching del paciente', () => {
      const oncTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-onc-1',
        isOncology: true
      };

      const nonOncTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-non-onc',
        title: 'Fabry Registry',
        conditions: ['Fabry Disease'],
        isOncology: false
      };

      const legacyTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-legacy-1'
        // isOncology es undefined
      };

      const evalResult = evaluateSinglePatientTrials(samplePatient, [oncTrial, nonOncTrial, legacyTrial]);

      // Solo los oncológicos (explícitos o por defecto) deben estar presentes
      const matchIds = evalResult.matches.map(m => m.trial.id);
      expect(matchIds).toContain('t-onc-1');
      expect(matchIds).toContain('t-legacy-1');
      expect(matchIds).not.toContain('t-non-onc');
    });
  });

  describe('analyzeDoctorPatients', () => {
    it('excluye ensayos con isOncology === false al analizar toda la cohorte médica', () => {
      const nonOncTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-non-onc-cohort',
        title: 'Anti-TNF for Rheumatoid Arthritis',
        conditions: ['Rheumatoid Arthritis'],
        isOncology: false
      };

      const summary = analyzeDoctorPatients([samplePatient], [nonOncTrial]);
      expect(summary.totalMatchesCount).toBe(0);
      expect(summary.patientsWithMatchesCount).toBe(0);
      expect(summary.evaluations[0].matches).toHaveLength(0);
    });

    it('incluye ensayos con isOncology === undefined en el análisis de cohorte (oncológicos por defecto)', () => {
      const legacyTrial: ClinicalTrial = {
        ...baseTrial,
        id: 't-legacy-cohort'
      };

      const summary = analyzeDoctorPatients([samplePatient], [legacyTrial]);
      expect(summary.totalMatchesCount).toBeGreaterThan(0);
      expect(summary.patientsWithMatchesCount).toBe(1);
    });
  });
});
