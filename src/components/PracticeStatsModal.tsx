import React, { useState, useMemo } from 'react';
import { 
  X, BarChart3, Users, Activity, Calendar, ShieldCheck, 
  TrendingUp, Layers, Stethoscope,
  PieChart as PieIcon, CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  CartesianGrid, Cell, AreaChart, Area
} from 'recharts';

interface ClinicalEvent {
  date: string;
  professional?: string;
  category?: string;
  note?: string;
  isKey?: boolean;
  detail?: string;
}

interface Patient {
  id: string;
  doctorId?: string;
  hcNumber?: string;
  name?: string;
  age?: number;
  ageRange?: string;
  diagnosis?: string;
  primaryDiagnosis?: string;
  historyText?: string;
  clinicalContext?: string;
  resumen_hc?: string;
  resumen?: string;
  antecedentes?: string;
  antecedentesOncologicos?: string;
  evolucion?: string;
  stage?: string;
  estadio?: string;
  estadio_inicial?: string;
  estadio_actual?: string;
  clinicalStage?: string;
  staging?: string;
  etapa?: string;
  ec?: string;
  figo?: string;
  initialStage?: string;
  currentStage?: string;
  clinicalNotes?: Array<{ text?: string; [key: string]: unknown } | string>;
  evoluciones?: Array<{ text?: string; nota?: string; [key: string]: unknown } | string>;
  lastUpdated?: number;
  createdAt?: number;
  timeline?: ClinicalEvent[];
  imagingStudies?: Array<{ treatment?: string | null; relevantFindings?: string; bodyRegion?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface Props {
  patients: Patient[];
  onClose: () => void;
}

type TimeRange = '30d' | '6m' | '1y' | 'all';

// --- PALETA VISUAL CLÍNICA ---
const CHART_COLORS = [
  '#2563eb', // Azul médico
  '#7c3aed', // Violeta
  '#059669', // Esmeralda
  '#d97706', // Ámbar
  '#dc2626', // Rojo coral
  '#0891b2', // Cian
  '#4f46e5', // Índigo
  '#db2777', // Rosa
  '#64748b', // Pizarra
];

// --- FUNCIONES AUXILIARES DETERMINÍSTICAS ---
const normalizeStr = (text?: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const parseDateToMs = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const t = new Date(y, m, d).getTime();
      return isNaN(t) ? null : t;
    } else {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const t = new Date(y, m, d).getTime();
      return isNaN(t) ? null : t;
    }
  }
  const t = Date.parse(dateStr);
  return isNaN(t) ? null : t;
};

const getPatientAnchorDate = (p: Patient): number => {
  if (typeof p.createdAt === 'number' && p.createdAt > 0) return p.createdAt;
  if (Array.isArray(p.timeline) && p.timeline.length > 0) {
    const dates = p.timeline
      .map(e => parseDateToMs(e.date))
      .filter((t): t is number => t !== null && t > 0);
    if (dates.length > 0) {
      return Math.min(...dates);
    }
  }
  if (typeof p.lastUpdated === 'number' && p.lastUpdated > 0) {
    return p.lastUpdated;
  }
  return Date.now();
};

// 1. CLASIFICACIÓN DE LOCALIZACIÓN TUMORAL
export const detectTumorLocation = (p: Patient): string => {
  const rawDx = normalizeStr(p.diagnosis);
  const rawText = normalizeStr(p.historyText) + ' ' + normalizeStr(p.clinicalContext);

  if (!rawDx && !rawText) return 'No consignado';

  // Limpiar menciones de metástasis secundarias que contengan órganos
  // para evitar confundir una metástasis pulmonar/hepática con el tumor primario
  const cleanMetastases = (str: string) => str
    .replace(/metastasis\s+(?:a\s+distancia|pulmonar[a-z]*|hepatica[a-z]*|osea[a-z]*|cerebral[a-z]*|subcutanea[a-z]*|ganglionar[a-z]*)/g, ' ')
    .replace(/compromiso\s+(?:pulmonar|hepatico|oseo|cerebral|ganglionar)/g, ' ');

  const dx = cleanMetastases(rawDx);
  const text = cleanMetastases(rawText);

  const matchSite = (str: string): string | null => {
    // Melanoma siempre refiere a primario
    if (str.includes('melanoma')) return 'Melanoma';
    if (str.includes('mama') || str.includes('breast')) return 'Mama';
    if (str.includes('colon') || str.includes('recto') || str.includes('rectal') || str.includes('colorrectal') || str.includes('sigmoide') || str.includes('ciego')) return 'Colon/recto';
    if (str.includes('prostata') || str.includes('prostatic')) return 'Próstata';
    if (str.includes('pancrea')) return 'Páncreas';
    if (str.includes('pulmon') || str.includes('pulmonar') || str.includes('bronqu')) return 'Pulmón';
    if (str.includes('estomago') || str.includes('gastric')) return 'Estómago';
    if (str.includes('vejiga') || str.includes('urotelial')) return 'Vejiga';
    if (str.includes('renal') || str.includes('riñon') || str.includes('rinon')) return 'Riñón';
    if (str.includes('ovario') || str.includes('ovaric')) return 'Ovario';
    if (str.includes('cervix') || str.includes('cervic') || str.includes('cuello uterino')) return 'Cuello uterino';
    if (str.includes('endometri') || str.includes('uterin') || str.includes('utero')) return 'Endometrio/Útero';
    if (str.includes('esofago') || str.includes('esofagic')) return 'Esófago';
    if (str.includes('vias biliares') || str.includes('vesicula biliar') || str.includes('colangiocarcinoma')) return 'Vías biliares/Vesícula';
    if (str.includes('testiculo') || str.includes('testicular') || str.includes('seminoma')) return 'Testículo';
    if (str.includes('tiroides') || str.includes('laringe') || str.includes('faringe') || str.includes('cabeza y cuello')) return 'Cabeza y cuello';
    if (str.includes('linfoma') || str.includes('mieloma') || str.includes('leucemia')) return 'Hematológico';
    return null;
  };

  // Buscar con máxima prioridad en el diagnóstico explícito
  const fromDx = matchSite(dx);
  if (fromDx) return fromDx;

  // Si no se encontró en el diagnóstico estructurado, buscar en el texto clínico
  const fromText = matchSite(text);
  if (fromText) return fromText;

  // Si tiene diagnóstico escrito pero no encaja en las anteriores
  if (rawDx.length > 3) return 'Otras';

  return 'No consignado';
};

