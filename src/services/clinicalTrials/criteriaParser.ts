import {
  StructuredCriterion,
  CriterionType,
  StructuredCriterionDetails
} from '../../types/clinicalTrials';

export interface ParsedCriteriaResult {
  structuredCriteria: StructuredCriterion[];
  ecogMaxAdmissible?: number;
}

/**
 * Normaliza texto para búsqueda segura eliminando puntuación redundante
 */
function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * 1. PARSEO DE CRITERIO ECOG / PERFORMANCE STATUS
 * REGLA ESTRICTA: Solo estructurar cuando el texto mencione explícitamente ECOG / Zubrod.
 * Nunca asumir valores no escritos.
 */
export function parseEcogLine(line: string, criterionType: CriterionType): StructuredCriterion | null {
  const norm = cleanText(line);
  if (!/\b(ecog|eastern cooperative oncology group|zubrod)\b/i.test(norm)) {
    return null;
  }

  let ecogMin: number | undefined = undefined;
  let ecogMax: number | undefined = undefined;
  let operator: string | undefined = undefined;

  // Patrón: "ECOG ... 0-1" o "0 to 1" o "0 or 1"
  const rangeMatch = norm.match(/\bECOG\s*(?:performance\s*status|PS)?\s*(?:of|is|:)?\s*([0-4])\s*(?:to|-|or)\s*([0-4])\b/i);
  if (rangeMatch) {
    ecogMin = parseInt(rangeMatch[1], 10);
    ecogMax = parseInt(rangeMatch[2], 10);
    operator = 'BETWEEN';
  } else {
    // Patrón: "ECOG ... <= 1" o "≤ 2" o "=< 1"
    const lteMatch = norm.match(/\bECOG\s*(?:performance\s*status|PS)?\s*(?:<=|≤|=<|<)\s*([0-4])\b/i);
    if (lteMatch) {
      ecogMin = 0;
      ecogMax = parseInt(lteMatch[1], 10);
      operator = '<=';
    } else {
      // Patrón: "ECOG ... 0, 1, or 2"
      const commaMatch = norm.match(/\bECOG\s*(?:performance\s*status|PS)?\s*(?:of|:)?\s*0\s*,\s*1\s*(?:,\s*(?:or\s*)?2)?\b/i);
      if (commaMatch) {
        ecogMin = 0;
        ecogMax = commaMatch[0].includes('2') ? 2 : 1;
        operator = 'BETWEEN';
      } else {
        // Patrón: "ECOG 0" o "ECOG 1" exacto
        const exactMatch = norm.match(/\bECOG\s*(?:performance\s*status|PS)?\s*(?:of|:)?\s*([0-4])\b/i);
        if (exactMatch) {
          const val = parseInt(exactMatch[1], 10);
          ecogMin = 0;
          ecogMax = val;
          operator = '<=';
        }
      }
    }
  }

  if (ecogMax !== undefined) {
    const details: StructuredCriterionDetails = {
      ecogMin: ecogMin ?? 0,
      ecogMax
    };
    return {
      id: `crit_ecog_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'ECOG',
      operator: operator || '<=',
      value: { min: ecogMin ?? 0, max: ecogMax },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details
    };
  }

  // Si menciona ECOG pero con sintaxis inusual/ambigua:
  return {
    id: `crit_ecog_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
    criterionType,
    category: 'ECOG',
    mandatory: true,
    sourceText: line,
    parseStatus: 'PARTIALLY_STRUCTURED',
    confidence: 'MEDIUM'
  };
}

/**
 * 2. PARSEO DE BIOMARCADORES Y ALTERACIONES MOLECULARES ESPECÍFICAS
 * REGLA ESTRICTA: No inferir 'wild-type' ni mutaciones si no están explícitas.
 */
export function parseBiomarkerLine(line: string, criterionType: CriterionType): StructuredCriterion | null {
  const norm = cleanText(line);

  // EGFR
  if (/\bEGFR\b/i.test(norm)) {
    let specificAlteration: string | undefined = undefined;
    let statusRequired: StructuredCriterionDetails['statusRequired'] = 'ANY';

    if (/\b(?:exon\s*19\s*del(?:etion)?|ex19del|19del)\b/i.test(norm)) {
      specificAlteration = 'Exon 19 del';
      statusRequired = 'MUTATED';
    } else if (/\bL858R\b/i.test(norm)) {
      specificAlteration = 'L858R';
      statusRequired = 'MUTATED';
    } else if (/\b(?:mutant|mutation[- ]positive|mutated|activating\s*mutation)\b/i.test(norm)) {
      statusRequired = 'MUTATED';
    } else if (/\b(?:wild[- ]type|wt|non[- ]mutated|negative)\b/i.test(norm)) {
      statusRequired = 'WILD_TYPE';
    }

    if (statusRequired !== 'ANY' || specificAlteration) {
      return {
        id: `crit_bio_egfr_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
        criterionType,
        category: specificAlteration ? 'MOLECULAR_ALTERATION' : 'BIOMARKER',
        operator: 'EQUALS',
        value: { gene: 'EGFR', status: statusRequired, alteration: specificAlteration },
        mandatory: true,
        sourceText: line,
        parseStatus: 'STRUCTURED',
        confidence: 'HIGH',
        details: {
          gene: 'EGFR',
          statusRequired,
          specificAlteration
        }
      };
    }
  }

  // KRAS
  if (/\bKRAS\b/i.test(norm)) {
    let specificAlteration: string | undefined = undefined;
    let statusRequired: StructuredCriterionDetails['statusRequired'] = 'ANY';

    if (/\bG12C\b/i.test(norm)) {
      specificAlteration = 'G12C';
      statusRequired = 'MUTATED';
    } else if (/\b(?:mutant|mutation[- ]positive|mutated)\b/i.test(norm)) {
      statusRequired = 'MUTATED';
    } else if (/\b(?:wild[- ]type|wt|non[- ]mutated)\b/i.test(norm)) {
      statusRequired = 'WILD_TYPE';
    }

    if (statusRequired !== 'ANY' || specificAlteration) {
      return {
        id: `crit_bio_kras_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
        criterionType,
        category: specificAlteration ? 'MOLECULAR_ALTERATION' : 'BIOMARKER',
        operator: 'EQUALS',
        value: { gene: 'KRAS', status: statusRequired, alteration: specificAlteration },
        mandatory: true,
        sourceText: line,
        parseStatus: 'STRUCTURED',
        confidence: 'HIGH',
        details: {
          gene: 'KRAS',
          statusRequired,
          specificAlteration
        }
      };
    }
  }

  // BRAF
  if (/\bBRAF\b/i.test(norm)) {
    let specificAlteration: string | undefined = undefined;
    let statusRequired: StructuredCriterionDetails['statusRequired'] = 'ANY';

    if (/\bV600E\b/i.test(norm)) {
      specificAlteration = 'V600E';
      statusRequired = 'MUTATED';
    } else if (/\bV600\b/i.test(norm)) {
      specificAlteration = 'V600';
      statusRequired = 'MUTATED';
    } else if (/\b(?:mutant|mutation[- ]positive|mutated)\b/i.test(norm)) {
      statusRequired = 'MUTATED';
    } else if (/\b(?:wild[- ]type|wt|non[- ]mutated)\b/i.test(norm)) {
      statusRequired = 'WILD_TYPE';
    }

    if (statusRequired !== 'ANY' || specificAlteration) {
      return {
        id: `crit_bio_braf_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
        criterionType,
        category: specificAlteration ? 'MOLECULAR_ALTERATION' : 'BIOMARKER',
        operator: 'EQUALS',
        value: { gene: 'BRAF', status: statusRequired, alteration: specificAlteration },
        mandatory: true,
        sourceText: line,
        parseStatus: 'STRUCTURED',
        confidence: 'HIGH',
        details: {
          gene: 'BRAF',
          statusRequired,
          specificAlteration
        }
      };
    }
  }

  // HER2 / ERBB2
  if (/\b(her2|erbb2)\b/i.test(norm)) {
    let statusRequired: StructuredCriterionDetails['statusRequired'] = 'ANY';
    if (/\b(?:positive|overexpressing|amplified|3\+|ihc\s*3\+)\b/i.test(norm)) {
      statusRequired = 'POSITIVE';
    } else if (/\b(?:negative|0|1\+|non[- ]amplified)\b/i.test(norm)) {
      statusRequired = 'NEGATIVE';
    }

    if (statusRequired !== 'ANY') {
      return {
        id: `crit_bio_her2_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
        criterionType,
        category: 'BIOMARKER',
        operator: 'EQUALS',
        value: { gene: 'HER2', status: statusRequired },
        mandatory: true,
        sourceText: line,
        parseStatus: 'STRUCTURED',
        confidence: 'HIGH',
        details: {
          gene: 'HER2',
          statusRequired
        }
      };
    }
  }

  // MSI / MMR
  if (/\b(msi-h|dmmr|msi\s*high|microsatellite\s*instability-high)\b/i.test(norm)) {
    return {
      id: `crit_bio_msi_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'BIOMARKER',
      operator: 'EQUALS',
      value: { gene: 'MSI/MMR', status: 'POSITIVE' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        gene: 'MSI/MMR',
        statusRequired: 'POSITIVE'
      }
    };
  }

  if (/\b(mss|pmmr|microsatellite\s*stable)\b/i.test(norm)) {
    return {
      id: `crit_bio_mss_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'BIOMARKER',
      operator: 'EQUALS',
      value: { gene: 'MSI/MMR', status: 'NEGATIVE' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        gene: 'MSI/MMR',
        statusRequired: 'NEGATIVE'
      }
    };
  }

  // ALK / ROS1
  if (/\b(alk|ros1)\b/i.test(norm)) {
    const gene = /\balk\b/i.test(norm) ? 'ALK' : 'ROS1';
    let statusRequired: StructuredCriterionDetails['statusRequired'] = 'ANY';
    if (/\b(?:positive|rearrangement|fusion|translocation)\b/i.test(norm)) {
      statusRequired = 'POSITIVE';
    } else if (/\b(?:negative|non[- ]rearranged)\b/i.test(norm)) {
      statusRequired = 'NEGATIVE';
    }

    if (statusRequired !== 'ANY') {
      return {
        id: `crit_bio_${gene.toLowerCase()}_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
        criterionType,
        category: 'BIOMARKER',
        operator: 'EQUALS',
        value: { gene, status: statusRequired },
        mandatory: true,
        sourceText: line,
        parseStatus: 'STRUCTURED',
        confidence: 'HIGH',
        details: {
          gene,
          statusRequired
        }
      };
    }
  }

  // PD-L1
  if (/\bpd-?l1\b/i.test(norm)) {
    const thresholdMatch = norm.match(/\b(?:tps|cps|expression)?\s*(?:>=|≥|>)\s*(\d+)%?\b/i);
    const minNumericThreshold = thresholdMatch ? parseInt(thresholdMatch[1], 10) : undefined;
    const statusRequired = minNumericThreshold ? 'POSITIVE' : (/\bpositive\b/i.test(norm) ? 'POSITIVE' : 'ANY');

    return {
      id: `crit_bio_pdl1_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'BIOMARKER',
      operator: minNumericThreshold ? '>=' : 'EQUALS',
      value: { gene: 'PD-L1', minThreshold: minNumericThreshold },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        gene: 'PD-L1',
        statusRequired,
        minNumericThreshold
      }
    };
  }

  return null;
}

/**
 * 3. PARSEO DE CRITERIOS NUMÉRICOS DE LABORATORIO
 * REGLA ESTRICTA: Solo estructurar si parámetro, operador y umbral están claros.
 * Si es ambiguo o carece de unidad/referencia clara: mantener UNSTRUCTURED.
 */
export function parseLabCriterion(line: string, criterionType: CriterionType): StructuredCriterion | null {
  const norm = cleanText(line);

  // Bilirrubina total (ej. "total bilirubin <= 1.5 x ULN")
  const biliMatch = norm.match(/\b(?:total\s*)?bilirubin\s*(?:<=|≤|=<|<)\s*(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(?:ULN|upper limit of normal)\b/i);
  if (biliMatch) {
    const val = parseFloat(biliMatch[1]);
    return {
      id: `crit_lab_bili_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '<=',
      value: { parameter: 'total_bilirubin', threshold: val, reference: 'ULN' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'total_bilirubin',
        labOperator: '<=',
        labValue: val,
        labReference: 'ULN'
      }
    };
  }

  // Clearance de creatinina / ClCr (ej. "creatinine clearance >= 50 mL/min")
  const clcrMatch = norm.match(/\b(?:creatinine\s*clearance|crcl|clcr)\s*(?:>=|≥|>)\s*(\d+(?:\.\d+)?)\s*(?:ml\/min|ml\/minute)?\b/i);
  if (clcrMatch) {
    const val = parseFloat(clcrMatch[1]);
    return {
      id: `crit_lab_clcr_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '>=',
      value: { parameter: 'creatinine_clearance', threshold: val, unit: 'mL/min' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'creatinine_clearance',
        labOperator: '>=',
        labValue: val,
        labUnit: 'mL/min'
      }
    };
  }

  // Creatinina sérica (ej. "serum creatinine <= 1.5 x ULN")
  const crMatch = norm.match(/\b(?:serum\s*)?creatinine\s*(?:<=|≤|=<|<)\s*(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(?:ULN|upper limit of normal)\b/i);
  if (crMatch) {
    const val = parseFloat(crMatch[1]);
    return {
      id: `crit_lab_cr_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '<=',
      value: { parameter: 'creatinine', threshold: val, reference: 'ULN' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'creatinine',
        labOperator: '<=',
        labValue: val,
        labReference: 'ULN'
      }
    };
  }

  // AST / ALT transaminasas (ej. "AST and ALT <= 2.5 x ULN")
  const transMatch = norm.match(/\b(?:ast(?:\s*and\s*alt)?|alt|sgot|sgpt|transaminases)\s*(?:<=|≤|=<|<)\s*(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(?:ULN|upper limit of normal)\b/i);
  if (transMatch) {
    const val = parseFloat(transMatch[1]);
    return {
      id: `crit_lab_trans_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '<=',
      value: { parameter: 'transaminases', threshold: val, reference: 'ULN' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'ast',
        labOperator: '<=',
        labValue: val,
        labReference: 'ULN'
      }
    };
  }

  // Plaquetas (ej. "platelets >= 100,000 /uL" o ">= 100 x 10^9/L")
  const plqMatch = norm.match(/\bplatelet(?:s|\s*count)?\s*(?:>=|≥|>)\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:x\s*10\^?9\/[lL]|\/u[lL]|\/mm3|\/mc[lL]|k\/u[lL])?\b/i);
  if (plqMatch) {
    const rawNum = plqMatch[1].replace(/,/g, '');
    let val = parseFloat(rawNum);
    if (val < 1000 && !norm.includes('10^9')) val = val * 1000; // ej. 100k -> 100000
    return {
      id: `crit_lab_plq_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '>=',
      value: { parameter: 'platelets', threshold: val, unit: '/uL' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'platelets',
        labOperator: '>=',
        labValue: val,
        labUnit: '/uL'
      }
    };
  }

  // Neutrófilos / ANC (ej. "ANC >= 1,500 /uL" o "absolute neutrophil count >= 1.5 x 10^9/L")
  const ancMatch = norm.match(/\b(?:absolute\s*neutrophil\s*count|anc)\s*(?:>=|≥|>)\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:x\s*10\^?9\/[lL]|\/u[lL]|\/mm3|\/mc[lL])?\b/i);
  if (ancMatch) {
    const rawNum = ancMatch[1].replace(/,/g, '');
    let val = parseFloat(rawNum);
    if (val < 100 && !norm.includes('10^9')) val = val * 1000;
    return {
      id: `crit_lab_anc_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '>=',
      value: { parameter: 'neutrophils', threshold: val, unit: '/uL' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'neutrophils',
        labOperator: '>=',
        labValue: val,
        labUnit: '/uL'
      }
    };
  }

  // Hemoglobina (ej. "hemoglobin >= 9.0 g/dL")
  const hbMatch = norm.match(/\b(?:hemoglobin|hb)\s*(?:>=|≥|>)\s*(\d+(?:\.\d+)?)\s*(?:g\/d[lL]|g\/[lL])?\b/i);
  if (hbMatch) {
    const val = parseFloat(hbMatch[1]);
    return {
      id: `crit_lab_hb_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LAB',
      operator: '>=',
      value: { parameter: 'hemoglobin', threshold: val, unit: 'g/dL' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        labParameter: 'hemoglobin',
        labOperator: '>=',
        labValue: val,
        labUnit: 'g/dL'
      }
    };
  }

  return null;
}

/**
 * 4. PARSEO DE TRATAMIENTOS PREVIOS Y LÍNEAS DE TRATAMIENTO
 */
export function parseTreatmentLine(line: string, criterionType: CriterionType): StructuredCriterion | null {
  const norm = cleanText(line);

  // Treatment-naïve / No prior systemic therapy
  if (/\b(?:treatment[- ]na[iï]ve|no\s*prior\s*(?:systemic\s*)?(?:chemotherapy|anticancer\s*therapy|treatment))\b/i.test(norm)) {
    return {
      id: `crit_tx_naive_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'PRIOR_TREATMENT',
      operator: 'EQUALS',
      value: { requirement: 'TREATMENT_NAIVE' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        treatmentRequirement: 'TREATMENT_NAIVE',
        maxLines: 0
      }
    };
  }

  // Prior platinum therapy
  if (/\b(?:prior|previous)\s*(?:platinum|platinum[- ]based)\b/i.test(norm)) {
    const requirement = criterionType === 'inclusion' ? 'MUST_HAVE_RECEIVED' : 'FORBIDDEN';
    return {
      id: `crit_tx_plat_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'PRIOR_TREATMENT',
      operator: 'EQUALS',
      value: { treatment: 'platinum', requirement },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        treatmentName: 'platinum',
        treatmentRequirement: requirement
      }
    };
  }

  // Prior immunotherapy / Anti-PD-1
  if (/\b(?:prior|previous)\s*(?:immunotherapy|anti[- ]pd-?1|anti[- ]pdl1|checkpoint\s*inhibitor)\b/i.test(norm)) {
    const requirement = criterionType === 'inclusion' ? 'MUST_HAVE_RECEIVED' : 'FORBIDDEN';
    return {
      id: `crit_tx_io_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'PRIOR_TREATMENT',
      operator: 'EQUALS',
      value: { treatment: 'immunotherapy', requirement },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        treatmentName: 'immunotherapy',
        treatmentRequirement: requirement
      }
    };
  }

  // Prior EGFR TKI
  if (/\b(?:prior|previous)\s*(?:egfr[- ]tki|egfr\s*inhibitor|osimertinib)\b/i.test(norm)) {
    const requirement = criterionType === 'inclusion' ? 'MUST_HAVE_RECEIVED' : 'FORBIDDEN';
    return {
      id: `crit_tx_egfr_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'PRIOR_TREATMENT',
      operator: 'EQUALS',
      value: { treatment: 'egfr_inhibitor', requirement },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        treatmentName: 'egfr_inhibitor',
        treatmentRequirement: requirement
      }
    };
  }

  // Líneas previas (ej. ">= 1 prior line" o "<= 2 prior lines")
  const linesMatch = norm.match(/\b(?:>=|≥|at least)\s*([1-3])\s*prior\s*(?:line|regimen)/i);
  if (linesMatch) {
    const minL = parseInt(linesMatch[1], 10);
    return {
      id: `crit_line_min_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LINE_OF_THERAPY',
      operator: '>=',
      value: { minLines: minL },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        minLines: minL
      }
    };
  }

  const maxLinesMatch = norm.match(/\b(?:<=|≤|no more than)\s*([1-3])\s*prior\s*(?:lines|regimens)/i);
  if (maxLinesMatch) {
    const maxL = parseInt(maxLinesMatch[1], 10);
    return {
      id: `crit_line_max_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'LINE_OF_THERAPY',
      operator: '<=',
      value: { maxLines: maxL },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        maxLines: maxL
      }
    };
  }

  return null;
}

/**
 * 5. PARSEO DE ESTADIO Y ESCENARIO CLÍNICO
 */
export function parseStageAndScenario(line: string, criterionType: CriterionType): StructuredCriterion | null {
  const norm = cleanText(line);

  // Estadio IV explícito
  if (/\b(?:stage\s*IV|stage\s*4|estadio\s*IV)\b/i.test(norm)) {
    return {
      id: `crit_stage_iv_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'STAGE',
      operator: 'EQUALS',
      value: { stage: 'IV' },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        stage: 'IV'
      }
    };
  }

  // Escenario metastásico / irresecable / recurrente
  if (/\b(metastatic|unresectable|locally\s*advanced|recurrent|relapsed)\b/i.test(norm)) {
    const scenario = /\bmetastatic\b/i.test(norm)
      ? 'metastatic'
      : /\bunresectable\b/i.test(norm)
      ? 'unresectable'
      : /\brecurrent|relapsed\b/i.test(norm)
      ? 'recurrent'
      : 'locally_advanced';

    return {
      id: `crit_scenario_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
      criterionType,
      category: 'CLINICAL_SCENARIO',
      operator: 'EQUALS',
      value: { scenario },
      mandatory: true,
      sourceText: line,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        scenario
      }
    };
  }

  return null;
}

/**
 * 6. PARSEO DE METÁSTASIS CEREBRALES / SNC
 */
export function parseCnsMetastasis(line: string, criterionType: CriterionType): StructuredCriterion | null {
  const norm = cleanText(line);
  if (!/\b(brain|cns|central nervous system|cerebral|meningeal|leptomeningeal)\s*metasta/i.test(norm)) {
    return null;
  }

  let cnsRule: StructuredCriterionDetails['cnsRule'] = 'STRICTLY_EXCLUDED';
  if (/\b(?:treated\s*and\s*stable|asymptomatic|stable\s*for|controlled)\b/i.test(norm)) {
    cnsRule = 'STABLE_TREATED_ALLOWED';
  } else if (/\b(?:active|untreated|symptomatic|progressive)\b/i.test(norm)) {
    cnsRule = 'ACTIVE_EXCLUDED';
  }

  return {
    id: `crit_cns_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
    criterionType,
    category: 'CNS_METASTASIS',
    operator: 'EQUALS',
    value: { cnsRule },
    mandatory: true,
    sourceText: line,
    parseStatus: 'STRUCTURED',
    confidence: 'HIGH',
    details: {
      cnsRule
    }
  };
}

