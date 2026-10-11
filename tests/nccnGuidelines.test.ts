import { describe, it, expect } from 'vitest';
import {
  extractPatientTumorProfile,
  extractClinicalScenarioProfile,
  validateCandidateSources,
  matchGuidelineByProfile,
  detectConfirmedProgression,
  detectRelevantSymptoms,
  extractStageFromClinicalText,
} from '../src/utils/nccnGuidelines';

describe('Perfil Diagnóstico y Seguimiento Oncológico - NCCN Guidelines', () => {
  // TEST 1 — CÉRVIX + CARCINOMA EPIDERMOIDE
  it('TEST 1: detecta correctamente Cuello uterino y Carcinoma epidermoide sin estadio falso', () => {
    const text = 'Carcinoma epidermoide moderadamente diferenciado invasor de cérvix uterino.';
    const profile = extractPatientTumorProfile(text, '');

    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.histology).toBe('Carcinoma epidermoide de cérvix');
    expect(profile.stage).toBe('No documentado');
    expect(profile.histology).not.toContain('Mola');
    expect(profile.histology).not.toContain('Trofoblasto');
  });

  // TEST 2 — CÉRVIX NO GENERA "VIX"
  it('TEST 2: la palabra cérvix nunca genera el estadio "vix"', () => {
    const text = 'Carcinoma epidermoide de cérvix.';
    const profile = extractPatientTumorProfile(text, '');

    expect(profile.stage).not.toBe('vix');
    expect(profile.stage).not.toContain('vix');
    expect(profile.stage).toBe('No documentado');

    const stageDirect = extractStageFromClinicalText(text, '');
    expect(stageDirect).not.toBe('vix');
    expect(stageDirect).toBe('No documentado');
  });

  // TEST 3 — FIGO IIIC2
  it('TEST 3: reconoce correctamente el estadio FIGO IIIC2', () => {
    const text = 'Carcinoma epidermoide de cérvix FIGO IIIC2.';
    const profile = extractPatientTumorProfile(text, '');

    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.stage).toBe('FIGO IIIC2');
  });

  // TEST 4 — PALABRA "COMPLETA" NO DISPARA MOLA HIDATIFORME
  it('TEST 4: una frase con "completamente" no debe transformarse en Mola hidatiforme completa', () => {
    const text =
      'Paciente con carcinoma epidermoide de cérvix. Presenta dolor pélvico que no cede completamente con paracetamol.';
    const profile = extractPatientTumorProfile(text, '');

    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.histology).toBe('Carcinoma epidermoide de cérvix');
    expect(profile.histology).not.toBe('Mola hidatiforme completa');
    expect(profile.histology).not.toContain('Mola');
  });

  // TEST 5 — PRIORIDAD DE DIAGNÓSTICO EXPLÍCITO SOBRE MENCIÓN INCIDENTAL
  it('TEST 5: explicitDiagnosis tiene prioridad absoluta sobre menciones incidentales de mola', () => {
    const explicitDx = 'Carcinoma epidermoide moderadamente diferenciado invasor de cérvix uterino.';
    const clinicalText = 'Antecedente de embarazo molar / mola mencionada en antecedentes obstétricos antiguos.';

    const profile = extractPatientTumorProfile(clinicalText, explicitDx);

    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.histology).toBe('Carcinoma epidermoide de cérvix');
    expect(profile.histology).not.toContain('Mola');
  });

  // TEST 6 — CONTROL NEGATIVO: MOLA HIDATIFORME REAL
  it('TEST 6: un caso real de mola hidatiforme selecciona gestational-trophoblastic-neoplasia', () => {
    const explicitDx = 'Mola hidatiforme completa.';
    const profile = extractPatientTumorProfile('', explicitDx);

    expect(profile.organ).toBe('Trofoblasto gestacional (Útero)');
    expect(profile.histology).toBe('Mola hidatiforme completa');

    const match = matchGuidelineByProfile(profile);
    expect(match.status).toBe('EXACT_MATCH');
    expect(match.guideline?.id).toBe('gestational-trophoblastic-neoplasia');
  });

  // TEST 7 — SOSPECHA / NEGACIÓN: "DESCARTAR RECIDIVA" NO ES PROGRESIÓN CONFIRMADA
  it('TEST 7: "descartar recidiva" o sospecha en estudio no se clasifica como progresión confirmada', () => {
    const clinicalText = 'Carcinoma epidermoide de cérvix. Se solicita PET-CT para descartar recidiva.';
    const hasProgression = detectConfirmedProgression(clinicalText);

    expect(hasProgression).toBe(false);

    const profile = extractPatientTumorProfile(clinicalText, '');
    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.histology).toBe('Carcinoma epidermoide de cérvix');
  });

  // TEST 8 — CASO COMPLETO REAL
  it('TEST 8: caso clínico real de carcinoma de cérvix FIGO IIIC2 genera perfil correcto y guía cervical', () => {
    const explicitDiagnosis = 'Carcinoma Epidermoide Moderadamente Diferenciado Invasor de cérvix uterino.';
    const clinicalText = `
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

    const profile = extractPatientTumorProfile(clinicalText, explicitDiagnosis);

    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.histology).toBe('Carcinoma epidermoide de cérvix');
    expect(profile.histology).not.toBe('Mola hidatiforme completa');
    expect(profile.stage).toBe('FIGO IIIC2');
    expect(profile.stage).not.toBe('vix');

    const scenarioProfile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);
    expect(scenarioProfile.organ).toBe('Cuello uterino (Cérvix)');
    expect(scenarioProfile.histology).toBe('Carcinoma epidermoide de cérvix');
    expect(scenarioProfile.stage).toBe('FIGO IIIC2');
    expect(scenarioProfile.followUpMode).toBe('CURATIVE_SURVEILLANCE');
    expect(scenarioProfile.followUpMode).not.toBe('INDETERMINATE_STATUS');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.sourceMode).toBe('SYSTEM_NCCN');
    expect(validation.validSystemGuideline?.id).toBe('cervical-cancer');
    expect(validation.validSystemGuideline?.id).not.toBe('gestational-trophoblastic-neoplasia');
  });

  // -------------------------------------------------------------------------
  // ITERACIÓN 3 — TESTS OBLIGATORIOS DE ESTADO CLÍNICO
  // -------------------------------------------------------------------------

  // TEST 9 (ITER 3 - TEST 1): No describir cérvix definitivo no quirúrgico como "enfermedad resecada"
  it('TEST 9: paciente cervical post-tratamiento definitivo no quirúrgico NO se describe como "enfermedad resecada"', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Cisplatino concurrente + Radioterapia VMAT finalizada 30/06/2026. Braquiterapia HDR finalizada 28/07/2026.
Evaluación post-tratamiento pendiente.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');

    expect(profile.diseaseStatusDescription).not.toContain('resecada');
    expect(profile.diseaseStatusDescription).not.toContain('quirúrgic');
    expect(profile.diseaseStatusDescription).toContain('Tratamiento definitivo');
    expect(profile.diseaseStatusDescription).toContain('evaluación post-tratamiento');
  });

  // TEST 10 (ITER 3 - TEST 2): lastTreatmentDate captura la finalización del tratamiento definitivo (Braquiterapia 28/07/2026)
  it('TEST 10: lastTreatmentDate captura la finalización completa del tratamiento definitivo (28/07/2026)', () => {
    const clinicalText = `
Tratamiento:
- Quimioterapia de inducción Carboplatino/Paclitaxel: finalizada 06/05/2026.
- Radioterapia externa VMAT: finalizada 30/06/2026.
- Braquiterapia HDR: finalizada 28/07/2026.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');

    expect(profile.lastTreatmentDate).toBe('28/07/2026');
    expect(profile.lastTreatmentDate).not.toBe('06/05/2026');
  });

  // TEST 11 (ITER 3 - TEST 3): Dolor pélvico activa symptomFlag pero NO confirmedRecurrence ni confirmedProgression
  it('TEST 11: dolor pélvico activa symptomFlag pero NO confirmedRecurrence ni confirmedProgression', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix. Tratamiento completado.
Actualmente refiere dolor a nivel de pelvis y miembros inferiores. Niega genitorragia.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');

    expect(profile.symptomFlag).toBe(true);
    expect(profile.relevantSymptoms).toContain('Dolor pélvico');
    expect(profile.relevantSymptoms).toContain('Dolor en miembros inferiores');
    expect(profile.relevantSymptoms).not.toContain('Genitorragia / Sangrado vaginal');

    expect(profile.confirmedRecurrence).toBe(false);
    expect(profile.confirmedProgression).toBe(false);
    expect(profile.followUpState).toBe('SYMPTOMATIC_REEVALUATION');
  });

  // TEST 12 (ITER 3 - TEST 4): "se solicita PET-CT para control" / "PET-CT pendiente" lo clasifica como pendiente/solicitado y NO realizado
  it('TEST 12: "se solicita PET-CT para control" clasifica PET-CT como pendiente/solicitado y no como realizado', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix. PET-CT de control pendiente.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');

    const petStudy = profile.pendingStudies.find(s => s.study === 'PET-CT');
    expect(petStudy).toBeDefined();
    expect(petStudy?.status).toBe('pending');
    expect(profile.lastImagingDate).toBe('No documentada');
  });

  // TEST 13 (ITER 3 - TEST 5): "RMN de pelvis solicitada" se detecta en pendingStudies y no inventa fecha en lastImagingDate
  it('TEST 13: "RMN de pelvis solicitada" se detecta en pendingStudies y no inventa fecha en lastImagingDate', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix. Tratamiento completado. Solicitar RMN de pelvis y laboratorio de control.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');

    const rmnStudy = profile.pendingStudies.find(s => s.study === 'RMN de pelvis');
    expect(rmnStudy).toBeDefined();
    expect(rmnStudy?.status).toBe('requested');

    const labStudy = profile.pendingStudies.find(s => s.study === 'Laboratorio de control');
    expect(labStudy).toBeDefined();
    expect(labStudy?.status).toBe('requested');

    expect(profile.lastImagingDate).toBe('No documentada');
  });

  // TEST 14 (ITER 3 - TEST 6): Caso completo real integra todas las dimensiones del estado clínico
  it('TEST 14: caso completo real integra organ, histología, estadio, fin de tratamiento, síntomas y estudios pendientes', () => {
    const explicitDiagnosis = 'Carcinoma Epidermoide Moderadamente Diferenciado Invasor de cérvix uterino.';
    const clinicalText = `
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

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);

    // Identificación oncológica
    expect(profile.organ).toBe('Cuello uterino (Cérvix)');
    expect(profile.histology).toBe('Carcinoma epidermoide de cérvix');
    expect(profile.stage).toBe('FIGO IIIC2');

    // Tratamiento y fechas
    expect(profile.lastTreatmentDate).toBe('28/07/2026');
    expect(profile.lastImagingDate).toBe('10/02/2026'); // Último estudio realizado histórico

    // Estado clínico
    expect(profile.diseaseStatusDescription).not.toContain('resecada');
    expect(profile.diseaseStatusDescription).toContain('Tratamiento definitivo');
    expect(profile.diseaseStatusDescription).toContain('evaluación post-tratamiento');
    expect(profile.confirmedRecurrence).toBe(false);
    expect(profile.confirmedProgression).toBe(false);

    // Síntomas y Reevaluación
    expect(profile.symptomFlag).toBe(true);
    expect(profile.relevantSymptoms).toContain('Dolor pélvico');
    expect(profile.relevantSymptoms).toContain('Dolor en miembros inferiores');
    expect(profile.followUpState).toBe('SYMPTOMATIC_REEVALUATION');

    // Estudios pendientes
    expect(profile.pendingStudies.some(s => s.study === 'PET-CT')).toBe(true);
    expect(profile.pendingStudies.some(s => s.study === 'RMN de pelvis')).toBe(true);
    expect(profile.pendingStudies.some(s => s.study === 'Laboratorio de control')).toBe(true);

    // Validación
    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('cervical-cancer');
    expect(validation.activeScenarioRecommendations).toBeDefined();
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Reevaluación clínica dirigida por síntomas de alarma');
    expect(validation.activeScenarioRecommendations?.imaging).toContain('Reevaluación clínica dirigida');
    expect(validation.activeScenarioRecommendations?.imaging).not.toContain('cada 6 meses en los primeros 2 años');
  });

  // TEST 15: Escenario postTreatmentEvaluation cuando la paciente no tiene síntomas pero la evaluación basal está pendiente
  it('TEST 15: caso de cérvix post-tratamiento asintomático con control pendiente asigna postTreatmentEvaluation', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Cisplatino concurrente + Radioterapia VMAT finalizada 30/06/2026. Braquiterapia HDR finalizada 28/07/2026.
Asintomática. Buen estado general.
Evaluación post-tratamiento pendiente. PET-CT de control pendiente.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');
    expect(profile.followUpState).toBe('POST_TREATMENT_EVALUATION');
    expect(profile.symptomFlag).toBe(false);

    const validation = validateCandidateSources(clinicalText, [], 'Carcinoma epidermoide de cérvix');
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('cervical-cancer');
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Evaluación de respuesta post-tratamiento definitivo');
    expect(validation.activeScenarioRecommendations?.imaging).toContain('no antes de 3 meses');
    expect(validation.activeScenarioRecommendations?.specialRules).toContain('dilatadores vaginales');
    expect(validation.activeScenarioRecommendations?.specialRules).toContain('no realizar biopsia de rutina');
  });

  // TEST 16: Escenario localizedSurveillance cuando la paciente tiene respuesta completa confirmada (NED) y está asintomática
  it('TEST 16: caso de cérvix con respuesta completa documentada y asintomática asigna localizedSurveillance', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Quimiorradioterapia y braquiterapia finalizadas en 2025.
PET-CT de control basal: Remisión completa, sin evidencia de enfermedad activa (NED).
Actualmente asintomática, examen ginecológico normal.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');
    expect(profile.followUpState).toBe('ROUTINE_SURVEILLANCE');
    expect(profile.diseaseStatus).toBe('NED');

    const validation = validateCandidateSources(clinicalText, [], 'Carcinoma epidermoide de cérvix');
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('cervical-cancer');
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Vigilancia rutinaria post-tratamiento curativo');
    expect(validation.activeScenarioRecommendations?.imaging).toContain('No se recomiendan estudios de imagen seriados rutinarios');
    expect(validation.activeScenarioRecommendations?.schedule).toContain('cada 3–6 meses');
  });

  // TEST 17: Verificación estricta de invariantes de seguridad (dolor != progresión, IIIC2 != metastásico)
  it('TEST 17: invariantes de seguridad clínica se cumplen estrictamente en cérvix', () => {
    const clinicalText = `
Carcinoma epidermoide de cérvix FIGO IIIC2.
Tratamiento: Quimiorradioterapia + Braquiterapia finalizada 28/07/2026.
Presenta dolor lumbar y dolor en miembros inferiores.
PET-CT pendiente de realización.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, 'Carcinoma epidermoide de cérvix');

    // Dolor != progresión confirmada
    expect(profile.symptomFlag).toBe(true);
    expect(profile.confirmedProgression).toBe(false);
    expect(profile.confirmedRecurrence).toBe(false);

    // IIIC2 != enfermedad metastásica activa
    expect(profile.isStageIV).toBe(false);
    expect(profile.followUpMode).toBe('CURATIVE_SURVEILLANCE');
    expect(profile.followUpMode).not.toBe('ACTIVE_METASTATIC_MONITORING');

    // PET pendiente != PET realizado
    expect(profile.pendingStudies.some(s => s.study === 'PET-CT' && s.status === 'pending')).toBe(true);
    expect(profile.lastImagingDate).toBe('No documentada');
  });

  // -------------------------------------------------------------------------
  // ITERACIÓN 4 — TESTS OBLIGATORIOS DE CÁNCER DE ENDOMETRIO Y ESTADIO NO DOCUMENTADO
  // -------------------------------------------------------------------------

  // TEST 18: Identificación de cáncer de endometrio y guía endometrial-cancer
  it('TEST 18: identifica correctamente Endometrio / Útero, Adenocarcinoma endometrioide y guía endometrial-cancer', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide de endometrio.';
    const clinicalText = 'Paciente en seguimiento oncológico post-histerectomía total con doble anexectomía.';

    const profile = extractPatientTumorProfile(clinicalText, explicitDiagnosis);
    expect(profile.organ).toBe('Endometrio / Útero');
    expect(profile.histology).toBe('Adenocarcinoma endometrioide');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('endometrial-cancer');
    expect(validation.validSystemGuideline?.source).toBe('NCCN Uterine Neoplasms v1.2024');
    expect(validation.activeScenarioRecommendations).toBeDefined();
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Seguimiento rutinario');
    expect(validation.activeScenarioRecommendations?.schedule).toContain('espéculo para evaluar cúpula vaginal');
  });

  // TEST 19: Estadio no documentado con seguimiento post-tratamiento NO se clasifica como "enfermedad localizada"
  it('TEST 19: estadio no documentado con tratamiento/seguimiento documentado no asume falsamente "enfermedad localizada"', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide.';
    const clinicalText = 'Sin tratamiento sistémico activo. Actualmente en controles oncológicos periódicos.';

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);

    expect(profile.stage).toBe('No documentado');
    expect(profile.followUpMode).toBe('CURATIVE_SURVEILLANCE');
    expect(profile.modeLabel).toBe('Modo A — Seguimiento post-tratamiento primario (Estadio no documentado)');
    expect(profile.modeLabel).not.toContain('Enfermedad localizada');
    expect(profile.diseaseStatusDescription).toContain('estadio inicial no documentado');
    expect(profile.diseaseStatusDescription).not.toContain('Enfermedad localizada resecada');
    expect(profile.treatmentIntent).toContain('precisar estadio inicial');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.activeScenarioRecommendations).toBeDefined();
    expect(validation.activeScenarioRecommendations?.schedule).toContain('cada 3–6 meses');
  });

  // TEST 20: Caso con estadio y antecedentes de tratamiento no documentados bloquea con INDETERMINATE_STATUS
  it('TEST 20: ausencia simultánea de estadio y antecedentes de tratamiento no infiere vigilancia y bloquea con INDETERMINATE_STATUS', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide.';
    const clinicalText = ''; // Sin texto clínico, sin cirugía, sin mención de tratamiento ni seguimiento

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);

    expect(profile.stage).toBe('No documentado');
    expect(profile.followUpMode).toBe('INDETERMINATE_STATUS');
    expect(profile.modeLabel).toContain('Situación clínica insuficientemente documentada');
    expect(profile.diseaseStatus).toBe('INDETERMINATE');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(false);
    expect(validation.stopReason).toBe('INDETERMINATE_STATUS');
    expect(validation.stopTitle).toBe('Estado de Enfermedad Indeterminado');
    expect(validation.stopMessage).toBeDefined();
  });

  // TEST 21: Sangrado vaginal / metrorragia activa SYMPTOMATIC_REEVALUATION y no es progresión confirmada
  it('TEST 21: síntoma de alarma (sangrado vaginal) en endometrio activa reevaluación sintomática sin declarar progresión', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide de endometrio estadio IA.';
    const clinicalText = `
Anexohisterectomía total bilateral realizada en 2025.
Actualmente consulta por metrorragia / sangrado vaginal escaso intermitente.
Niega dolor abdominal ni síntomas urinarios.
Se solicita examen con espéculo de cúpula vaginal y ecografía/RMN de pelvis.
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);

    expect(profile.symptomFlag).toBe(true);
    expect(profile.relevantSymptoms).toContain('Genitorragia / Sangrado vaginal');
    expect(profile.confirmedProgression).toBe(false);
    expect(profile.confirmedRecurrence).toBe(false);
    expect(profile.followUpState).toBe('SYMPTOMATIC_REEVALUATION');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('endometrial-cancer');
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Reevaluación clínica dirigida por síntomas de alarma');
    expect(validation.activeScenarioRecommendations?.imaging).toContain('RMN de pelvis con contraste');
    expect(validation.activeScenarioRecommendations?.specialRules).toContain('confirmación histológica mediante biopsia');
  });

  // TEST 22: Asintomática con respuesta completa (NED) recibe vigilancia rutinaria estructurada
  it('TEST 22: paciente con adenocarcinoma endometrioide estadio IA tratada y asintomática recibe recomendaciones de vigilancia rutinaria', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide estadio IA.';
    const clinicalText = `
Tratamiento quirúrgico: Anexohisterectomía total completada. Margen libre.
Examen clínico y ginecológico normal: cúpula vaginal sana, sin lesiones.
Asintomática, sin evidencia de enfermedad (NED).
    `.trim();

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);

    expect(profile.followUpMode).toBe('CURATIVE_SURVEILLANCE');
    expect(profile.followUpState).toBe('ROUTINE_SURVEILLANCE');
    expect(profile.diseaseStatus).toBe('NED');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.activeScenarioRecommendations).toBeDefined();
    expect(validation.activeScenarioRecommendations?.imaging).toContain('NO se recomiendan de rutina en estadios iniciales (estadio I) asintomáticos');
    expect(validation.activeScenarioRecommendations?.labs).toContain('CA-125');
    expect(validation.activeScenarioRecommendations?.specialRules).toContain('síndrome de Lynch');
  });

  // TEST 23: Fallback de compatibilidad: si una guía carece de bloque scenarios, no pierde sus recomendaciones documentadas
  it('TEST 23: compatibilidad garantizada: si una guía no tiene bloque scenarios, validateCandidateSources no descarta las recomendaciones de nivel superior', () => {
    // Probamos con melanoma cutáneo que solo tiene campos de nivel superior
    const explicitDiagnosis = 'Melanoma cutáneo estadio IA.';
    const clinicalText = 'Resección completa con ampliación de márgenes. Sin tratamiento sistémico activo, en seguimiento.';

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('cutaneous-melanoma');
    expect(validation.activeScenarioRecommendations).toBeDefined();
    expect(validation.activeScenarioRecommendations?.schedule).toContain('examen cutáneo');
    expect(validation.activeScenarioRecommendations?.imaging).toContain('NO recomendadas');
  });

  // TEST 24: Endometrio recurrente o metastásico en tratamiento activo asigna activeMetastatic
  it('TEST 24: adenocarcinoma endometrioide metastásico activo asigna activeMetastatic (Modo B)', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide estadio IV con metástasis pulmonares.';
    const clinicalText = 'Actualmente recibe carboplatino y paclitaxel en curso. En tratamiento activo.';

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);
    expect(profile.isStageIV).toBe(true);
    expect(profile.followUpMode).toBe('ACTIVE_METASTATIC_MONITORING');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Enfermedad recurrente');
    expect(validation.activeScenarioRecommendations?.imaging).toContain('cada 2 a 3 meses');
  });

  // TEST 25: Guía sin subescenarios en escenario incompatible (ej. estadio IV activo) no extrapola vigilancia rutinaria
  it('TEST 25: guía sin subescenarios en escenario incompatible (metástasis activa) no vuelca cronograma de vigilancia y declara escenario no determinado', () => {
    const explicitDiagnosis = 'Melanoma cutáneo estadio IV con metástasis pulmonares y hepáticas.';
    const clinicalText = 'En tratamiento activo con inmunoterapia nivolumab/ipilimumab.';

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);
    expect(profile.isStageIV).toBe(true);
    expect(profile.followUpMode).toBe('ACTIVE_METASTATIC_MONITORING');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.id).toBe('cutaneous-melanoma');
    expect(validation.activeScenarioRecommendations).toBeDefined();
    // No debe volcar el cronograma de estadios 0-IA / II-IV NED de vigilancia rutinaria
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('no determinado');
    expect(validation.activeScenarioRecommendations?.schedule).toContain('No determinado en la guía para este escenario');
    expect(validation.activeScenarioRecommendations?.specialRules).toContain('Prohibido aplicar cronogramas rutinarios de vigilancia');
    // Conserva fuente y versión
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain(validation.validSystemGuideline?.source || 'NCCN');
  });

  // TEST 26: Tratamiento finalizado sin respuesta documentada no asume automáticamente NED ni vigilancia rutinaria
  it('TEST 26: tratamiento finalizado sin evaluación formal de respuesta no asume automáticamente NED ni vigilancia rutinaria', () => {
    const explicitDiagnosis = 'Carcinoma epidermoide de cérvix FIGO IIIC2.';
    const clinicalText = 'Tratamiento con quimiorradioterapia completado el mes pasado. No se registran estudios por imágenes posteriores ni constancia de remisión.';

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);
    // NO debe asumir remisión completa / NED si no hay evaluación objetiva documentada
    expect(profile.diseaseStatus).not.toBe('NED');
    expect(profile.followUpState).toBe('POST_TREATMENT_EVALUATION');
    expect(profile.modeLabel).toContain('Evaluación de respuesta');
    expect(profile.diseaseStatusDescription).toContain('evaluación formal de respuesta');
  });

  // TEST 27: Sospecha clínica por síntomas de alarma sin confirmación de recurrencia
  it('TEST 27: sospecha clínica por síntomas de alarma activa reevaluación dirigida sin marcar progresión confirmada', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide de endometrio.';
    const clinicalText = 'Paciente tratada con cirugía y radioterapia adyuvante. Consulta por dolor pélvico persistente y flujo vaginal anormal. Niega lesiones visibles a la inspección.';

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);
    expect(profile.symptomFlag).toBe(true);
    expect(profile.confirmedProgression).toBe(false);
    expect(profile.confirmedRecurrence).toBe(false);
    expect(profile.followUpState).toBe('SYMPTOMATIC_REEVALUATION');

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Reevaluación clínica dirigida');
  });

  // TEST 28: Regla de biopsia contempla factibilidad técnica, seguridad clínica y urgencias
  it('TEST 28: regla de confirmación histológica contempla factibilidad, seguridad clínica y no demorar urgencias', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide.';
    const clinicalText = 'Anexohisterectomía realizada. Sospecha de recidiva locorregional en cúpula vaginal por sangrado vaginal.';

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    const specialRules = validation.activeScenarioRecommendations?.specialRules || '';
    expect(specialRules).toContain('técnicamente factible');
    expect(specialRules).toContain('clínicamente seguro');
    expect(specialRules).toContain('sin demorar');
    expect(specialRules).toContain('urgencias');
  });

  // TEST 29: Conservación estricta de fuente y versión sin inventar datos no verificados
  it('TEST 29: todas las recomendaciones de seguimiento conservan la fuente oficial y versión declarada en la guía', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide estadio IA.';
    const clinicalText = 'Anexohisterectomía total realizada, asintomática, controles normales (NED).';

    const validation = validateCandidateSources(clinicalText, [], explicitDiagnosis);
    expect(validation.canProceed).toBe(true);
    expect(validation.validSystemGuideline?.source).toBe('NCCN Uterine Neoplasms v1.2024');
    expect(validation.validSystemGuideline?.version).toBe('v1.2024');
    expect(validation.validSystemGuideline?.organization).toBe('NCCN');
    // El texto del escenario incluye mención a la fuente oficial
    expect(validation.validSystemGuideline?.scenarios?.localizedSurveillance.specialRules).toBeDefined();
  });

  // TEST 30: Ausencia de estadio sin asumir enfermedad localizada ni remisión completa infundada
  it('TEST 30: ausencia de estadio no asume enfermedad localizada ni remisión completa por defecto', () => {
    const explicitDiagnosis = 'Adenocarcinoma endometrioide.';
    const clinicalText = 'Tratamiento completado previamente en otra institución. Sin datos de estadio patológico ni evaluación de respuesta.';

    const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);
    expect(profile.stage).toBe('No documentado');
    expect(profile.modeLabel).not.toContain('Enfermedad localizada');
    expect(profile.diseaseStatus).not.toBe('NED');
    expect(profile.diseaseStatusDescription).not.toContain('Enfermedad localizada resecada');
    expect(profile.treatmentIntent).toContain('precisión de estadio inicial');
  });

  // TEST 31: Antecedente de recidiva en 2024, tratado, actualmente asintomática: no marcar progresión actual
  it('TEST 31: antecedente de recidiva en 2024 tratado no marca progresión actual', () => {
    const text = 'Antecedente de recidiva en 2024, tratado, actualmente asintomática.';
    expect(detectConfirmedProgression(text)).toBe(false);

    const profile = extractClinicalScenarioProfile(text, 'Adenocarcinoma endometrioide');
    expect(profile.confirmedProgression).toBe(false);
    expect(profile.confirmedRecurrence).toBe(false);
    expect(profile.followUpMode).toBe('CURATIVE_SURVEILLANCE');
    expect(profile.diseaseStatus).toBe('INDETERMINATE');
  });

  // TEST 32: Sospecha actual de recidiva: activar reevaluación sintomática sin confirmar recurrencia
  it('TEST 32: sospecha actual de recidiva activa reevaluación sintomática sin confirmar recurrencia', () => {
    const text = 'Paciente con adenocarcinoma endometrioide. Sospecha actual de recidiva.';
    expect(detectConfirmedProgression(text)).toBe(false);

    const profile = extractClinicalScenarioProfile(text, 'Adenocarcinoma endometrioide');
    expect(profile.confirmedProgression).toBe(false);
    expect(profile.confirmedRecurrence).toBe(false);
    expect(profile.symptomFlag).toBe(true);
    expect(profile.followUpState).toBe('SYMPTOMATIC_REEVALUATION');

    const validation = validateCandidateSources(text, [], 'Adenocarcinoma endometrioide');
    expect(validation.activeScenarioRecommendations?.scenarioTitle).toContain('Reevaluación clínica dirigida');
  });

  // TEST 33: Recurrencia actual explícitamente confirmada: conservar detección correspondiente
  it('TEST 33: recurrencia actual explícitamente confirmada conserva la detección de progresión', () => {
    const text = 'Recurrencia actual explícitamente confirmada por biopsia y tomografía.';
    expect(detectConfirmedProgression(text)).toBe(true);

    const profile = extractClinicalScenarioProfile(text, 'Adenocarcinoma endometrioide');
    expect(profile.confirmedProgression).toBe(true);
    expect(profile.diseaseStatus).toBe('PROGRESSION');
    expect(profile.followUpMode).toBe('ACTIVE_METASTATIC_MONITORING');
  });

  // TEST 34: Sangrado de cúpula, sangrado genital y sangrado postcoital detectan el síntoma
  it('TEST 34: detecta sangrado de cúpula, sangrado genital y sangrado postcoital', () => {
    const s1 = detectRelevantSymptoms('Paciente presenta sangrado de cúpula.');
    expect(s1.symptomFlag).toBe(true);
    expect(s1.relevantSymptoms).toContain('Genitorragia / Sangrado vaginal');

    const s2 = detectRelevantSymptoms('Refiere sangrado genital intermitente.');
    expect(s2.symptomFlag).toBe(true);
    expect(s2.relevantSymptoms).toContain('Genitorragia / Sangrado vaginal');

    const s3 = detectRelevantSymptoms('Presenta sangrado postcoital tras relaciones.');
    expect(s3.symptomFlag).toBe(true);
    expect(s3.relevantSymptoms).toContain('Genitorragia / Sangrado vaginal');
  });

  // TEST 35: «Sin sangrado» y «niega sangrado vaginal» evitan falsos positivos
  it('TEST 35: "sin sangrado" y "niega sangrado vaginal" evitan falsos positivos', () => {
    const s1 = detectRelevantSymptoms('Examen ginecológico normal, sin sangrado.');
    expect(s1.symptomFlag).toBe(false);
    expect(s1.relevantSymptoms).toHaveLength(0);

    const s2 = detectRelevantSymptoms('Actualmente niega sangrado vaginal.');
    expect(s2.symptomFlag).toBe(false);
    expect(s2.relevantSymptoms).toHaveLength(0);

    const s3 = detectRelevantSymptoms('Niega sangrado postcoital ni sangrado de cúpula.');
    expect(s3.symptomFlag).toBe(false);
    expect(s3.relevantSymptoms).toHaveLength(0);
  });
});

