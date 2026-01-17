import React, { useState } from 'react';
import { FileText, Loader2, Wand2, Search, AlertCircle } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI } from "@google/genai";

interface FormManagerProps {
  patient: any;
  historyText: string;
}

const FormManager: React.FC<FormManagerProps> = ({ patient, historyText }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [debugFields, setDebugFields] = useState<string[]>([]);

  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/banco_drogas.pdf' },
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf' },
  ];

  // --- HERRAMIENTA DE INSPECCIÓN (NUEVA) ---
  const inspectPDF = async (formDef: any) => {
    setProcessingId('inspect-' + formDef.id);
    setStatus('Leyendo campos del PDF...');
    setDebugFields([]);

    try {
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      // Extraemos los nombres de todos los campos
      const names = fields.map(f => f.getName());
      
      if (names.length === 0) {
        alert("⚠️ Este PDF no tiene campos editables detectables. Podría ser una imagen escaneada.");
      } else {
        setDebugFields(names);
      }
      setStatus(`Se encontraron ${names.length} campos.`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  // --- LÓGICA DE IA Y LLENADO ---
  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Analiza la historia clínica y extrae:
      {
        "diagnostico": "Diagnóstico CIE-10",
        "peso": "Peso kg",
        "talla": "Talla cm",
        "ecog": "ECOG (0-4)",
        "droga_1": "Droga 1",
        "dosis_1": "Dosis 1",
        "droga_2": "Droga 2",
        "dosis_2": "Dosis 2",
        "ciclos": "Nro ciclos"
      }
      HISTORIA: ${historyText}
      PACIENTE: ${patient.name}
    `;
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] }
    });
    const text = res.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  };

  const fillAndDownloadPDF = async (formDef: any) => {
    setProcessingId(formDef.id);
    setStatus('Analizando historia...');

    try {
      const aiData = await extractDataWithAI();
      setStatus('Rellenando PDF...');

      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error("Archivo no encontrado");
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      // LOGICA DE MAPEO INTELIGENTE (Se mejorará con los nombres reales)
      fields.forEach(field => {
        if (field.constructor.name === 'PDFTextField') {
            const name = field.getName().toLowerCase();
            const textField = form.getTextField(field.getName());
            
            // Intento de coincidencia amplia
            if (name.includes('nombre') || name.includes('paciente') || name.includes('name')) textField.setText(patient.name);
            else if (name.includes('edad') || name.includes('age')) textField.setText(patient.age.toString());
            else if (name.includes('diag')) textField.setText(aiData.diagnostico);
            else if (name.includes('peso') || name.includes('weight')) textField.setText(aiData.peso);
            else if (name.includes('talla') || name.includes('height')) textField.setText(aiData.talla);
            else if (name.includes('ecog')) textField.setText(aiData.ecog);
            else if (name.includes('droga') || name.includes('drug')) textField.setText(aiData.droga_1);
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Completado_${formDef.name}.pdf`;
      link.click();
      setStatus('¡Listo!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setProcessingId(null);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-6">Gestión de Trámites</h3>
      
      <div className="grid gap-4">
        {forms.map(form => (
          <div key={form.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-300 transition-all shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={20} /></div>
                    <h4 className="font-bold text-gray-800 text-xs uppercase">{form.name}</h4>
                </div>
            </div>
            
            <div className="flex gap-2">
                <button 
                  onClick={() => fillAndDownloadPDF(form)}
                  disabled={processingId !== null}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gray-900 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-50"
                >
                  {processingId === form.id ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                  <span>Generar</span>
                </button>
                
                <button 
                  onClick={() => inspectPDF(form)}
                  disabled={processingId !== null}
                  className="flex items-center justify-center px-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                  title="Ver nombres de campos internos"
                >
                  <Search size={14} />
                </button>
            </div>
          </div>
        ))}
      </div>

      {/* ÁREA DE RESULTADOS DE INSPECCIÓN */}
      {debugFields.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-black uppercase text-gray-500">Campos Detectados ({debugFields.length})</h4>
                <button onClick={() => setDebugFields([])} className="text-gray-400 hover:text-gray-600"><AlertCircle size={14}/></button>
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-[10px] bg-white p-2 rounded border text-gray-600 select-all">
                {debugFields.join(', ')}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">Copie estos nombres y envíelos al desarrollador para corregir el mapeo.</p>
        </div>
      )}

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}
    </div>
  );
};

export default FormManager;
