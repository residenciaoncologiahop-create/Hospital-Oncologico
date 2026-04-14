import React, { useRef, useState, useEffect } from 'react';
import { FileText, X, Printer, Copy, Check, RefreshCcw, Loader2 } from 'lucide-react';

const MAX_CORRECTION = 300;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string | null;
  isLoading: boolean;
  onRegenerate?: (correction: string) => Promise<void>;
}

const ClinicalReportModal: React.FC<Props> = ({ isOpen, onClose, title, content, isLoading, onRegenerate }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [correction, setCorrection] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Reset correction field when a new generation starts
  useEffect(() => {
    if (isLoading) setCorrection('');
  }, [isLoading]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!contentRef.current) return;
    const text = contentRef.current.innerText;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (!contentRef.current) return;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title> Informe Clínico - ' + title + '</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('</head><body class="p-12 font-sans bg-white">');
      printWindow.document.write('<div class="border-b border-gray-200 pb-4 mb-6"><h1 class="text-2xl font-bold text-gray-800">' + title + '</h1><p class="text-xs text-gray-500 uppercase tracking-widest">Generado por OncoGuide AI</p></div>');
      printWindow.document.write(contentRef.current.innerHTML);
      printWindow.document.write('<div class="mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400 text-center">Documento de apoyo clínico. No reemplaza la firma médica.</div>');
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    }
  };

  const handleRegenerate = async () => {
    if (!correction.trim() || !onRegenerate || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(correction.trim());
      setCorrection('');
    } finally {
      setIsRegenerating(false);
    }
  };

  const busy = isLoading || isRegenerating;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 font-sans">

        {/* ENCABEZADO */}
        <div className="p-5 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 p-2 rounded-lg text-indigo-700 shadow-sm">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">{title}</h3>
              <p className="text-[10px] text-gray-500 font-medium">Visualización Institucional</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-700 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-10 bg-white scrollbar-hide">
          {busy && !content ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-60">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest animate-pulse">
                {isRegenerating ? 'Regenerando Informe...' : 'Generando Informe...'}
              </p>
            </div>
          ) : content ? (
            <>
              {busy && (
                <div className="flex items-center gap-2 mb-4 text-indigo-600 text-xs font-bold">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Regenerando...</span>
                </div>
              )}
              <div
                ref={contentRef}
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-4"
                dangerouslySetInnerHTML={{ __html: content }}
              />

              {/* PANEL DE CORRECCIÓN */}
              {onRegenerate && !isLoading && (
                <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                    ¿Algo incorrecto en el informe?
                  </p>
                  <div className="relative">
                    <textarea
                      value={correction}
                      onChange={e => setCorrection(e.target.value.slice(0, MAX_CORRECTION))}
                      placeholder="Ej: Falta el estadio TNM, corregir la frecuencia de controles, agregar toxicidades..."
                      className="w-full h-20 p-3 text-xs border border-amber-200 rounded-xl bg-white resize-none outline-none focus:border-amber-400 transition-colors"
                      disabled={isRegenerating}
                    />
                    <span className="absolute bottom-2 right-3 text-[9px] text-amber-400 font-bold">
                      {MAX_CORRECTION - correction.length}
                    </span>
                  </div>
                  <button
                    onClick={handleRegenerate}
                    disabled={!correction.trim() || isRegenerating}
                    className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRegenerating
                      ? <><Loader2 size={12} className="animate-spin" /> Regenerando...</>
                      : <><RefreshCcw size={12} /> Corregir y regenerar</>
                    }
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs">No hay contenido disponible.</div>
          )}
        </div>

        {/* PIE DE PÁGINA */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={busy || !content}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:shadow-none"
            >
              <Printer size={14} /> Descargar PDF
            </button>
            <button
              onClick={handleCopy}
              disabled={busy || !content}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${copied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 px-4 text-xs font-bold uppercase tracking-wider">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default ClinicalReportModal;
