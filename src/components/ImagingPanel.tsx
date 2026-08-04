import React, { useState } from 'react';
import {
  Upload, X, Loader2, Image, ChevronDown, ChevronUp, Trash2, Edit2, Check,
  Plus, AlertCircle, RefreshCw, CheckCircle2, Info, Edit3
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { extractSingleImagingReportSecure } from '../utils/aiProxy';

// ── TIPOS ──────────────────────────────────────────────────────────────
export interface TargetLesion {
  location: string;
  measurement: number;
  lesionKey?: string;
}

export interface NonTargetLesion {
  location: string;
  status: string;
}

export interface ResponseOverride {
  status: string;
  note?: string;
}

export interface ImagingStudy {
  id: string;
  type: 'TC' | 'RMN' | 'PET-TC' | 'Ecografía';
  date: string;
  bodyRegion: string;
  treatment: string | null;
  targetLesions: TargetLesion[];
  nonTargetLesions: NonTargetLesion[];
  newLesions: boolean;
  extractedAt: number;
  isBaseline?: boolean;
  responseOverride?: ResponseOverride | null;
}

export interface ClinicalTimelineEvent {
  date: string;
  note: string;
  category?: string;
  professional?: string;
  isKey?: boolean;
}

interface FileData { name: string; type: string; data: string; }

interface ImagingPanelProps {
  studies: ImagingStudy[];
  onStudiesChange: (studies: ImagingStudy[]) => void;
  patientHistoryText?: string;
  timelineEvents?: ClinicalTimelineEvent[];
}

// ── HELPERS ────────────────────────────────────────────────────────────
export const generateLesionKey = (location: string): string => {
  if (!location) return 'lesion';
  return location
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'lesion';
};

const TYPE_COLORS: Record<string, string> = {
  'TC':        'bg-blue-50 text-blue-800 border-blue-200',
  'RMN':       'bg-purple-50 text-purple-800 border-purple-200',
  'PET-TC':    'bg-amber-50 text-amber-800 border-amber-200',
  'Ecografía': 'bg-teal-50 text-teal-800 border-teal-200',
};

const parseDate = (dateStr: string): number => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3)
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};

const sumMeasurements = (lesions: TargetLesion[]): number =>
  lesions.reduce((acc, l) => acc + (l.measurement || 0), 0);

