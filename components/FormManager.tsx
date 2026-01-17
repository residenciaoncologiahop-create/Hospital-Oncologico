import React, { useState } from 'react';
import { FileText, Loader2, Wand2, Map, AlertCircle, AlertTriangle } from 'lucide-react';
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
    const w = parseFloat(weight?.replace(',', '.'));
    const h = parseFloat(height?.replace(',', '.'));
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return Math.sqrt((w * h) / 3600).toFixed(2);
    }
    return '';
  };

  // --- HERRAMIENTA DE MAPEO (NUEVA) ---
  const generateFieldMap = async (formDef: any) => {
    setProcessingId('map-' + formDef.id);
    setStatus('Generando mapa de campos...');
    try {
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error("Archivo no encontrado");
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      // En cada campo, escribimos su propio nombre
      fields.forEach(field => {
        if (field.constructor.name === 'PDFTextField') {
            const textField = form.getTextField(field.getName());
            textField.setText(field.getName()); // Ej: El campo se llenará con el texto "Text1"
            textField.setFontSize(8); // Letra chica para que entre
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `MAPA_CAMPOS_${formDef.name}.pdf`;
      link.click();
      alert("✅ Mapa descargado. Abra el PDF y anote qué código (TextX) cae en cada casillero (DNI, Peso, etc) para enviármelo.");
      
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Prompt optimizado para encontrar datos dispersos
    const parts: any[] = [
      { text: `
        Analiza EXHAUSTIVAMENTE la historia clínica (archivos y texto).
        Busca datos específicos para formulario de solicitud de drogas.
        
        SI NO ENCUENTRAS UN DATO EXACTO, DEDÚCELO DEL CONTEXTO SI ES SEGURO.
        
        Datos requeridos (JSON):
        {
          "paciente_nombre_real": "Nombre completo en el PDF",
          "paciente_dni": "Buscar DNI o 'NHC' en encabezados",
          "paciente_fnac": "Fecha nacimiento (DD/MM/AAAA)",
          "diagnostico_cie10": "Diagnóstico principal completo",
          "peso": "Último peso registrado (solo número)",
          "talla": "Talla en cm (solo número)",
          "ecog": "ECOG / PS (0-4)",
          "droga_1": "Droga principal solicitada",
          "dosis_1": "Dosis completa",
          "droga_2": "Segunda droga (si hay)",
          "dosis_2": "Dosis segunda droga",
          "ciclos": "Esquema/Ciclos (ej: cada 21 días)"
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
        alert("⚠️ Falta documentación. Suba el PDF de la Historia Clínica primero.");
        return;
    }

    setProcessingId(formDef.id);
    setStatus('Extrayendo datos...');

    try {
      const aiData = await extractDataWithAI();
      
      // DEBUG: Muestra al usuario qué encontró la IA para verificar si lee bien
      alert(`Datos extraídos por IA:\nNombre: ${aiData.paciente_nombre_real}\nDNI: ${aiData.paciente_dni}\nDx: ${aiData.diagnostico_cie10}\nPeso: ${aiData.peso}\nDroga: ${aiData.droga_1}\n\nSi faltan datos aquí, la IA no los encontró en el archivo.`);

      const bsa = calculateBSA(aiData.peso, aiData.talla);
      const finalName = aiData.paciente_nombre_real || patient.name;

      setStatus('Generando PDF...');
      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      // Función segura para llenar campos
      const set = (name: string, val: string) => {
        try { 
            const f = form.getTextField(name); 
            if (val) f.setText(String(val)); 
        } catch (e) {}
      };

      // --- MAPEO POR TIPO DE FORMULARIO ---

      if (formDef.id === 'pami') {
        // CORRECCIONES APLICADAS SEGÚN TU LISTA
        set('Apellido y Nombre', finalName);
        set('Beneficiario Nº', aiData.paciente_dni); 
        set('beneficiario Nro', aiData.paciente_dni); // Alternativa
        set('Fecha de nacimiento', aiData.paciente_fnac);
        set('Diagnóstico (CIE 10)', aiData.diagnostico_cie10); // Corregido nombre exacto
        set('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        
        set('Peso', aiData.peso);
        set('Talla', aiData.talla);
        set('Sup Corpora', bsa); // Corregido (antes Sup. Corporal)
        set('ECOG Performance Status (0-4)', aiData.ecog);
        
        set('Droga/Genérico', aiData.droga_1); // Probamos nombre de columna
        set('DrogaGenéricoRow1', aiData.droga_1); // Nombre interno fila 1
        set('DosisRow1', aiData.dosis_1);
        set('N CiclosDuración díasRow1', aiData.ciclos);
      } 
      else if (formDef.id === 'admision') {
        // MAPEO TENTATIVO (Necesitamos el Mapa para hacerlo perfecto)
        set('Text1', finalName);       
        set('Text3', aiData.paciente_fnac); 
        set('Text4', aiData.paciente_dni);  
        set('Text14', aiData.diagnostico_cie10);
        // Intentamos llenar diagnóstico en varios Text por si acaso
        set('Text10', aiData.diagnostico_cie10);
        set('Text92', aiData.droga_1); // Drogas suelen estar al final (Text90+)
      }
      else {
        // Lógica genérica por coincidencia de nombre (DINADIC / RENOVACION)
        const fields = form.getFields();
        fields.forEach(field => {
            if (field.constructor.name === 'PDFTextField') {
                const name = field.getName().toLowerCase();
                const textField = form.getTextField(field.getName());
                
                if (name.includes('nombre') || name.includes('paciente')) textField.setText(finalName);
                else if (name.includes('dni') || name.includes('doc')) textField.setText(aiData.paciente_dni);
                else if (name.includes('nacimiento')) textField.setText(aiData.paciente_fnac);
                else if (name.includes('diag')) textField.setText(aiData.diagnostico_cie10);
                else if (name.includes('peso')) textField.setText(aiData.peso);
                else if (name.includes('talla')) textField.setText(aiData.talla);
                else if (name.includes('sup') && name.includes('corp')) textField.setText(bsa);
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
                ⚠️ No hay datos cargados. Suba el PDF de la historia en "Documentación".
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
                  {processingId === form.id && !processingId.startsWith('map-') ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                  <span>{processingId === form.id && !processingId.startsWith('map-') ? 'Procesando' : 'Generar'}</span>
                </button>
                
                {/* BOTÓN DE MAPEO NUEVO */}
                <button 
                  onClick={() => generateFieldMap(form)}
                  disabled={processingId !== null}
                  className="flex items-center justify-center px-4 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50 border border-purple-100"
                  title="Descargar mapa de campos (Ver nombres internos)"
                >
                  {processingId === 'map-' + form.id ? <Loader2 className="animate-spin" size={14}/> : <Map size={14} />}
                  <span className="ml-1 text-[9px] font-bold">MAPA</span>
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
