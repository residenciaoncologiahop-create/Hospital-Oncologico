import React, { useState } from 'react';
import { FileText, Loader2, Wand2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI } from "@google/genai";

interface FormManagerProps {
  patient: any;
  historyText: string;
  files: any[];
}

const FormManager: React.FC<FormManagerProps> = ({ patient, historyText, files }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/banco_drogas.pdf' },
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf' },
  ];

  const calculateBSA = (weight: string, height: string) => {
    const w = parseFloat(weight?.toString().replace(',', '.'));
    const h = parseFloat(height?.toString().replace(',', '.'));
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return Math.sqrt((w * h) / 3600).toFixed(2);
    }
    return '';
  };

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Prompt optimizado
    const parts: any[] = [
      { text: `
        Analiza la historia clínica y extrae datos para formularios oncológicos.
        
        SI ALGUN DATO NO ESTÁ EXPLICITO, DEDÚCELO DEL CONTEXTO (Ej: Si dice "Ciclo 1 de Pembrolizumab 200mg", la droga es Pembrolizumab y dosis 200mg).
        
        Datos requeridos (JSON):
        {
          "paciente_nombre_real": "Nombre completo encontrado",
          "paciente_dni": "DNI sin puntos",
          "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Diagnóstico completo",
          "peso": "Solo número (kg)",
          "talla": "Solo número (cm)",
          "ecog": "0, 1, 2, 3 o 4",
          "droga_1": "Droga principal",
          "dosis_1": "Dosis completa",
          "droga_2": "Segunda droga",
          "dosis_2": "Dosis segunda droga",
          "ciclos": "Detalle de ciclos (ej: cada 21 días)"
        }
        CONTEXTO ADICIONAL: ${historyText}
      `}
    ];

    if (files && files.length > 0) {
        files.forEach(f => {
            parts.push({ inlineData: { mimeType: f.type, data: f.data } });
        });
    }

    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts }
    });

    const text = res.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  };

  const fillAndDownloadPDF = async (formDef: any) => {
    if ((!files || files.length === 0) && !historyText) {
        alert("⚠️ No hay documentación. Suba la Historia Clínica en 'Documentación' primero.");
        return;
    }

    setProcessingId(formDef.id);
    setStatus('Analizando datos...');

    try {
      const aiData = await extractDataWithAI();
      const bsa = calculateBSA(aiData.peso, aiData.talla);
      
      // Priorizar nombre del PDF, si no el del sistema
      const finalName = aiData.paciente_nombre_real && aiData.paciente_nombre_real.length > 5 
                        ? aiData.paciente_nombre_real 
                        : patient.name;

      // DEBUG: Muestra qué encontró la IA (útil si sale vacío)
      console.log("Datos IA:", aiData); 

      setStatus('Generando PDF...');
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      // Función segura para llenar
      const set = (name: string, val: string) => {
        try { 
            const f = form.getTextField(name); 
            // Convertimos a string por seguridad
            if (val) f.setText(String(val)); 
        } catch (e) { /* Campo no existe en este PDF */ }
      };

      // --- MAPEO DE CAMPOS ---

      if (formDef.id === 'pami') {
        // PAMI (Mapeo por Nombre Exacto)
        set('Apellido y Nombre', finalName);
        set('Beneficiario Nº', aiData.paciente_dni);
        set('beneficiario Nro', aiData.paciente_dni);
        set('Fecha de nacimiento', aiData.paciente_fnac);
        set('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        set('Diagnóstico (CIE 10)', aiData.diagnostico_cie10);
        set('Peso', aiData.peso);
        set('Talla', aiData.talla);
        set('Sup. Corporal', bsa);
        set('Sup Corpora', bsa);
        set('ECOG Performance Status (0-4)', aiData.ecog);
        set('ECOG', aiData.ecog);
        set('DrogaGenéricoRow1', aiData.droga_1);
        set('DosisRow1', aiData.dosis_1);
        set('N CiclosDuración díasRow1', aiData.ciclos);
        if(aiData.droga_2) {
             set('DrogaGenéricoRow2', aiData.droga_2);
             set('DosisRow2', aiData.dosis_2);
        }
      } 
      else if (formDef.id === 'admision') {
        // ADMISIÓN (Mapeo Secuencial Estimado)
        // Basado en el orden visual del formulario oficial
        set('Text1', finalName);        // 1. Nombre
        set('Text3', aiData.paciente_fnac);  // 3. Fecha Nac
        set('Text4', aiData.paciente_dni);   // 4. DNI
        set('Text14', aiData.diagnostico_cie10); // 14. Diagnóstico
        set('Text15', aiData.diagnostico_cie10); // 15. CIE10
        set('Text19', bsa);             // 19. Sup Corporal
        set('Text20', aiData.peso);     // 20. Peso
        set('Text21', aiData.talla);    // 21. Talla
        set('Text100', aiData.droga_1); // Zona de Drogas (aprox Text90-100)
        set('Text101', aiData.dosis_1); 
        // Intento extra por si la tabla está antes
        set('Text92', aiData.droga_1);
        set('Text93', aiData.dosis_1);
      }
      else if (formDef.id === 'renovacion') {
        // RENOVACIÓN (Mapeo Secuencial Estimado)
        set('Text1', finalName);       // 1. Nombre
        set('Text2', aiData.paciente_dni); // A veces DNI es el 2do o 4to
        set('Text4', aiData.paciente_dni); 
        set('Text3', aiData.paciente_fnac);
        set('Text12', aiData.diagnostico_cie10); // Diagnóstico
        set('Text39', bsa);
        set('Text40', aiData.peso);
        set('Text41', aiData.talla);
        set('Text82', aiData.droga_1); // Zona Drogas
        set('Text83', aiData.dosis_1);
      }
      else {
        // DINADIC / GENÉRICO (Búsqueda inteligente)
        const fields = form.getFields();
        fields.forEach(field => {
            if (field.constructor.name === 'PDFTextField') {
                const name = field.getName().toLowerCase();
                const textField = form.getTextField(field.getName());
                
                if (name.includes('nombre') || name.includes('paciente')) textField.setText(finalName);
                else if (name.includes('dni') || name.includes('doc')) textField.setText(aiData.paciente_dni);
                else if (name.includes('nacimiento') || name.includes('nac')) textField.setText(aiData.paciente_fnac);
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
      link.download = `${formDef.name}_${finalName}.pdf`;
      link.click();
      setStatus('¡Completado!');

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
      
      {(!files || files.length === 0) && !historyText && (
        <div className="mb-6 p-3 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={16} />
            <p className="text-[10px] text-orange-700 font-bold">
                ⚠️ Aviso: La IA necesita la Historia Clínica (PDF) en "Documentación" para llenar los datos.
            </p>
        </div>
      )}

      <div className="grid gap-4">
        {forms.map(form => (
          <div key={form.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-300 transition-all shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={20} /></div>
                    <h4 className="font-bold text-gray-800 text-xs uppercase">{form.name}</h4>
                </div>
                {processingId === form.id ? <Loader2 className="animate-spin text-blue-600" size={18}/> : <CheckCircle2 className="text-gray-200" size={18}/>}
            </div>
            
            <button 
              onClick={() => fillAndDownloadPDF(form)}
              disabled={processingId !== null}
              className={`w-full flex items-center justify-center space-x-2 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                ${processingId === form.id ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
            >
              <Wand2 size={14}/>
              <span>{processingId === form.id ? 'Procesando...' : 'Generar PDF'}</span>
            </button>
          </div>
        ))}
      </div>

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}
    </div>
  );
};

export default FormManager;
