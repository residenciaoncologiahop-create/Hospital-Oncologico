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
 * Elimina cláusulas con negación del texto para evitar falsos positivos
 */
function removeNegatedClauses(text: string): string {
  return text
    .replace(/\b(?:sin|no\s+se\s+observan?|libre\s+de|descarta|no\s+presenta|ausencia\s+de|sin\s+evidencia\s+de|negativ[ao]\s+para)\s+[^.;,\n]{0,60}/gi, ' ')
    .replace(/\b(?:no\s+metast[aá]sico|no\s+metast[aá]sica)\b/gi, ' ');
}

export interface OrganDetectionResult {
  organOrSite?: string;
  diagnosticConflict?: {
    hasConflict: boolean;
    diagnosisInput?: string;
    historyPrimaryOrgan?: string;
    details?: string;
  };
}

/**
 * Extrae un órgano candidato a partir de un fragmento de texto oncológico
 */
function matchOrganFromSnippet(text: string): string | undefined {
  const norm = normalize(text);
  if (!norm) return undefined;

  // CÉRVIX / ENDOMETRIO / ÚTERO / VULVA
  if (
    /\b(cervix|cuello\s+uterino|cervicouterino|endometrio|endometrial|uterino|utero|vulva|vulvar)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?(?:cervix|cuello|endometrio|vulva)\b/i.test(norm)
  ) {
    return 'cervicouterino';
  }

  // MAMA
  if (
    /\b(mama|mamari[ao]|seno)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?mama\b/i.test(norm) ||
    /\b(cdi|cli)\s+mama\b/i.test(norm)
  ) {
    return 'mama';
  }

  // COLORRECTAL
  if (
    /\b(colon|recto|rectal|colorrectal|sigmoides|ciego)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?(?:colon|recto)\b/i.test(norm) ||
    /\bccr\b/i.test(norm)
  ) {
    return 'colorrectal';
  }

  // MELANOMA
  if (/\b(melanoma)\b/i.test(norm)) {
    return 'melanoma';
  }

  // PÁNCREAS
  if (
    /\b(pancreas|pancreatico|cefalopancreatico|cabeza.*pancreas)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?pancreas\b/i.test(norm)
  ) {
    return 'pancreas';
  }

  // PRÓSTATA
  if (
    /\b(prostata|prostatico)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?prostata\b/i.test(norm)
  ) {
    return 'prostata';
  }

  // TESTÍCULO / GERMINAL
  if (
    /\b(testiculo|testicular|tumor\s+germinal|seminoma|saco\s+vitelino|teilum)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?testiculo\b/i.test(norm)
  ) {
    return 'germinal';
  }

  // PULMÓN (verificar que no sea secundarismo)
  if (
    /\b(nsclc|cpcnp|sclc|cpcp|carcinoma\s+pulmonar|ca\s+(?:de\s+)?pulmon|cancer\s+(?:de\s+)?pulmon)\b/i.test(norm)
  ) {
    return 'pulmon';
  }
  if (/\b(pulmon|pulmonar|bronquial)\b/i.test(norm)) {
    if (!/met[aá]stasis.*pulmon|secundarismo.*pulmon|mtsx.*pulmon|compromiso.*pulmon|n[oó]dulo.*pulmon|implantes?.*pulmon/i.test(norm)) {
      return 'pulmon';
    }
  }

  // OVARIO
  if (
    /\b(ovario|ovarico|trompa\s+de\s+falopio|anexo\s+uterino)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?ovario\b/i.test(norm)
  ) {
    return 'ovario';
  }

  // GÁSTRICO / ESÓFAGO
  if (
    /\b(gastrico|estomago|esofago|esofagico|union\s+esofagogastrica)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?(?:gastrico|estomago|esofago)\b/i.test(norm)
  ) {
    return 'gastrico';
  }

  // RIÑÓN
  if (
    /\b(rinon|renal|ccr\s+renal|rcc|celulas\s+claras)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?(?:rinon|renal)\b/i.test(norm)
  ) {
    return 'rinon';
  }

  // VEJIGA / UROTELIAL
  if (
    /\b(vejiga|urotelial|urotelio)\b/i.test(norm) ||
    /\bca\s+(?:de\s+)?vejiga\b/i.test(norm)
  ) {
    return 'vejiga';
  }

  // CABEZA Y CUELLO / LARINGE / AMÍGDALA
  if (
    /\b(cabeza\s+y\s+cuello|laringe|faringe|orofaringe|cavidad\s+oral|lengua|amigdala)\b/i.test(norm)
  ) {
    return 'cabeza_cuello';
  }

  // HEMATOLOGÍA
  if (/\b(leucemia|linfoma|mieloma|hodgkin)\b/i.test(norm)) {
    return 'hematologia';
  }

  // SNC
  if (/\b(glioblastoma|astrocitoma|glioma|tumor\s+cerebral\s+primario)\b/i.test(norm)) {
    return 'snc';
  }

  // VÍA BILIAR
  if (/\b(colangiocarcinoma|via\s+biliar|vesicula\s+biliar)\b/i.test(norm)) {
    return 'biliar';
  }

  // SARCOMA
  if (/\b(sarcoma|gist|liposarcoma|leiomiosarcoma)\b/i.test(norm)) {
    return 'sarcoma';
  }

  return undefined;
}

