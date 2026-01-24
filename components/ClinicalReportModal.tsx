import React from 'react';
import { FileText, X, Printer, Copy } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string | null;
  isLoading: boolean;
}

const ClinicalReportModal: React.FC<Props> = ({ isOpen, onClose, title, content, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* HEADER INSTITUCIONAL */}
        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 p-2 rounded-lg text-indigo-700">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">{title}</h3>
              <p className="text-[10px] text-gray-500 font-medium">Informe Clínico Generado por IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ÁREA DE CONTENIDO (RENDERIZADO HTML) */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-60">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest animate-pulse">Generando Informe...</p>
            </div>
          ) : content ? (
            // AQUI ESTÁ LA CLAVE: Renderizado HTML seguro con estilos base
            <div 
              className="prose prose-sm max-w-none text-gray-700 font-sans leading-relaxed"
              // Inyectamos el HTML generado por los prompts
              dangerouslySetInnerHTML={{ __html: content }} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs font-medium">
              No se pudo generar el contenido.
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-white flex justify-between items-center text-[10px] text-gray-400">
          <span>Confidencial • Uso Médico Exclusivo</span>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicalReportModal;
