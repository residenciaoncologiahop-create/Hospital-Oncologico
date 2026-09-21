import { PatientClinicalProfile } from '../../types/clinicalTrials';
import type { StageCategory, BiomarkerEntry } from '../../utils/computePatientProfile';

/**
 * Normaliza cadenas removiendo tildes y caracteres especiales para búsqueda segura
 */
function normalize(str: string = ''): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Detecta el tumor primario del paciente con máxima rigurosidad oncológica.
 * REGLAS CLÍNICAS FUNDAMENTALES:
 * 1. El tumor primario se extrae PRIMERO del diagnóstico explícito (patient.diagnosis).
 * 2. Si el diagnóstico contiene secundarismo (ej. "Cáncer de Colon con metástasis pulmonares"),
 *    el órgano primario es COLON, NUNCA pulmón ni hígado.
 * 3. NUNCA se debe barrer el cuerpo completo de la historia clínica (estudios de imágenes, antecedentes)
 *    para definir el tumor primario si el diagnóstico ya identifica el órgano.
 */
export function detectPrimaryTumorOrgan(diagnosisRaw: string = '', historyText: string = ''): string | undefined {
  const diagNorm = normalize(diagnosisRaw);

  // 1. EVALUAR DIAGNÓSTICO EXPLÍCITO (PRIORIDAD ABSOLUTA)
  if (diagNorm) {
    // MAMA (ej. "CA MAMA", "Cáncer de mama", "Carcinoma ductal invasor de mama")
    if (
      /\b(mama|mamari[ao]|seno)\b/i.test(diagNorm) ||
      /\bca\s+mama\b/i.test(diagNorm) ||
      /\b(cdi|cli)\s+mama\b/i.test(diagNorm)
    ) {
      return 'mama';
    }

    // COLORRECTAL (ej. "Adenocarcinoma de Colon Sigmoides", "Cáncer de recto")
    if (
      /\b(colon|recto|rectal|colorrectal|sigmoides|ciego)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?colon\b/i.test(diagNorm) ||
      /\bccr\b/i.test(diagNorm)
    ) {
      return 'colorrectal';
    }

    // MELANOMA (ej. "Melanoma cutáneo metastásico")
    if (/\b(melanoma)\b/i.test(diagNorm)) {
      return 'melanoma';
    }

    // PÁNCREAS (ej. "Adenocarcinoma Ductal de Cabeza de Páncreas")
    if (
      /\b(pancreas|pancreatico|cefalopancreatico|cabeza.*pancreas)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?pancreas\b/i.test(diagNorm)
    ) {
      return 'pancreas';
    }

    // PRÓSTATA (ej. "Adenocarcinoma de próstata")
    if (
      /\b(prostata|prostatico)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?prostata\b/i.test(diagNorm)
    ) {
      return 'prostata';
    }

    // PULMÓN (ej. "Adenocarcinoma de pulmón", "NSCLC", "CPCNP", "SCLC")
    if (
      /\b(nsclc|cpcnp|sclc|cpcp|carcinoma\s+pulmonar|ca\s+(?:de\s+)?pulmon|cancer\s+(?:de\s+)?pulmon)\b/i.test(diagNorm)
    ) {
      return 'pulmon';
    }
    // Si contiene "pulmon" o "pulmonar", verificar rigurosamente que NO sea secundarismo/metástasis
    if (/\b(pulmon|pulmonar|bronquial)\b/i.test(diagNorm)) {
      if (!/met[aá]stasis.*pulmon|secundarismo.*pulmon|mtsx.*pulmon|compromiso.*pulmon|n[oó]dulo.*pulmon/i.test(diagNorm)) {
        return 'pulmon';
      }
    }

    // OVARIO
    if (
      /\b(ovario|ovarico|trompa\s+de\s+falopio)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?ovario\b/i.test(diagNorm)
    ) {
      return 'ovario';
    }

    // GÁSTRICO / ESÓFAGO
    if (
      /\b(gastrico|estomago|esofago|esofagico|union\s+esofagogastrica)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?(?:gastrico|estomago|esofago)\b/i.test(diagNorm)
    ) {
      return 'gastrico';
    }

    // RIÑÓN
    if (
      /\b(rinon|renal|ccr\s+renal|rcc|celulas\s+claras)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?(?:rinon|renal)\b/i.test(diagNorm)
    ) {
      return 'rinon';
    }

    // VEJIGA / UROTELIAL
    if (
      /\b(vejiga|urotelial|urotelio)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?vejiga\b/i.test(diagNorm)
    ) {
      return 'vejiga';
    }

    // CÉRVIX / ENDOMETRIO / ÚTERO
    if (
      /\b(cervix|cuello\s+uterino|cervicouterino|endometrio|uterino)\b/i.test(diagNorm) ||
      /\bca\s+(?:de\s+)?cervix\b/i.test(diagNorm)
    ) {
      return 'cervicouterino';
    }

    // CABEZA Y CUELLO
    if (
      /\b(cabeza\s+y\s+cuello|laringe|faringe|orofaringe|cavidad\s+oral|lengua)\b/i.test(diagNorm)
    ) {
      return 'cabeza_cuello';
    }

    // HEMATOLOGÍA
    if (
      /\b(leucemia|linfoma|mieloma|hodgkin)\b/i.test(diagNorm)
    ) {
      return 'hematologia';
    }

    // SNC
    if (
      /\b(glioblastoma|astrocitoma|glioma|tumor\s+cerebral\s+primario)\b/i.test(diagNorm)
    ) {
      return 'snc';
    }

    // VÍA BILIAR
    if (
      /\b(colangiocarcinoma|via\s+biliar|vesicula\s+biliar)\b/i.test(diagNorm)
    ) {
      return 'biliar';
    }

    // SARCOMA
    if (
      /\b(sarcoma|gist|liposarcoma|leiomiosarcoma)\b/i.test(diagNorm)
    ) {
      return 'sarcoma';
    }
  }

  // 2. SI Y SOLO SI EL DIAGNÓSTICO NO INDICA EL ÓRGANO, BUSCAR LÍNEA ESPECÍFICA EN HISTORIA
  const histNorm = normalize(historyText);
  const diagLine = histNorm.match(/(?:diagnostico|tumor\s+primario|motivo\s+de\s+consulta)[:\s]+([^\n.]+)/i);
  if (diagLine) {
    const sec = diagLine[1];
    if (/\b(mama|mamari[ao]|seno)\b/i.test(sec)) return 'mama';
    if (/\b(colon|recto|rectal|colorrectal|sigmoides)\b/i.test(sec)) return 'colorrectal';
    if (/\b(melanoma)\b/i.test(sec)) return 'melanoma';
    if (/\b(pancreas|pancreatico)\b/i.test(sec)) return 'pancreas';
    if (/\b(prostata|prostatico)\b/i.test(sec)) return 'prostata';
    if (/\b(pulmon|pulmonar|nsclc|cpcnp)\b/i.test(sec) && !/met[aá]stasis/i.test(sec)) return 'pulmon';
    if (/\b(ovario|ovarico)\b/i.test(sec)) return 'ovario';
    if (/\b(gastrico|estomago|esofago)\b/i.test(sec)) return 'gastrico';
    if (/\b(rinon|renal)\b/i.test(sec)) return 'rinon';
    if (/\b(vejiga|urotelial)\b/i.test(sec)) return 'vejiga';
    if (/\b(cervix|endometrio)\b/i.test(sec)) return 'cervicouterino';
  }

  return undefined;
}