const CLINICAL_COLORS = ['#4F7EA8', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#C2410C', '#4D7C0F'];

const IMMUNOTHERAPY_KEYWORDS = [
  'inmunoterapia', 'pembrolizumab', 'keytruda', 'nivolumab', 'opdivo',
  'atezolizumab', 'tecentriq', 'durvalumab', 'imfinzi', 'ipilimumab', 'yervoy',
  'anti-pd1', 'anti-pdl1', 'anti-ctla4', 'checkpoint', 'pd-1', 'pd-l1', 'ctla-4'
];

// ── MERGE / DEDUPLICACIÓN INTELIGENTE ──────────────────────────────────
export const mergeImagingStudies = (
  existing: ImagingStudy[],
  incoming: ImagingStudy[]
): ImagingStudy[] => {
  let result = [...existing];

  incoming.forEach(inc => {
    const incDate = parseDate(inc.date);
    const incRegion = (inc.bodyRegion || '').toLowerCase().trim();

    const matchIdx = result.findIndex(ex => {
      if (ex.type !== inc.type) return false;
      const exRegion = (ex.bodyRegion || '').toLowerCase().trim();
      const isRegionMatch = exRegion === incRegion || exRegion.includes(incRegion) || incRegion.includes(exRegion);
      if (!isRegionMatch) return false;

      const exDate = parseDate(ex.date);
      if (!exDate || !incDate) return false;
      const diffDays = Math.abs(exDate - incDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 3;
    });

    if (matchIdx !== -1) {
      // Fusionar o reemplazar manteniendo banderas
      result[matchIdx] = {
        ...inc,
        id: result[matchIdx].id || inc.id,
        isBaseline: inc.isBaseline ?? result[matchIdx].isBaseline,
        responseOverride: inc.responseOverride ?? result[matchIdx].responseOverride
      };
    } else {
      result.push(inc);
    }
  });

  // Garantizar un único baseline global si hay más de uno
  const baselineCount = result.filter(s => s.isBaseline).length;
  if (baselineCount > 1) {
    const oldestBaseline = [...result.filter(s => s.isBaseline)].sort((a, b) => parseDate(a.date) - parseDate(b.date))[0];
    result = result.map(s => ({ ...s, isBaseline: s.id === oldestBaseline.id }));
  }

  return result.sort((a, b) => parseDate(a.date) - parseDate(b.date));
};

export interface RecistResult {
  criterion: 'RECIST 1.1' | 'iRECIST';
  criterionNote?: string;
  status: string;
  badgeColor: 'green' | 'yellow' | 'red' | 'gray';
  confidence: 'Alta' | 'Media' | 'Baja';
  explanation: string;
  isOverride?: boolean;
  overrideNote?: string;
  insufficientData?: boolean;
}

// ── EVALUACIÓN RECIST 1.1 Y iRECIST MEJORADA CON NADIR Y OVERRIDE ──────
export const evaluateRecistResponse = (
  studies: ImagingStudy[],
  patientHistoryText?: string
): RecistResult => {
  if (!studies || studies.length === 0) {
    return {
      criterion: 'RECIST 1.1',
      status: 'Información insuficiente para sugerir una evaluación RECIST',
      badgeColor: 'gray',
      confidence: 'Baja',
      explanation: 'No existen estudios radiológicos registrados en la historia del paciente.',
      insufficientData: true
    };
  }

  const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const latest = sorted[sorted.length - 1];

  // Verificar si hay override manual en el último estudio
  if (latest.responseOverride && latest.responseOverride.status) {
    const rawStatus = latest.responseOverride.status.toLowerCase();
    let badgeColor: 'green' | 'yellow' | 'red' | 'gray' = 'yellow';
    if (rawStatus.includes('parcial') || rawStatus.includes('completa') || rawStatus.includes('cr') || rawStatus.includes('pr')) {
      badgeColor = 'green';
    } else if (rawStatus.includes('progresion') || rawStatus.includes('pd') || rawStatus.includes('iupd') || rawStatus.includes('icpd')) {
      badgeColor = 'red';
    }
    return {
      criterion: 'RECIST 1.1 / iRECIST',
      criterionNote: 'Override Manual Registrado',
      status: latest.responseOverride.status,
      badgeColor,
      confidence: 'Alta',
      explanation: latest.responseOverride.note || 'Criterio de respuesta ajustado manualmente por el oncólogo.',
      isOverride: true,
      overrideNote: latest.responseOverride.note
    };
  }

  const allText = [
    patientHistoryText || '',
    ...studies.map(s => `${s.treatment || ''} ${s.bodyRegion || ''}`)
  ].join(' ').toLowerCase();

  const isImmuno = IMMUNOTHERAPY_KEYWORDS.some(kw => allText.includes(kw));
  const criterion = isImmuno ? 'iRECIST' : 'RECIST 1.1';
  const criterionNote = isImmuno ? 'Inmunoterapia' : 'Criterio estándar';

  // Seleccionar Baseline
  const baseline = sorted.find(s => s.isBaseline) || sorted[0];

  const hasTargetLesions = sorted.some(s => s.targetLesions.length > 0);
  const hasNonTargetLesions = sorted.some(s => s.nonTargetLesions.length > 0);

  let confidence: 'Alta' | 'Media' | 'Baja' = 'Alta';
  if (sorted.length < 2) confidence = 'Media';
  if (!hasTargetLesions) confidence = 'Media';
  if (sorted.length === 1 && !hasTargetLesions && !hasNonTargetLesions) confidence = 'Baja';

  if (!hasTargetLesions && !hasNonTargetLesions && !latest.newLesions) {
    return {
      criterion,
      criterionNote,
      status: 'Información insuficiente para sugerir una evaluación RECIST',
      badgeColor: 'gray',
      confidence: 'Baja',
      explanation: 'Los informes radiológicos disponibles no contienen mediciones cuantitativas de lesiones ni descripción de respuesta.',
      insufficientData: true
    };
  }

  if (sorted.length === 1) {
    return {
      criterion,
      criterionNote,
      status: 'Estudio Basal Registrado',
      badgeColor: 'gray',
      confidence: 'Media',
      explanation: `Estudio inicial (${latest.date}) registrado como línea de base. Se requiere un estudio de seguimiento para clasificar la respuesta.`
    };
  }

  // Calcular Nadir entre el baseline y el último estudio
  const baselineIdx = sorted.findIndex(s => s.id === baseline.id);
  const studiesForNadir = sorted.slice(baselineIdx >= 0 ? baselineIdx : 0);

  let nadirSum = sumMeasurements(baseline.targetLesions);
  studiesForNadir.forEach(s => {
    const sSum = sumMeasurements(s.targetLesions);
    if (sSum > 0 && sSum < nadirSum) {
      nadirSum = sSum;
    }
  });

  const baselineSum = sumMeasurements(baseline.targetLesions);
  const latestSum = sumMeasurements(latest.targetLesions);
  const anyNewLesions = latest.newLesions;

  // Progresión por nuevas lesiones o por Nadir
  const isPdByNadir = nadirSum > 0 && latestSum > 0 && (latestSum - nadirSum >= 5) && ((latestSum - nadirSum) / nadirSum >= 0.20);
  const isPD = anyNewLesions || isPdByNadir;

  if (isPD) {
    if (isImmuno) {
      // iRECIST: iUPD vs iCPD
      const latestIdx = sorted.findIndex(s => s.id === latest.id);
      const prevStudy = latestIdx > 0 ? sorted[latestIdx - 1] : null;
      const prevIsPd = prevStudy && (prevStudy.newLesions || (sumMeasurements(prevStudy.targetLesions) - nadirSum >= 5));

      if (prevIsPd) {
        return {
          criterion,
          criterionNote,
          status: '🔴 iCPD (Progresión Confirmada por iRECIST)',
          badgeColor: 'red',
          confidence,
          explanation: 'Progresión tumoral confirmada en estudio iRECIST subsiguiente (iCPD).'
        };
      }
      return {
        criterion,
        criterionNote,
        status: '🔴 iUPD (Progresión No Confirmada por iRECIST)',
        badgeColor: 'red',
        confidence,
        explanation: 'Inmunoterapia: progresión no confirmada (iUPD). Requiere estudio de control en 4-8 semanas para evaluar pseudoprogresión.'
      };
    }

    return {
      criterion,
      criterionNote,
      status: '🔴 Progresión de enfermedad (PD)',
      badgeColor: 'red',
      confidence,
      explanation: isPdByNadir
        ? `Aumento del ${(((latestSum - nadirSum) / nadirSum) * 100).toFixed(0)}% en la suma de diámetros vs Nadir (${nadirSum} mm → ${latestSum} mm).`
        : 'Aparición de nuevas lesiones identificadas en el informe radiológico.'
    };
  }

  // Respuesta Parcial / Completa / Estable
  if (hasTargetLesions && baselineSum > 0) {
    const pctVsBaseline = ((latestSum - baselineSum) / baselineSum) * 100;

    if (latestSum === 0) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🟢 Respuesta Completa (iCR)' : '🟢 Respuesta Completa (CR)',
        badgeColor: 'green',
        confidence,
        explanation: 'Desaparición total de todas las lesiones diana sin nuevas lesiones.'
      };
    }

    if (pctVsBaseline <= -30) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🟢 Respuesta Parcial (iPR)' : '🟢 Respuesta Parcial (PR)',
        badgeColor: 'green',
        confidence,
        explanation: `Reducción del ${Math.abs(pctVsBaseline).toFixed(0)}% en la suma de diámetros diana respecto a la línea de base (${baselineSum} mm → ${latestSum} mm).`
      };
    }

    return {
      criterion,
      criterionNote,
      status: isImmuno ? '🟡 Enfermedad Estable (iSD)' : '🟡 Enfermedad Estable (SD)',
      badgeColor: 'yellow',
      confidence,
      explanation: `Enfermedad estable. Sin cambios significativos (${pctVsBaseline > 0 ? '+' : ''}${pctVsBaseline.toFixed(0)}% vs baseline, Nadir: ${nadirSum} mm).`
    };
  }

  // Evaluación no diana
  const nonTargetText = latest.nonTargetLesions.map(l => l.status).join(' ').toLowerCase();
  if (nonTargetText.includes('progreso') || nonTargetText.includes('progresion') || nonTargetText.includes('aumento')) {
    return {
      criterion,
      criterionNote,
      status: isImmuno ? '🔴 iUPD (Progresión No Confirmada)' : '🔴 Progresión de enfermedad (PD)',
      badgeColor: 'red',
      confidence: 'Media',
      explanation: 'Progresión inequívoca observada en el comportamiento de lesiones no diana.'
    };
  }

  return {
    criterion,
    criterionNote,
    status: isImmuno ? '🟡 Enfermedad Estable (iSD)' : '🟡 Enfermedad Estable (SD)',
    badgeColor: 'yellow',
    confidence: 'Media',
    explanation: 'Lesiones registradas estables sin signos de progresión ni metástasis nuevas.'
  };
};

