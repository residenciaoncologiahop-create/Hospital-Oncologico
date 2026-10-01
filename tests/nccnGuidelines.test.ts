import { describe, it, expect } from 'vitest';
import {
  extractPatientTumorProfile,
  extractClinicalScenarioProfile,
  validateCandidateSources,
  matchGuidelineByProfile,
  detectConfirmedProgression,
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
});

