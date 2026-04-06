import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Plus, TestTube, AlertCircle, Activity } from 'lucide-react';

export interface LabResult {
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
  isResident?: boolean; // Si es true, oculta valores exactos y autor
}

const LabPanel: React.FC<Props> = ({ results, onAddManual, isResident = false }) => {
  // Obtener lista única de tests disponibles
  const availableTests = useMemo(() => Array.from(new Set(results.map(r => r.test))), [results]);
  const [selectedTest, setSelectedTest] = useState<string>(availableTests[0] || '');
  
  // Estado para carga manual
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTest, setManualTest] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  // Filtrar y ordenar datos para el gráfico
  const chartData = useMemo(() => {
    if (!selectedTest) return [];
    return results
      .filter(r => r.test === selectedTest)
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
  }, [results, selectedTest]);

  const handleAdd = () => {
    if (!onAddManual || !manualTest || !manualValue) return;
    const [y, m, d] = manualDate.split('-');
    const newItem: LabResult = {
      date: `${d}/${m}/${y}`,
      test: manualTest,
      value: parseFloat(manualValue),
      unit: manualUnit,
      source: 'manual',
      professional: 'Médico tratante' // Se asigna al usuario actual en el padre
    };
    onAddManual(newItem);
    setManualValue(''); setManualUnit('');
  };

  // Custom Tooltip para manejar la privacidad del residente
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as LabResult;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-xl text-xs">
          <p className="font-bold text-gray-700 mb-1">{label}</p>
          <p className="text-indigo-600 font-bold">
            {isResident ? 'Dato registrado' : `${data.value} ${data.unit}`}
          </p>
          {!isResident && (
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
              {data.professional} ({data.source})
            </p>
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
              value={selectedTest}
              onChange={(e) => setSelectedTest(e.target.value)}
            >
              {availableTests.length === 0 && <option>Sin datos</option>}
              {availableTests.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {availableTests.length > 0 && selectedTest && (
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
                stroke="#4f46e5" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6 }} 
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
    </div>
  );
};

export default LabPanel;