/**
 * Detecta el tumor primario y evalúa concordancia o conflicto diagnóstico
 * entre el campo formulario (diagnosisRaw) y la evidencia clínica (historyText).
 */
export function detectOrganAndConflict(
  diagnosisRaw: string = '', 
  historyText: string = ''
): OrganDetectionResult {
  const diagOrgan = matchOrganFromSnippet(diagnosisRaw);

  // Buscar evidencia específica de primario en líneas clave de la historia clínica
  const histLines = historyText.split('\n');
  const primaryEvidence: string[] = [];

  for (const line of histLines) {
    // Líneas con alto valor clínico predictivo
    if (
      /^\s*(?:MC|Motivo\s+de\s+consulta|DX|Dx|Diagn[oó]stico|AP|Anatom[ií]a\s+Patol[oó]gica|Biopsia|Bx)[:\s]+/i.test(line) ||
      /\bpaciente\s+(?:con\s+dx\s+de|con\s+diagn[oó]stico\s+de)\s+/i.test(line) ||
      /\b(?:biopsia|AP)\s+(?:de\s+)?(?:cervix|cuello|mama|colon|prostata|ovario|pulmon)/i.test(line)
    ) {
      primaryEvidence.push(line);
    }
  }

  const combinedEvidenceText = primaryEvidence.join('\n');
  let histOrgan = matchOrganFromSnippet(combinedEvidenceText);

  // Si no se detectó en líneas específicas, buscar en los primeros 400 caracteres de la historia
  if (!histOrgan) {
    const headerSnippet = historyText.slice(0, 400);
    histOrgan = matchOrganFromSnippet(headerSnippet);
  }

  // CASO 1: Diagnóstico explícito y evidencia de historia coinciden o historia no tiene otro primario
  if (diagOrgan && (!histOrgan || diagOrgan === histOrgan)) {
    return {
      organOrSite: diagOrgan,
      diagnosticConflict: {
        hasConflict: false
      }
    };
  }

  // CASO 2: Diagnóstico no indica órgano o es término genérico ("cáncer", "neoplasia", "tumor")
  if (!diagOrgan && histOrgan) {
    return {
      organOrSite: histOrgan,
      diagnosticConflict: {
        hasConflict: false,
        historyPrimaryOrgan: histOrgan
      }
    };
  }

  // CASO 3: CONFLICTO DIAGNÓSTICO (ej: diagnosis="mama", pero historia="MC: Ca de cervix", "biopsia cervix")
  if (diagOrgan && histOrgan && diagOrgan !== histOrgan) {
    // Si la historia presenta evidencia contundente (biopsia, AP o MC específico),
    // se adopta el órgano de la historia clínica para proteger la seguridad del paciente
    // y se preserva el estado de conflicto explícito en diagnosticConflict.
    return {
      organOrSite: histOrgan,
      diagnosticConflict: {
        hasConflict: true,
        diagnosisInput: diagnosisRaw,
        historyPrimaryOrgan: histOrgan,
        details: `Conflicto detectado: El campo diagnóstico indica "${diagnosisRaw}" pero la historia clínica documenta primario de "${histOrgan}".`
      }
    };
  }

  // Fallback estándar
  return {
    organOrSite: diagOrgan || histOrgan,
    diagnosticConflict: {
      hasConflict: false
    }
  };
}

