/**
 * Test unitario automatizado para nccnGuidelines.ts
 * Verifica la corrección de detección de órgano y matching de histología NCCN
 */

import {
  extractPatientTumorProfile,
  extractClinicalScenarioProfile,
  validateCandidateSources,
  matchGuidelineByProfile,
} from './nccnGuidelines.ts';
import type { PatientTumorProfile } from './nccnGuidelines.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details: string = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

console.log('=== INICIANDO PRUEBAS DE DETECCIÓN Y MATCHING NCCN ===\n');

// ------------------------------------------------------------------------------------------------
// CASO 2.a: Diagnóstico explícito "Adenocarcinoma de colon estadio IV" + mención incidental de páncreas
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseA = `
Paciente masculino de 64 años con diagnóstico confirmado de Adenocarcinoma de colon estadio IV.
TAC de tórax, abdomen y pelvis con contraste:
Hígado con múltiples lesiones focales compatibles con secundarismo.
Páncreas sin alteraciones ni lesiones focales. Conducto de Wirsung de calibre normal.
Riñones y glándulas suprarrenales sin particularidades.
Se inicia primera línea con esquema FOLFOX + Bevacizumab.
`;

const profileCaseA = extractPatientTumorProfile(clinicalTextCaseA, 'Adenocarcinoma de colon estadio IV');
assert(
  profileCaseA.organ === 'Colon',
  'Caso 2.a - extractPatientTumorProfile detecta "Colon" y NO "Páncreas"',
  `Órgano detectado: ${profileCaseA.organ}`
);
assert(
  profileCaseA.organ !== 'Páncreas',
  'Caso 2.a - Páncreas fue descartado a pesar de la mención incidental',
  `Órgano detectado: ${profileCaseA.organ}`
);
assert(
  profileCaseA.histology.toLowerCase().includes('colon'),
  'Caso 2.a - Histología calificada correctamente para colon',
  `Histología detectada: ${profileCaseA.histology}`
);

// ------------------------------------------------------------------------------------------------
// CASO 2.b: Pipeline completo (validateCandidateSources) en escenario metastásico activo de Colon
// ------------------------------------------------------------------------------------------------
const validationCaseB = validateCandidateSources(clinicalTextCaseA, [], 'Adenocarcinoma de colon estadio IV');

