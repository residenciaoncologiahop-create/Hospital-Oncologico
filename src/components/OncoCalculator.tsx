import React, { useState } from 'react';
import { Calculator, X, Activity, AlertCircle, Info } from 'lucide-react';

interface OncoCalculatorProps {
  onClose: () => void;
}

export const calculateMostellerBSA = (weightKg: number | string, heightCmOrM: number | string): {
  bsa: number;
  bsaFormatted: string;
  weightKg: number;
  heightCm: number;
  wasMetersConverted: boolean;
  formulaStep: string;
  error: string | null;
} => {
  let w = parseFloat(weightKg?.toString().replace(',', '.'));
  let h = parseFloat(heightCmOrM?.toString().replace(',', '.'));

  if (isNaN(w) || w <= 0 || w > 350) {
    return { bsa: 0, bsaFormatted: '', weightKg: 0, heightCm: 0, wasMetersConverted: false, formulaStep: '', error: '⚠️ Ingrese un peso válido mayor a 0 kg (ej: 70 kg).' };
  }

  let wasMetersConverted = false;
  if (!isNaN(h) && h > 0 && h < 3) {
    h = Math.round(h * 100);
    wasMetersConverted = true;
  }

  if (isNaN(h) || h < 40 || h > 250) {
    return { bsa: 0, bsaFormatted: '', weightKg: w, heightCm: 0, wasMetersConverted: false, formulaStep: '', error: '⚠️ Ingrese una talla válida en cm o metros (ej: 170 cm o 1.70 m).' };
  }

  const product = w * h;
  const ratio = product / 3600;
  const rawBsa = Math.sqrt(ratio);
  const bsaFormatted = rawBsa.toFixed(2);

  const formulaStep = `SC = √[(${w} kg × ${h} cm) / 3600] = √[${product} / 3600] = √[${ratio.toFixed(4)}] = ${bsaFormatted} m²`;

  return {
    bsa: rawBsa,
    bsaFormatted,
    weightKg: w,
    heightCm: h,
    wasMetersConverted,
    formulaStep,
    error: null
  };
};

const OncoCalculator: React.FC<OncoCalculatorProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'bsa' | 'calvert'>('bsa');
  const [values, setValues] = useState({
    weight: '70', height: '170', creat: '1.0', age: '60', gender: 'male', auc: '5'
  });
  const [calcDetails, setCalcDetails] = useState<{
    result: string | null;
    formulaStep?: string;
    notice?: string;
    isError?: boolean;
  } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues({ ...values, [e.target.name]: e.target.value });
    setCalcDetails(null);
  };

  const handleCalculateBSA = () => {
    const res = calculateMostellerBSA(values.weight, values.height);
    if (res.error) {
      setCalcDetails({ result: res.error, isError: true });
      return;
    }

    setCalcDetails({
      result: `${res.bsaFormatted} m²`,
      formulaStep: res.formulaStep,
      notice: res.wasMetersConverted ? `Se convirtió automáticamente la altura a ${res.heightCm} cm.` : undefined,
      isError: false
    });
  };

  const handleCalculateCalvert = () => {
    const cr = parseFloat(values.creat.replace(',', '.'));
    const age = parseFloat(values.age);
    const w = parseFloat(values.weight.replace(',', '.'));
    const auc = parseFloat(values.auc);

    if (isNaN(cr) || cr <= 0) return setCalcDetails({ result: "⚠️ Ingrese un valor de Creatinina válido (> 0 mg/dL).", isError: true });
    if (isNaN(age) || age <= 0 || age > 120) return setCalcDetails({ result: "⚠️ Ingrese una edad válida.", isError: true });
    if (isNaN(w) || w <= 0) return setCalcDetails({ result: "⚠️ Ingrese un peso válido en kg.", isError: true });
    if (isNaN(auc) || auc <= 0) return setCalcDetails({ result: "⚠️ Ingrese un AUC objetivo válido.", isError: true });

    // Cockcroft-Gault
    let clCr = ((140 - age) * w) / (72 * cr);
    if (values.gender === 'female') clCr *= 0.85;

    // GFR tope usual en 125 ml/min para Calvert
    const gfr = Math.min(clCr, 125);
    const dose = auc * (gfr + 25);

    setCalcDetails({
      result: `Dosis Carboplatino: ${Math.round(dose)} mg`,
      formulaStep: `ClCr (Cockcroft-Gault): ${clCr.toFixed(1)} ml/min (GFR tope: ${gfr.toFixed(1)})\nFórmula Calvert: Dosis = ${auc} × (${gfr.toFixed(1)} + 25) = ${Math.round(dose)} mg`,
      isError: false
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-widest">
            <Calculator size={16} />
            <span>Calculadora Clínico-Oncológica</span>
          </div>
          <button onClick={onClose} className="text-indigo-300 hover:text-indigo-600 transition-colors"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button onClick={() => {setTab('bsa'); setCalcDetails(null)}} className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors ${tab==='bsa' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:bg-gray-50'}`}>Sup. Corporal (Mosteller)</button>
          <button onClick={() => {setTab('calvert'); setCalcDetails(null)}} className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors ${tab==='calvert' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:bg-gray-50'}`}>Dosis Carboplatino (Calvert)</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {tab === 'bsa' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peso (kg)</label>
                  <input type="number" name="weight" placeholder="Ej: 70" value={values.weight} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-xl font-bold text-sm focus:border-indigo-400 outline-none"/>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Talla (cm o m)</label>
                  <input type="number" step="any" name="height" placeholder="Ej: 170 o 1.70" value={values.height} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-xl font-bold text-sm focus:border-indigo-400 outline-none"/>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                <Info size={12}/> Estándar de la fórmula de Mosteller: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">SC = √[(Peso × Talla) / 3600]</code>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
               <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Edad</label><input type="number" name="age" value={values.age} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-xl font-bold text-sm outline-none"/></div>
               <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Creatinina (mg/dl)</label><input type="number" step="0.1" name="creat" value={values.creat} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-xl font-bold text-sm outline-none"/></div>
               <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peso (kg)</label><input type="number" name="weight" value={values.weight} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-xl font-bold text-sm outline-none"/></div>
               <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sexo</label><select name="gender" value={values.gender} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-xl font-bold text-sm outline-none bg-white"><option value="male">Hombre</option><option value="female">Mujer</option></select></div>
               <div className="col-span-2"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">AUC Objetivo</label><input type="number" name="auc" value={values.auc} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-xl font-bold text-sm outline-none"/></div>
            </div>
          )}

          {calcDetails && (
            <div className={`p-4 rounded-xl border space-y-2 ${calcDetails.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-indigo-50/70 border-indigo-100 text-indigo-900'}`}>
              <div className="flex items-center gap-2 justify-center">
                {calcDetails.isError ? <AlertCircle size={16} className="text-red-500"/> : <Activity size={16} className="text-indigo-600"/>}
                <span className="text-base font-black tracking-tight">{calcDetails.result}</span>
              </div>

              {calcDetails.formulaStep && (
                <div className="pt-2 border-t border-indigo-100/60 text-[10px] font-mono text-gray-600 text-center leading-relaxed">
                  {calcDetails.formulaStep}
                </div>
              )}

              {calcDetails.notice && (
                <p className="text-[10px] text-indigo-600 font-bold text-center">{calcDetails.notice}</p>
              )}
            </div>
          )}

          <button 
            onClick={tab === 'bsa' ? handleCalculateBSA : handleCalculateCalvert}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
          >
            Calcular
          </button>
        </div>
      </div>
    </div>
  );
};

export default OncoCalculator;
