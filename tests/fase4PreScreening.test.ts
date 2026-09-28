import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateTrialMatch, evaluateSinglePatientTrials } from '../src/services/clinicalTrials/trialMatcher';
import { ClinicalTrial, PatientClinicalProfile } from '../src/types/clinicalTrials';

describe('FASE 4: Pre-Screening de Ensayos Clínicos en Modo Residente (20 Tests Unitarios)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseTrial: ClinicalTrial = {
    id: 'ctgov_test_trial_1',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT05000001',
    nctId: 'NCT05000001',
    title: 'Estudio de Fase 3 en Cáncer de Pulmón Avanzado',
    sponsor: 'Hospital Oncológico Córdoba',
    status: 'RECRUITING',
    statusLabel: 'Reclutando',
    phase: 'Fase 3',
    phaseNormalized: 'PHASE3',
    conditions: ['Non-Small Cell Lung Cancer', 'NSCLC', 'Cáncer de Pulmón'],
    tumorTypes: ['pulmon'],
    biomarkers: ['EGFR'],
    briefSummary: 'Estudio de terapia dirigida en carcinoma pulmonar no células pequeñas.',
    eligibilityCriteria: 'Inclusion Criteria:\n- Age >= 18\n- ECOG 0-1\n- EGFR Exon 19 del\nExclusion Criteria:\n- Symptomatic brain metastases',
    inclusionCriteria: [
      'Age >= 18 years',
      'ECOG performance status 0 to 1',
      'Confirmed EGFR exon 19 deletion or L858R mutation'
    ],
    exclusionCriteria: [
      'Active or untreated symptomatic brain metastases'
    ],
    minimumAgeYears: 18,
    sex: 'ALL',
    locations: [{ country: 'Argentina', state: 'Córdoba', city: 'Córdoba', isCordoba: true }],
    hasCordobaCenter: true,
    hasArgentinaCenter: true,
    cordobaCenters: ['Hospital Oncológico Córdoba'],
    url: 'https://clinicaltrials.gov/study/NCT05000001',
    lastUpdated: '2026-03-01',
    importedAt: Date.now()
  };

  const createPatient = (overrides: Partial<PatientClinicalProfile>): PatientClinicalProfile => ({
    patientId: 'res-patient-1',
    hcNumber: 'HC-12345',
    name: 'Paciente PreScreening Test',
    diagnosisRaw: 'Cáncer de pulmón',
    organOrSite: 'pulmon',
    histology: 'Adenocarcinoma',
    biomarkersDocumented: [],
    linesDocumented: [],
    priorTreatments: [],
    labsDocumented: {},
    ...overrides
  });

  // 1. Paciente con datos mínimos (solo tumor)
  it('1. Paciente con datos mínimos (solo tumor): clasifica en POTENCIALMENTE ELEGIBLE — FALTA INFORMACIÓN y lista faltantes', () => {
    const patient = createPatient({
      age: undefined,
      ecogDocumented: undefined,
      biomarkersDocumented: [],
      stageDocumented: undefined,
      linesDocumented: [],
      labsDocumented: {}
    });

    const result = evaluateTrialMatch(patient, baseTrial);
    expect(result.category).toBe('potential_missing_data');
    expect(result.categoryBadge).toContain('🟡');
    expect(result.categoryLabel).toBe('Potencialmente elegible — falta información');
    expect(result.incompatibilities.length).toBe(0);
    expect(result.missingItems?.length).toBeGreaterThan(0);
  });

  // 2. Paciente con ECOG compatible
  it('2. Paciente con ECOG compatible: evalúa criterio como CUMPLE', () => {
    const trialWithEcog: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_ecog_inc',
          criterionType: 'inclusion',
          category: 'ECOG',
          mandatory: true,
          sourceText: 'ECOG performance status 0-1',
          parseStatus: 'STRUCTURED',
          details: { ecogMin: 0, ecogMax: 1 }
        }
      ]
    };

    const patient = createPatient({
      ecogDocumented: 1
    });

    const result = evaluateTrialMatch(patient, trialWithEcog);
    const ecogCrit = result.criteriaEvaluations?.find(c => c.category === 'ECOG');
    expect(ecogCrit).toBeDefined();
    expect(ecogCrit?.status).toBe('CUMPLE');
    expect(result.incompatibilities.length).toBe(0);
  });

  // 3. Paciente con ECOG incompatible
  it('3. Paciente con ECOG incompatible: evalúa como NO CUMPLE y estado global NO CUMPLE CRITERIO DOCUMENTADO', () => {
    const trialWithEcog: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_ecog_inc',
          criterionType: 'inclusion',
          category: 'ECOG',
          mandatory: true,
          sourceText: 'ECOG performance status 0-1',
          parseStatus: 'STRUCTURED',
          details: { ecogMin: 0, ecogMax: 1 }
        }
      ]
    };

    const patient = createPatient({
      ecogDocumented: 2
    });

    const result = evaluateTrialMatch(patient, trialWithEcog);
    const ecogCrit = result.criteriaEvaluations?.find(c => c.category === 'ECOG');
    expect(ecogCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
    expect(result.categoryBadge).toContain('🔴');
    expect(result.incompatibilities.some(i => i.toLowerCase().includes('ecog'))).toBe(true);
  });

  // 4. Paciente sin ECOG documentado
  it('4. Paciente sin ECOG documentado: evalúa como NO DOCUMENTADO y genera acción requerida', () => {
    const trialWithEcog: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_ecog_inc',
          criterionType: 'inclusion',
          category: 'ECOG',
          mandatory: true,
          sourceText: 'ECOG performance status <= 1',
          parseStatus: 'STRUCTURED',
          details: { ecogMin: 0, ecogMax: 1 }
        }
      ]
    };

    const patient = createPatient({
      ecogDocumented: undefined
    });

    const result = evaluateTrialMatch(patient, trialWithEcog);
    const ecogCrit = result.criteriaEvaluations?.find(c => c.category === 'ECOG');
    expect(ecogCrit?.status).toBe('NO DOCUMENTADO');
    expect(ecogCrit?.missingAction).toContain('ECOG');
    expect(result.missingItems?.some(item => item.includes('ECOG'))).toBe(true);
  });

  // 5. Paciente con biomarcador mutado compatible
  it('5. Paciente con biomarcador mutado compatible: evalúa CUMPLE', () => {
    const trialWithEgfr: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_egfr_mut',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'EGFR exon 19 deletion or L858R mutation',
          parseStatus: 'STRUCTURED',
          details: { gene: 'EGFR', statusRequired: 'MUTATED', specificAlteration: 'EXON 19' }
        }
      ]
    };

    const patient = createPatient({
      biomarkersDocumented: [{ name: 'EGFR', status: 'Mutado (Exón 19 del)', rawText: 'EGFR exon 19 deletion' }]
    });

    const result = evaluateTrialMatch(patient, trialWithEgfr);
    const egfrCrit = result.criteriaEvaluations?.find(c => c.category === 'BIOMARKER');
    expect(egfrCrit?.status).toBe('CUMPLE');
    expect(result.incompatibilities.length).toBe(0);
  });

  // 6. Paciente con biomarcador wt incompatible
  it('6. Paciente con biomarcador wt incompatible: evalúa NO CUMPLE y estado global not_compatible', () => {
    const trialWithEgfr: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_egfr_mut',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'Documented activating EGFR mutation',
          parseStatus: 'STRUCTURED',
          details: { gene: 'EGFR', statusRequired: 'MUTATED' }
        }
      ]
    };

    const patient = createPatient({
      biomarkersDocumented: [{ name: 'EGFR', status: 'Wild-Type', rawText: 'EGFR no mutado / salvaje' }]
    });

    const result = evaluateTrialMatch(patient, trialWithEgfr);
    const egfrCrit = result.criteriaEvaluations?.find(c => c.category === 'BIOMARKER');
    expect(egfrCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
    expect(result.incompatibilities.some(i => i.toLowerCase().includes('egfr'))).toBe(true);
  });

  // 7. Paciente con biomarcador no documentado
  it('7. Paciente con biomarcador no documentado: evalúa NO DOCUMENTADO y añade a qué falta al paciente', () => {
    const trialWithBraf: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_braf_mut',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'BRAF V600E mutation',
          parseStatus: 'STRUCTURED',
          details: { gene: 'BRAF', statusRequired: 'MUTATED', specificAlteration: 'V600E' }
        }
      ]
    };

    const patient = createPatient({
      biomarkersDocumented: []
    });

    const result = evaluateTrialMatch(patient, trialWithBraf);
    const brafCrit = result.criteriaEvaluations?.find(c => c.category === 'BIOMARKER');
    expect(brafCrit?.status).toBe('NO DOCUMENTADO');
    expect(result.missingItems?.some(item => item.toUpperCase().includes('BRAF'))).toBe(true);
  });

  // 8. Paciente con múltiples biomarcadores combinados
  it('8. Paciente con múltiples biomarcadores combinados: evalúa individualmente cada uno', () => {
    const trialMultiBio: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_kras',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'KRAS wild-type',
          parseStatus: 'STRUCTURED',
          details: { gene: 'KRAS', statusRequired: 'WILD_TYPE' }
        },
        {
          id: 'crit_braf',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'BRAF wild-type',
          parseStatus: 'STRUCTURED',
          details: { gene: 'BRAF', statusRequired: 'WILD_TYPE' }
        }
      ]
    };

    const patient = createPatient({
      biomarkersDocumented: [
        { name: 'KRAS', status: 'Wild-Type', rawText: 'KRAS WT' },
        { name: 'BRAF', status: 'Mutado V600E', rawText: 'BRAF V600E' }
      ]
    });

    const result = evaluateTrialMatch(patient, trialMultiBio);
    const krasCrit = result.criteriaEvaluations?.find(c => c.name.includes('KRAS'));
    const brafCrit = result.criteriaEvaluations?.find(c => c.name.includes('BRAF'));

    expect(krasCrit?.status).toBe('CUMPLE');
    expect(brafCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
  });

  // 9. Paciente con estadio compatible
  it('9. Paciente con estadio compatible: evalúa CUMPLE', () => {
    const trialMetastatic: ClinicalTrial = {
      ...baseTrial,
      isMetastaticEligible: true,
      structuredCriteria: [
        {
          id: 'crit_stage_iv',
          criterionType: 'inclusion',
          category: 'STAGE',
          mandatory: true,
          sourceText: 'Stage IV or metastatic NSCLC',
          parseStatus: 'STRUCTURED',
          details: { stage: 'IV', scenario: 'metastatic' }
        }
      ]
    };

    const patient = createPatient({
      stageDocumented: 'Estadio IVB',
      isMetastaticDocumented: true
    });

    const result = evaluateTrialMatch(patient, trialMetastatic);
    const stageCrit = result.criteriaEvaluations?.find(c => c.category === 'STAGE');
    expect(stageCrit?.status).toBe('CUMPLE');
  });

  // 10. Paciente con estadio incompatible
  it('10. Paciente con estadio incompatible: evalúa NO CUMPLE y rechaza protocolo metastásico', () => {
    const trialMetastatic: ClinicalTrial = {
      ...baseTrial,
      isMetastaticEligible: true,
      structuredCriteria: [
        {
          id: 'crit_stage_iv',
          criterionType: 'inclusion',
          category: 'STAGE',
          mandatory: true,
          sourceText: 'Metastatic or stage IV disease',
          parseStatus: 'STRUCTURED',
          details: { stage: 'IV', scenario: 'metastatic' }
        }
      ]
    };

    const patient = createPatient({
      stageDocumented: 'IA',
      isMetastaticDocumented: false
    });

    const result = evaluateTrialMatch(patient, trialMetastatic);
    const stageCrit = result.criteriaEvaluations?.find(c => c.category === 'STAGE');
    expect(stageCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
  });

  // 11. Paciente con laboratorio compatible
  it('11. Paciente con laboratorio compatible: evalúa CUMPLE', () => {
    const trialLab: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_bili',
          criterionType: 'inclusion',
          category: 'LAB',
          mandatory: true,
          sourceText: 'Total bilirubin <= 1.5 mg/dL',
          parseStatus: 'STRUCTURED',
          details: { labParameter: 'total_bilirubin', labOperator: '<=', labValue: 1.5 }
        }
      ]
    };

    const patient = createPatient({
      labsDocumented: { totalBilirubin: 0.8 }
    });

    const result = evaluateTrialMatch(patient, trialLab);
    const labCrit = result.criteriaEvaluations?.find(c => c.category === 'LAB');
    expect(labCrit?.status).toBe('CUMPLE');
  });

  // 12. Paciente con laboratorio incompatible
  it('12. Paciente con laboratorio incompatible: evalúa NO CUMPLE y estado not_compatible', () => {
    const trialLab: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_bili',
          criterionType: 'inclusion',
          category: 'LAB',
          mandatory: true,
          sourceText: 'Total bilirubin <= 1.5 mg/dL',
          parseStatus: 'STRUCTURED',
          details: { labParameter: 'total_bilirubin', labOperator: '<=', labValue: 1.5 }
        }
      ]
    };

    const patient = createPatient({
      labsDocumented: { totalBilirubin: 2.8 }
    });

    const result = evaluateTrialMatch(patient, trialLab);
    const labCrit = result.criteriaEvaluations?.find(c => c.category === 'LAB');
    expect(labCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
    expect(result.incompatibilities.some(i => i.toLowerCase().includes('bilirubin') || i.toLowerCase().includes('laboratorio'))).toBe(true);
  });

  // 13. Paciente sin laboratorio documentado
  it('13. Paciente sin laboratorio documentado: evalúa NO DOCUMENTADO y genera acción para solicitar bioquímica', () => {
    const trialLab: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_plt',
          criterionType: 'inclusion',
          category: 'LAB',
          mandatory: true,
          sourceText: 'Platelet count >= 100,000 /uL',
          parseStatus: 'STRUCTURED',
          details: { labParameter: 'platelets', labOperator: '>=', labValue: 100000 }
        }
      ]
    };

    const patient = createPatient({
      labsDocumented: {}
    });

    const result = evaluateTrialMatch(patient, trialLab);
    const labCrit = result.criteriaEvaluations?.find(c => c.category === 'LAB');
    expect(labCrit?.status).toBe('NO DOCUMENTADO');
    expect(result.missingItems?.some(item => item.toLowerCase().includes('laboratorio') || item.toLowerCase().includes('platelets'))).toBe(true);
  });

  // 14. Paciente con línea previa compatible
  it('14. Paciente con línea previa compatible: evalúa CUMPLE', () => {
    const trialLines: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_lines',
          criterionType: 'inclusion',
          category: 'LINE_OF_THERAPY',
          mandatory: true,
          sourceText: 'Maximum of 2 prior lines of systemic therapy',
          parseStatus: 'STRUCTURED',
          details: { maxLines: 2 }
        }
      ]
    };

    const patient = createPatient({
      linesDocumented: ['1L Carboplatino + Pemetrexed']
    });

    const result = evaluateTrialMatch(patient, trialLines);
    const lineCrit = result.criteriaEvaluations?.find(c => c.category === 'LINE_OF_THERAPY');
    expect(lineCrit?.status).toBe('CUMPLE');
  });

  // 15. Paciente con línea previa incompatible
  it('15. Paciente con línea previa incompatible: evalúa NO CUMPLE y rechaza por exceso de líneas', () => {
    const trialLines: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_lines',
          criterionType: 'inclusion',
          category: 'LINE_OF_THERAPY',
          mandatory: true,
          sourceText: 'No more than 1 prior line of chemotherapy',
          parseStatus: 'STRUCTURED',
          details: { maxLines: 1 }
        }
      ]
    };

    const patient = createPatient({
      linesDocumented: [
        '1L Cisplatino + Gemcitabina',
        '2L Docetaxel',
        '3L Pemetrexed'
      ]
    });

    const result = evaluateTrialMatch(patient, trialLines);
    const lineCrit = result.criteriaEvaluations?.find(c => c.category === 'LINE_OF_THERAPY');
    expect(lineCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
  });

  // 16. Paciente que cumple inclusión pero tiene exclusión documentada
  it('16. Paciente que cumple inclusión pero tiene exclusión documentada: clasifica en NO CUMPLE CRITERIO DOCUMENTADO', () => {
    const trialWithExclusion: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_age',
          criterionType: 'inclusion',
          category: 'AGE',
          mandatory: true,
          sourceText: 'Age >= 18',
          parseStatus: 'STRUCTURED',
          details: { minNumericThreshold: 18 }
        },
        {
          id: 'crit_ecog',
          criterionType: 'inclusion',
          category: 'ECOG',
          mandatory: true,
          sourceText: 'ECOG 0-1',
          parseStatus: 'STRUCTURED',
          details: { ecogMin: 0, ecogMax: 1 }
        },
        {
          id: 'crit_cns_excl',
          criterionType: 'exclusion',
          category: 'CNS_METASTASIS',
          mandatory: true,
          sourceText: 'Active symptomatic brain metastases',
          parseStatus: 'STRUCTURED',
          details: { cnsRule: 'ACTIVE_EXCLUDED' }
        }
      ]
    };

    const patient = createPatient({
      age: 55,
      ecogDocumented: 1,
      diagnosisRaw: 'Cáncer de pulmón con metástasis cerebrales sintomáticas en SNC'
    });

    const result = evaluateTrialMatch(patient, trialWithExclusion);
    const cnsCrit = result.criteriaEvaluations?.find(c => c.category === 'CNS_METASTASIS');
    expect(cnsCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
    expect(result.categoryBadge).toContain('🔴');
  });

  // 17. Ensayo con criterios no estructurados (no evaluable / falta información)
  it('17. Ensayo con criterios no estructurados: NUNCA clasifica en POTENCIALMENTE ELEGIBLE; clasifica en falta info o no evaluable', () => {
    const trialUnstructured: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_complex',
          criterionType: 'inclusion',
          category: 'OTHER',
          mandatory: true,
          sourceText: 'Patient must have adequate physiological reserve and compliance capability determined by the investigator',
          parseStatus: 'UNSTRUCTURED'
        }
      ]
    };

    const patient = createPatient({
      age: 50,
      ecogDocumented: 0
    });

    const result = evaluateTrialMatch(patient, trialUnstructured);
    expect(result.category).not.toBe('potential_candidate');
    expect(result.category).toBe('potential_missing_data');
    expect(result.unstructuredCriteriaCount).toBeGreaterThan(0);
    const critEval = result.criteriaEvaluations?.find(c => c.id === 'crit_complex');
    expect(critEval?.status).toBe('NO EVALUABLE');
  });

  // 18. Ensayo sin criterios estructurados
  it('18. Ensayo sin criterios estructurados: gestiona con seguridad y auto-estructura o clasifica sin romper el sistema', () => {
    const trialWithoutCriteria: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [],
      inclusionCriteria: [],
      exclusionCriteria: [],
      minimumAgeYears: undefined,
      maximumAgeYears: undefined
    };

    const patient = createPatient({
      age: 45
    });

    const result = evaluateTrialMatch(patient, trialWithoutCriteria);
    expect(result.category).toBe('not_evaluable');
    expect(result.categoryLabel).toBe('No evaluable');
    expect(result.categoryBadge).toContain('⚪');
    expect(result.incompatibilities.length).toBe(0);
  });

  // 19. Ensayo que requiere metástasis cerebral vs paciente sin metástasis
  it('19. Ensayo que requiere metástasis cerebral vs paciente sin metástasis: evalúa NO CUMPLE por ausencia de SNC', () => {
    const trialCnsRequired: ClinicalTrial = {
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
      diagnosisRaw: 'Cáncer de pulmón localizado sin metástasis a distancia'
    });

    const result = evaluateTrialMatch(patient, trialCnsRequired);
    const cnsCrit = result.criteriaEvaluations?.find(c => c.category === 'CNS_METASTASIS');
    expect(cnsCrit?.status).toBe('NO CUMPLE');
    expect(result.category).toBe('not_compatible');
  });

  // 20. Paciente que no cumple tumor primario
  it('20. Paciente que no cumple tumor primario: genera incompatibilidad inmediata y clasifica en not_compatible', () => {
    const trialBreast: ClinicalTrial = {
      ...baseTrial,
      tumorTypes: ['mama'],
      title: 'Estudio en Cáncer de Mama HER2+'
    };

    const patientProstate = createPatient({
      organOrSite: 'prostata',
      diagnosisRaw: 'Adenocarcinoma de próstata Gleason 8'
    });

    const result = evaluateTrialMatch(patientProstate, trialBreast);
    expect(result.category).toBe('not_compatible');
    expect(result.categoryBadge).toContain('🔴');
    expect(result.incompatibilities.some(i => i.toLowerCase().includes('sitio tumoral') || i.toLowerCase().includes('próstata'))).toBe(true);
  });

  // Bonus test: Integración con evaluateSinglePatientTrials
  it('Bonus: evaluateSinglePatientTrials clasifica y ordena correctamente según los 4 estados', () => {
    const patient = {
      id: 'res-patient-1',
      name: 'Paciente PreScreening Test',
      diagnosis: 'Cáncer de pulmón',
      age: 60,
      historyText: 'Paciente de 60 años. ECOG 1.',
      files: [],
      timeline: []
    };

    const candidateTrial: ClinicalTrial = {
      ...baseTrial,
      id: 't-candidate',
      biomarkers: [],
      eligibilityCriteria: 'Inclusion Criteria:\n- Age >= 18\n- ECOG <= 1',
      structuredCriteria: [
        {
          id: 'c1',
          criterionType: 'inclusion',
          category: 'AGE',
          mandatory: true,
          sourceText: 'Age >= 18',
          parseStatus: 'STRUCTURED',
          details: { minNumericThreshold: 18 }
        },
        {
          id: 'c2',
          criterionType: 'inclusion',
          category: 'ECOG',
          mandatory: true,
          sourceText: 'ECOG <= 1',
          parseStatus: 'STRUCTURED',
          details: { ecogMax: 1 }
        }
      ]
    };

    const evalRes = evaluateSinglePatientTrials(patient, [candidateTrial]);
    expect(evalRes.potentialCandidateCount).toBe(1);
    expect(evalRes.bestCategory).toBe('potential_candidate');
    expect(evalRes.matches[0].category).toBe('potential_candidate');
  });
});
