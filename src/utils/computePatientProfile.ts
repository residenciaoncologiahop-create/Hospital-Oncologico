/**
 * computePatientProfile.ts
 *
 * Utilidad compartida para calcular el perfil oncológico estructurado de un paciente
 * a partir de sus campos de texto libre. Se llama al crear o actualizar un paciente
 * y persiste el resultado en Firestore para que Estadísticas y Ensayos Clínicos
 * lean un campo confiable en vez de reinterpretar texto en cada consulta.
 *
 * Reutiliza la lógica de detección más robusta disponible:
 *   - Estadio: extractExplicitStage() (misma que usa PracticeStatsModal, con soporte de negaciones)
 *   - Órgano:  detectPrimaryTumorOrgan() (de patientProfileExtractor)
 *   - Biomarcadores: extracción de patientProfileExtractor
 */

import { detectPrimaryTumorOrgan } from '../services/clinicalTrials/patientProfileExtractor';

// ─── Tipos exportados ────────────────────────────────────────────────────────

export type StageCategory =
  | 'Estadio I'
  | 'Estadio II'
  | 'Estadio III'
  | 'Estadio IV'
  | 'No consignado';

export type StageConfidence = 'confirmed' | 'auto' | 'pending';

export interface BiomarkerEntry {
  name: string;
  status: string;
  rawText: string;
}

export interface ComputedPatientProfile {
  stage: StageCategory;
  stageConfidence: StageConfidence;
  organOrSite: string | undefined;
  isMetastatic: boolean;
  biomarkersStructured: BiomarkerEntry[];
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function normalize(str: string = ''): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Elimina cláusulas con negación del texto para evitar falsos positivos.
 * Ej: "sin metástasis", "no se observan metástasis", "libre de enfermedad"
 */
function removeNegatedClauses(text: string): string {
  return text
    .replace(/\b(?:sin|no\s+se\s+observan?|libre\s+de|descarta|no\s+presenta|ausencia\s+de|sin\s+evidencia\s+de)\s+[^.;,\n]{0,60}/gi, ' ')
    .replace(/\b(?:no\s+metast[aá]sico|no\s+metast[aá]sica)\b/gi, ' ');
}

/**
 * Extrae el estadio explícito desde texto libre, con soporte de negaciones.
 * Replica la lógica de extractExplicitStage() de PracticeStatsModal para ser
 * la única fuente de verdad compartida.
 */
function extractExplicitStage(text: string): StageCategory | null {
  if (!text.trim()) return null;

  const cleanText = removeNegatedClauses(text);
  const norm = normalize(cleanText);

  // ── ESTADIO IV / METASTÁSICO ──────────────────────────────────────────────
  const stageIVPrefix = /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estadio|stage|etapa|ec|e\.c\.)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:iv|4)[a-c]?\b/i;
  const stageIVDisease = /\benfermedad\s+(?:en\s+)?(?:estadio|etapa|ec)\s*[:=-]?\s*(?:iv|4)[a-c]?\b/i;
  const isM1 = /\b(?:[cp]?m1[a-c]?)\b/i;
  const isMetastaticWord = /\b(?:metastasico|metastasica|metastasicos|metastasicas|oligometastasico|oligometastasica|enfermedad\s+metastasica)\b/i;
  const isMetastases = /\bmetastasis\b/i;
  const isCarcinomatosis = /\bcarcinomatosis\b/i;

  if (
    stageIVPrefix.test(norm) ||
    stageIVDisease.test(norm) ||
    isM1.test(norm) ||
    isMetastaticWord.test(norm) ||
    isMetastases.test(norm) ||
    isCarcinomatosis.test(norm)
  ) {
    return 'Estadio IV';
  }

  // ── ESTADIO III ───────────────────────────────────────────────────────────
  const stageIII = /\b(?:(?:yp|[cyp])?estadio|stage|etapa|ec|e\.c\.)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:iii|3)[a-c]?\b/i;
  if (stageIII.test(norm)) return 'Estadio III';

  // ── ESTADIO II ────────────────────────────────────────────────────────────
  const stageII = /\b(?:(?:yp|[cyp])?estadio|stage|etapa|ec|e\.c\.)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:ii|2)[a-c]?\b/i;
  if (stageII.test(norm)) return 'Estadio II';

  // ── ESTADIO I ─────────────────────────────────────────────────────────────
  const stageI = /\b(?:(?:yp|[cyp])?estadio|stage|etapa|ec|e\.c\.)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:i|1)[a-c]?\b/i;
  if (stageI.test(norm)) return 'Estadio I';

  return null;
}