/**
 * PARSEA UNA LÍNEA INDIVIDUAL CONTEXTUALMENTE
 * Si no encaja en ninguna categoría segura o es ambigua:
 * retorna un criterio UNSTRUCTURED preservando el texto original íntegro.
 */
export function parseSingleCriterionLine(line: string, criterionType: CriterionType): StructuredCriterion {
  // Intentar los parsers en orden de especificidad clínica
  const ecog = parseEcogLine(line, criterionType);
  if (ecog) return ecog;

  const bio = parseBiomarkerLine(line, criterionType);
  if (bio) return bio;

  const lab = parseLabCriterion(line, criterionType);
  if (lab) return lab;

  const tx = parseTreatmentLine(line, criterionType);
  if (tx) return tx;

  const stage = parseStageAndScenario(line, criterionType);
  if (stage) return stage;

  const cns = parseCnsMetastasis(line, criterionType);
  if (cns) return cns;

  // Fallback seguro: Si existe duda o no se puede estructurar de forma determinista,
  // se preserva como UNSTRUCTURED con sourceText intacto.
  return {
    id: `crit_unstructured_${criterionType}_${Math.random().toString(36).substring(2, 9)}`,
    criterionType,
    category: 'OTHER',
    mandatory: false,
    sourceText: line,
    parseStatus: 'UNSTRUCTURED',
    confidence: 'LOW'
  };
}

