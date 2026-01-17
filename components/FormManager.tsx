import React, { useState } from 'react';
import { FileText, Loader2, Wand2, Search, AlertCircle, AlertTriangle } from 'lucide-react';
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

  // Helper para calcular Superficie Corporal (Mosteller)
  const calculateBSA = (weight: string, height: string) => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return Math.sqrt((w * h) / 3600).toFixed(2);
    }
    return '';
  };

  const inspectPDF = async (formDef: any) => {
    setProcessingId('inspect-' + formDef.id);
    setStatus('Leyendo campos...');
    setDebugFields([]);
    try {
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error("Archivo no encontrado");
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields().map(f => f.getName());
      
      if (fields.length === 0) alert("⚠️ Este PDF no tiene campos editables (es una imagen).");
      else setDebugFields(fields);
      
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Analiza la historia clínica y extrae los datos para formularios.
      Devuelve JSON estricto con estas claves. Si no hay dato, pon "".
      {
        "diagnostico_cie10": "Diagnóstico CIE-10 completo",
        "peso": "Solo el número (kg)",
        "talla": "Solo el número (cm)",
        "ecog": "Solo el número (0-4)",
        "droga_1": "Nombre genérico droga 1",
        "dosis_1": "Dosis droga 1",
        "droga_2": "Nombre genérico droga 2",
        "dosis_2": "Dosis droga 2",
        "ciclos": "Número de ciclos"
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
    setStatus('Procesando datos...');

    try {
      const aiData = await extractDataWithAI();
      const bsa = calculateBSA(aiData.peso, aiData.talla);

      setStatus('Escribiendo PDF...');
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      
      // Chequeo de seguridad del archivo
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('pdf')) throw new Error("El archivo no es un PDF válido.");

      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      if (fields.length === 0) {
        throw new Error("El PDF no tiene campos editables. Suba la versión original digital (AcroForm).");
      }

      // --- LÓGICA DE MAPEO ESPECÍFICA POR FORMULARIO ---
      
      if (formDef.id === 'pami') {
        // Mapeo exacto para PAMI (basado en tu lista)
        const setField = (name: string, val: string) => {
            try { const f = form.getTextField(name); f.setText(val || ''); } catch (e) {}
        };

        setField('Apellido y Nombre', patient.name);
        setField('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        setField('Peso', aiData.peso);
        setField('Talla', aiData.talla);
        setField('Sup Corpora', bsa);
        setField('ECOG', aiData.ecog);
        setField('DrogaGenéricoRow1', aiData.droga_1);
        setField('DosisRow1', aiData.dosis_1);
        setField('N CiclosDuración díasRow1', aiData.ciclos);
        if (aiData.droga_2) {
            setField('DrogaGenéricoRow2', aiData.droga_2);
            setField('DosisRow2', aiData.dosis_2);
        }
      } 
      else if (formDef.id === 'admision' || formDef.id === 'renovacion') {
        // Mapeo posicional para Admisión/Renovación (Text1, Text2...)
        // Asumimos orden lógico: Nombre -> DNI -> Diagnóstico -> Peso/Talla -> Drogas
        // Esto es una aproximación basada en la estructura visual estándar
        
        const textFields = fields.filter(f => f.constructor.name === 'PDFTextField');
        
        // Campo 0 (Text1): Nombre
        if (textFields[0]) textFields[0].setText(patient.name);
        
        // Buscamos campos por índice aproximado para Drogas (suelen estar al medio/final)
        // Nota: Esto requerirá ajuste fino visual, pero ponemos los datos donde "suelen" ir
        
        // Intentamos llenar diagnóstico en los primeros campos de texto largo
        if (textFields[10]) textFields[10].setText(aiData.diagnostico_cie10);

        // Peso y Talla (Suelen estar agrupados)
        // Buscamos campos pequeños consecutivos
        
        // Estrategia de "Inyección General":
        // Si no sabemos el campo exacto, intentamos llenar al menos el diagnóstico y drogas en campos vacíos
        // para que el médico solo tenga que moverlos si están mal.
      }
      else {
        // DINADIC u otros genéricos: Mapeo por coincidencia de nombre
        fields.forEach(field => {
            if (field.constructor.name === 'PDFTextField') {
                const name = field.getName().toLowerCase();
                const textField = form.getTextField(field.getName());
                
                if (name.includes('nombre') || name.includes('paciente')) textField.setText(patient.name);
                else if (name.includes('diag')) textField.setText(aiData.diagnostico_cie10);
                else if (name.includes('peso')) textField.setText(aiData.peso);
                else if (name.includes('talla')) textField.setText(aiData.talla);
                else if (name.includes('droga')) textField.setText(aiData.droga_1);
            }
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${formDef.name}_${patient.name}.pdf`;
      link.click();
      setStatus('¡Descargado!');

    } catch (e: any) {
      alert(e.message);
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
                  className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                    ${processingId === form.id ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
                >
                  {processingId === form.id ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                  <span>{processingId === form.id ? 'Procesando' : 'Generar'}</span>
                </button>
                
                <button 
                  onClick={() => inspectPDF(form)}
                  disabled={processingId !== null}
                  className="flex items-center justify-center px-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                  title="Verificar campos internos del PDF"
                >
                  <Search size={14} />
                </button>
            </div>
          </div>
        ))}
      </div>

      {debugFields.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 rounded-xl border border-gray-200 animate-in slide-in-from-top">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-black uppercase text-gray-500">Campos Internos ({debugFields.length})</h4>
                <button onClick={() => setDebugFields([])} className="text-gray-400 hover:text-gray-600"><AlertCircle size={14}/></button>
            </div>
            <div className="max-h-32 overflow-y-auto font-mono text-[9px] bg-white p-2 rounded border text-gray-600 select-all break-words">
                {debugFields.join(', ')}
            </div>
        </div>
      )}

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}
      
      <div className="mt-6 p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={14} />
        <p className="text-[10px] text-red-700 font-medium leading-relaxed">
            Si recibe el error <strong>"No tiene campos editables"</strong>, significa que el PDF subido es una imagen escaneada. Debe subir la versión digital original (donde se puede escribir con el teclado).
        </p>
      </div>
    </div>
  );
};

export default FormManager;
