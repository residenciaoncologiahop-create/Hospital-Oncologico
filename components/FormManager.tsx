import React, { useState } from 'react';
import { FileText, Loader2, Wand2, Search, AlertCircle, AlertTriangle } from 'lucide-react';
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
  const [debugFields, setDebugFields] = useState<string[]>([]);

  // NOTA: Asegúrate de que los archivos en public/forms/ tengan ESTOS NOMBRES EXACTOS:
  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/banco_drogas.pdf' },
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf' },
  ];

  const calculateBSA = (weight: string, height: string) => {
    const w = parseFloat(weight?.replace(',', '.'));
    const h = parseFloat(height?.replace(',', '.'));
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
      const fields = pdfDoc.getForm().getFields().map(f => f.getName());
      
      if (fields.length === 0) alert("⚠️ Este PDF no tiene campos editables (es una imagen).");
      else setDebugFields(fields);
      
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [
      { text: `
        Actúa como data entry médico. Analiza la historia clínica (PDFs adjuntos) y extrae datos para formularios.
        
        PRIORIDAD:
        1. Busca el NOMBRE COMPLETO, DNI y FECHA NACIMIENTO en el encabezado del PDF adjunto.
        2. Busca PESO y TALLA en la evolución más reciente.
        3. Extrae DROGAS y DOSIS del plan actual.
        
        Responde SOLO con este JSON exacto:
        {
          "paciente_nombre_real": "Nombre completo del PDF",
          "paciente_dni": "Solo números",
          "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Diagnóstico y código",
          "peso": "Solo número (kg)",
          "talla": "Solo número (cm)",
          "ecog": "0, 1, 2, 3 o 4",
          "droga_1": "Nombre genérico droga 1",
          "dosis_1": "Dosis (ej: 200mg)",
          "droga_2": "Nombre genérico droga 2",
          "dosis_2": "Dosis droga 2",
          "ciclos": "Número de ciclos (ej: 1 cada 21 días)"
        }
        
        CONTEXTO: ${historyText}
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
        alert("⚠️ Suba la Historia Clínica en 'Documentación' primero.");
        return;
    }

    setProcessingId(formDef.id);
    setStatus('Procesando...');

    try {
      const aiData = await extractDataWithAI();
      const bsa = calculateBSA(aiData.peso, aiData.talla);
      const finalName = aiData.paciente_nombre_real || patient.name;

      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      // Función helper para escribir en un campo si existe
      const set = (name: string, val: string) => {
        try { const f = form.getTextField(name); if (val) f.setText(val); } catch (e) {}
      };

      // --- ESTRATEGIA DE MAPEO POR TIPO DE FORMULARIO ---

      if (formDef.id === 'pami') {
        // Mapeo EXACTO PAMI (Según tu lista)
        set('Apellido y Nombre', finalName);
        set('Beneficiario Nº', aiData.paciente_dni);
        set('beneficiario Nro', aiData.paciente_dni); // Variación detectada
        set('Fecha de nacimiento', aiData.paciente_fnac);
        set('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        set('Peso', aiData.peso);
        set('Talla', aiData.talla);
        set('Sup. Corporal', bsa);
        set('Sup Corpora', bsa); // Variación
        set('ECOG', aiData.ecog);
        set('ECOG Performance Status (0-4)', aiData.ecog);
        
        set('DrogaGenéricoRow1', aiData.droga_1);
        set('DosisRow1', aiData.dosis_1);
        set('N CiclosDuración díasRow1', aiData.ciclos);
        
        if (aiData.droga_2) {
            set('DrogaGenéricoRow2', aiData.droga_2);
            set('DosisRow2', aiData.dosis_2);
            set('N CiclosDuración díasRow2', aiData.ciclos);
        }
      } 
      else if (formDef.id === 'admision') {
        // MAPEO "ADMISION" (Campos Text1, Text2...)
        // Basado en estructura visual estándar:
        set('Text1', finalName);       // Nombre
        set('Text3', aiData.paciente_fnac); // Fecha Nac
        set('Text4', aiData.paciente_dni);  // DNI
        set('Text14', aiData.diagnostico_cie10); // Diagnostico
        set('Text15', aiData.diagnostico_cie10); // CIE10
        set('Text20', aiData.peso);    // Peso
        set('Text21', aiData.talla);   // Talla
        set('Text19', bsa);            // Sup Corporal
        
        // Tabla de drogas (Estimación de inicio de tabla)
        set('Text92', aiData.droga_1);
        set('Text93', aiData.dosis_1);
      }
      else if (formDef.id === 'renovacion') {
        // MAPEO "RENOVACION" (Campos Text1, Text2...)
        set('Text1', finalName);       // Nombre
        set('Text4', aiData.paciente_dni);  // DNI
        set('Text3', aiData.paciente_fnac); // Fecha Nac (A veces es Text2, probamos Text3)
        set('Text12', aiData.diagnostico_cie10); // Diagnóstico
        set('Text13', aiData.diagnostico_cie10); // CIE10
        set('Text39', bsa);            // Sup Corporal
        set('Text40', aiData.peso);    // Peso
        set('Text41', aiData.talla);   // Talla
        
        // Tabla de drogas
        set('Text82', aiData.droga_1); // Estimación
        set('Text83', aiData.dosis_1);
      }
      else {
        // DINADIC (Mapeo Genérico Inteligente)
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
                else if (name.includes('sup') && name.includes('corp')) textField.setText(bsa);
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
      setStatus('¡Descargado!');

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
                ⚠️ Recomendación: Suba el PDF de la historia clínica en la pestaña "Documentación" para completar todos los datos.
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
                  title="Verificar campos internos"
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
                <h4 className="text-xs font-black uppercase text-gray-500">Campos Detectados</h4>
                <button onClick={() => setDebugFields([])} className="text-gray-400 hover:text-gray-600"><AlertCircle size={14}/></button>
            </div>
            <div className="max-h-32 overflow-y-auto font-mono text-[9px] bg-white p-2 rounded border text-gray-600 select-all break-words">
                {debugFields.join(', ')}
            </div>
        </div>
      )}

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}
    </div>
  );
};

export default FormManager;
