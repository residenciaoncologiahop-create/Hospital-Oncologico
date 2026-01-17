import React, { useState } from 'react';
import { FileText, Loader2, Wand2, Map, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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

  const generateFieldMap = async (formDef: any) => {
    setProcessingId('map-' + formDef.id);
    setStatus('Generando mapa rojo...');
    try {
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error("Archivo no encontrado");
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      fields.forEach(field => {
        if (field.constructor.name === 'PDFTextField') {
            const textField = form.getTextField(field.getName());
            textField.setText(field.getName()); 
            textField.setFontSize(10);
            textField.setFont(helveticaFont);
            textField.setTextColor(rgb(1, 0, 0));
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `MAPA_ROJO_${formDef.name}.pdf`;
      link.click();
      alert("✅ Mapa descargado. Use los códigos en rojo para decirme dónde poner los datos faltantes.");
      
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // --- PROMPT EXPANDIDO CON NUEVOS CAMPOS PAMI ---
    const parts: any[] = [
      { text: `
        Analiza la historia clínica y extrae datos EXHAUSTIVOS para formulario oncológico PAMI.
        
        Datos requeridos (JSON):
        {
          "paciente_nombre_real": "Nombre completo",
          "paciente_dni": "DNI sin puntos",
          "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Diagnóstico CIE-10",
          "peso": "Solo número (kg)",
          "talla": "Solo número (cm)",
          "ecog": "0, 1, 2, 3 o 4 (Solo el número)",
          "estadio_actual": "Estadio TNM actual (ej: IV)",
          "estadio_inicial": "Estadio al diagnóstico",
          "fecha_diagnostico": "Fecha del diagnóstico inicial",
          "linea_tratamiento": "1ra, 2da, Adyuvancia, etc",
          "informe_clinico": "Breve resumen (máx 150 caracteres) de la evolución actual y justificación",
          "droga_1": "Droga principal",
          "dosis_1": "Dosis completa",
          "droga_2": "Segunda droga",
          "dosis_2": "Dosis segunda droga",
          "ciclos": "Esquema/Ciclos (ej: Cada 21 días)"
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
        alert("⚠️ Falta documentación. Suba la Historia Clínica primero.");
        return;
    }

    setProcessingId(formDef.id);
    setStatus('Extrayendo datos clínicos...');

    try {
      const aiData = await extractDataWithAI();
      const bsa = calculateBSA(aiData.peso, aiData.talla);
      const finalName = aiData.paciente_nombre_real || patient.name;

      // DEBUG: Verificamos qué trae la IA para los nuevos campos
      console.log("Datos IA:", aiData);

      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      const set = (name: string, val: string) => {
        try { 
            const f = form.getTextField(name); 
            if (val) f.setText(String(val)); 
        } catch (e) {}
      };

      if (formDef.id === 'pami') {
        // --- MAPEO COMPLETO PAMI ---
        set('Apellido y Nombre', finalName);
        set('Beneficiario Nº', aiData.paciente_dni);
        set('beneficiario Nro', aiData.paciente_dni);
        set('Fecha de nacimiento', aiData.paciente_fnac);
        
        // Diagnóstico
        set('Diagnóstico (CIE 10)', aiData.diagnostico_cie10);
        set('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        
        // Datos Antropométricos
        set('Peso', aiData.peso);
        set('Talla', aiData.talla);
        set('Sup. Corporal', bsa);
        set('Sup Corpora', bsa);
        
        // Estado Clínico y Tratamiento (LOS NUEVOS CAMPOS)
        set('ECOG Performance Status (0-4)', aiData.ecog);
        set('ECOG', aiData.ecog);
        
        set('Estadío actual', aiData.estadio_actual);
        set('Estadio actual', aiData.estadio_actual);
        
        set('Estadio Inicial', aiData.estadio_inicial);
        
        set('Fecha de Diagnóstico Inicial', aiData.fecha_diagnostico);
        set('Fecha diagnostico inicial', aiData.fecha_diagnostico);
        
        set('Línea de tratamiento', aiData.linea_tratamiento);
        
        set('Informe clínico actual', aiData.informe_clinico);
        set('Informe Clínico Actual', aiData.informe_clinico);
        
        // Drogas y Ciclos
        set('Ciclos', aiData.ciclos); // Campo suelto arriba
        set('N CiclosDuración díasRow1', aiData.ciclos); // Columna en tabla
        
        set('DrogaGenéricoRow1', aiData.droga_1);
        set('DosisRow1', aiData.dosis_1);
        
        if (aiData.droga_2) {
            set('DrogaGenéricoRow2', aiData.droga_2);
            set('DosisRow2', aiData.dosis_2);
            set('N CiclosDuración díasRow2', aiData.ciclos);
        }
      } 
      else if (formDef.id === 'admision') {
        // Mapeo Provisorio Admisión (Requiere Mapa Rojo para ser exacto)
        set('Text1', finalName);
        set('Text3', aiData.paciente_fnac);
        set('Text4', aiData.paciente_dni);
        set('Text14', aiData.diagnostico_cie10);
        set('Text20', aiData.peso);
        set('Text19', bsa);
        set('Text92', aiData.droga_1);
        // Intentamos llenar ECOG también aquí por si coincide
        set('Text197', aiData.ecog); // A veces ECOG tiene ID alto
      }
      else if (formDef.id === 'renovacion') {
        set('Text1', finalName);
        set('Text4', aiData.paciente_dni);
        set('Text12', aiData.diagnostico_cie10);
        set('Text40', aiData.peso);
        set('Text82', aiData.droga_1);
      }
      else {
        // DINADIC
        const fields = form.getFields();
        fields.forEach(field => {
            if (field.constructor.name === 'PDFTextField') {
                const name = field.getName().toLowerCase();
                const textField = form.getTextField(field.getName());
                if (name.includes('nombre') || name.includes('paciente')) textField.setText(finalName);
                else if (name.includes('dni') || name.includes('doc')) textField.setText(aiData.paciente_dni);
                else if (name.includes('diag')) textField.setText(aiData.diagnostico_cie10);
                else if (name.includes('ecog')) textField.setText(aiData.ecog);
                else if (name.includes('peso')) textField.setText(aiData.peso);
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
      
      {(!files || files.length === 0) && !historyText && (
        <div className="mb-6 p-3 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={16} />
            <p className="text-[10px] text-orange-700 font-bold">
                Cargue la Historia Clínica en "Documentación" para habilitar el autocompletado.
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
            
            <div className="flex gap-2">
                <button 
                  onClick={() => fillAndDownloadPDF(form)}
                  disabled={processingId !== null}
                  className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                    ${processingId === form.id ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
                >
                  {processingId === form.id && !processingId.startsWith('map-') ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                  <span>Generar</span>
                </button>
                
                <button 
                  onClick={() => generateFieldMap(form)}
                  disabled={processingId !== null}
                  className="flex items-center justify-center px-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50 border border-purple-100"
                  title="Ver mapa de campos (Texto Rojo)"
                >
                  <Map size={14} />
                </button>
            </div>
          </div>
        ))}
      </div>

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}
    </div>
  );
};

export default FormManager;
