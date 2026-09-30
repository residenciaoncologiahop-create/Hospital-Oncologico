import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, TestTube, Activity, Trash2, Pencil, Calendar, X } from 'lucide-react';
import { normalizeLabTestName, isPlausibleLabResult } from '../utils/labValidation';

export interface LabResult {
  id?: string;
  date: string;
  test: string;
  value: number;
  unit: string;
  source: "manual" | "documento";
  professional: string;
}

interface Props {
  results: LabResult[];
  onAddManual?: (result: LabResult) => void;
  onDeleteResult?: (result: LabResult, index?: number) => void;
  onEditResult?: (oldResult: LabResult, updatedResult: LabResult, index?: number) => void;
  onResultsChange?: (newResults: LabResult[]) => void;
  isResident?: boolean; // Si es true, oculta valores exactos y autor
}

const PREFERRED_LAB_ORDER = [
  // 1. Hemograma
  'Hemoglobina', 'Hematocrito', 'Leucocitos', 'Neutrófilos', 'Plaquetas',
  // 2. Función renal
  'Creatinina', 'Urea',
  // 3. Función hepática
  'Bilirrubina total', 'Bilirrubina directa', 'Bilirrubina indirecta', 'GOT', 'GPT', 'FAL', 'GGT', 'Albúmina',
  // 4. Electrolitos
  'Sodio', 'Potasio', 'Calcio', 'Magnesio',
  // 5. Coagulación
  'INR', 'TTPA', 'Fibrinógeno',
  // 6. Marcadores tumorales
  'CEA', 'CA 19-9', 'CA 125', 'CA 15-3', 'PSA', 'AFP', 'β-HCG', 'Calcitonina', 'Tireoglobulina',
  // 7. Otros
  'PCR', 'VSG'
];

export interface ChartLabPoint extends LabResult {
  originalIndex: number;
}

export const toDateInputValue = (dStr: string): string => {
  if (!dStr) return new Date().toISOString().split('T')[0];
  const trimmed = dStr.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const cleanY = y.length === 2 ? `20${y}` : y;
      return `${cleanY}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  } else if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return trimmed;
      } else {
        const [d, m, y] = parts;
        const cleanY = y.length === 2 ? `20${y}` : y;
        return `${cleanY}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }
  return trimmed;
};

export const fromDateInputValue = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  return trimmed;
};