/**
 * Extrae el perfil clínico de matching de un paciente existente de forma estrictamente conservadora.
 * REGLAS DE ORO:
 * - NO infiere datos faltantes.
 * - NO inventa biomarcadores.
 * - NO infiere ECOG.
 * - NO infiere estadio ni convierte TNM a estadio.
 * - Si un dato no está explícito en la HC, se deja como undefined / no documentado.
 */
export function extractPatientClinicalProfile(patient: any): PatientClinicalProfile {
  const historyText = patient.historyText || '';
  const diagnosisRaw = patient.diagnosis || '';
  const clinicalContext = patient.clinicalContext || '';
  const fullText = `${diagnosisRaw} \n ${historyText} \n ${clinicalContext}`;
  const fullTextNorm = normalize(fullText);

  // 1. EDAD
  let age: number | undefined = undefined;
  if (typeof patient.age === 'number' && patient.age > 0) {
    age = patient.age;
  } else if (patient.ageRange && typeof patient.ageRange === 'string') {
    const rangeMatch = patient.ageRange.match(/(\d+)/);
    if (rangeMatch) age = parseInt(rangeMatch[1], 10);
  }
  if (!age) {
    const ageMatch = fullText.match(/(\d{1,3})\s*(?:años|anos|years|yo)/i);
    if (ageMatch) {
      age = parseInt(ageMatch[1], 10);
    }
  }

  // 2. SEXO
  let sex: 'MALE' | 'FEMALE' | 'OTHER' | undefined = undefined;
  if (fullText.match(/\b(masculino|varon|hombre|male)\b/i)) {
    sex = 'MALE';
  } else if (fullText.match(/\b(femenino|mujer|female)\b/i)) {
    sex = 'FEMALE';
  }

  // 3. ÓRGANO O SITIO TUMORAL PRIMARIO
  // Prefer structured field persisted at save time; fallback to text extraction.
  const organOrSite: string | undefined =
    (patient.organOrSite as string | undefined) ||
    detectPrimaryTumorOrgan(diagnosisRaw, historyText);

  // 4. HISTOLOGÍA
  let histology: string | undefined = undefined;
  if (fullTextNorm.includes('adenocarcinoma')) {
    histology = 'Adenocarcinoma';
  } else if (fullTextNorm.includes('carcinoma ductal invasor') || fullTextNorm.includes('carcinoma ductal')) {
    histology = 'Carcinoma Ductal';
  } else if (fullTextNorm.includes('carcinoma epidermoide') || fullTextNorm.includes('carcinoma escamoso')) {
    histology = 'Carcinoma Epidermoide';
  } else if (fullTextNorm.includes('melanoma')) {
    histology = 'Melanoma';
  } else if (fullTextNorm.includes('carcinoma de celulas claras')) {
    histology = 'Carcinoma de Células Claras';
  } else if (fullTextNorm.includes('carcinoma urotelial')) {
    histology = 'Carcinoma Urotelial';
  }

  // 5. ESTADIO EXPLÍCITAMENTE DOCUMENTADO
  // Prefer structured stage computed at save time (most reliable).
  let stageDocumented: string | undefined = undefined;
  const structuredStage = patient.stage as StageCategory | undefined;
  if (structuredStage && structuredStage !== 'No consignado') {
    stageDocumented = structuredStage;
  } else {
    // Fallback: regex on free text (legacy path for patients without structured fields)
    const stageRegex = /\b(estadio\s+[IVXABCD1-4]+[ABCD]*|stage\s+[IVXABCD1-4]+[ABCD]*|ec\s+[IVXABCD1-4]+[ABCD]*)\b/i;
    const stageMatch = fullText.match(stageRegex);
    if (stageMatch) {
      stageDocumented = stageMatch[1].trim();
    }
  }

  // 6. ENFERMEDAD METASTÁSICA EXPLÍCITAMENTE DOCUMENTADA
  // Prefer structured field when available.
  let isMetastaticDocumented = false;
  if (typeof patient.isMetastatic === 'boolean') {
    isMetastaticDocumented = patient.isMetastatic;
  } else if (
    fullTextNorm.includes('metastasis') ||
    fullTextNorm.includes('metastasico') ||
    fullTextNorm.includes('metastasica') ||
    fullTextNorm.includes('estadio iv') ||
    fullTextNorm.includes('m1') ||
    fullTextNorm.includes('lesiones secundarias')
  ) {
    isMetastaticDocumented = true;
  }

  // 7. BIOMARCADORES EXPLÍCITAMENTE DOCUMENTADOS
  // Prefer structured field computed at save time when available.
  const biomarkersDocumented: Array<{ name: string; status: string; rawText: string }> = [];

  if (patient.biomarkersStructured && Array.isArray(patient.biomarkersStructured) && patient.biomarkersStructured.length > 0) {
    // Fast path: use pre-computed structured biomarkers, skip regex
    biomarkersDocumented.push(...(patient.biomarkersStructured as BiomarkerEntry[]));
  } else {
  // Slow path: extract from free text

  // KRAS
  const krasMatch = fullText.match(/KRAS\s*([A-Za-z0-9_> -]+|\bmutado\b|\bwild-type\b|\bwt\b|\bno mutado\b)/i);
  if (krasMatch) {
    const raw = krasMatch[0];
    const isMut = normalize(raw).includes('mutado') || /p\.[A-Z]\d+[A-Z]/i.test(raw) || /g\d+[a-z]/i.test(raw);
    const isWT = normalize(raw).includes('wt') || normalize(raw).includes('wild') || normalize(raw).includes('no mutado');
    biomarkersDocumented.push({
      name: 'KRAS',
      status: isMut ? 'Mutado' : isWT ? 'Wild-Type' : raw,
      rawText: raw
    });
  }

  // BRAF
  const brafMatch = fullText.match(/BRAF\s*([A-Za-z0-9_ -]+|\bmutado\b|\bwild-type\b|\bwt\b|\bno mutado\b)/i);
  if (brafMatch) {
    const raw = brafMatch[0];
    const isMut = normalize(raw).includes('v600e') || normalize(raw).includes('mutado');
    const isWT = normalize(raw).includes('wt') || normalize(raw).includes('wild') || normalize(raw).includes('no mutado');
    biomarkersDocumented.push({
      name: 'BRAF',
      status: isMut ? 'V600E Mutado' : isWT ? 'Wild-Type' : raw,
      rawText: raw
    });
  }

  // EGFR
  const egfrMatch = fullText.match(/EGFR\s*([A-Za-z0-9_ -]+|\bmutado\b|\bexon\s*19\b|\bl858r\b|\bwt\b)/i);
  if (egfrMatch) {
    const raw = egfrMatch[0];
    const isExon19 = normalize(raw).includes('exon 19') || normalize(raw).includes('del');
    const isL858R = normalize(raw).includes('l858r');
    const isWT = normalize(raw).includes('wt') || normalize(raw).includes('wild');
    biomarkersDocumented.push({
      name: 'EGFR',
      status: isExon19 ? 'Exón 19 del' : isL858R ? 'L858R' : isWT ? 'Wild-Type' : 'Mutado',
      rawText: raw
    });
  }

  // HER2
  const her2Match = fullText.match(/HER2\s*([+-]|positivo|negativo|3\+|2\+|1\+|0|amplificado|no amplificado)/i);
  if (her2Match) {
    const raw = her2Match[0];
    const isPos = normalize(raw).includes('+') || normalize(raw).includes('positivo') || normalize(raw).includes('3+');
    const isNeg = normalize(raw).includes('-') || normalize(raw).includes('negativo') || normalize(raw).includes('0') || normalize(raw).includes('1+');
    biomarkersDocumented.push({
      name: 'HER2',
      status: isPos ? 'Positivo' : isNeg ? 'Negativo' : raw,
      rawText: raw
    });
  }

  // MSI / MMR
  const msiMatch = fullText.match(/\b(MSS|MSI-H|MSI-L|pMMR|dMMR|inestabilidad microsatelital estable|inestabilidad microsatelital alta)\b/i);
  if (msiMatch) {
    const raw = msiMatch[0];
    const isMSI_H = normalize(raw).includes('msi-h') || normalize(raw).includes('dmmr') || normalize(raw).includes('alta');
    biomarkersDocumented.push({
      name: 'MSI/MMR',
      status: isMSI_H ? 'MSI-H / dMMR' : 'MSS / pMMR (Estable)',
      rawText: raw
    });
  }

  // RECEPTORES HORMONALES (MAMA)
  if (fullTextNorm.includes('luminal a') || fullTextNorm.includes('rh+') || fullTextNorm.includes('re+')) {
    biomarkersDocumented.push({
      name: 'RH (RE/RP)',
      status: 'Positivo (Luminal)',
      rawText: 'RH+ / Luminal'
    });
  }

  } // end else (slow path biomarker extraction)

  // 8. LÍNEAS Y TRATAMIENTOS PREVIOS DOCUMENTADOS
  const linesDocumented: string[] = [];
  const priorTreatments: string[] = [];

  const lineMatches = fullText.match(/(?:1ra|primera|2da|segunda|3ra|tercera)\s*l[ií]nea[^.\n]+/gi);
  if (lineMatches) {
    for (const lm of lineMatches) {
      linesDocumented.push(lm.trim());
    }
  }

  const commonDrugs = [
    'folfox', 'folfiri', 'bevacizumab', 'aflibercept', 'pembrolizumab', 'nivolumab',
    'ipilimumab', 'osimertinib', 'trastuzumab', 'pertuzumab', 'carboplatino', 'cisplatino',
    'paclitaxel', 'docetaxel', 'gemcitabina', 'capecitabina', 'tamoxifeno', 'letrozol',
    'anastrozol', 'fulvestrant', 'regorafenib', 'trifluridina'
  ];

  for (const drug of commonDrugs) {
    if (fullTextNorm.includes(drug)) {
      priorTreatments.push(drug);
    }
  }

  // 9. PROGRESIÓN DOCUMENTADA
  let progressionDocumented = false;
  if (
    fullTextNorm.includes('progresion de enfermedad') ||
    fullTextNorm.includes('pd actual') ||
    fullTextNorm.includes('recidiva') ||
    fullTextNorm.includes('progresion a 1ra linea') ||
    fullTextNorm.includes('progresion a 2da linea')
  ) {
    progressionDocumented = true;
  }

  // 10. ECOG EXPLÍCITAMENTE DOCUMENTADO
  let ecogDocumented: number | undefined = undefined;
  const ecogMatch = fullText.match(/\bECOG\s*([0-4])\b/i);
  if (ecogMatch) {
    ecogDocumented = parseInt(ecogMatch[1], 10);
  }

  // 11. LABORATORIOS DOCUMENTADOS
  const labsDocumented: PatientClinicalProfile['labsDocumented'] = {};
  const allLabs = patient.labResults || patient.labs || [];

  for (const lab of allLabs) {
    const name = normalize(lab.name || lab.test || '');
    const val = typeof lab.value === 'number' ? lab.value : parseFloat(lab.value);
    if (isNaN(val)) continue;

    if (name.includes('hemoglobina') || name === 'hb') {
      labsDocumented.hemoglobin = val;
    } else if (name.includes('plaqueta')) {
      labsDocumented.platelets = val;
    } else if (name.includes('neutrofil')) {
      labsDocumented.neutrophils = val;
    } else if (name.includes('creatinina')) {
      labsDocumented.creatinine = val;
    } else if (name.includes('bilirrubina') && (name.includes('total') || !name.includes('directa'))) {
      labsDocumented.totalBilirubin = val;
    } else if (name.includes('ast') || name.includes('got')) {
      labsDocumented.ast = val;
    } else if (name.includes('alt') || name.includes('gpt')) {
      labsDocumented.alt = val;
    }
  }

  return {
    patientId: patient.id || 'N/A',
    hcNumber: patient.hcNumber || patient.name || 'S/N',
    name: patient.name || patient.hcNumber || 'Paciente sin nombre',
    age,
    sex,
    diagnosisRaw,
    organOrSite,
    histology,
    stageDocumented,
    isMetastaticDocumented,
    biomarkersDocumented,
    linesDocumented,
    priorTreatments,
    currentTreatment: linesDocumented[linesDocumented.length - 1],
    progressionDocumented,
    ecogDocumented,
    labsDocumented
  };
}
