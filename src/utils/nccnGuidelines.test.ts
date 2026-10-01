/**
 * Test unitario automatizado para nccnGuidelines.ts
 * Verifica la corrección de detección de órgano y matching de histología NCCN
 */

import {
  extractPatientTumorProfile,
  extractClinicalScenarioProfile,
  validateCandidateSources,
  matchGuidelineByProfile,
  extractStageFromClinicalText,
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

// ------------------------------------------------------------------------------------------------
// CASO I: Mola hidatiforme con mención de "legrado uterino" / evacuación uterina
// Debe emparejar con NCCN Gestational Trophoblastic Neoplasia, NO bloquear y NO devolver Endometrio
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseI = `
Paciente femenina de 26 años con diagnóstico confirmado de mola hidatiforme.
Se realizó legrado uterino evacuador sin complicaciones.
Ecografía ginecológica post-evacuación: cavidad uterina limpia, sin restos ovulares ni signos de invasión miometrial.
Control periódico de subunidad beta-hCG en curso con valores en descenso logarítmico.
`;

const profileCaseI = extractPatientTumorProfile(clinicalTextCaseI, 'Mola hidatiforme');
assert(
  profileCaseI.organ !== 'Endometrio / Útero',
  'Caso I - Mola hidatiforme NO se clasifica erróneamente como "Endometrio / Útero"',
  `Órgano detectado: ${profileCaseI.organ}`
);
assert(
  profileCaseI.organ === 'Trofoblasto gestacional (Útero)',
  'Caso I - Órgano clasificado exactamente como "Trofoblasto gestacional (Útero)"',
  `Órgano detectado: ${profileCaseI.organ}`
);
assert(
  profileCaseI.histology === 'Mola hidatiforme',
  'Caso I - Histología clasificada como Mola hidatiforme',
  `Histología: ${profileCaseI.histology}`
);

const validationCaseI = validateCandidateSources(clinicalTextCaseI, [], 'Mola hidatiforme');
assert(
  validationCaseI.canProceed === true,
  'Caso I - validateCandidateSources permite proceder (canProceed === true)',
  `canProceed: ${validationCaseI.canProceed}, stopReason: ${validationCaseI.stopReason}`
);
assert(
  validationCaseI.validSystemGuideline !== null && validationCaseI.validSystemGuideline.id === 'gestational-trophoblastic-neoplasia',
  'Caso I - Guía asignada es gestational-trophoblastic-neoplasia',
  `Guideline ID: ${validationCaseI.validSystemGuideline?.id}`
);
assert(
  validationCaseI.validSystemGuideline?.organ === 'Trofoblasto gestacional (Útero)',
  'Caso I - El órgano de la guía es "Trofoblasto gestacional (Útero)" y no Endometrio',
  `Guía Organ: ${validationCaseI.validSystemGuideline?.organ}`
);
assert(
  validationCaseI.activeScenarioRecommendations !== null &&
  validationCaseI.activeScenarioRecommendations !== undefined &&
  validationCaseI.activeScenarioRecommendations.scenarioTitle.includes('post-evacuación'),
  'Caso I - Escenario asignado corresponde a Vigilancia post-evacuación de mola (sin GTN)',
  `Escenario: ${validationCaseI.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  Boolean(validationCaseI.activeScenarioRecommendations?.schedule.includes('hCG') && validationCaseI.activeScenarioRecommendations?.schedule.includes('Anticoncepción')),
  'Caso I - Recomendaciones de schedule incluyen monitoreo seriado de hCG y anticoncepción obligatoria',
  `Schedule: ${validationCaseI.activeScenarioRecommendations?.schedule}`
);

// Verificación caso exacto pedido por el usuario: "mola hidatiforme completa, evacuación uterina, hCG en descenso" sin dx explícito
const userExactMolaText = 'mola hidatiforme completa, evacuación uterina, hCG en descenso';
const profileUserMola = extractPatientTumorProfile(userExactMolaText, '');
assert(
  profileUserMola.organ === 'Trofoblasto gestacional (Útero)',
  'Caso I.2 - Caso exacto usuario detecta "Trofoblasto gestacional (Útero)"',
  `Órgano: ${profileUserMola.organ}`
);
assert(
  profileUserMola.histology === 'Mola hidatiforme completa',
  'Caso I.2 - Caso exacto usuario detecta histología "Mola hidatiforme completa"',
  `Histología: ${profileUserMola.histology}`
);

const validationUserMola = validateCandidateSources(userExactMolaText, [], '');
assert(
  validationUserMola.canProceed === true,
  'Caso I.2 - Caso exacto usuario procede (canProceed === true)',
  `canProceed: ${validationUserMola.canProceed}`
);
assert(
  validationUserMola.validSystemGuideline?.id === 'gestational-trophoblastic-neoplasia',
  'Caso I.2 - Caso exacto usuario asigna guía gestational-trophoblastic-neoplasia',
  `Guideline: ${validationUserMola.validSystemGuideline?.id}`
);
assert(
  validationUserMola.validSystemGuideline?.organ !== 'Endometrio / Útero',
  'Caso I.2 - Caso exacto usuario NO da Endometrio',
  `Órgano: ${validationUserMola.validSystemGuideline?.organ}`
);

// ------------------------------------------------------------------------------------------------
// CASO J: Carcinoma de Sitio Primario Desconocido (CSPD / CUP) con marcadores IHQ (Bug A)
// Debe bloquear, NO adivinar un órgano de la lista cerrada.
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseJ = `
Paciente masculino de 67 años en estudio por adenopatía cervical supraclavicular derecha.
Biopsia ganglionar: metástasis de adenocarcinoma pobremente diferenciado de sitio primario desconocido (CSPD).
Perfil de inmunohistoquímica: CK7 positivo, CK20 negativo, CDX2 negativo (descarta primario en colon), TTF1 negativo (descarta pulmón), PSA negativo (descarta próstata), mamaglobina negativa (descarta mama).
Tomografía computada de tórax, abdomen y pelvis: sin evidencia de tumor primario definido.
`;

const profileCaseJ = extractPatientTumorProfile(clinicalTextCaseJ, 'Carcinoma de sitio primario desconocido (CSPD)');
assert(
  profileCaseJ.organ !== 'Colon' && profileCaseJ.organ !== 'Pulmón' && profileCaseJ.organ !== 'Próstata' && profileCaseJ.organ !== 'Mama',
  'Caso J - CSPD con marcadores IHQ no adivina ningún órgano de la lista cerrada',
  `Órgano detectado: ${profileCaseJ.organ}`
);
assert(
  profileCaseJ.organ.includes('No cubierto') || profileCaseJ.organ.includes('desconocido'),
  'Caso J - Órgano clasificado como sitio primario desconocido / no cubierto',
  `Órgano detectado: ${profileCaseJ.organ}`
);

const validationCaseJ = validateCandidateSources(clinicalTextCaseJ, [], 'Carcinoma de sitio primario desconocido (CSPD)');
assert(
  validationCaseJ.canProceed === false,
  'Caso J - validateCandidateSources bloquea ejecución (canProceed === false)',
  `canProceed: ${validationCaseJ.canProceed}`
);
assert(
  validationCaseJ.stopReason === 'NO_MATCHING_SYSTEM_GUIDELINE',
  'Caso J - stopReason es NO_MATCHING_SYSTEM_GUIDELINE',
  `stopReason: ${validationCaseJ.stopReason}`
);
assert(
  validationCaseJ.validSystemGuideline === null,
  'Caso J - validSystemGuideline es null',
  `Guideline: ${validationCaseJ.validSystemGuideline}`
);

// ------------------------------------------------------------------------------------------------
// CASO K: Páncreas resecado, adyuvancia finalizada, motivo de estudio "descartar recidiva" (Bug B)
// "se solicita TAC para descartar recidiva, sin hallazgos patológicos" -> Modo A, NO Modo B
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseK = `
Paciente de 59 años operado de duodenopancreatectomía cefálica (DPC) por adenocarcinoma de páncreas pT2 pN0 M0.
Adyuvancia finalizada hace 6 meses. Actualmente asintomático.
Nota de consulta: Paciente en seguimiento ambulatorio. Se solicita TAC para descartar recidiva, sin hallazgos patológicos.
CA 19-9 normal.
`;

const profileScenarioCaseK = extractClinicalScenarioProfile(clinicalTextCaseK, 'Adenocarcinoma de páncreas pT2 pN0 M0');
assert(
  profileScenarioCaseK.diseaseStatus === 'NED',
  'Caso K - "se solicita TAC para descartar recidiva, sin hallazgos patológicos" asigna NED y no PROGRESSION',
  `diseaseStatus: ${profileScenarioCaseK.diseaseStatus}`
);
assert(
  profileScenarioCaseK.followUpMode === 'CURATIVE_SURVEILLANCE',
  'Caso K - followUpMode es CURATIVE_SURVEILLANCE (Modo A)',
  `followUpMode: ${profileScenarioCaseK.followUpMode}`
);
assert(
  profileScenarioCaseK.modeLabel.includes('Modo A'),
  'Caso K - modeLabel asigna Modo A — Vigilancia post-tratamiento curativo',
  `modeLabel: ${profileScenarioCaseK.modeLabel}`
);

const validationCaseK = validateCandidateSources(clinicalTextCaseK, [], 'Adenocarcinoma de páncreas pT2 pN0 M0');
assert(
  validationCaseK.canProceed === true,
  'Caso K - validateCandidateSources permite proceder (canProceed === true)',
  `canProceed: ${validationCaseK.canProceed}`
);
assert(
  validationCaseK.activeScenarioRecommendations !== null &&
  validationCaseK.activeScenarioRecommendations !== undefined &&
  (validationCaseK.activeScenarioRecommendations.scenarioTitle.includes('Modo A') ||
   validationCaseK.activeScenarioRecommendations.scenarioTitle.includes('Vigilancia post-resección')),
  'Caso K - activeScenarioRecommendations corresponde a Vigilancia Curativa (Modo A)',
  `Escenario: ${validationCaseK.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  !validationCaseK.activeScenarioRecommendations?.scenarioTitle.includes('Modo B'),
  'Caso K - NO se asignó Modo B',
  `Escenario: ${validationCaseK.activeScenarioRecommendations?.scenarioTitle}`
);

// ------------------------------------------------------------------------------------------------
// CASO L: Frases de motivo de control, sospecha no confirmada y screening (Bug B)
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseL1 = `Paciente operado de colectomía, adyuvancia completada. Se descarta recidiva tras informe tomográfico.`;
const profileL1 = extractClinicalScenarioProfile(clinicalTextCaseL1, 'Adenocarcinoma de colon pT2 pN0 M0');
assert(profileL1.diseaseStatus === 'NED' && profileL1.followUpMode === 'CURATIVE_SURVEILLANCE', 'Caso L1 - "se descarta recidiva" da Modo A / NED');

const clinicalTextCaseL2 = `Paciente en control oncológico post-quirúrgico. Consulta por sospecha de recidiva a confirmar con nuevo laboratorio.`;
const profileL2 = extractClinicalScenarioProfile(clinicalTextCaseL2, 'Adenocarcinoma de colon pT2 pN0 M0');
assert(profileL2.diseaseStatus === 'NED' && profileL2.followUpMode === 'CURATIVE_SURVEILLANCE', 'Caso L2 - "sospecha de recidiva a confirmar" da Modo A / NED');

const clinicalTextCaseL3 = `Paciente operada en control. Screening de recidiva sin hallazgos patológicos.`;
const profileL3 = extractClinicalScenarioProfile(clinicalTextCaseL3, 'Adenocarcinoma de páncreas pT1b pN0 M0');
assert(profileL3.diseaseStatus === 'NED' && profileL3.followUpMode === 'CURATIVE_SURVEILLANCE', 'Caso L3 - "Screening de recidiva sin hallazgos" da Modo A / NED');

// ------------------------------------------------------------------------------------------------
// CASO M: Cáncer de ovario estadio IIIC con recurrencia platino-sensible y tratamiento activo
// Debe asignar Modo B (enfermedad activa), NO caer erróneamente en Modo A (NED / vigilancia)
// ------------------------------------------------------------------------------------------------
const clinicalTextCaseM = `Cáncer de ovario estadio IIIC, citorreducción primaria + adyuvancia hace 2 años, actualmente recurrencia platino-sensible, en tratamiento con carboplatino-paclitaxel`;

const profileCaseM = extractClinicalScenarioProfile(clinicalTextCaseM, 'Cáncer de ovario estadio IIIC');
assert(
  profileCaseM.organ === 'Ovario',
  'Caso M - Órgano detectado como Ovario',
  `Órgano: ${profileCaseM.organ}`
);
assert(
  profileCaseM.isStageIV === false,
  'Caso M - Estadio IIIC no dispara isStageIV (isStageIV === false)',
  `isStageIV: ${profileCaseM.isStageIV}`
);
assert(
  profileCaseM.hasActiveSystemicTreatment === true,
  'Caso M - hasActiveSystemicTreatment es true por "en tratamiento con carboplatino-paclitaxel"',
  `hasActiveSystemicTreatment: ${profileCaseM.hasActiveSystemicTreatment}`
);
assert(
  profileCaseM.followUpMode === 'ACTIVE_METASTATIC_MONITORING',
  'Caso M - followUpMode es ACTIVE_METASTATIC_MONITORING (Modo B) y NO CURATIVE_SURVEILLANCE',
  `followUpMode: ${profileCaseM.followUpMode}`
);
assert(
  profileCaseM.modeLabel.includes('Modo B'),
  'Caso M - modeLabel asigna Modo B',
  `modeLabel: ${profileCaseM.modeLabel}`
);
assert(
  !profileCaseM.modeLabel.includes('Modo A'),
  'Caso M - NO asignó erróneamente Modo A (vigilancia curativa / NED)',
  `modeLabel: ${profileCaseM.modeLabel}`
);

const validationCaseM = validateCandidateSources(clinicalTextCaseM, [], 'Cáncer de ovario estadio IIIC');
assert(
  validationCaseM.canProceed === true,
  'Caso M - validateCandidateSources permite proceder (canProceed === true)',
  `canProceed: ${validationCaseM.canProceed}`
);
assert(
  validationCaseM.profile.followUpMode === 'ACTIVE_METASTATIC_MONITORING',
  'Caso M - Perfil validado tiene followUpMode ACTIVE_METASTATIC_MONITORING (Modo B)',
  `followUpMode: ${validationCaseM.profile.followUpMode}`
);

// Control negativo Caso M.2: Paciente con citorreducción y adyuvancia previa, en control con "sin recurrencia" y "CA 125 normal"
const clinicalTextCaseM2 = `Cáncer de ovario estadio IIIC, citorreducción primaria + adyuvancia completada hace 2 años. Actualmente en control oncológico, asintomática, sin recurrencia, CA 125 normal.`;
const profileCaseM2 = extractClinicalScenarioProfile(clinicalTextCaseM2, 'Cáncer de ovario estadio IIIC');
assert(
  profileCaseM2.diseaseStatus === 'NED',
  'Caso M.2 - "sin recurrencia" y "CA 125 normal" en seguimiento asigna NED',
  `diseaseStatus: ${profileCaseM2.diseaseStatus}`
);
assert(
  profileCaseM2.followUpMode === 'CURATIVE_SURVEILLANCE',
  'Caso M.2 - followUpMode es CURATIVE_SURVEILLANCE (Modo A)',
  `followUpMode: ${profileCaseM2.followUpMode}`
);
assert(
  profileCaseM2.modeLabel.includes('Modo A'),
  'Caso M.2 - modeLabel asigna Modo A',
  `modeLabel: ${profileCaseM2.modeLabel}`
);

// ------------------------------------------------------------------------------------------------
// CASO N: Carcinoma epidermoide de cérvix, estadio FIGO IIIC2, prevención de bugs "vix" y "mola"
// ------------------------------------------------------------------------------------------------

// N.1: Detección precisa de Cuello uterino y Carcinoma epidermoide sin estadio falso
const textN1 = 'Carcinoma epidermoide moderadamente diferenciado invasor de cérvix uterino.';
const profileN1 = extractPatientTumorProfile(textN1, '');
assert(profileN1.organ === 'Cuello uterino (Cérvix)', 'Caso N.1 - Órgano detectado como Cuello uterino (Cérvix)', `Órgano: ${profileN1.organ}`);
assert(profileN1.histology === 'Carcinoma epidermoide de cérvix', 'Caso N.1 - Histología detectada como Carcinoma epidermoide de cérvix', `Histología: ${profileN1.histology}`);
assert(profileN1.stage === 'No documentado', 'Caso N.1 - Estadio es No documentado (no inventa vix)', `Estadio: ${profileN1.stage}`);
assert(!profileN1.histology.includes('Mola'), 'Caso N.1 - Histología NO contiene Mola', `Histología: ${profileN1.histology}`);

// N.2: "cérvix" nunca genera el estadio "vix"
const textN2 = 'Carcinoma epidermoide de cérvix.';
const profileN2 = extractPatientTumorProfile(textN2, '');
assert(profileN2.stage !== 'vix' && !profileN2.stage.includes('vix'), 'Caso N.2 - Estadio NO contiene "vix"', `Estadio: ${profileN2.stage}`);
const stageDirectN2 = extractStageFromClinicalText(textN2, '');
assert(stageDirectN2 !== 'vix', 'Caso N.2 - extractStageFromClinicalText no extrae "vix"', `Estadio: ${stageDirectN2}`);

// N.3: Reconocimiento correcto de estadio FIGO IIIC2
const textN3 = 'Carcinoma epidermoide de cérvix FIGO IIIC2.';
const profileN3 = extractPatientTumorProfile(textN3, '');
assert(profileN3.stage === 'FIGO IIIC2', 'Caso N.3 - Reconoce estadio FIGO IIIC2', `Estadio: ${profileN3.stage}`);

// N.4: Frase con "completamente" no debe transformarse en Mola hidatiforme completa
const textN4 = 'Paciente con carcinoma epidermoide de cérvix. Presenta dolor pélvico que no cede completamente con paracetamol.';
const profileN4 = extractPatientTumorProfile(textN4, '');
assert(profileN4.organ === 'Cuello uterino (Cérvix)', 'Caso N.4 - Órgano es Cuello uterino (Cérvix)', `Órgano: ${profileN4.organ}`);
assert(profileN4.histology === 'Carcinoma epidermoide de cérvix', 'Caso N.4 - Histología es Carcinoma epidermoide de cérvix', `Histología: ${profileN4.histology}`);
assert(profileN4.histology !== 'Mola hidatiforme completa', 'Caso N.4 - NO asigna Mola hidatiforme completa', `Histología: ${profileN4.histology}`);

// N.5: explicitDiagnosis tiene prioridad absoluta sobre menciones incidentales
const explicitDxN5 = 'Carcinoma epidermoide moderadamente diferenciado invasor de cérvix uterino.';
const textN5 = 'Antecedente de embarazo molar / mola mencionada en antecedentes obstétricos antiguos.';
const profileN5 = extractPatientTumorProfile(textN5, explicitDxN5);
assert(profileN5.organ === 'Cuello uterino (Cérvix)', 'Caso N.5 - explicitDiagnosis prioriza Cuello uterino (Cérvix)', `Órgano: ${profileN5.organ}`);
assert(profileN5.histology === 'Carcinoma epidermoide de cérvix', 'Caso N.5 - explicitDiagnosis prioriza Carcinoma epidermoide', `Histología: ${profileN5.histology}`);

// N.6: Caso real de carcinoma de cérvix FIGO IIIC2 completo
const explicitDxReal = 'Carcinoma Epidermoide Moderadamente Diferenciado Invasor de cérvix uterino.';
const clinicalTextReal = `
Anatomía patológica: 19/12/2025.
Inicialmente FIGO IIIC por RMN del 20/12/2025.
Posteriormente FIGO IIIC2 por PET-CT del 10/02/2026, con compromiso ganglionar ilíaco y retroperitoneal.
Tratamiento:
- Quimioterapia de inducción Carboplatino/Paclitaxel: 3 ciclos, finalizada 06/05/2026.
- Quimiorradioterapia concurrente con Cisplatino.
- Radioterapia externa VMAT: iniciada 26/05/2026, finalizada 30/06/2026.
- Braquiterapia HDR endocervicouterina: 3 sesiones, finalizada 28/07/2026.
Evaluación post-tratamiento:
03/08/2026: asintomática, buen estado general.
Se indicaron medidas preventivas para sinequias vaginales.
Se programó PET-CT de control para septiembre/2026.
Situación actual:
23/09/2026.
No presenta estudios nuevos.
Actualmente refiere dolor a nivel de pelvis y miembros inferiores que no cede completamente con paracetamol.
Niega genitorragia.
Niega alteraciones urinarias o intestinales.
Buen estado general.
PS 1.
PLAN ACTUAL DOCUMENTADO:
- Pendiente PET-CT.
- Solicitar RMN de pelvis.
- Solicitar laboratorio de control.
`.trim();

const profileReal = extractPatientTumorProfile(clinicalTextReal, explicitDxReal);
assert(profileReal.organ === 'Cuello uterino (Cérvix)', 'Caso N.6 - Caso real asigna Cuello uterino (Cérvix)', `Órgano: ${profileReal.organ}`);
assert(profileReal.histology === 'Carcinoma epidermoide de cérvix', 'Caso N.6 - Caso real asigna Carcinoma epidermoide', `Histología: ${profileReal.histology}`);
assert(profileReal.histology !== 'Mola hidatiforme completa', 'Caso N.6 - Caso real NO asigna Mola', `Histología: ${profileReal.histology}`);
assert(profileReal.stage === 'FIGO IIIC2', 'Caso N.6 - Caso real asigna FIGO IIIC2', `Estadio: ${profileReal.stage}`);
assert(profileReal.stage !== 'vix', 'Caso N.6 - Caso real NO asigna "vix"', `Estadio: ${profileReal.stage}`);

const validationReal = validateCandidateSources(clinicalTextReal, [], explicitDxReal);
assert(validationReal.canProceed === true, 'Caso N.6 - validateCandidateSources permite proceder', `canProceed: ${validationReal.canProceed}`);
assert(validationReal.validSystemGuideline?.id === 'cervical-cancer', 'Caso N.6 - Guía válida es cervical-cancer', `Guideline: ${validationReal.validSystemGuideline?.id}`);

// ------------------------------------------------------------------------------------------------
// ITERACIÓN 3 — TESTS DE ESTADO CLÍNICO
// ------------------------------------------------------------------------------------------------

// N.7: Paciente cervical post-tratamiento definitivo no quirúrgico NO se describe como "enfermedad resecada"
const scenarioReal = extractClinicalScenarioProfile(clinicalTextReal, explicitDxReal);
assert(!scenarioReal.diseaseStatusDescription.includes('resecada'), 'Caso N.7 - diseaseStatusDescription NO contiene "resecada"', `Descripción: ${scenarioReal.diseaseStatusDescription}`);
assert(scenarioReal.diseaseStatusDescription.includes('Tratamiento definitivo'), 'Caso N.7 - diseaseStatusDescription indica Tratamiento definitivo', `Descripción: ${scenarioReal.diseaseStatusDescription}`);
assert(scenarioReal.diseaseStatusDescription.includes('evaluación post-tratamiento'), 'Caso N.7 - diseaseStatusDescription indica evaluación post-tratamiento', `Descripción: ${scenarioReal.diseaseStatusDescription}`);

// N.8: lastTreatmentDate captura la finalización del tratamiento definitivo (Braquiterapia 28/07/2026)
assert(scenarioReal.lastTreatmentDate === '28/07/2026', 'Caso N.8 - lastTreatmentDate es 28/07/2026', `lastTreatmentDate: ${scenarioReal.lastTreatmentDate}`);

// N.9: Dolor pélvico activa symptomFlag pero NO confirmedRecurrence ni confirmedProgression
assert(scenarioReal.symptomFlag === true, 'Caso N.9 - symptomFlag es true', `symptomFlag: ${scenarioReal.symptomFlag}`);
assert(scenarioReal.relevantSymptoms.includes('Dolor pélvico'), 'Caso N.9 - relevantSymptoms incluye Dolor pélvico', `Síntomas: ${scenarioReal.relevantSymptoms.join(', ')}`);
assert(scenarioReal.relevantSymptoms.includes('Dolor en miembros inferiores'), 'Caso N.9 - relevantSymptoms incluye Dolor en miembros inferiores', `Síntomas: ${scenarioReal.relevantSymptoms.join(', ')}`);
assert(!scenarioReal.relevantSymptoms.includes('Genitorragia / Sangrado vaginal'), 'Caso N.9 - relevantSymptoms NO incluye genitorragia (negada)', `Síntomas: ${scenarioReal.relevantSymptoms.join(', ')}`);
assert(scenarioReal.confirmedRecurrence === false, 'Caso N.9 - confirmedRecurrence es false', `confirmedRecurrence: ${scenarioReal.confirmedRecurrence}`);
assert(scenarioReal.confirmedProgression === false, 'Caso N.9 - confirmedProgression es false', `confirmedProgression: ${scenarioReal.confirmedProgression}`);

// N.10: followUpState asigna SYMPTOMATIC_REEVALUATION
assert(scenarioReal.followUpState === 'SYMPTOMATIC_REEVALUATION', 'Caso N.10 - followUpState es SYMPTOMATIC_REEVALUATION', `followUpState: ${scenarioReal.followUpState}`);

// N.11: Estudios pendientes estructurados correctamente
const hasPetPending = scenarioReal.pendingStudies.some(s => s.study === 'PET-CT' && s.status === 'pending');
assert(hasPetPending, 'Caso N.11 - PET-CT está en pendingStudies como pending', `pendingStudies: ${JSON.stringify(scenarioReal.pendingStudies)}`);
const hasRmnRequested = scenarioReal.pendingStudies.some(s => s.study === 'RMN de pelvis' && s.status === 'requested');
assert(hasRmnRequested, 'Caso N.11 - RMN de pelvis está en pendingStudies como requested', `pendingStudies: ${JSON.stringify(scenarioReal.pendingStudies)}`);
const hasLabRequested = scenarioReal.pendingStudies.some(s => s.study === 'Laboratorio de control' && s.status === 'requested');
assert(hasLabRequested, 'Caso N.11 - Laboratorio de control está en pendingStudies como requested', `pendingStudies: ${JSON.stringify(scenarioReal.pendingStudies)}`);

// N.12: lastImagingDate no inventa fechas para estudios pendientes
assert(scenarioReal.lastImagingDate === '10/02/2026', 'Caso N.12 - lastImagingDate es la fecha del último estudio realizado (10/02/2026)', `lastImagingDate: ${scenarioReal.lastImagingDate}`);

// N.13: activeScenarioRecommendations selecciona el escenario symptomaticReevaluation para el caso con dolor
assert(
  validationReal.activeScenarioRecommendations !== null &&
  validationReal.activeScenarioRecommendations !== undefined &&
  validationReal.activeScenarioRecommendations.scenarioTitle.includes('Reevaluación clínica dirigida por síntomas de alarma'),
  'Caso N.13 - activeScenarioRecommendations selecciona symptomaticReevaluation para paciente con dolor',
  `Escenario: ${validationReal.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  validationReal.activeScenarioRecommendations?.imaging.includes('Reevaluación clínica dirigida') === true,
  'Caso N.13 - imaging de symptomaticReevaluation indica reevaluación dirigida y no PET/TAC obligatorio cada 6 meses',
  `Imaging: ${validationReal.activeScenarioRecommendations?.imaging}`
);

// N.14: postTreatmentEvaluation se activa para paciente asintomática con evaluación basal pendiente
const textPostTx = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Cisplatino concurrente + Radioterapia VMAT finalizada 30/06/2026. Braquiterapia HDR finalizada 28/07/2026.
Asintomática.
Evaluación post-tratamiento pendiente. PET-CT de control pendiente.
`.trim();
const validationPostTx = validateCandidateSources(textPostTx, [], 'Carcinoma epidermoide de cérvix');
assert(
  validationPostTx.activeScenarioRecommendations?.scenarioTitle.includes('Evaluación de respuesta post-tratamiento definitivo') === true,
  'Caso N.14 - activeScenarioRecommendations selecciona postTreatmentEvaluation cuando asintomática con evaluación pendiente',
  `Escenario: ${validationPostTx.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  validationPostTx.activeScenarioRecommendations?.imaging.includes('no antes de 3 meses') === true,
  'Caso N.14 - imaging de postTreatmentEvaluation indica no antes de 3 meses post-tratamiento',
  `Imaging: ${validationPostTx.activeScenarioRecommendations?.imaging}`
);

// N.15: localizedSurveillance se activa para paciente asintomática con respuesta completa (NED)
const textSurveillance = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Quimiorradioterapia y braquiterapia finalizadas en 2025.
PET-CT de control basal: Remisión completa, sin evidencia de enfermedad activa (NED).
Actualmente asintomática, examen ginecológico normal.
`.trim();
const validationSurveillance = validateCandidateSources(textSurveillance, [], 'Carcinoma epidermoide de cérvix');
assert(
  validationSurveillance.activeScenarioRecommendations?.scenarioTitle.includes('Vigilancia rutinaria post-tratamiento curativo') === true,
  'Caso N.15 - activeScenarioRecommendations selecciona localizedSurveillance para paciente asintomática con NED',
  `Escenario: ${validationSurveillance.activeScenarioRecommendations?.scenarioTitle}`
);
assert(
  validationSurveillance.activeScenarioRecommendations?.imaging.includes('No se recomiendan estudios de imagen seriados rutinarios') === true,
  'Caso N.15 - imaging de localizedSurveillance no indica imágenes seriadas rutinarias',
  `Imaging: ${validationSurveillance.activeScenarioRecommendations?.imaging}`
);

// N.16: Invariantes de seguridad (dolor != progresión, IIIC2 != metastásico)
const textInvariants = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Quimiorradioterapia + Braquiterapia finalizada 28/07/2026.
Presenta dolor lumbar y dolor en miembros inferiores.
PET-CT pendiente de realización.
`.trim();
const profileInvariants = extractClinicalScenarioProfile(textInvariants, 'Carcinoma epidermoide de cérvix');
assert(profileInvariants.symptomFlag === true, 'Caso N.16 - dolor activa symptomFlag', `symptomFlag: ${profileInvariants.symptomFlag}`);
assert(profileInvariants.confirmedProgression === false, 'Caso N.16 - dolor NO genera confirmedProgression', `confirmedProgression: ${profileInvariants.confirmedProgression}`);
assert(profileInvariants.confirmedRecurrence === false, 'Caso N.16 - dolor NO genera confirmedRecurrence', `confirmedRecurrence: ${profileInvariants.confirmedRecurrence}`);
assert(profileInvariants.isStageIV === false, 'Caso N.16 - FIGO IIIC2 NO es isStageIV', `isStageIV: ${profileInvariants.isStageIV}`);
assert(profileInvariants.followUpMode === 'CURATIVE_SURVEILLANCE', 'Caso N.16 - FIGO IIIC2 mantiene CURATIVE_SURVEILLANCE', `followUpMode: ${profileInvariants.followUpMode}`);

console.log(`\n=== RESUMEN DE PRUEBAS: ${passed} PASARON, ${failed} FALLARON ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('¡TODAS LAS PRUEBAS COMPLETADAS SATISFACTORIAMENTE!');
}