/**
 * Extrae biomarcadores documentados explícitamente.
 * Replica la lógica de patientProfileExtractor con soporte adicional de PracticeStatsModal.
 */
function extractBiomarkers(fullText: string): BiomarkerEntry[] {
  const found: BiomarkerEntry[] = [];
  const norm = normalize(fullText);

  // KRAS
  const krasMatch = fullText.match(/KRAS\s*([A-Za-z0-9_> -]+|\bmutado\b|\bwild-type\b|\bwt\b|\bno mutado\b)/i);
  if (krasMatch) {
    const raw = krasMatch[0];
    const rawN = normalize(raw);
    const isMut = rawN.includes('mutado') || /p\.[A-Z]\d+[A-Z]/i.test(raw) || /g\d+[a-z]/i.test(raw);
    const isWT = rawN.includes('wt') || rawN.includes('wild') || rawN.includes('no mutado');
    found.push({ name: 'KRAS', status: isMut ? 'Mutado' : isWT ? 'Wild-Type' : raw.trim(), rawText: raw.trim() });
  }

  // BRAF
  const brafMatch = fullText.match(/BRAF\s*([A-Za-z0-9_ -]+|\bmutado\b|\bwild-type\b|\bwt\b|\bno mutado\b)/i);
  if (brafMatch) {
    const raw = brafMatch[0];
    const rawN = normalize(raw);
    const isMut = rawN.includes('v600e') || rawN.includes('mutado');
    const isWT = rawN.includes('wt') || rawN.includes('wild') || rawN.includes('no mutado');
    found.push({ name: 'BRAF', status: isMut ? 'V600E Mutado' : isWT ? 'Wild-Type' : raw.trim(), rawText: raw.trim() });
  }

  // EGFR
  const egfrMatch = fullText.match(/EGFR\s*([A-Za-z0-9_ -]+|\bmutado\b|\bexon\s*19\b|\bl858r\b|\bwt\b)/i);
  if (egfrMatch) {
    const raw = egfrMatch[0];
    const rawN = normalize(raw);
    const isExon19 = rawN.includes('exon 19') || rawN.includes('del');
    const isL858R = rawN.includes('l858r');
    const isWT = rawN.includes('wt') || rawN.includes('wild');
    found.push({ name: 'EGFR', status: isExon19 ? 'Exón 19 del' : isL858R ? 'L858R' : isWT ? 'Wild-Type' : 'Mutado', rawText: raw.trim() });
  }

  // HER2
  const her2Match = fullText.match(/HER2\s*([+\-]|positivo|negativo|3\+|2\+|1\+|0|amplificado|no amplificado)/i);
  if (her2Match) {
    const raw = her2Match[0];
    const rawN = normalize(raw);
    const isPos = rawN.includes('+') || rawN.includes('positivo') || rawN.includes('3+');
    const isNeg = rawN.includes('-') || rawN.includes('negativo') || rawN.includes('0') || rawN.includes('1+');
    found.push({ name: 'HER2', status: isPos ? 'Positivo' : isNeg ? 'Negativo' : raw.trim(), rawText: raw.trim() });
  }

  // MSI / MMR
  const msiMatch = fullText.match(/\b(MSS|MSI-H|MSI-L|pMMR|dMMR|inestabilidad microsatelital estable|inestabilidad microsatelital alta)\b/i);
  if (msiMatch) {
    const raw = msiMatch[0];
    const rawN = normalize(raw);
    const isMSIH = rawN.includes('msi-h') || rawN.includes('dmmr') || rawN.includes('alta');
    found.push({ name: 'MSI/MMR', status: isMSIH ? 'MSI-H / dMMR' : 'MSS / pMMR (Estable)', rawText: raw.trim() });
  }

  // Receptores Hormonales (Mama)
  if (norm.includes('luminal a') || /\brh\+/.test(norm) || /\bre\+/.test(norm) || /receptor.{0,20}estrogenico.{0,10}positivo/i.test(norm)) {
    found.push({ name: 'RH (RE/RP)', status: 'Positivo (Luminal)', rawText: 'RH+ / Luminal' });
  }

  // PD-L1
  if (/\b(?:pdl1|pd-l1|tps|cps)\b/i.test(fullText)) {
    const pdl1Match = fullText.match(/(?:pdl1|pd-l1|tps|cps)\s*[:\s]*(\d+[\s]*%?|\bpositivo\b|\bnegativo\b)/i);
    found.push({ name: 'PD-L1', status: pdl1Match ? pdl1Match[1].trim() : 'Documentado', rawText: pdl1Match ? pdl1Match[0].trim() : 'PD-L1' });
  }

  // BRCA
  const brcaMatch = fullText.match(/\b(BRCA1|BRCA2|BRCA)\s*([A-Za-z0-9 -]*(?:mutado|mutacion|positivo|negativo|wt|wild)?)/i);
  if (brcaMatch) {
    const raw = brcaMatch[0];
    const rawN = normalize(raw);
    const isMut = rawN.includes('mutado') || rawN.includes('mutacion') || rawN.includes('positivo');
    const isWT = rawN.includes('wt') || rawN.includes('wild') || rawN.includes('negativo');
    found.push({ name: brcaMatch[1].toUpperCase(), status: isMut ? 'Mutado' : isWT ? 'Wild-Type' : 'Documentado', rawText: raw.trim() });
  }

  return found;
}

