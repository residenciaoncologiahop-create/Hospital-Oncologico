import React, { useState } from 'react';
import { FileText, Loader2, Wand2, Map, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
    setStatus('Generando mapa...');
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
        const name = field.getName();
        if (field.constructor.name === 'PDFTextField') {
            const textField = form.getTextField(name);
            textField.setText(name); 
            textField.setFontSize(8);
            textField.setFont(helveticaFont);
            textField.setTextColor(rgb(1, 0, 0));
        } else if (field.constructor.name === 'PDFCheckBox') {
            try { form.getCheckBox(name).check(); } catch(e){}
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `MAPA_ROJO_${formDef.name}.pdf`;
      link.click();
      alert("✅ Mapa descargado.");
      
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  const extractDataWithAI = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // --- PROMPT MEJORADO Y DETALLADO ---
    const parts: any[] = [
      { text: `
        Actúa como un ONCÓLOGO completando una planilla de solicitud de quimioterapia (PAMI).
        Analiza la historia clínica adjunta y extrae los datos con precisión técnica.
        
        INSTRUCCIONES ESPECÍFICAS PARA CAMPOS CLAVE:
        1. "ciclos_realizados": Indica CUÁNTOS ciclos de la droga solicitada YA realizó el paciente. Si es inicio, pon "0" o "Inicio".
        2. "frecuencia_dias": Indica CADA CUÁNTO se administra (ej: "Día 1 cada 21 días").
        3. "informe_clinico_detallado": Redacta un párrafo técnico que incluya OBLIGATORIAMENTE:
           - Fecha de diagnóstico inicial.
           - Descripción de Anatomía Patológica (tipo histológico).
           - Cirugías realizadas (fechas y procedimientos).
           - Breve evolución y justificación actual.
           (Todo esto en un solo texto fluido).
        4. "dosis_exacta": NO pongas "según protocolo". Calcula o extrae la dosis (ej: "200 mg" o "Paclitaxel 80mg/m2").
        
        Extrae este JSON exacto:
        {
          "paciente_nombre_real": "Nombre completo",
          "paciente_dni": "DNI",
          "paciente_celular": "Celular de contacto",
          "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Diagnóstico completo + Código CIE10",
          "histopatologico": "Resumen histopatológico corto",
          "peso": "kg (número)",
          "talla": "cm (número)",
          "ecog": "0, 1, 2, 3 o 4",
          "estadio_inicial": "Estadio al debut (ej: IIB)",
          "estadio_actual": "Estadio actual (ej: IV)",
          "linea_tratamiento": "1ra, 2da, Adyuvancia...",
          "antecedentes_qx": "Cirugías previas",
          "antecedentes_radio": "RT previa",
          "laboratorio": "Datos laboratorio relevantes (Hb, Plaq, Neutro, Clearance)",
          "informe_clinico_detallado": "Texto detallado según instrucciones arriba",
          "motivo_solicitud": "Inicio, Renovación, Cambio de Toxicidad, o Cambio por Progresión",
          "tipo_tratamiento": "Adyuvante, Neoadyuvante, o Avanzado",
          "ciclos_realizados": "Cantidad de ciclos previos",
          "frecuencia_dias": "Esquema de días (ej: D1 c/21 días)",
          "droga_1": "Nombre droga",
          "presentacion_1": "Presentación (ej: Amp 100mg)",
          "dosis_1": "Dosis exacta",
          "droga_2": "Segunda droga",
          "presentacion_2": "Presentación",
          "dosis_2": "Dosis exacta"
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
    setStatus('Procesando datos médicos...');

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

      const setText = (name: string, val: string) => {
        try { 
            const f = form.getTextField(name); 
            if (val) f.setText(String(val)); 
        } catch (e) {}
      };

      const setCheck = (name: string, shouldCheck: boolean) => {
        try {
            if (shouldCheck) form.getCheckBox(name).check();
        } catch (e) {}
      };

      // --- PAMI ---
      if (formDef.id === 'pami') {
        // Datos Afiliado
        setText('Apellido y Nombre', finalName);
        setText('Beneficiario Nº', ''); // Vacío por pedido
        setText('Celular', aiData.paciente_celular);
        setText('Fecha de nacimiento', aiData.paciente_fnac);

        // Diagnóstico y Estado
        setText('Diagnóstico (CIE 10)', aiData.diagnostico_cie10);
        setText('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        setText('Histopatológico', aiData.histopatologico);
        
        setText('ECOG Performance Status (0-4)', aiData.ecog);
        setText('ECOG', aiData.ecog);
        setText('Estadío actual', aiData.estadio_actual);
        setText('Estadio actual', aiData.estadio_actual);
        setText('Estadio Inicial', aiData.estadio_inicial);
        
        setText('Línea de tratamiento', aiData.linea_tratamiento);
        
        // Motivo (Checkboxes)
        if (aiData.motivo_solicitud?.toLowerCase().includes('inicio')) setCheck('Inicio', true);
        if (aiData.motivo_solicitud?.toLowerCase().includes('renovac')) setCheck('Renovación', true);
        if (aiData.motivo_solicitud?.toLowerCase().includes('toxicidad')) setCheck('Cambio de Toxicidad', true);
        if (aiData.motivo_solicitud?.toLowerCase().includes('progresi')) setCheck('Cambio por Progresión', true);

        // Ciclos y Días (Sección superior)
        setText('Ciclos', aiData.ciclos_realizados);
        setText('Días', aiData.frecuencia_dias);

        setText('Antecedentes Quirúrgicos', aiData.antecedentes_qx);
        setText('Antecedentes Terapia Radiante', aiData.antecedentes_radio);
        
        // INFORME CLÍNICO DETALLADO (En celda grande Row1)
        setText('Informe Clínico ActualRow1', aiData.informe_clinico_detallado); 
        setText('Datos positivos Laboratorio', aiData.laboratorio);
        
        // Antropometría
        setText('Peso', aiData.peso);
        setText('Talla', aiData.talla);
        setText('Sup. Corporal', bsa);
        setText('Sup Corpora', bsa);

        // Tratamiento (Checkboxes)
        if (aiData.tipo_tratamiento?.toLowerCase().includes('adyuvante') && !aiData.tipo_tratamiento.includes('neo')) setCheck('Adyuvante', true);
        if (aiData.tipo_tratamiento?.toLowerCase().includes('neoadyuvante')) setCheck('Neoadyuvante', true);
        if (aiData.tipo_tratamiento?.toLowerCase().includes('avanzado')) setCheck('Avanzado', true);

        // Tabla de Drogas
        setText('DrogaGenéricoRow1', aiData.droga_1);
        setText('PresentaciónRow1', aiData.presentacion_1);
        setText('DosisRow1', aiData.dosis_1);
        // Aquí en la tabla suele ir el esquema de ciclos también
        setText('N CiclosDuración díasRow1', aiData.frecuencia_dias); 
        
        if (aiData.droga_2) {
            setText('DrogaGenéricoRow2', aiData.droga_2);
            setText('PresentaciónRow2', aiData.presentacion_2);
            setText('DosisRow2', aiData.dosis_2);
            setText('N CiclosDuración díasRow2', aiData.frecuencia_dias);
        }
      } 
      // --- ADMISIÓN ---
      else if (formDef.id === 'admision') {
        setText('Text1', finalName);
        setText('Text3', aiData.paciente_fnac);
        setText('Text4', aiData.paciente_dni);
        setText('Text14', aiData.diagnostico_cie10);
        setText('Text20', aiData.peso);
        setText('Text21', aiData.talla);
        setText('Text19', bsa);
        setText('Text92', aiData.droga_1);
      }
      // --- RENOVACIÓN ---
      else if (formDef.id === 'renovacion') {
        setText('Text1', finalName);
        setText('Text4', aiData.paciente_dni);
        setText('Text12', aiData.diagnostico_cie10);
        setText('Text40', aiData.peso);
        setText('Text82', aiData.droga_1);
      }
      // --- DINADIC ---
      else {
        const fields = form.getFields();
        fields.forEach(field => {
            if (field.constructor.name === 'PDFTextField') {
                const name = field.getName().toLowerCase();
                const textField = form.getTextField(field.getName());
                if (name.includes('nombre') || name.includes('paciente')) textField.setText(finalName);
                else if (name.includes('dni') || name.includes('doc')) textField.setText(aiData.paciente_dni);
                else if (name.includes('diag')) textField.setText(aiData.diagnostico_cie10);
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
                  title="Mapa Rojo (Depuración)"
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