// ── TARJETA SUPERIOR DE EVALUACIÓN DE RESPUESTA ───────────────────────
const ResponseEvaluationCard = ({
  studies,
  patientHistoryText,
  onOpenOverrideModal
}: {
  studies: ImagingStudy[];
  patientHistoryText?: string;
  onOpenOverrideModal: () => void;
}) => {
  if (!studies || studies.length === 0) return null;

  const evaluation = evaluateRecistResponse(studies, patientHistoryText);

  const BADGE_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    green:  { bg: 'bg-emerald-50/90', text: 'text-emerald-900', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    yellow: { bg: 'bg-amber-50/90',   text: 'text-amber-900',   border: 'border-amber-200',   dot: 'bg-amber-500' },
    red:    { bg: 'bg-rose-50/90',    text: 'text-rose-900',    border: 'border-rose-200',    dot: 'bg-rose-500' },
    gray:   { bg: 'bg-slate-50',      text: 'text-slate-800',   border: 'border-slate-200',   dot: 'bg-slate-400' }
  };

  const style = BADGE_STYLES[evaluation.badgeColor] || BADGE_STYLES.gray;

  return (
    <div className={`p-4 rounded-2xl border shadow-sm transition-all mb-5 ${style.bg} ${style.border}`}>
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-black/5 pb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`}/>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Evaluación de respuesta</h4>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-slate-600">
            {evaluation.criterion} ({evaluation.criterionNote})
          </span>
          {evaluation.isOverride && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-100 border border-purple-200 text-purple-700">
              Override Manual
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <span>Confianza:</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
              evaluation.confidence === 'Alta' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
              evaluation.confidence === 'Media' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {evaluation.confidence}
            </span>
          </div>
          <button
            onClick={onOpenOverrideModal}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-blue-600 bg-white/80 border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all"
          >
            <Edit3 size={11}/>
            <span>Override</span>
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className={`text-xs font-black tracking-tight ${style.text}`}>
          {evaluation.status}
        </div>
        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
          {evaluation.explanation}
        </p>
      </div>
    </div>
  );
};

// ── GRÁFICO CLÍNICO CON LESIONKEY Y MODALIDADES ────────────────────────
const ClinicalLesionChart = ({
  studies,
  modality,
  timelineEvents = []
}: {
  studies: ImagingStudy[];
  modality: string;
  timelineEvents?: ClinicalTimelineEvent[];
}) => {
  const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Extraer lesionKeys únicas
  const lesionKeyMap = new Map<string, string>(); // lesionKey -> location display
  sorted.forEach(s => {
    s.targetLesions.forEach(l => {
      const key = l.lesionKey || generateLesionKey(l.location);
      if (!lesionKeyMap.has(key)) {
        lesionKeyMap.set(key, l.location);
      }
    });
  });

  const lesionKeys = Array.from(lesionKeyMap.keys());
  if (sorted.length === 0) return null;

  const chartData = sorted.map(study => {
    const point: any = {
      date: study.date,
      treatment: study.treatment || '',
      type: study.type,
      bodyRegion: study.bodyRegion,
    };

    lesionKeys.forEach(key => {
      const lesion = study.targetLesions.find(l => (l.lesionKey || generateLesionKey(l.location)) === key);
      point[key] = lesion ? lesion.measurement : null;
    });

    return point;
  });

  const chartDates = new Set(sorted.map(s => s.date));

  const treatmentEvents = timelineEvents.filter(evt => {
    if (!evt.date || !evt.note) return false;
    const cat = (evt.category || '').toLowerCase();
    const note = evt.note.toLowerCase();
    return evt.isKey || cat.includes('quimio') || cat.includes('cirugía') || cat.includes('radio') || note.includes('inicio') || note.includes('cambio') || note.includes('mantenimiento');
  }).slice(0, 5);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const pointData = payload[0]?.payload;
    const treatment = pointData?.treatment;
    const region = pointData?.bodyRegion;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 text-xs min-w-[210px] font-sans">
        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
          <span className="font-black text-slate-800">{label}</span>
          <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
            {modality}
          </span>
        </div>
        {region && <p className="text-[10px] text-slate-400 font-medium mb-1.5">{region}</p>}
        {treatment && (
          <div className="bg-blue-50/90 text-blue-900 px-2 py-1 rounded-md text-[10px] font-bold mb-2 border border-blue-100">
            <span>⚕ {treatment}</span>
          </div>
        )}
        <div className="space-y-1">
          {payload.map((p: any, i: number) => {
            if (p.value === null || p.value === undefined) return null;
            const displayLocation = lesionKeyMap.get(p.dataKey) || p.name;
            return (
              <div key={i} className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}/>
                  <span className="text-slate-600 font-medium text-[11px] truncate max-w-[130px]">{displayLocation}</span>
                </div>
                <span className="font-black text-slate-900 text-[11px]">{p.value} mm</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider bg-slate-100 text-slate-700">
            Evolución Radiológica — {modality}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {sorted.length} {sorted.length === 1 ? 'estudio' : 'estudios'}
          </span>
        </div>
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          Mediciones reales (mm) & Tratamiento
        </span>
      </div>

      <div className="pt-2">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={chartData} margin={{ top: 24, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              dy={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              unit="mm"
              dx={-2}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}/>
            <Legend
              wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '10px' }}
              formatter={(value) => <span style={{ color: '#475569' }}>{lesionKeyMap.get(value) || value}</span>}
            />

            {treatmentEvents.map((evt, idx) => {
              const eventDate = chartDates.has(evt.date) ? evt.date : sorted[0]?.date;
              if (!eventDate) return null;

              return (
                <ReferenceLine
                  key={idx}
                  x={eventDate}
                  stroke="#94A3B8"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={{
                    value: `│ ${evt.note.length > 22 ? evt.note.substring(0, 22) + '…' : evt.note}`,
                    position: 'top',
                    fill: '#334155',
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                />
              );
            })}

            {lesionKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CLINICAL_COLORS[i % CLINICAL_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: CLINICAL_COLORS[i % CLINICAL_COLORS.length] }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
                name={lesionKeyMap.get(key) || key}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────
const ImagingPanel: React.FC<ImagingPanelProps> = ({
  studies,
  onStudiesChange,
  patientHistoryText,
  timelineEvents = []
}) => {
  const [reportText, setReportText] = useState('');
  const [reportFiles, setReportFiles] = useState<FileData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Estado para el modal de revisión de borrador
  const [draftStudies, setDraftStudies] = useState<ImagingStudy[] | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

  // Estado para edición completa de estudio existente
  const [editingStudy, setEditingStudy] = useState<ImagingStudy | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Estado para modal de Override Manual RECIST
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideNote, setOverrideNote] = useState('');

  const [activeType, setActiveType] = useState<'TC' | 'RMN' | 'PET-TC' | 'Ecografía'>('TC');

  const studiesByType = (['TC', 'RMN', 'PET-TC', 'Ecografía'] as const).reduce((acc, type) => {
    acc[type] = [...studies].filter(s => s.type === type);
    return acc;
  }, {} as Record<'TC' | 'RMN' | 'PET-TC' | 'Ecografía', ImagingStudy[]>);

  const typesWithStudies = (['TC', 'RMN', 'PET-TC', 'Ecografía'] as const).filter(
    type => studiesByType[type].length > 0
  );

  // Exposición de extracción usando el nuevo proxy individual
  const handleExtract = async () => {
    if (!reportText.trim() && reportFiles.length === 0) return;
    setIsExtracting(true);
    setExtractError(null);

    try {
      const extractedRaw = await extractSingleImagingReportSecure(reportText, reportFiles);
      if (extractedRaw && extractedRaw.length > 0) {
        const formattedDrafts: ImagingStudy[] = extractedRaw.map((d: any) => ({
          id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: d.type || 'TC',
          date: d.date || new Date().toLocaleDateString('es-AR'),
          bodyRegion: d.bodyRegion || 'General',
          treatment: d.treatment || null,
          targetLesions: (d.targetLesions || []).map((l: any) => ({
            location: l.location || 'Lesión',
            measurement: Number(l.measurement) || 0,
            lesionKey: l.lesionKey || generateLesionKey(l.location || 'lesion')
          })),
          nonTargetLesions: d.nonTargetLesions || [],
          newLesions: !!d.newLesions,
          extractedAt: Date.now(),
        }));

        setDraftStudies(formattedDrafts);
        setSelectedDraftIds(formattedDrafts.map(s => s.id));
      } else {
        setExtractError('No se pudieron extraer estudios. Verifique que el informe contenga un estudio radiológico claro.');
      }
    } catch (e: any) {
      setExtractError(`Error al procesar informe: ${e.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmDrafts = () => {
    if (!draftStudies) return;
    const toSave = draftStudies.filter(s => selectedDraftIds.includes(s.id));
    if (toSave.length === 0) {
      setDraftStudies(null);
      return;
    }

    const merged = mergeImagingStudies(studies, toSave);
    onStudiesChange(merged);
    setDraftStudies(null);
    setSelectedDraftIds([]);
    setReportText('');
    setReportFiles([]);
  };

  const handleDeleteStudy = (id: string) => {
    onStudiesChange(studies.filter(s => s.id !== id));
  };

  const handleSaveEditedStudy = () => {
    if (!editingStudy) return;

    let updated = studies.map(s => s.id === editingStudy.id ? editingStudy : s);
    if (editingStudy.isBaseline) {
      updated = updated.map(s => ({ ...s, isBaseline: s.id === editingStudy.id }));
    }
    onStudiesChange(updated);
    setEditingStudy(null);
  };

  const handleSaveOverride = () => {
    if (studies.length === 0) return;
    const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));
    const latestId = sorted[sorted.length - 1].id;

    const overrideObj = overrideStatus.trim() ? { status: overrideStatus.trim(), note: overrideNote.trim() } : null;
    onStudiesChange(studies.map(s => s.id === latestId ? { ...s, responseOverride: overrideObj } : s));
    setShowOverrideModal(false);
  };

  return (
    <div className="space-y-6">

      {/* ── Carga / Extracción de Informes ───────────────────────── */}
      <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-50 pb-2 flex items-center justify-between">
          <span>Procesar Nuevo Informe Radiológico (Individual)</span>
          <span className="text-[9px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold uppercase">Prompt individual</span>
        </h3>

        {extractError && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium flex items-center justify-between">
            <span>{extractError}</span>
            <button onClick={() => setExtractError(null)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            placeholder="Pegá aquí el texto del informe de TC, RMN, PET-TC o Ecografía para extraer mediciones en mm..."
            className="w-full h-24 p-3 text-xs bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-blue-300 transition-all font-sans"
          />

          <div className="flex flex-wrap gap-2">
            {reportFiles.map((f, i) => (
              <div key={i} className="flex items-center bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-blue-100">
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => setReportFiles(reportFiles.filter((_, idx) => idx !== i))} className="ml-1 text-blue-400 hover:text-blue-700">
                  <X size={12}/>
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-center justify-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-200 rounded-xl cursor-pointer text-xs font-bold text-gray-600 transition-all">
            <Upload size={14}/>
            <span>Adjuntar PDF / Imagen del Informe</span>
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={async e => {
                if (e.target.files) {
                  const newFiles: FileData[] = [];
                  for (let i = 0; i < e.target.files.length; i++) {
                    const f = e.target.files[i];
                    const reader = new FileReader();
                    await new Promise<void>(res => {
                      reader.onload = evt => {
                        if (evt.target?.result) {
                          newFiles.push({ name: f.name, type: f.type, data: (evt.target.result as string).split(',')[1] });
                        }
                        res();
                      };
                      reader.readAsDataURL(f);
                    });
                  }
                  setReportFiles([...reportFiles, ...newFiles]);
                }
              }}
            />
          </label>
        </div>

        <button
          onClick={handleExtract}
          disabled={isExtracting || (!reportText.trim() && reportFiles.length === 0)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black tracking-widest shadow-xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          {isExtracting
            ? <><Loader2 className="animate-spin" size={14}/>Extrayendo datos estructurados...</>
            : <><Image size={14}/>Procesar Informe y Revisar</>}
        </button>
      </section>

      {/* ── Visualización de Evolución & Evaluación de Respuesta ── */}
      {studies.length > 0 && (
        <section className="space-y-5">

          {/* Tarjeta Única Superior de Evaluación de Respuesta */}
          <ResponseEvaluationCard
            studies={studies}
            patientHistoryText={patientHistoryText}
            onOpenOverrideModal={() => {
              const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));
              const latest = sorted[sorted.length - 1];
              setOverrideStatus(latest.responseOverride?.status || '');
              setOverrideNote(latest.responseOverride?.note || '');
              setShowOverrideModal(true);
            }}
          />

          {/* Tabs por Modalidad */}
          {typesWithStudies.length > 1 && (
            <div className="flex gap-2">
              {typesWithStudies.map(type => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`text-[10px] font-black px-3.5 py-2 rounded-xl border uppercase tracking-widest transition-all
                    ${activeType === type ? TYPE_COLORS[type] + ' shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                >
                  {type} ({studiesByType[type].length})
                </button>
              ))}
            </div>
          )}

          {/* Visor de Curvas Clínicas Reales */}
          {typesWithStudies.map(type => {
            if (typesWithStudies.length > 1 && type !== activeType) return null;
            const group = studiesByType[type];

            return (
              <div key={type} className="space-y-4">

                <ClinicalLesionChart studies={group} modality={type} timelineEvents={timelineEvents} />

                {/* Lista de informes guardados */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">
                    Estudios Registrados — {group.length} {type}
                  </h4>
                  {group.map((study) => {
                    const sum = sumMeasurements(study.targetLesions);

                    return (
                      <div key={study.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(expandedId === study.id ? null : study.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-gray-800">{study.date}</span>
                              {study.isBaseline && (
                                <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Baseline Global</span>
                              )}
                              {study.newLesions && (
                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Nuevas lesiones</span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">{study.bodyRegion}</span>
                            <span className="text-[10px] font-semibold text-blue-600">
                              {study.treatment || <span className="text-gray-300 italic">Sin tratamiento especificado</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {study.targetLesions.length > 0 && (
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-gray-700">{sum} mm</span>
                              </div>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setEditingStudy(study); }}
                              className="text-gray-300 hover:text-blue-600 transition-colors p-1"
                              title="Editar estudio completo"
                            >
                              <Edit2 size={13}/>
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteStudy(study.id); }}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              title="Eliminar estudio"
                            >
                              <Trash2 size={13}/>
                            </button>
                            {expandedId === study.id ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                          </div>
                        </div>

                        {expandedId === study.id && (
                          <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                            {study.targetLesions.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lesiones Dianas</p>
                                <div className="space-y-1">
                                  {study.targetLesions.map((l, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-1.5 rounded-lg">
                                      <span className="text-[11px] text-gray-600 font-medium">{l.location} <span className="text-[9px] text-gray-400 font-mono">({l.lesionKey || generateLesionKey(l.location)})</span></span>
                                      <span className="text-[11px] font-black text-gray-800">{l.measurement} mm</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {study.nonTargetLesions.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lesiones No Diana</p>
                                <div className="space-y-1">
                                  {study.nonTargetLesions.map((l, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-1.5 rounded-lg">
                                      <span className="text-[11px] text-gray-600 font-medium">{l.location}</span>
                                      <span className="text-[10px] font-semibold text-gray-500 capitalize">{l.status}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {studies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <Image size={40} className="mb-3 opacity-20"/>
          <p className="text-xs font-black uppercase tracking-widest">Sin estudios radiológicos registrados.</p>
          <p className="text-[10px] font-medium mt-1 text-gray-400">Pegá el texto o adjuntá el informe PDF de TC/RMN/PET/Ecografía arriba para iniciar la revisión.</p>
        </div>
      )}

      {/* ── MODAL PASO DE REVISIÓN Y CONFIRMACIÓN ────────────────── */}
      {draftStudies && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-blue-600"/>Revisión de Estudios Extraídos ({draftStudies.length})
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Verificá y editá las lesiones antes de guardarlas en la historia clínica.</p>
              </div>
              <button onClick={() => setDraftStudies(null)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {draftStudies.map((draft, dIdx) => {
                const isSelected = selectedDraftIds.includes(draft.id);

                return (
                  <div key={draft.id} className={`p-4 rounded-2xl border transition-all space-y-3 ${isSelected ? 'bg-blue-50/40 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) setSelectedDraftIds([...selectedDraftIds, draft.id]);
                            else setSelectedDraftIds(selectedDraftIds.filter(id => id !== draft.id));
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs font-black text-slate-800">Estudio {dIdx + 1}</span>
                      </label>
                      <button
                        onClick={() => setDraftStudies(draftStudies.filter(s => s.id !== draft.id))}
                        className="text-red-400 hover:text-red-600 text-xs font-bold"
                      >
                        Descartar este estudio
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase">Fecha</label>
                        <input
                          type="text"
                          value={draft.date}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, date: e.target.value } : s))}
                          className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase">Tipo</label>
                        <select
                          value={draft.type}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, type: e.target.value as any } : s))}
                          className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white font-bold"
                        >
                          <option value="TC">TC</option>
                          <option value="RMN">RMN</option>
                          <option value="PET-TC">PET-TC</option>
                          <option value="Ecografía">Ecografía</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase">Región</label>
                        <input
                          type="text"
                          value={draft.bodyRegion}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, bodyRegion: e.target.value } : s))}
                          className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase">Tratamiento</label>
                        <input
                          type="text"
                          value={draft.treatment || ''}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, treatment: e.target.value || null } : s))}
                          className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    {/* Lesiones Dianas Draft */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Lesiones Dianas ({draft.targetLesions.length})</span>
                        <button
                          onClick={() => {
                            const newLesion: TargetLesion = { location: 'Nueva Lesión', measurement: 10, lesionKey: 'nueva_lesion' };
                            setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: [...s.targetLesions, newLesion] } : s));
                          }}
                          className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                        >
                          <Plus size={11}/>Agregar Lesión
                        </button>
                      </div>
                      {draft.targetLesions.map((l, lIdx) => (
                        <div key={lIdx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-gray-200">
                          <input
                            type="text"
                            value={l.location}
                            placeholder="Ubicación"
                            onChange={e => {
                              const updatedLesions = [...draft.targetLesions];
                              updatedLesions[lIdx].location = e.target.value;
                              updatedLesions[lIdx].lesionKey = generateLesionKey(e.target.value);
                              setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: updatedLesions } : s));
                            }}
                            className="col-span-6 text-xs p-1.5 border border-gray-100 rounded-md font-medium"
                          />
                          <div className="col-span-4 flex items-center gap-1">
                            <input
                              type="number"
                              value={l.measurement}
                              onChange={e => {
                                const updatedLesions = [...draft.targetLesions];
                                updatedLesions[lIdx].measurement = Number(e.target.value);
                                setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: updatedLesions } : s));
                              }}
                              className="w-full text-xs p-1.5 border border-gray-100 rounded-md font-bold text-slate-800"
                            />
                            <span className="text-[10px] text-gray-400 font-bold">mm</span>
                          </div>
                          <button
                            onClick={() => {
                              const updatedLesions = draft.targetLesions.filter((_, idx) => idx !== lIdx);
                              setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: updatedLesions } : s));
                            }}
                            className="col-span-2 text-red-400 hover:text-red-600 flex justify-center"
                          >
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
              <button
                onClick={() => setDraftStudies(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDrafts}
                disabled={selectedDraftIds.length === 0}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wider hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
              >
                Confirmar y Agregar ({selectedDraftIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDICIÓN COMPLETA DE ESTUDIO GUARDADO ───────────── */}
      {editingStudy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600"/>Editar Estudio Radiológico
              </h3>
              <button onClick={() => setEditingStudy(null)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Fecha</label>
                  <input
                    type="text"
                    value={editingStudy.date}
                    onChange={e => setEditingStudy({ ...editingStudy, date: e.target.value })}
                    className="w-full text-xs p-2 border border-gray-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Modalidad</label>
                  <select
                    value={editingStudy.type}
                    onChange={e => setEditingStudy({ ...editingStudy, type: e.target.value as any })}
                    className="w-full text-xs p-2 border border-gray-200 rounded-xl font-bold bg-white"
                  >
                    <option value="TC">TC</option>
                    <option value="RMN">RMN</option>
                    <option value="PET-TC">PET-TC</option>
                    <option value="Ecografía">Ecografía</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Región</label>
                  <input
                    type="text"
                    value={editingStudy.bodyRegion}
                    onChange={e => setEditingStudy({ ...editingStudy, bodyRegion: e.target.value })}
                    className="w-full text-xs p-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Tratamiento</label>
                  <input
                    type="text"
                    value={editingStudy.treatment || ''}
                    onChange={e => setEditingStudy({ ...editingStudy, treatment: e.target.value || null })}
                    className="w-full text-xs p-2 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingStudy.isBaseline}
                    onChange={e => setEditingStudy({ ...editingStudy, isBaseline: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">Marcar como Baseline Global del Paciente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStudy.newLesions}
                    onChange={e => setEditingStudy({ ...editingStudy, newLesions: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-xs font-bold text-red-700">Nuevas lesiones</span>
                </label>
              </div>

              {/* Lesiones Dianas CRUD */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-600 uppercase">Lesiones Dianas ({editingStudy.targetLesions.length})</span>
                  <button
                    onClick={() => {
                      const newL: TargetLesion = { location: 'Nueva lesión', measurement: 10, lesionKey: 'nueva_lesion' };
                      setEditingStudy({ ...editingStudy, targetLesions: [...editingStudy.targetLesions, newL] });
                    }}
                    className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus size={11}/>Agregar Lesión
                  </button>
                </div>
                {editingStudy.targetLesions.map((l, lIdx) => (
                  <div key={lIdx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <input
                      type="text"
                      value={l.location}
                      onChange={e => {
                        const updated = [...editingStudy.targetLesions];
                        updated[lIdx].location = e.target.value;
                        updated[lIdx].lesionKey = generateLesionKey(e.target.value);
                        setEditingStudy({ ...editingStudy, targetLesions: updated });
                      }}
                      className="col-span-6 text-xs p-1.5 border border-gray-200 rounded-md bg-white font-medium"
                    />
                    <div className="col-span-4 flex items-center gap-1">
                      <input
                        type="number"
                        value={l.measurement}
                        onChange={e => {
                          const updated = [...editingStudy.targetLesions];
                          updated[lIdx].measurement = Number(e.target.value);
                          setEditingStudy({ ...editingStudy, targetLesions: updated });
                        }}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-md bg-white font-bold"
                      />
                      <span className="text-[10px] text-gray-400 font-bold">mm</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = editingStudy.targetLesions.filter((_, idx) => idx !== lIdx);
                        setEditingStudy({ ...editingStudy, targetLesions: updated });
                      }}
                      className="col-span-2 text-red-400 hover:text-red-600 flex justify-center"
                    >
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
              <button onClick={() => setEditingStudy(null)} className="px-4 py-2 text-xs font-bold text-gray-500">
                Cancelar
              </button>
              <button
                onClick={handleSaveEditedStudy}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wider hover:bg-blue-700 shadow-lg shadow-blue-100"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL OVERRIDE MANUAL DE RESPUESTA ─────────────────────── */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Edit3 size={14} className="text-blue-600"/>Override Manual RECIST
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Estado de Respuesta Manual</label>
                <select
                  value={overrideStatus}
                  onChange={e => setOverrideStatus(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl font-bold bg-white mt-1"
                >
                  <option value="">-- Sin Override (Usar Cálculo Automático) --</option>
                  <option value="🟢 Respuesta Completa (CR)">🟢 Respuesta Completa (CR)</option>
                  <option value="🟢 Respuesta Parcial (PR)">🟢 Respuesta Parcial (PR)</option>
                  <option value="🟡 Enfermedad Estable (SD)">🟡 Enfermedad Estable (SD)</option>
                  <option value="🔴 Progresión de enfermedad (PD)">🔴 Progresión de enfermedad (PD)</option>
                  <option value="🔴 iUPD (Progresión No Confirmada)">🔴 iUPD (Progresión No Confirmada)</option>
                  <option value="🔴 iCPD (Progresión Confirmada)">🔴 iCPD (Progresión Confirmada)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Nota Explicativa (Opcional)</label>
                <textarea
                  value={overrideNote}
                  onChange={e => setOverrideNote(e.target.value)}
                  placeholder="Justificación clínica del override manual (ej: Discordancia metabólica en PET-TC)..."
                  className="w-full h-20 text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-300 mt-1 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button onClick={() => setShowOverrideModal(false)} className="px-3 py-2 text-xs font-bold text-gray-500">
                Cancelar
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wider hover:bg-blue-700"
              >
                Aplicar Override
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ImagingPanel;