// ─── Función principal exportada ─────────────────────────────────────────────

/**
 * Calcula el perfil oncológico estructurado de un paciente desde texto libre.
 * Devuelve stage, stageConfidence, organOrSite, isMetastatic y biomarkersStructured.
 *
 * @param diagnosis  - patient.diagnosis (campo de diagnóstico libre)
 * @param historyText - patient.historyText (notas clínicas acumuladas)
 * @param clinicalContext - patient.clinicalContext (resumen IA acumulado, opcional)
 */
export function computePatientOncologicalProfile(
  diagnosis: string = '',
  historyText: string = '',
  clinicalContext: string = ''
): ComputedPatientProfile {
  const fullText = [diagnosis, historyText, clinicalContext].filter(Boolean).join('\n\n');

  // ── 1. ESTADIO ────────────────────────────────────────────────────────────
  // Primero desde el campo diagnóstico explícito (más confiable),
  // luego desde el texto libre completo.
  let stage: StageCategory = 'No consignado';

  const stageFromDiagnosis = extractExplicitStage(diagnosis);
  if (stageFromDiagnosis) {
    stage = stageFromDiagnosis;
  } else {
    const stageFromFull = extractExplicitStage(fullText);
    if (stageFromFull) {
      stage = stageFromFull;
    }
  }

  // ── 2. ÓRGANO / SITIO TUMORAL ─────────────────────────────────────────────
  // Usa la lógica rigurosa de detectPrimaryTumorOrgan que nunca confunde
  // metástasis con el tumor primario.
  const organOrSite = detectPrimaryTumorOrgan(diagnosis, historyText);

  // ── 3. METASTÁSICO ────────────────────────────────────────────────────────
  const isMetastatic = stage === 'Estadio IV';

  // ── 4. BIOMARCADORES ──────────────────────────────────────────────────────
  const biomarkersStructured = extractBiomarkers(fullText);

  // ── 5. CONFIANZA DEL ESTADIO ──────────────────────────────────────────────
  // 'auto'    → detectado con éxito
  // 'pending' → no se pudo determinar estadio ni órgano (necesita revisión manual)
  const stageConfidence: StageConfidence =
    stage !== 'No consignado' ? 'auto' : 'pending';

  return {
    stage,
    stageConfidence,
    organOrSite,
    isMetastatic,
    biomarkersStructured,
  };
}
