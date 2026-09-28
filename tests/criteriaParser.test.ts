import { describe, it, expect } from 'vitest';
import {
  parseStructuredCriteria,
  parseEcogLine,
  parseBiomarkerLine,
  parseLabCriterion,
  parseTreatmentLine,
  parseSingleCriterionLine,
} from '../src/services/clinicalTrials/criteriaParser';
import { evaluateTrialMatch } from '../src/services/clinicalTrials/trialMatcher';
import { ClinicalTrial, PatientClinicalProfile } from '../src/types/clinicalTrials';

describe('FASE 3: Estructuración Conservadora de Criterios de Elegibilidad', () => {

  // 1. Edad estructurada correctamente
  it('1. Estructura correctamente criterios de edad con límites explícitos', () => {
    const res = parseStructuredCriteria({
      inclusionLines: [],
      exclusionLines: [],
      minimumAgeYears: 18,
      maximumAgeYears: 75,
      sex: 'ALL',
    });

    const ageCrit = res.structuredCriteria.find(c => c.category === 'AGE');
    expect(ageCrit).toBeDefined();
    expect(ageCrit?.criterionType).toBe('inclusion');
    expect(ageCrit?.operator).toBe('BETWEEN');
    expect(ageCrit?.value).toEqual({ min: 18, max: 75 });
    expect(ageCrit?.parseStatus).toBe('STRUCTURED');
    expect(ageCrit?.sourceText).toContain('Age >= 18 and <= 75 years');
  });

  // 2. Sexo estructurado correctamente
  it('2. Estructura correctamente criterios de sexo explícitos', () => {
    const res = parseStructuredCriteria({
      inclusionLines: [],
      exclusionLines: [],
      sex: 'FEMALE',
    });

    const sexCrit = res.structuredCriteria.find(c => c.category === 'SEX');
    expect(sexCrit).toBeDefined();
    expect(sexCrit?.criterionType).toBe('inclusion');
    expect(sexCrit?.operator).toBe('EQUALS');
    expect(sexCrit?.value).toBe('FEMALE');
    expect(sexCrit?.parseStatus).toBe('STRUCTURED');

    // Si el sexo es 'ALL', no debe crear restricción de sexo
    const resAll = parseStructuredCriteria({
      inclusionLines: [],
      exclusionLines: [],
      sex: 'ALL',
    });
    expect(resAll.structuredCriteria.some(c => c.category === 'SEX')).toBe(false);
  });

  // 3. ECOG explícito
  it('3. Estructura criterios de ECOG explícitos y calcula ecogMaxAdmissible', () => {
    const line = 'Patients must have an ECOG performance status of 0 or 1 at screening.';
    const parsed = parseEcogLine(line, 'inclusion');

    expect(parsed).not.toBeNull();
    expect(parsed?.category).toBe('ECOG');
    expect(parsed?.criterionType).toBe('inclusion');
    expect(parsed?.operator).toBe('BETWEEN');
    expect(parsed?.details?.ecogMin).toBe(0);
    expect(parsed?.details?.ecogMax).toBe(1);
    expect(parsed?.parseStatus).toBe('STRUCTURED');
    expect(parsed?.sourceText).toBe(line);

    const fullRes = parseStructuredCriteria({
      inclusionLines: [line],
      exclusionLines: [],
    });
    expect(fullRes.ecogMaxAdmissible).toBe(1);
  });

  // 4. Ensayo sin ECOG -> no crear requisito ECOG
  it('4. Si el protocolo no menciona ECOG, no crea ningún requisito de ECOG', () => {
    const fullRes = parseStructuredCriteria({
      inclusionLines: [
        'Histologically confirmed diagnosis of advanced adenocarcinoma.',
        'Measurable disease per RECIST 1.1.',
      ],
      exclusionLines: [
        'History of severe allergic reactions to monoclonal antibodies.',
      ],
    });

    const ecogCrit = fullRes.structuredCriteria.find(c => c.category === 'ECOG');
    expect(ecogCrit).toBeUndefined();
    expect(fullRes.ecogMaxAdmissible).toBeUndefined();
  });

  // 5. Biomarcador explícito
  it('5. Estructura biomarcadores explícitos sin inferir estados no documentados', () => {
    // HER2
    const her2Line = 'Documented HER2-positive breast cancer confirmed by IHC 3+ or ISH.';
    const her2 = parseBiomarkerLine(her2Line, 'inclusion');
    expect(her2?.category).toBe('BIOMARKER');
    expect(her2?.details?.gene).toBe('HER2');
    expect(her2?.details?.statusRequired).toBe('POSITIVE');
    expect(her2?.parseStatus).toBe('STRUCTURED');

    // ALK
    const alkLine = 'Confirmed ALK-positive translocation as determined by an approved test.';
    const alk = parseBiomarkerLine(alkLine, 'inclusion');
    expect(alk?.details?.gene).toBe('ALK');
    expect(alk?.details?.statusRequired).toBe('POSITIVE');

    // MSI-H / dMMR
    const msiLine = 'Patient has documented MSI-H or dMMR solid tumor.';
    const msi = parseBiomarkerLine(msiLine, 'inclusion');
    expect(msi?.details?.gene).toBe('MSI/MMR');
    expect(msi?.details?.statusRequired).toBe('POSITIVE');

    // PD-L1 con umbral
    const pdl1Line = 'Tumor with PD-L1 expression TPS >= 50% as determined by 22C3 assay.';
    const pdl1 = parseBiomarkerLine(pdl1Line, 'inclusion');
    expect(pdl1?.details?.gene).toBe('PD-L1');
    expect(pdl1?.details?.minNumericThreshold).toBe(50);
    expect(pdl1?.operator).toBe('>=');
  });

  // 6. Alteración molecular específica
  it('6. Estructura alteraciones moleculares específicas (Exon 19 del, KRAS G12C, BRAF V600E)', () => {
    // EGFR Exon 19 deletion
    const egfrLine = 'Tumor harboring an activating EGFR exon 19 deletion mutation.';
    const egfr = parseBiomarkerLine(egfrLine, 'inclusion');
    expect(egfr?.category).toBe('MOLECULAR_ALTERATION');
    expect(egfr?.details?.gene).toBe('EGFR');
    expect(egfr?.details?.specificAlteration).toBe('Exon 19 del');
    expect(egfr?.details?.statusRequired).toBe('MUTATED');

    // KRAS G12C
    const krasLine = 'Documented presence of KRAS G12C mutation in tumor tissue.';
    const kras = parseBiomarkerLine(krasLine, 'inclusion');
    expect(kras?.category).toBe('MOLECULAR_ALTERATION');
    expect(kras?.details?.gene).toBe('KRAS');
    expect(kras?.details?.specificAlteration).toBe('G12C');
    expect(kras?.details?.statusRequired).toBe('MUTATED');

    // BRAF V600E
    const brafLine = 'Patients with histologically verified melanoma carrying BRAF V600E mutation.';
    const braf = parseBiomarkerLine(brafLine, 'inclusion');
    expect(braf?.category).toBe('MOLECULAR_ALTERATION');
    expect(braf?.details?.gene).toBe('BRAF');
    expect(braf?.details?.specificAlteration).toBe('V600E');
    expect(braf?.details?.statusRequired).toBe('MUTATED');
  });

  // 7. Criterio de laboratorio con umbral explícito
  it('7. Estructura criterios analíticos de laboratorio con umbrales, operadores y referencias explícitas', () => {
    // Bilirrubina total
    const biliLine = 'Total bilirubin <= 1.5 x ULN (except in subjects with Gilbert Syndrome).';
    const bili = parseLabCriterion(biliLine, 'inclusion');
    expect(bili?.category).toBe('LAB');
    expect(bili?.details?.labParameter).toBe('total_bilirubin');
    expect(bili?.details?.labOperator).toBe('<=');
    expect(bili?.details?.labValue).toBe(1.5);
    expect(bili?.details?.labReference).toBe('ULN');

    // Clearance de creatinina
    const clcrLine = 'Adequate renal function: creatinine clearance >= 50 mL/min by Cockcroft-Gault.';
    const clcr = parseLabCriterion(clcrLine, 'inclusion');
    expect(clcr?.category).toBe('LAB');
    expect(clcr?.details?.labParameter).toBe('creatinine_clearance');
    expect(clcr?.details?.labOperator).toBe('>=');
    expect(clcr?.details?.labValue).toBe(50);
    expect(clcr?.details?.labUnit).toBe('mL/min');

    // Plaquetas
    const plqLine = 'Platelet count >= 100,000 /uL without transfusion within 14 days.';
    const plq = parseLabCriterion(plqLine, 'inclusion');
    expect(plq?.category).toBe('LAB');
    expect(plq?.details?.labParameter).toBe('platelets');
    expect(plq?.details?.labOperator).toBe('>=');
    expect(plq?.details?.labValue).toBe(100000);

    // Hemoglobina
    const hbLine = 'Hemoglobin >= 9.0 g/dL at the time of screening.';
    const hb = parseLabCriterion(hbLine, 'inclusion');
    expect(hb?.category).toBe('LAB');
    expect(hb?.details?.labParameter).toBe('hemoglobin');
    expect(hb?.details?.labOperator).toBe('>=');
    expect(hb?.details?.labValue).toBe(9.0);
    expect(hb?.details?.labUnit).toBe('g/dL');
  });

  // 8. Tratamiento previo explícito
  it('8. Estructura antecedentes de tratamientos previos explícitos', () => {
    // Prior platinum
    const platLine = 'Patient has received prior platinum-based chemotherapy.';
    const plat = parseTreatmentLine(platLine, 'inclusion');
    expect(plat?.category).toBe('PRIOR_TREATMENT');
    expect(plat?.details?.treatmentName).toBe('platinum');
    expect(plat?.details?.treatmentRequirement).toBe('MUST_HAVE_RECEIVED');

    // Treatment-naïve
    const naiveLine = 'Treatment-naive patients who have not received prior systemic anticancer therapy.';
    const naive = parseTreatmentLine(naiveLine, 'inclusion');
    expect(naive?.category).toBe('PRIOR_TREATMENT');
    expect(naive?.details?.treatmentRequirement).toBe('TREATMENT_NAIVE');
    expect(naive?.details?.maxLines).toBe(0);

    // Exclusión de inmunoterapia previa
    const ioExcLine = 'Prior immunotherapy with anti-PD-1 or anti-PD-L1 antibody is not permitted.';
    const ioExc = parseTreatmentLine(ioExcLine, 'exclusion');
    expect(ioExc?.category).toBe('PRIOR_TREATMENT');
    expect(ioExc?.details?.treatmentName).toBe('immunotherapy');
    expect(ioExc?.details?.treatmentRequirement).toBe('FORBIDDEN');
  });

  // 9. Criterio ambiguo -> UNSTRUCTURED
  it('9. Criterios ambiguos o cualitativos se conservan como UNSTRUCTURED con texto original intacto', () => {
    const ambigLine = 'Patient must be willing to comply with all scheduled protocol visits and requirements.';
    const parsed = parseSingleCriterionLine(ambigLine, 'inclusion');

    expect(parsed.parseStatus).toBe('UNSTRUCTURED');
    expect(parsed.category).toBe('OTHER');
    expect(parsed.sourceText).toBe(ambigLine);
    expect(parsed.details).toBeUndefined();
  });

  // 10. Texto original preservado intacto
  it('10. Preserva el texto fuente exacto en todos los criterios parseados', () => {
    const lines = [
      'Inclusion 1: ECOG performance status 0 or 1.',
      'Inclusion 2: Documented KRAS G12C mutation.',
      'Inclusion 3: Patient must sign written informed consent.',
    ];
    const res = parseStructuredCriteria({
      inclusionLines: lines,
      exclusionLines: [],
    });

    expect(res.structuredCriteria.length).toBe(3);
    expect(res.structuredCriteria[0].sourceText).toBe(lines[0]);
    expect(res.structuredCriteria[1].sourceText).toBe(lines[1]);
    expect(res.structuredCriteria[2].sourceText).toBe(lines[2]);
  });

  // 11. Inclusion y exclusion no se mezclan
  it('11. Distingue estrictamente los tipos de criterio inclusion y exclusion', () => {
    const res = parseStructuredCriteria({
      inclusionLines: ['ECOG 0-1', 'Bilirubin <= 1.5 x ULN'],
      exclusionLines: ['Active brain metastases', 'Prior immunotherapy'],
    });

    const incs = res.structuredCriteria.filter(c => c.criterionType === 'inclusion');
    const excs = res.structuredCriteria.filter(c => c.criterionType === 'exclusion');

    expect(incs.length).toBe(2);
    expect(excs.length).toBe(2);
    expect(incs.every(c => c.criterionType === 'inclusion')).toBe(true);
    expect(excs.every(c => c.criterionType === 'exclusion')).toBe(true);
  });

  // 12. No se crean criterios por inferencia
  it('12. No genera criterios no especificados en el texto del protocolo', () => {
    const res = parseStructuredCriteria({
      inclusionLines: ['Histologically proven metastatic adenocarcinoma of the prostate.'],
      exclusionLines: [],
    });

    // No debe haber inventado EGFR, KRAS, ECOG ni laboratorios
    expect(res.structuredCriteria.some(c => c.category === 'ECOG')).toBe(false);
    expect(res.structuredCriteria.some(c => c.category === 'BIOMARKER')).toBe(false);
    expect(res.structuredCriteria.some(c => c.category === 'LAB')).toBe(false);
  });

  // 13. No existe ningún ECOG hardcodeado global
  it('13. Elimina cualquier supuesto global de ECOG en el matcher: no descarta ni exige ECOG si el ensayo no lo especifica', () => {
    const trialWithoutEcog: ClinicalTrial = {
      id: 'ctgov_test_no_ecog',
      source: 'clinicaltrials.gov',
      sourceId: 'NCT00000001',
      title: 'Estudio sin criterio ECOG especificado',
      sponsor: 'Sponsor Test',
      status: 'RECRUITING',
      statusLabel: 'Reclutando',
      phase: 'Fase 3',
      phaseNormalized: 'Fase 3',
      conditions: ['Lung Cancer'],
      tumorTypes: ['pulmon'],
      biomarkers: [],
      interventions: [],
      briefSummary: '',
      eligibilityCriteria: '',
      inclusionCriteria: ['Adult patients with NSCLC'],
      exclusionCriteria: [],
      sex: 'ALL',
      locations: [],
      hasCordobaCenter: true,
      hasArgentinaCenter: true,
      cordobaCenters: ['Hospital Test'],
      url: 'https://test.com',
      lastUpdated: '2026-09-01',
      importedAt: Date.now(),
      // ecogMaxAdmissible is undefined!
      ecogMaxAdmissible: undefined,
      structuredCriteria: [],
    };

    const patientWithEcog2: PatientClinicalProfile = {
      patientId: 'p-1',
      hcNumber: 'HC-001',
      name: 'Paciente ECOG 2',
      diagnosisRaw: 'Cáncer de pulmón',
      organOrSite: 'pulmon',
      ecogDocumented: 2,
      biomarkersDocumented: [],
      linesDocumented: [],
      priorTreatments: [],
      labsDocumented: {},
    };

    const patientWithoutEcog: PatientClinicalProfile = {
      patientId: 'p-2',
      hcNumber: 'HC-002',
      name: 'Paciente Sin ECOG',
      diagnosisRaw: 'Cáncer de pulmón',
      organOrSite: 'pulmon',
      ecogDocumented: undefined,
      biomarkersDocumented: [],
      linesDocumented: [],
      priorTreatments: [],
      labsDocumented: {},
    };

    // Para el paciente con ECOG 2: no debe ser rechazado por ECOG
    const res1 = evaluateTrialMatch(patientWithEcog2, trialWithoutEcog);
    expect(res1.incompatibilities.some(i => i.toLowerCase().includes('ecog'))).toBe(false);

    // Para el paciente sin ECOG documentado: no debe marcarse como dato faltante de ECOG
    const res2 = evaluateTrialMatch(patientWithoutEcog, trialWithoutEcog);
    expect(res2.missingData.some(m => m.toLowerCase().includes('ecog'))).toBe(false);

    // Ahora, si el ensayo SÍ especifica ECOG <= 1:
    const trialWithEcog1: ClinicalTrial = {
      ...trialWithoutEcog,
      id: 'ctgov_test_ecog_1',
      ecogMaxAdmissible: 1,
    };

    // El paciente con ECOG 2 debe tener incompatibilidad por exceder el máximo del protocolo
    const res3 = evaluateTrialMatch(patientWithEcog2, trialWithEcog1);
    expect(res3.incompatibilities.some(i => i.toLowerCase().includes('ecog') && i.includes('superior'))).toBe(true);

    // El paciente sin ECOG debe tener missingData indicando que el protocolo requiere ECOG <= 1
    const res4 = evaluateTrialMatch(patientWithoutEcog, trialWithEcog1);
    expect(res4.missingData.some(m => m.toLowerCase().includes('ecog') && m.includes('ECOG <= 1'))).toBe(true);
  });

  // 14. Documentos existentes continúan siendo compatibles
  it('14. Documentos históricos sin structuredCriteria continúan siendo 100% compatibles', () => {
    const historicalTrial: ClinicalTrial = {
      id: 'ctgov_historical_doc',
      source: 'clinicaltrials.gov',
      sourceId: 'NCT99999999',
      title: 'Estudio histórico sin campo structuredCriteria',
      sponsor: 'Sponsor Histórico',
      status: 'RECRUITING',
      statusLabel: 'Reclutando',
      phase: 'Fase 2',
      phaseNormalized: 'Fase 2',
      conditions: ['Colorectal Cancer'],
      tumorTypes: ['colorrectal'],
      biomarkers: [],
      interventions: [],
      briefSummary: '',
      eligibilityCriteria: '',
      inclusionCriteria: ['Colorectal cancer patients'],
      exclusionCriteria: [],
      sex: 'ALL',
      locations: [],
      hasCordobaCenter: true,
      hasArgentinaCenter: true,
      cordobaCenters: ['Hospital Test'],
      url: 'https://test.com',
      lastUpdated: '2025-01-01',
      importedAt: 1700000000,
      // structuredCriteria is undefined
    };

    const patient: PatientClinicalProfile = {
      patientId: 'p-hist',
      hcNumber: 'HC-HIST',
      name: 'Paciente Test',
      diagnosisRaw: 'Cáncer colorrectal',
      organOrSite: 'colorrectal',
      biomarkersDocumented: [],
      linesDocumented: [],
      priorTreatments: [],
      labsDocumented: {},
    };

    // Debe evaluar sin arrojar excepciones ni errores
    expect(() => evaluateTrialMatch(patient, historicalTrial)).not.toThrow();
    const result = evaluateTrialMatch(patient, historicalTrial);
    expect(result.matches.some(m => m.includes('colorrectal') || m.includes('Colorrectal'))).toBe(true);
  });

});