// 2. CLASIFICACIÓN DE ESTADIO

// Parser determinístico para campos estructurados existentes
export const parseStructuredStageValue = (valRaw: unknown): 'Estadio I' | 'Estadio II' | 'Estadio III' | 'Estadio IV' | null => {
  if (valRaw === undefined || valRaw === null) return null;
  const val = normalizeStr(String(valRaw));
  if (!val) return null;
  if (
    val === 'no consignado' || val === 'no consignada' || 
    val === 'n/a' || val === 's/d' || val === 's/n' || 
    val === 'pendiente' || val === 'desconocido' || val === '-' || val === 'nd' || val === 'null'
  ) {
    return null;
  }

  // 1. Check IV / 4 / Metastásico en campo estructurado
  if (
    /^(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)?\s*[:=-]?\s*(?:iv|4)[a-c]?$/i.test(val) ||
    /^(?:iv|4)[a-c]?$/i.test(val) ||
    /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)\s*[:=-]?\s*(?:iv|4)[a-c]?\b/i.test(val) ||
    /\b(?:metastasico|metastasica|metastasis|m1[a-c]?)\b/i.test(val)
  ) {
    return 'Estadio IV';
  }

  // 2. Check III / 3 en campo estructurado
  if (
    /^(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)?\s*[:=-]?\s*(?:iii|3)[a-c]?$/i.test(val) ||
    /^(?:iii|3)[a-c]?$/i.test(val) ||
    /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)\s*[:=-]?\s*(?:iii|3)[a-c]?\b/i.test(val)
  ) {
    return 'Estadio III';
  }

  // 3. Check II / 2 en campo estructurado
  if (
    /^(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)?\s*[:=-]?\s*(?:ii|2)[a-c]?$/i.test(val) ||
    /^(?:ii|2)[a-c]?$/i.test(val) ||
    /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)\s*[:=-]?\s*(?:ii|2)[a-c]?\b/i.test(val)
  ) {
    return 'Estadio II';
  }

  // 4. Check I / 1 en campo estructurado
  if (
    /^(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)?\s*[:=-]?\s*(?:i|1)[a-c]?$/i.test(val) ||
    /^(?:i|1)[a-c]?$/i.test(val) ||
    /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)\s*[:=-]?\s*(?:i|1)[a-c]?\b/i.test(val)
  ) {
    return 'Estadio I';
  }

  return null;
};

// Parser determinístico para textos clínicos (diagnóstico, historia, evoluciones, etc.)
export const extractExplicitStage = (textRaw?: unknown): 'Estadio I' | 'Estadio II' | 'Estadio III' | 'Estadio IV' | null => {
  if (!textRaw) return null;
  const str = normalizeStr(String(textRaw));
  if (!str) return null;

  // 1. ESTADIO IV / 4 / METASTÁSICO INEQUÍVOCO
  // Menciones con prefijo explícito (Estadio, Etapa, EC, FIGO, etc.):
  const prefixIV = /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:iv|4)[a-c]?\b/i;
  const diseaseIV = /\benfermedad\s+(?:en\s+)?(?:estadio|etapa|ec)\s*[:=-]?\s*(?:iv|4)[a-c]?\b/i;

  if (prefixIV.test(str) || diseaseIV.test(str)) {
    return 'Estadio IV';
  }

  // Inequívocamente metastásico (verificando ausencia de negación clínica):
  const strCleaned = str
    .replace(/(?:sin|no|ausencia de|niega|descarte?|descarta(?:n)?|libre de)\s+(?:evidencia de\s+)?(?:signos de\s+)?(?:lesiones\s+)?(?:secundarismo[a-z]*|metastasis|diseminacion)[a-z]*/g, ' ')
    .replace(/no\s+(?:se\s+)?(?:observan|evidencian|aprecian)\s+(?:lesiones\s+)?(?:metastasis|secundarismo)[a-z]*/g, ' ')
    .replace(/sin\s+(?:lesiones|compromiso)\s+(?:secundarias|metastasicas|a distancia)/g, ' ');

  const isM1 = /\b(?:[cp]?m1[a-c]?)\b/i.test(strCleaned);
  const isMetastaticWord = /\b(?:metastasico|metastasica|metastasicos|metastasicas|oligometastasico|oligometastasica)\b/i.test(strCleaned);
  const isEnfermedadMetastasica = /\benfermedad\s+metastasica\b/i.test(strCleaned);
  const isMetastases = /\bmetastasis\b/i.test(strCleaned) && 
                       !/\b(?:sin|ausencia|descarta|libre)\b/.test(strCleaned);
  const isCarcinomatosis = /\bcarcinomatosis\b/i.test(strCleaned);

  if (isM1 || isMetastaticWord || isEnfermedadMetastasica || isMetastases || isCarcinomatosis) {
    return 'Estadio IV';
  }

  // 2. ESTADIO III / 3
  const prefixIII = /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:iii|3)[a-c]?\b/i;
  const diseaseIII = /\benfermedad\s+(?:en\s+)?(?:estadio|etapa|ec)\s*[:=-]?\s*(?:iii|3)[a-c]?\b/i;

  if (prefixIII.test(str) || diseaseIII.test(str)) {
    return 'Estadio III';
  }

  // 3. ESTADIO II / 2
  const prefixII = /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:ii|2)[a-c]?\b/i;
  const diseaseII = /\benfermedad\s+(?:en\s+)?(?:estadio|etapa|ec)\s*[:=-]?\s*(?:ii|2)[a-c]?\b/i;

  if (prefixII.test(str) || diseaseII.test(str)) {
    return 'Estadio II';
  }

  // 4. ESTADIO I / 1
  const prefixI = /\b(?:(?:yp|[cyp])?estadio|(?:yp|[cyp])?estad[ií]o|stage|etapa|ec|e\.c\.|figo|st\.?)(?:\s+(?:clinico|patologico|quirurgico|tnm))?\s*[:=-]?\s*(?:i|1)[a-c]?\b/i;
  const diseaseI = /\benfermedad\s+(?:en\s+)?(?:estadio|etapa|ec)\s*[:=-]?\s*(?:i|1)[a-c]?\b/i;

  if (prefixI.test(str) || diseaseI.test(str)) {
    return 'Estadio I';
  }

  return null;
};

