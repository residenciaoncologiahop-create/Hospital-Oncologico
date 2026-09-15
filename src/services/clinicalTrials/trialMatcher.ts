import { 
  ClinicalTrial, 
  PatientClinicalProfile, 
  TrialMatchResult, 
  MatchCategory, 
  PatientMatchingEvaluation, 
  DoctorMatchingSummary 
} from '../../types/clinicalTrials';
import { extractPatientClinicalProfile } from './patientProfileExtractor';

export const ORGAN_LABELS: Record<string, string> = {
  mama: 'Cáncer de Mama',
  pulmon: 'Cáncer de Pulmón (NSCLC / SCLC)',
  colorrectal: 'Cáncer Colorrectal',
  melanoma: 'Melanoma',
  prostata: 'Cáncer de Próstata',
  pancreas: 'Cáncer de Páncreas',
  ovario: 'Cáncer de Ovario',
  gastrico: 'Cáncer Gástrico / Esofágico',
  rinon: 'Cáncer Renal',
  vejiga: 'Cáncer de Vejiga / Urotelial',
  cervicouterino: 'Cáncer Cervicouterino / Endometrio',
  cabeza_cuello: 'Cáncer de Cabeza y Cuello',
  hematologia: 'Neoplasia Hematológica',
  snc: 'Tumor de Sistema Nervioso Central',
  biliar: 'Cáncer de Vía Biliar / Colangiocarcinoma',
  sarcoma: 'Sarcoma / GIST',
  solido_agnostico: 'Tumores Sólidos Avanzados'
};

const REQUIRED_NOTICE = 'Paciente potencialmente elegible. Requiere verificación de criterios por el equipo investigador.';

/**
 * Evalúa la compatibilidad clínica determinística entre un perfil de paciente y un ensayo
 */