/**
 * Función pública retrocompatible: devuelve el órgano primario resuelto
 */
export function detectPrimaryTumorOrgan(diagnosisRaw: string = '', historyText: string = ''): string | undefined {
  const result = detectOrganAndConflict(diagnosisRaw, historyText);
  return result.organOrSite;
}

/**
 * Extrae la edad del paciente evitando capturar antecedentes temporales (ej: "abandono hace 15 años")
 */
function extractPatientAge(patient: any, fullText: string, historyText: string): number | undefined {
  if (typeof patient.age === 'number' && patient.age > 0) {
    return patient.age;
  }
  if (patient.ageRange && typeof patient.ageRange === 'string') {
    const rangeMatch = patient.ageRange.match(/(\d+)/);
    if (rangeMatch) return parseInt(rangeMatch[1], 10);
  }

  // Buscar preferentemente en las primeras líneas de la historia clínica (filiación)
  const header = (historyText || fullText).slice(0, 350);

  // 1. Patrón explícito de filiación: "paciente de 48 años", "edad: 48", "edad 48"
  const explicitMatch = header.match(/(?:edad[:\s]*|paciente\s+de\s+)(\d{1,2})\s*(?:años|anos|a|yo)?\b/i);
  if (explicitMatch) {
    return parseInt(explicitMatch[1], 10);
  }

  // 2. Patrón filiación paréntesis o guión: "(48 años)", "(48 a)", "48 años"
  const parenMatch = header.match(/\((\d{1,2})\s*(?:años|anos|a|yo)\)/i);
  if (parenMatch) {
    return parseInt(parenMatch[1], 10);
  }

  // 3. Patrón directo con coma o identificador: "42 a,", "42a,", "52 a, NHC", "42 a ,", "Nombre, 43 a,"
  const directMatch = header.match(/\b(\d{1,2})\s*a\s*(?:,|\s+HC|\s+NHC|\s+DNI)\b/i);
  if (directMatch) {
    const num = parseInt(directMatch[1], 10);
    if (num >= 10 && num <= 115) return num;
  }

  // 4. Nombre seguido de coma y edad: "FERNANDEZ, Sandra , 52a," o "SARRIA Valeria, 43 a"
  const nameAgeMatch = header.match(/,\s*(\d{1,2})\s*a(?:ños|nos)?\b/i);
  if (nameAgeMatch) {
    const num = parseInt(nameAgeMatch[1], 10);
    if (num >= 10 && num <= 115) return num;
  }

  // 5. Al principio absoluto del texto: "^42 a" o "^42a"
  const startMatch = header.match(/^\s*(\d{1,2})\s*a\b/i);
  if (startMatch) {
    const num = parseInt(startMatch[1], 10);
    if (num >= 10 && num <= 115) return num;
  }

  // 6. Limpiar antecedentes temporales conocidos del header antes de buscar "años"
  const cleanedHeader = header
    .replace(/(?:hace|durante|desde\s+hace|por|abandono\s+hace|fumo\s+durante|menarca\s*a\s*los?|menarca)\s+\d{1,2}\s*(?:años|anos|a)\b/gi, ' ')
    .replace(/\b\d+\s*p\/a\b/gi, ' ');

  const generalMatch = cleanedHeader.match(/(\d{1,2})\s*(?:años|anos|years|yo)\b/i);
  if (generalMatch) {
    const num = parseInt(generalMatch[1], 10);
    if (num >= 10 && num <= 115) return num;
  }

  return undefined;
}

/**
 * Extrae el sexo del paciente reconociendo contexto ginecológico y andrológico explícito
 */
