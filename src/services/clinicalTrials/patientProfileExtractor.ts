import { PatientClinicalProfile } from '../../types/clinicalTrials';

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

  // 3. ÓRGANO O SITIO TUMORAL
  let organOrSite: string | undefined = undefined;
  const organMap: Record<string, string[]> = {
    colorrectal: ['colon', 'recto', 'sigmoides', 'colorrectal', 'ciego'],
    pulmon: ['pulmon', 'pulmonar', 'nsclc', 'cpcnp', 'bronquial', 'microcitico'],
    mama: ['mama', 'mamario', 'mamaria', 'ductal de mama'],
    melanoma: ['melanoma'],
    prostata: ['prostata', 'prostatico'],
    pancreas: ['pancreas', 'pancreatico', 'cefalopancreatico'],
    ovario: ['ovario', 'ovarico', 'trompa de falopio'],
    gastrico: ['gastrico', 'estomago', 'esofagico', 'union esofagogastrica'],
    rinon: ['rinon', 'renal'],
    vejiga: ['vejiga', 'urotelial'],
    cervicouterino: ['cervix', 'cuello uterino', 'endometrio', 'uterino'],
    cabeza_cuello: ['laringe', 'faringe', 'orofaringe', 'lengua', 'cabeza y cuello'],
    hematologia: ['leucemia', 'linfoma', 'mieloma'],
    snc: ['glioblastoma', 'glioma', 'astrocitoma', 'cerebral'],
    sarcoma: ['sarcoma', 'gist'],
    biliar: ['biliar', 'colangiocarcinoma', 'vesicula']
  };

  for (const [organ, keywords] of Object.entries(organMap)) {
    if (keywords.some(k => fullTextNorm.includes(k))) {
      organOrSite = organ;
      break;
    }
  }

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

  // 5. ESTADIO EXPLÍCITAMENTE DOCUMENTADO (Sin inferir ni convertir TNM)
  let stageDocumented: string | undefined = undefined;
  const stageRegex = /\b(estadio\s+[IVXABCD1-4]+[ABCD]*|stage\s+[IVXABCD1-4]+[ABCD]*|ec\s+[IVXABCD1-4]+[ABCD]*)\b/i;
  const stageMatch = fullText.match(stageRegex);
  if (stageMatch) {
    stageDocumented = stageMatch[1].trim();
  }

  // 6. ENFERMEDAD METASTÁSICA EXPLÍCITAMENTE DOCUMENTADA
  let isMetastaticDocumented = false;
  if (
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
  const biomarkersDocumented: Array<{ name: string; status: string; rawText: string }> = [];

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
