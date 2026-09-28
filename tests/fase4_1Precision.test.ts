import { describe, it, expect } from 'vitest';
import { evaluateTrialMatch, isCordobaSiteRecruiting } from '../src/services/clinicalTrials/trialMatcher';
import { ClinicalTrial, PatientClinicalProfile } from '../src/types/clinicalTrials';

describe('FASE 4.1: Precisión Semántica del Pre-Screening (16 Tests Obligatorios)', () => {
  const baseTrial: ClinicalTrial = {
    id: 'ctgov_test_trial_f41',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT05000002',
    nctId: 'NCT05000002',
    title: 'Estudio de Precisión Semántica en Cáncer de Pulmón',
    sponsor: 'Hospital Oncológico',
    status: 'RECRUITING',
    statusLabel: 'Reclutando',
    phase: 'Fase 3',
    phaseNormalized: 'PHASE3',
    conditions: ['NSCLC', 'Cáncer de Pulmón'],
    tumorTypes: ['pulmon'],
    biomarkers: [],
    briefSummary: 'Estudio de evaluación semántica controlada.',
    eligibilityCriteria: '',
    inclusionCriteria: [],
    exclusionCriteria: [],
    sex: 'ALL',
    locations: [],
    hasCordobaCenter: false,
    hasArgentinaCenter: true,
    cordobaCenters: [],
    url: 'https://clinicaltrials.gov/study/NCT05000002',
    lastUpdated: '2026-03-01',
    importedAt: Date.now()
  };

  const createPatient = (overrides: Partial<PatientClinicalProfile>): PatientClinicalProfile => ({
    patientId: 'patient-f41',
    hcNumber: 'HC-999',
    name: 'Paciente Semántico',
    diagnosisRaw: 'Cáncer de pulmón',
    organOrSite: 'pulmon',
    histology: 'Adenocarcinoma',
    biomarkersDocumented: [],
    linesDocumented: [],
    priorTreatments: [],
    labsDocumented: {},
    ...overrides
  });

  // =========================================================================
  // 1. PD-L1 CUANTITATIVO
  // =========================================================================
  describe('1. Criterios Cuantitativos de PD-L1', () => {
    const trialPdl1Min50: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_pdl1_50',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'PD-L1 tumor proportion score (TPS) >= 50%',
          parseStatus: 'STRUCTURED',
          details: {
            gene: 'PD-L1',
            statusRequired: 'POSITIVE',
            minNumericThreshold: 50
          }
        }
      ]
    };

    it('1. PD-L1 >= 50% + paciente 80% → CUMPLE', () => {
      const patient = createPatient({
        biomarkersDocumented: [
          { name: 'PD-L1', status: '80%', rawText: 'PD-L1 TPS 80%' }
        ]
      });

      const result = evaluateTrialMatch(patient, trialPdl1Min50);
      const crit = result.criteriaEvaluations?.find(c => c.name.includes('PD-L1'));
      expect(crit?.status).toBe('CUMPLE');
      expect(result.incompatibilities.length).toBe(0);
    });

    it('2. PD-L1 >= 50% + paciente 20% → NO CUMPLE', () => {
      const patient = createPatient({
        biomarkersDocumented: [
          { name: 'PD-L1', status: '20%', rawText: 'PD-L1 TPS 20%' }
        ]
      });

      const result = evaluateTrialMatch(patient, trialPdl1Min50);
      const crit = result.criteriaEvaluations?.find(c => c.name.includes('PD-L1'));
      expect(crit?.status).toBe('NO CUMPLE');
      expect(result.category).toBe('not_compatible');
      expect(result.incompatibilities.length).toBeGreaterThan(0);
    });

    it('3. PD-L1 >= 50% + paciente "Positivo" sin porcentaje → NO DOCUMENTADO', () => {
      const patient = createPatient({
        biomarkersDocumented: [
          { name: 'PD-L1', status: 'Positivo', rawText: 'PD-L1 positivo sin cuantificar TPS' }
        ]
      });

      const result = evaluateTrialMatch(patient, trialPdl1Min50);
      const crit = result.criteriaEvaluations?.find(c => c.name.includes('PD-L1'));
      expect(crit?.status).toBe('NO DOCUMENTADO');
      expect(crit?.statusLabel).toContain('Falta porcentaje');
      expect(result.category).not.toBe('potential_candidate');
      expect(result.missingItems?.some(item => item.includes('Falta porcentaje cuantitativo de PD-L1'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. LABORATORIO Y ULN
  // =========================================================================
  describe('2. Criterios de Laboratorio y ULN', () => {
    const trialAstUln: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_ast_uln',
          criterionType: 'inclusion',
          category: 'LAB',
          mandatory: true,
          sourceText: 'AST <= 2.5 x ULN',
          parseStatus: 'STRUCTURED',
          details: {
            labParameter: 'ast',
            labOperator: '<=',
            labValue: 2.5,
            labReference: 'ULN'
          }
        }
      ]
    };

    it('4. AST <= 2.5 × ULN + AST 35 + ULN 40 → CUMPLE (35 <= 100)', () => {
      const patient = createPatient({
        labsDocumented: {
          ast: 35,
          uln: { ast: 40 }
        }
      });

      const result = evaluateTrialMatch(patient, trialAstUln);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'LAB');
      expect(crit?.status).toBe('CUMPLE');
      expect(result.incompatibilities.length).toBe(0);
    });

    it('5. AST <= 2.5 × ULN + AST documentado pero ULN ausente → NO EVALUABLE (nunca NO CUMPLE)', () => {
      const patient = createPatient({
        labsDocumented: {
          ast: 35
          // sin uln
        }
      });

      const result = evaluateTrialMatch(patient, trialAstUln);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'LAB');
      expect(crit?.status).toBe('NO EVALUABLE');
      expect(crit?.statusLabel).toContain('requiere ULN');
      expect(result.category).not.toBe('not_compatible');
      expect(result.incompatibilities.length).toBe(0);
      expect(result.category).toBe('potential_missing_data');
    });

    it('6. AST con referencia incompatible / no verificable → NO EVALUABLE', () => {
      const trialIncompatibleLab: ClinicalTrial = {
        ...baseTrial,
        structuredCriteria: [
          {
            id: 'crit_alt_uln_inv',
            criterionType: 'inclusion',
            category: 'LAB',
            mandatory: true,
            sourceText: 'ALT <= 3 x ULN',
            parseStatus: 'STRUCTURED',
            details: {
              labParameter: 'alt',
              labOperator: '<=',
              labValue: 3,
              labReference: 'ULN'
            }
          }
        ]
      };

      const patient = createPatient({
        labsDocumented: {
          alt: 50,
          uln: { ast: 40 } // tiene ULN de AST pero no de ALT
        }
      });

      const result = evaluateTrialMatch(patient, trialIncompatibleLab);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'LAB');
      expect(crit?.status).toBe('NO EVALUABLE');
      expect(result.category).not.toBe('not_compatible');
    });

    it('7. Confirmar que los criterios de laboratorio sin ULN continúan funcionando igual', () => {
      const trialDirectLab: ClinicalTrial = {
        ...baseTrial,
        structuredCriteria: [
          {
            id: 'crit_bili_direct',
            criterionType: 'inclusion',
            category: 'LAB',
            mandatory: true,
            sourceText: 'Total bilirubin <= 1.5 mg/dL',
            parseStatus: 'STRUCTURED',
            details: {
              labParameter: 'total_bilirubin',
              labOperator: '<=',
              labValue: 1.5
            }
          }
        ]
      };

      const patientNormal = createPatient({ labsDocumented: { totalBilirubin: 0.9 } });
      const resNormal = evaluateTrialMatch(patientNormal, trialDirectLab);
      expect(resNormal.criteriaEvaluations?.[0].status).toBe('CUMPLE');

      const patientHigh = createPatient({ labsDocumented: { totalBilirubin: 2.5 } });
      const resHigh = evaluateTrialMatch(patientHigh, trialDirectLab);
      expect(resHigh.criteriaEvaluations?.[0].status).toBe('NO CUMPLE');
      expect(resHigh.category).toBe('not_compatible');
    });
  });

  // =========================================================================
  // 3. RECRUITING ESPECÍFICO DE CÓRDOBA
  // =========================================================================
  describe('3. Estado de Reclutamiento de la Sede de Córdoba', () => {
    it('8. Global RECRUITING + Córdoba RECRUITING → etiqueta Córdoba Recruiting', () => {
      const trial: ClinicalTrial = {
        ...baseTrial,
        status: 'RECRUITING',
        hasCordobaCenter: true,
        hasCordobaRecruitingCenter: true,
        cordobaRecruitingStatus: 'RECRUITING',
        locations: [
          { country: 'Argentina', state: 'Córdoba', city: 'Córdoba', isCordoba: true, status: 'RECRUITING' }
        ]
      };

      expect(isCordobaSiteRecruiting(trial)).toBe(true);
    });

    it('9. Global RECRUITING + Córdoba NOT_YET_RECRUITING → NO etiqueta Córdoba Recruiting', () => {
      const trial: ClinicalTrial = {
        ...baseTrial,
        status: 'RECRUITING',
        hasCordobaCenter: true,
        hasCordobaRecruitingCenter: false,
        cordobaRecruitingStatus: 'NOT_YET_RECRUITING',
        locations: [
          { country: 'Argentina', state: 'Córdoba', city: 'Córdoba', isCordoba: true, status: 'NOT_YET_RECRUITING' }
        ]
      };

      expect(isCordobaSiteRecruiting(trial)).toBe(false);
    });

    it('10. Global RECRUITING + Córdoba SUSPENDED → NO etiqueta Córdoba Recruiting', () => {
      const trial: ClinicalTrial = {
        ...baseTrial,
        status: 'RECRUITING',
        hasCordobaCenter: true,
        hasCordobaRecruitingCenter: false,
        cordobaRecruitingStatus: 'SUSPENDED',
        locations: [
          { country: 'Argentina', state: 'Córdoba', city: 'Córdoba', isCordoba: true, status: 'SUSPENDED' }
        ]
      };

      expect(isCordobaSiteRecruiting(trial)).toBe(false);
    });

    it('11. Global RECRUITING + Córdoba sin estado / desconocido → NO afirmar recruiting local', () => {
      const trial: ClinicalTrial = {
        ...baseTrial,
        status: 'RECRUITING',
        hasCordobaCenter: true,
        hasCordobaRecruitingCenter: false,
        cordobaRecruitingStatus: 'UNKNOWN',
        locations: [
          { country: 'Argentina', state: 'Córdoba', city: 'Córdoba', isCordoba: true, status: undefined }
        ]
      };

      expect(isCordobaSiteRecruiting(trial)).toBe(false);
    });

    it('12. Global RECRUITING sin sede Córdoba → NO afirmar recruiting Córdoba', () => {
      const trial: ClinicalTrial = {
        ...baseTrial,
        status: 'RECRUITING',
        hasCordobaCenter: false,
        hasCordobaRecruitingCenter: false,
        locations: [
          { country: 'Argentina', state: 'Buenos Aires', city: 'CABA', isCordoba: false, status: 'RECRUITING' }
        ]
      };

      expect(isCordobaSiteRecruiting(trial)).toBe(false);
    });
  });

  // =========================================================================
  // 4. EXCLUSIÓN SNC Y AUSENCIA DE DOCUMENTACIÓN
  // =========================================================================
  describe('4. Criterios de Exclusión SNC e Incertidumbre Documental', () => {
    const trialCnsExclusion: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_cns_exc',
          criterionType: 'exclusion',
          category: 'CNS_METASTASIS',
          mandatory: true,
          sourceText: 'Active or symptomatic brain metastases',
          parseStatus: 'STRUCTURED',
          details: { cnsRule: 'ACTIVE_EXCLUDED' }
        }
      ]
    };

    it('13. EXCLUSION: brain metastases + metástasis activas documentadas → NO CUMPLE (exclusión activa)', () => {
      const patient = createPatient({
        diagnosisRaw: 'Cáncer de pulmón con metástasis cerebrales sintomáticas activas'
      });

      const result = evaluateTrialMatch(patient, trialCnsExclusion);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'CNS_METASTASIS');
      expect(crit?.status).toBe('NO CUMPLE');
      expect(crit?.statusLabel).toContain('exclusión activa');
      expect(result.category).toBe('not_compatible');
      expect(result.incompatibilities.length).toBeGreaterThan(0);
    });

    it('14. EXCLUSION: brain metastases + ausencia explícitamente documentada → CUMPLE', () => {
      const patient = createPatient({
        diagnosisRaw: 'Cáncer de pulmón avanzado. MRI cerebral: sin metástasis cerebrales'
      });

      const result = evaluateTrialMatch(patient, trialCnsExclusion);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'CNS_METASTASIS');
      expect(crit?.status).toBe('CUMPLE');
      expect(crit?.statusLabel).toContain('ausencia documentada');
      expect(result.incompatibilities.length).toBe(0);
    });

    it('15. EXCLUSION: brain metastases + SNC no documentado → NO DOCUMENTADO (nunca CUMPLE directo)', () => {
      const patient = createPatient({
        diagnosisRaw: 'Adenocarcinoma de pulmón estadio IV'
        // sin mención de SNC
      });

      const result = evaluateTrialMatch(patient, trialCnsExclusion);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'CNS_METASTASIS');
      expect(crit?.status).toBe('NO DOCUMENTADO');
      expect(result.category).not.toBe('potential_candidate');
      expect(result.category).toBe('potential_missing_data');
      expect(result.missingItems?.some(item => item.includes('SNC'))).toBe(true);
    });

    it('16. INCLUSION: requiere brain metastases + paciente sin metástasis documentadas → NO CUMPLE', () => {
      const trialCnsInclusion: ClinicalTrial = {
        ...baseTrial,
        structuredCriteria: [
          {
            id: 'crit_cns_inc',
            criterionType: 'inclusion',
            category: 'CNS_METASTASIS',
            mandatory: true,
            sourceText: 'Patients with documented brain metastases from NSCLC',
            parseStatus: 'STRUCTURED'
          }
        ]
      };

      const patient = createPatient({
        diagnosisRaw: 'Cáncer de pulmón sin metástasis en SNC'
      });

      const result = evaluateTrialMatch(patient, trialCnsInclusion);
      const crit = result.criteriaEvaluations?.find(c => c.category === 'CNS_METASTASIS');
      expect(crit?.status).toBe('NO CUMPLE');
      expect(result.category).toBe('not_compatible');
      expect(result.incompatibilities.length).toBeGreaterThan(0);
    });
  });
});