function extractPatientSex(fullText: string): 'MALE' | 'FEMALE' | 'OTHER' | undefined {
  if (/\b(masculino|varon|hombre|male)\b/i.test(fullText)) {
    return 'MALE';
  }
  if (/\b(femenino|mujer|female)\b/i.test(fullText)) {
    return 'FEMALE';
  }

  // Contexto gineco-obstétrico o patología femenina unívoca
  if (
    /\b(ago[:\s]|menarca|fum\b|\d+g\s*\d+p\b|g\d+p\d+|g\d+a\d+|cesarea|histerectomia|anexohisterectomia|cervix|cuello\s+uterino|endometrio|endometrial|uterin[ao]|ovario|ovarico|vulva|vulvar|genitorragia|ginecorragia|metrorragia|mamografia)\b/i.test(fullText)
  ) {
    return 'FEMALE';
  }

  // Contexto urológico / andrológico masculino unívoco
  if (
    /\b(prostata|prostatico|testiculo|testicular|orquiectomia|orquidectomia|psa\b)\b/i.test(fullText)
  ) {
    return 'MALE';
  }

  return undefined;
}

/**
 * Extrae el Performance Status / ECOG documentado
 */
function extractPerformanceStatus(fullText: string): number | undefined {
  // 1. Notación ECOG: ECOG 0, ECOG: 1, ECOG-2
  const ecogMatch = fullText.match(/\bECOG\s*[:=-]?\s*([0-4])\b/i);
  if (ecogMatch) return parseInt(ecogMatch[1], 10);

  // 2. Notación PS: PS: 0, PS: 1, PS0, PS1, PS 0, PS 1
  const psMatch = fullText.match(/\b(?:PS|Performance\s+Status)\s*[:=-]?\s*([0-4])\b/i);
  if (psMatch) return parseInt(psMatch[1], 10);

  // 3. Notación compacta al inicio de línea: PS0, PS1, PS2
  const psCompactMatch = fullText.match(/\bPS([0-4])\b/i);
  if (psCompactMatch) return parseInt(psCompactMatch[1], 10);

  return undefined;
}

/**
 * Detecta enfermedad metastásica / secundaria y sitios involucrados
 */
function extractMetastaticInfo(fullText: string): { isMetastatic: boolean; sites: string[] } {
  const cleanText = removeNegatedClauses(fullText);
  const cleanNorm = normalize(cleanText);

  const hasMetastaticEvidence = 
    /\b(?:metastasis|metastasico|metastasica|metastasicos|metastasicas|m1|estadio\s+iv|stage\s+iv|ec\s+iv|e\s*iv)\b/i.test(cleanNorm) ||
    /\b(?:implante\s+secundario|implantes\s+secundarios|impl\.\s*secundarios)\b/i.test(cleanNorm) ||
    /\b(?:secundarismo|secundarismos|2rismo)\b/i.test(cleanNorm) ||
    /\b(?:lesiones\s+secundarias|lesion\s+secundaria)\b/i.test(cleanNorm) ||
    /\b(?:carcinomatosis(?:\s+peritoneal)?)\b/i.test(cleanNorm) ||
    /\b(?:diseminacion\s+a\s+distancia|mtts|mtsx)\b/i.test(cleanNorm);

  const sites: string[] = [];

  if (hasMetastaticEvidence) {
    if (/(?:implantes?|secundarismo|metastasis|mtts?|nodulos?).{0,35}(?:pulmon|pulmonar|pleural)/i.test(cleanNorm)) {
      sites.push('pulmon');
    }
    if (/(?:implantes?|carcinomatosis|secundarismo|nodulo).{0,35}(?:peritoneo|peritoneal|epiplon)/i.test(cleanNorm)) {
      sites.push('peritoneo');
    }
    if (/(?:implantes?|secundarismo|adenopatias?|conglomerado).{0,35}(?:ganglionar|mediastin|retroperitone|supraclavicular)/i.test(cleanNorm)) {
      sites.push('ganglios_a_distancia');
    }
    if (/(?:implantes?|secundarismo|metastasis|mtts?).{0,35}(?:higado|hepatic)/i.test(cleanNorm)) {
      sites.push('higado');
    }
    if (/(?:implantes?|secundarismo|metastasis|mtts?).{0,35}(?:oseo|osea|hueso|vertebra|calota|costal)/i.test(cleanNorm)) {
      sites.push('hueso');
    }
    if (/(?:implantes?|secundarismo|metastasis|mtts?).{0,35}(?:cerebr|snc|encefal)/i.test(cleanNorm)) {
      sites.push('cerebro_snc');
    }
  }

  return { isMetastatic: hasMetastaticEvidence, sites };
}