/**
 * PARSEA EL CONJUNTO COMPLETO DE CRITERIOS DE UN ESTUDIO
 * Genera la lista de `StructuredCriterion` y determina si el protocolo
 * explicita un `ecogMaxAdmissible` real.
 */
export function parseStructuredCriteria(params: {
  inclusionLines: string[];
  exclusionLines: string[];
  minimumAgeYears?: number;
  maximumAgeYears?: number;
  sex?: 'ALL' | 'FEMALE' | 'MALE';
}): ParsedCriteriaResult {
  const { inclusionLines = [], exclusionLines = [], minimumAgeYears, maximumAgeYears, sex } = params;
  const structuredCriteria: StructuredCriterion[] = [];
  let ecogMaxAdmissible: number | undefined = undefined;

  // Criterio de edad demográfica (si está presente en metadatos del estudio)
  const normMin = typeof minimumAgeYears === 'number' && !isNaN(minimumAgeYears) && minimumAgeYears >= 0 
    ? minimumAgeYears 
    : (typeof minimumAgeYears === 'string' && (minimumAgeYears as any).trim() !== '' && !isNaN(Number(minimumAgeYears)) ? Number(minimumAgeYears) : undefined);
  const validMin = normMin !== undefined && !isNaN(normMin) ? normMin : undefined;

  const normMax = typeof maximumAgeYears === 'number' && !isNaN(maximumAgeYears) && maximumAgeYears > 0 
    ? maximumAgeYears 
    : (typeof maximumAgeYears === 'string' && (maximumAgeYears as any).trim() !== '' && !isNaN(Number(maximumAgeYears)) && Number(maximumAgeYears) > 0 ? Number(maximumAgeYears) : undefined);
  const validMax = normMax !== undefined && !isNaN(normMax) && normMax > 0 ? normMax : undefined;

  if (validMin !== undefined || validMax !== undefined) {
    const ageText = `Age >= ${validMin ?? 0}${validMax !== undefined ? ` and <= ${validMax}` : ''} years`;
    structuredCriteria.push({
      id: `crit_age_${Math.random().toString(36).substring(2, 9)}`,
      criterionType: 'inclusion',
      category: 'AGE',
      operator: validMax !== undefined ? 'BETWEEN' : '>=',
      value: { min: validMin, max: validMax },
      mandatory: true,
      sourceText: ageText,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH',
      details: {
        minNumericThreshold: validMin
      }
    });
  }

  // Criterio de sexo (si no es 'ALL')
  if (sex && sex !== 'ALL') {
    structuredCriteria.push({
      id: `crit_sex_${Math.random().toString(36).substring(2, 9)}`,
      criterionType: 'inclusion',
      category: 'SEX',
      operator: 'EQUALS',
      value: sex,
      mandatory: true,
      sourceText: `Sex: ${sex}`,
      parseStatus: 'STRUCTURED',
      confidence: 'HIGH'
    });
  }

  // Criterios de Inclusión
  for (const line of inclusionLines) {
    if (!line || line.trim().length < 5) continue;
    const parsed = parseSingleCriterionLine(line, 'inclusion');
    structuredCriteria.push(parsed);

    if (parsed.category === 'ECOG' && parsed.details?.ecogMax !== undefined) {
      if (ecogMaxAdmissible === undefined || parsed.details.ecogMax > ecogMaxAdmissible) {
        ecogMaxAdmissible = parsed.details.ecogMax;
      }
    }
  }

  // Criterios de Exclusión
  for (const line of exclusionLines) {
    if (!line || line.trim().length < 5) continue;
    const parsed = parseSingleCriterionLine(line, 'exclusion');
    structuredCriteria.push(parsed);
  }

  return {
    structuredCriteria,
    ecogMaxAdmissible
  };
}