export const detectStage = (p: Patient): 'Estadio I' | 'Estadio II' | 'Estadio III' | 'Estadio IV' | 'No consignado' => {
  // ORDEN DE PRIORIDAD 1: Campos estructurados existentes en el paciente
  const structuredFields = [
    p.estadio_actual,
    p.estadio,
    p.stage,
    p.clinicalStage,
    p.estadio_inicial,
    p.staging,
    p.etapa,
    p.ec,
    p.figo,
    p.initialStage,
    p.currentStage
  ];

  for (const candidate of structuredFields) {
    const fromStructured = parseStructuredStageValue(candidate);
    if (fromStructured) return fromStructured;
  }

  // ORDEN DE PRIORIDAD 2: Diagnóstico principal del paciente
  const fromDx = extractExplicitStage(p.diagnosis || p.primaryDiagnosis);
  if (fromDx) return fromDx;

  // ORDEN DE PRIORIDAD 3: Historia clínica y contexto clínico
  const fromHistory = extractExplicitStage(p.historyText);
  if (fromHistory) return fromHistory;

  const fromContext = extractExplicitStage(p.clinicalContext);
  if (fromContext) return fromContext;

  // ORDEN DE PRIORIDAD 4: Resumen de HC y Antecedentes
  const fromSummary = extractExplicitStage(p.resumen_hc || p.resumen || p.antecedentes || p.antecedentesOncologicos);
  if (fromSummary) return fromSummary;

  // ORDEN DE PRIORIDAD 5: Evolución médica (clinicalNotes o evoluciones)
  if (Array.isArray(p.clinicalNotes)) {
    for (const note of p.clinicalNotes) {
      const noteText = typeof note === 'string' ? note : note?.text;
      const fromNote = extractExplicitStage(noteText);
      if (fromNote) return fromNote;
    }
  }

  if (Array.isArray(p.evoluciones)) {
    for (const ev of p.evoluciones) {
      const evText = typeof ev === 'string' ? ev : (ev?.text || ev?.nota);
      const fromEv = extractExplicitStage(evText);
      if (fromEv) return fromEv;
    }
  }

  if (typeof p.evolucion === 'string') {
    const fromEv = extractExplicitStage(p.evolucion);
    if (fromEv) return fromEv;
  }

  // ORDEN DE PRIORIDAD 6: Línea de tiempo (eventos clínicos)
  if (Array.isArray(p.timeline)) {
    for (const event of p.timeline) {
      const eventText = `${event.note || ''} ${event.detail || ''} ${event.category || ''}`;
      const fromEvent = extractExplicitStage(eventText);
      if (fromEvent) return fromEvent;
    }
  }

  // ORDEN DE PRIORIDAD 7: Estudios por imágenes
  if (Array.isArray(p.imagingStudies)) {
    for (const study of p.imagingStudies) {
      const studyText = `${study.relevantFindings || ''} ${study.bodyRegion || ''}`;
      const fromStudy = extractExplicitStage(studyText);
      if (fromStudy) return fromStudy;
    }
  }

  // ORDEN DE PRIORIDAD 8: Cualquier otro campo de texto en el registro del paciente
  for (const key of Object.keys(p)) {
    if (['id', 'name', 'doctorId', 'hcNumber', 'fileUrls', 'lastUpdated', 'createdAt'].includes(key)) continue;
    const val = p[key];
    if (typeof val === 'string' && val.length > 3) {
      const fromKey = extractExplicitStage(val);
      if (fromKey) return fromKey;
    }
  }

  // Si no está explícitamente documentado ni puede determinarse con seguridad
  return 'No consignado';
};

