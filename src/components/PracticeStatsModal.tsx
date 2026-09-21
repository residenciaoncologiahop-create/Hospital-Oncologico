import React, { useState, useMemo } from 'react';
import { 
  X, BarChart3, Users, Activity, Calendar, ShieldCheck, 
  TrendingUp, Layers, Stethoscope,
  PieChart as PieIcon, CheckCircle2, AlertCircle, Info,
  Eye
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
  tumorLocation?: string;
  tumorSite?: string;
  localizacion?: string;
  organo?: string;
  primarySite?: string;
  topografia?: string;
  histology?: string;
  histologia?: string;
  anatomiaPatologica?: string;
  pathology?: string;
  biomarkers?: string | string[];
  biomarcadores?: string | string[];
  molecularProfile?: string;
  perfilMolecular?: string;
  linea_tratamiento?: string | number;
  lineaTratamiento?: string | number;
  treatmentLine?: string | number;
  linea?: string | number;
  line?: string | number;
  receptor_RE?: string;
  receptor_RP?: string;
  receptor_HER2?: string;
  receptor_KRAS?: string;
  receptor_EGFR?: string;
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
  doctorId?: string;
  onMigrateProfiles?: () => Promise<void>;
}

type TimeRange = '30d' | '6m' | '1y' | 'all';

// --- TIPOS DE TRAZABILIDAD Y CALIDAD CLÍNICA ---
export type StageCategory = 'Estadio I' | 'Estadio II' | 'Estadio III' | 'Estadio IV' | 'No consignado';
export type DataSourceOrigin = 'structured' | 'text' | 'missing';

export type UnassignedStageReason = 
  | 'no_mention'                   // Sin mención explícita de estadio
  | 'insufficient_data'            // Información clínica insuficiente
  | 'related_but_undetermined'     // Tiene información relacionada pero no permite determinar estadio
  | 'not_evaluable';               // No evaluable

export interface StageDetectionResult {
  stage: StageCategory;
  origin: DataSourceOrigin;
  unassignedReason?: UnassignedStageReason;
}

export interface TumorLocationResult {
  site: string;
  origin: DataSourceOrigin;
}

export interface HistologyResult {
  histology: string;
  origin: DataSourceOrigin;
}

export interface BiomarkersResult {
  hasBiomarkers: boolean;
  biomarkers: string[];
  origin: DataSourceOrigin;
}

export interface TreatmentLineResult {
  hasTreatmentLine: boolean;
  line: string;
  origin: DataSourceOrigin;
}