export function evaluateTrialMatch(
  patient: PatientClinicalProfile, 
  trial: ClinicalTrial
): TrialMatchResult {
  const matches: string[] = [];
  const missingData: string[] = [];
  const incompatibilities: string[] = [];

  // 1. EVALUACIÓN ESTRICTA DE TUMOR PRIMARIO / SITIO
  if (!patient.organOrSite) {
    incompatibilities.push('No se pudo identificar con certeza el tumor primario del paciente a partir de la información documentada.');
    return {
      trial,
      category: 'not_compatible',
      categoryLabel: 'Probablemente no compatible',
      categoryBadge: '🔴 Probablemente no compatible',
      score: -100,
      matches,
      missingData,
      incompatibilities,
      requiredVerificationNotice: REQUIRED_NOTICE
    };
  }

  const patientOrganLabel = ORGAN_LABELS[patient.organOrSite] || patient.organOrSite;
  const trialHasPatientOrgan = trial.tumorTypes.includes(patient.organOrSite);
  const trialIsSolidTumorBasket = trial.tumorTypes.includes('solido_agnostico');

  // Si el ensayo no incluye el órgano del paciente ni es una canasta agnóstica de tumores sólidos: INCOMPATIBLE
  if (!trialHasPatientOrgan && !trialIsSolidTumorBasket) {
    const trialOrgansLabels = trial.tumorTypes.map(t => ORGAN_LABELS[t] || t).join(', ') || 'otra patología específica';
    incompatibilities.push(
      `Sitio tumoral primario no concordante: el paciente presenta diagnóstico de ${patientOrganLabel}, mientras que el ensayo evalúa ${trialOrgansLabels}.`
    );
    return {
      trial,
      category: 'not_compatible',
      categoryLabel: 'Probablemente no compatible',
      categoryBadge: '🔴 Probablemente no compatible',
      score: -100,
      matches,
      missingData,
      incompatibilities,
      requiredVerificationNotice: REQUIRED_NOTICE
    };
  }

  // Coincidencia estricta de diagnóstico primario
  matches.push(`Diagnóstico y localización tumoral concordante (${patientOrganLabel}) ✓`);

  // 2. EDAD
  if (typeof patient.age === 'number') {
    if (trial.minimumAgeYears && patient.age < trial.minimumAgeYears) {
      incompatibilities.push(`Edad del paciente (${patient.age} años) inferior al mínimo requerido (${trial.minimumAgeYears} años).`);
    } else if (trial.maximumAgeYears && patient.age > trial.maximumAgeYears) {
      incompatibilities.push(`Edad del paciente (${patient.age} años) superior al máximo admitido (${trial.maximumAgeYears} años).`);
    } else {
      matches.push(`Edad (${patient.age} años) dentro del rango elegible ✓`);
    }
  } else {
    missingData.push('Edad del paciente [No documentada en registro]');
  }

  // 3. SEXO
  if (patient.sex) {
    if (trial.sex === 'FEMALE' && patient.sex !== 'FEMALE') {
      incompatibilities.push('Protocolo exclusivo para pacientes de sexo femenino.');
    } else if (trial.sex === 'MALE' && patient.sex !== 'MALE') {
      incompatibilities.push('Protocolo exclusivo para pacientes de sexo masculino.');
    } else {
      matches.push(`Sexo compatible con el protocolo (${patient.sex === 'MALE' ? 'Masculino' : 'Femenino'}) ✓`);
    }
  }

  // 4. ESTADIO / ENFERMEDAD METASTÁSICA
  const trialIsMetastatic = trial.isMetastaticEligible;
  if (trialIsMetastatic) {
    if (patient.isMetastaticDocumented) {
      matches.push('Enfermedad avanzada / metastásica documentada coincidente con el objetivo del ensayo ✓');
    } else if (patient.stageDocumented && (patient.stageDocumented.includes('IA') || patient.stageDocumented.includes('IB') || patient.stageDocumented.includes('I '))) {
      incompatibilities.push(`El protocolo evalúa enfermedad avanzada/metastásica y el paciente tiene registrado estadio temprano (${patient.stageDocumented}).`);
    } else {
      missingData.push('Extensión de enfermedad / confirmación metastásica para este protocolo [No documentado]');
    }
  }

  if (patient.stageDocumented) {
    matches.push(`Estadio clínico documentado: ${patient.stageDocumented} ✓`);
  } else {
    missingData.push('Estadio clínico [No documentado explícitamente]');
  }

  // 5. EVALUACIÓN DE BIOMARCADORES
  const trialText = `${trial.title} ${trial.conditions.join(' ')} ${trial.eligibilityCriteria}`.toUpperCase();

  for (const pBio of patient.biomarkersDocumented) {
    const bName = pBio.name.toUpperCase();
    const bStatus = pBio.status.toLowerCase();

    // Comprobar si el ensayo menciona este biomarcador
    if (trialText.includes(bName)) {
      // Caso BRAF
      if (bName === 'BRAF') {
        if (trialText.includes('BRAF V600') || trialText.includes('BRAF MUT')) {
          if (bStatus.includes('wt') || bStatus.includes('wild') || bStatus.includes('no mutado')) {
            incompatibilities.push('El estudio requiere mutación BRAF V600 y el paciente presenta BRAF Wild-Type / no mutado.');
          } else if (bStatus.includes('mutado')) {
            matches.push('Biomarcador BRAF mutado concordante con el protocolo ✓');
          }
        } else if (trialText.includes('BRAF WT') || trialText.includes('BRAF WILD')) {
          if (bStatus.includes('mutado')) {
            incompatibilities.push('El estudio requiere BRAF Wild-Type y el paciente presenta mutación.');
          } else {
            matches.push('Biomarcador BRAF Wild-Type concordante ✓');
          }
        }
      }
      // Caso EGFR
      else if (bName === 'EGFR') {
        if (trialText.includes('EGFR MUT') || trialText.includes('EXON 19') || trialText.includes('L858R')) {
          if (bStatus.includes('exón 19') || bStatus.includes('exon 19') || bStatus.includes('l858r') || bStatus.includes('mutado')) {
            matches.push(`Biomarcador EGFR concordante (${pBio.status}) ✓`);
          } else if (bStatus.includes('wt') || bStatus.includes('wild')) {
            incompatibilities.push('El estudio requiere mutación sensibilizante de EGFR y el paciente es Wild-Type.');
          }
        }
      }
      // Caso KRAS
      else if (bName === 'KRAS') {
        if (trialText.includes('KRAS G12C') && !bStatus.includes('g12c')) {
          missingData.push('Subtipo específico de mutación KRAS (requiere G12C) [Verificar informe molecular]');
        } else if (trialText.includes('KRAS MUT') && bStatus.includes('mutado')) {
          matches.push(`Biomarcador KRAS mutado concordante (${pBio.status}) ✓`);
        }
      }
      // Caso HER2
      else if (bName === 'HER2') {
        if ((trialText.includes('HER2 POSITIVE') || trialText.includes('HER2-POSITIVE') || trialText.includes('HER2+')) && bStatus.includes('positivo')) {
          matches.push('Biomarcador HER2 positivo concordante ✓');
        } else if ((trialText.includes('HER2 POSITIVE') || trialText.includes('HER2-POSITIVE')) && bStatus.includes('negativo')) {
          incompatibilities.push('El ensayo requiere sobreexpresión de HER2 y el paciente es HER2 negativo.');
        } else if (trialText.includes('HER2 NEGATIVE') && bStatus.includes('negativo')) {
          matches.push('Biomarcador HER2 negativo concordante ✓');
        }
      }
      // Caso MSI / MMR
      else if (bName.includes('MSI')) {
        if (trialText.includes('MSI-H') || trialText.includes('DMMR')) {
          if (bStatus.includes('msi-h') || bStatus.includes('dmmr')) {
            matches.push('Estado MSI-H / dMMR concordante ✓');
          } else if (bStatus.includes('mss') || bStatus.includes('pmmr')) {
            incompatibilities.push('El ensayo requiere inestabilidad de microsatélites (MSI-H/dMMR) y el paciente es MSS/pMMR.');
          }
        }
      }
    }
  }

  // Si el ensayo requiere biomarcadores que el paciente no tiene documentados
  for (const tBio of trial.biomarkers) {
    const hasDoc = patient.biomarkersDocumented.some(b => b.name.toUpperCase().includes(tBio) || tBio.includes(b.name.toUpperCase()));
    if (!hasDoc) {
      // Solo advertir si el biomarcador está fuertemente mencionado en el título o criterios principales
      if (trial.title.toUpperCase().includes(tBio)) {
        missingData.push(`Estado del biomarcador ${tBio} requerido por el protocolo [No documentado]`);
      }
    }
  }

  // 6. ECOG
  if (typeof patient.ecogDocumented === 'number') {
    if (patient.ecogDocumented <= 2) {
      matches.push(`Performance Status ECOG ${patient.ecogDocumented} adecuado para inclusión habitual ✓`);
    } else {
      incompatibilities.push(`ECOG ${patient.ecogDocumented} habitualmente excluyente en ensayos de intervención.`);
    }
  } else {
    missingData.push('Performance Status ECOG [No documentado explícitamente]');
  }

  // 7. LABORATORIO
  if (patient.labsDocumented.creatinine !== undefined && patient.labsDocumented.totalBilirubin !== undefined) {
    matches.push('Perfil de laboratorio renal y hepático documentado ✓');
  } else {
    missingData.push('Laboratorios de función orgánica requeridos por protocolo [No documentados]');
  }

  // 8. LÍNEA DE TRATAMIENTO
  if (patient.linesDocumented.length > 0) {
    matches.push(`Líneas previas documentadas (${patient.linesDocumented.length} registradas) ✓`);
  } else {
    missingData.push('Historial de líneas previas [No documentado explícitamente]');
  }

  // 9. CLASIFICACIÓN FINAL Y SCORE
  let category: MatchCategory = 'not_compatible';
  let categoryLabel = 'Probablemente no compatible';
  let categoryBadge = '🔴 Probablemente no compatible';

  if (incompatibilities.length > 0) {
    category = 'not_compatible';
    categoryLabel = 'Probablemente no compatible';
    categoryBadge = '🔴 Probablemente no compatible';
  } else if (missingData.length > 0) {
    category = 'potential_missing_data';
    categoryLabel = 'Potencialmente compatible — faltan datos';
    categoryBadge = '🟡 Potencialmente compatible — faltan datos';
  } else {
    category = 'potential_candidate';
    categoryLabel = 'Candidato potencial';
    categoryBadge = '🟢 Candidato potencial';
  }

  // Cálculo del Score de Ranking según FASE 7:
  // 1. Ensayos recruiting (+100)
  // 2. Centro en Córdoba (+50)
  // 3. Coincidencia clínica (+10 por cada match, -30 si no compatible)
  // 4. Menor cantidad de datos faltantes (-2 por cada dato faltante)
  let score = 0;
  if (trial.status === 'RECRUITING') score += 100;
  else if (trial.status === 'NOT_YET_RECRUITING') score += 50;

  if (trial.hasCordobaCenter) score += 60;

  if (category === 'potential_candidate') score += 50;
  else if (category === 'potential_missing_data') score += 20;
  else score -= 150;

  score += matches.length * 10;
  score -= missingData.length * 4;

  return {
    trial,
    category,
    categoryLabel,
    categoryBadge,
    score,
    matches,
    missingData,
    incompatibilities,
    requiredVerificationNotice: REQUIRED_NOTICE
  };
}

