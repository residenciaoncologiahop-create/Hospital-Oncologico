import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Loader2, 
  Wand2, 
  UserCog, 
  Save, 
  X, 
  Download, 
  FilePlus, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Map 
} from 'lucide-react';
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
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf', type: 'auto' },
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf', type: 'manual', context: 'ADMISIÓN' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf', type: 'manual', context: 'RENOVACIÓN' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/banco_drogas.pdf', type: 'manual', context: 'SOLICITUD' },
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

  const downloadTemplate = async (formDef: any) => {
    try {
        const link = document.createElement('a');
        link.href = formDef.file;
        link.download = `${formDef.name}_Plantilla.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Error al descargar plantilla.");
    }
  };

  // --- FUNCIÓN GENERAR RESUMEN (CORREGIDA FONDO Y FORMATO) ---
  const generateClinicalSummary = async (context: string) => {
    if (!historyText && (!files || files.length === 0)) {
        alert("⚠️ Falta documentación para generar el resumen.");
        return;
    }
    setProcessingId('summary');
    setStatus('Redactando resumen...');

    try {
        const apiKey = import.meta.env.VITE_API_KEY;
        if (!apiKey) throw new Error("Falta API Key");
        
        const ai = new GoogleGenAI({ apiKey });
        const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

        // PROMPT AJUSTADO: TEXTO PLANO
        const prompt = `
        Actúa como Oncólogo. Redacta un RESUMEN DE HISTORIA CLÍNICA para: ${context} BANCO DE DROGAS.
        
        IMPORTANTE: 
        - NO uses formato Markdown (**negritas**, *cursivas*).
        - NO escribas los datos del médico al final (los pondré yo).
        - Texto plano, párrafos claros.
        
        ESTRUCTURA:
        1. Identificación: Paciente (Nombre, DNI, Edad) y Diagnóstico.
        2. Antecedentes: Comorbilidades y oncológicos previos.
        3. Enfermedad Actual: Estado actual, estudios recientes (fechas y hallazgos clave).
        4. Justificación (PÁRRAFO FINAL): "Por lo expuesto, se solicita [Droga]..."
        
        CONTEXTO: ${historyText || ''}
        `;

        const parts: any[] = [{ text: prompt }];
        if (files && files.length > 0) {
            files.forEach(f => {
                parts.push({ inlineData: { mimeType: f.type, data: f.data } });
            });
        }

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts }
        });

        const summaryText = res.text || "No se pudo generar el resumen.";

        // --- GESTIÓN DE FONDO (MEMBRETE) ---
        const pdfDoc = await PDFDocument.create();
        let templateDoc = null;

        // 1. Buscar en archivos subidos (Prioridad)
        const uploadedMembrete = files.find(f => 
            f.name.toLowerCase().includes('membrete') || 
            f.name.toLowerCase().includes('hospital')
        );

        if (uploadedMembrete) {
            // Convertir base64 a Uint8Array
            const binaryString = atob(uploadedMembrete.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            try {
                templateDoc = await PDFDocument.load(bytes);
            } catch (e) { console.error("Error cargando membrete subido", e); }
        }

        // 2. Si no, buscar en carpeta public (Fallback)
        if (!templateDoc) {
            try {
                const resLocal = await fetch(window.location.origin + '/forms/membrete.pdf');
                if (resLocal.ok) {
                    const bytesLocal = await resLocal.arrayBuffer();
                    templateDoc = await PDFDocument.load(bytesLocal);
                }
            } catch (e) {}
        }

        // Helper para agregar página con fondo
        const addPageWithBackground = async () => {
            if (templateDoc) {
                const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);
                return pdfDoc.addPage(templatePage);
            } else {
                return pdfDoc.addPage();
            }
        };

        // --- ESCRITURA ---
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = await addPageWithBackground();
        const { width, height } = page.getSize();
        
        // MÁRGENES MÁS AMPLIOS
        const marginX = 70; // Izquierda/Derecha
        const topStart = height - 160; // Empezar más abajo para respetar logo
        const bottomLimit = 150; // Dejar espacio abajo para firma
        let y = topStart;

        // FECHA
        const dateText = `Córdoba, ${today}`;
        const dateWidth = font.widthOfTextAtSize(dateText, 11);
        page.drawText(dateText, { x: width - marginX - dateWidth, y: y, size: 11, font });
        y -= 40;

        // TÍTULO
        const title = `RESUMEN DE HISTORIA CLÍNICA - ${context}`;
        const titleWidth = fontBold.widthOfTextAtSize(title, 12);
        page.drawText(title, { x: (width - titleWidth) / 2, y: y, size: 12, font: fontBold });
        y -= 40;

        // CUERPO
        const fontSize = 11; // Un poco más grande
        const lineHeight = 16;
        
        const paragraphs = summaryText.split('\n');

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) {
                y -= 10;
                continue;
            }

            const words = paragraph.split(' ');
            let lineBuffer = '';

            for (const word of words) {
                const testLine = lineBuffer + word + ' ';
                const textWidth = font.widthOfTextAtSize(testLine, fontSize);
                const maxWidth = width - (marginX * 2);

                if (textWidth > maxWidth) {
                    // Imprimir línea
                    page.drawText(lineBuffer, { x: marginX, y: y, size: fontSize, font });
                    y -= lineHeight;
                    lineBuffer = word + ' ';

                    // Chequeo de fin de página
                    if (y < bottomLimit) {
                        page = await addPageWithBackground();
                        y = topStart;
                    }
                } else {
                    lineBuffer = testLine;
                }
            }
            // Última línea del párrafo
            if (lineBuffer) {
                page.drawText(lineBuffer, { x: marginX, y: y, size: fontSize, font });
                y -= (lineHeight * 1.5);
            }
            
            if (y < bottomLimit) {
                page = await addPageWithBackground();
                y = topStart;
            }
        }

        // --- FIRMA DEL MÉDICO (ABAJO DE TODO) ---
        // Verificar si entra en esta página o necesitamos nueva
        if (y < 120) {
            page = await addPageWithBackground();
            y = topStart; // Aunque en realidad la firma va abajo, reiniciamos contexto
        }

        const signatureY = 80; // Posición fija al pie
        const centerX = width / 2;

        page.drawLine({
            start: { x: centerX - 80, y: signatureY + 20 },
            end: { x: centerX + 80, y: signatureY + 20 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        const docName = doctorData.nombre || "Firma y Sello Médico";
        const docMat = doctorData.matricula ? `M.P. ${doctorData.matricula}` : "";
        
        const nameWidth = fontBold.widthOfTextAtSize(docName, 11);
        const matWidth = font.widthOfTextAtSize(docMat, 10);

        page.drawText(docName, { x: centerX - (nameWidth / 2), y: signatureY + 5, size: 11, font: fontBold });
        if (docMat) {
            page.drawText(docMat, { x: centerX - (matWidth / 2), y: signatureY - 10, size: 10, font });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Resumen_${context}_${patient.name}.pdf`;
        link.click();
        setStatus('¡Listo!');

    } catch (e: any) {
        alert("Error: " + e.message);
    } finally {
        setProcessingId(null);
        setStatus('');
    }
  };

  // --- FUNCIÓN 3: AUTOCOMPLETADO PAMI (Intacto) ---
  const extractPamiData = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toLocaleDateString('es-AR');
    
    const promptText = `
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

    const parts: any[] = [{ text: promptText + `\nCONTEXTO: ${historyText}` }];
    if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

    const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
    const text = res.text || "{}";
    let cleanText = text.replace(/```json|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    return JSON.parse(cleanText);
  };

  const fillPamiPDF = async (formDef: any) => {
    if ((!files || files.length === 0) && !historyText) {
        alert("⚠️ Suba la Historia Clínica primero.");
        return;
    }
    setProcessingId(formDef.id);
    setStatus('Procesando PAMI...');

    try {
      const aiData = await extractPamiData();
      const bsa = calculateBSA(aiData.peso, aiData.talla);
      const finalName = aiData.paciente_nombre_real || patient.name;
      const cleanFnac = cleanDate(aiData.paciente_fnac);

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
                if (limit && textToWrite.length > limit) textToWrite = textToWrite.substring(0, limit);
                f.setText(textToWrite);
                if (fontSize) f.setFontSize(fontSize);
            }
        } catch (e) {}
      };
      const setCheck = (name: string, shouldCheck: boolean) => { try { if (shouldCheck) form.getCheckBox(name).check(); } catch (e) {} };

      // MAPEO PAMI ORIGINAL
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

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PAMI_${finalName}.pdf`;
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
                Cargue la Historia Clínica en "Documentación" para habilitar el autocompletado PAMI y los resúmenes.
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
                {/* LÓGICA DE BOTONES SEGÚN TIPO DE FORMULARIO */}
                
                {form.type === 'auto' ? (
                    // BOTÓN PAMI (Autocompletar)
                    <button 
                      onClick={() => fillPamiPDF(form)}
                      disabled={processingId !== null}
                      className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                        ${processingId === form.id ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
                    >
                      {processingId === form.id ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar</span>
                    </button>
                ) : (
                    // BOTONES BANCO DROGAS (Plantilla + Resumen)
                    <>
                        <button 
                          onClick={() => downloadTemplate(form)}
                          className="flex-1 flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <Download size={14}/>
                          <span>Plantilla Vacía</span>
                        </button>
                        
                        <button 
                          onClick={() => generateClinicalSummary(form.context || 'SOLICITUD')}
                          disabled={processingId !== null}
                          className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 text-white hover:bg-purple-700 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                          <span>Resumen Clínico</span>
                        </button>
                    </>
                )}

                {/* Link Externo PAMI (Solo para PAMI) */}
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
