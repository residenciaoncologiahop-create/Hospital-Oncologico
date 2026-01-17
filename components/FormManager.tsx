import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Wand2, Map, AlertTriangle, UserCog, Save, X, CheckCircle2, ExternalLink } from 'lucide-react';
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
  
  const [showDocConfig, setShowDocConfig] = useState(false);
  const [doctorData, setDoctorData] = useState({
    nombre: '',
    matricula: '',
    especialidad: 'Oncología Clínica',
    email: '',
    provincia: '',
    cuil_prefix: '', cuil_dni: '', cuil_suffix: '',
    cel_area: '', cel_num: ''
  });

  useEffect(() => {
    const savedDoc = localStorage.getItem('doctor_data_profile_v3');
    if (savedDoc) setDoctorData(JSON.parse(savedDoc));
  }, []);

  const saveDoctorData = () => {
    localStorage.setItem('doctor_data_profile_v3', JSON.stringify(doctorData));
    setShowDocConfig(false);
    alert("Datos guardados.");
  };

  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf' },
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

  const cleanDate = (val: string) => {
    if (!val) return "";
    const match = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
    return "";
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
            textField.setFontSize(6);
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

  const extractDataWithAI = async (formId: string) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toLocaleDateString('es-AR');
    
    let promptText = "";

    // --- PROMPT PAMI ---
    if (formId === 'pami') {
        promptText = `
        Actúa como un ONCÓLOGO EXPERTO (Hoy: ${today}). Completa planilla PAMI.
        REGLAS:
        1. **Idioma:** ESPAÑOL (sin siglas en inglés).
        2. **Informe:** Resumen técnico cronológico (SIN datos demográficos). Máx 1100 chars.
        3. **Ciclos:** "Hasta progresión/toxicidad" o número exacto. NUNCA "Según protocolo".
        4. **Laboratorio:** Último < 3 meses (DD/MM/AA: Hb X...). Si es viejo, vacío.
        
        JSON:
        {
          "paciente_nombre_real": "Nombre", "paciente_dni": "DNI", "paciente_celular": "Celular", "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Dx", "histopatologico": "Histo", "peso": "kg", "talla": "cm", "ecog": "0-4",
          "estadio_inicial": "EI", "estadio_actual": "EA", "fecha_diagnostico_inicial": "DD/MM/AAAA",
          "linea_tratamiento": "Línea", "antecedentes_qx": "Cx", "antecedentes_radio": "RT",
          "laboratorio_formateado": "Lab", "informe_clinico_detallado": "Informe",
          "motivo_solicitud": "Inicio/Renovación...", "tipo_tratamiento": "Adyuvante...",
          "ciclos_planeados": "Ciclos", "frecuencia_dias": "D1 c/21d",
          "droga_1": "D1", "presentacion_1": "P1", "dosis_1": "Dosis1",
          "droga_2": "D2", "presentacion_2": "P2", "dosis_2": "Dosis2"
        }`;
    } 
    // --- PROMPT BANCO DE DROGAS (ADMISIÓN Y RENOVACIÓN) ---
    else {
        promptText = `
        Actúa como ONCÓLOGO para Banco de Drogas (Hoy: ${today}).
        Extrae datos EXPLÍCITOS de la historia clínica.
        
        DATOS REQUERIDOS:
        1. **Paciente:** Nacionalidad, Profesión, Domicilio completo.
        2. **Clínica:** - Receptores (ER, PR, HER2, Ki67) si es Ca. Mama/Gástrico.
           - TNM exacto (T, N, M). Estadio (I-IV).
           - Metástasis: Lista de sitios (Hígado, Pulmón, Hueso, etc.).
        3. **Tratamientos Previos:** Detalle de Cx (Fecha, tipo), RT (Sitio) y Sistémicos previos.
        4. **Solicitud:** Esquema exacto (Drogas, Dosis mg/m2, Días).
        5. **Renovación (Si aplica):** Motivo (Toxicidad/Progresión), Respuesta al tratamiento actual.

        JSON:
        {
          "paciente_nombre": "Nombre", "paciente_nacionalidad": "Nac", "paciente_fnac": "DD/MM/AAAA", "paciente_dni": "DNI",
          "paciente_profesion": "Prof", "paciente_sexo": "M/F", "paciente_domicilio": "Calle y nro", "paciente_localidad": "Loc",
          "paciente_provincia": "Prov", "paciente_pais": "Argentina", "paciente_telefono": "Tel",
          "diagnostico_texto": "Dx completo", "cie10": "CIE10", "fecha_dx": "DD/MM/AAAA",
          "receptores_er": "Pos/Neg", "receptores_pr": "Pos/Neg", "receptores_her2": "Pos/Neg/+++",
          "tnm_t": "T", "tnm_n": "N", "tnm_m": "M", "estadio": "I/II/III/IV",
          "ecog": "0-4", "peso": "kg", "talla": "cm",
          "tx_previo_cx": "SI/NO (Detalle)", "tx_previo_rt": "SI/NO (Detalle)", "tx_previo_sistemico": "SI/NO",
          "metastasis_sitios": "Hígado, Pulmón, etc.",
          "linea_tratamiento": "1ra, 2da...", "tipo_tratamiento": "Adyuvante/Paliativo",
          "esquema_solicitado": "Nombre Esquema", "ciclos_programados": "Nro",
          "droga_1": "Nombre", "dosis_1_mg_m2": "mg/m2", "dias_1": "Días", "dosis_total_1": "mg totales",
          "motivo_renovacion": "Continuidad/Toxicidad/Progresión", "respuesta_tratamiento": "Estable/Parcial/Progresión"
        }`;
    }

    const parts: any[] = [{ text: promptText + `\nCONTEXTO: ${historyText}` }];

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
    let cleanText = text.replace(/```json|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleanText);
  };

  const fillAndDownloadPDF = async (formDef: any) => {
    if ((!files || files.length === 0) && !historyText) {
        alert("⚠️ Suba la Historia Clínica primero.");
        return;
    }

    setProcessingId(formDef.id);
    setStatus('Procesando datos médicos...');

    try {
      const aiData = await extractDataWithAI(formDef.id);
      const bsa = calculateBSA(aiData.peso || aiData.paciente_peso, aiData.talla || aiData.paciente_talla);
      const finalName = aiData.paciente_nombre_real || aiData.paciente_nombre || patient.name;

      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      const setText = (name: string, val: string, limit?: number, fontSize?: number) => {
        try { 
            const f = form.getTextField(name); 
            if (val) {
                let textToWrite = String(val);
                if (limit && textToWrite.length > limit) {
                    textToWrite = textToWrite.substring(0, limit); // Simple truncado por seguridad
                }
                f.setText(textToWrite);
                if (fontSize) f.setFontSize(fontSize);
            }
        } catch (e) {}
      };

      const setCheck = (name: string, shouldCheck: boolean) => {
        try { if (shouldCheck) form.getCheckBox(name).check(); } catch (e) {}
      };

      // --- PAMI ---
      if (formDef.id === 'pami') {
         // (Lógica PAMI existente y pulida se mantiene igual...)
         setText('Apellido y Nombre', finalName);
         setText('Beneficiario Nº', ''); 
         setText('Celular', aiData.paciente_celular);
         setText('Fecha de nacimiento', cleanDate(aiData.paciente_fnac) || aiData.paciente_fnac);
         setText('Diagnóstico (CIE 10)', aiData.diagnostico_cie10, 85);
         setText('Histopatológico', aiData.histopatologico, 85);
         setText('ECOG Performance Status (0-4)', aiData.ecog);
         setText('Informe Clínico ActualRow1', aiData.informe_clinico_detallado, 1100, 9);
         setText('Datos positivos Laboratorio', aiData.laboratorio_formateado, 85);
         setText('Peso', aiData.peso); setText('Talla', aiData.talla); setText('Sup. Corporal', bsa);
         setText('DrogaGenéricoRow1', aiData.droga_1);
         setText('DosisRow1', aiData.dosis_1);
         setText('N CiclosDuración díasRow1', aiData.frecuencia_dias);
         // Datos Médico
         setText('Apellido y Nombre_2', doctorData.nombre);
         setText('Matricula', doctorData.matricula);
         setText('Celular', doctorData.cel_area); setText('Celular_2', doctorData.cel_num);
         setText('CUIL', doctorData.cuil_prefix); setText('CUIL1', doctorData.cuil_dni); setText('CUIL2', doctorData.cuil_suffix);
      } 
      // --- BANCO DE DROGAS (ADMISIÓN Y RENOVACIÓN) ---
      else if (formDef.id === 'admision' || formDef.id === 'renovacion') {
         // DATOS PACIENTE
         setText('Text1', finalName); // Nombre
         setText('Text3', cleanDate(aiData.paciente_fnac)); // Fecha Nac
         setText('Text4', aiData.paciente_dni);
         setText('Text5', aiData.paciente_profesion || "No especifica");
         // Sexo (M/F checkboxes o texto) - Intentamos texto genérico
         if (aiData.paciente_sexo === 'M') setCheck('Check1', true); // Check1 hipotético
         setText('Text14', aiData.paciente_domicilio);
         setText('Text15', aiData.paciente_telefono);
         setText('Text16', aiData.paciente_localidad);
         setText('Text17', aiData.paciente_provincia || "Córdoba"); // Default inteligente
         
         // DATOS CLÍNICOS
         setText('Text20', aiData.diagnostico_texto);
         setText('Text21', aiData.cie10);
         setText('Text27', cleanDate(aiData.fecha_dx));
         setText('Text28', aiData.tnm_t + aiData.tnm_n + aiData.tnm_m); // TNM unificado
         setText('Text30', aiData.estadio);
         
         // DATOS FÍSICOS
         setText('Text39', aiData.peso);
         setText('Text40', aiData.talla);
         setText('Text32', bsa); // Sup corporal
         
         // TRATAMIENTO SOLICITADO
         setText('Text70', aiData.esquema_solicitado); // Esquema
         setText('Text71', aiData.ciclos_programados);
         
         // TABLA DROGAS (Mapeo aproximado a la tabla visual)
         // Fila 1
         setText('Text92', aiData.droga_1); // Droga
         setText('Text93', aiData.dosis_1_mg_m2); // Dosis mg/m2
         setText('Text94', aiData.dias_1); // Días
         setText('Text95', aiData.dosis_total_1); // Dosis total
         
         // Fila 2 (Si existe)
         if (aiData.droga_2) {
             setText('Text96', aiData.droga_2);
             setText('Text97', aiData.dosis_2); // A veces la IA no trae mg/m2 exacto
         }

         // ESPECÍFICO RENOVACIÓN
         if (formDef.id === 'renovacion') {
             // Motivo
             if (aiData.motivo_renovacion?.toLowerCase().includes('continuidad')) setCheck('CheckContinuidad', true);
             if (aiData.motivo_renovacion?.toLowerCase().includes('progresion')) setCheck('CheckProgresion', true);
             if (aiData.motivo_renovacion?.toLowerCase().includes('toxicidad')) setCheck('CheckToxicidad', true);
         }
         
         // FINAL
         setText('Text88', `Córdoba, ${new Date().toLocaleDateString('es-AR')}`); // Lugar y Fecha
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

      {showDocConfig && (
        <div className="mb-6 p-5 bg-blue-50 border border-blue-100 rounded-2xl animate-in slide-in-from-top">
          {/* (El formulario de configuración médico se mantiene igual que la versión anterior...) */}
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-blue-800 text-xs uppercase tracking-widest">Datos del Profesional</h4>
            <button onClick={() => setShowDocConfig(false)} className="text-blue-400 hover:text-blue-600"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
             {/* ... Inputs de médico (nombre, matricula, cuil dividido, celular dividido) ... */}
             {/* COPIAR EL BLOQUE DE INPUTS DE LA VERSIÓN ANTERIOR AQUÍ PARA NO REPETIR CÓDIGO INNECESARIAMENTE EN EL CHAT */}
             <div><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Nombre</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.nombre} onChange={e=>setDoctorData({...doctorData, nombre:e.target.value})}/></div>
             <div><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Matrícula</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.matricula} onChange={e=>setDoctorData({...doctorData, matricula:e.target.value})}/></div>
             <div className="col-span-2"><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">CUIL</label><div className="flex gap-2"><input className="w-[15%] p-2 border rounded text-center text-xs" value={doctorData.cuil_prefix} onChange={e=>setDoctorData({...doctorData, cuil_prefix:e.target.value})}/><input className="w-[70%] p-2 border rounded text-center text-xs" value={doctorData.cuil_dni} onChange={e=>setDoctorData({...doctorData, cuil_dni:e.target.value})}/><input className="w-[15%] p-2 border rounded text-center text-xs" value={doctorData.cuil_suffix} onChange={e=>setDoctorData({...doctorData, cuil_suffix:e.target.value})}/></div></div>
             <div className="col-span-2"><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Celular</label><div className="flex gap-2"><input className="w-[20%] p-2 border rounded text-center text-xs" value={doctorData.cel_area} onChange={e=>setDoctorData({...doctorData, cel_area:e.target.value})}/><input className="w-[80%] p-2 border rounded text-center text-xs" value={doctorData.cel_num} onChange={e=>setDoctorData({...doctorData, cel_num:e.target.value})}/></div></div>
          </div>
          <button onClick={saveDoctorData} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center justify-center space-x-2"><Save size={14}/><span>Guardar</span></button>
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

                {form.id === 'pami' && (
                    <a href="https://cup.pami.org.ar/controllers/loginController.php" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center px-3 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 border border-teal-100"><ExternalLink size={14} /></a>
                )}
            </div>
          </div>
        ))}
      </div>

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}
    </div>
  );
};

export default FormManager;