// 3. CLASIFICACIÓN DE SITUACIÓN DE LA ENFERMEDAD
export type DiseaseSituation = 'Localizada' | 'Localmente avanzada' | 'Metastásica' | 'Remisión/seguimiento' | 'Progresión' | 'No consignada';

export const detectDiseaseSituation = (p: Patient): DiseaseSituation => {
  const dx = normalizeStr(p.diagnosis);
  const text = normalizeStr(p.historyText) + ' ' + normalizeStr(p.clinicalContext);
  const timelineText = (p.timeline || []).map(e => normalizeStr(e.note) + ' ' + normalizeStr(e.detail)).join(' ');
  const combined = `${dx} ${text} ${timelineText}`;

  if (!combined.trim()) return 'No consignada';

  // 1. Progresión activa
  const cleanedForProgression = combined
    .replace(/sin (?:evidencia de |signos de )?(?:recidiva|progresion|recaida|lesiones)/g, ' ')
    .replace(/no (?:presenta|se observan|se evidencian) (?:recidiva|progresion|recaida|lesiones)/g, ' ')
    .replace(/libre de (?:recidiva|progresion|recaida|enfermedad)/g, ' ');

  const hasProgression = 
    cleanedForProgression.includes('progresion') || 
    cleanedForProgression.includes('enfermedad progresiva') || 
    cleanedForProgression.includes('recidiva') || 
    cleanedForProgression.includes('recaida') ||
    /\bpd\b/.test(cleanedForProgression);

  if (hasProgression) return 'Progresión';

  // 2. Remisión / Seguimiento curativo
  const hasRemission = 
    combined.includes('remision completa') || combined.includes('remision parcial sostenida') ||
    combined.includes('libre de enfermedad') || combined.includes('sin evidencia de enfermedad') ||
    /\bned\b/.test(combined) || combined.includes('vigilancia') || combined.includes('en seguimiento') ||
    combined.includes('seguimiento curativo') || combined.includes('adyuvancia finalizada') ||
    combined.includes('completo adyuvancia') || combined.includes('finalizo tratamiento');

  // Si tiene remisión explícita (incluso post-metastasectomía)
  if (hasRemission) return 'Remisión/seguimiento';

  // 3. Metastásica activa (sin progresión nueva y sin remisión)
  const isMetastatic = 
    /\b(?:estadio|stage)\s*(?:iv|4)[a-c]?\b/.test(combined) ||
    /\bm1[a-c]?\b/.test(combined) ||
    /\b(?:metastasico|metastasica|metastasis|carcinomatosis|diseminad[ao])\b/.test(combined);

  if (isMetastatic) return 'Metastásica';

  // 4. Localmente avanzada
  const isLocallyAdvanced = 
    combined.includes('localmente avanzada') || combined.includes('localmente avanzado') ||
    /\b(?:estadio|stage)\s*(?:iii|3)[a-c]?\b/.test(combined) ||
    combined.includes('inoperable') || combined.includes('irresecable');

  if (isLocallyAdvanced) return 'Localmente avanzada';

  // 5. Localizada
  const isLocalized = 
    combined.includes('localizada') || combined.includes('localizado') ||
    /\b(?:estadio|stage)\s*(?:i|ii|1|2)[a-c]?\b/.test(combined) ||
    combined.includes('resecado') || combined.includes('postoperatorio') || combined.includes('postquirurgico') ||
    combined.includes('temprano');

  if (isLocalized) return 'Localizada';

  return 'No consignada';
};

// 4. CLASIFICACIÓN DE TRATAMIENTOS DOCUMENTADOS
export interface TreatmentDistribution {
  quimioterapia: number;
  inmunoterapia: number;
  terapiasDirigidas: number;
  hormonoterapia: number;
  radioterapia: number;
  cirugia: number;
  sinTratamientoConsignado: number;
}