assert(
  validationCaseB.canProceed === true,
  'Caso 2.b - validateCandidateSources permite proceder (canProceed === true)',
  `canProceed: ${validationCaseB.canProceed}, stopReason: ${validationCaseB.stopReason}`
);
assert(
  validationCaseB.validSystemGuideline !== null && validationCaseB.validSystemGuideline.id === 'colon-cancer',
  'Caso 2.b - Guía del sistema asignada es colon-cancer',
  `Guía ID: ${validationCaseB.validSystemGuideline?.id}`
);
assert(
  validationCaseB.validSystemGuideline?.organ === 'Colon',
  'Caso 2.b - El órgano de la guía es Colon y no Páncreas',
  `Guía Organ: ${validationCaseB.validSystemGuideline?.organ}`
);
assert(
  validationCaseB.activeScenarioRecommendations !== null &&
  validationCaseB.activeScenarioRecommendations !== undefined &&
  validationCaseB.activeScenarioRecommendations.scenarioTitle.includes('Modo B'),
  'Caso 2.b - activeScenarioRecommendations corresponde a Modo B (Metastásico Activo)',
  `Título de escenario: ${validationCaseB.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  !validationCaseB.activeScenarioRecommendations?.scenarioTitle.includes('Modo A') &&
  !validationCaseB.activeScenarioRecommendations?.scenarioTitle.toLowerCase().includes('pancrea'),
  'Caso 2.b - NO se asignó vigilancia localizada (Modo A) ni guía de páncreas',
  `Título: ${validationCaseB.activeScenarioRecommendations?.scenarioTitle}`
);

// ------------------------------------------------------------------------------------------------
// CASO 2.c: Caso legítimo de Páncreas ("Adenocarcinoma ductal de páncreas")
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseC = `
Paciente de 58 años en consulta oncológica.
Diagnóstico: Adenocarcinoma ductal de páncreas cT2N1M0.
Colonoscopía de pesquisa: colon normal sin pólipos ni lesiones mucosas.
`;

const profileCaseC = extractPatientTumorProfile(clinicalTextCaseC, 'Adenocarcinoma ductal de páncreas');
assert(
  profileCaseC.organ === 'Páncreas',
  'Caso 2.c - extractPatientTumorProfile detecta "Páncreas"',
  `Órgano detectado: ${profileCaseC.organ}`
);

const matchCaseC = matchGuidelineByProfile(profileCaseC);
assert(
  matchCaseC.status === 'EXACT_MATCH' && matchCaseC.guideline?.id === 'pancreatic-adenocarcinoma',
  'Caso 2.c - matchGuidelineByProfile empareja con pancreatic-adenocarcinoma',
  `Status: ${matchCaseC.status}, Guideline: ${matchCaseC.guideline?.id}`
);

// ------------------------------------------------------------------------------------------------
// CASO 2.d: Caso realmente ambiguo (dos órganos mencionados con igual peso y sin dx explícito)
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseD = `
Paciente de 70 años en estudio por pérdida de peso.
Estudios por imágenes revelan masa neoplásica en colon descendente y lesión tumoral sincrónica en cabeza de páncreas.
Pendiente de resolución biópsica para determinar foco primario.
`;

const profileCaseD = extractPatientTumorProfile(clinicalTextCaseD, '');
assert(
  profileCaseD.organ.toLowerCase().includes('ambiguo') || profileCaseD.organ === 'Desconocido / No identificado',
  'Caso 2.d - Órgano marcado como ambiguo o no identificado',
  `Órgano detectado: ${profileCaseD.organ}`
);
assert(
  profileCaseD.isHistologyIncomplete === true,
  'Caso 2.d - Flag isHistologyIncomplete activado por ambigüedad',
  `isHistologyIncomplete: ${profileCaseD.isHistologyIncomplete}`
);

const validationCaseD = validateCandidateSources(clinicalTextCaseD, [], '');
assert(
  validationCaseD.canProceed === false,
  'Caso 2.d - validateCandidateSources bloquea ejecución (canProceed === false)',
  `canProceed: ${validationCaseD.canProceed}`
);
assert(
  validationCaseD.stopReason === 'HISTOLOGY_INCOMPLETE',
  'Caso 2.d - stopReason es HISTOLOGY_INCOMPLETE',
  `stopReason: ${validationCaseD.stopReason}`
);
assert(
  Boolean(validationCaseD.stopTitle && validationCaseD.stopTitle.includes('Ambigüedad')),
  'Caso 2.d - stopTitle indica claramente Ambigüedad Diagnóstica',
  `stopTitle: ${validationCaseD.stopTitle}`
);

const matchCaseD = matchGuidelineByProfile(profileCaseD);
assert(
  matchCaseD.guideline === null && (matchCaseD.status === 'HISTOLOGY_INCOMPLETE' || matchCaseD.status === 'NO_MATCHING_GUIDELINE'),
  'Caso 2.d - matchGuidelineByProfile no selecciona ninguna guía (guideline === null)',
  `Guideline: ${matchCaseD.guideline}`
);

// ------------------------------------------------------------------------------------------------
// CASO EXTRA E: Red de seguridad en isHistMatch (Adenocarcinoma genérico no valida contra órgano ajeno)
// ------------------------------------------------------------------------------------------------
const profileGenericColon: PatientTumorProfile = {
  organ: 'Colon',
  histology: 'Adenocarcinoma',
  subtype: 'Adenocarcinoma',
  stage: 'IV',
  isStageIV: true,
  diseaseStatus: 'ACTIVE_METASTATIC',
  diseaseStatusDescription: 'Metastásico activo',
  followUpMode: 'ACTIVE_METASTATIC_MONITORING',
  modeLabel: 'Modo B',
  activeTreatment: 'FOLFOX',
  hasActiveSystemicTreatment: true,
  treatmentIntent: 'Paliativo',
  lastImagingDate: '',
  lastTreatmentDate: '',
  surgeryDate: '',
  isHistologyIncomplete: false,
  summary: 'Colon — Adenocarcinoma (IV)',
};

const matchGenericColon = matchGuidelineByProfile(profileGenericColon);
assert(
  matchGenericColon.status === 'EXACT_MATCH' && matchGenericColon.guideline?.id === 'colon-cancer',
  'Caso Extra E1 - "Adenocarcinoma" genérico valida contra colon-cancer cuando organ="Colon"',
  `Guideline: ${matchGenericColon.guideline?.id}`
);

// Simular un perfil donde la histología contiene "colon" pero se intenta emparejar contra un objeto de guía de Páncreas
const pancreaticGuidelineProfile: PatientTumorProfile = {
  ...profileGenericColon,
  organ: 'Páncreas',
  histology: 'Adenocarcinoma de colon', // conflicto deliberado
};
const matchConflict = matchGuidelineByProfile(pancreaticGuidelineProfile);
assert(
  matchConflict.status === 'NO_MATCHING_GUIDELINE',
  'Caso Extra E2 - "Adenocarcinoma de colon" es rechazado por la guía de Páncreas por conflicto de órgano',
  `Status: ${matchConflict.status}`
);

// ------------------------------------------------------------------------------------------------
// CASO F: Caso reportado por el usuario (Páncreas pT2 pN0 M0 operada, adyuvancia FOLFOX, en seguimiento)
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseF = `
Paciente femenina de 61 años con diagnóstico de Adenocarcinoma de páncreas pT2 pN0 M0 (Estadio IB).
Antecedente de duodenopancreatectomía cefálica (DPC) con márgenes R0.
Realizó quimioterapia adyuvante con esquema FOLFOX y actualmente se encuentra en seguimiento oncológico.
TAC de tórax, abdomen y pelvis con contraste: sin signos tomográficos de recidiva locorregional ni a distancia.
Marcador tumoral CA 19-9 dentro de límites normales.
`;

const scenarioProfileCaseF = extractClinicalScenarioProfile(clinicalTextCaseF, 'Adenocarcinoma de páncreas pT2 pN0 M0');
assert(
  scenarioProfileCaseF.organ === 'Páncreas',
  'Caso F - Órgano correctamente detectado como Páncreas',
  `Órgano: ${scenarioProfileCaseF.organ}`
);
assert(
  scenarioProfileCaseF.isStageIV === false,
  'Caso F - No es Estadio IV (isStageIV === false)',
  `isStageIV: ${scenarioProfileCaseF.isStageIV}`
);
assert(
  scenarioProfileCaseF.diseaseStatus === 'NED',
  'Caso F - Estado de enfermedad es NED (sin evidencia de recidiva)',
  `diseaseStatus: ${scenarioProfileCaseF.diseaseStatus}`
);
assert(
  scenarioProfileCaseF.followUpMode === 'CURATIVE_SURVEILLANCE',
  'Caso F - Escenario clínico es CURATIVE_SURVEILLANCE (Modo A)',
  `followUpMode: ${scenarioProfileCaseF.followUpMode}`
);
assert(
  scenarioProfileCaseF.modeLabel.includes('Modo A'),
  'Caso F - modeLabel asigna Modo A — Vigilancia post-tratamiento curativo',
  `modeLabel: ${scenarioProfileCaseF.modeLabel}`
);
assert(
  scenarioProfileCaseF.hasActiveSystemicTreatment === false,
  'Caso F - hasActiveSystemicTreatment es false (adyuvancia ya completada)',
  `hasActiveSystemicTreatment: ${scenarioProfileCaseF.hasActiveSystemicTreatment}`
);
assert(
  scenarioProfileCaseF.activeTreatment.includes('completado') || scenarioProfileCaseF.activeTreatment.includes('seguimiento'),
  'Caso F - activeTreatment refleja tratamiento completado / en seguimiento',
  `activeTreatment: ${scenarioProfileCaseF.activeTreatment}`
);

const validationCaseF = validateCandidateSources(clinicalTextCaseF, [], 'Adenocarcinoma de páncreas pT2 pN0 M0');
assert(
  validationCaseF.canProceed === true,
  'Caso F - validateCandidateSources permite proceder (canProceed === true)',
  `canProceed: ${validationCaseF.canProceed}`
);
assert(
  validationCaseF.validSystemGuideline?.id === 'pancreatic-adenocarcinoma',
  'Caso F - Guía seleccionada es pancreatic-adenocarcinoma',
  `Guideline: ${validationCaseF.validSystemGuideline?.id}`
);
assert(
  validationCaseF.activeScenarioRecommendations !== null &&
  validationCaseF.activeScenarioRecommendations !== undefined &&
  (validationCaseF.activeScenarioRecommendations.scenarioTitle.includes('Modo A') ||
   validationCaseF.activeScenarioRecommendations.scenarioTitle.includes('Vigilancia post-resección')),
  'Caso F - activeScenarioRecommendations corresponde a Vigilancia Localizada (Modo A)',
  `Escenario: ${validationCaseF.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  !validationCaseF.activeScenarioRecommendations?.scenarioTitle.includes('Modo B') &&
  !validationCaseF.activeScenarioRecommendations?.scenarioTitle.includes('Recidiva activa'),
  'Caso F - NO se asignó erróneamente Modo B (Recidiva activa)',
  `Escenario: ${validationCaseF.activeScenarioRecommendations?.scenarioTitle}`
);

// ------------------------------------------------------------------------------------------------
// CASO G: Paciente con recidiva confirmada documentada (debe asignar Modo B - Recidiva activa)
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseG = `
Paciente operada de DPC hace 14 meses por adenocarcinoma de páncreas.
TAC de control actual: se constata recidiva tumoral locorregional en lecho quirúrgico de 28 mm.
Se planifica reevaluación oncológica.
`;

const scenarioProfileCaseG = extractClinicalScenarioProfile(clinicalTextCaseG, 'Adenocarcinoma de páncreas');
assert(
  scenarioProfileCaseG.diseaseStatus === 'PROGRESSION',
  'Caso G - Recidiva real confirmada detecta diseaseStatus === "PROGRESSION"',
  `diseaseStatus: ${scenarioProfileCaseG.diseaseStatus}`
);
assert(
  scenarioProfileCaseG.followUpMode === 'ACTIVE_METASTATIC_MONITORING',
  'Caso G - Recidiva real confirmada asigna ACTIVE_METASTATIC_MONITORING',
  `followUpMode: ${scenarioProfileCaseG.followUpMode}`
);
assert(
  scenarioProfileCaseG.modeLabel.includes('Modo B'),
  'Caso G - modeLabel asigna Modo B — Recidiva activa',
  `modeLabel: ${scenarioProfileCaseG.modeLabel}`
);

// ------------------------------------------------------------------------------------------------
// CASO H: Paciente en seguimiento con informe que niega metástasis ("sin metástasis hepáticas")
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseH = `
Paciente de 55 años, antecedente de hemicolectomía por adenocarcinoma de colon pT3 pN0 M0.
Realizó adyuvancia con capecitabina completada.
TAC de control: sin metástasis hepáticas ni pulmonares. Sin signos de recidiva anastomótica.
`;

const scenarioProfileCaseH = extractClinicalScenarioProfile(clinicalTextCaseH, 'Adenocarcinoma de colon pT3 pN0 M0');
assert(
  scenarioProfileCaseH.isStageIV === false,
  'Caso H - "sin metástasis hepáticas" no activa falsamente isStageIV',
  `isStageIV: ${scenarioProfileCaseH.isStageIV}`
);
assert(
  scenarioProfileCaseH.diseaseStatus === 'NED',
  'Caso H - diseaseStatus es NED',
  `diseaseStatus: ${scenarioProfileCaseH.diseaseStatus}`
);
assert(
  scenarioProfileCaseH.followUpMode === 'CURATIVE_SURVEILLANCE',
  'Caso H - followUpMode es CURATIVE_SURVEILLANCE (Modo A)',
  `followUpMode: ${scenarioProfileCaseH.followUpMode}`
);

console.log(`\n=== RESUMEN DE PRUEBAS: ${passed} PASARON, ${failed} FALLARON ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('¡TODAS LAS PRUEBAS COMPLETADAS SATISFACTORIAMENTE!');
}
