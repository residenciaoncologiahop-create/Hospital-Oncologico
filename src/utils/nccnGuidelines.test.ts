/**
 * Test unitario automatizado para nccnGuidelines.ts
 * Verifica la corrección de detección de órgano y matching de histología NCCN
 */

import {
  extractPatientTumorProfile,
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

console.log(`\n=== RESUMEN DE PRUEBAS: ${passed} PASARON, ${failed} FALLARON ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('¡TODAS LAS PRUEBAS COMPLETADAS SATISFACTORIAMENTE!');
}
