import React, { useState } from 'react';
import { Upload, X, Loader2, Image, ChevronDown, ChevronUp, Trash2, Edit2, Check } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { extractImagingFromHistorySecure as extractImagingDataSecure } from '../utils/aiProxy';

// ── Tipos ──────────────────────────────────────────────────────────────
interface TargetLesion {
  location: string;
  measurement: number;
}

interface NonTargetLesion {
  location: string;
  status: string;
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

// ── Helpers ────────────────────────────────────────────────────────────
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

const sumMeasurements = (lesions: TargetLesion[]) =>
  lesions.reduce((acc, l) => acc + (l.measurement || 0), 0);

const CLINICAL_COLORS = ['#4F7EA8', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#C2410C', '#4D7C0F'];

// ── PALABRAS CLAVE DE INMUNOTERAPIA ────────────────────────────────────
const IMMUNOTHERAPY_KEYWORDS = [
  'inmunoterapia', 'pembrolizumab', 'keytruda', 'nivolumab', 'opdivo',
  'atezolizumab', 'tecentriq', 'durvalumab', 'imfinzi', 'ipilimumab', 'yervoy',
  'anti-pd1', 'anti-pdl1', 'anti-ctla4', 'checkpoint', 'pd-1', 'pd-l1', 'ctla-4'
];

export interface RecistResult {
  criterion: 'RECIST 1.1' | 'iRECIST';
  criterionNote?: string;
  status: string;
  badgeColor: 'green' | 'yellow' | 'red' | 'gray';
  confidence: 'Alta' | 'Media' | 'Baja';
  explanation: string;
  insufficientData?: boolean;
}

// ── EVALUACIÓN AUTOMÁTICA RECIST 1.1 / iRECIST ─────────────────────────
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

  const allText = [
    patientHistoryText || '',
    ...studies.map(s => `${s.treatment || ''} ${s.bodyRegion || ''}`)
  ].join(' ').toLowerCase();

  const isImmuno = IMMUNOTHERAPY_KEYWORDS.some(kw => allText.includes(kw));
  const criterion = isImmuno ? 'iRECIST' : 'RECIST 1.1';
  const criterionNote = isImmuno ? 'Inmunoterapia' : 'Criterio estándar';

  const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const latest = sorted[sorted.length - 1];
  const baseline = sorted[0];

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
      explanation: 'Los informes radiológicos disponibles no contienen mediciones cuantitativas de lesiones ni descripción detallada de respuesta.',
      insufficientData: true
    };
  }

  const baselineSum = sumMeasurements(baseline.targetLesions);
  const latestSum = sumMeasurements(latest.targetLesions);
  const anyNewLesions = latest.newLesions || sorted.some(s => s.newLesions);

  if (sorted.length === 1) {
    return {
      criterion,
      criterionNote,
      status: 'Estudio Basal Registrado',
      badgeColor: 'gray',
      confidence: 'Media',
      explanation: `Estudio inicial (${latest.date}) registrado como línea de base. Se requiere un estudio de seguimiento para evaluar la respuesta.`
    };
  }

  if (anyNewLesions) {
    return {
      criterion,
      criterionNote,
      status: isImmuno ? '🔴 iUPD (Progresión No Confirmada)' : '🔴 Progresión de enfermedad (PD)',
      badgeColor: 'red',
      confidence,
      explanation: isImmuno
        ? 'Aparición de nuevas lesiones respecto al estudio previo/basal. En iRECIST se clasifica como iUPD a confirmar en 4-8 semanas.'
        : 'Progresión de enfermedad por aparición de nuevas lesiones observadas en los estudios radiológicos.'
    };
  }

  if (hasTargetLesions && baselineSum > 0) {
    const pctChange = ((latestSum - baselineSum) / baselineSum) * 100;

    if (latestSum === 0) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🟢 Respuesta Completa (iCR)' : '🟢 Respuesta Completa (CR)',
        badgeColor: 'green',
        confidence,
        explanation: 'Desaparición total de todas las lesiones diana registradas sin aparición de nuevas lesiones.'
      };
    }

    if (pctChange <= -30) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🟢 Respuesta Parcial (iPR)' : '🟢 Respuesta Parcial (PR)',
        badgeColor: 'green',
        confidence,
        explanation: `Respuesta parcial. Disminución del tamaño de las lesiones diana (${Math.abs(pctChange).toFixed(0)}% respecto al baseline) sin aparición de nuevas lesiones.`
      };
    }

    if (pctChange >= 20 && (latestSum - baselineSum) >= 5) {
      return {
        criterion,
        criterionNote,
        status: isImmuno ? '🔴 iUPD (Progresión No Confirmada)' : '🔴 Progresión de enfermedad (PD)',
        badgeColor: 'red',
        confidence,
        explanation: `Progresión de enfermedad. Aumento del ${pctChange.toFixed(0)}% en la suma de diámetros diana respecto a la línea de base.`
      };
    }

    return {
      criterion,
      criterionNote,
      status: isImmuno ? '🟡 Enfermedad Estable (iSD)' : '🟡 Enfermedad Estable (SD)',
      badgeColor: 'yellow',
      confidence,
      explanation: 'Enfermedad estable. Lesiones pulmonares, hepáticas u órganos diana sin cambios significativos respecto al estudio previo.'
    };
  }

  const nonTargetText = latest.nonTargetLesions.map(l => l.status).join(' ').toLowerCase();
  if (nonTargetText.includes('progreso') || nonTargetText.includes('progresion') || nonTargetText.includes('aumento')) {
    return {
      criterion,
      criterionNote,
      status: isImmuno ? '🔴 iUPD (Progresión No Confirmada)' : '🔴 Progresión de enfermedad (PD)',
      badgeColor: 'red',
      confidence: 'Media',
      explanation: 'Progresión inequívoca observada en el comportamiento de las lesiones no diana.'
    };
  }

  return {
    criterion,
    criterionNote,
    status: isImmuno ? '🟡 Enfermedad Estable (iSD)' : '🟡 Enfermedad Estable (SD)',
    badgeColor: 'yellow',
    confidence: 'Media',
    explanation: 'Lesiones registradas estables sin signos de progresión ni aparición de nuevas metástasis.'
  };
};

