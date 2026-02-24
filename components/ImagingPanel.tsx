import React, { useState } from 'react';
import { Upload, X, Loader2, Image, Zap, ChevronDown, ChevronUp, Trash2, Edit2, Check } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { extractImagingFromHistorySecure as extractImagingDataSecure, compareRecistSecure } from '../utils/aiProxy';

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
  type: 'TC' | 'RMN' | 'PET-TC';
  date: string;
  bodyRegion: string;
  treatment: string | null;
  targetLesions: TargetLesion[];
  nonTargetLesions: NonTargetLesion[];
  newLesions: boolean;
  extractedAt: number;
}

interface FileData { name: string; type: string; data: string; }

interface ImagingPanelProps {
  studies: ImagingStudy[];
  onStudiesChange: (studies: ImagingStudy[]) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  'TC':     'bg-blue-50 text-blue-700 border-blue-200',
  'RMN':    'bg-purple-50 text-purple-700 border-purple-200',
  'PET-TC': 'bg-orange-50 text-orange-700 border-orange-200',
};

const LINE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
];

const parseDate = (dateStr: string): number => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3)
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};

const sumMeasurements = (lesions: TargetLesion[]) =>
  lesions.reduce((acc, l) => acc + (l.measurement || 0), 0);

// ── Gráfico de evolución de lesiones ──────────────────────────────────
const LesionEvolutionChart = ({ studies }: { studies: ImagingStudy[] }) => {
  // Recolectar todas las localizaciones únicas de lesiones diana
  const allLocations = Array.from(
    new Set(studies.flatMap(s => s.targetLesions.map(l => l.location)))
  );

  // Ordenar estudios cronológicamente
  const sorted = [...studies].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Construir datos del gráfico: un punto por estudio
  const chartData = sorted.map((study, idx) => {
    const point: any = {
      date: study.date,
      label: study.date,
      treatment: study.treatment || '',
      total: sumMeasurements(study.targetLesions),
    };

    // Medida de cada lesión en este estudio
    allLocations.forEach(loc => {
      const lesion = study.targetLesions.find(l => l.location === loc);
      point[loc] = lesion ? lesion.measurement : null;
    });

    // % cambio de la suma vs baseline (idx=0)
    if (idx === 0) {
      point.pctChange = 0;
    } else {
      const baseline = sumMeasurements(sorted[0].targetLesions);
      point.pctChange = baseline > 0
        ? parseFloat(((point.total - baseline) / baseline * 100).toFixed(1))
        : null;
    }

    return point;
  });

  if (sorted.length < 2 || allLocations.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const treatment = payload[0]?.payload?.treatment;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs space-y-1 max-w-[220px]">
        <p className="font-black text-gray-700">{label}</p>
        {treatment && <p className="text-[10px] text-indigo-600 font-bold">Tto: {treatment}</p>}
        {payload.map((p: any, i: number) => (
          p.value !== null && (
            <div key={i} className="flex justify-between gap-3">
              <span style={{ color: p.color }} className="truncate font-medium">{p.name}</span>
              <span className="font-black">{p.value} mm</span>
            </div>
          )
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Gráfico de líneas por lesión */}
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">
          Evolución por Lesión Diana (mm)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} unit="mm" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            {allLocations.map((loc, i) => (
              <Line
                key={loc}
                type="monotone"
                dataKey={loc}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
                name={loc.length > 25 ? loc.substring(0, 25) + '…' : loc}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla de variación porcentual */}
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
          Variación vs Baseline (Suma de Lesiones Diana)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                <th className="text-left py-2 px-2 font-black text-gray-400 uppercase tracking-widest">Tratamiento</th>
                <th className="text-right py-2 px-2 font-black text-gray-400 uppercase tracking-widest">Suma (mm)</th>
                <th className="text-right py-2 px-2 font-black text-gray-400 uppercase tracking-widest">vs Baseline</th>
                <th className="text-center py-2 px-2 font-black text-gray-400 uppercase tracking-widest">Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, idx) => {
                const pct = row.pctChange;
                let responseLabel = '—';
                let responseColor = 'bg-gray-100 text-gray-500';
                if (idx === 0) {
                  responseLabel = 'Baseline';
                  responseColor = 'bg-gray-100 text-gray-600';
                } else if (pct !== null) {
                  if (row.total === 0) { responseLabel = 'RC'; responseColor = 'bg-green-100 text-green-700'; }
                  else if (pct <= -30) { responseLabel = 'RP'; responseColor = 'bg-green-100 text-green-700'; }
                  else if (pct >= 20) { responseLabel = 'EP'; responseColor = 'bg-red-100 text-red-700'; }
                  else { responseLabel = 'EE'; responseColor = 'bg-yellow-100 text-yellow-700'; }
                }
                // Si hay nuevas lesiones, siempre EP
                if (idx > 0 && sorted[idx]?.newLesions) {
                  responseLabel = 'EP'; responseColor = 'bg-red-100 text-red-700';
                }

                return (
                  <tr key={idx} className={`border-b border-gray-50 ${idx === 0 ? 'bg-gray-50/50' : ''}`}>
                    <td className="py-2 px-2 font-bold text-gray-700">{row.date}</td>
                    <td className="py-2 px-2 text-indigo-600 font-medium truncate max-w-[100px]">
                      {row.treatment || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-gray-800">{row.total}</td>
                    <td className={`py-2 px-2 text-right font-black ${
                      pct === null || idx === 0 ? 'text-gray-400'
                      : pct <= -30 ? 'text-green-600'
                      : pct >= 20 ? 'text-red-600'
                      : 'text-yellow-600'
                    }`}>
                      {idx === 0 ? '—' : pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : '—'}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${responseColor}`}>
                        {responseLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────
const ImagingPanel: React.FC<ImagingPanelProps> = ({ studies, onStudiesChange }) => {

  const [reportText, setReportText] = useState('');
  const [reportFiles, setReportFiles] = useState<FileData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [recistHtml, setRecistHtml] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [editingTreatment, setEditingTreatment] = useState<string | null>(null);
  const [treatmentDraft, setTreatmentDraft] = useState('');
  const [activeType, setActiveType] = useState<'TC' | 'RMN' | 'PET-TC'>('TC');

  const studiesByType = (['TC', 'RMN', 'PET-TC'] as const).reduce((acc, type) => {
    acc[type] = [...studies]
      .filter(s => s.type === type)
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return acc;
  }, {} as Record<string, ImagingStudy[]>);

  const typesWithStudies = (['TC', 'RMN', 'PET-TC'] as const).filter(t => studiesByType[t].length > 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles: FileData[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = (evt) => {
          if (evt.target?.result) {
            const base64 = (evt.target.result as string).split(',')[1];
            newFiles.push({ name: file.name, type: file.type, data: base64 });
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setReportFiles(prev => [...prev, ...newFiles]);
  };

  const handleExtract = async () => {
    if (!reportText.trim() && reportFiles.length === 0) return;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const data = await extractImagingDataSecure(reportText, reportFiles);
      const newStudy: ImagingStudy = {
        id: `img-${Date.now()}`,
        type: data.type || 'TC',
        date: data.date || 'S/F',
        bodyRegion: data.bodyRegion || 'No especificado',
        treatment: data.treatment || null,
        targetLesions: data.targetLesions || [],
        nonTargetLesions: data.nonTargetLesions || [],
        newLesions: !!data.newLesions,
        extractedAt: Date.now(),
      };
      onStudiesChange([...studies, newStudy]);
      setReportText('');
      setReportFiles([]);
      setRecistHtml(null);
    } catch (e: any) {
      setExtractError(e.message || "Error al procesar el informe.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCompare = async (type: 'TC' | 'RMN' | 'PET-TC') => {
    const group = studiesByType[type];
    if (group.length < 2) return;
    setIsComparing(true);
    setRecistHtml(null);
    try {
      const html = await compareRecistSecure(group);
      setRecistHtml(html);
    } catch (e: any) {
      setRecistHtml(`<div class="text-red-600 text-xs p-4">Error: ${e.message}</div>`);
    } finally {
      setIsComparing(false);
    }
  };

  const handleDeleteStudy = (id: string) => {
    if (confirm("¿Eliminar este estudio?")) {
      onStudiesChange(studies.filter(s => s.id !== id));
      setRecistHtml(null);
    }
  };

  const handleSaveTreatment = (id: string) => {
    onStudiesChange(studies.map(s =>
      s.id === id ? { ...s, treatment: treatmentDraft.trim() || null } : s
    ));
    setEditingTreatment(null);
  };

  return (
    <div className="space-y-6">

      {/* ── Carga manual de informe adicional ─────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Agregar Informe Manual
          </h3>
          <span className="text-[9px] text-gray-300 font-medium">Los informes de los PDFs cargados en Documentación se detectan automáticamente</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {reportFiles.map((f, i) => (
            <div key={i} className="flex items-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] border border-blue-100 font-bold">
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => setReportFiles(reportFiles.filter((_, idx) => idx !== i))} className="ml-1 text-blue-300 hover:text-blue-600">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <label className="flex flex-col items-center justify-center w-full h-14 border-2 border-gray-100 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-white hover:border-blue-300 transition-all group">
          <Upload className="w-4 h-4 text-gray-300 group-hover:text-blue-400 mb-0.5" />
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Seleccionar PDF</span>
          <input type="file" className="hidden" multiple accept="application/pdf,image/*" onChange={handleFileChange} />
        </label>

        <textarea
          className="w-full h-20 p-3 border-2 border-gray-100 rounded-2xl text-xs font-medium bg-gray-50 focus:bg-white focus:border-blue-200 transition-all outline-none resize-none shadow-inner"
          placeholder="O pegá el texto del informe aquí..."
          value={reportText}
          onChange={e => setReportText(e.target.value)}
        />

        {extractError && (
          <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{extractError}</div>
        )}

        <button
          onClick={handleExtract}
          disabled={isExtracting || (!reportText.trim() && reportFiles.length === 0)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black tracking-widest shadow-xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          {isExtracting
            ? <><Loader2 className="animate-spin" size={14}/>Extrayendo datos...</>
            : <><Image size={14}/>Procesar Informe</>}
        </button>
      </section>

      {/* ── Estudios registrados ───────────────────────────────── */}
      {studies.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
            Estudios Registrados — {studies.length} total
          </h3>

          {/* Tabs por tipo */}
          {typesWithStudies.length > 1 && (
            <div className="flex gap-2">
              {typesWithStudies.map(type => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-widest transition-all
                    ${activeType === type ? TYPE_COLORS[type] + ' shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                >
                  {type} ({studiesByType[type].length})
                </button>
              ))}
            </div>
          )}

          {/* Gráfico de evolución */}
          {typesWithStudies.map(type => {
            if (typesWithStudies.length > 1 && type !== activeType) return null;
            const group = studiesByType[type];
            const hasTargetLesions = group.some(s => s.targetLesions.length > 0);

            return (
              <div key={type} className="space-y-4">
                {hasTargetLesions && group.length >= 2 && (
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <LesionEvolutionChart studies={group} />
                  </div>
                )}

                {/* Botón comparar RECIST */}
                {group.length >= 2 && (
                  <button
                    onClick={() => handleCompare(type)}
                    disabled={isComparing}
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black bg-indigo-600 text-white px-3 py-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 tracking-widest uppercase shadow-lg shadow-indigo-100"
                  >
                    <Zap size={12}/>
                    {isComparing ? 'Aplicando RECIST 1.1...' : `Informe RECIST 1.1 completo (${type})`}
                  </button>
                )}

                {/* Tarjetas de estudios */}
                <div className="space-y-2">
                  {group.map((study, idx) => {
                    const sum = sumMeasurements(study.targetLesions);
                    const isBaseline = idx === 0;
                    const baselineSum = sumMeasurements(group[0].targetLesions);
                    const pctChange = baselineSum > 0 && !isBaseline
                      ? ((sum - baselineSum) / baselineSum * 100).toFixed(1)
                      : null;

                    return (
                      <div key={study.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(expandedId === study.id ? null : study.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-gray-800">{study.date}</span>
                              {isBaseline && <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">Baseline</span>}
                              {study.newLesions && <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Nuevas lesiones</span>}
                            </div>
                            <span className="text-[10px] text-gray-400">{study.bodyRegion}</span>
                            {/* Tratamiento editable */}
                            {editingTreatment === study.id ? (
                              <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  type="text"
                                  value={treatmentDraft}
                                  onChange={e => setTreatmentDraft(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveTreatment(study.id)}
                                  className="text-[10px] px-2 py-1 border border-indigo-200 rounded-lg outline-none focus:border-indigo-400 w-40"
                                  placeholder="Esquema terapéutico..."
                                />
                                <button onClick={() => handleSaveTreatment(study.id)} className="text-indigo-600 hover:text-indigo-800"><Check size={12}/></button>
                                <button onClick={() => setEditingTreatment(null)} className="text-gray-300 hover:text-gray-500"><X size={12}/></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                                <span className="text-[10px] font-semibold text-indigo-500">
                                  {study.treatment || <span className="text-gray-300 italic">Sin tratamiento registrado</span>}
                                </span>
                                <button
                                  onClick={() => { setEditingTreatment(study.id); setTreatmentDraft(study.treatment || ''); }}
                                  className="text-gray-300 hover:text-indigo-500 transition-colors"
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
                                {pctChange !== null && (
                                  <span className={`text-[10px] font-black ${parseFloat(pctChange) <= -30 ? 'text-green-600' : parseFloat(pctChange) >= 20 ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {parseFloat(pctChange) > 0 ? '+' : ''}{pctChange}%
                                  </span>
                                )}
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
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lesiones Diana ({study.targetLesions.length})</p>
                                <div className="space-y-1">
                                  {study.targetLesions.map((l, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-1.5 rounded-lg">
                                      <span className="text-[11px] text-gray-600 font-medium">{l.location}</span>
                                      <span className="text-[11px] font-black text-gray-800">{l.measurement} mm</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between items-center bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Suma total</span>
                                    <span className="text-[11px] font-black text-blue-700">{sum} mm</span>
                                  </div>
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

      {/* ── Informe RECIST completo ────────────────────────────── */}
      {isComparing && (
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 className="animate-spin text-indigo-600" size={28}/>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Aplicando criterios RECIST 1.1...</p>
        </div>
      )}

      {recistHtml && !isComparing && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={13} className="text-indigo-600"/>Informe RECIST 1.1
            </h3>
            <button onClick={() => setRecistHtml(null)} className="text-gray-300 hover:text-gray-500"><X size={14}/></button>
          </div>
          <div className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: recistHtml }} />
        </section>
      )}

      {studies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-200">
          <Image size={40} className="mb-3 opacity-20"/>
          <p className="text-xs font-black uppercase tracking-widest">Sin estudios registrados.</p>
          <p className="text-[10px] font-medium mt-1 text-gray-300">Procesá los documentos en la pestaña Documentación para cargarlos automáticamente.</p>
        </div>
      )}
    </div>
  );
};

export default ImagingPanel;
