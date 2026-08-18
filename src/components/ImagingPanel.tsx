import React, { useState, useMemo } from 'react';
import {
  Upload, X, Loader2, Image, Trash2, Edit2, Plus,
  Activity, BarChart3, ChevronRight, FileText, Sparkles, CheckCircle2, Edit3, ShieldAlert
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
  suvMax?: number | string;
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
  type: 'TC' | 'RMN' | 'PET-TC' | 'Ecografía' | string;
  date: string;
  bodyRegion: string;
  treatment: string | null;
  relevantFindings?: string;
  suvMax?: number | string;
  targetLesions: TargetLesion[];
  nonTargetLesions: NonTargetLesion[];
  newLesions: boolean;
  extractedAt: number;
  isBaseline?: boolean;
  responseOverride?: ResponseOverride | null;
  rawReport?: string;
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

const TYPE_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  'TC': { badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'TC' },
  'PET-TC': { badge: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500', label: 'PET-TC' },
  'RMN': { badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'RMN' },
  'Ecografía': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Ecografía' },
};

const parseDate = (dateStr: string): number => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3)
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};

const sumMeasurements = (lesions: TargetLesion[]): number =>
  lesions.reduce((acc, l) => acc + (Number(l.measurement) || 0), 0);

const CHART_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#C2410C', '#4D7C0F'];

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
      result[matchIdx] = {
        ...inc,
        id: result[matchIdx].id || inc.id,
        isBaseline: inc.isBaseline ?? result[matchIdx].isBaseline,
        responseOverride: inc.responseOverride ?? result[matchIdx].responseOverride,
        relevantFindings: inc.relevantFindings || result[matchIdx].relevantFindings,
        rawReport: inc.rawReport || result[matchIdx].rawReport
      };
    } else {
      result.push(inc);
    }
  });

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
  baselineSum: number;
  nadirSum: number;
  latestSum: number;
  pctVsBaseline: number;
  pctVsNadir: number;
  isOverride?: boolean;
  overrideNote?: string;
  insufficientData?: boolean;
}

