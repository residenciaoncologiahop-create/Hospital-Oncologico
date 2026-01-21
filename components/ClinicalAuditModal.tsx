import React from 'react';
import { ClipboardCheck, X, AlertTriangle, FileSearch } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string | null;
  isLoading: boolean;
}

const ClinicalAuditModal: React.FC<Props> = ({ isOpen, onClose, content, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* HEADER: Tono serio/administrativo */}
        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 p-2 rounded-lg text-gray-700">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">Auditoría de Registro Clínico</h3>
              <p className="text-[10px] text-gray-500 font-medium">Revisión automática de variables y datos faltantes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full p-2 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 bg-white scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-100 border-t-gray-800 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-gray-800"><FileSearch size={24}/></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-800 uppercase tracking-widest">Auditando Documentación...</p>
                <p className="text-xs text-gray-400 mt-1">Extrayendo variables • Verificando consistencia</p>
              </div>
            </div>
          ) : content ? (
            <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <AlertTriangle size={48} className="mb-2"/>
              <p className="text-xs font-bold uppercase">Sin datos para auditar</p>
            </div>
          )}
        </div>

        {/* FOOTER: Advertencia de Seguridad Clínica */}
        <div className="p-4 bg-amber-50 border-t border-amber-100 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
            <strong>AVISO DE RESPONSABILIDAD:</strong> Esta herramienta es un soporte para la organización de datos. 
            El resultado de la auditoría NO constituye una recomendación clínica ni reemplaza la revisión exhaustiva de la historia clínica original por parte del profesional.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClinicalAuditModal;
