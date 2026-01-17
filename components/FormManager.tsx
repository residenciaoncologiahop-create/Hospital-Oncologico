import React, { useState, useEffect } from 'react';
// CORRECCIÓN: Agregamos CheckCircle2 a los imports
import { FileText, Loader2, Wand2, Map, AlertTriangle, UserCog, Save, X, CheckCircle2 } from 'lucide-react';
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
  
  // ESTADO PARA DATOS DEL MÉDICO
  const [showDocConfig, setShowDocConfig] = useState(false);
  const [doctorData, setDoctorData] = useState({
    nombre: '',
    matricula: '',
    especialidad: 'Oncología Clínica',
    email: '',
    celular: ''
  });

  // Cargar datos del médico al inicio
  useEffect(() => {
    const savedDoc = localStorage.getItem('doctor_data_profile');
    if (savedDoc) setDoctorData(JSON.parse(savedDoc));
  }, []);

  const saveDoctorData = () => {
    localStorage.setItem('doctor_data_profile', JSON.stringify(doctorData));
    setShowDocConfig(false);
    alert("Datos del profesional guardados.");
  };

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

  // --- MAPEO DE DEPURACIÓN ---
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
    
    const parts: any[] = [
      { text: `
        Actúa como un ONCÓLOGO completando una planilla oficial (PAMI).
        Analiza la historia clínica adjunta.
        
        INSTRUCCIONES CLAVE:
        1. **Ciclos:** Indica la INTENCIÓN de tratamiento (ej: "Hasta progresión", "Hasta toxicidad", "6 ciclos planeados"). NO pongas cuántos hizo.
        2. **Laboratorio:** Incluye la FECHA del laboratorio (ej: "Hb 12 - (15/01/24)").
        3. **Celular/Nacimiento:** Busca exhaustivamente en encabezados de los PDF o datos demográficos.
        4. **Estadios:** Diferencia claramente estadio INICIAL (al diagnóstico) vs ACTUAL.
        
        Extrae este JSON exacto:
        {
          "paciente_nombre_real": "Nombre completo",
          "paciente_dni": "DNI",
          "paciente_celular": "Celular encontrado",
          "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Diagnóstico completo + Código CIE10",
          "histopatologico": "Resumen histopatológico",
          "peso": "kg (número)",
          "talla": "cm (número)",
          "ecog": "0, 1, 2, 3 o 4",
          "estadio_inicial": "Estadio al debut (ej: IIB)",
          "estadio_actual": "Estadio actual (ej: IV)",
          "fecha_diagnostico_inicial": "Fecha del primer diagnóstico",
          "linea_tratamiento": "1ra, 2da, Adyuvancia...",
          "antecedentes_qx": "Cirugías previas",
          "antecedentes_radio": "RT previa",
          "laboratorio": "Datos laboratorio CON FECHA",
          "informe_clinico_detallado": "Resumen cronológico: Diagnóstico (fecha), cirugías, evolución y justificación actual.",
          "motivo_solicitud": "Inicio, Renovación, Cambio de Toxicidad, o Cambio por Progresión",
          "tipo_tratamiento": "Adyuvante, Neoadyuvante, o Avanzado",
          "ciclos_planeados": "Plan de ciclos (ej: Hasta progresión)",
          "frecuencia_dias": "Esquema de días (ej: Día 1 cada 21 días)",
          "droga_1": "Nombre droga",
          "presentacion_1": "Presentación (ej: Amp 100mg)",
          "dosis_1": "Dosis exacta calculada",
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
        alert("⚠️ Suba la Historia Clínica primero.");
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
        try { if (shouldCheck) form.getCheckBox(name).check(); } catch (e) {}
      };

      // --- PAMI ---
      if (formDef.id === 'pami') {
        // PAGINA 1: DATOS PACIENTE Y CLÍNICOS
        setText('Apellido y Nombre', finalName);
        setText('Beneficiario Nº', ''); // Vacío a pedido
        setText('Celular', aiData.paciente_celular);
        setText('Fecha de nacimiento', aiData.paciente_fnac);

        setText('Diagnóstico (CIE 10)', aiData.diagnostico_cie10);
        setText('Diagnóstico CIE 10', aiData.diagnostico_cie10);
        setText('Histopatológico', aiData.histopatologico);
        
        // Estado y Estadios
        setText('ECOG Performance Status (0-4)', aiData.ecog);
        setText('ECOG', aiData.ecog);
        setText('Estadío actual', aiData.estadio_actual);
        setText('Estadio actual', aiData.estadio_actual);
        setText('Estadio Inicial', aiData.estadio_inicial);
        setText('Fecha de Diagnóstico Inicial', aiData.fecha_diagnostico_inicial);
        setText('Fecha diagnostico inicial', aiData.fecha_diagnostico_inicial);
        
        setText('Línea de tratamiento', aiData.linea_tratamiento);
        
        // Motivo Checkboxes
        if (aiData.motivo_solicitud?.toLowerCase().includes('inicio')) setCheck('Inicio', true);
        if (aiData.motivo_solicitud?.toLowerCase().includes('renovac')) setCheck('Renovación', true);
        if (aiData.motivo_solicitud?.toLowerCase().includes('toxicidad')) setCheck('Cambio de Toxicidad', true);
        if (aiData.motivo_solicitud?.toLowerCase().includes('progresi')) setCheck('Cambio por Progresión', true);

        // Ciclos y Días
        setText('Ciclos', aiData.ciclos_planeados);
        setText('Días', aiData.frecuencia_dias);

        setText('Antecedentes Quirúrgicos', aiData.antecedentes_qx);
        setText('Antecedentes Terapia Radiante', aiData.antecedentes_radio);
        
        // Informe e Labs
        setText('Informe Clínico ActualRow1', aiData.informe_clinico_detallado); 
        setText('Datos positivos Laboratorio', aiData.laboratorio);
        
        // Antropometría
        setText('Peso', aiData.peso);
        setText('Talla', aiData.talla);
        setText('Sup. Corporal', bsa);
        setText('Sup Corpora', bsa);

        // Tratamiento Checkboxes
        if (aiData.tipo_tratamiento?.toLowerCase().includes('adyuvante') && !aiData.tipo_tratamiento.includes('neo')) setCheck('Neoadyuvante', true);
        if (aiData.tipo_tratamiento?.toLowerCase().includes('avanzado')) setCheck('Avanzado', true);

        // Tabla Drogas
        setText('DrogaGenéricoRow1', aiData.droga_1);
        setText('PresentaciónRow1', aiData.presentacion_1);
        setText('DosisRow1', aiData.dosis_1);
        setText('N CiclosDuración díasRow1', aiData.frecuencia_dias); 
        
        if (aiData.droga_2) {
            setText('DrogaGenéricoRow2', aiData.droga_2);
            setText('PresentaciónRow2', aiData.presentacion_2);
            setText('DosisRow2', aiData.dosis_2);
            setText('N CiclosDuración díasRow2', aiData.frecuencia_dias);
        }

        // PAGINA 2: DATOS DEL MÉDICO (AUTOMÁTICO)
        setText('Apellido y Nombre_2', doctorData.nombre);
        setText('Matricula', doctorData.matricula);
        setText('Especialidad', doctorData.especialidad);
        setText('Email_2', doctorData.email);
        setText('Celular_2', doctorData.celular); // A veces es Celular1 o Celular2 en PAMI
        setText('Celular1', doctorData.celular);
        setText('Lugar y fecha', new Date().toLocaleDateString('es-AR'));
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
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">Gestión de Trámites</h3>
        <button 
          onClick={() => setShowDocConfig(true)}
          className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors text-[10px] font-bold uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-lg"
        >
          <UserCog size={14} /><span>Configurar Médico</span>
        </button>
      </div>

      {/* MODAL CONFIGURACIÓN MÉDICO */}
      {showDocConfig && (
        <div className="mb-6 p-5 bg-blue-50 border border-blue-100 rounded-2xl animate-in slide-in-from-top">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-blue-800 text-xs uppercase tracking-widest">Datos del Profesional</h4>
            <button onClick={() => setShowDocConfig(false)} className="text-blue-400 hover:text-blue-600"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Apellido y Nombre</label>
              <input className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold" value={doctorData.nombre} onChange={e => setDoctorData({...doctorData, nombre: e.target.value})} placeholder="Dr. Juan Pérez" />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Matrícula</label>
              <input className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold" value={doctorData.matricula} onChange={e => setDoctorData({...doctorData, matricula: e.target.value})} placeholder="MN 12345" />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Especialidad</label>
              <input className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold" value={doctorData.especialidad} onChange={e => setDoctorData({...doctorData, especialidad: e.target.value})} />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Email</label>
              <input className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold" value={doctorData.email} onChange={e => setDoctorData({...doctorData, email: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Celular (Para Recetas)</label>
              <input className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold" value={doctorData.celular} onChange={e => setDoctorData({...doctorData, celular: e.target.value})} placeholder="11-1234-5678" />
            </div>
          </div>
          <button onClick={saveDoctorData} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center justify-center space-x-2">
            <Save size={14}/><span>Guardar Datos</span>
          </button>
        </div>
      )}
      
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
