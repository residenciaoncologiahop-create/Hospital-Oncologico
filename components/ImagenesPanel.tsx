import React, { useMemo, useState } from 'react';
import { Activity, AlertCircle, FileImage, Loader2, Plus } from 'lucide-react';

export interface ClinicalEventLite { date: string; category: string; note: string; professional?: string; }

export interface ImageReport {
  id: string;
  date: string;
  modality: 'TC' | 'RMN' | 'PET-TC' | 'OTRA';
  report: string;
  source: 'timeline' | 'manual';
}

interface Props {
  timeline: ClinicalEventLite[];
  manualReports: ImageReport[];
  onAddManual: (report: Omit<ImageReport, 'id' | 'source'>) => Promise<void>;
  onCompare: (modality: 'TC' | 'RMN' | 'PET-TC', reports: ImageReport[]) => Promise<string>;
}

const parseDate = (dateStr: string) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};

const containsAny = (text: string, patterns: RegExp[]) => patterns.some((r) => r.test(text));

const MODALITY_PATTERNS = {
  PETTC: [/\bpet\b/i, /\bpet\s*[-/]?\s*tc\b/i],
  RMN: [/\brmn\b/i, /\bresonancia\s+magnetica\b/i, /\bresonancia\b/i],
  TC: [/\btc\b/i, /\btac\b/i, /\btomografia\b/i, /\btomografía\b/i],
  IMAGE_HINT: [/\bimagen\b/i, /\bestudio\s+por\s+imagenes\b/i, /\bradiolog/i]
};

const detectModality = (text: string): ImageReport['modality'] => {
  if (containsAny(text, MODALITY_PATTERNS.PETTC)) return 'PET-TC';
  if (containsAny(text, MODALITY_PATTERNS.RMN)) return 'RMN';
  if (containsAny(text, MODALITY_PATTERNS.TC)) return 'TC';
  return 'OTRA';
};

const isImagingEvent = (text: string) => {
  return containsAny(text, [
    ...MODALITY_PATTERNS.PETTC,
    ...MODALITY_PATTERNS.RMN,
    ...MODALITY_PATTERNS.TC,
    ...MODALITY_PATTERNS.IMAGE_HINT,
  ]);
};

const ImagenesPanel: React.FC<Props> = ({ timeline, manualReports, onAddManual, onCompare }) => {
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newModality, setNewModality] = useState<'TC' | 'RMN' | 'PET-TC'>('TC');
  const [newReport, setNewReport] = useState('');
  const [loadingModality, setLoadingModality] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<Record<string, string>>({});
  const [comparisonError, setComparisonError] = useState<Record<string, string>>({});

  const timelineImageReports = useMemo<ImageReport[]>(() => {
    return (timeline || [])
      .filter(ev => isImagingEvent(`${ev.category} ${ev.note}`.toLowerCase()))
      .map((ev, idx) => ({
        id: `timeline-${idx}-${ev.date}`,
        date: ev.date,
        modality: detectModality(`${ev.category} ${ev.note}`.toLowerCase()),
        report: ev.note,
        source: 'timeline' as const,
      }));
  }, [timeline]);

  const allReports = useMemo(() => {
    return [...timelineImageReports, ...(manualReports || [])].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }, [timelineImageReports, manualReports]);

  const grouped = useMemo(() => ({
    TC: allReports.filter(r => r.modality === 'TC'),
    RMN: allReports.filter(r => r.modality === 'RMN'),
    'PET-TC': allReports.filter(r => r.modality === 'PET-TC'),
    OTRA: allReports.filter(r => r.modality === 'OTRA'),
  }), [allReports]);

  const handleAdd = async () => {
    if (!newReport.trim()) return;
    const [y, m, d] = newDate.split('-');
    await onAddManual({ date: `${d}/${m}/${y}`, modality: newModality, report: newReport.trim() });
    setNewReport('');
    setComparisonError({});
  };

  const runCompare = async (modality: 'TC' | 'RMN' | 'PET-TC') => {
    const reports = grouped[modality];
    if (reports.length < 2) return;
    setLoadingModality(modality);
    setComparisonError(prev => ({ ...prev, [modality]: '' }));
    try {
      const text = await onCompare(modality, reports);
      setComparisonResult(prev => ({ ...prev, [modality]: text }));
    } catch (e: any) {
      setComparisonError(prev => ({ ...prev, [modality]: e?.message || 'No se pudo realizar la comparación automática.' }));
    } finally {
      setLoadingModality(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Nuevo Informe de Imágenes</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium" />
          <select value={newModality} onChange={e => setNewModality(e.target.value as 'TC' | 'RMN' | 'PET-TC')} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium">
            <option value="TC">TC</option>
            <option value="RMN">RMN</option>
            <option value="PET-TC">PET-TC</option>
          </select>
          <button onClick={handleAdd} className="bg-blue-600 text-white rounded-lg text-xs font-bold px-3 py-2 inline-flex items-center justify-center gap-2"><Plus size={14}/>Agregar</button>
        </div>
        <textarea value={newReport} onChange={e => setNewReport(e.target.value)} placeholder="Informe radiológico (hallazgos de lesiones diana/no diana, nuevas lesiones, etc.)" className="w-full min-h-24 rounded-xl border border-gray-200 p-3 text-xs font-medium" />
      </div>

      {(['TC', 'RMN', 'PET-TC', 'OTRA'] as const).map(modality => (
        <section key={modality} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <FileImage size={16} className="text-blue-600"/>
              <h4 className="text-xs font-black tracking-widest uppercase">{modality} ({grouped[modality].length})</h4>
            </div>
            {modality !== 'OTRA' && (
              <button
                onClick={() => runCompare(modality)}
                disabled={loadingModality === modality || grouped[modality].length < 2}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 disabled:opacity-40"
              >
                {loadingModality === modality ? <span className="inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin"/>Comparando...</span> : 'Comparar RECIST 1.1'}
              </button>
            )}
          </div>

          {grouped[modality].length === 0 ? (
            <p className="text-xs text-gray-400">Sin informes de {modality}.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {grouped[modality].map(r => (
                <article key={r.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.date}</span>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{r.source === 'timeline' ? 'HC' : 'manual'}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{r.report}</p>
                </article>
              ))}
            </div>
          )}

          {comparisonError[modality] && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="inline-flex items-center gap-2 text-red-700 mb-2"><AlertCircle size={14}/><span className="text-[10px] font-black uppercase tracking-widest">Error de comparación</span></div>
              <p className="text-xs text-red-900 whitespace-pre-wrap leading-relaxed">{comparisonError[modality]}</p>
            </div>
          )}

          {comparisonResult[modality] && !comparisonError[modality] && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="inline-flex items-center gap-2 text-emerald-700 mb-2"><Activity size={14}/><span className="text-[10px] font-black uppercase tracking-widest">Comparación automática RECIST 1.1</span></div>
              <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">{comparisonResult[modality]}</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

export default ImagenesPanel;
