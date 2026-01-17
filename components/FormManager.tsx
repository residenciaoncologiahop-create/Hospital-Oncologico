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
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/banco_drogas.pdf' },
  ];

  const calculateBSA = (weight: string, height: string) => {
    const w = parseFloat(weight?.toString().replace(',', '.'));
    const h = parseFloat(height?.toString().replace(',', '.'));
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return Math.sqrt((w * h) / 3600).toFixed(2);
    }
    return '';
  };

  const calculateAge = (dateString: string) => {
    if (!dateString) return "";
    // Intenta parsear DD/MM/AAAA
    const parts = dateString.split(/[\/\-]/);
    if (parts.length !== 3) return "";
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; 
    const year = parseInt(parts[2], 10);
    
    const birthDate = new Date(year, month, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age.toString();
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

    // --- PROMPT PAMI (INTACTO - NO MODIFICAR) ---
    if (formId === 'pami') {
        promptText = `
        Actúa como un ONCÓLOGO EXPERTO. Hoy es ${today}.
        OBJETIVO: Completar planilla PAMI con rigor técnico y estilo formal.
        REGLAS DE ESTILO (OBLIGATORIAS):
        1. **Idioma:** PROHIBIDO usar siglas en inglés como "SCC". Usa siempre español (ej: "Ca. Escamoso" o "Carcinoma Escamoso").
        2. **Informe Clínico:** - Redacta un resumen técnico cronológico.
           - NO INCLUYAS la fecha de nacimiento ni la edad en este texto.
           - Máximo 1100 caracteres.
        3. **Ciclos:** - Si es avanzado/paliativo -> "Hasta progresión y/o toxicidad".
           - NUNCA pongas "Según protocolo".
        4. **Tratamiento:** Si falta dato de presentación/dosis, DEDUCE el estándar (NCCN/ESMO).
        5. **Laboratorio:** Si tiene >3 meses de antigüedad, dejar VACÍO. Si es reciente: "DD/MM/AA: Hb X / GB X / Plaq X".
        
        Extrae este JSON exacto:
        {
          "paciente_nombre_real": "Nombre", "paciente_dni": "DNI", "paciente_celular": "Celular", "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Texto breve (< 85 chars)", "histopatologico": "Texto breve (< 85 chars, SIN siglas inglés)",
          "peso": "kg", "talla": "cm", "ecog": "0-4", "estadio_inicial": "Estadio debut", "estadio_actual": "Estadio actual",
          "fecha_diagnostico_inicial": "DD/MM/AAAA", "linea_tratamiento": "1ra, 2da...",
          "antecedentes_qx": "Texto breve (< 80 chars)", "antecedentes_radio": "Texto breve (< 75 chars)",
          "laboratorio_formateado": "Texto o vacío", "informe_clinico_detallado": "Texto < 1100 chars",
          "motivo_solicitud": "Inicio/Renovación...", "tipo_tratamiento": "Adyuvante/Avanzado...",
          "ciclos_planeados": "Texto", "frecuencia_dias": "Esquema",
          "droga_1": "Droga", "presentacion_1": "Presentación", "dosis_1": "Dosis",
          "droga_2": "Droga 2", "presentacion_2": "Presentación", "dosis_2": "Dosis"
        }`;
    } 
    // --- PROMPT BANCO DE DROGAS (MEJORADO Y CORREGIDO) ---
    else {
        promptText = `
        Actúa como ONCÓLOGO para formulario de Banco de Drogas.
        
        INSTRUCCIONES CRÍTICAS:
        1. **Datos Personales:** Busca DNI, Profesión (ej: "Construcción", "Albañil"), Dirección exacta (Calle y Número) y Localidad.
        2. **Institución:** "Hospital Oncológico Dr. José Miguel Urrutia".
        3. **Diagnóstico:** Completo y detallado. CIE10 (ej: C44.6).
        4. **TNM:** Extrae T, N y M por separado. Ej: T4, N1, M0.
        5. **Receptores:** Si es Cáncer de Piel, Melanoma o Sarcoma -> "NO APLICA".
        6. **Cirugías:** Detalla fecha y procedimiento (ej: "23/10/23 Resección local").
        7. **Pembrolizumab:** Si la droga es Pembrolizumab, LA DOSIS ES FIJA: "200 mg" (No calcular por m2).
        8. **Radioterapia:** Si dice "No realizada" o "No factible", marca NO.
        
        JSON REQUERIDO:
        {
          "paciente_nombre": "Nombre Completo", 
          "paciente_nacionalidad": "Argentina", 
          "paciente_fnac": "DD/MM/AAAA",
          "paciente_dni": "DNI sin puntos", 
          "paciente_profesion": "Ocupación/Profesión", 
          "paciente_sexo": "M/F",
          "paciente_domicilio": "Calle y Altura", 
          "paciente_localidad": "Localidad", 
          "paciente_provincia": "Provincia",
          "paciente_telefono": "Teléfono", 
          "institucion_hospital": "Hospital Oncológico Dr. José Miguel Urrutia",
          "diagnostico_texto": "Dx Completo Recidivado etc", 
          "cie10": "Código CIE10", 
          "fecha_dx": "DD/MM/AAAA (Fecha Dx Inicial)",
          "tnm_t": "Valor T", "tnm_n": "Valor N", "tnm_m": "Valor M", 
          "estadio": "Estadio (ej: IVA)",
          "anatomia_patologica": "Resumen Biopsias y Cirugías", 
          "ecog": "0-4",
          "peso": "kg", "talla": "cm",
          "tx_previo_cx_detalle": "Detalle cirugías previas con fechas", 
          "tx_previo_rt_realizo": "SI/NO",
          "tx_previo_quimio_detalle": "Esquemas previos (Drogas y Fechas)",
          "tx_actual_linea": "1ra/2da/3ra",
          "esquema_nombre": "Nombre Esquema", 
          "ciclos_programados": "Texto (ej: Hasta progresión)", 
          "intervalo_dias": "Cada X días",
          "droga_1": "Nombre Droga", 
          "dosis_1_mg_m2": "Dosis (mg/m2 o Fija)", 
          "dias_1": "Días",
          "metastasis_sitios": "Sitios MTS (Ganglios, Pulmón, etc)",
          "motivo_renovacion": "Continuidad/Toxicidad/Progresión"
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
      
      const pesoNum = parseFloat(aiData.peso || "0");
      const tallaNum = parseFloat(aiData.talla || "0");
      let bsa = "";
      if (pesoNum > 0 && tallaNum > 0) {
          bsa = Math.sqrt((pesoNum * tallaNum) / 3600).toFixed(2);
      }
      
      const finalName = aiData.paciente_nombre_real || aiData.paciente_nombre || patient.name;
      
      // Cálculo de Edad
      const cleanFnac = cleanDate(aiData.paciente_fnac);
      const edadCalculada = calculateAge(cleanFnac);

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
                    textToWrite = textToWrite.substring(0, limit);
                }
                f.setText(textToWrite);
                if (fontSize) f.setFontSize(fontSize);
            }
        } catch (e) {}
      };

      const setCheck = (name: string, shouldCheck: boolean) => {
        try { if (shouldCheck) form.getCheckBox(name).check(); } catch (e) {}
      };

      // --- LÓGICA PAMI (INTACTA - NO TOCAR) ---
      if (formDef.id === 'pami') {
         setText('Apellido y Nombre', finalName);
         setText('Beneficiario Nº', ''); 
         setText('Celular', aiData.paciente_celular);
         setText('Fecha de nacimiento', cleanFnac || aiData.paciente_fnac);
         setText('Diagnóstico (CIE 10)', aiData.diagnostico_cie10, 85);
         setText('Diagnóstico CIE 10', aiData.diagnostico_cie10, 85);
         setText('Histopatológico', aiData.histopatologico, 85);
         setText('ECOG Performance Status (0-4)', aiData.ecog);
         setText('ECOG', aiData.ecog);
         setText('Estadío actual', aiData.estadio_actual);
         setText('Estadio actual', aiData.estadio_actual);
         setText('Estadio Inicial', aiData.estadio_inicial);
         setText('Fecha de Diagnóstico Inicial', aiData.fecha_diagnostico_inicial);
         setText('Fecha diagnostico inicial', aiData.fecha_diagnostico_inicial);
         setText('Línea de tratamiento', aiData.linea_tratamiento);
         if (aiData.motivo_solicitud?.toLowerCase().includes('inicio')) setCheck('Inicio', true);
         if (aiData.motivo_solicitud?.toLowerCase().includes('renovac')) setCheck('Renovación', true);
         if (aiData.motivo_solicitud?.toLowerCase().includes('toxicidad')) setCheck('Cambio de Toxicidad', true);
         if (aiData.motivo_solicitud?.toLowerCase().includes('progresi')) setCheck('Cambio por Progresión', true);
         setText('Ciclos', aiData.ciclos_planeados, 41);
         setText('Días', aiData.frecuencia_dias);
         setText('Antecedentes Quirúrgicos', aiData.antecedentes_qx, 80);
         setText('Antecedentes Terapia Radiante', aiData.antecedentes_radio, 75);
         setText('Informe Clínico ActualRow1', aiData.informe_clinico_detallado, 1100, 9); 
         setText('Datos positivos Laboratorio', aiData.laboratorio_formateado, 85);
         setText('Peso', aiData.peso);
         setText('Talla', aiData.talla);
         setText('Sup. Corporal', bsa);
         setText('Sup Corpora', bsa);
         if (aiData.tipo_tratamiento?.toLowerCase().includes('adyuvante') && !aiData.tipo_tratamiento.includes('neo')) setCheck('Adyuvante', true);
         if (aiData.tipo_tratamiento?.toLowerCase().includes('neoadyuvante')) setCheck('Neoadyuvante', true);
         if (aiData.tipo_tratamiento?.toLowerCase().includes('avanzado')) setCheck('Avanzado', true);
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
         setText('Apellido y Nombre_2', doctorData.nombre);
         setText('Matricula', doctorData.matricula);
         setText('Especialidad', doctorData.especialidad);
         setText('Email_2', doctorData.email);
         setText('Provincia', doctorData.provincia);
         setText('CUIL', doctorData.cuil_prefix); setText('CUIL1', doctorData.cuil_dni); setText('CUIL2', doctorData.cuil_suffix);
         setText('CUIT', doctorData.cuil_prefix); setText('CUIT1', doctorData.cuil_dni); setText('CUIT2', doctorData.cuil_suffix);
         setText('Celular', doctorData.cel_area); setText('Celular1', doctorData.cel_num); setText('Celular_2', doctorData.cel_num); 
         setText('Lugar y fecha', new Date().toLocaleDateString('es-AR'));
      } 
      // --- LÓGICA BANCO DE DROGAS (CORREGIDA Y EXPANDIDA) ---
      else if (formDef.id === 'admision' || formDef.id === 'renovacion') {
         // 1. DATOS PACIENTE
         setText('Text1', finalName); // Nombre
         setText('Text2', "Argentina"); // Nacionalidad forzada si es de Cba
         setText('Text3', cleanFnac); // Fecha Nac
         setText('Text4', aiData.paciente_dni);
         setText('Text5', aiData.paciente_profesion);
         
         // Sexo (Checkboxes aproximados)
         if (aiData.paciente_sexo === 'M') setCheck('Check Box1', true);
         if (aiData.paciente_sexo === 'F') setCheck('Check Box2', true);
         
         setText('Text6', edadCalculada); // Edad calculada
         setText('Text14', aiData.paciente_domicilio);
         setText('Text15', aiData.paciente_telefono);
         setText('Text16', aiData.paciente_localidad);
         setText('Text17', aiData.paciente_provincia || "Córdoba");
         setText('Text18', "Argentina");
         setText('Text19', "Hospital Oncológico Dr. José Miguel Urrutia"); // Nombre completo

         // 2. DATOS CLÍNICOS
         setText('Text20', aiData.diagnostico_texto);
         setText('Text21', aiData.cie10);
         
         // RECEPTORES: Lógica para ocultar si no aplica
         const dxLower = aiData.diagnostico_texto?.toLowerCase() || "";
         if (dxLower.includes('epidermoide') || dxLower.includes('piel') || dxLower.includes('escamoso')) {
             setText('Text22', "NO APLICA (Ca. Epidermoide)"); // O dejar vacío
         } else {
             setText('Text22', `RE: ${aiData.receptores_er} RP: ${aiData.receptores_pr}`);
         }
         
         // TNM separado
         setText('Text28', `T: ${aiData.tnm_t}  N: ${aiData.tnm_n}  M: ${aiData.tnm_m}`); 
         setText('Text30', aiData.estadio); // Estadio
         setText('Text27', cleanDate(aiData.fecha_dx)); // Fecha Dx
         setText('Text31', aiData.anatomia_patologica); // AP Completa
         
         // 3. FÍSICO Y ECOG
         setText('Text39', aiData.peso);
         setText('Text40', aiData.talla);
         setText('Text32', bsa);
         if (aiData.ecog == '1') setCheck('Check Box4', true); // Check ECOG 1
         
         // 4. TRATAMIENTOS PREVIOS
         if (aiData.tx_previo_cx_detalle) {
             setCheck('Check Box7', true); // Cirugía SI
             setText('Text41', aiData.tx_previo_cx_detalle); // Especificar Cirugías
         }
         
         // RT
         if (aiData.tx_previo_rt_realizo === "SI") {
             setCheck('Check Box9', true); 
         } else {
             setCheck('Check Box10', true); // NO RT
         }

         // Quimio previa
         if (aiData.tx_previo_quimio_detalle) {
             setCheck('Check Box11', true); // Sistémicos SI
             setText('Text55', aiData.tx_previo_quimio_detalle);
         }
         
         // 5. TRATAMIENTO SOLICITADO
         // Inmunoterapia checkbox
         setCheck('Check Box13', true); 
         // Avanzado checkbox
         setCheck('Check Box17', true); 
         setText('Text69', aiData.tx_actual_linea); // Nro Linea
         
         setText('Text70', `Esquema: ${aiData.esquema_nombre} - Intervalo: ${aiData.intervalo_dias}`);
         setText('Text71', aiData.ciclos_programados); // "Hasta progresión"

         // 6. TABLA DE DROGAS (Lógica Pembrolizumab)
         setText('Text92', aiData.droga_1); // Droga
         
         if (aiData.droga_1?.toLowerCase().includes('pembrolizumab')) {
             setText('Text93', "200 mg dosis fija");
             setText('Text95', "200 mg"); // Dosis Total
         } else {
             setText('Text93', aiData.dosis_1_mg_m2);
             // Si no es Pembro, calcular por BSA si existe
             if (bsa && aiData.dosis_1_mg_m2) {
                 const doseVal = parseFloat(aiData.dosis_1_mg_m2);
                 if (!isNaN(doseVal)) {
                    setText('Text95', `${(doseVal * parseFloat(bsa)).toFixed(0)} mg`);
                 }
             }
         }
         setText('Text94', aiData.dias_1);

         // 7. ENFERMEDAD AVANZADA (Checkboxes estimados)
         if (aiData.metastasis_sitios?.toLowerCase().includes('gangli')) setCheck('Check Box19', true); // Ganglios
         
         // 8. FINAL
         setText('Text88', `Córdoba, ${new Date().toLocaleDateString('es-AR')}`);
         setText('Text89', "Tel: 0351-4444444"); 
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
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-blue-800 text-xs uppercase tracking-widest">Datos del Profesional</h4>
            <button onClick={() => setShowDocConfig(false)} className="text-blue-400 hover:text-blue-600"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
             {/* CONFIGURACIÓN MÉDICO (CÓDIGO EXISTENTE INTACTO) */}
             <div><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Nombre</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.nombre} onChange={e=>setDoctorData({...doctorData, nombre:e.target.value})}/></div>
             <div><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Matrícula</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.matricula} onChange={e=>setDoctorData({...doctorData, matricula:e.target.value})}/></div>
             <div className="col-span-2"><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">CUIL</label><div className="flex gap-2"><input className="w-[15%] p-2 border rounded text-center text-xs" value={doctorData.cuil_prefix} onChange={e=>setDoctorData({...doctorData, cuil_prefix:e.target.value})}/><input className="w-[70%] p-2 border rounded text-center text-xs" value={doctorData.cuil_dni} onChange={e=>setDoctorData({...doctorData, cuil_dni:e.target.value})}/><input className="w-[15%] p-2 border rounded text-center text-xs" value={doctorData.cuil_suffix} onChange={e=>setDoctorData({...doctorData, cuil_suffix:e.target.value})}/></div></div>
             <div><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Especialidad</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.especialidad} onChange={e=>setDoctorData({...doctorData, especialidad:e.target.value})}/></div>
             <div><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Provincia</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.provincia} onChange={e=>setDoctorData({...doctorData, provincia:e.target.value})}/></div>
             <div className="col-span-2"><label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Email</label><input className="w-full p-2 border rounded-lg text-xs" value={doctorData.email} onChange={e=>setDoctorData({...doctorData, email:e.target.value})}/></div>
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
