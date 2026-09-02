import React, { useState, useEffect } from 'react';
import {
  AlertCircle, CheckCircle2, Plus, Trash2, ShieldAlert
} from 'lucide-react';
import { AdminFormDefinition, AdminFormContext, DrugTableRow } from '../../services/adminForms/types';
import { calculateBSA } from '../../services/adminForms/pdfHelpers';
import FormPreviewModal from '../FormPreviewModal';

interface AdminFormReviewModalProps {
  formDef: AdminFormDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  initialData: Record<string, any>;
  context: AdminFormContext;
}

export const AdminFormReviewModal: React.FC<AdminFormReviewModalProps> = ({
  formDef,
  isOpen,
  onClose,
  initialData,
  context
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generador de la vista previa del PDF
  const generatePreview = async (dataToUse = formData): Promise<Blob | null> => {
    if (!formDef) return null;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const result = await formDef.generatePDF(dataToUse, context);
      setPdfBlob(result.blob);
      setPdfFilename(result.filename);
      return result.blob;
    } catch (err: any) {
      setErrorMessage(`Error al generar la vista previa del PDF: ${err.message}`);
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialData && formDef) {
      const initial = { ...initialData };
      setFormData(initial);
      generatePreview(initial);
    } else {
      setPdfBlob(null);
      setPdfFilename('');
      setErrorMessage(null);
    }
  }, [isOpen, initialData, formDef]);

  if (!isOpen || !formDef) return null;

  // Manejador de cambio de campos
  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: value };

      // Si cambian peso o talla, recalcular automáticamente SC
      if (key === 'peso' || key === 'talla') {
        const bsa = calculateBSA(key === 'peso' ? value : prev.peso, key === 'talla' ? value : prev.talla);
        if (bsa) updated.superficie_corporal = bsa;
      }

      return updated;
    });
  };

  // Identificar campos requeridos que están vacíos
  const missingRequiredFields = formDef.fields.filter(f => {
    if (!f.required) return false;
    const val = formData[f.key];
    if (val === undefined || val === null) return true;
    if (typeof val === 'string' && !val.trim()) return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });

  // Agrupar campos por sección
  const groups = Array.from(new Set(formDef.fields.map(f => f.group || 'Datos Generales')));

  // Manejo de tabla de drogas (para Solicitud de Medicamentos Oncológicos)
  const drugs: DrugTableRow[] = formData.drogas_tabla || [];
  const handleDrugRowChange = (index: number, colKey: keyof DrugTableRow, val: string) => {
    const updated = [...drugs];
    if (!updated[index]) {
      updated[index] = { droga: '', concentracion: '', envase: '', dosisDiaria: '', cantidadEnvases: '', duracionTto: '' };
    }
    updated[index][colKey] = val;
    setFormData(prev => ({ ...prev, drogas_tabla: updated }));
  };

  const handleAddDrugRow = () => {
    setFormData(prev => ({
      ...prev,
      drogas_tabla: [
        ...(prev.drogas_tabla || []),
        { droga: '', concentracion: '', envase: 'F.A.', dosisDiaria: '', cantidadEnvases: '1', duracionTto: '21 días' }
      ]
    }));
  };

  const handleRemoveDrugRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      drogas_tabla: (prev.drogas_tabla || []).filter((_: any, i: number) => i !== index)
    }));
  };

  // Descarga definitiva únicamente tras confirmación del médico
  const handleConfirmDownload = async () => {
    let blobToDownload = pdfBlob;
    let nameToDownload = pdfFilename;

    // Si no se había generado o hubo cambios pendientes, regenerar primero
    if (!blobToDownload) {
      blobToDownload = await generatePreview(formData);
      nameToDownload = pdfFilename || `${formDef.code}_${formData.paciente_nombre || 'formulario'}.pdf`;
    }

    if (!blobToDownload) {
      alert("No se pudo preparar el PDF para la descarga.");
      return;
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blobToDownload);
    link.download = nameToDownload || `${formDef.code}_formulario.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  return (
    <FormPreviewModal
      isOpen={isOpen}
      title={formDef.name}
      subtitle={formDef.institution}
      code={formDef.code}
      pdfBlob={pdfBlob}
      filename={pdfFilename || `${formDef.code}.pdf`}
      isUpdating={isUpdating}
      onClose={onClose}
      onConfirmDownload={handleConfirmDownload}
      onUpdatePreview={() => generatePreview(formData)}
    >
      {/* Alerta de campos faltantes */}
      {missingRequiredFields.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shrink-0">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-black uppercase tracking-wide text-[10px] block mb-0.5">
              Datos requeridos pendientes de verificación:
            </span>
            <p className="text-[11px] text-amber-800">
              Por favor revise y complete los siguientes campos antes de emitir el formulario:{' '}
              <span className="font-bold">{missingRequiredFields.map(f => f.label).join(', ')}</span>.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-800 shrink-0">
          <ShieldAlert size={16} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Secciones de campos */}
      <div className="space-y-4">
        {groups.map(groupName => {
          const groupFields = formDef.fields.filter(f => (f.group || 'Datos Generales') === groupName);

          return (
            <div key={groupName} className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider border-b border-slate-200/80 pb-1.5 flex items-center gap-2">
                <CheckCircle2 size={13} className="text-blue-600" />
                <span>{groupName}</span>
              </h4>

              <div className="grid grid-cols-12 gap-3">
                {groupFields.map(field => {
                  const span = field.gridSpan || 12;
                  const colClass = `col-span-12 sm:col-span-${span}`;
                  const val = formData[field.key] ?? field.defaultValue ?? '';
                  const isMissing = field.required && (!val || (typeof val === 'string' && !val.trim()));

                  return (
                    <div key={field.key} className={colClass}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-tight flex items-center gap-1">
                          <span>{field.label}</span>
                          {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.helperText && (
                          <span className="text-[9px] text-slate-400 italic">{field.helperText}</span>
                        )}
                      </div>

                      {field.type === 'textarea' ? (
                        <textarea
                          rows={field.rows || 3}
                          value={val}
                          placeholder={field.placeholder}
                          onChange={e => handleFieldChange(field.key, e.target.value)}
                          className={`w-full text-xs p-2.5 rounded-xl border bg-white outline-none transition-all font-sans leading-relaxed
                            ${isMissing ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200 focus:border-blue-400'}`}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={val}
                          onChange={e => handleFieldChange(field.key, e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white font-bold text-slate-800 outline-none focus:border-blue-400"
                        >
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'text' : 'text'}
                          value={val}
                          placeholder={field.placeholder}
                          onChange={e => handleFieldChange(field.key, e.target.value)}
                          className={`w-full text-xs p-2.5 rounded-xl border bg-white outline-none transition-all
                            ${isMissing ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200 focus:border-blue-400'}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Tabla de Fármacos Especial (para Solicitud de Medicamentos Oncológicos) */}
        {formDef.id === 'solicitud_medicamentos_onco' && (
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={13} className="text-blue-600" />
                <span>Tabla de Medicamentos y Dosis Prescriptas</span>
              </h4>
              <button
                type="button"
                onClick={handleAddDrugRow}
                className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1"
              >
                <Plus size={11} />
                <span>Agregar Fila</span>
              </button>
            </div>

            <div className="space-y-2">
              {drugs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  No hay fármacos cargados. Presione "Agregar Fila" para indicar drogas.
                </div>
              ) : (
                drugs.map((row, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-700 uppercase">Fármaco #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDrugRow(idx)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-all"
                        title="Eliminar fila"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-4">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Droga</label>
                        <input
                          type="text"
                          value={row.droga}
                          placeholder="Ej: Pembrolizumab"
                          onChange={e => handleDrugRowChange(idx, 'droga', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Concentración</label>
                        <input
                          type="text"
                          value={row.concentracion}
                          placeholder="100mg/4ml"
                          onChange={e => handleDrugRowChange(idx, 'concentracion', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Envase</label>
                        <input
                          type="text"
                          value={row.envase}
                          placeholder="F.A."
                          onChange={e => handleDrugRowChange(idx, 'envase', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Dosis Diaria</label>
                        <input
                          type="text"
                          value={row.dosisDiaria}
                          placeholder="200mg"
                          onChange={e => handleDrugRowChange(idx, 'dosisDiaria', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Cantidad</label>
                        <input
                          type="text"
                          value={row.cantidadEnvases}
                          placeholder="2"
                          onChange={e => handleDrugRowChange(idx, 'cantidadEnvases', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </FormPreviewModal>
  );
};

export default AdminFormReviewModal;
