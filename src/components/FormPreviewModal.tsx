import React, { useState, useEffect } from 'react';
import {
  X, FileText, Download, RefreshCw, Loader2, CheckCircle2, Eye, Edit3, Maximize2, Minimize2
} from 'lucide-react';

export interface FormPreviewModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  code?: string;
  pdfBlob: Blob | null;
  filename: string;
  isUpdating?: boolean;
  onClose: () => void;
  onConfirmDownload: () => void;
  onUpdatePreview?: () => Promise<void> | void;
  children?: React.ReactNode; // Campos editables
}

export const FormPreviewModal: React.FC<FormPreviewModalProps> = ({
  isOpen,
  title,
  subtitle = 'Revise visualmente el documento antes de confirmar la descarga.',
  code,
  pdfBlob,
  filename,
  isUpdating = false,
  onClose,
  onConfirmDownload,
  onUpdatePreview,
  children,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [isMaximizedPreview, setIsMaximizedPreview] = useState(false);

  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfBlob]);

  if (!isOpen) return null;

  const hasEditPanel = Boolean(children);

  return (
    <div
      className={`fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 overflow-hidden transition-all ${
        isMaximizedPreview ? 'p-0' : 'p-2 sm:p-4'
      }`}
    >
      <div
        className={`bg-white flex flex-col shadow-2xl overflow-hidden border border-slate-200 transition-all ${
          isMaximizedPreview
            ? 'w-screen h-screen max-w-none rounded-none'
            : 'max-w-7xl w-full h-[95vh] rounded-2xl sm:rounded-3xl'
        }`}
      >
        
        {/* Header Modal */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {code && (
                  <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {code}
                  </span>
                )}
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide truncate">
                  {title}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>{isMaximizedPreview ? 'Visor Maximizado' : 'Vista Previa Activa'}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {isMaximizedPreview
                  ? 'Modo maximizado: use los controles integrados del visor para zoom y navegación.'
                  : subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Selector de pestañas para pantallas móviles / tablets (solo si no está maximizado) */}
            {hasEditPanel && !isMaximizedPreview && (
              <div className="flex lg:hidden bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'preview'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye size={13} />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'edit'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 size={13} />
                  <span>Campos</span>
                </button>
              </div>
            )}

            {/* Alternar maximizado de vista previa */}
            {hasEditPanel && (
              <button
                type="button"
                onClick={() => setIsMaximizedPreview(!isMaximizedPreview)}
                title={isMaximizedPreview ? 'Restaurar tamaño normal y mostrar editor' : 'Maximizar PDF ocupando toda la ventana'}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                  isMaximizedPreview
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {isMaximizedPreview ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isMaximizedPreview ? 'Restaurar tamaño' : 'Maximizar PDF'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-all"
              title="Cerrar vista previa"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cuerpo Principal del Modal */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-50 min-h-0">
          
          {/* Panel: Visor de PDF */}
          <div
            className={`h-full flex flex-col bg-slate-100 overflow-hidden relative transition-all ${
              isMaximizedPreview
                ? 'p-1.5 sm:p-2 col-span-12'
                : 'p-3 sm:p-4 lg:col-span-7 col-span-12 border-r border-slate-200'
            } ${hasEditPanel && activeTab !== 'preview' && !isMaximizedPreview ? 'hidden lg:flex' : 'flex'}`}
          >
            {/* Barra informativa superior del visor */}
            <div className="flex items-center justify-between px-2.5 py-1 mb-1.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs text-[11px] text-slate-600 shrink-0">
              <span className="font-mono text-slate-700 truncate font-semibold">
                📄 {filename}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                {isMaximizedPreview
                  ? 'Modo maximizado — Controles de zoom y páginas activos'
                  : 'Use los controles del visor para hacer zoom y navegar páginas'}
              </span>
            </div>

            {/* Contenedor del Iframe con el PDF */}
            <div className="flex-1 w-full h-full relative rounded-xl overflow-hidden border border-slate-300 bg-white shadow-sm">
              {blobUrl ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-full border-0 rounded-xl"
                  title={`Vista previa de ${title}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
                  <span className="text-xs font-bold">Generando vista previa del documento...</span>
                </div>
              )}

              {/* Overlay de actualización en caliente */}
              {isUpdating && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-2xs flex flex-col items-center justify-center text-blue-900 gap-2 z-10 animate-in fade-in duration-100">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Actualizando vista previa con las correcciones...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho: Edición de Campos (Oculto cuando está maximizado) */}
          {hasEditPanel && !isMaximizedPreview && (
            <div
              className={`h-full flex flex-col bg-white overflow-hidden lg:col-span-5 ${
                activeTab !== 'edit' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Header del panel de edición */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Edit3 size={15} className="text-blue-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Editar Datos del Formulario
                  </h4>
                </div>
                {onUpdatePreview && (
                  <button
                    type="button"
                    onClick={() => onUpdatePreview()}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    <span>Actualizar Vista Previa</span>
                  </button>
                )}
              </div>

              {/* Mensaje instructivo sutil */}
              <div className="px-5 py-2 bg-blue-50/40 border-b border-blue-100 text-[11px] text-blue-950/80 shrink-0">
                Modifique cualquier dato incorrecto. Presione <span className="font-bold text-blue-700">"Actualizar vista previa"</span> para visualizar los cambios reflejados en el PDF antes de descargarlo.
              </div>

              {/* Contenido scrolleable de campos editables */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {children}
              </div>
            </div>
          )}

        </div>

        {/* Footer del Modal */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Verifique todos los datos visualmente en el documento antes de confirmar la descarga definitiva.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all w-full sm:w-auto"
            >
              Cerrar
            </button>

            {hasEditPanel && onUpdatePreview && (
              <button
                type="button"
                onClick={() => onUpdatePreview()}
                disabled={isUpdating}
                className="px-4 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto disabled:opacity-50"
              >
                {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                <span>Actualizar Vista Previa</span>
              </button>
            )}

            <button
              type="button"
              onClick={onConfirmDownload}
              disabled={!pdfBlob || isUpdating}
              className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all w-full sm:w-auto disabled:opacity-50 cursor-pointer"
            >
              <Download size={15} />
              <span>Confirmar y descargar PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FormPreviewModal;