/**
 * Extrae estadio clínico, FIGO o TNM explícitamente documentado
 */
function extractStageDocumented(fullText: string): string | undefined {
  // 1. FIGO (Ginecología): FIGO IIIA, FIGO 2B, FIGO IIIC1, FIGO IVB, FIGO IB3
  const figoMatch = fullText.match(/\bFIGO\s*(?:estadio\s*)?([IVX1-4]+[A-C]?[1-3]?)\b/i);
  if (figoMatch) {
    return `FIGO ${figoMatch[1].toUpperCase()}`;
  }

  // 2. Prefijo E: E IV, E IIIB, EIVA, EIIIC2, EIIA
  const ePrefixMatch = fullText.match(/\bE\s*([IVX1-4]+[A-C]?[1-3]?)\b/i);
  if (ePrefixMatch) {
    return `Estadio ${ePrefixMatch[1].toUpperCase()}`;
  }

  // 3. Estadio / Stage estándar: Estadio IV, Stage IIIB, EC IIA
  const stageMatch = fullText.match(/\b(?:estadio|stage|ec)\s*[:=-]?\s*([IVXABCD1-4]+[ABCD]*)\b/i);
  if (stageMatch) {
    return `Estadio ${stageMatch[1].trim().toUpperCase()}`;
  }

  // 4. TNM explícito: pT2 pN0, pT2N0, cT3 cN1, pT1c pN2a, pT1b1 pN0, pT3, pN1c
  const tnmMatch = fullText.match(/\b([cyp]?T[0-4][a-d]?(?:[,\s/]+[cyp]?N[0-3][a-c]?(?:[sn]+)?)?(?:[,\s/]+[cyp]?M[01][a-c]?)?)\b/i);
  if (tnmMatch && tnmMatch[1].trim().length >= 4) {
    return tnmMatch[1].trim();
  }

  return undefined;
}

/**
 * Extrae tratamientos previos distinguiendo pasado recibido de planes futuros
 */
function extractPriorTreatments(fullText: string): { lines: string[]; drugs: string[] } {
  const linesDocumented: string[] = [];
  const priorTreatments: string[] = [];

  // Separar el texto eliminando secciones de "PLAN", "CONDUCTA" o planes futuros para no inventar tratamientos
  const planSplit = fullText.split(/\b(?:PLAN|CONDUCTA|Plan\s+terap[eé]utico|Conducta\s+sugerida|Se\s+solicita|Se\s+indica|Se\s+planifica)[:\s]+/i);
  const historyBeforePlan = planSplit[0] || fullText;
  const historyNorm = normalize(historyBeforePlan);

  // Extraer líneas explícitas: 1ra línea, 2da línea, 1L, 2L
  const lineMatches = historyBeforePlan.match(/(?:1ra|primera|1°|1l|2da|segunda|2°|2l|3ra|tercera|3°|3l)\s*l[ií]nea[^.\n]+/gi);
  if (lineMatches) {
    for (const lm of lineMatches) {
      linesDocumented.push(lm.trim());
    }
  }

  const commonDrugsAndRegimens = [
    'folfox', 'folfiri', 'bevacizumab', 'beva', 'pembrolizumab', 'pembro', 'nivolumab',
    'ipilimumab', 'osimertinib', 'trastuzumab', 'trastu', 'pertuzumab', 'pertu',
    'carboplatino', 'cisplatino', 'cddp', 'cbp', 'paclitaxel', 'docetaxel',
    'gemcitabina', 'capecitabina', 'cape', 'tamoxifeno', 'tam', 'letrozol',
    'anastrozol', 'fulvestrant', 'ribociclib', 'ribo', 'palbociclib', 'abemaciclib',
    'ac', 'ac-t', 'bep', 'tip', 'capox', 'gemox', 'folfirinox', 't-dm1', 'tdx-d'
  ];

  for (const drug of commonDrugsAndRegimens) {
    // Verificar que esté en el cuerpo previo y que no sea una indicación futura
    const regex = new RegExp(`\\b${drug}\\b`, 'i');
    if (regex.test(historyNorm)) {
      if (!priorTreatments.includes(drug)) {
        priorTreatments.push(drug);
      }
    }
  }

  return { lines: linesDocumented, drugs: priorTreatments };
}