export const detectTreatmentsForPatient = (p: Patient) => {
  const rawCombined = normalizeStr(p.diagnosis) + ' ' + 
                     normalizeStr(p.historyText) + ' ' + 
                     normalizeStr(p.clinicalContext) + ' ' +
                     (p.timeline || []).map(e => normalizeStr(e.note) + ' ' + normalizeStr(e.detail) + ' ' + normalizeStr(e.category)).join(' ') + ' ' +
                     (p.imagingStudies || []).map(s => normalizeStr(s.treatment)).join(' ');

  if (!rawCombined.trim()) {
    return { quimio: false, inmu: false, dirigida: false, hormono: false, radio: false, cirugia: false, hasAny: false };
  }

  // Limpiar negaciones explícitas para evitar falsos positivos
  const cleaned = rawCombined
    .replace(/(?:sin|no|ausencia de|niega)\s+(?:inmunoterapia|quimioterapia|radioterapia|cirugia|tratamiento)[a-z]*/g, ' ')
    .replace(/no\s+inmunoterapia/g, ' ')
    .replace(/no\s+recibe\s+(?:inmunoterapia|quimioterapia|radioterapia)/g, ' ');

  const hasQuimio = 
    /\b(?:quimioterapia|quimio|qt)\b/.test(cleaned) ||
    /\b(?:folfox|folfiri|folfirinox|capox|xelox|cisplatino|carboplatino|paclitaxel|docetaxel|gemcitabina|capecitabina|5-fu|fluorouracilo|pemetrexed|irinotecan|oxaliplatino|doxorrubicina|epirrubicina|ciclofosfamida|etoposide|nab-paclitaxel|vinorelbina|trifluridina)\b/.test(cleaned);

  const hasInmu = 
    /\binmunoterapia\b/.test(cleaned) ||
    /\b(?:pembrolizumab|nivolumab|atezolizumab|durvalumab|ipilimumab|avelumab|cemiplimab|dostarlimab)\b/.test(cleaned);

  const hasDirigida = 
    /\bterapia(?:s)?\s+dirigida(?:s)?\b/.test(cleaned) ||
    /\b(?:bevacizumab|trastuzumab|pertuzumab|cetuximab|panitumumab|osimertinib|alectinib|erlotinib|gefitinib|lorlatinib|brigatinib|sotorasib|regorafenib|aflibercept|t-dxd|t-dm1|olaparib|talazoparib|rucaparib|niraparib|dabrafenib|trametinib|vemurafenib|encorafenib|lenvatinib|cabozantinib|sorafenib|sunitinib|crizotinib)\b/.test(cleaned);

  const hasHormono = 
    /\b(?:hormonoterapia|terapia\s+hormonal|bloqueo\s+hormonal|tda)\b/.test(cleaned) ||
    /\b(?:tamoxifeno|anastrozol|letrozol|exemestano|fulvestrant|goserelina|leuprolide|bicalutamida|enzalutamida|abiraterona|apalutamida|darolutamida)\b/.test(cleaned);

  const hasRadio = 
    /\b(?:radioterapia|rt|rtx|sbrt|radiocirugia|srs|braquiterapia|irradiacion)\b/.test(cleaned);

  const hasCirugia = 
    /\b(?:cirugia|reseccion|mastectomia|colectomia|lobectomia|tumorectomia|cuadrantectomia|whipple|duodenopancreatectomia|gastrectomia|prostatectomia|nefrectomia|histerectomia|linfadenectomia|metastasectomia|hepatectomia|quirurgic[ao]s?|operad[ao]s?)\b/.test(cleaned);

  const hasAny = hasQuimio || hasInmu || hasDirigida || hasHormono || hasRadio || hasCirugia;

  return {
    quimio: hasQuimio,
    inmu: hasInmu,
    dirigida: hasDirigida,
    hormono: hasHormono,
    radio: hasRadio,
    cirugia: hasCirugia,
    hasAny
  };
};