// ── EVALUACIÓN RECIST 1.1 Y iRECIST ─────────────────────────────────────
export const evaluateRecistResponse = (
  studies: ImagingStudy[],
  patientHistoryText?: string
): RecistResult => {
  if (!studies || studies.length === 0) {
    return {
      criterion: 'RECIST 1.1',
      status: 'Información insuficiente para evaluar RECIST',
      badgeColor: 'gray',
      confidence: 'Baja',
      explanation: 'No existen estudios radiológicos registrados.',
      baselineSum: 0,
      nadirSum: 0,
      latestSum: 0,
      pctVsBaseline: 0,
      pctVsNadir: 0,
      insufficientData: true
    };
  }

  const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const latest = sorted[sorted.length - 1];

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
      criterionNote: 'Override Manual',
      status: latest.responseOverride.status,
      badgeColor,
      confidence: 'Alta',
      explanation: latest.responseOverride.note || 'Criterio de respuesta ajustado manualmente por el oncólogo.',
      baselineSum: 0,
      nadirSum: 0,
      latestSum: sumMeasurements(latest.targetLesions),
      pctVsBaseline: 0,
      pctVsNadir: 0,
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
  const criterionNote = isImmuno ? 'Inmunoterapia detectada' : 'Criterio estándar';

  const baseline = sorted.find(s => s.isBaseline) || sorted[0];
  const hasTargetLesions = sorted.some(s => s.targetLesions.length > 0);
  const hasNonTargetLesions = sorted.some(s => s.nonTargetLesions.length > 0);

  let confidence: 'Alta' | 'Media' | 'Baja' = 'Alta';
  if (sorted.length < 2) confidence = 'Media';
  if (!hasTargetLesions) confidence = 'Media';

  const baselineSum = sumMeasurements(baseline.targetLesions);
  const latestSum = sumMeasurements(latest.targetLesions);

  // Calcular Nadir
  const baselineIdx = sorted.findIndex(s => s.id === baseline.id);
  const studiesForNadir = sorted.slice(baselineIdx >= 0 ? baselineIdx : 0);

  let nadirSum = baselineSum;
  studiesForNadir.forEach(s => {
    const sSum = sumMeasurements(s.targetLesions);
    if (sSum > 0 && sSum < nadirSum) {
      nadirSum = sSum;
    }
  });

  const pctVsBaseline = baselineSum > 0 ? ((latestSum - baselineSum) / baselineSum) * 100 : 0;
  const pctVsNadir = nadirSum > 0 ? ((latestSum - nadirSum) / nadirSum) * 100 : 0;

  if (!hasTargetLesions && !hasNonTargetLesions && !latest.newLesions) {
    return {
      criterion,
      criterionNote,
      status: 'Información insuficiente para cuantificar RECIST',
      badgeColor: 'gray',
      confidence: 'Baja',
      explanation: 'Los estudios disponibles no contienen mediciones numéricas de lesiones diana.',
      baselineSum,
      nadirSum,
      latestSum,
      pctVsBaseline: 0,
      pctVsNadir: 0,
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
      explanation: `Estudio inicial (${latest.date}) registrado como línea de base. Se requiere un estudio evolutivo para determinar la respuesta.`,
      baselineSum,
      nadirSum,
      latestSum,
      pctVsBaseline: 0,
      pctVsNadir: 0
    };
  }

  const isPdByNadir = nadirSum > 0 && latestSum > 0 && (latestSum - nadirSum >= 5) && (pctVsNadir >= 20);
  const isPD = latest.newLesions || isPdByNadir;

  if (isPD) {
    if (isImmuno) {
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
          explanation: 'Progresión tumoral confirmada en estudio iRECIST subsiguiente (iCPD).',
          baselineSum, nadirSum, latestSum, pctVsBaseline, pctVsNadir
        };
      }
      return {
        criterion,
        criterionNote,
        status: '🔴 iUPD (Progresión No Confirmada por iRECIST)',
        badgeColor: 'red',
        confidence,
        explanation: 'Progresión no confirmada (iUPD). En inmunoterapia se requiere control en 4-8 semanas para descartar pseudoprogresión.',
        baselineSum, nadirSum, latestSum, pctVsBaseline, pctVsNadir
      };
    }

    return {
      criterion,
      criterionNote,
      status: '🔴 Progresión de enfermedad (PD)',
      badgeColor: 'red',
      confidence,
      explanation: isPdByNadir
        ? `Aumento del ${pctVsNadir.toFixed(0)}% (+${latestSum - nadirSum} mm) respecto al Nadir (${nadirSum} mm → ${latestSum} mm).`
        : 'Aparición de nuevas lesiones identificadas en el estudio.',
      baselineSum, nadirSum, latestSum, pctVsBaseline, pctVsNadir
    };
  }

  if (hasTargetLesions && baselineSum > 0) {
    if (latestSum === 0) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🟢 Respuesta Completa (iCR)' : '🟢 Respuesta Completa (CR)',
        badgeColor: 'green',
        confidence,
        explanation: 'Desaparición total de todas las lesiones diana sin evidencia de nuevas lesiones.',
        baselineSum, nadirSum, latestSum, pctVsBaseline: -100, pctVsNadir: -100
      };
    }

    if (pctVsBaseline <= -30) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🟢 Respuesta Parcial (iPR)' : '🟢 Respuesta Parcial (PR)',
        badgeColor: 'green',
        confidence,
        explanation: `Reducción del ${Math.abs(pctVsBaseline).toFixed(0)}% en la suma de diámetros diana respecto al baseline (${baselineSum} mm → ${latestSum} mm).`,
        baselineSum, nadirSum, latestSum, pctVsBaseline, pctVsNadir
      };
    }

    return {
      criterion,
      criterionNote,
      status: isImmuno ? '🟡 Enfermedad Estable (iSD)' : '🟡 Enfermedad Estable (SD)',
      badgeColor: 'yellow',
      confidence,
      explanation: `Sin cambios significativos (${pctVsBaseline > 0 ? '+' : ''}${pctVsBaseline.toFixed(0)}% vs baseline; Nadir: ${nadirSum} mm).`,
      baselineSum, nadirSum, latestSum, pctVsBaseline, pctVsNadir
    };
  }

  return {
    criterion,
    criterionNote,
    status: isImmuno ? '🟡 Enfermedad Estable (iSD)' : '🟡 Enfermedad Estable (SD)',
    badgeColor: 'yellow',
    confidence: 'Media',
    explanation: 'Lesiones registradas estables sin progresión franca.',
    baselineSum, nadirSum, latestSum, pctVsBaseline: 0, pctVsNadir: 0
  };
};

