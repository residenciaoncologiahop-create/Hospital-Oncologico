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
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-white scrollbar-hide min-w-0">
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
              className="
                text-gray-700 text-sm leading-relaxed space-y-4
                [&_h1]:text-lg [&_h1]:font-black [&_h1]:text-gray-800 [&_h1]:uppercase [&_h1]:tracking-wide [&_h1]:border-b [&_h1]:border-gray-100 [&_h1]:pb-2 [&_h1]:mb-4 [&_h1]:mt-6
                [&_h2]:text-sm [&_h2]:font-black [&_h2]:text-gray-800 [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-6 [&_h2]:mb-3
                [&_h3]:text-xs [&_h3]:font-black [&_h3]:text-blue-600 [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:mt-4 [&_h3]:mb-2
                [&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-2 [&_p]:text-gray-600
                [&_ul]:space-y-1.5 [&_ul]:my-3 [&_ul]:pl-0
                [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-gray-600 [&_li]:pl-4 [&_li]:relative [&_li]:before:content-['•'] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-blue-400 [&_li]:list-none
                [&_strong]:font-black [&_strong]:text-gray-800
                [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-4
                [&_th]:text-left [&_th]:font-black [&_th]:text-gray-500 [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-[10px] [&_th]:py-2 [&_th]:px-3 [&_th]:bg-gray-50 [&_th]:border-b [&_th]:border-gray-100
                [&_td]:py-2 [&_td]:px-3 [&_td]:text-gray-600 [&_td]:border-b [&_td]:border-gray-50 [&_td]:align-top [&_td]:leading-relaxed
                [&_tr:hover_td]:bg-gray-50/50
                [&_hr]:border-gray-100 [&_hr]:my-6
              "
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