export const PracticeStatsModal: React.FC<Props> = ({ patients, onClose }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  // --- DEDUPLICAR PACIENTES ESTRICTAMENTE POR ID ---
  const uniquePatients = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach(p => {
      if (p.id && !map.has(p.id)) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  }, [patients]);

  const totalPatients = uniquePatients.length;

  // --- FILTRADO TEMPORAL PARA "NUEVOS PACIENTES" Y EVOLUCIÓN ---
  const now = Date.now();
  const timeThreshold = useMemo(() => {
    switch (timeRange) {
      case '30d': return now - 30 * 24 * 60 * 60 * 1000;
      case '6m': return now - 180 * 24 * 60 * 60 * 1000;
      case '1y': return now - 365 * 24 * 60 * 60 * 1000;
      case 'all': return 0;
    }
  }, [timeRange, now]);

  const newPatientsInPeriod = useMemo(() => {
    if (timeRange === 'all') return totalPatients;
    return uniquePatients.filter(p => getPatientAnchorDate(p) >= timeThreshold).length;
  }, [uniquePatients, timeThreshold, timeRange, totalPatients]);

  // --- SITUACIÓN DE ENFERMEDAD & ACTIVOS / SEGUIMIENTO ---
  const situationCounts = useMemo(() => {
    const counts: Record<DiseaseSituation, number> = {
      'Localizada': 0,
      'Localmente avanzada': 0,
      'Metastásica': 0,
      'Remisión/seguimiento': 0,
      'Progresión': 0,
      'No consignada': 0,
    };

    uniquePatients.forEach(p => {
      const sit = detectDiseaseSituation(p);
      counts[sit] = (counts[sit] || 0) + 1;
    });

    return counts;
  }, [uniquePatients]);

  // Pacientes activos vs en seguimiento
  const activePatientsCount = useMemo(() => {
    // Activos: en tratamiento activo, enfermedad activa o progresión
    return situationCounts['Metastásica'] + situationCounts['Progresión'] + situationCounts['Localmente avanzada'];
  }, [situationCounts]);

  const followUpPatientsCount = useMemo(() => {
    return situationCounts['Remisión/seguimiento'] + situationCounts['Localizada'];
  }, [situationCounts]);

  // --- DISTRIBUCIÓN POR LOCALIZACIÓN TUMORAL ---
  const tumorLocationData = useMemo(() => {
    const counts: Record<string, number> = {};
    uniquePatients.forEach(p => {
      const site = detectTumorLocation(p);
      counts[site] = (counts[site] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [uniquePatients, totalPatients]);

  // --- DISTRIBUCIÓN POR ESTADIO ---
  const stageData = useMemo(() => {
    const stages: ('Estadio I' | 'Estadio II' | 'Estadio III' | 'Estadio IV' | 'No consignado')[] = [
      'Estadio I', 'Estadio II', 'Estadio III', 'Estadio IV', 'No consignado'
    ];
    const counts: Record<string, number> = {
      'Estadio I': 0,
      'Estadio II': 0,
      'Estadio III': 0,
      'Estadio IV': 0,
      'No consignado': 0,
    };

    uniquePatients.forEach(p => {
      const st = detectStage(p);
      counts[st] = (counts[st] || 0) + 1;
    });

    return stages.map(name => ({
      name,
      count: counts[name] || 0,
      percentage: totalPatients > 0 ? Math.round(((counts[name] || 0) / totalPatients) * 100) : 0
    }));
  }, [uniquePatients, totalPatients]);

  // --- DISTRIBUCIÓN POR SITUACIÓN DE ENFERMEDAD (PARA GRÁFICO) ---
  const situationData = useMemo(() => {
    const order: DiseaseSituation[] = [
      'Localizada', 'Localmente avanzada', 'Metastásica', 'Remisión/seguimiento', 'Progresión', 'No consignada'
    ];
    return order.map(name => ({
      name,
      count: situationCounts[name] || 0,
      percentage: totalPatients > 0 ? Math.round(((situationCounts[name] || 0) / totalPatients) * 100) : 0
    }));
  }, [situationCounts, totalPatients]);

  // --- TRATAMIENTOS DOCUMENTADOS ---
  const treatmentData = useMemo(() => {
    let quimio = 0;
    let inmu = 0;
    let dirigida = 0;
    let hormono = 0;
    let radio = 0;
    let cirugia = 0;
    let sinTratamiento = 0;

    uniquePatients.forEach(p => {
      const res = detectTreatmentsForPatient(p);
      if (res.quimio) quimio++;
      if (res.inmu) inmu++;
      if (res.dirigida) dirigida++;
      if (res.hormono) hormono++;
      if (res.radio) radio++;
      if (res.cirugia) cirugia++;
      if (!res.hasAny) sinTratamiento++;
    });

    const modalities = [
      { name: 'Quimioterapia', count: quimio },
      { name: 'Inmunoterapia', count: inmu },
      { name: 'Terapias dirigidas', count: dirigida },
      { name: 'Hormonoterapia', count: hormono },
      { name: 'Radioterapia', count: radio },
      { name: 'Cirugía', count: cirugia },
    ];

    return {
      modalities: modalities.map(m => ({
        ...m,
        percentage: totalPatients > 0 ? Math.round((m.count / totalPatients) * 100) : 0
      })),
      sinTratamiento,
      sinTratamientoPct: totalPatients > 0 ? Math.round((sinTratamiento / totalPatients) * 100) : 0
    };
  }, [uniquePatients, totalPatients]);

  // --- EVOLUCIÓN TEMPORAL (HISTÓRICO Y NUEVOS PACIENTES) ---
  const temporalEvolutionData = useMemo(() => {
    // Agrupar pacientes por mes de ingreso o registro
    const monthMap = new Map<string, { monthKey: string; label: string; timestamp: number; count: number }>();

    // Generar datos a partir de las fechas de pacientes
    uniquePatients.forEach(p => {
      const dateMs = getPatientAnchorDate(p);
      if (timeThreshold > 0 && dateMs < timeThreshold) return;

      const d = new Date(dateMs);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const label = `${monthNames[month]} ${year}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          monthKey: key,
          label,
          timestamp: new Date(year, month, 1).getTime(),
          count: 0
        });
      }
      monthMap.get(key)!.count += 1;
    });

    const sorted = Array.from(monthMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Calcular acumulado
    let accumulated = 0;
    return sorted.map(item => {
      accumulated += item.count;
      return {
        ...item,
        acumulado: accumulated,
        nuevos: item.count
      };
    });
  }, [uniquePatients, timeThreshold]);

  // --- GENERACIÓN DETERMINÍSTICA DEL "PERFIL DE MI PRÁCTICA" ---
  const practiceProfileSentences = useMemo(() => {
    if (totalPatients === 0) {
      return ['Actualmente no hay pacientes registrados en tu práctica profesional.'];
    }

    const sentences: string[] = [];

    // Frase 1: Total
    sentences.push(`Actualmente tienes ${totalPatients} ${totalPatients === 1 ? 'paciente registrado' : 'pacientes registrados'} en tu panel clínico.`);

    // Frase 2: Tumores más frecuentes
    const validTumors = tumorLocationData.filter(t => t.name !== 'No consignado' && t.name !== 'Otras' && t.count > 0);
    if (validTumors.length > 0) {
      if (validTumors.length === 1) {
        sentences.push(`La localización tumoral predominante es ${validTumors[0].name.toLowerCase()} (${validTumors[0].percentage}% de los casos).`);
      } else if (validTumors.length === 2) {
        sentences.push(`Los tumores más frecuentes corresponden a ${validTumors[0].name.toLowerCase()} (${validTumors[0].percentage}%) y ${validTumors[1].name.toLowerCase()} (${validTumors[1].percentage}%).`);
      } else {
        sentences.push(`Los tumores más frecuentes son ${validTumors[0].name.toLowerCase()} (${validTumors[0].percentage}%), ${validTumors[1].name.toLowerCase()} (${validTumors[1].percentage}%) y ${validTumors[2].name.toLowerCase()} (${validTumors[2].percentage}%).`);
      }
    }

    // Frase 3: Proporción de enfermedad metastásica / estadio
    const metastaticCount = situationCounts['Metastásica'];
    const metastaticPct = totalPatients > 0 ? Math.round((metastaticCount / totalPatients) * 100) : 0;
    if (metastaticCount > 0) {
      sentences.push(`El ${metastaticPct}% corresponde a enfermedad metastásica (Estadio IV).`);
    } else {
      const stageICount = stageData.find(s => s.name === 'Estadio I')?.count || 0;
      const stageIICount = stageData.find(s => s.name === 'Estadio II')?.count || 0;
      const earlyTotal = stageICount + stageIICount;
      if (earlyTotal > 0) {
        const earlyPct = Math.round((earlyTotal / totalPatients) * 100);
        sentences.push(`El ${earlyPct}% de los pacientes presenta enfermedad en estadios tempranos (Estadio I-II).`);
      }
    }

    // Frase 4: Seguimiento o remisión
    const followUpCount = situationCounts['Remisión/seguimiento'];
    if (followUpCount > 0) {
      const followUpPct = Math.round((followUpCount / totalPatients) * 100);
      sentences.push(`El ${followUpPct}% de los pacientes se encuentra en régimen de seguimiento o remisión clínica.`);
    }

    // Frase 5: Tratamiento más frecuente
    const activeModalities = treatmentData.modalities.filter(m => m.count > 0).sort((a, b) => b.count - a.count);
    if (activeModalities.length > 0) {
      const topTreatment = activeModalities[0];
      sentences.push(`La modalidad terapéutica documentada con mayor frecuencia es ${topTreatment.name.toLowerCase()} (${topTreatment.percentage}% de los pacientes).`);
    }

    return sentences;
  }, [totalPatients, tumorLocationData, situationCounts, stageData, treatmentData]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* ── ENCABEZADO ─────────────────────────────────────────────────── */}
        <header className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-200">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                  Panel Asistencial
                </span>
                <span className="text-xs font-semibold text-gray-400">
                  Solo Lectura · Datos Determinísticos
                </span>
              </div>
              <h2 className="text-lg font-black text-gray-800 tracking-tight mt-0.5">
                Estadísticas de mi práctica
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* SELECTOR DE PERÍODO */}
            <div className="hidden sm:flex items-center bg-gray-100/90 p-1 rounded-xl text-[10px] font-black">
              {(['30d', '6m', '1y', 'all'] as TimeRange[]).map(t => {
                const labels: Record<TimeRange, string> = {
                  '30d': '30 días',
                  '6m': '6 meses',
                  '1y': '1 año',
                  'all': 'Todo'
                };
                const active = timeRange === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      active 
                        ? 'bg-white text-blue-600 shadow-sm shadow-gray-200' 
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* SELECTOR MÓVIL DE PERÍODO */}
        <div className="sm:hidden px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Período:</span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-[9px] font-bold">
            {(['30d', '6m', '1y', 'all'] as TimeRange[]).map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2 py-1 rounded ${timeRange === t ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
              >
                {t === '30d' ? '30d' : t === '6m' ? '6m' : t === '1y' ? '1a' : 'Todo'}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENIDO PRINCIPAL SCROLLABLE ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f8f9fa]">

          {/* 1. SECCIÓN: RESUMEN GENERAL (TARJETAS) */}
          <section>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* TOTAL PACIENTES */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between text-blue-600 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Pacientes</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-800 tracking-tight">{totalPatients}</div>
                <div className="text-[10px] text-gray-400 mt-1 font-semibold">Registros médicos únicos</div>
              </div>

              {/* PACIENTES ACTIVOS */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between text-indigo-600 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pacientes Activos</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Activity size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-800 tracking-tight">{activePatientsCount}</div>
                <div className="text-[10px] text-gray-400 mt-1 font-semibold">
                  {totalPatients > 0 ? `${Math.round((activePatientsCount / totalPatients) * 100)}% del total` : 'Tratamiento / Monitoreo'}
                </div>
              </div>

              {/* PACIENTES EN SEGUIMIENTO */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between text-emerald-600 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">En Seguimiento</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-800 tracking-tight">{followUpPatientsCount}</div>
                <div className="text-[10px] text-gray-400 mt-1 font-semibold">
                  {totalPatients > 0 ? `${Math.round((followUpPatientsCount / totalPatients) * 100)}% del total` : 'Vigilancia / Remisión'}
                </div>
              </div>

              {/* NUEVOS EN PERÍODO */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between text-amber-600 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nuevos en Período</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-800 tracking-tight">{newPatientsInPeriod}</div>
                <div className="text-[10px] text-gray-400 mt-1 font-semibold">
                  {timeRange === 'all' ? 'Histórico completo' : `En ventana seleccionada`}
                </div>
              </div>

            </div>
          </section>

          {/* 7. SECCIÓN: "PERFIL DE MI PRÁCTICA" (SÍNTESIS NARRATIVA AUTOMÁTICA) */}
          <section className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-lg shadow-indigo-950/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-2 py-0.5 rounded">
                Síntesis Clínica Automatizada
              </span>
              <span className="text-[10px] font-bold text-blue-200">
                Perfil de mi práctica
              </span>
            </div>
            <div className="space-y-1.5 text-xs md:text-sm text-blue-100 font-medium leading-relaxed">
              {practiceProfileSentences.map((sentence, idx) => (
                <p key={idx} className="flex items-start gap-2">
                  <span className="text-blue-300 font-black shrink-0">•</span>
                  <span>{sentence}</span>
                </p>
              ))}
            </div>
          </section>

          {/* 6. SECCIÓN: EVOLUCIÓN TEMPORAL */}
          <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                  <TrendingUp size={15} className="text-blue-600" />
                  Evolución Temporal de Pacientes
                </h3>
                <p className="text-[11px] text-gray-400 font-medium">
                  {timeRange === 'all' ? 'Registro histórico acumulado de pacientes' : `Pacientes registrados en el período (${timeRange.toUpperCase()})`}
                </p>
              </div>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                {temporalEvolutionData.length} {temporalEvolutionData.length === 1 ? 'período analizado' : 'períodos analizados'}
              </span>
            </div>

            {temporalEvolutionData.length > 0 ? (
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={temporalEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-gray-900 text-white text-[11px] p-2.5 rounded-xl shadow-xl space-y-1">
                              <div className="font-bold text-blue-300">{label}</div>
                              <div>Nuevos ingresos: <span className="font-bold">{item.nuevos}</span></div>
                              <div>Total acumulado: <span className="font-bold">{item.acumulado}</span></div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="acumulado" 
                      stroke="#2563eb" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#colorAcumulado)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 text-xs">
                <Calendar size={24} className="mb-1 text-gray-200" />
                <span>No hay fechas documentadas para graficar en el rango seleccionado</span>
              </div>
            )}
          </section>

          {/* GRID 2 COLUMNAS: LOCALIZACIÓN TUMORAL Y ESTADIO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* 2. SECCIÓN: DISTRIBUCIÓN POR LOCALIZACIÓN TUMORAL */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                    <PieIcon size={15} className="text-purple-600" />
                    Localización Tumoral Primaria
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">Distribución y porcentaje sobre el total (N = {totalPatients})</p>
                </div>
              </div>

              {tumorLocationData.length > 0 ? (
                <div className="space-y-4">
                  {/* Gráfico de barras horizontales simple */}
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={tumorLocationData.slice(0, 6)} 
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
                        <Tooltip 
                          formatter={(val: unknown) => [`${val} pacientes`, 'Frecuencia']}
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {tumorLocationData.slice(0, 6).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Tabla desglosada */}
                  <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto pr-1">
                    {tumorLocationData.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="font-bold text-gray-700">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-medium">{item.count} pac.</span>
                          <span className="font-black text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md min-w-[42px] text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-300 text-xs">
                  Sin registros para procesar
                </div>
              )}
            </section>

            {/* 3. SECCIÓN: DISTRIBUCIÓN POR ESTADIO */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                    <Layers size={15} className="text-blue-600" />
                    Distribución por Estadio
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">Estadificación oncológica documentada</p>
                </div>
              </div>

              {stageData.length > 0 ? (
                <div className="space-y-4">
                  {/* Gráfico de barras */}
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(val: unknown) => [`${val} pacientes`, 'Pacientes']}
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {stageData.map((entry, index) => {
                            const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#dc2626', '#94a3b8'];
                            return <Cell key={`cell-stage-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Lista con porcentajes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stageData.map((st, idx) => (
                      <div key={idx} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">{st.name}</span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-base font-black text-gray-800">{st.count}</span>
                          <span className="text-xs font-bold text-blue-600">{st.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-300 text-xs">
                  Sin estadios registrados
                </div>
              )}
            </section>

          </div>

          {/* GRID 2 COLUMNAS: SITUACIÓN DE ENFERMEDAD Y TRATAMIENTOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* 4. SECCIÓN: SITUACIÓN DE LA ENFERMEDAD */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                    <Activity size={15} className="text-emerald-600" />
                    Situación de la Enfermedad
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">Estado clínico actual del paciente</p>
                </div>
              </div>

              <div className="space-y-2">
                {situationData.map((sit, idx) => {
                  const badgeColors: Record<DiseaseSituation, { bar: string; text: string; bg: string }> = {
                    'Localizada': { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
                    'Localmente avanzada': { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
                    'Metastásica': { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' },
                    'Remisión/seguimiento': { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
                    'Progresión': { bar: 'bg-red-600', text: 'text-red-700', bg: 'bg-red-50' },
                    'No consignada': { bar: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' },
                  };
                  const color = badgeColors[sit.name as DiseaseSituation] || badgeColors['No consignada'];

                  return (
                    <div key={idx} className="p-2.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-gray-700">{sit.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600">{sit.count} pac.</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                            {sit.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${color.bar}`} 
                          style={{ width: `${sit.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 5. SECCIÓN: TRATAMIENTOS DOCUMENTADOS */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                    <Stethoscope size={15} className="text-indigo-600" />
                    Tratamientos Documentados
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">Modalidades con registro explícito en historia o cronología</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {treatmentData.modalities.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-gray-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">{item.count} {item.count === 1 ? 'paciente' : 'pacientes'}</span>
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md min-w-[40px] text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}

                {treatmentData.sinTratamiento > 0 && (
                  <div className="mt-2 pt-2 border-t border-dashed border-gray-200 flex items-center justify-between text-xs text-gray-400">
                    <span className="font-semibold">Sin tratamientos consignados:</span>
                    <span className="font-bold">{treatmentData.sinTratamiento} pac. ({treatmentData.sinTratamientoPct}%)</span>
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* NOTA DE PIE / PRIVACIDAD Y VALIDACIÓN */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/70 flex items-start gap-3 text-gray-500 text-[11px] leading-relaxed">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-900">Privacidad y Determinismo Clínico</p>
              <p>
                Las métricas han sido computadas estrictamente sobre los pacientes asignados a tu cuenta profesional en Firestore.
                No se transfirieron datos personales a motores de IA ni se modificó ningún registro médico.
              </p>
            </div>
          </div>

        </div>

        {/* ── FOOTER MODAL ──────────────────────────────────────────────── */}
        <footer className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-400 font-semibold">
            {totalPatients} pacientes analizados determinísticamente
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </footer>

      </div>
    </div>
  );
};

export default PracticeStatsModal;