// ── GRÁFICO CLÍNICO CENTRAL (CURVA TEMPORAL) ───────────────────────────
const ClinicalTimelineChart = ({
  studies,
  modality,
  timelineEvents = []
}: {
  studies: ImagingStudy[];
  modality: string;
  timelineEvents?: ClinicalTimelineEvent[];
}) => {
  const sorted = useMemo(() => [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date)), [studies]);

  const lesionKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    sorted.forEach(s => {
      s.targetLesions.forEach(l => {
        const key = l.lesionKey || generateLesionKey(l.location);
        if (!map.has(key)) map.set(key, l.location);
      });
    });
    return map;
  }, [sorted]);

  const lesionKeys = useMemo(() => Array.from(lesionKeyMap.keys()), [lesionKeyMap]);

  if (sorted.length === 0) return null;

  const chartData = sorted.map(study => {
    const sum = sumMeasurements(study.targetLesions);
    const point: any = {
      date: study.date,
      treatment: study.treatment || '',
      type: study.type,
      bodyRegion: study.bodyRegion,
      sumDiameters: sum > 0 ? sum : null,
      suvMax: study.suvMax ? Number(study.suvMax) : null
    };

    lesionKeys.forEach(key => {
      const lesion = study.targetLesions.find(l => (l.lesionKey || generateLesionKey(l.location)) === key);
      point[key] = lesion ? lesion.measurement : null;
    });

    return point;
  });

  const chartDates = new Set(sorted.map(s => s.date));

  // Solo incluir eventos de tratamiento cuyas fechas coincidan exactamente con un estudio del gráfico
  const relevantTreatments = timelineEvents.filter(evt => {
    if (!evt.date || !evt.note || !chartDates.has(evt.date)) return false;
    const cat = (evt.category || '').toLowerCase();
    const note = evt.note.toLowerCase();
    return evt.isKey || cat.includes('quimio') || cat.includes('cirugía') || cat.includes('radio') || note.includes('inicio') || note.includes('cambio');
  }).slice(0, 3);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const pointData = payload[0]?.payload;
    const treatment = pointData?.treatment;
    const region = pointData?.bodyRegion;

    return (
      <div className="bg-slate-900 text-white rounded-xl shadow-xl p-3 text-xs min-w-[210px] border border-slate-800 pointer-events-none z-50">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
          <span className="font-black text-slate-100">{label}</span>
          <span className="text-[9px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
            {modality}
          </span>
        </div>
        {region && <p className="text-[10px] text-slate-400 mb-1">{region}</p>}
        {treatment && (
          <div className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded text-[10px] font-medium mb-2">
            Tratamiento: {treatment}
          </div>
        )}
        <div className="space-y-1">
          {payload.map((p: any, i: number) => {
            if (p.value === null || p.value === undefined) return null;
            const displayName = lesionKeyMap.get(p.dataKey) || p.name;
            const unit = p.dataKey === 'suvMax' ? 'SUVmáx' : 'mm';
            return (
              <div key={i} className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-slate-300 text-[11px] truncate">{displayName}</span>
                </div>
                <span className="font-bold text-white text-[11px] shrink-0">{p.value} {unit}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasLesionCurves = lesionKeys.length > 0;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-blue-600" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
            Curva Temporal — {modality}
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
            {sorted.length} {sorted.length === 1 ? 'estudio' : 'estudios'}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold">
          Evolución milimétrica de lesiones
        </span>
      </div>

      <div className="pt-1">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              dy={5}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              unit="mm"
              dx={-2}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />

            {relevantTreatments.map((evt, idx) => (
              <ReferenceLine
                key={idx}
                x={evt.date}
                stroke="#cbd5e1"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: evt.note.length > 18 ? evt.note.substring(0, 18) + '…' : evt.note,
                  position: 'insideTop',
                  fill: '#64748b',
                  fontSize: 9,
                  fontWeight: 700,
                }}
              />
            ))}

            {hasLesionCurves ? (
              lesionKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                  name={lesionKeyMap.get(key) || key}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="sumDiameters"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#2563EB' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Suma de Diámetros"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda limpia, espaciada y perfectamente legible para cada lesión */}
      {hasLesionCurves && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {lesionKeys.map((key, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            const name = lesionKeyMap.get(key) || key;
            const latestStudy = sorted.slice().reverse().find(s =>
              s.targetLesions.some(l => (l.lesionKey || generateLesionKey(l.location)) === key)
            );
            const latestLesion = latestStudy?.targetLesions.find(l =>
              (l.lesionKey || generateLesionKey(l.location)) === key
            );

            return (
              <div
                key={key}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-xs font-semibold text-slate-700"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate max-w-[200px]">{name}</span>
                {latestLesion?.measurement !== undefined && (
                  <span className="text-[10px] font-black text-slate-500 font-mono">
                    {latestLesion.measurement} mm
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  // Modal de Evaluación RECIST
  const [showRecistModal, setShowRecistModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideNote, setOverrideNote] = useState('');

  // Modal de Carga de Informe
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportFiles, setReportFiles] = useState<FileData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Modal de revisión de borrador extraído
  const [draftStudies, setDraftStudies] = useState<ImagingStudy[] | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

  // Modal de Edición de Estudio
  const [editingStudy, setEditingStudy] = useState<ImagingStudy | null>(null);
  const [viewingRawReport, setViewingRawReport] = useState<ImagingStudy | null>(null);

  // Agrupación por modalidad
  const studiesByType = useMemo(() => {
    return (['TC', 'PET-TC', 'RMN', 'Ecografía'] as const).reduce((acc, type) => {
      acc[type] = [...studies].filter(s => s.type === type);
      return acc;
    }, {} as Record<'TC' | 'PET-TC' | 'RMN' | 'Ecografía', ImagingStudy[]>);
  }, [studies]);

  const availableTypes = useMemo(() => {
    return (['TC', 'PET-TC', 'RMN', 'Ecografía'] as const).filter(
      type => studiesByType[type].length > 0
    );
  }, [studiesByType]);

  const [selectedModality, setSelectedModality] = useState<'TC' | 'PET-TC' | 'RMN' | 'Ecografía'>('TC');

  // Ajustar modalidad activa automáticamente si la actual no tiene estudios
  const activeModality = useMemo(() => {
    if (availableTypes.length === 0) return 'TC';
    if (availableTypes.includes(selectedModality)) return selectedModality;
    return availableTypes[0];
  }, [availableTypes, selectedModality]);

  // Detección de Inmunoterapia para etiqueta RECIST
  const allContextText = useMemo(() => {
    return [
      patientHistoryText || '',
      ...studies.map(s => `${s.treatment || ''} ${s.bodyRegion || ''}`)
    ].join(' ').toLowerCase();
  }, [patientHistoryText, studies]);

  const isImmuno = useMemo(() => {
    return IMMUNOTHERAPY_KEYWORDS.some(kw => allContextText.includes(kw));
  }, [allContextText]);

  // Extracción individual
  const handleExtract = async () => {
    if (!reportText.trim() && reportFiles.length === 0) return;
    setIsExtracting(true);
    setExtractError(null);

    try {
      const extractedRaw = await extractSingleImagingReportSecure(reportText, reportFiles);
      if (extractedRaw && extractedRaw.length > 0) {
        const formattedDrafts: ImagingStudy[] = extractedRaw.map((d: any) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: d.type || 'TC',
          date: d.date || new Date().toLocaleDateString('es-AR'),
          bodyRegion: d.bodyRegion || 'General',
          treatment: d.treatment || null,
          relevantFindings: d.relevantFindings || undefined,
          suvMax: d.suvMax !== undefined ? d.suvMax : undefined,
          targetLesions: (d.targetLesions || []).map((l: any) => ({
            location: l.location || 'Lesión',
            measurement: Number(l.measurement) || 0,
            lesionKey: l.lesionKey || generateLesionKey(l.location || 'lesion'),
            suvMax: l.suvMax
          })),
          nonTargetLesions: d.nonTargetLesions || [],
          newLesions: !!d.newLesions,
          extractedAt: Date.now(),
          rawReport: reportText.trim() || undefined
        }));

        setDraftStudies(formattedDrafts);
        setSelectedDraftIds(formattedDrafts.map(s => s.id));
        setShowUploadModal(false);
      } else {
        setExtractError('No se identificaron hallazgos oncológicos claros en el material provisto.');
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
    if (window.confirm('¿Eliminar este registro de imagen?')) {
      onStudiesChange(studies.filter(s => s.id !== id));
    }
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

  // Estudios ordenados cronológicamente
  const sortedStudies = useMemo(() => {
    return [...studies].sort((a, b) => parseDate(b.date) - parseDate(a.date));
  }, [studies]);

  const recistEval = useMemo(() => {
    return evaluateRecistResponse(studies, patientHistoryText);
  }, [studies, patientHistoryText]);

  return (
    <div className="space-y-5">

      {/* ── BARRA SUPERIOR DE ACCIONES (Limpia & Minimalista) ─────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Dashboard Radiológico
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {studies.length === 0
                ? 'Sin estudios cargados'
                : `${studies.length} estudios con hallazgos oncológicos relevantes`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón RECIST Bajo Demanda */}
          {studies.length > 0 && (
            <button
              onClick={() => setShowRecistModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Evaluar criterios RECIST / iRECIST"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span>Evaluar {isImmuno ? 'iRECIST' : 'RECIST'}</span>
            </button>
          )}

          {/* Botón Cargar Informe */}
          <button
            onClick={() => { setShowUploadModal(true); setExtractError(null); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-blue-100 cursor-pointer"
          >
            <Plus size={13} />
            <span>Cargar Estudio</span>
          </button>
        </div>
      </div>

      {/* ── 1. ELEMENTO PRINCIPAL: CURVA TEMPORAL (GRÁFICO) ───────── */}
      {studies.length > 0 ? (
        <div className="space-y-3">
          {/* Selector de Modalidad */}
          {availableTypes.length > 1 && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-fit">
              {availableTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedModality(type)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                    activeModality === type
                      ? 'bg-white text-slate-800 shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {type} ({studiesByType[type].length})
                </button>
              ))}
            </div>
          )}

          {/* Gráfico central separado por modalidad */}
          <ClinicalTimelineChart
            studies={studiesByType[activeModality] || []}
            modality={activeModality}
            timelineEvents={timelineEvents}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
          <Image size={36} className="mb-2 opacity-30 text-slate-400" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sin evolución radiológica disponible</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Cargá informes para visualizar la curva temporal de respuesta y lesiones.</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-3 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus size={12} /> Cargar primer estudio
          </button>
        </div>
      )}

      {/* ── 2. RESUMEN BREVE DE ESTUDIOS RELEVANTES ─────────────────── */}
      {studies.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Resumen de Estudios Relevantes
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">
              Solo hallazgos oncológicamente positivos
            </span>
          </div>

          <div className="space-y-2">
            {sortedStudies.map(study => {
              const typeStyle = TYPE_STYLES[study.type] || TYPE_STYLES['TC'];
              const sum = sumMeasurements(study.targetLesions);

              // Construir lista de hallazgos oncológicos positivos individuales
              const findingsList: string[] = [];

              if (study.targetLesions && study.targetLesions.length > 0) {
                study.targetLesions.forEach(l => {
                  let text = `${l.location}: ${l.measurement} mm`;
                  if (l.suvMax) {
                    text += ` (SUVmáx ${l.suvMax})`;
                  }
                  findingsList.push(text);
                });
              }

              if (study.nonTargetLesions && study.nonTargetLesions.length > 0) {
                study.nonTargetLesions.forEach(l => {
                  findingsList.push(`${l.location} (${l.status})`);
                });
              }

              if (study.newLesions) {
                findingsList.push('Aparición de nuevas lesiones');
              }

              if (study.suvMax && (!study.targetLesions || study.targetLesions.length === 0)) {
                findingsList.push(`Captación hipermetabólica: SUVmáx ${study.suvMax}`);
              }

              // Si no hay lesiones estructuradas desglosadas, usar relevantFindings fragmentado por líneas o viñetas
              if (findingsList.length === 0 && study.relevantFindings) {
                const parts = study.relevantFindings
                  .split(/\r?\n|•|;/)
                  .map(p => p.trim())
                  .filter(p => p.length > 0);
                if (parts.length > 0) {
                  findingsList.push(...parts);
                } else {
                  findingsList.push(study.relevantFindings);
                }
              }

              if (findingsList.length === 0) {
                findingsList.push('Estudio con hallazgos oncológicos documentados');
              }

              return (
                <div
                  key={study.id}
                  className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Fecha — Modalidad Región */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-800">{study.date}</span>
                      <span className="text-slate-300">—</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${typeStyle.badge}`}>
                        {study.type} {study.bodyRegion}
                      </span>
                      {study.isBaseline && (
                        <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          Baseline
                        </span>
                      )}
                      {study.newLesions && (
                        <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Nuevas lesiones
                        </span>
                      )}
                    </div>

                    {/* Lista enumerada vertical de hallazgos oncológicos positivos */}
                    <ul className="space-y-1 pt-0.5">
                      {findingsList.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-semibold leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Tratamiento concomitante si existe */}
                    {study.treatment && (
                      <p className="text-[10px] font-medium text-slate-500 pt-0.5">
                        <span className="text-slate-400">Tratamiento:</span> {study.treatment}
                      </p>
                    )}
                  </div>

                  {/* Acciones y Medición Global */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {sum > 0 && (
                      <span className="text-xs font-black text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        {sum} mm
                      </span>
                    )}

                    {study.rawReport && (
                      <button
                        onClick={() => setViewingRawReport(study)}
                        className="text-slate-400 hover:text-blue-600 p-1 transition-colors cursor-pointer"
                        title="Ver informe original"
                      >
                        <FileText size={13} />
                      </button>
                    )}

                    <button
                      onClick={() => setEditingStudy(study)}
                      className="text-slate-400 hover:text-blue-600 p-1 transition-colors cursor-pointer"
                      title="Editar estudio"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      onClick={() => handleDeleteStudy(study.id)}
                      className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                      title="Eliminar estudio"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: EVALUAR RECIST (Bajo Demanda) ───────────────────── */}
      {showRecistModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Evaluación {recistEval.criterion}
                </h3>
              </div>
              <button
                onClick={() => setShowRecistModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Resultado Principal */}
            <div className={`p-4 rounded-2xl border ${
              recistEval.badgeColor === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
              recistEval.badgeColor === 'yellow' ? 'bg-amber-50 border-amber-200 text-amber-900' :
              recistEval.badgeColor === 'red' ? 'bg-rose-50 border-rose-200 text-rose-900' :
              'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                  Respuesta Radiológica Estimada
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/80 border border-current">
                  Confianza {recistEval.confidence}
                </span>
              </div>
              <p className="text-sm font-black mt-1">{recistEval.status}</p>
              <p className="text-xs mt-1.5 opacity-90 leading-relaxed">{recistEval.explanation}</p>
            </div>

            {/* Métricas cuantitativas */}
            {!recistEval.insufficientData && (
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Baseline</span>
                  <p className="text-xs font-black text-slate-800">{recistEval.baselineSum} mm</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Nadir</span>
                  <p className="text-xs font-black text-slate-800">{recistEval.nadirSum} mm</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Actual</span>
                  <p className="text-xs font-black text-slate-800">{recistEval.latestSum} mm</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowRecistModal(false);
                  const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));
                  const latest = sorted[sorted.length - 1];
                  setOverrideStatus(latest?.responseOverride?.status || '');
                  setOverrideNote(latest?.responseOverride?.note || '');
                  setShowOverrideModal(true);
                }}
                className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 size={12} /> Ajuste manual (Override)
              </button>

              <button
                onClick={() => setShowRecistModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CARGAR / PROCESAR INFORME ────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Upload size={14} className="text-blue-600" />
                Cargar Informe Radiológico
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {extractError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium">
                {extractError}
              </div>
            )}

            <div className="space-y-3">
              <textarea
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                placeholder="Pegá aquí el texto del informe de TC, RMN o PET-TC para extraer mediciones y hallazgos relevantes..."
                className="w-full h-32 p-3 text-xs bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-sans"
              />

              {reportFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reportFiles.map((f, i) => (
                    <div key={i} className="flex items-center bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-blue-100">
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <button onClick={() => setReportFiles(reportFiles.filter((_, idx) => idx !== i))} className="ml-1 text-blue-400 hover:text-blue-700 cursor-pointer">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 rounded-xl cursor-pointer text-xs font-bold text-slate-600 transition-all">
                <Upload size={14} />
                <span>Adjuntar archivo (PDF / Imagen)</span>
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtract}
                disabled={isExtracting || (!reportText.trim() && reportFiles.length === 0)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wide hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="animate-spin" size={13} />
                    <span>Extrayendo hallazgos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Procesar y Extraer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REVISIÓN DE BORRADORES EXTRAÍDOS ─────────────────── */}
      {draftStudies && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-blue-600" />
                  Estudios Extraídos ({draftStudies.length})
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Revisá los datos antes de incorporarlos a la evolución.</p>
              </div>
              <button onClick={() => setDraftStudies(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {draftStudies.map((draft, dIdx) => {
                const isSelected = selectedDraftIds.includes(draft.id);

                return (
                  <div key={draft.id} className={`p-4 rounded-2xl border transition-all space-y-3 ${isSelected ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
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
                        className="text-red-400 hover:text-red-600 text-xs font-bold cursor-pointer"
                      >
                        Descartar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Fecha</label>
                        <input
                          type="text"
                          value={draft.date}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, date: e.target.value } : s))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Modalidad</label>
                        <select
                          value={draft.type}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, type: e.target.value as any } : s))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-bold"
                        >
                          <option value="TC">TC</option>
                          <option value="PET-TC">PET-TC</option>
                          <option value="RMN">RMN</option>
                          <option value="Ecografía">Ecografía</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Región</label>
                        <input
                          type="text"
                          value={draft.bodyRegion}
                          onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, bodyRegion: e.target.value } : s))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Hallazgo Oncológico Relevante</label>
                      <input
                        type="text"
                        value={draft.relevantFindings || ''}
                        placeholder="ej. Lesión hepática segmentaria: 32 mm"
                        onChange={e => setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, relevantFindings: e.target.value } : s))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-medium"
                      />
                    </div>

                    {/* Lesiones dianas */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Lesiones Dianas ({draft.targetLesions.length})</span>
                        <button
                          onClick={() => {
                            const newL: TargetLesion = { location: 'Nueva Lesión', measurement: 10, lesionKey: 'nueva_lesion' };
                            setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: [...s.targetLesions, newL] } : s));
                          }}
                          className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          + Agregar
                        </button>
                      </div>
                      {draft.targetLesions.map((l, lIdx) => (
                        <div key={lIdx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                          <input
                            type="text"
                            value={l.location}
                            placeholder="Ubicación"
                            onChange={e => {
                              const updated = [...draft.targetLesions];
                              updated[lIdx].location = e.target.value;
                              updated[lIdx].lesionKey = generateLesionKey(e.target.value);
                              setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: updated } : s));
                            }}
                            className="col-span-7 text-xs p-1.5 border border-slate-100 rounded-md font-medium"
                          />
                          <div className="col-span-4 flex items-center gap-1">
                            <input
                              type="number"
                              value={l.measurement}
                              onChange={e => {
                                const updated = [...draft.targetLesions];
                                updated[lIdx].measurement = Number(e.target.value);
                                setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: updated } : s));
                              }}
                              className="w-full text-xs p-1.5 border border-slate-100 rounded-md font-bold"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">mm</span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = draft.targetLesions.filter((_, idx) => idx !== lIdx);
                              setDraftStudies(draftStudies.map(s => s.id === draft.id ? { ...s, targetLesions: updated } : s));
                            }}
                            className="col-span-1 text-red-400 hover:text-red-600 flex justify-center cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                onClick={() => setDraftStudies(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDrafts}
                disabled={selectedDraftIds.length === 0}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wider hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Confirmar y Guardar ({selectedDraftIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDICIÓN COMPLETA DE ESTUDIO ─────────────────────── */}
      {editingStudy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600" />
                Editar Estudio Radiológico
              </h3>
              <button onClick={() => setEditingStudy(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Fecha</label>
                  <input
                    type="text"
                    value={editingStudy.date}
                    onChange={e => setEditingStudy({ ...editingStudy, date: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Modalidad</label>
                  <select
                    value={editingStudy.type}
                    onChange={e => setEditingStudy({ ...editingStudy, type: e.target.value as any })}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl font-bold bg-white"
                  >
                    <option value="TC">TC</option>
                    <option value="PET-TC">PET-TC</option>
                    <option value="RMN">RMN</option>
                    <option value="Ecografía">Ecografía</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Región</label>
                <input
                  type="text"
                  value={editingStudy.bodyRegion}
                  onChange={e => setEditingStudy({ ...editingStudy, bodyRegion: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Hallazgo Oncológico Relevante</label>
                <input
                  type="text"
                  value={editingStudy.relevantFindings || ''}
                  onChange={e => setEditingStudy({ ...editingStudy, relevantFindings: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Tratamiento Activo</label>
                <input
                  type="text"
                  value={editingStudy.treatment || ''}
                  onChange={e => setEditingStudy({ ...editingStudy, treatment: e.target.value || null })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingStudy.isBaseline}
                    onChange={e => setEditingStudy({ ...editingStudy, isBaseline: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">Línea de Base (Baseline)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStudy.newLesions}
                    onChange={e => setEditingStudy({ ...editingStudy, newLesions: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-xs font-bold text-red-600">Nuevas lesiones</span>
                </label>
              </div>

              {/* Lesiones dianas */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Lesiones Dianas ({editingStudy.targetLesions.length})</span>
                  <button
                    onClick={() => {
                      const newL: TargetLesion = { location: 'Nueva lesión', measurement: 10, lesionKey: 'nueva_lesion' };
                      setEditingStudy({ ...editingStudy, targetLesions: [...editingStudy.targetLesions, newL] });
                    }}
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
                {editingStudy.targetLesions.map((l, lIdx) => (
                  <div key={lIdx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      value={l.location}
                      onChange={e => {
                        const updated = [...editingStudy.targetLesions];
                        updated[lIdx].location = e.target.value;
                        updated[lIdx].lesionKey = generateLesionKey(e.target.value);
                        setEditingStudy({ ...editingStudy, targetLesions: updated });
                      }}
                      className="col-span-7 text-xs p-1.5 border border-slate-200 rounded-md bg-white font-medium"
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
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-md bg-white font-bold"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">mm</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = editingStudy.targetLesions.filter((_, idx) => idx !== lIdx);
                        setEditingStudy({ ...editingStudy, targetLesions: updated });
                      }}
                      className="col-span-1 text-red-400 hover:text-red-600 flex justify-center cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button onClick={() => setEditingStudy(null)} className="px-4 py-2 text-xs font-bold text-slate-500 cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleSaveEditedStudy}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wider hover:bg-blue-700 cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER INFORME COMPLETO ORIGINAL (Consulta Secundaria) */}
      {viewingRawReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={14} className="text-blue-600" />
                  Informe Original — {viewingRawReport.date}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">{viewingRawReport.type} {viewingRawReport.bodyRegion}</p>
              </div>
              <button onClick={() => setViewingRawReport(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed">
              {viewingRawReport.rawReport || 'No hay texto completo almacenado para este informe.'}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingRawReport(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: OVERRIDE MANUAL RECIST ──────────────────────────── */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Edit3 size={14} className="text-blue-600" />
                Override Manual RECIST
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Estado de Respuesta Manual</label>
                <select
                  value={overrideStatus}
                  onChange={e => setOverrideStatus(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl font-bold bg-white mt-1"
                >
                  <option value="">-- Sin Override (Cálculo Automático) --</option>
                  <option value="🟢 Respuesta Completa (CR)">🟢 Respuesta Completa (CR)</option>
                  <option value="🟢 Respuesta Parcial (PR)">🟢 Respuesta Parcial (PR)</option>
                  <option value="🟡 Enfermedad Estable (SD)">🟡 Enfermedad Estable (SD)</option>
                  <option value="🔴 Progresión de enfermedad (PD)">🔴 Progresión de enfermedad (PD)</option>
                  <option value="🔴 iUPD (Progresión No Confirmada)">🔴 iUPD (Progresión No Confirmada)</option>
                  <option value="🔴 iCPD (Progresión Confirmada)">🔴 iCPD (Progresión Confirmada)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nota Explicativa (Opcional)</label>
                <textarea
                  value={overrideNote}
                  onChange={e => setOverrideNote(e.target.value)}
                  placeholder="Justificación oncológica del override (ej: Discordancia clínica o metabólica)..."
                  className="w-full h-20 text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-300 mt-1 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button onClick={() => setShowOverrideModal(false)} className="px-3 py-2 text-xs font-bold text-slate-500 cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black tracking-wider hover:bg-blue-700 cursor-pointer"
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
