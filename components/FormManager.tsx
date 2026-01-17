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

    // --- PROMPT PAMI (INTACTO SEGÚN TU PEDIDO) ---
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
    // --- PROMPT NUEVO: BANCO DE DROGAS (ADMISIÓN Y RENOVACIÓN) ---
    else {
        promptText = `
        Actúa como ONCÓLOGO para Banco de Drogas (Hoy: ${today}). Extrae datos EXPLÍCITOS.
        
        INSTRUCCIONES ESPECÍFICAS:
        1. **Diagnóstico:** Completo con CIE10.
        2. **Receptores/TNM:** Extrae valores específicos (ej: T2N1M0, ER+, HER2-). SI ES CA DE PIEL O PULMÓN, RECEPTORES ES "NO APLICA".
        3. **Tratamientos Previos:** Detalla Cirugías (fecha, ganglios), RT (sitio) y Sistémicos.
        4. **Esquema Solicitado:** Detalla Droga, Dosis mg/m2, Días de administración. SI ES PEMBROLIZUMAB: Dosis 200mg FIJA (No por m2).
        5. **Renovación:** Si es renovación, busca motivo (Toxicidad/Progresión) y respuesta.
        6. **Datos Paciente:** Nacionalidad (Asumir Argentina si vive en Córdoba), Profesión (Busca 'Ocupación').
        
        JSON REQUERIDO:
        {
          "paciente_nombre": "Nombre", "paciente_nacionalidad": "Nacionalidad", "paciente_fnac": "DD/MM/AAAA",
          "paciente_dni": "DNI", "paciente_profesion": "Prof", "paciente_sexo": "M/F",
          "paciente_domicilio": "Domicilio", "paciente_localidad": "Loc", "paciente_provincia": "Prov",
          "paciente_telefono": "Tel", "institucion_hospital": "Hospital",
          "diagnostico_texto": "Dx completo", "cie10": "CIE10", "fecha_dx": "DD/MM/AAAA",
          "receptores_er": "Pos/Neg/No Aplica", "receptores_pr": "Pos/Neg/No Aplica", "receptores_her2": "Pos/Neg/No Aplica",
          "tnm_t": "T", "tnm_n": "N", "tnm_m": "M", "estadio": "I/II/III/IV",
          "anatomia_patologica": "Descripción AP", "ecog": "0-4",
          "peso": "kg", "talla": "cm",
          "tx_previo_cx": "SI/NO (Detalle)", "ganglios_resecados": "Nro", "ganglios_comprometidos": "Nro",
          "tx_previo_rt": "SI/NO (Sitio)", "tx_previo_sistemico": "SI/NO (Detalle)",
          "tratamiento_tipo": "Adyuvante/Neoadyuvante/Avanzado", "linea_nro": "1/2/3",
          "esquema_nombre": "Nombre Esquema", "ciclos_programados": "Nro", "intervalo_dias": "Cada X días",
          "droga_1": "Nombre", "dosis_1_mg_m2": "Dosis num", "dias_1": "Días (ej: 1,8)", "dosis_total_1": "Total mg",
          "droga_2": "Nombre", "dosis_2_mg_m2": "Dosis num", "dias_2": "Días", "dosis_total_2": "Total mg",
          "motivo_renovacion": "Continuidad/Toxicidad/Progresión", "respuesta_tx": "Respuesta"
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
      
      // Cálculo de BSA y Dosis Total para Banco de Drogas
      const pesoNum = parseFloat(aiData.peso || aiData.paciente_peso || "0");
      const tallaNum = parseFloat(aiData.talla || aiData.paciente_talla || "0");
      let bsa = "";
      if (pesoNum > 0 && tallaNum > 0) {
          bsa = Math.sqrt((pesoNum * tallaNum) / 3600).toFixed(2);
      }
      
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
         setText('Fecha de nacimiento', cleanDate(aiData.paciente_fnac) || aiData.paciente_fnac);
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
      // --- LÓGICA BANCO DE DROGAS (ADMISIÓN Y RENOVACIÓN) ---
      else if (formDef.id === 'admision' || formDef.id === 'renovacion') {
         // 1. DATOS PACIENTE
         setText('Text1', finalName); // Nombre
         setText('Text2', aiData.paciente_nacionalidad || "Argentina");
         setText('Text3', cleanDate(aiData.paciente_fnac));
         setText('Text4', aiData.paciente_dni);
         setText('Text5', aiData.paciente_profesion || "No especifica");
         // Sexo
         if (aiData.paciente_sexo === 'M') setCheck('Check Box1', true);
         if (aiData.paciente_sexo === 'F') setCheck('Check Box2', true);
         
         setText('Text14', aiData.paciente_domicilio);
         setText('Text15', aiData.paciente_telefono);
         setText('Text16', aiData.paciente_localidad || "Córdoba");
         setText('Text17', aiData.paciente_provincia || "Córdoba");
         setText('Text18', "Argentina");
         setText('Text19', aiData.institucion_hospital || "Hospital Oncológico Urrutia");

         // 2. DATOS CLÍNICOS
         setText('Text20', aiData.diagnostico_texto);
         setText('Text21', aiData.cie10);
         
         // Receptores (Si es ca de piel, dejar vacío o N/A)
         if (aiData.receptores_er && !aiData.receptores_er.includes('Aplica')) setText('Text22', `RE: ${aiData.receptores_er} RP: ${aiData.receptores_pr} HER2: ${aiData.receptores_her2}`);
         
         // TNM
         setText('Text28', `T: ${aiData.tnm_t} N: ${aiData.tnm_n} M: ${aiData.tnm_m}`); 
         setText('Text30', aiData.estadio); // Estadio
         setText('Text27', cleanDate(aiData.fecha_dx)); // Fecha Dx
         setText('Text31', aiData.anatomia_patologica); // AP
         
         // 3. DATOS FÍSICOS Y ECOG
         setText('Text39', aiData.peso);
         setText('Text40', aiData.talla);
         setText('Text32', bsa); // Sup corporal
         
         // 4. TRATAMIENTOS PREVIOS
         if (aiData.tx_previo_cx?.toUpperCase().includes('SI')) {
             setCheck('Check Box7', true); // Cirugía SI
             setText('Text43', aiData.ganglios_resecados);
             setText('Text49', aiData.ganglios_comprometidos);
         }
         
         // 5. TRATAMIENTO SOLICITADO
         // Check de Inmunoterapia/Biologicos (Suponiendo Box12/13 por ubicación)
         setCheck('Check Box13', true); // Terapias Blanco/Inmuno
         
         if (aiData.tratamiento_tipo?.toLowerCase().includes('adyuvante')) setCheck('Check Box15', true);
         if (aiData.tratamiento_tipo?.toLowerCase().includes('avanzado')) setCheck('Check Box17', true);
         
         setText('Text70', `Esquema: ${aiData.esquema_nombre} - Intervalo: ${aiData.intervalo_dias}`);
         setText('Text71', aiData.ciclos_programados);

         // 6. TABLA DE DROGAS
         // Fila 1
         setText('Text92', aiData.droga_1); // Droga
         
         // Lógica dosis fija vs sup corporal
         if (aiData.droga_1?.toLowerCase().includes('pembrolizumab')) {
             setText('Text93', "200 mg fijos");
             setText('Text95', "200 mg");
         } else {
             setText('Text93', aiData.dosis_1_mg_m2);
             if (bsa && aiData.dosis_1_mg_m2) {
                 const dosisTotal = (parseFloat(aiData.dosis_1_mg_m2) * parseFloat(bsa)).toFixed(0);
                 setText('Text95', `${dosisTotal} mg`);
             }
         }
         setText('Text94', aiData.dias_1);

         // 7. DATOS ADMINISTRATIVOS
         setText('Text88', `Córdoba, ${new Date().toLocaleDateString('es-AR')}`);
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
