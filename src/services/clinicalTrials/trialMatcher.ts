import { 
  ClinicalTrial, 
  PatientClinicalProfile, 
  TrialMatchResult, 
  MatchCategory, 
  PatientMatchingEvaluation, 
  DoctorMatchingSummary,
  StructuredCriterion,
  CriterionEvaluationDetail,
  CriterionEvaluationStatus
} from '../../types/clinicalTrials';
import { extractPatientClinicalProfile } from './patientProfileExtractor';
import { parseStructuredCriteria } from './criteriaParser';

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

const REQUIRED_NOTICE = 'Paciente potencialmente elegible. Requiere verificación de criterios por el equipo investigador. Herramienta orientativa para el médico residente. No constituye confirmación de elegibilidad ni reemplaza la evaluación por el investigador principal del ensayo.';

/**
 * Determina si la sede específica de Córdoba está activamente reclutando (RECRUITING).
 * Separa estrictamente el estado global del estudio del estado local de la sede.
 */
export function isCordobaSiteRecruiting(trial: ClinicalTrial): boolean {
  if (trial.hasCordobaRecruitingCenter === true) return true;
  if (trial.hasCordobaRecruitingCenter === false && trial.cordobaRecruitingStatus && trial.cordobaRecruitingStatus !== 'UNKNOWN') {
    return false;
  }
  if (trial.locations && trial.locations.length > 0) {
    const cordobaLocs = trial.locations.filter(l => l.isCordoba);
    if (cordobaLocs.length > 0) {
      return cordobaLocs.some(l => (l.status || '').toUpperCase() === 'RECRUITING');
    }
  }
  return false;
}

/**
 * Evalúa un criterio estructurado individual contra el perfil clínico del paciente.
 * Retorna el detalle con uno de 4 estados: CUMPLE, NO CUMPLE, NO DOCUMENTADO, NO EVALUABLE.
 */