/**
 * Extrae valores de laboratorio desde el texto libre de la historia clínica cuando no vienen estructurados
 */
function extractLabsFromText(fullText: string, baseLabs: PatientClinicalProfile['labsDocumented']): PatientClinicalProfile['labsDocumented'] {
  const labs = { ...baseLabs };

  // Hemoglobina: "Hb de 4", "Hb 10,1", "hb: 7.8", "hb 14.4"
  if (labs.hemoglobin === undefined) {
    const hbMatch = fullText.match(/\bhb\s*[:=de\s]*(\d{1,2}(?:[.,]\d+)?)\s*(?:g\/dl|gr%|g%)?\b/i);
    if (hbMatch) labs.hemoglobin = parseFloat(hbMatch[1].replace(',', '.'));
  }

  // Creatinina: "creat 0.91", "creatinina 0,59", "Cr 0.7"
  if (labs.creatinine === undefined) {
    const crMatch = fullText.match(/\b(?:creat(?:inina)?|cr)\s*[:=de\s]*(\d{1,2}(?:[.,]\d+)?)\b/i);
    if (crMatch) labs.creatinine = parseFloat(crMatch[1].replace(',', '.'));
  }

  // Plaquetas: "plaq 226000", "plaquetas 398.000", "PLQ 241000"
  if (labs.platelets === undefined) {
    const plqMatch = fullText.match(/\b(?:plaq(?:uetas)?|plq)\s*[:=de\s]*(\d{2,3}(?:\.\d{3})?|\d{5,6})\b/i);
    if (plqMatch) labs.platelets = parseFloat(plqMatch[1].replace('.', ''));
  }

  // Bilirrubina: "BT 0.58", "bilirrubina total 0.9", "BB total 0,25"
  if (labs.totalBilirubin === undefined) {
    const btMatch = fullText.match(/\b(?:bb\s*total|bt|bilirrubina\s*total)\s*[:=de\s]*(\d{1,2}(?:[.,]\d+)?)\b/i);
    if (btMatch) labs.totalBilirubin = parseFloat(btMatch[1].replace(',', '.'));
  }

  // AST / GOT: "got 25", "ast: 35"
  if (labs.ast === undefined) {
    const astMatch = fullText.match(/\b(?:ast|got)\s*[:=de\s]*(\d{1,3})\b/i);
    if (astMatch) labs.ast = parseFloat(astMatch[1]);
  }

  // ALT / GPT: "gpt 18", "alt: 42"
  if (labs.alt === undefined) {
    const altMatch = fullText.match(/\b(?:alt|gpt)\s*[:=de\s]*(\d{1,3})\b/i);
    if (altMatch) labs.alt = parseFloat(altMatch[1]);
  }

  return labs;
}

/**
 * Extrae el perfil clínico de matching de un paciente existente de forma estrictamente conservadora.
 * REGLAS DE ORO:
 * - NO infiere datos faltantes.
 * - NO inventa biomarcadores ni cuantificaciones.
 * - Detecta y preserva conflictos diagnósticos.
 * - Distingue tratamientos recibidos de planes futuros.
 */