export const UNASSIGNED_REASON_LABELS: Record<UnassignedStageReason, { title: string; badge: string; desc: string }> = {
  'no_mention': {
    title: 'Sin mención explícita de estadio',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    desc: 'El paciente cuenta con diagnóstico o historia clínica, pero no se documentó explícitamente el estadio ni metástasis inequívoca.'
  },
  'insufficient_data': {
    title: 'Información clínica insuficiente',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    desc: 'Registros clínicos mínimos o incompletos que no aportan contexto oncológico suficiente.'
  },
  'related_but_undetermined': {
    title: 'Tiene información relacionada pero no permite determinar estadio',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    desc: 'Presenta datos aislados (TNM parcial, nódulo en estudio, sospecha diagnóstica) que no permiten inferir estadio de forma segura.'
  },
  'not_evaluable': {
    title: 'No evaluable',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    desc: 'Casos no neoplásicos, descartes de malignidad o condiciones clínicas no estadiables.'
  }
};

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
export const matchTumorSiteStr = (str: string): string | null => {
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

export const detectTumorLocationWithOrigin = (p: Patient): TumorLocationResult => {
  // A. Primero buscar en campos estructurados de localización tumoral
  const structuredFields = [
    p.tumorLocation, p.tumorSite, p.localizacion, p.organo, p.primarySite, p.topografia
  ];
  for (const s of structuredFields) {
    if (typeof s === 'string' && s.trim().length > 2) {
      const match = matchTumorSiteStr(normalizeStr(s));
      if (match) return { site: match, origin: 'structured' };
    }
  }

  // B. Recuperar de texto clínico explícito
  const rawDx = normalizeStr(p.diagnosis || p.primaryDiagnosis);
  const rawText = normalizeStr(p.historyText) + ' ' + normalizeStr(p.clinicalContext);

  if (!rawDx && !rawText) return { site: 'No consignado', origin: 'missing' };

  const cleanMetastases = (str: string) => str
    .replace(/metastasis\s+(?:a\s+distancia|pulmonar[a-z]*|hepatica[a-z]*|osea[a-z]*|cerebral[a-z]*|subcutanea[a-z]*|ganglionar[a-z]*)/g, ' ')
    .replace(/compromiso\s+(?:pulmonar|hepatico|oseo|cerebral|ganglionar)/g, ' ');

  const dx = cleanMetastases(rawDx);
  const text = cleanMetastases(rawText);

  // Buscar con máxima prioridad en el diagnóstico explícito
  const fromDx = matchTumorSiteStr(dx);
  if (fromDx) return { site: fromDx, origin: 'text' };

  // Buscar en el texto clínico y antecedentes
  const fromText = matchTumorSiteStr(text);
  if (fromText) return { site: fromText, origin: 'text' };

  const otherClinicalText = [
    p.resumen_hc, p.resumen, p.antecedentes, p.antecedentesOncologicos,
    Array.isArray(p.clinicalNotes) ? p.clinicalNotes.map(n => typeof n === 'string' ? n : n?.text).join(' ') : ''
  ].filter(Boolean).join(' ');

  const fromOther = matchTumorSiteStr(cleanMetastases(normalizeStr(otherClinicalText)));
  if (fromOther) return { site: fromOther, origin: 'text' };

  if (rawDx.length > 3) return { site: 'Otras', origin: 'text' };

  return { site: 'No consignado', origin: 'missing' };
};

export const detectTumorLocation = (p: Patient): string => {
  return detectTumorLocationWithOrigin(p).site;
};

// 2. CLASIFICACIÓN DE ESTADIO

// Parser determinístico para campos estructurados existentes
export const parseStructuredStageValue = (valRaw: unknown): StageCategory | null => {
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
export const extractExplicitStage = (textRaw?: unknown): StageCategory | null => {
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

// Clasificador determinístico del motivo por el cual un paciente no tiene estadio documentado
export const classifyUnassignedReason = (p: Patient): UnassignedStageReason => {
  const combinedRaw = [
    p.diagnosis,
    p.primaryDiagnosis,
    p.historyText,
    p.clinicalContext,
    p.resumen_hc,
    p.resumen,
    p.antecedentes,
    p.antecedentesOncologicos,
    p.evolucion,
    Array.isArray(p.clinicalNotes) ? p.clinicalNotes.map(n => typeof n === 'string' ? n : n?.text).join(' ') : '',
    Array.isArray(p.evoluciones) ? p.evoluciones.map(e => typeof e === 'string' ? e : (e?.text || e?.nota)).join(' ') : '',
    Array.isArray(p.timeline) ? p.timeline.map(e => `${e.note || ''} ${e.detail || ''}`).join(' ') : ''
  ].filter(Boolean).join(' ');

  const text = normalizeStr(combinedRaw);

  // 1. Información clínica insuficiente: ficha vacía o casi vacía (< 35 caracteres)
  if (text.length < 35) {
    return 'insufficient_data';
  }

  // 2. No evaluable: patología benigna documentada, descarte de neoplasia, o no oncológico
  if (
    text.includes('benigno') || text.includes('benigna') || 
    text.includes('descarta neoplasia') || text.includes('descarta malignidad') ||
    text.includes('sin malignidad') || text.includes('no oncologico')
  ) {
    return 'not_evaluable';
  }

  // 3. Tiene información relacionada pero no permite determinar estadio:
  // TNM aislado sin estadio agrupado, nódulo en estudio, sospecha diagnóstica, biopsia pendiente
  const hasRelatedFindings = 
    /\b(?:t[0-4]|n[0-3]|mx|nx|tx|tis)\b/i.test(text) ||
    text.includes('en estudio') || text.includes('biopsia pendiente') ||
    text.includes('nodulo') || text.includes('adenopatia') || text.includes('masa') ||
    text.includes('sospecha') || text.includes('tnm') || text.includes('postoperatorio');

  if (hasRelatedFindings) {
    return 'related_but_undetermined';
  }

  // 4. Sin mención explícita de estadio:
  // Tiene contexto clínico y diagnóstico pero el profesional no consignó el estadio
  return 'no_mention';
};

// Detección de estadio con trazabilidad de origen (Estructurado vs Recuperado de texto vs Realmente ausente)
export const detectStageWithOrigin = (p: Patient): StageDetectionResult => {
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
    if (fromStructured) {
      return { stage: fromStructured, origin: 'structured' };
    }
  }

  // ORDEN DE PRIORIDAD 2: Diagnóstico principal del paciente
  const fromDx = extractExplicitStage(p.diagnosis || p.primaryDiagnosis);
  if (fromDx) return { stage: fromDx, origin: 'text' };

  // ORDEN DE PRIORIDAD 3: Historia clínica y contexto clínico
  const fromHistory = extractExplicitStage(p.historyText);
  if (fromHistory) return { stage: fromHistory, origin: 'text' };

  const fromContext = extractExplicitStage(p.clinicalContext);
  if (fromContext) return { stage: fromContext, origin: 'text' };

  // ORDEN DE PRIORIDAD 4: Resumen de HC y Antecedentes
  const fromSummary = extractExplicitStage(p.resumen_hc || p.resumen || p.antecedentes || p.antecedentesOncologicos);
  if (fromSummary) return { stage: fromSummary, origin: 'text' };

  // ORDEN DE PRIORIDAD 5: Evolución médica (clinicalNotes o evoluciones)
  if (Array.isArray(p.clinicalNotes)) {
    for (const note of p.clinicalNotes) {
      const noteText = typeof note === 'string' ? note : note?.text;
      const fromNote = extractExplicitStage(noteText);
      if (fromNote) return { stage: fromNote, origin: 'text' };
    }
  }

  if (Array.isArray(p.evoluciones)) {
    for (const ev of p.evoluciones) {
      const evText = typeof ev === 'string' ? ev : (ev?.text || ev?.nota);
      const fromEv = extractExplicitStage(evText);
      if (fromEv) return { stage: fromEv, origin: 'text' };
    }
  }

  if (typeof p.evolucion === 'string') {
    const fromEv = extractExplicitStage(p.evolucion);
    if (fromEv) return { stage: fromEv, origin: 'text' };
  }

  // ORDEN DE PRIORIDAD 6: Línea de tiempo (eventos clínicos)
  if (Array.isArray(p.timeline)) {
    for (const event of p.timeline) {
      const eventText = `${event.note || ''} ${event.detail || ''} ${event.category || ''}`;
      const fromEvent = extractExplicitStage(eventText);
      if (fromEvent) return { stage: fromEvent, origin: 'text' };
    }
  }

  // ORDEN DE PRIORIDAD 7: Estudios por imágenes
  if (Array.isArray(p.imagingStudies)) {
    for (const study of p.imagingStudies) {
      const studyText = `${study.relevantFindings || ''} ${study.bodyRegion || ''}`;
      const fromStudy = extractExplicitStage(studyText);
      if (fromStudy) return { stage: fromStudy, origin: 'text' };
    }
  }

  // ORDEN DE PRIORIDAD 8: Cualquier otro campo de texto en el registro del paciente
  for (const key of Object.keys(p)) {
    if (['id', 'name', 'doctorId', 'hcNumber', 'fileUrls', 'lastUpdated', 'createdAt'].includes(key)) continue;
    const val = p[key];
    if (typeof val === 'string' && val.length > 3) {
      const fromKey = extractExplicitStage(val);
      if (fromKey) return { stage: fromKey, origin: 'text' };
    }
  }

  // Si no está explícitamente documentado ni puede determinarse con seguridad
  return {
    stage: 'No consignado',
    origin: 'missing',
    unassignedReason: classifyUnassignedReason(p)
  };
};

export const detectStage = (p: Patient): StageCategory => {
  return detectStageWithOrigin(p).stage;
};

// 3. RECUPERACIÓN DETERMINÍSTICA DE HISTOLOGÍA
export const matchHistologyStr = (str: string): string | null => {
  if (str.includes('adenocarcinoma')) return 'Adenocarcinoma';
  if (str.includes('ductal') || /\bcdi\b/.test(str)) return 'Carcinoma ductal';
  if (str.includes('lobulillar') || /\bcli\b/.test(str)) return 'Carcinoma lobulillar';
  if (str.includes('epidermoide') || str.includes('escamoso')) return 'Carcinoma epidermoide/escamoso';
  if (str.includes('urotelial') || str.includes('celulas transicionales')) return 'Carcinoma urotelial';
  if (str.includes('melanoma')) return 'Melanoma';
  if (str.includes('microcitico') || str.includes('celulas pequenas')) return 'Carcinoma de células pequeñas';
  if (str.includes('no microcitico') || str.includes('celulas no pequenas') || /\bnsclc\b/.test(str)) return 'Carcinoma no microcítico';
  if (str.includes('celulas claras')) return 'Carcinoma de células claras';
  if (str.includes('linfoma')) return 'Linfoma';
  if (str.includes('sarcoma') || str.includes('gist')) return 'Sarcoma/GIST';
  if (str.includes('neuroendocrino')) return 'Tumor neuroendocrino';
  if (str.includes('papilar')) return 'Carcinoma papilar';
  if (str.includes('basocelular')) return 'Carcinoma basocelular';
  return null;
};

export const detectHistology = (p: Patient): HistologyResult => {
  // A. Estructurado
  const structured = [p.histology, p.histologia, p.anatomiaPatologica, p.pathology];
  for (const s of structured) {
    if (typeof s === 'string' && s.trim().length > 3) {
      const norm = normalizeStr(s);
      if (norm !== 'no consignada' && norm !== 'no consignado' && norm !== 'pendiente') {
        const matched = matchHistologyStr(norm);
        if (matched) return { histology: matched, origin: 'structured' };
      }
    }
  }

  // B. Texto clínico
  const allTexts = [
    p.diagnosis, p.primaryDiagnosis, p.historyText, p.clinicalContext,
    p.resumen_hc, p.resumen, p.antecedentes
  ].filter(Boolean).map(t => normalizeStr(String(t))).join(' ');

  if (!allTexts) return { histology: 'No consignada', origin: 'missing' };

  const fromText = matchHistologyStr(allTexts);
  if (fromText) return { histology: fromText, origin: 'text' };

  return { histology: 'No consignada', origin: 'missing' };
};

// 4. RECUPERACIÓN DETERMINÍSTICA DE BIOMARCADORES
export const detectBiomarkers = (p: Patient): BiomarkersResult => {
  const foundMarkers: string[] = [];

  // A. Estructurado
  const structuredBio = [
    p.biomarkers, p.biomarcadores, p.molecularProfile, p.perfilMolecular,
    p.receptor_RE, p.receptor_RP, p.receptor_HER2, p.receptor_KRAS, p.receptor_EGFR
  ];
  const hasStructured = structuredBio.some(b => {
    if (b === undefined || b === null || b === '') return false;
    const s = normalizeStr(String(b));
    return s !== 'no consignado' && s !== 'pendiente' && s !== 'no evaluado' && s !== 's/d';
  });

  // B. Texto clínico
  const allTexts = [
    p.diagnosis, p.primaryDiagnosis, p.historyText, p.clinicalContext,
    p.resumen_hc, p.antecedentes,
    Array.isArray(p.clinicalNotes) ? p.clinicalNotes.map(n => typeof n === 'string' ? n : n?.text).join(' ') : ''
  ].filter(Boolean).map(t => normalizeStr(String(t))).join(' ');

  if (/\b(?:re\+|re-|re\s*positivo|re\s*negativo|receptor(?:es)?\s+estrogenicos?|er\+|er-)\b/.test(allTexts)) foundMarkers.push('RE');
  if (/\b(?:rp\+|rp-|rp\s*positivo|rp\s*negativo|receptor(?:es)?\s+progesterona|pr\+|pr-)\b/.test(allTexts)) foundMarkers.push('RP');
  if (/\b(?:her2|her-2|cerbb2|her2\s*3\+|her2\s*positivo|her2\s*negativo|triple\s*negativo)\b/.test(allTexts)) foundMarkers.push('HER2');
  if (/\b(?:ki-?67)\b/.test(allTexts)) foundMarkers.push('Ki-67');
  if (/\b(?:kras|nras|braf|egfr|alk|ros1|ret|met|ntrk)\b/.test(allTexts)) foundMarkers.push('Panel Molecular');
  if (/\b(?:pdl1|pd-l1|tps|cps)\b/.test(allTexts)) foundMarkers.push('PD-L1');
  if (/\b(?:msi|msi-h|mss|dmmr|pmmr|microsatelit)\b/.test(allTexts)) foundMarkers.push('MSI/MMR');
  if (/\b(?:brca1|brca2|brca)\b/.test(allTexts)) foundMarkers.push('BRCA');
  if (/\b(?:psa|antigeno prostatico)\b/.test(allTexts)) foundMarkers.push('PSA');

  if (hasStructured) {
    return {
      hasBiomarkers: true,
      biomarkers: foundMarkers.length > 0 ? foundMarkers : ['Biomarcadores estructurados'],
      origin: 'structured'
    };
  }

  if (foundMarkers.length > 0) {
    return {
      hasBiomarkers: true,
      biomarkers: foundMarkers,
      origin: 'text'
    };
  }

  return {
    hasBiomarkers: false,
    biomarkers: [],
    origin: 'missing'
  };
};

// 5. RECUPERACIÓN DETERMINÍSTICA DE LÍNEA DE TRATAMIENTO
export const detectTreatmentLine = (p: Patient): TreatmentLineResult => {
  // A. Estructurado
  const structuredLine = p.linea_tratamiento || p.lineaTratamiento || p.treatmentLine || p.linea || p.line;
  if (structuredLine !== undefined && structuredLine !== null && String(structuredLine).trim() !== '') {
    const s = normalizeStr(String(structuredLine));
    if (s !== 'no consignado' && s !== 's/d' && s !== 'pendiente') {
      return { hasTreatmentLine: true, line: String(structuredLine), origin: 'structured' };
    }
  }

  // B. Texto clínico
  const allTexts = [
    p.diagnosis, p.primaryDiagnosis, p.historyText, p.clinicalContext,
    p.resumen_hc, p.antecedentes, p.evolucion,
    Array.isArray(p.clinicalNotes) ? p.clinicalNotes.map(n => typeof n === 'string' ? n : n?.text).join(' ') : ''
  ].filter(Boolean).map(t => normalizeStr(String(t))).join(' ');

  if (/\b(?:1(?:ra|era)?\s*linea|primera\s*linea|1l|l1)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: '1ra Línea', origin: 'text' };
  }
  if (/\b(?:2(?:da|nda)?\s*linea|segunda\s*linea|2l|l2)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: '2da Línea', origin: 'text' };
  }
  if (/\b(?:3(?:ra|era)?\s*linea|tercera\s*linea|3l|l3)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: '3ra Línea', origin: 'text' };
  }
  if (/\b(?:adyuvante|adyuvancia)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: 'Adyuvancia', origin: 'text' };
  }
  if (/\b(?:neoadyuvante|neoadyuvancia)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: 'Neoadyuvancia', origin: 'text' };
  }
  if (/\b(?:mantenimiento)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: 'Mantenimiento', origin: 'text' };
  }
  if (/\b(?:paliativo\s+exclusivo|tratamiento\s+paliativo)\b/.test(allTexts)) {
    return { hasTreatmentLine: true, line: 'Paliativo', origin: 'text' };
  }

  return { hasTreatmentLine: false, line: 'No consignada', origin: 'missing' };
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

