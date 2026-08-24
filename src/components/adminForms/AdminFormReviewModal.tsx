import React, { useState, useEffect } from 'react';
import {
  X, FileText, AlertCircle, CheckCircle2, Download, Loader2, Plus, Trash2, ShieldAlert
} from 'lucide-react';
import { AdminFormDefinition, AdminFormContext, DrugTableRow } from '../../services/adminForms/types';
import { calculateBSA } from '../../services/adminForms/pdfHelpers';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    }
  }, [initialData, formDef]);

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

  // Manejo de tabla de drogas
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const result = await formDef.generatePDF(formData, context);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(result.blob);
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Error al generar el PDF: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] flex flex-col">
        
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {formDef.code}
                </span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  {formDef.name}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {formDef.institution}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Banner de alerta de campos faltantes */}
        {missingRequiredFields.length > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-800">
            <ShieldAlert size={16} className="text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Contenido con Scroll de Campos agrupados */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
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
                {drugs.map((drugRow, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 items-center">
                    <div className="col-span-4">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Droga</label>
                      <input
                        type="text"
                        value={drugRow.droga || ''}
                        placeholder="Nombre droga"
                        onChange={e => handleDrugRowChange(rIdx, 'droga', e.target.value)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg font-bold"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Concentración</label>
                      <input
                        type="text"
                        value={drugRow.concentracion || ''}
                        placeholder="ej: 100 mg"
                        onChange={e => handleDrugRowChange(rIdx, 'concentracion', e.target.value)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Envase</label>
                      <input
                        type="text"
                        value={drugRow.envase || ''}
                        placeholder="ej: F.A. / comp"
                        onChange={e => handleDrugRowChange(rIdx, 'envase', e.target.value)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Dosis Diaria</label>
                      <input
                        type="text"
                        value={drugRow.dosisDiaria || ''}
                        placeholder="ej: 200 mg"
                        onChange={e => handleDrugRowChange(rIdx, 'dosisDiaria', e.target.value)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg font-bold text-blue-700"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Cant.</label>
                      <input
                        type="text"
                        value={drugRow.cantidadEnvases || ''}
                        placeholder="ej: 1"
                        onChange={e => handleDrugRowChange(rIdx, 'cantidadEnvases', e.target.value)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg text-center font-bold"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pt-3">
                      {drugs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDrugRow(rIdx)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal con Botones */}
        <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <span>Revise los campos antes de generar el documento oficial.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Generar y Descargar PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminFormReviewModal;
