import React from 'react';
import { ClipboardCheck, X, AlertTriangle, FileSearch } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string | null;
  isLoading: boolean;
  mode?: 'resident' | 'professional'; // Nueva prop opcional
}

const ClinicalAuditModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  content, 
  isLoading, 
  mode = 'resident' // Por defecto es residente
}) => {
  if (!isOpen) return null;

  const isProfessional = mode === 'professional';

  // Configuración de textos según modo
  const headerTitle = isProfessional 
    ? "Control de Calidad de Historia Clínica" 
    : "Auditoría de Registro Clínico";

  const headerSubtitle = isProfessional 
    ? "Revisión documental asistencial" 
    : "Revisión automática de variables y datos faltantes";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* HEADER ADAPTATIVO */}
        <div className={`p-5 border-b flex justify-between items-center ${isProfessional ? 'bg-slate-50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 p-2 rounded-lg text-gray-700">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">{headerTitle}</h3>
              <p className="text-[10px] text-gray-500 font-medium">{headerSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full p-2 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT (Común para ambos) */}
        <div className="flex-1 overflow-y-auto p-8 bg-white scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-100 border-t-gray-800 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-gray-800"><FileSearch size={24}/></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-800 uppercase tracking-widest">
                  {isProfessional ? "Procesando Documentación..." : "Auditando Documentación..."}
                </p>
                <p className="text-xs text-gray-400 mt-1">Extrayendo variables • Verificando consistencia</p>
              </div>
            </div>
          ) : content ? (
 <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed
                [&_h1]:text-xl [&_h1]:leading-snug [&_h1]:mb-4
                [&_h2]:text-lg [&_h2]:leading-snug [&_h2]:mb-3
                [&_h3]:text-lg [&_h3]:leading-snug [&_h3]:mb-3
                [&_p]:leading-relaxed [&_p]:my-2
                [&_li]:leading-relaxed [&_li]:my-1
                [&_td]:align-top [&_td]:py-2 [&_td]:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <AlertTriangle size={48} className="mb-2"/>
              <p className="text-xs font-bold uppercase">Sin datos para procesar</p>
            </div>
          )}
        </div>

        {/* FOOTER: Advertencia de Seguridad */}
        <div className="p-4 bg-amber-50 border-t border-amber-100 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
            <strong>AVISO DE RESPONSABILIDAD:</strong> Esta herramienta es un soporte para la organización de datos. 
            El resultado NO constituye una recomendación clínica ni reemplaza la revisión exhaustiva de la historia clínica original por parte del profesional.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClinicalAuditModal;
