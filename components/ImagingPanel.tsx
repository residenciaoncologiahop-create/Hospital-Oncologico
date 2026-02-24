import React, { useState } from 'react';
import { Upload, X, Loader2, Image, Zap, ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react';
import { extractImagingDataSecure, compareRecistSecure } from '../utils/aiProxy';

// ── Tipos ──────────────────────────────────────────────────────────────
interface TargetLesion {
  location: string;
  measurement: number; // mm
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
  targetLesions: TargetLesion[];
  nonTargetLesions: NonTargetLesion[];
  newLesions: boolean;
  rawSummary: string;
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

const parseDate = (dateStr: string) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};

const sumMeasurements = (lesions: TargetLesion[]) =>
  lesions.reduce((acc, l) => acc + (l.measurement || 0), 0);

// ── Componente principal ───────────────────────────────────────────────
const ImagingPanel: React.FC<ImagingPanelProps> = ({ studies, onStudiesChange }) => {

  const [reportText, setReportText] = useState('');
  const [reportFiles, setReportFiles] = useState<FileData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [recistHtml, setRecistHtml] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Agrupar estudios por tipo, ordenados cronológicamente
  const studiesByType = (['TC', 'RMN', 'PET-TC'] as const).reduce((acc, type) => {
    acc[type] = [...studies]
      .filter(s => s.type === type)
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return acc;
  }, {} as Record<string, ImagingStudy[]>);

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
        targetLesions: data.targetLesions || [],
        nonTargetLesions: data.nonTargetLesions || [],
        newLesions: !!data.newLesions,
        rawSummary: data.rawSummary || '',
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
      setRecistHtml(`<div class="text-red-600 text-xs p-4">Error al comparar estudios: ${e.message}</div>`);
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

  return (
    <div className="space-y-6">

      {/* ── Carga de nuevo informe ─────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
          Cargar Informe de Imagen
        </h3>

        {/* Uploader de PDF */}
        <div>
          <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">
            PDF del Informe
          </label>
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
          <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-gray-100 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-white hover:border-blue-300 transition-all group">
            <Upload className="w-4 h-4 text-gray-300 group-hover:text-blue-400 mb-1" />
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Seleccionar PDF</span>
            <input type="file" className="hidden" multiple accept="application/pdf,image/*" onChange={handleFileChange} />
          </label>
        </div>

        {/* Texto libre */}
        <textarea
          className="w-full h-28 p-4 border-2 border-gray-100 rounded-2xl text-xs font-medium bg-gray-50 focus:bg-white focus:border-blue-200 transition-all outline-none resize-none shadow-inner"
          placeholder="O pegá el texto del informe aquí..."
          value={reportText}
          onChange={e => setReportText(e.target.value)}
        />

        {extractError && (
          <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {extractError}
          </div>
        )}

        <button
          onClick={handleExtract}
          disabled={isExtracting || (!reportText.trim() && reportFiles.length === 0)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black tracking-widest shadow-xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          {isExtracting
            ? <><Loader2 className="animate-spin" size={14}/>Extrayendo datos...</>
            : <><Image size={14}/>Procesar Informe</>
          }
        </button>
      </section>

      {/* ── Estudios registrados ───────────────────────────────── */}
      {studies.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
            Estudios Registrados
          </h3>

          {(['TC', 'RMN', 'PET-TC'] as const).map(type => {
            const group = studiesByType[type];
            if (group.length === 0) return null;
            return (
              <div key={type} className="space-y-2">
                {/* Header del grupo */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${TYPE_COLORS[type]}`}>
                    {type} — {group.length} estudio{group.length > 1 ? 's' : ''}
                  </span>
                  {group.length >= 2 && (
                    <button
                      onClick={() => handleCompare(type)}
                      disabled={isComparing}
                      className="flex items-center gap-1.5 text-[10px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      <Zap size={11}/>
                      {isComparing ? 'Comparando...' : 'Comparar RECIST 1.1'}
                    </button>
                  )}
                </div>

                {/* Tarjetas de estudios */}
                {group.map((study, idx) => {
                  const sum = sumMeasurements(study.targetLesions);
                  const isBaseline = idx === 0;
                  const baselineSum = sumMeasurements(group[0].targetLesions);
                  const pctChange = baselineSum > 0 && !isBaseline
                    ? ((sum - baselineSum) / baselineSum * 100).toFixed(1)
                    : null;

                  return (
                    <div key={study.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      {/* Header tarjeta */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedId(expandedId === study.id ? null : study.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-gray-800">{study.date}</span>
                              {isBaseline && (
                                <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase tracking-widest">Baseline</span>
                              )}
                              {study.newLesions && (
                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-widest">Nuevas lesiones</span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">{study.bodyRegion}</span>
                          </div>
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
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteStudy(study.id); }}
                            className="text-gray-200 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={13}/>
                          </button>
                          {expandedId === study.id ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                        </div>
                      </div>

                      {/* Detalle expandido */}
                      {expandedId === study.id && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                          {study.rawSummary && (
                            <p className="text-[11px] text-gray-500 font-medium leading-relaxed pt-3 italic">
                              "{study.rawSummary}"
                            </p>
                          )}

                          {study.targetLesions.length > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                                Lesiones Diana ({study.targetLesions.length})
                              </p>
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
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                                Lesiones No Diana
                              </p>
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
            );
          })}
        </section>
      )}

      {/* ── Informe RECIST ────────────────────────────────────── */}
      {isComparing && (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="animate-spin text-indigo-600" size={32}/>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Aplicando criterios RECIST 1.1...</p>
        </div>
      )}

      {recistHtml && !isComparing && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={13} className="text-indigo-600"/>
              Análisis RECIST 1.1
            </h3>
            <button
              onClick={() => setRecistHtml(null)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14}/>
            </button>
          </div>
          <div
            className="text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: recistHtml }}
          />
        </section>
      )}

      {studies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-200">
          <Image size={40} className="mb-3 opacity-20"/>
          <p className="text-xs font-black uppercase tracking-widest">Sin estudios registrados.</p>
          <p className="text-[10px] font-medium mt-1 text-gray-300">Cargá el primer informe para comenzar.</p>
        </div>
      )}
    </div>
  );
};

export default ImagingPanel;
