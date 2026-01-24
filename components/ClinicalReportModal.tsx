import React, { useRef, useState } from 'react';
import { FileText, X, Printer, Copy, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string | null;
  isLoading: boolean;
}

const ClinicalReportModal: React.FC<Props> = ({ isOpen, onClose, title, content, isLoading }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Lógica de Copiado Inteligente (Texto plano formateado)
  const handleCopy = () => {
    if (!contentRef.current) return;
    const text = contentRef.current.innerText; // Extrae solo el texto legible
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Lógica de Impresión / PDF
  const handlePrint = () => {
    if (!contentRef.current) return;
    
    const printContent = contentRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    
    // Crear un entorno de impresión limpio
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>' + title + '</title>');
      // Inyectamos Tailwind CDN para asegurar que el PDF mantenga los estilos
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>'); 
      printWindow.document.write('</head><body class="p-10">');
      printWindow.document.write('<h1 class="text-2xl font-bold mb-6">' + title + '</h1>');
      printWindow.document.write(printContent);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      // Pequeño delay para asegurar que los estilos carguen
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* HEADER */}
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
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-60">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest animate-pulse">Generando Informe...</p>
            </div>
          ) : content ? (
            <div 
              ref={contentRef}
              className="prose prose-sm max-w-none text-gray-700 font-sans leading-relaxed"
              dangerouslySetInnerHTML={{ __html: content }} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs font-medium">No se pudo generar el contenido.</div>
          )}
        </div>

        {/* FOOTER CON ACCIONES */}
        <div className="p-4 border-t bg-white flex justify-between items-center text-[10px] text-gray-400">
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              disabled={isLoading || !content}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
            >
              <Printer size={14} /> Descargar PDF
            </button>
            <button 
              onClick={handleCopy}
              disabled={isLoading || !content}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border ${copied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar Texto'}
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 px-4 py-2 transition-all">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default ClinicalReportModal;