// ── TARJETA SUPERIOR DE EVALUACIÓN DE RESPUESTA ───────────────────────
const ResponseEvaluationCard = ({
  studies,
  patientHistoryText
}: {
  studies: ImagingStudy[];
  patientHistoryText?: string;
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
      <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-black/5 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`}/>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Evaluación de respuesta</h4>
          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-md bg-white/90 border border-slate-200 text-slate-600 shadow-2xs">
            {evaluation.criterion} ({evaluation.criterionNote})
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
          <span>Confianza:</span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
            evaluation.confidence === 'Alta' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
            evaluation.confidence === 'Media' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-200 text-slate-700'
          }`}>
            {evaluation.confidence}
          </span>
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

// ── GRÁFICO CLÍNICO CON SUPERPOSICIÓN DE TRATAMIENTOS ──────────────────
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
  const allLocations = Array.from(new Set(sorted.flatMap(s => s.targetLesions.map(l => l.location))));

  if (sorted.length === 0) return null;

  const chartData = sorted.map(study => {
    const point: any = {
      date: study.date,
      treatment: study.treatment || '',
      type: study.type,
      bodyRegion: study.bodyRegion,
    };

    allLocations.forEach(loc => {
      const lesion = study.targetLesions.find(l => l.location === loc);
      point[loc] = lesion ? lesion.measurement : null;
    });

    return point;
  });

  // Unique chart dates for reference line matching
  const chartDates = new Set(sorted.map(s => s.date));

  // Filter discrete timeline events to superimpose as fine vertical reference lines
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
          {payload.map((p: any, i: number) => (
            p.value !== null && p.value !== undefined && (
              <div key={i} className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}/>
                  <span className="text-slate-600 font-medium text-[11px] truncate max-w-[130px]">{p.name}</span>
                </div>
                <span className="font-black text-slate-900 text-[11px]">
                  {p.value} mm
                </span>
              </div>
            )
          ))}
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
              formatter={(value) => <span style={{ color: '#475569' }}>{value}</span>}
            />

            {/* Superposición discreta de líneas de tratamiento verticales */}
            {treatmentEvents.map((evt, idx) => {
              // Match exact date or nearest chart date
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

            {/* Curvas independientes por lesión */}
            {allLocations.map((loc, i) => (
              <Line
                key={loc}
                type="monotone"
                dataKey={loc}
                stroke={CLINICAL_COLORS[i % CLINICAL_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: CLINICAL_COLORS[i % CLINICAL_COLORS.length] }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
                name={loc}
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [editingTreatment, setEditingTreatment] = useState<string | null>(null);
  const [treatmentDraft, setTreatmentDraft] = useState('');
  const [activeType, setActiveType] = useState<'TC' | 'RMN' | 'PET-TC' | 'Ecografía'>('TC');

  const studiesByType = (['TC', 'RMN', 'PET-TC', 'Ecografía'] as const).reduce((acc, type) => {
    acc[type] = [...studies].filter(s => s.type === type);
    return acc;
  }, {} as Record<'TC' | 'RMN' | 'PET-TC' | 'Ecografía', ImagingStudy[]>);

  const typesWithStudies = (['TC', 'RMN', 'PET-TC', 'Ecografía'] as const).filter(
    type => studiesByType[type].length > 0
  );

  const handleExtract = async () => {
    if (!reportText.trim() && reportFiles.length === 0) return;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const extractedStudies = await extractImagingDataSecure(reportText, reportFiles);
      if (extractedStudies && extractedStudies.length > 0) {
        onStudiesChange([...studies, ...extractedStudies]);
        setReportText('');
        setReportFiles([]);
      } else {
        setExtractError('No se pudieron extraer estudios. Verifique que el informe contenga datos de TC/RMN/PET.');
      }
    } catch (e: any) {
      setExtractError(`Error en extracción: ${e.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDeleteStudy = (id: string) => {
    onStudiesChange(studies.filter(s => s.id !== id));
  };

  const handleSaveTreatment = (studyId: string) => {
    onStudiesChange(
      studies.map(s => s.id === studyId ? { ...s, treatment: treatmentDraft.trim() || null } : s)
    );
    setEditingTreatment(null);
  };

  return (
    <div className="space-y-6">

      {/* ── Carga / Extracción de Informes ───────────────────────── */}
      <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-50 pb-2">
          Procesar Nuevo Informe Radiológico
        </h3>

        {extractError && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium">
            {extractError}
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            placeholder="Pegá aquí el informe de TC, RMN o PET-TC para extraer mediciones y evolución..."
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
            ? <><Loader2 className="animate-spin" size={14}/>Extrayendo mediciones y lesiones...</>
            : <><Image size={14}/>Procesar Informe Radiológico</>}
        </button>
      </section>

      {/* ── Visualización de Evolución & Evaluación de Respuesta ── */}
      {studies.length > 0 && (
        <section className="space-y-5">

          {/* Tarjeta Única Superior de Evaluación de Respuesta */}
          <ResponseEvaluationCard studies={studies} patientHistoryText={patientHistoryText} />

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

          {/* Visor de Curvas Clínicas Reales e Historia de Estudios */}
          {typesWithStudies.map(type => {
            if (typesWithStudies.length > 1 && type !== activeType) return null;
            const group = studiesByType[type];

            return (
              <div key={type} className="space-y-4">

                {/* Gráfico Clínico Real con Tratamientos Superpuestos */}
                <ClinicalLesionChart studies={group} modality={type} timelineEvents={timelineEvents} />

                {/* Tarjetas de estudios registrados */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">
                    Informes Registrados — {group.length} {type}
                  </h4>
                  {group.map((study, idx) => {
                    const sum = sumMeasurements(study.targetLesions);
                    const isBaseline = idx === 0;

                    return (
                      <div key={study.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(expandedId === study.id ? null : study.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-gray-800">{study.date}</span>
                              {isBaseline && <span className="text-[9px] font-black bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">Baseline</span>}
                              {study.newLesions && <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Nuevas lesiones</span>}
                            </div>
                            <span className="text-[10px] text-gray-400">{study.bodyRegion}</span>
                            {editingTreatment === study.id ? (
                              <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  type="text"
                                  value={treatmentDraft}
                                  onChange={e => setTreatmentDraft(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveTreatment(study.id)}
                                  className="text-[10px] px-2 py-1 border border-blue-200 rounded-lg outline-none focus:border-blue-400 w-48"
                                  placeholder="Tratamiento al momento del estudio..."
                                />
                                <button onClick={() => handleSaveTreatment(study.id)} className="text-blue-600 hover:text-blue-800"><Check size={12}/></button>
                                <button onClick={() => setEditingTreatment(null)} className="text-gray-300 hover:text-gray-500"><X size={12}/></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                                <span className="text-[10px] font-semibold text-blue-600">
                                  {study.treatment || <span className="text-gray-300 italic">Sin tratamiento registrado</span>}
                                </span>
                                <button
                                  onClick={() => { setEditingTreatment(study.id); setTreatmentDraft(study.treatment || ''); }}
                                  className="text-gray-300 hover:text-blue-500 transition-colors"
                                >
                                  <Edit2 size={10}/>
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {study.targetLesions.length > 0 && (
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-gray-700">{sum} mm</span>
                              </div>
                            )}
                            <button onClick={e => { e.stopPropagation(); handleDeleteStudy(study.id); }} className="text-gray-200 hover:text-red-400 transition-colors">
                              <Trash2 size={13}/>
                            </button>
                            {expandedId === study.id ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                          </div>
                        </div>

                        {expandedId === study.id && (
                          <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                            {study.targetLesions.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lesiones Principales Medidas</p>
                                <div className="space-y-1">
                                  {study.targetLesions.map((l, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-1.5 rounded-lg">
                                      <span className="text-[11px] text-gray-600 font-medium">{l.location}</span>
                                      <span className="text-[11px] font-black text-gray-800">{l.measurement} mm</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {study.nonTargetLesions.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lesiones No Diana / Otros Hallazgos</p>
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
          <p className="text-[10px] font-medium mt-1 text-gray-400">Pegá el texto o adjuntá el informe PDF arriba para generar el resumen visual de evolución.</p>
        </div>
      )}
    </div>
  );
};

export default ImagingPanel;
