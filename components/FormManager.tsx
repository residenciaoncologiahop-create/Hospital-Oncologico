import React, { useState } from 'react';
import { FileText, Download, Loader2, Wand2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI } from "@google/genai";

interface FormManagerProps {
  patient: any;
  historyText: string;
}

const FormManager: React.FC<FormManagerProps> = ({ patient, historyText }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');

  // Estos nombres deben coincidir con los archivos que subas en el PASO 2
  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf' },
    { id: 'banco', name: 'Banco de Drogas (Anexo III)', file: '/forms/banco_drogas.pdf' },
  ];

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
        "ciclos": "Nro ciclos"
      }
      HISTORIA: ${historyText}
      PACIENTE: ${patient.name}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonString = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  };

  const fillAndDownloadPDF = async (formDef: any) => {
    setIsProcessing(true);
    setStatus('Analizando historia...');

    try {
      const aiData = await extractDataWithAI();
      setStatus('Rellenando PDF...');

      const formUrl = window.location.origin + formDef.file;
      const formBytes = await fetch(formUrl).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      fields.forEach(field => {
        if (field.constructor.name === 'PDFTextField') {
            const name = field.getName().toLowerCase();
            const textField = form.getTextField(field.getName());
            
            // Lógica de autocompletado
            if (name.includes('nombre') || name.includes('paciente')) textField.setText(patient.name);
            else if (name.includes('edad')) textField.setText(patient.age.toString());
            else if (name.includes('diag')) textField.setText(aiData.diagnostico);
            else if (name.includes('peso')) textField.setText(aiData.peso);
            else if (name.includes('talla')) textField.setText(aiData.talla);
            else if (name.includes('ecog')) textField.setText(aiData.ecog);
            else if (name.includes('droga')) textField.setText(aiData.droga_1);
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Pedido_${formDef.id}_${patient.name}.pdf`;
      link.click();
      
      setStatus('¡Descargado!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsProcessing(false);
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
              <div className="p-3 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors">
                <FileText size={24} />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-gray-800">{form.name}</h4>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Autocompletado con IA</p>
              </div>
            </div>
            <button 
              onClick={() => fillAndDownloadPDF(form)}
              disabled={isProcessing}
              className="flex items-center space-x-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
            >
              {isProcessing && status ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
              <span>{isProcessing ? 'Procesando...' : 'Generar'}</span>
            </button>
          </div>
        ))}
      </div>
      {status && <p className="mt-4 text-center text-xs font-bold text-blue-600 animate-pulse">{status}</p>}
    </div>
  );
};

export default FormManager;