export const PracticeStatsModal: React.FC<Props> = ({ patients, onClose, onMigrateProfiles }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [showUnassignedStageModal, setShowUnassignedStageModal] = useState(false);
  const [unassignedFilter, setUnassignedFilter] = useState<'all' | UnassignedStageReason>('all');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  const handleMigrateProfiles = async () => {
    if (!onMigrateProfiles || isMigrating) return;
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      await onMigrateProfiles();
      setMigrationResult('✓ Estadios actualizados correctamente. Los cambios se reflejarán al reabrir las estadísticas.');
    } catch (err: any) {
      setMigrationResult('Error durante la actualización: ' + (err?.message || err));
    } finally {
      setIsMigrating(false);
    }
  };

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

  // --- ANÁLISIS INTEGRAL DE ESTADIO CON TRAZABILIDAD ---
  const stageAnalysis = useMemo(() => {
    const map = new Map<string, StageDetectionResult>();
    const counts: Record<StageCategory, number> = {
      'Estadio I': 0,
      'Estadio II': 0,
      'Estadio III': 0,
      'Estadio IV': 0,
      'No consignado': 0,
    };
    const originCounts: Record<DataSourceOrigin, number> = {
      'structured': 0,
      'text': 0,
      'missing': 0,
    };
    const unassignedReasonCounts: Record<UnassignedStageReason, number> = {
      'no_mention': 0,
      'insufficient_data': 0,
      'related_but_undetermined': 0,
      'not_evaluable': 0,
    };
    const unassignedPatientsList: Array<{ patient: Patient; reason: UnassignedStageReason }> = [];

    uniquePatients.forEach(p => {
      const res = detectStageWithOrigin(p);
      map.set(p.id, res);
      counts[res.stage] = (counts[res.stage] || 0) + 1;
      originCounts[res.origin] = (originCounts[res.origin] || 0) + 1;
      if (res.stage === 'No consignado' && res.unassignedReason) {
        unassignedReasonCounts[res.unassignedReason] = (unassignedReasonCounts[res.unassignedReason] || 0) + 1;
        unassignedPatientsList.push({ patient: p, reason: res.unassignedReason });
      }
    });

    const stages: StageCategory[] = ['Estadio I', 'Estadio II', 'Estadio III', 'Estadio IV', 'No consignado'];
    const stageChartData = stages.map(name => ({
      name,
      count: counts[name] || 0,
      percentage: totalPatients > 0 ? Math.round(((counts[name] || 0) / totalPatients) * 100) : 0
    }));

    return {
      patientMap: map,
      counts,
      originCounts,
      unassignedReasonCounts,
      unassignedPatientsList,
      stageChartData
    };
  }, [uniquePatients, totalPatients]);

  const stageData = stageAnalysis.stageChartData;

  // --- INDICADOR DETERMINÍSTICO DE CALIDAD DE DATOS ---
  const dataQuality = useMemo(() => {
    let sufficient = 0;
    let insufficient = 0;
    let missingStage = 0;
    let missingBiomarkers = 0;
    let missingHistology = 0;
    let missingTreatmentLine = 0;

    uniquePatients.forEach(p => {
      const stageRes = stageAnalysis.patientMap.get(p.id) || detectStageWithOrigin(p);
      const tumorRes = detectTumorLocationWithOrigin(p);
      const histRes = detectHistology(p);
      const bioRes = detectBiomarkers(p);
      const lineRes = detectTreatmentLine(p);
      const txRes = detectTreatmentsForPatient(p);

      if (stageRes.stage === 'No consignado') missingStage++;
      if (!bioRes.hasBiomarkers) missingBiomarkers++;
      if (histRes.histology === 'No consignada') missingHistology++;
      if (!lineRes.hasTreatmentLine) missingTreatmentLine++;

      // Criterio de suficiencia clínica:
      // Pacientes con localización confirmada, estadio documentado (I-IV) y al menos un tratamiento o histología
      const isSufficient = 
        tumorRes.site !== 'No consignado' && 
        tumorRes.site !== 'Otras' &&
        stageRes.stage !== 'No consignado' && 
        (txRes.hasAny || histRes.histology !== 'No consignada');

      // Información insuficiente: ficha mínima o clasificada como 'insufficient_data'
      const isInsufficient = 
        stageRes.unassignedReason === 'insufficient_data' ||
        ((!p.diagnosis || p.diagnosis.trim().length < 5) && 
         (!p.historyText || p.historyText.trim().length < 20) && 
         stageRes.stage === 'No consignado' && 
         !txRes.hasAny);

      if (isSufficient) {
        sufficient++;
      } else if (isInsufficient) {
        insufficient++;
      }
    });

    // Parcialmente documentados: el resto exacto (garantizando suma == totalPatients)
    const partial = Math.max(0, totalPatients - sufficient - insufficient);

    return {
      sufficient,
      sufficientPct: totalPatients > 0 ? Math.round((sufficient / totalPatients) * 100) : 0,
      partial,
      partialPct: totalPatients > 0 ? Math.round((partial / totalPatients) * 100) : 0,
      insufficient,
      insufficientPct: totalPatients > 0 ? Math.round((insufficient / totalPatients) * 100) : 0,
      missingStage,
      missingStagePct: totalPatients > 0 ? Math.round((missingStage / totalPatients) * 100) : 0,
      missingBiomarkers,
      missingBiomarkersPct: totalPatients > 0 ? Math.round((missingBiomarkers / totalPatients) * 100) : 0,
      missingHistology,
      missingHistologyPct: totalPatients > 0 ? Math.round((missingHistology / totalPatients) * 100) : 0,
      missingTreatmentLine,
      missingTreatmentLinePct: totalPatients > 0 ? Math.round((missingTreatmentLine / totalPatients) * 100) : 0,
    };
  }, [uniquePatients, totalPatients, stageAnalysis]);

  const filteredUnassignedPatients = useMemo(() => {
    if (unassignedFilter === 'all') return stageAnalysis.unassignedPatientsList;
    return stageAnalysis.unassignedPatientsList.filter(item => item.reason === unassignedFilter);
  }, [stageAnalysis.unassignedPatientsList, unassignedFilter]);

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

            {onMigrateProfiles && (
              <button
                onClick={handleMigrateProfiles}
                disabled={isMigrating}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl transition-colors"
                title="Calcular estadios para todos los pacientes existentes"
              >
                {isMigrating ? (
                  <>
                    <span className="animate-spin inline-block">⟳</span>
                    Actualizando...
                  </>
                ) : (
                  <>
                    ⟳ Actualizar estadios
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
          {migrationResult && (
            <div className={`px-6 py-2 text-[10px] font-bold text-center ${migrationResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {migrationResult}
            </div>
          )}
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

          {/* SECCIÓN: CALIDAD DE DATOS CLÍNICOS */}
          <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-indigo-600" />
                  Calidad de Datos Clínicos
                </h3>
                <p className="text-[11px] text-gray-400 font-medium">
                  Nivel de completitud y exhaustividad documental en historias clínicas
                </p>
              </div>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                {totalPatients} pacientes analizados (100%)
              </span>
            </div>

            {/* 3 niveles de completitud */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-[11px] font-black uppercase tracking-tight">Datos Clínicos Suficientes</span>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-emerald-950">{dataQuality.sufficient}</span>
                  <span className="text-xs font-bold text-emerald-700">({dataQuality.sufficientPct}%)</span>
                </div>
                <span className="text-[10px] text-emerald-700/80 font-medium mt-1">
                  Estadio, localización e histología o tratamiento documentados
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-amber-800 mb-1">
                  <span className="text-[11px] font-black uppercase tracking-tight">Parcialmente Documentados</span>
                  <Info size={14} className="text-amber-600" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-amber-950">{dataQuality.partial}</span>
                  <span className="text-xs font-bold text-amber-700">({dataQuality.partialPct}%)</span>
                </div>
                <span className="text-[10px] text-amber-700/80 font-medium mt-1">
                  Datos básicos presentes, faltan variables clave
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-rose-800 mb-1">
                  <span className="text-[11px] font-black uppercase tracking-tight">Información Insuficiente</span>
                  <AlertCircle size={14} className="text-rose-600" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-rose-950">{dataQuality.insufficient}</span>
                  <span className="text-xs font-bold text-rose-700">({dataQuality.insufficientPct}%)</span>
                </div>
                <span className="text-[10px] text-rose-700/80 font-medium mt-1">
                  Ficha mínima o sin elementos estadificables
                </span>
              </div>
            </div>

            {/* Principales datos faltantes */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span>Principales datos faltantes:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Estadio</span>
                  <span className="font-bold text-gray-800">
                    {dataQuality.missingStage} <span className="text-[10px] text-gray-400 font-normal">({dataQuality.missingStagePct}%)</span>
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Biomarcadores</span>
                  <span className="font-bold text-gray-800">
                    {dataQuality.missingBiomarkers} <span className="text-[10px] text-gray-400 font-normal">({dataQuality.missingBiomarkersPct}%)</span>
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Histología</span>
                  <span className="font-bold text-gray-800">
                    {dataQuality.missingHistology} <span className="text-[10px] text-gray-400 font-normal">({dataQuality.missingHistologyPct}%)</span>
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Línea de tratam.</span>
                  <span className="font-bold text-gray-800">
                    {dataQuality.missingTreatmentLine} <span className="text-[10px] text-gray-400 font-normal">({dataQuality.missingTreatmentLinePct}%)</span>
                  </span>
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
                          itemStyle={{ color: '#f1f5f9' }}
                          labelStyle={{ color: '#ffffff', fontWeight: 600 }}
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
                  <p className="text-[11px] text-gray-400 font-medium">Distribución por estadio documentado</p>
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
                          itemStyle={{ color: '#f1f5f9' }}
                          labelStyle={{ color: '#ffffff', fontWeight: 600 }}
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
                    {stageData.map((st, idx) => {
                      const isUnassigned = st.name === 'No consignado';
                      return (
                        <div 
                          key={idx} 
                          onClick={isUnassigned ? () => { setUnassignedFilter('all'); setShowUnassignedStageModal(true); } : undefined}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isUnassigned 
                              ? 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-100/70 hover:border-amber-300 cursor-pointer shadow-xs group' 
                              : 'bg-gray-50 border-gray-100'
                          } flex flex-col justify-between`}
                          title={isUnassigned ? 'Haga clic para ver el desglose determinístico de estadios no consignados' : undefined}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">{st.name}</span>
                            {isUnassigned && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100/90 group-hover:bg-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors">
                                <Eye size={10} /> Detalle
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-gray-800">{st.count}</span>
                            <span className="text-xs font-bold text-blue-600">{st.percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
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

      {/* ── MODAL DETALLE: PACIENTES CON ESTADIO NO CONSIGNADO ────────────── */}
      {showUnassignedStageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                    Detalle de Pacientes con Estadio No Consignado
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      N = {stageAnalysis.counts['No consignado']}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Clasificación determinística según causa de no estadificación
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnassignedStageModal(false)}
                className="p-2 hover:bg-gray-200/60 rounded-xl text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de categorías */}
            <div className="p-4 bg-gray-50/80 border-b border-gray-100 shrink-0 space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setUnassignedFilter('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    unassignedFilter === 'all'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${unassignedFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {stageAnalysis.counts['No consignado']}
                  </span>
                </button>

                {(['no_mention', 'insufficient_data', 'related_but_undetermined', 'not_evaluable'] as UnassignedStageReason[]).map(catKey => {
                  const info = UNASSIGNED_REASON_LABELS[catKey];
                  const count = stageAnalysis.unassignedReasonCounts[catKey];
                  const isActive = unassignedFilter === catKey;
                  return (
                    <button
                      key={catKey}
                      onClick={() => setUnassignedFilter(catKey)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <span>{info.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Explicación de la categoría seleccionada */}
              <div className="p-2.5 rounded-xl bg-white border border-gray-200/70 text-xs text-gray-600 flex items-start gap-2">
                <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  {unassignedFilter === 'all' ? (
                    <span>
                      Mostrando el universo total de pacientes en los que la historia clínica no reporta un estadio I-IV determinístico ni metástasis inequívoca.
                    </span>
                  ) : (
                    <span>
                      <strong className="text-gray-800">{UNASSIGNED_REASON_LABELS[unassignedFilter].title}: </strong>
                      {UNASSIGNED_REASON_LABELS[unassignedFilter].desc}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Listado de Pacientes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-gray-100">
              {filteredUnassignedPatients.length > 0 ? (
                filteredUnassignedPatients.map(({ patient: p, reason }, idx) => {
                  const labelInfo = UNASSIGNED_REASON_LABELS[reason];
                  const patientIdentifier = p.name || (p.hcNumber ? `HC: ${p.hcNumber}` : `ID: ${p.id.slice(0, 8)}`);
                  const diagText = p.diagnosis || p.primaryDiagnosis || p.resumen_hc || p.historyText || p.antecedentes || 'Sin registro diagnóstico cargado';
                  const snippet = diagText.length > 200 ? `${diagText.substring(0, 200)}...` : diagText;

                  return (
                    <div key={p.id || idx} className="pt-2.5 first:pt-0">
                      <div className="p-3.5 rounded-xl bg-gray-50/70 hover:bg-gray-100/70 border border-gray-100 transition-colors space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-gray-800">{patientIdentifier}</span>
                            {p.hcNumber && p.name && (
                              <span className="text-[10px] text-gray-400 font-semibold">HC: {p.hcNumber}</span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${labelInfo.badge}`}>
                            {labelInfo.title}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-gray-100/90 leading-relaxed font-mono text-[11px]">
                          "{snippet}"
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs font-medium">
                  No hay pacientes en este criterio de clasificación
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                {filteredUnassignedPatients.length} pacientes listados
              </span>
              <button
                onClick={() => setShowUnassignedStageModal(false)}
                className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PracticeStatsModal;