export function extractPatientClinicalProfile(patient: any): PatientClinicalProfile {
  const historyText = patient.historyText || '';
  const diagnosisRaw = patient.diagnosis || '';
  const clinicalContext = patient.clinicalContext || '';
  const fullText = `${diagnosisRaw} \n ${historyText} \n ${clinicalContext}`;
  const fullTextNorm = normalize(fullText);

  // 1. EDAD
  const age = extractPatientAge(patient, fullText, historyText);

  // 2. SEXO
  const sex = extractPatientSex(fullText);

  // 3. ÓRGANO PRIMARIO Y RESOLUCIÓN DE CONFLICTOS
  const organResult = detectOrganAndConflict(diagnosisRaw, historyText);
  const organOrSite = (patient.organOrSite as string | undefined) || organResult.organOrSite;
  const diagnosticConflict = organResult.diagnosticConflict;

  // 4. HISTOLOGÍA
  let histology: string | undefined = undefined;
  if (fullTextNorm.includes('adenocarcinoma')) {
    histology = 'Adenocarcinoma';
  } else if (fullTextNorm.includes('carcinoma ductal invasor') || fullTextNorm.includes('carcinoma ductal')) {
    histology = 'Carcinoma Ductal';
  } else if (fullTextNorm.includes('carcinoma lobulillar')) {
    histology = 'Carcinoma Lobulillar';
  } else if (fullTextNorm.includes('carcinoma epidermoide') || fullTextNorm.includes('carcinoma escamoso') || fullTextNorm.includes('espinocelular')) {
    histology = 'Carcinoma Epidermoide';
  } else if (fullTextNorm.includes('melanoma')) {
    histology = 'Melanoma';
  } else if (fullTextNorm.includes('carcinoma de celulas claras')) {
    histology = 'Carcinoma de Células Claras';
  } else if (fullTextNorm.includes('carcinoma urotelial')) {
    histology = 'Carcinoma Urotelial';
  } else if (fullTextNorm.includes('tumor germinal') || fullTextNorm.includes('seminoma') || fullTextNorm.includes('saco vitelino') || fullTextNorm.includes('teilum')) {
    histology = 'Tumor Germinal';
  } else if (fullTextNorm.includes('carcinoma basocelular') || fullTextNorm.includes('basocelular')) {
    histology = 'Carcinoma Basocelular';
  } else if (fullTextNorm.includes('sarcoma')) {
    histology = 'Sarcoma';
  }

  // 5. ESTADIO EXPLÍCITAMENTE DOCUMENTADO
  let stageDocumented: string | undefined = undefined;
  const structuredStage = patient.stage as StageCategory | undefined;
  if (structuredStage && structuredStage !== 'No consignado') {
    stageDocumented = structuredStage;
  } else {
    stageDocumented = extractStageDocumented(fullText);
  }

  // 6. ENFERMEDAD METASTÁSICA Y SITIOS
  let isMetastaticDocumented = false;
  let metastaticSites: string[] | undefined = undefined;
  if (typeof patient.isMetastatic === 'boolean') {
    isMetastaticDocumented = patient.isMetastatic;
  } else {
    const metaInfo = extractMetastaticInfo(fullText);
    isMetastaticDocumented = metaInfo.isMetastatic;
    if (metaInfo.sites.length > 0) metastaticSites = metaInfo.sites;
  }

  // 7. BIOMARCADORES EXPLÍCITAMENTE DOCUMENTADOS
  const biomarkersDocumented: Array<{ name: string; status: string; rawText: string }> = [];

  if (patient.biomarkersStructured && Array.isArray(patient.biomarkersStructured) && patient.biomarkersStructured.length > 0) {
    biomarkersDocumented.push(...(patient.biomarkersStructured as BiomarkerEntry[]));
  } else {
    // Extracción robusta desde texto libre

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
    const her2Match = fullText.match(/HER-?2(?:\s*neu)?\s*[:\s]*([+-]|positivo|negativo|3\+|2\+|1\+|0|amplificado|no amplificado|ultra low|low)/i);
    if (her2Match) {
      const raw = her2Match[0];
      const val = normalize(her2Match[1]);
      const isPos = val.includes('+') || val.includes('positivo') || val.includes('3+') || val.includes('amplificado');
      const isNeg = val === '0' || val.includes('negativo') || val.includes('1+') || val.includes('ultra low') || val.includes('low');
      biomarkersDocumented.push({
        name: 'HER2',
        status: isPos ? 'Positivo' : isNeg ? 'Negativo' : raw,
        rawText: raw
      });
    }

    // RE (Receptores de Estrógeno)
    const reMatch = fullText.match(/\bRE\s*[:\s=]*([+-]|\d+%\s*(?:\([+-]+\))?|\bpositivo\b|\bnegativo\b)/i);
    if (reMatch) {
      biomarkersDocumented.push({
        name: 'RE',
        status: reMatch[1].trim(),
        rawText: reMatch[0].trim()
      });
    }

    // RP (Receptores de Progesterona)
    const rpMatch = fullText.match(/\bRP\s*[:\s=]*([+-]|\d+%\s*(?:\([+-]+\))?|\bpositivo\b|\bnegativo\b)/i);
    if (rpMatch) {
      biomarkersDocumented.push({
        name: 'RP',
        status: rpMatch[1].trim(),
        rawText: rpMatch[0].trim()
      });
    }

    // RH Genérico si no se discriminaron RE/RP
    if (!reMatch && !rpMatch) {
      if (fullTextNorm.includes('luminal a') || fullTextNorm.includes('rh+') || fullTextNorm.includes('re+')) {
        biomarkersDocumented.push({
          name: 'RH (RE/RP)',
          status: 'Positivo (Luminal)',
          rawText: 'RH+ / Luminal'
        });
      }
    }

    // PD-L1 (TPS / CPS / Porcentaje)
    const pdl1Match = fullText.match(/\b(?:pdl1|pd-l1|tps|cps)\s*[:\s]*(\d+(?:\.\d+)?\s*%?|\bpositivo\b|\bnegativo\b)/i);
    if (pdl1Match) {
      biomarkersDocumented.push({
        name: 'PD-L1',
        status: pdl1Match[1].trim(),
        rawText: pdl1Match[0].trim()
      });
    }

    // MSI / MMR
    const msiMatch = fullText.match(/\b(MSS|MSI-H|MSI-L|pMMR|dMMR|proficiente|deficiente|inestabilidad microsatelital estable|inestabilidad microsatelital alta)\b/i);
    if (msiMatch) {
      const raw = msiMatch[0];
      const isMSI_H = normalize(raw).includes('msi-h') || normalize(raw).includes('dmmr') || normalize(raw).includes('alta') || normalize(raw).includes('deficiente');
      biomarkersDocumented.push({
        name: 'MSI/MMR',
        status: isMSI_H ? 'MSI-H / dMMR' : 'MSS / pMMR (Estable)',
        rawText: raw
      });
    }
  }

  // 8. LÍNEAS Y TRATAMIENTOS PREVIOS
  const { lines, drugs } = extractPriorTreatments(fullText);
  const linesDocumented = lines;
  const priorTreatments = drugs;

  // 9. PROGRESIÓN DOCUMENTADA
  let progressionDocumented = false;
  if (
    fullTextNorm.includes('progresion de enfermedad') ||
    fullTextNorm.includes('progresion osea') ||
    fullTextNorm.includes('progresion pulmonar') ||
    fullTextNorm.includes('pd actual') ||
    fullTextNorm.includes('recidiva') ||
    fullTextNorm.includes('progresion a 1ra linea') ||
    fullTextNorm.includes('progresion a 2da linea')
  ) {
    progressionDocumented = true;
  }

  // 10. ECOG / PERFORMANCE STATUS
  const ecogDocumented = extractPerformanceStatus(fullText);

  // 11. LABORATORIOS (JSON O TEXTO LIBRE)
  const baseLabs: PatientClinicalProfile['labsDocumented'] = {};
  const allLabs = patient.labResults || patient.labs || [];

  for (const lab of allLabs) {
    const name = normalize(lab.name || lab.test || '');
    const val = typeof lab.value === 'number' ? lab.value : parseFloat(lab.value);
    if (isNaN(val)) continue;

    if (name.includes('hemoglobina') || name === 'hb') {
      baseLabs.hemoglobin = val;
    } else if (name.includes('plaqueta')) {
      baseLabs.platelets = val;
    } else if (name.includes('neutrofil')) {
      baseLabs.neutrophils = val;
    } else if (name.includes('creatinina')) {
      baseLabs.creatinine = val;
    } else if (name.includes('bilirrubina') && (name.includes('total') || !name.includes('directa'))) {
      baseLabs.totalBilirubin = val;
    } else if (name.includes('ast') || name.includes('got')) {
      baseLabs.ast = val;
    } else if (name.includes('alt') || name.includes('gpt')) {
      baseLabs.alt = val;
    }
  }

  // Complementar laboratorios con el texto libre de la historia si faltan
  const labsDocumented = extractLabsFromText(fullText, baseLabs);

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
    labsDocumented,
    diagnosticConflict,
    metastaticSites
  };
}