export function evaluateSingleCriterion(
  patient: PatientClinicalProfile,
  trial: ClinicalTrial,
  criterion: StructuredCriterion
): {
  evalDetail: CriterionEvaluationDetail;
  match?: string;
  missing?: string;
  missingActionItem?: string;
  incompatibility?: string;
} {
  const isExclusion = criterion.criterionType === 'exclusion';
  const sourceText = criterion.sourceText;
  let status: CriterionEvaluationStatus = 'NO EVALUABLE';
  let statusLabel = 'No evaluable';
  let patientValueDescription = '';
  let missingAction = '';
  let match: string | undefined;
  let missing: string | undefined;
  let missingActionItem: string | undefined;
  let incompatibility: string | undefined;

  // Criterios no estructurados o de categoría compleja abierta
  if (criterion.parseStatus === 'UNSTRUCTURED' || criterion.category === 'OTHER') {
    return {
      evalDetail: {
        id: criterion.id,
        criterionType: criterion.criterionType,
        category: criterion.category,
        name: sourceText.length > 70 ? sourceText.substring(0, 67) + '...' : sourceText,
        status: 'NO EVALUABLE',
        statusLabel: 'No evaluable',
        patientValueDescription: 'Criterio complejo no estructurado automáticamente; requiere evaluación clínica manual',
        sourceText,
        isExclusion,
        missingAction: 'Revisión manual requerida por el equipo médico'
      }
    };
  }

  // 1. EDAD
  if (criterion.category === 'AGE') {
    const minAge = criterion.details?.minNumericThreshold ?? trial.minimumAgeYears;
    const maxAge = trial.maximumAgeYears;
    const name = `Edad (${minAge ?? 0}${maxAge ? ` - ${maxAge}` : '+'} años)`;

    if (typeof patient.age !== 'number') {
      status = 'NO DOCUMENTADO';
      statusLabel = 'No documentado';
      patientValueDescription = 'Edad no documentada en el perfil del paciente';
      missing = 'Edad del paciente [No documentada]';
      missingAction = 'Documentar edad del paciente';
      missingActionItem = 'Documentar edad del paciente';
    } else {
      const isTooYoung = minAge !== undefined && patient.age < minAge;
      const isTooOld = maxAge !== undefined && patient.age > maxAge;

      if (!isExclusion) {
        if (isTooYoung || isTooOld) {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple';
          patientValueDescription = `Edad actual: ${patient.age} años (rango admitido: ${minAge ?? 'sin mín.'} - ${maxAge ?? 'sin máx.'} años)`;
          incompatibility = `Edad del paciente (${patient.age} años) fuera del rango admitido por protocolo (${minAge ?? 0} - ${maxAge ?? 'sin límite'}).`;
        } else {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = `Edad actual: ${patient.age} años (dentro del rango)`;
          match = `Edad (${patient.age} años) dentro del rango del protocolo ✓`;
        }
      } else {
        if (isTooYoung || isTooOld) {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple (exclusión activa)';
          patientValueDescription = `Edad actual: ${patient.age} años (coincide con criterio de exclusión)`;
          incompatibility = `Edad del paciente (${patient.age} años) coincide con criterio de exclusión.`;
        } else {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = `Edad actual: ${patient.age} años (sin exclusión)`;
        }
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: 'AGE', name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 2. SEXO
  if (criterion.category === 'SEX') {
    const requiredSex = trial.sex !== 'ALL' ? trial.sex : (criterion.value === 'FEMALE' ? 'FEMALE' : (criterion.value === 'MALE' ? 'MALE' : 'ALL'));
    const name = `Sexo (${requiredSex === 'FEMALE' ? 'Femenino' : requiredSex === 'MALE' ? 'Masculino' : 'Ambos sexos'})`;

    if (requiredSex === 'ALL') {
      status = 'CUMPLE';
      statusLabel = 'Cumple';
      patientValueDescription = 'Protocolo abierto a todos los sexos';
      match = 'Sexo admisible (todos los sexos) ✓';
    } else if (!patient.sex) {
      status = 'NO DOCUMENTADO';
      statusLabel = 'No documentado';
      patientValueDescription = 'Sexo del paciente no documentado';
      missing = 'Sexo del paciente [No documentado]';
      missingAction = 'Documentar sexo del paciente';
      missingActionItem = 'Documentar sexo del paciente';
    } else if (patient.sex === requiredSex) {
      status = 'CUMPLE';
      statusLabel = 'Cumple';
      patientValueDescription = `Sexo: ${patient.sex === 'MALE' ? 'Masculino' : 'Femenino'} (concordante)`;
      match = `Sexo concordante con el protocolo (${patient.sex === 'MALE' ? 'Masculino' : 'Femenino'}) ✓`;
    } else {
      status = 'NO CUMPLE';
      statusLabel = 'No cumple';
      patientValueDescription = `Sexo: ${patient.sex === 'MALE' ? 'Masculino' : 'Femenino'} (protocolo requiere ${requiredSex === 'FEMALE' ? 'Femenino' : 'Masculino'})`;
      incompatibility = `Protocolo exclusivo para sexo ${requiredSex === 'FEMALE' ? 'femenino' : 'masculino'}.`;
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: 'SEX', name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 3. ECOG
  if (criterion.category === 'ECOG') {
    const maxAllowed = criterion.details?.ecogMax ?? trial.ecogMaxAdmissible ?? 1;
    const minAllowed = criterion.details?.ecogMin ?? 0;
    const name = `Performance Status ECOG <= ${maxAllowed}`;

    if (typeof patient.ecogDocumented !== 'number') {
      status = 'NO DOCUMENTADO';
      statusLabel = 'No documentado';
      patientValueDescription = 'ECOG no registrado en la HC';
      missing = `Performance Status ECOG (protocolo requiere ECOG <= ${maxAllowed}) [No documentado]`;
      missingAction = `Documentar Performance Status ECOG (requerido <= ${maxAllowed})`;
      missingActionItem = `Documentar Performance Status ECOG (requerido <= ${maxAllowed})`;
    } else if (!isExclusion) {
      if (patient.ecogDocumented <= maxAllowed && patient.ecogDocumented >= minAllowed) {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = `ECOG documentado: ${patient.ecogDocumented} (admitido <= ${maxAllowed})`;
        match = `Performance Status ECOG ${patient.ecogDocumented} cumple criterio (ECOG <= ${maxAllowed}) ✓`;
      } else {
        status = 'NO CUMPLE';
        statusLabel = 'No cumple';
        patientValueDescription = `ECOG documentado: ${patient.ecogDocumented} (supera el límite de <= ${maxAllowed})`;
        incompatibility = `ECOG del paciente (${patient.ecogDocumented}) superior al máximo admitido por protocolo (ECOG <= ${maxAllowed}).`;
      }
    } else {
      const exclThreshold = criterion.details?.ecogMin ?? 2;
      if (patient.ecogDocumented >= exclThreshold) {
        status = 'NO CUMPLE';
        statusLabel = 'No cumple (exclusión activa)';
        patientValueDescription = `ECOG documentado: ${patient.ecogDocumented} (cumple criterio de exclusión >= ${exclThreshold})`;
        incompatibility = `El protocolo excluye pacientes con ECOG >= ${exclThreshold} y el paciente presenta ECOG ${patient.ecogDocumented}.`;
      } else {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = `ECOG documentado: ${patient.ecogDocumented} (no alcanza el umbral de exclusión >= ${exclThreshold})`;
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: 'ECOG', name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 4. BIOMARCADORES Y ALTERACIONES MOLECULARES
  if (criterion.category === 'BIOMARKER' || criterion.category === 'MOLECULAR_ALTERATION') {
    const gene = (criterion.details?.gene || '').toUpperCase() || 
      (sourceText.match(/\b(EGFR|KRAS|NRAS|BRAF|HER2|ERBB2|ALK|ROS1|RET|MET|NTRK|PIK3CA|BRCA1|BRCA2|PD-L1|PDL1|MSI|MMR)\b/i)?.[1]?.toUpperCase() || 'BIOMARCADOR');
    const reqStatus = criterion.details?.statusRequired || 'MUTATED';
    const specificAlt = criterion.details?.specificAlteration?.toUpperCase();
    const name = `Biomarcador ${gene}${specificAlt ? ` (${specificAlt})` : ''} - Requerido: ${reqStatus}`;

    const pBio = patient.biomarkersDocumented.find(b => 
      b.name.toUpperCase().includes(gene) || gene.includes(b.name.toUpperCase())
    );

    if (!pBio) {
      status = 'NO DOCUMENTADO';
      statusLabel = 'No documentado';
      patientValueDescription = `Estado de ${gene} no documentado en HC`;
      missing = `Estado del biomarcador ${gene} [No documentado]`;
      missingAction = `Solicitar informe molecular / patología de ${gene}`;
      missingActionItem = `Solicitar informe molecular / patología de ${gene}`;
    } else {
      const bioStatus = pBio.status.toLowerCase();
      const bioRaw = pBio.rawText.toLowerCase();
      const isWildType = bioStatus.includes('wt') || bioStatus.includes('wild') || bioStatus.includes('no mut') || bioRaw.includes('no mut') || bioRaw.includes('sin mut') || bioStatus.includes('sin mut') || bioRaw.includes('salvaje') || bioStatus.includes('salvaje');
      const isMutated = !isWildType && (bioStatus.includes('mut') || bioRaw.includes('mut') || bioStatus.includes('exon 19') || bioStatus.includes('exón 19') || bioStatus.includes('l858r') || bioStatus.includes('v600') || bioStatus.includes('g12c'));
      const isPositive = bioStatus.includes('pos') || bioRaw.includes('pos') || bioStatus.includes('3+') || bioStatus.includes('amplif') || bioStatus.includes('overexpress');
      const isNegative = bioStatus.includes('neg') || bioRaw.includes('neg') || bioStatus.includes('0') || bioStatus.includes('1+');
      const isMsiH = bioStatus.includes('msi-h') || bioStatus.includes('dmmr') || bioRaw.includes('msi-h');
      const isMss = bioStatus.includes('mss') || bioStatus.includes('pmmr') || bioRaw.includes('mss');

      let satisfiesRequirement = false;
      let conflictsWithRequirement = false;

      if (reqStatus === 'MUTATED') {
        if (isMutated) {
          if (specificAlt) {
            if (pBio.status.toUpperCase().includes(specificAlt) || pBio.rawText.toUpperCase().includes(specificAlt)) {
              satisfiesRequirement = true;
            } else {
              status = 'NO DOCUMENTADO';
              statusLabel = 'Falta subvariante';
              patientValueDescription = `Mutación documentada (${pBio.status}) pero requiere confirmar variante ${specificAlt}`;
              missingAction = `Confirmar variante específica (${specificAlt}) en informe molecular de ${gene}`;
              missingActionItem = `Confirmar variante específica (${specificAlt}) en informe molecular de ${gene}`;
            }
          } else {
            satisfiesRequirement = true;
          }
        } else if (isWildType) {
          conflictsWithRequirement = true;
        }
      } else if (reqStatus === 'WILD_TYPE') {
        if (isWildType) satisfiesRequirement = true;
        else if (isMutated) conflictsWithRequirement = true;
      } else if (reqStatus === 'POSITIVE' || reqStatus === 'OVEREXPRESSED') {
        const minThreshold = criterion.details?.minNumericThreshold;
        const isPdl1 = gene.includes('PD-L1') || gene.includes('PDL1') || sourceText.toUpperCase().includes('PD-L1') || sourceText.toUpperCase().includes('PDL1');

        if (isPdl1 && minThreshold !== undefined) {
          // Extraer porcentaje cuantitativo explícito del paciente
          const allPatientText = `${pBio.status} ${pBio.rawText}`;
          const pctMatch = allPatientText.match(/(\d+(?:\.\d+)?)\s*%/);
          let patientPct: number | undefined = pctMatch ? parseFloat(pctMatch[1]) : undefined;
          if (patientPct === undefined) {
            const rawNumMatch = pBio.status.trim().match(/^(\d+(?:\.\d+)?)$/);
            if (rawNumMatch) patientPct = parseFloat(rawNumMatch[1]);
          }

          if (patientPct !== undefined) {
            if (patientPct >= minThreshold) {
              satisfiesRequirement = true;
            } else {
              conflictsWithRequirement = true;
            }
          } else {
            // El paciente documenta "Positivo" o cualitativo sin porcentaje cuantitativo
            status = 'NO DOCUMENTADO';
            statusLabel = 'Falta porcentaje cuantitativo';
            patientValueDescription = `Biomarcador ${gene}: ${pBio.status} (falta porcentaje cuantitativo [protocolo requiere >= ${minThreshold}%])`;
            missingAction = 'Falta porcentaje cuantitativo de PD-L1 requerido por el protocolo';
            missingActionItem = 'Falta porcentaje cuantitativo de PD-L1 requerido por el protocolo';
          }
        } else {
          if (isPositive) satisfiesRequirement = true;
          else if (isNegative) conflictsWithRequirement = true;
        }
      } else if (reqStatus === 'NEGATIVE') {
        if (isNegative) satisfiesRequirement = true;
        else if (isPositive) conflictsWithRequirement = true;
      } else if (gene === 'MSI' || gene === 'MMR') {
        if (reqStatus === 'MUTATED' || sourceText.toUpperCase().includes('MSI-H')) {
          if (isMsiH) satisfiesRequirement = true;
          else if (isMss) conflictsWithRequirement = true;
        } else {
          if (isMss) satisfiesRequirement = true;
          else if (isMsiH) conflictsWithRequirement = true;
        }
      }

      if (status !== 'NO DOCUMENTADO') {
        if (!isExclusion) {
          if (satisfiesRequirement) {
            status = 'CUMPLE';
            statusLabel = 'Cumple';
            patientValueDescription = `Biomarcador ${gene}: ${pBio.status} (concordante con protocolo)`;
            match = `Biomarcador ${gene} concordante (${pBio.status}) ✓`;
          } else if (conflictsWithRequirement) {
            status = 'NO CUMPLE';
            statusLabel = 'No cumple';
            patientValueDescription = `Biomarcador ${gene}: ${pBio.status} (incompatible con requisito: ${reqStatus})`;
            incompatibility = `El protocolo requiere ${gene} ${reqStatus} y el paciente presenta ${pBio.status}.`;
          } else {
            status = 'NO DOCUMENTADO';
            statusLabel = 'No documentado';
            patientValueDescription = `Biomarcador ${gene}: ${pBio.status} (no concluyente para ${reqStatus})`;
            missingAction = `Verificar informe molecular de ${gene}`;
            missingActionItem = `Verificar informe molecular de ${gene}`;
          }
        } else {
          // Exclusión
          if (satisfiesRequirement) {
            status = 'NO CUMPLE';
            statusLabel = 'No cumple (exclusión activa)';
            patientValueDescription = `Biomarcador ${gene}: ${pBio.status} (activa criterio de exclusión)`;
            incompatibility = `El protocolo excluye pacientes con alteración en ${gene} y el paciente presenta ${pBio.status}.`;
          } else if (conflictsWithRequirement) {
            status = 'CUMPLE';
            statusLabel = 'Cumple';
            patientValueDescription = `Biomarcador ${gene}: ${pBio.status} (libre de exclusión)`;
          } else {
            status = 'NO DOCUMENTADO';
            missingAction = `Verificar estado de ${gene} para descartar exclusión`;
          }
        }
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: criterion.category, name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 5. LABORATORIO
  if (criterion.category === 'LAB') {
    const param = criterion.details?.labParameter;
    const operator = criterion.details?.labOperator || '>=';
    const threshold = criterion.details?.labValue;
    const name = `Laboratorio: ${param || 'Bioquímica'} ${operator} ${threshold ?? ''}`;

    let patientLabVal: number | undefined;
    if (param === 'hemoglobin') patientLabVal = patient.labsDocumented.hemoglobin;
    else if (param === 'platelets') patientLabVal = patient.labsDocumented.platelets;
    else if (param === 'neutrophils') patientLabVal = patient.labsDocumented.neutrophils;
    else if (param === 'creatinine') patientLabVal = patient.labsDocumented.creatinine;
    else if (param === 'total_bilirubin') patientLabVal = patient.labsDocumented.totalBilirubin;
    else if (param === 'ast') patientLabVal = patient.labsDocumented.ast;
    else if (param === 'alt') patientLabVal = patient.labsDocumented.alt;

    const isUlnRef = criterion.details?.labReference === 'ULN' ||
                     sourceText.toUpperCase().includes('ULN') ||
                     sourceText.toUpperCase().includes('UPPER LIMIT OF NORMAL');

    if (patientLabVal === undefined) {
      status = 'NO DOCUMENTADO';
      statusLabel = 'No documentado';
      patientValueDescription = `Parámetro ${param || 'de laboratorio'} no documentado`;
      missing = `Laboratorio: ${param || 'requerido por protocolo'} [No documentado]`;
      missingAction = `Solicitar dosaje de ${param || 'laboratorio'} en análisis de sangre`;
      missingActionItem = `Solicitar dosaje de ${param || 'laboratorio'} en análisis de sangre`;
    } else if (isUlnRef) {
      // EVALUACIÓN ESTRICTA CON MULTIPLICADOR DE ULN
      // REGLA CLÍNICA: No comparar valor absoluto contra el multiplicador sin ULN verificable.
      // PROHIBICIÓN: No asumir ULN institucional hardcodeado.
      const paramKey = param || '';
      const uln = patient.labsDocumented.uln?.[paramKey] ?? 
                  patient.labsDocumented.uln?.[paramKey.replace('total_', '')] ??
                  patient.labsDocumented.uln?.[paramKey.toLowerCase()];

      if (uln !== undefined && uln > 0) {
        // CASO A: ULN disponible y verificable
        const multiplier = threshold ?? 1;
        const limitVal = multiplier * uln;
        let passesCondition = true;
        if (operator === '<=') passesCondition = patientLabVal <= limitVal;
        else if (operator === '>=') passesCondition = patientLabVal >= limitVal;
        else if (operator === '<') passesCondition = patientLabVal < limitVal;
        else if (operator === '>') passesCondition = patientLabVal > limitVal;

        if (!isExclusion) {
          if (passesCondition) {
            status = 'CUMPLE';
            statusLabel = 'Cumple';
            patientValueDescription = `Valor documentado: ${patientLabVal} (cumple ${operator} ${limitVal} [${multiplier} x ULN (${uln})])`;
            match = `Laboratorio ${param} (${patientLabVal}) dentro del rango admitido (${operator} ${limitVal}) ✓`;
          } else {
            status = 'NO CUMPLE';
            statusLabel = 'No cumple';
            patientValueDescription = `Valor documentado: ${patientLabVal} (supera límite ${operator} ${limitVal} [${multiplier} x ULN (${uln})])`;
            incompatibility = `Parámetro de laboratorio ${param} (${patientLabVal}) fuera del rango admitido (${operator} ${limitVal} [${multiplier} x ULN]).`;
          }
        } else {
          if (passesCondition) {
            status = 'NO CUMPLE';
            statusLabel = 'No cumple (exclusión activa)';
            patientValueDescription = `Valor documentado: ${patientLabVal} (activa exclusión [${multiplier} x ULN (${uln})])`;
            incompatibility = `Alteración laboratorial de ${param} (${patientLabVal}) cumple criterio de exclusión.`;
          } else {
            status = 'CUMPLE';
            statusLabel = 'Cumple';
            patientValueDescription = `Valor documentado: ${patientLabVal} (sin exclusión)`;
          }
        }
      } else {
        // CASO B: ULN no disponible en el informe de laboratorio
        status = 'NO EVALUABLE';
        statusLabel = 'No evaluable (requiere ULN)';
        patientValueDescription = `Valor documentado: ${patientLabVal} (criterio requiere múltiplo de ULN [${threshold ?? ''} x ULN] no verificable en el informe de laboratorio)`;
        missingAction = `Verificar valor de referencia ULN para ${param} en laboratorio`;
        missingActionItem = `Verificar valor de referencia ULN para ${param} en laboratorio`;
      }
    } else {
      let normVal = patientLabVal;
      if (param === 'platelets' && threshold !== undefined) {
        if (threshold <= 1000 && normVal > 1000) normVal = normVal / 1000;
        else if (threshold > 1000 && normVal <= 1000) normVal = normVal * 1000;
      }
      if (param === 'neutrophils' && threshold !== undefined) {
        if (threshold <= 10 && normVal > 10) normVal = normVal / 1000;
        else if (threshold > 10 && normVal <= 10) normVal = normVal * 1000;
      }

      let passesCondition = true;
      if (threshold !== undefined) {
        if (operator === '>=') passesCondition = normVal >= threshold;
        else if (operator === '<=') passesCondition = normVal <= threshold;
        else if (operator === '>') passesCondition = normVal > threshold;
        else if (operator === '<') passesCondition = normVal < threshold;
        else if (operator === 'BETWEEN') passesCondition = normVal >= threshold && normVal <= (criterion.details?.labMaxValue ?? threshold);
      }

      if (!isExclusion) {
        if (passesCondition) {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = `Valor documentado: ${patientLabVal} (cumple ${operator} ${threshold})`;
          match = `Laboratorio ${param} (${patientLabVal}) dentro del rango requerido ✓`;
        } else {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple';
          patientValueDescription = `Valor documentado: ${patientLabVal} (no alcanza requisito ${operator} ${threshold})`;
          incompatibility = `Parámetro de laboratorio ${param} (${patientLabVal}) fuera del rango admitido (${operator} ${threshold}).`;
        }
      } else {
        if (passesCondition) {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple (exclusión activa)';
          patientValueDescription = `Valor documentado: ${patientLabVal} (cumple criterio de exclusión)`;
          incompatibility = `Alteración laboratorial de ${param} (${patientLabVal}) cumple criterio de exclusión.`;
        } else {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = `Valor documentado: ${patientLabVal} (sin exclusión)`;
        }
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: 'LAB', name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 6. ESTADIO Y ESCENARIO CLÍNICO
  if (criterion.category === 'STAGE' || criterion.category === 'CLINICAL_SCENARIO') {
    const scenario = criterion.details?.scenario || (trial.isMetastaticEligible ? 'metastatic' : undefined);
    const stageReq = criterion.details?.stage;
    const name = `Estadio / Escenario clínico: ${stageReq || scenario || 'Estadificación'}`;
    const isMetastaticReq = scenario === 'metastatic' || stageReq === 'IV' || trial.isMetastaticEligible;

    if (isMetastaticReq) {
      if (patient.isMetastaticDocumented || patient.stageDocumented?.includes('IV')) {
        if (!isExclusion) {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = 'Enfermedad metastásica / estadio IV documentada';
          match = 'Enfermedad avanzada / metastásica documentada coincidente con el protocolo ✓';
        } else {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple (exclusión activa)';
          patientValueDescription = 'Paciente metastásico (protocolo excluye metástasis)';
          incompatibility = 'El protocolo excluye enfermedad metastásica y el paciente presenta metástasis.';
        }
      } else if (patient.stageDocumented && (patient.stageDocumented.includes('IA') || patient.stageDocumented.includes('IB') || patient.stageDocumented.includes('I ') || patient.stageDocumented === 'I' || patient.stageDocumented.includes('II')) && !patient.stageDocumented.includes('IV') && !patient.stageDocumented.includes('III')) {
        if (!isExclusion) {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple';
          patientValueDescription = `Estadio registrado: ${patient.stageDocumented} (temprano, no metastásico)`;
          incompatibility = `El protocolo evalúa enfermedad avanzada/metastásica y el paciente tiene registrado estadio temprano (${patient.stageDocumented}).`;
        } else {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = `Estadio registrado: ${patient.stageDocumented} (sin metástasis excluida)`;
        }
      } else {
        status = 'NO DOCUMENTADO';
        statusLabel = 'No documentado';
        patientValueDescription = 'Confirmación de estadio metastásico no documentada';
        missing = 'Estadio clínico / confirmación metastásica [No documentado]';
        missingAction = 'Documentar estadio clínico y confirmación de enfermedad metastásica';
        missingActionItem = 'Documentar estadio clínico y confirmación de enfermedad metastásica';
      }
    } else {
      if (patient.stageDocumented) {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = `Estadio documentado: ${patient.stageDocumented}`;
        match = `Estadio clínico documentado: ${patient.stageDocumented} ✓`;
      } else {
        status = 'NO DOCUMENTADO';
        statusLabel = 'No documentado';
        missing = 'Estadio clínico [No documentado]';
        missingAction = 'Documentar estadio clínico';
        missingActionItem = 'Documentar estadio clínico';
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: criterion.category, name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 7. LÍNEAS DE TRATAMIENTO Y TRATAMIENTOS PREVIOS
  if (criterion.category === 'PRIOR_TREATMENT' || criterion.category === 'LINE_OF_THERAPY') {
    const maxLines = criterion.details?.maxLines;
    const reqType = criterion.details?.treatmentRequirement;
    const drug = criterion.details?.treatmentName?.toLowerCase();
    const name = `Líneas de tratamiento previo (${drug ? `Fármaco: ${drug}` : maxLines !== undefined ? `Máx ${maxLines}` : 'Historial'})`;
    const linesCount = patient.linesDocumented.length;

    if (maxLines !== undefined) {
      if (linesCount > maxLines) {
        status = 'NO CUMPLE';
        statusLabel = 'No cumple';
        patientValueDescription = `Líneas previas: ${linesCount} (máximo admitido: ${maxLines})`;
        incompatibility = `Líneas de tratamiento previas (${linesCount}) superan el límite permitido (${maxLines}).`;
      } else if (linesCount > 0) {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = `Líneas previas: ${linesCount} (admisible)`;
        match = `Líneas previas concordantes (${linesCount}) ✓`;
      } else {
        status = 'NO DOCUMENTADO';
        statusLabel = 'No documentado';
        missing = 'Historial de líneas previas [No documentado]';
        missingAction = 'Documentar historial de líneas sistémicas previas';
        missingActionItem = 'Documentar historial de líneas sistémicas previas';
      }
    } else if (reqType === 'TREATMENT_NAIVE') {
      if (linesCount > 0) {
        status = 'NO CUMPLE';
        statusLabel = 'No cumple';
        patientValueDescription = `Presenta ${linesCount} líneas previas documentadas`;
        incompatibility = `Protocolo para pacientes vírgenes de tratamiento (naïve) y el paciente presenta ${linesCount} líneas documentadas.`;
      } else {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = 'Sin líneas de tratamiento previas registradas (naïve)';
        match = 'Condición de tratamiento naïve concordante ✓';
      }
    } else if (drug) {
      const hasDrug = patient.priorTreatments.some(t => t.toLowerCase().includes(drug) || drug.includes(t.toLowerCase()));
      if (isExclusion || reqType === 'FORBIDDEN') {
        if (hasDrug) {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple (exclusión activa)';
          patientValueDescription = `Tratamiento previo recibido: ${drug} (excluido)`;
          incompatibility = `Tratamiento previo excluido por protocolo: ${criterion.details?.treatmentName}.`;
        } else {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          patientValueDescription = `Sin exposición documentada a ${drug}`;
        }
      } else {
        if (hasDrug) {
          status = 'CUMPLE';
          statusLabel = 'Cumple';
          match = `Tratamiento previo requerido documentado (${drug}) ✓`;
        } else if (patient.priorTreatments.length > 0) {
          status = 'NO CUMPLE';
          statusLabel = 'No cumple';
          incompatibility = `El protocolo requiere tratamiento previo con ${drug} no documentado en el paciente.`;
        } else {
          status = 'NO DOCUMENTADO';
          missingAction = `Verificar antecedentes de tratamiento con ${drug}`;
          missingActionItem = `Verificar antecedentes de tratamiento con ${drug}`;
        }
      }
    } else {
      if (linesCount > 0) {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = `Líneas registradas: ${linesCount}`;
      } else {
        status = 'NO DOCUMENTADO';
        missingAction = 'Documentar líneas previas';
        missingActionItem = 'Documentar líneas de tratamiento previas';
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: criterion.category, name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // 8. METÁSTASIS EN SNC
  if (criterion.category === 'CNS_METASTASIS') {
    const name = 'Metástasis en SNC / Compromiso encefálico';
    const fullPatientCnsText = `${patient.diagnosisRaw || ''} ${patient.histology || ''}`.toLowerCase();

    // Detección de ausencia explícitamente documentada (ej. MRI cerebral normal, sin metástasis en SNC)
    const hasExplicitAbsence = /\b(sin\s+met[aá]stasis\s+(?:en\s+)?(?:snc|cerebr[a-z]*)|snc\s+libre|libre\s+de\s+(?:met[aá]stasis\s+)?(?:snc|cerebr[a-z]*)|cerebro\s+libre|mri\s+(?:cerebral\s*)?:?\s*(?:sin\s+met[aá]stasis|normal|negativ[ao])|snc\s*:\s*(?:negativo|normal|sin\s+lesiones)|ausencia\s+de\s+met[aá]stasis\s+(?:en\s+)?(?:snc|cerebr[a-z]*)|sin\s+compromiso\s+(?:en\s+)?(?:snc|cerebr[a-z]*))\b/i.test(fullPatientCnsText);

    // Detección de presencia activa documentada de metástasis SNC
    const hasActiveCns = !hasExplicitAbsence && /\b(snc|cerebr[a-z]*|brain\s*met[a-z]*|met[aá]stasis\s+cerebr[a-z]*)\b/i.test(fullPatientCnsText);

    if (isExclusion) {
      if (hasActiveCns) {
        status = 'NO CUMPLE';
        statusLabel = 'No cumple (exclusión activa)';
        patientValueDescription = 'Compromiso de SNC documentado en la historia clínica';
        incompatibility = 'El protocolo excluye metástasis en el sistema nervioso central y el paciente presenta compromiso cerebral documentado.';
      } else if (hasExplicitAbsence) {
        status = 'CUMPLE';
        statusLabel = 'Cumple (ausencia documentada)';
        patientValueDescription = 'Ausencia de metástasis en SNC explícitamente documentada';
        match = 'Ausencia de metástasis en SNC explícitamente documentada (sin exclusión) ✓';
      } else {
        // SNC no mencionado en la historia clínica: incertidumbre conservadora
        status = 'NO DOCUMENTADO';
        statusLabel = 'No documentado';
        patientValueDescription = 'Estado de compromiso en SNC no documentado en la HC';
        missing = 'Compromiso de SNC [No documentado]';
        missingAction = 'Confirmar ausencia/presencia de metástasis activas en SNC';
        missingActionItem = 'Confirmar ausencia/presencia de metástasis activas en SNC';
      }
    } else {
      if (hasActiveCns) {
        status = 'CUMPLE';
        statusLabel = 'Cumple';
        patientValueDescription = 'Compromiso de SNC documentado coincidente con el protocolo';
        match = 'Compromiso de SNC documentado requerido por el protocolo ✓';
      } else {
        status = 'NO CUMPLE';
        statusLabel = 'No cumple';
        patientValueDescription = 'Sin metástasis en SNC documentadas';
        incompatibility = 'El protocolo evalúa metástasis en SNC y el paciente no presenta compromiso cerebral documentado.';
      }
    }

    return {
      evalDetail: { id: criterion.id, criterionType: criterion.criterionType, category: 'CNS_METASTASIS', name, status, statusLabel, patientValueDescription, sourceText, isExclusion, missingAction },
      match, missing, missingActionItem, incompatibility
    };
  }

  // Fallback para otros criterios
  return {
    evalDetail: {
      id: criterion.id,
      criterionType: criterion.criterionType,
      category: criterion.category,
      name: sourceText.length > 70 ? sourceText.substring(0, 67) + '...' : sourceText,
      status: 'NO EVALUABLE',
      statusLabel: 'No evaluable',
      patientValueDescription: 'Criterio complejo no estructurado automáticamente; requiere evaluación clínica manual',
      sourceText,
      isExclusion,
      missingAction: 'Revisión manual requerida'
    }
  };
}

/**
 * Evalúa la compatibilidad clínica determinística entre un perfil de paciente y un ensayo clínico.
 * Asigna una de las 4 categorías globales de pre-screening:
 * - 🟢 POTENCIALMENTE ELEGIBLE
 * - 🟡 POTENCIALMENTE ELEGIBLE — FALTA INFORMACIÓN
 * - 🔴 NO CUMPLE CRITERIO DOCUMENTADO
 * - ⚪ NO EVALUABLE
 */
export function evaluateTrialMatch(
  patient: PatientClinicalProfile, 
  trial: ClinicalTrial
): TrialMatchResult {
  const matches: string[] = [];
  const missingData: string[] = [];
  const incompatibilities: string[] = [];
  const missingItems: string[] = [];
  const criteriaEvaluations: CriterionEvaluationDetail[] = [];

  // 1. EVALUACIÓN ESTRICTA DE TUMOR PRIMARIO / SITIO
  if (!patient.organOrSite) {
    const siteCrit: CriterionEvaluationDetail = {
      id: 'crit_organ_site',
      criterionType: 'inclusion',
      category: 'OTHER',
      name: 'Tumor primario del paciente',
      status: 'NO DOCUMENTADO',
      statusLabel: 'No documentado',
      patientValueDescription: 'No se pudo identificar con certeza el tumor primario del paciente a partir de la información documentada.',
      sourceText: 'Criterio de diagnóstico histológico primario del protocolo',
      isExclusion: false,
      missingAction: 'Identificar y registrar el diagnóstico y sitio tumoral primario'
    };
    criteriaEvaluations.push(siteCrit);
    missingItems.push('Identificar y registrar tumor primario en el perfil clínico');
    incompatibilities.push('No se pudo identificar con certeza el tumor primario del paciente a partir de la información documentada.');
    return {
      trial,
      category: 'not_compatible',
      categoryLabel: 'No cumple criterio documentado',
      categoryBadge: '🔴 No cumple criterio documentado',
      score: -100,
      matches,
      missingData,
      incompatibilities,
      requiredVerificationNotice: REQUIRED_NOTICE,
      criteriaEvaluations,
      missingItems,
      unstructuredCriteriaCount: 0
    };
  }

  const patientOrganLabel = ORGAN_LABELS[patient.organOrSite] || patient.organOrSite;
  const trialHasPatientOrgan = trial.tumorTypes.includes(patient.organOrSite);
  const trialIsSolidTumorBasket = trial.tumorTypes.includes('solido_agnostico');

  // Si el ensayo no incluye el órgano del paciente ni es canasta agnóstica: INCOMPATIBLE
  if (!trialHasPatientOrgan && !trialIsSolidTumorBasket) {
    const trialOrgansLabels = trial.tumorTypes.map(t => ORGAN_LABELS[t] || t).join(', ') || 'otra patología específica';
    const siteCrit: CriterionEvaluationDetail = {
      id: 'crit_organ_site',
      criterionType: 'inclusion',
      category: 'OTHER',
      name: 'Concordancia de sitio tumoral primario',
      status: 'NO CUMPLE',
      statusLabel: 'No cumple',
      patientValueDescription: `Diagnóstico del paciente: ${patientOrganLabel} (no concordante)`,
      sourceText: `Patologías evaluadas en protocolo: ${trialOrgansLabels}`,
      isExclusion: false,
      isIncompatible: true
    };
    criteriaEvaluations.push(siteCrit);
    incompatibilities.push(
      `Sitio tumoral primario no concordante: el paciente presenta diagnóstico de ${patientOrganLabel}, mientras que el ensayo evalúa ${trialOrgansLabels}.`
    );
    return {
      trial,
      category: 'not_compatible',
      categoryLabel: 'No cumple criterio documentado',
      categoryBadge: '🔴 No cumple criterio documentado',
      score: -100,
      matches,
      missingData,
      incompatibilities,
      requiredVerificationNotice: REQUIRED_NOTICE,
      criteriaEvaluations,
      missingItems,
      unstructuredCriteriaCount: 0
    };
  }

  // Coincidencia estricta de diagnóstico primario
  matches.push(`Diagnóstico y localización tumoral concordante (${patientOrganLabel}) ✓`);

  // 2. OBTENER Y EVALUAR CRITERIOS ESTRUCTURADOS
  let criteria = trial.structuredCriteria;
  if (!criteria || criteria.length === 0) {
    const parsed = parseStructuredCriteria({
      inclusionLines: trial.inclusionCriteria || [],
      exclusionLines: trial.exclusionCriteria || [],
      minimumAgeYears: trial.minimumAgeYears,
      maximumAgeYears: trial.maximumAgeYears,
      sex: trial.sex
    });
    criteria = parsed.structuredCriteria;
  }

  let unstructuredCriteriaCount = 0;

  if (criteria && criteria.length > 0) {
    for (const crit of criteria) {
      const res = evaluateSingleCriterion(patient, trial, crit);
      criteriaEvaluations.push(res.evalDetail);

      if (res.match && !matches.includes(res.match)) matches.push(res.match);
      if (res.missing && !missingData.includes(res.missing)) missingData.push(res.missing);
      if (res.missingActionItem && !missingItems.includes(res.missingActionItem)) missingItems.push(res.missingActionItem);
      if (res.incompatibility && !incompatibilities.includes(res.incompatibility)) incompatibilities.push(res.incompatibility);
      if (res.evalDetail.status === 'NO EVALUABLE') unstructuredCriteriaCount++;
    }
  }

  // 3. EVALUACIONES DETERMINÍSTICAS ADICIONALES (SI NO FUERON CUBIERTAS EN CRITERIOS)
  // Edad
  const hasAgeInCrit = criteriaEvaluations.some(c => c.category === 'AGE');
  if (!hasAgeInCrit && (trial.minimumAgeYears || trial.maximumAgeYears)) {
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
      if (!missingItems.includes('Documentar edad del paciente')) missingItems.push('Documentar edad del paciente');
    }
  }

  // Sexo
  const hasSexInCrit = criteriaEvaluations.some(c => c.category === 'SEX');
  if (!hasSexInCrit && trial.sex && trial.sex !== 'ALL') {
    if (patient.sex) {
      if (trial.sex === 'FEMALE' && patient.sex !== 'FEMALE') {
        incompatibilities.push('Protocolo exclusivo para pacientes de sexo femenino.');
      } else if (trial.sex === 'MALE' && patient.sex !== 'MALE') {
        incompatibilities.push('Protocolo exclusivo para pacientes de sexo masculino.');
      } else {
        matches.push(`Sexo compatible con el protocolo (${patient.sex === 'MALE' ? 'Masculino' : 'Femenino'}) ✓`);
      }
    } else {
      missingData.push('Sexo del paciente [No documentado]');
      if (!missingItems.includes('Documentar sexo del paciente')) missingItems.push('Documentar sexo del paciente');
    }
  }

  // ECOG (si el protocolo explicita ecogMaxAdmissible y no fue cubierto en criteria)
  const trialEcogMax = trial.ecogMaxAdmissible ?? (
    criteria?.find(c => c.category === 'ECOG' && c.details?.ecogMax !== undefined)?.details?.ecogMax
  );
  const hasEcogInCrit = criteriaEvaluations.some(c => c.category === 'ECOG');
  if (!hasEcogInCrit && trialEcogMax !== undefined) {
    if (typeof patient.ecogDocumented === 'number') {
      if (patient.ecogDocumented <= trialEcogMax) {
        matches.push(`Performance Status ECOG ${patient.ecogDocumented} cumple criterio del protocolo (ECOG <= ${trialEcogMax}) ✓`);
        criteriaEvaluations.push({
          id: 'crit_ecog_fallback',
          criterionType: 'inclusion',
          category: 'ECOG',
          name: `Performance Status ECOG <= ${trialEcogMax}`,
          status: 'CUMPLE',
          statusLabel: 'Cumple',
          patientValueDescription: `ECOG documentado: ${patient.ecogDocumented} (admitido <= ${trialEcogMax})`,
          sourceText: `Requisito de protocolo: ECOG <= ${trialEcogMax}`,
          isExclusion: false
        });
      } else {
        incompatibilities.push(`ECOG del paciente (${patient.ecogDocumented}) superior al máximo admitido por protocolo (ECOG <= ${trialEcogMax}).`);
        criteriaEvaluations.push({
          id: 'crit_ecog_fallback',
          criterionType: 'inclusion',
          category: 'ECOG',
          name: `Performance Status ECOG <= ${trialEcogMax}`,
          status: 'NO CUMPLE',
          statusLabel: 'No cumple',
          patientValueDescription: `ECOG documentado: ${patient.ecogDocumented} (supera el límite de <= ${trialEcogMax})`,
          sourceText: `Requisito de protocolo: ECOG <= ${trialEcogMax}`,
          isExclusion: false,
          isIncompatible: true
        });
      }
    } else {
      missingData.push(`Performance Status ECOG (protocolo requiere ECOG <= ${trialEcogMax}) [No documentado explícitamente]`);
      missingItems.push(`Documentar Performance Status ECOG (protocolo requiere ECOG <= ${trialEcogMax})`);
      criteriaEvaluations.push({
        id: 'crit_ecog_fallback',
        criterionType: 'inclusion',
        category: 'ECOG',
        name: `Performance Status ECOG <= ${trialEcogMax}`,
        status: 'NO DOCUMENTADO',
        statusLabel: 'No documentado',
        patientValueDescription: 'ECOG no registrado en la HC',
        sourceText: `Requisito de protocolo: ECOG <= ${trialEcogMax}`,
        isExclusion: false,
        missingAction: `Documentar Performance Status ECOG (protocolo requiere ECOG <= ${trialEcogMax})`
      });
    }
  }

  // Biomarcadores adicionales del ensayo
  const trialText = `${trial.title} ${trial.conditions.join(' ')} ${trial.eligibilityCriteria}`.toUpperCase();
  for (const tBio of trial.biomarkers) {
    const hasDoc = patient.biomarkersDocumented.some(b => b.name.toUpperCase().includes(tBio) || tBio.includes(b.name.toUpperCase()));
    const alreadyEvaluated = criteriaEvaluations.some(c => c.name.toUpperCase().includes(tBio));
    if (!hasDoc && !alreadyEvaluated && trialText.includes(tBio)) {
      const bioItem = `Solicitar/documentar estado de ${tBio} requerido por el protocolo`;
      if (!missingItems.includes(bioItem)) missingItems.push(bioItem);
      if (!missingData.includes(`Estado del biomarcador ${tBio} [No documentado]`)) {
        missingData.push(`Estado del biomarcador ${tBio} [No documentado]`);
      }
    }
  }

  // 4. ASIGNACIÓN DEL ESTADO GLOBAL DE PRE-SCREENING
  let category: MatchCategory = 'not_compatible';
  let categoryLabel = 'No cumple criterio documentado';
  let categoryBadge = '🔴 No cumple criterio documentado';

  const hasMissingInfo = missingData.length > 0 || 
                         missingItems.length > 0 || 
                         criteriaEvaluations.some(c => c.status === 'NO DOCUMENTADO');

  const hasUnstructuredOrNonEvaluable = unstructuredCriteriaCount > 0 || 
                                        criteriaEvaluations.some(c => c.status === 'NO EVALUABLE');

  if (incompatibilities.length > 0) {
    category = 'not_compatible';
    categoryLabel = 'No cumple criterio documentado';
    categoryBadge = '🔴 No cumple criterio documentado';
  } else if (!criteria || criteria.length === 0) {
    category = 'not_evaluable';
    categoryLabel = 'No evaluable';
    categoryBadge = '⚪ No evaluable';
  } else if (hasMissingInfo || hasUnstructuredOrNonEvaluable) {
    category = 'potential_missing_data';
    categoryLabel = 'Potencialmente elegible — falta información';
    categoryBadge = '🟡 Potencialmente elegible — falta información';
  } else if (criteriaEvaluations.length > 0 && criteriaEvaluations.every(c => c.status === 'CUMPLE')) {
    category = 'potential_candidate';
    categoryLabel = 'Potencialmente elegible';
    categoryBadge = '🟢 Potencialmente elegible';
  } else {
    category = 'not_evaluable';
    categoryLabel = 'No evaluable';
    categoryBadge = '⚪ No evaluable';
  }

  // 5. CÁLCULO DEL SCORE DE RANKING DETERMINÍSTICO
  let score = 0;
  if (trial.status === 'RECRUITING') score += 100;
  else if (trial.status === 'NOT_YET_RECRUITING') score += 50;

  if (isCordobaSiteRecruiting(trial)) score += 60;
  else if (trial.hasCordobaCenter) score += 20;

  if (category === 'potential_candidate') score += 50;
  else if (category === 'potential_missing_data') score += 20;
  else if (category === 'not_evaluable') score -= 50;
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
    requiredVerificationNotice: REQUIRED_NOTICE,
    criteriaEvaluations,
    missingItems,
    unstructuredCriteriaCount
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
    // Incluir ensayos relevantes para la patología del paciente o que tengan potencial compatibilidad
    const isRelevantOrgan = trial.tumorTypes.includes(profile.organOrSite || '') || trial.tumorTypes.includes('solido_agnostico');
    if (isRelevantOrgan || result.category !== 'not_compatible') {
      trialResults.push(result);
    }
  }

  // Ordenar resultados según pre-screening:
  // 1. Categoría: 🟢 candidate > 🟡 missing_data > ⚪ not_evaluable > 🔴 not_compatible
  // 2. Recruiting
  // 3. Centro en Córdoba
  // 4. Score
  // 5. Menor cantidad de datos faltantes
  const categoryRank = (cat: MatchCategory): number => {
    switch (cat) {
      case 'potential_candidate': return 0;
      case 'potential_missing_data': return 1;
      case 'not_evaluable': return 2;
      case 'not_compatible': return 3;
    }
  };

  trialResults.sort((a, b) => {
    const rankDiff = categoryRank(a.category) - categoryRank(b.category);
    if (rankDiff !== 0) return rankDiff;

    const aRecruiting = a.trial.status === 'RECRUITING' ? 1 : 0;
    const bRecruiting = b.trial.status === 'RECRUITING' ? 1 : 0;
    if (aRecruiting !== bRecruiting) return bRecruiting - aRecruiting;

    const aCordoba = a.trial.hasCordobaCenter ? 1 : 0;
    const bCordoba = b.trial.hasCordobaCenter ? 1 : 0;
    if (aCordoba !== bCordoba) return bCordoba - aCordoba;

    if (a.score !== b.score) return b.score - a.score;

    return a.missingData.length - b.missingData.length;
  });

  const potentialCandidateCount = trialResults.filter(r => r.category === 'potential_candidate').length;
  const potentialMissingDataCount = trialResults.filter(r => r.category === 'potential_missing_data').length;
  const notCompatibleCount = trialResults.filter(r => r.category === 'not_compatible').length;
  const notEvaluableCount = trialResults.filter(r => r.category === 'not_evaluable').length;

  let bestCategory: MatchCategory = 'not_compatible';
  if (potentialCandidateCount > 0) bestCategory = 'potential_candidate';
  else if (potentialMissingDataCount > 0) bestCategory = 'potential_missing_data';
  else if (notEvaluableCount > 0) bestCategory = 'not_evaluable';

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
    notCompatibleCount,
    notEvaluableCount,
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
