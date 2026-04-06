import React, { useState } from 'react';
import { Calculator, X, Activity } from 'lucide-react';

interface OncoCalculatorProps {
  onClose: () => void;
}

const OncoCalculator: React.FC<OncoCalculatorProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'bsa' | 'calvert'>('bsa');
  const [values, setValues] = useState({
    weight: '', height: '', creat: '', age: '', gender: 'male', auc: '5'
  });
  const [result, setResult] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues({ ...values, [e.target.name]: e.target.value });
    setResult(null);
  };

  const calculateBSA = () => {
    const w = parseFloat(values.weight);
    const h = parseFloat(values.height);
    if (!w || !h) return setResult("Ingrese peso y altura válidos.");
    // Fórmula Mosteller: raiz((peso*altura)/3600)
    const bsa = Math.sqrt((w * h) / 3600);
    setResult(`${bsa.toFixed(2)} m² (Mosteller)`);
  };

  const calculateCalvert = () => {
    const cr = parseFloat(values.creat);
    const age = parseFloat(values.age);
    const w = parseFloat(values.weight);
    const auc = parseFloat(values.auc);

    if (!cr || !age || !w || !auc) return setResult("Faltan datos obligatorios.");

    // Cockcroft-Gault
    let clCr = ((140 - age) * w) / (72 * cr);
    if (values.gender === 'female') clCr *= 0.85;

    // Cap GFR usualmente a 125 ml/min para Calvert
    const gfr = Math.min(clCr, 125);
    
    // Calvert: Dosis = AUC * (GFR + 25)
    const dose = auc * (gfr + 25);
    
    setResult(
      `Dosis Carboplatino: ${dose.toFixed(0)} mg\n` +
      `(ClCr estimado: ${clCr.toFixed(1)} ml/min)`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-widest">
            <Calculator size={16} />
            <span>Calculadoras Oncológicas</span>
          </div>
          <button onClick={onClose} className="text-indigo-300 hover:text-indigo-600"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button onClick={() => {setTab('bsa'); setResult(null)}} className={`flex-1 py-3 text-xs font-bold transition-colors ${tab==='bsa' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:bg-gray-50'}`}>Sup. Corporal</button>
          <button onClick={() => {setTab('calvert'); setResult(null)}} className={`flex-1 py-3 text-xs font-bold transition-colors ${tab==='calvert' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:bg-gray-50'}`}>Fórm. Calvert</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {tab === 'bsa' ? (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Peso (kg)</label><input type="number" name="weight" value={values.weight} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm focus:border-indigo-300 outline-none"/></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Altura (cm)</label><input type="number" name="height" value={values.height} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm focus:border-indigo-300 outline-none"/></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Edad</label><input type="number" name="age" value={values.age} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm outline-none"/></div>
               <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Creatinina (mg/dl)</label><input type="number" name="creat" value={values.creat} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm outline-none"/></div>
               <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Peso (kg)</label><input type="number" name="weight" value={values.weight} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm outline-none"/></div>
               <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sexo</label><select name="gender" value={values.gender} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm outline-none bg-white"><option value="male">Hombre</option><option value="female">Mujer</option></select></div>
               <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">AUC Objetivo</label><input type="number" name="auc" value={values.auc} onChange={handleChange} className="w-full p-2 border rounded-lg font-bold text-sm outline-none"/></div>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-center">
              <Activity className="text-indigo-400 mr-2" size={16} />
              <span className="text-sm font-black text-indigo-800 whitespace-pre-line">{result}</span>
            </div>
          )}

          <button 
            onClick={tab === 'bsa' ? calculateBSA : calculateCalvert}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Calcular
          </button>
        </div>
      </div>
    </div>
  );
};

export default OncoCalculator;
