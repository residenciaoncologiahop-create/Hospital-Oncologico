import { describe, it, expect } from 'vitest';
import { extractPatientClinicalProfile } from '../src/services/clinicalTrials/patientProfileExtractor';
import { 
  evaluateSinglePatientTrials, 
  evaluateTrialMatch, 
  isCordobaSiteRecruiting 
} from '../src/services/clinicalTrials/trialMatcher';
import { ClinicalTrial } from '../src/types/clinicalTrials';

describe('FASE 4 — Integración Aislada de Pre-Screening en Primera Vez', () => {

  const baseTrial: ClinicalTrial = {
    id: 'ctgov_NCT09999999',
    source: 'clinicaltrials.gov',
    sourceId: 'NCT09999999',
    nctId: 'NCT09999999',
    title: 'Estudio de Fase III en Cáncer Colorrectal Avanzado',
    sponsor: 'Hospital Oncológico',
    status: 'RECRUITING',
    statusLabel: 'Reclutando',
    phase: 'Phase 3',
    phaseNormalized: 'Fase 3',
    conditions: ['Colorectal Neoplasms', 'Colon Cancer'],
    interventions: ['Drug: TestDrug'],
    briefSummary: 'Resumen del ensayo clínico',
    eligibilityCriteria: 'Inclusion Criteria: ECOG 0-1, KRAS wild-type. Exclusion Criteria: Metástasis en SNC.',
    inclusionCriteria: ['ECOG 0-1', 'KRAS wild-type'],
    exclusionCriteria: ['Metástasis activa en SNC'],
    minimumAge: '18 Years',
    minimumAgeYears: 18,
    sex: 'ALL',
    locations: [
      {
        facility: 'Hospital Central',
        city: 'Buenos Aires',
        country: 'Argentina',
        status: 'RECRUITING',
        isCordoba: false
      }
    ],
    hasCordobaCenter: false,
    hasArgentinaCenter: true,
    cordobaCenters: [],
    url: 'https://clinicaltrials.gov/study/NCT09999999',
    lastUpdated: '2026-09-01',
    importedAt: Date.now(),
    tumorTypes: ['colorrectal'],
    biomarkers: ['KRAS'],
    isOncology: true,
    structuredCriteria: [
      {
        id: 'crit_ecog',
        criterionType: 'inclusion',
        category: 'ECOG',
        mandatory: true,
        sourceText: 'ECOG Performance Status 0-1',
        parseStatus: 'STRUCTURED',
        details: { ecogMin: 0, ecogMax: 1 }
      },
      {
        id: 'crit_kras',
        criterionType: 'inclusion',
        category: 'BIOMARKER',
        mandatory: true,
        sourceText: 'KRAS wild-type confirmado por secuenciación',
        parseStatus: 'STRUCTURED',
        details: { gene: 'KRAS', statusRequired: 'WILD_TYPE' }
      },
      {
        id: 'crit_cns',
        criterionType: 'exclusion',
        category: 'CNS_METASTASIS',
        mandatory: true,
        sourceText: 'Exclusion: Metástasis activas en SNC',
        parseStatus: 'STRUCTURED',
        details: { cnsRule: 'ACTIVE_EXCLUDED' }
      }
    ]
  };

  // 1. La búsqueda se ejecuta solo cuando el usuario la solicita
  it('1. La evaluación de ensayos no se ejecuta automáticamente al instanciar paciente', () => {
    const rawPatient = {
      id: 'p-01',
      name: 'Gómez, Carlos',
      diagnosis: 'Cáncer de Colon',
      historyText: 'Paciente con adenocarcinoma de colon sigmoides. En control.',
      files: []
    };

    // La mera extracción del perfil no llama al motor de matching ni evalúa ensayos
    const profile = extractPatientClinicalProfile(rawPatient);
    expect(profile.name).toBe('Gómez, Carlos');
    expect(profile.organOrSite).toBe('colorrectal');

    // Solo se generan resultados al invocar explícitamente evaluateSinglePatientTrials
    const evalResult = evaluateSinglePatientTrials(rawPatient, [baseTrial]);
    expect(evalResult.matches.length).toBeGreaterThan(0);
    expect(evalResult.lastEvaluatedAt).toBeDefined();
  });

  // 2. El perfil no inventa datos ausentes
  it('2. El perfil clínico no inventa datos ausentes ni infiere estadio o ECOG de tratamientos o frases genéricas', () => {
    const patientWithVagueData = {
      id: 'p-02',
      name: 'Pérez, María',
      diagnosis: 'Carcinoma ductal invasor de mama',
      historyText: 'Paciente en buen estado general. Recibe quimioterapia adyuvante con paclitaxel. Plan: completar ciclos.',
      files: []
    };

    const profile = extractPatientClinicalProfile(patientWithVagueData);

    // No inventa ECOG por la frase "buen estado general"
    expect(profile.ecogDocumented).toBeUndefined();

    // No infiere estadio IV a partir de quimioterapia adyuvante
    expect(profile.stageDocumented).toBeUndefined();
    expect(profile.isMetastaticDocumented).toBe(false);

    // No inventa biomarcadores (HER2, RE, RP no informados quedan vacíos)
    expect(profile.biomarkersDocumented.length).toBe(0);

    // No inventa laboratorios
    expect(profile.labsDocumented.hemoglobin).toBeUndefined();
    expect(profile.labsDocumented.creatinine).toBeUndefined();

    // No cuenta fármacos del plan futuro como tratamientos previos
    expect(profile.priorTreatments).not.toContain('completar');
  });

  // 3. Un biomarcador no documentado no se interpreta como negativo
  it('3. Un biomarcador no documentado no se interpreta como negativo ni genera incompatibilidad inmediata', () => {
    const melanomaTrial: ClinicalTrial = {
      ...baseTrial,
      id: 'ctgov_melanoma_braf',
      title: 'Estudio en Melanoma BRAF Mutado',
      tumorTypes: ['melanoma'],
      biomarkers: ['BRAF'],
      structuredCriteria: [
        {
          id: 'crit_braf',
          criterionType: 'inclusion',
          category: 'BIOMARKER',
          mandatory: true,
          sourceText: 'BRAF V600E mutation positive',
          parseStatus: 'STRUCTURED',
          details: { gene: 'BRAF', statusRequired: 'MUTATED', specificAlteration: 'V600E' }
        }
      ]
    };

    const patientWithoutBraf = {
      id: 'p-03',
      name: 'López, Juan',
      diagnosis: 'Melanoma cutáneo nodular',
      historyText: 'Paciente de 54 años con melanoma en dorso. Sin estudio molecular registrado.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patientWithoutBraf), melanomaTrial);

    // No debe ser incompatible
    expect(result.category).not.toBe('not_compatible');
    expect(result.category).toBe('potential_missing_data');
    expect(result.missingData.some(m => m.includes('BRAF'))).toBe(true);
    expect(result.incompatibilities.length).toBe(0);
  });

  // 4. La ausencia de ECOG no genera incompatibilidad si el protocolo no exige ECOG
  it('4. La ausencia de ECOG no genera incompatibilidad si el protocolo no exige ECOG', () => {
    const trialWithoutEcog: ClinicalTrial = {
      ...baseTrial,
      ecogMaxAdmissible: undefined,
      structuredCriteria: [
        {
          id: 'crit_age',
          criterionType: 'inclusion',
          category: 'AGE',
          mandatory: true,
          sourceText: 'Age >= 18 years',
          parseStatus: 'STRUCTURED'
        }
      ]
    };

    const patientNoEcog = {
      id: 'p-04',
      name: 'Díaz, Ana',
      diagnosis: 'Cáncer de colon',
      age: 45,
      historyText: 'Paciente de 45 años con diagnóstico de cáncer de colon.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patientNoEcog), trialWithoutEcog);
    expect(result.incompatibilities.some(i => i.toLowerCase().includes('ecog'))).toBe(false);
  });

  // 5. La ausencia de un dato requerido se clasifica como información faltante, no como incumplimiento
  it('5. La ausencia de un dato requerido se clasifica como información faltante, no como incumplimiento', () => {
    const patientWithoutAgeOrStage = {
      id: 'p-05',
      name: 'Paciente S/D',
      diagnosis: 'Cáncer colorrectal',
      historyText: 'Consulta para evaluación oncológica colorrectal.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patientWithoutAgeOrStage), baseTrial);

    expect(result.category).toBe('potential_missing_data');
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.incompatibilities.length).toBe(0);
  });

  // 6. Un criterio incompatible requiere evidencia documentada
  it('6. Un criterio incompatible requiere evidencia documentada que contradiga el protocolo', () => {
    const patientWithProofOfIncompatibility = {
      id: 'p-06',
      name: 'Menor de Edad',
      diagnosis: 'Cáncer colorrectal',
      age: 15, // Menor a 18
      historyText: 'Paciente de 15 años. ECOG 0. KRAS wild-type.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patientWithProofOfIncompatibility), baseTrial);

    expect(result.category).toBe('not_compatible');
    expect(result.incompatibilities.some(i => i.includes('15') || i.includes('inferior al mínimo'))).toBe(true);
  });

  // 7. Los criterios UNSTRUCTURED no se convierten automáticamente en incompatibilidades
  it('7. Los criterios UNSTRUCTURED no se convierten automáticamente en incompatibilidades', () => {
    const trialWithUnstructuredCrit: ClinicalTrial = {
      ...baseTrial,
      structuredCriteria: [
        {
          id: 'crit_complex',
          criterionType: 'inclusion',
          category: 'OTHER',
          mandatory: false,
          sourceText: 'Capacidad cognitiva adecuada para consentir y cumplir visitas complejas',
          parseStatus: 'UNSTRUCTURED'
        }
      ]
    };

    const patient = {
      id: 'p-07',
      name: 'Rodríguez, Luis',
      diagnosis: 'Cáncer de colon',
      age: 60,
      historyText: 'Paciente de 60 años con cáncer de colon.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patient), trialWithUnstructuredCrit);

    // Debe ser evaluable como no evaluable o faltan datos, NUNCA not_compatible
    expect(result.category).not.toBe('not_compatible');
    const unstructuredEval = result.criteriaEvaluations?.find(c => c.id === 'crit_complex');
    expect(unstructuredEval?.status).toBe('NO EVALUABLE');
  });

  // 8. Un ensayo globalmente reclutando no se presenta automáticamente como abierto en Córdoba
  it('8. Un ensayo globalmente reclutando no se presenta automáticamente como abierto en Córdoba', () => {
    const trialGlobalOnly: ClinicalTrial = {
      ...baseTrial,
      status: 'RECRUITING', // Reclutando a nivel global
      hasCordobaCenter: false,
      locations: [
        {
          facility: 'Centro Médico CABA',
          city: 'Buenos Aires',
          country: 'Argentina',
          status: 'RECRUITING',
          isCordoba: false
        }
      ]
    };

    expect(isCordobaSiteRecruiting(trialGlobalOnly)).toBe(false);

    const trialCordobaPending: ClinicalTrial = {
      ...baseTrial,
      hasCordobaCenter: true,
      hasCordobaRecruitingCenter: false,
      cordobaRecruitingStatus: 'NOT_YET_RECRUITING',
      locations: [
        {
          facility: 'Hospital Córdoba',
          city: 'Córdoba',
          country: 'Argentina',
          status: 'NOT_YET_RECRUITING',
          isCordoba: true
        }
      ]
    };

    expect(isCordobaSiteRecruiting(trialCordobaPending)).toBe(false);
  });

  // 9. Se preserva el texto original del protocolo
  it('9. Se preserva el texto original del protocolo en el desglose de criterios evaluados', () => {
    const patient = {
      id: 'p-09',
      name: 'Castro, Elena',
      diagnosis: 'Cáncer de colon',
      age: 50,
      historyText: 'Paciente de 50 años. ECOG 0.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patient), baseTrial);
    const ecogCrit = result.criteriaEvaluations?.find(c => c.category === 'ECOG');

    expect(ecogCrit).toBeDefined();
    expect(ecogCrit?.sourceText).toBe('ECOG Performance Status 0-1');
  });

  // 10. Se mantiene la compatibilidad con ensayos históricos sin criterios estructurados
  it('10. Se mantiene la compatibilidad con ensayos históricos sin criterios estructurados', () => {
    const legacyTrial: ClinicalTrial = {
      ...baseTrial,
      id: 'legacy_NCT00001',
      structuredCriteria: undefined // Ensayo histórico sin parsear
    };

    const patient = {
      id: 'p-10',
      name: 'Vega, Marta',
      diagnosis: 'Cáncer colorrectal',
      age: 55,
      historyText: 'Paciente de 55 años.',
      files: []
    };

    // No debe lanzar error y debe parsear dinámicamente
    expect(() => {
      const result = evaluateTrialMatch(extractPatientClinicalProfile(patient), legacyTrial);
      expect(result).toBeDefined();
      expect(result.trial.id).toBe('legacy_NCT00001');
    }).not.toThrow();
  });

  // 11. Un error o ausencia de datos no rompe Primera Vez
  it('11. Un error o ausencia total de datos clínicos no produce excepción en Primera Vez', () => {
    const emptyPatient = {
      id: 'p-empty',
      name: '',
      diagnosis: '',
      historyText: '',
      files: []
    };

    expect(() => {
      const evaluation = evaluateSinglePatientTrials(emptyPatient, [baseTrial]);
      expect(evaluation).toBeDefined();
      expect(evaluation.matches).toBeDefined();
    }).not.toThrow();
  });

  // 12. No se modifican los resultados ni el funcionamiento de otros formularios y contiene disclaimer
  it('12. El pre-screening incluye el disclaimer de responsabilidad médica obligatorio', () => {
    const patient = {
      id: 'p-12',
      name: 'Morales, Hugo',
      diagnosis: 'Cáncer colorrectal',
      age: 48,
      historyText: 'Paciente de 48 años. ECOG 0. KRAS wild-type.',
      files: []
    };

    const result = evaluateTrialMatch(extractPatientClinicalProfile(patient), baseTrial);

    // Debe contener el aviso de pre-screening orientativo obligatorio
    const mandatoryDisclaimer = 'Este resultado es un pre-screening orientativo. No confirma elegibilidad ni disponibilidad del ensayo. La elegibilidad definitiva y la apertura del centro deben verificarse con el equipo investigador y el protocolo vigente.';
    expect(result.requiredVerificationNotice).toBe(mandatoryDisclaimer);
  });

});