const LabPanel: React.FC<Props> = ({ 
  results = [], 
  onAddManual, 
  onDeleteResult, 
  onEditResult, 
  onResultsChange, 
  isResident = false 
}) => {
  // Normalizar y filtrar únicamente valores clínicamente plausibles (descartando errores de extracción/OCR)
  const normalizedResults: ChartLabPoint[] = useMemo(() => {
    return results
      .map((r, originalIndex) => ({
        ...r,
        originalIndex,
        test: normalizeLabTestName(r.test)
      }))
      .filter(r => isPlausibleLabResult(r.test, r.value, r.unit));
  }, [results]);

  const availableTests = useMemo(() => {
    const rawSet = Array.from(new Set(normalizedResults.map(r => r.test))) as string[];
    return rawSet.sort((a, b) => {
      const idxA = PREFERRED_LAB_ORDER.indexOf(a);
      const idxB = PREFERRED_LAB_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [normalizedResults]);

  const [selectedTest, setSelectedTest] = useState<string>(availableTests[0] || '');
  const activeTest = availableTests.includes(selectedTest) ? selectedTest : (availableTests[0] || '');
  
  // Estado para carga manual
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTest, setManualTest] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  // Estado para edición de un valor aislado
  const [editingItem, setEditingItem] = useState<ChartLabPoint | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTest, setEditTest] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editError, setEditError] = useState('');

  // Filtrar y ordenar datos para el gráfico
  const chartData: ChartLabPoint[] = useMemo(() => {
    if (!activeTest) return [];
    return normalizedResults
      .filter(r => r.test === activeTest)
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
  }, [normalizedResults, activeTest]);

  const handleAdd = () => {
    if (!onAddManual || !manualTest || !manualValue) return;
    const valNum = parseFloat(manualValue.replace(',', '.'));
    const normTest = normalizeLabTestName(manualTest);

    if (!isPlausibleLabResult(normTest, valNum, manualUnit)) {
      alert('El valor ingresado no es clínicamente plausible para el parámetro y unidad especificados.');
      return;
    }

    const [y, m, d] = manualDate.split('-');
    const newItem: LabResult = {
      date: `${d}/${m}/${y}`,
      test: manualTest,
      value: valNum,
      unit: manualUnit,
      source: 'manual',
      professional: 'Médico tratante' // Se asigna al usuario actual en el padre
    };
    onAddManual(newItem);
    setManualValue(''); setManualUnit('');
  };

  const handleDelete = (item: ChartLabPoint) => {
    if (isResident) return;
    const confirmed = window.confirm(
      `¿Desea eliminar este valor de ${item.test} (${item.value} ${item.unit || ''}) del ${item.date}?`
    );
    if (!confirmed) return;

    if (onDeleteResult) {
      onDeleteResult(item, item.originalIndex);
    } else if (onResultsChange) {
      const updated = results.filter((_, idx) => idx !== item.originalIndex);
      onResultsChange(updated);
    }
  };

  const handleStartEdit = (item: ChartLabPoint) => {
    if (isResident) return;
    setEditingItem(item);
    setEditDate(toDateInputValue(item.date));
    setEditTest(item.test);
    setEditValue(String(item.value));
    setEditUnit(item.unit || '');
    setEditError('');
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const valNum = parseFloat(editValue.replace(',', '.'));
    if (isNaN(valNum)) {
      setEditError('Por favor ingrese un valor numérico válido.');
      return;
    }
    const testName = editTest.trim() || editingItem.test;
    const normTest = normalizeLabTestName(testName);
    if (!isPlausibleLabResult(normTest, valNum, editUnit.trim())) {
      setEditError('El valor ingresado no es clínicamente plausible para el parámetro y unidad especificados.');
      return;
    }

    const finalDate = fromDateInputValue(editDate) || editingItem.date;
    const updatedItem: LabResult = {
      ...editingItem,
      date: finalDate,
      test: testName,
      value: valNum,
      unit: editUnit.trim()
    };

    if (onEditResult) {
      onEditResult(editingItem, updatedItem, editingItem.originalIndex);
    } else if (onResultsChange) {
      const updated = results.map((r, idx) => (idx === editingItem.originalIndex ? updatedItem : r));
      onResultsChange(updated);
    }
    setEditingItem(null);
  };

  // Custom Tooltip para manejar la privacidad del residente y sugerir interacción
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartLabPoint;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-xl text-xs">
          <p className="font-bold text-gray-700 mb-1">{label}</p>
          <p className="text-indigo-600 font-bold">
            {isResident ? 'Dato registrado' : `${data.value} ${data.unit}`}
          </p>
          {!isResident && (
            <>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
                {data.professional} ({data.source})
              </p>
              <p className="text-[9px] text-indigo-500 font-bold mt-1.5 border-t border-gray-100 pt-1">
                Clic en el punto para editar o eliminar
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* HEADER & SELECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2">
          <div className="bg-white p-2 rounded-lg border border-gray-200 text-indigo-600"><TestTube size={20}/></div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Parámetro</h3>
            <select 
              className="bg-transparent font-bold text-gray-800 outline-none cursor-pointer min-w-[150px]"
              value={activeTest}
              onChange={(e) => setSelectedTest(e.target.value)}
            >
              {availableTests.length === 0 && <option>Sin datos</option>}
              {availableTests.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {availableTests.length > 0 && activeTest && (
           <div className="text-right">
             <p className="text-[10px] text-gray-400 font-bold uppercase">Último valor</p>
             <p className="text-lg font-black text-indigo-600">
               {isResident ? '***' : `${chartData[chartData.length - 1]?.value} ${chartData[chartData.length - 1]?.unit}`}
             </p>
           </div>
        )}
      </div>

      {/* CHART AREA */}
      <div className="flex-1 min-h-[300px] w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
              <YAxis hide={isResident} tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#4F7EA8" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#4F7EA8', strokeWidth: 2, stroke: '#fff', cursor: isResident ? 'default' : 'pointer' }} 
                activeDot={{ 
                  r: 6, 
                  cursor: isResident ? 'default' : 'pointer',
                  onClick: (_e: any, payload: any) => {
                    if (isResident) return;
                    const point = payload?.payload || payload;
                    if (point && typeof point.value === 'number') {
                      handleStartEdit(point);
                    }
                  }
                }} 
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
            <Activity size={48} className="mb-2 opacity-20"/>
            <p className="text-xs font-bold uppercase tracking-widest">Sin datos gráficos</p>
          </div>
        )}
      </div>

      {/* PUNTOS DE LA CURVA (Permite eliminar o editar valores aislados) */}
      {chartData.length > 0 && !isResident && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Puntos de la curva — {activeTest} ({chartData.length})
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              Edita o elimina cualquier valor aislado
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
            {chartData.map((item) => (
              <div 
                key={`${item.originalIndex}-${item.date}-${item.value}`}
                className="py-2 px-2 flex items-center justify-between hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Calendar size={11} className="text-gray-400" />
                    {item.date}
                  </span>
                  <span className="text-xs font-black text-indigo-600">
                    {item.value} {item.unit || ''}
                  </span>
                  {item.professional && (
                    <span className="text-[10px] text-gray-400 hidden sm:inline">
                      • {item.professional} ({item.source || 'registro'})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar valor"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar valor aislado"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANUAL ENTRY FORM (Solo visible si onAddManual existe - Modo Profesional) */}
      {onAddManual && !isResident && (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 mb-3 text-gray-400">
            <Plus size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Carga Manual</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <input type="date" className="col-span-1 p-2 rounded-lg border border-gray-200 text-xs font-bold" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            <input type="text" placeholder="Parámetro (Ej: Hb)" className="col-span-2 p-2 rounded-lg border border-gray-200 text-xs" value={manualTest} onChange={e => setManualTest(e.target.value)} list="test-suggestions" />
            <datalist id="test-suggestions">
              {availableTests.map(t => <option key={t} value={t} />)}
            </datalist>
            <input type="number" placeholder="Valor" className="col-span-1 p-2 rounded-lg border border-gray-200 text-xs" value={manualValue} onChange={e => setManualValue(e.target.value)} />
            <div className="col-span-1 flex gap-2">
               <input type="text" placeholder="Unid." className="w-full p-2 rounded-lg border border-gray-200 text-xs" value={manualUnit} onChange={e => setManualUnit(e.target.value)} />
               <button onClick={handleAdd} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DE VALOR AISLADO */}
      {editingItem && !isResident && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Editar valor de laboratorio</h3>
                  <p className="text-[11px] text-gray-400">Modifique o corrija este valor de la curva</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingItem(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Fecha
                </label>
                <input 
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Parámetro
                </label>
                <input 
                  type="text"
                  value={editTest}
                  onChange={e => setEditTest(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-indigo-500"
                  list="edit-test-suggestions"
                />
                <datalist id="edit-test-suggestions">
                  {availableTests.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Valor
                  </label>
                  <input 
                    type="number"
                    step="any"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none focus:border-indigo-500"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Unidad
                  </label>
                  <input 
                    type="text"
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: mg/dL"
                  />
                </div>
              </div>

              {editError && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                  {editError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  const item = editingItem;
                  setEditingItem(null);
                  handleDelete(item);
                }}
                className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} />
                Eliminar valor
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabPanel;