/**
 * Evalúa los ensayos clínicos para un único paciente de forma determinística y conservadora.
 * Solo lectura: NO modifica ni crea datos de pacientes.
 * NO envía datos del paciente a fuentes externas.
 */
export function evaluateSinglePatientTrials(
  patient: any,
  trials: ClinicalTrial[]
): PatientMatchingEvaluation {
  const profile = extractPatientClinicalProfile(patient);
  const trialResults: TrialMatchResult[] = [];

  for (const trial of trials) {
    const result = evaluateTrialMatch(profile, trial);
    if (result.category !== 'not_compatible') {
      trialResults.push(result);
    }
  }

  // Ordenar resultados según FASE 7:
  // 1. Recruiting
  // 2. Centro en Córdoba
  // 3. Coincidencia clínica / Score
  // 4. Menor cantidad de datos faltantes
  trialResults.sort((a, b) => {
    // 1. Recruiting
    const aRecruiting = a.trial.status === 'RECRUITING' ? 1 : 0;
    const bRecruiting = b.trial.status === 'RECRUITING' ? 1 : 0;
    if (aRecruiting !== bRecruiting) return bRecruiting - aRecruiting;

    // 2. Centro en Córdoba
    const aCordoba = a.trial.hasCordobaCenter ? 1 : 0;
    const bCordoba = b.trial.hasCordobaCenter ? 1 : 0;
    if (aCordoba !== bCordoba) return bCordoba - aCordoba;

    // 3. Coincidencia clínica (Score)
    if (a.score !== b.score) return b.score - a.score;

    // 4. Menor cantidad de datos faltantes
    return a.missingData.length - b.missingData.length;
  });

  const potentialCandidateCount = trialResults.filter(r => r.category === 'potential_candidate').length;
  const potentialMissingDataCount = trialResults.filter(r => r.category === 'potential_missing_data').length;

  let bestCategory: MatchCategory = 'not_compatible';
  if (potentialCandidateCount > 0) bestCategory = 'potential_candidate';
  else if (potentialMissingDataCount > 0) bestCategory = 'potential_missing_data';

  return {
    patientId: profile.patientId,
    hcNumber: profile.hcNumber,
    patientName: profile.name,
    diagnosis: profile.diagnosisRaw,
    stageDocumented: profile.stageDocumented,
    profile,
    matches: trialResults,
    potentialCandidateCount,
    potentialMissingDataCount,
    bestCategory,
    lastEvaluatedAt: Date.now()
  };
}

