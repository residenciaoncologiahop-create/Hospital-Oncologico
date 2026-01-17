import React, { useState } from 'react';
import { FileText, Download, Loader2, Wand2, AlertTriangle } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI } from "@google/genai";

interface FormManagerProps {
  patient: any;
  historyText: string;
}

const FormManager: React.FC<FormManagerProps> = ({ patient, historyText }) => {
  // CAMBIO 1: Ahora guardamos el ID del formulario que se está procesando, no un simple true/false
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/banco_drogas.pdf' },
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf' },
  ];

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Analiza la siguiente historia clínica y extrae los datos para un formulario oncológico.
      Devuelve SOLO un JSON con estas claves (si no encuentras el dato, pon "No consta"):
      {
        "diagnostico": "Diagnóstico completo CIE-10",
        "peso": "Peso kg",
        "talla": "Talla cm",
        "ecog": "ECOG (0-4)",
        "droga_1": "Nombre droga 1",
        "dosis_1": "Dosis droga 1",
        "droga_2": "Nombre droga 2",
        "dosis_2": "Dosis droga 2",
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
    const jsonString = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  };

  const fillAndDownloadPDF = async (formDef: any) => {
    // CAMBIO 2: Seteamos el ID específico del botón presionado
    setProcessingId(formDef.id);
    setStatus('Analizando historia...');

    try {
      const aiData = await extractDataWithAI();
      setStatus('Buscando archivo PDF...');

      // CAMBIO 3: Verificación robusta de la ruta del archivo
      const formUrl = window.location.origin + formDef.file;
      console.log("Intentando descargar:", formUrl); // Para depuración

      const res = await fetch(formUrl);
      
      // Si el archivo no existe (404), lanzamos error descriptivo
      if (!res.ok) {
        throw new Error(`No se encontró el archivo: ${formDef.file}. Verifique la carpeta public/forms en GitHub.`);
      }

      // Verificamos que sea un PDF real y no una página de error HTML
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('pdf')) {
         throw new Error(`El archivo recuperado no es un PDF (Tipo: ${contentType}).`);
      }

      const formBytes = await res.arrayBuffer();
      setStatus('Rellenando campos...');

      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      fields.forEach(field => {
        if (field.constructor.name === 'PDFTextField') {
            const name = field.getName().toLowerCase();
            const textField = form.getTextField(field.getName());
            
            if (name.includes('nombre') || name.includes('paciente')) textField.setText(patient.name);
            else if (name.includes('edad')) textField.setText(patient.age.toString());
            else if (name.includes('diag')) textField.setText(aiData.diagnostico);
            else if (name.includes('peso')) textField.setText(aiData.peso);
            else if (name.includes('talla')) textField.setText(aiData.talla);
            else if (name.includes('ecog')) textField.setText(aiData.ecog);
            else if (name.includes('droga')) textField.setText(aiData.droga_1 + (aiData.droga_2 ? ' / ' + aiData.droga_2 : ''));
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${formDef.name}_${patient.name}.pdf`;
      link.click();
      
      setStatus('¡Listo!');
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    } finally {
      // Liberamos el estado
      setProcessingId(null);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-6">Gestión de Trámites</h3>
      
      <div className="grid gap-4">
        {forms.map(form => (
          <div key={form.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-blue-300 transition-all shadow-sm group">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                <FileText size={24} />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-gray-800 text-xs uppercase">{form.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                    {/* Muestra la ruta del archivo para ayudar a depurar si falla */}
                    Fuente: {form.file}
                </p>
              </div>
            </div>

            <button 
              onClick={() => fillAndDownloadPDF(form)}
              // Deshabilitamos TODOS si hay uno procesando, pero...
              disabled={processingId !== null}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all 
                ${processingId === form.id 
                    ? 'bg-blue-600 text-white cursor-wait' 
                    : 'bg-gray-900 text-white hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed'}`}
            >
              {/* ...solo mostramos el spinner en el que se clickeó */}
              {processingId === form.id ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Wand2 size={16} />
              )}
              <span>{processingId === form.id ? 'Procesando...' : 'Generar'}</span>
            </button>
          </div>
        ))}
      </div>

      {status && (
        <div className="mt-6 text-center">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-xs font-bold animate-pulse">
                {status}
            </span>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-yellow-800 text-[10px] font-medium leading-relaxed flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
        <span>
            <strong>Si recibe error "No PDF header":</strong> Verifique en GitHub (carpeta public/forms) que el nombre del archivo sea EXACTAMENTE igual al que figura arriba (ej: pami.pdf, no PAMI.pdf o pami.PDF).
        </span>
      </div>
    </div>
  );
};

export default FormManager;