/**
 * Ejecuta el análisis de matching para todos los pacientes del médico
 * Solo lectura: NO modifica ni crea datos de pacientes.
 * NO envía datos del paciente a fuentes externas.
 */
export function analyzeDoctorPatients(
  patients: any[], 
  trials: ClinicalTrial[]
): DoctorMatchingSummary {
  const evaluations: PatientMatchingEvaluation[] = [];
  let patientsWithMatchesCount = 0;
  let totalMatchesCount = 0;

  for (const patient of patients) {
    const evalResult = evaluateSinglePatientTrials(patient, trials);
    if (evalResult.matches.length > 0) {
      patientsWithMatchesCount++;
      totalMatchesCount += evalResult.matches.length;
    }
    evaluations.push(evalResult);
  }

  // Ordenar pacientes: primero los que tienen candidatos potenciales, luego faltan datos
  evaluations.sort((a, b) => {
    if (a.potentialCandidateCount !== b.potentialCandidateCount) {
      return b.potentialCandidateCount - a.potentialCandidateCount;
    }
    return b.potentialMissingDataCount - a.potentialMissingDataCount;
  });

  return {
    totalPatientsAnalyzed: patients.length,
    patientsWithMatchesCount,
    totalMatchesCount,
    evaluations,
    analyzedAt: Date.now()
  };
}

