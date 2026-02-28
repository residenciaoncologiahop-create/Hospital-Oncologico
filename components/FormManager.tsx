import React, { useState, useEffect } from 'react';
import { 
  FileText, Loader2, Wand2, UserCog, Save, X, Download, FilePlus, ExternalLink, AlertTriangle, CheckCircle2, Map 
} from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../utils/aiProxy';

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
    nombre: '', matricula: '', especialidad: 'Oncología Clínica',
    email: '', provincia: '', cuil_prefix: '', cuil_dni: '', cuil_suffix: '',
    cel_area: '', cel_num: ''
  });

  useEffect(() => {
    try {
      const savedDoc = localStorage.getItem('doctor_data_profile_v3');
      if (savedDoc) setDoctorData(JSON.parse(savedDoc));
    } catch (e) { console.error(e); }
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
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/nuevo_dinadic.pdf', type: 'manual', context: 'SOLICITUD' },
  ];

  const calculateBSA = (weight: string, height: string) => {
    let w = parseFloat(weight?.toString().replace(',', '.'));
    let h = parseFloat(height?.toString().replace(',', '.'));
    // Corregir talla en metros si viene mal (ej: 1.60 en vez de 160)
    if (h > 0 && h < 3) h = h * 100;
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) return Math.sqrt((w * h) / 3600).toFixed(2);
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
        const response = await fetch(formDef.file, { method: 'HEAD' });
        if (!response.ok) throw new Error("Archivo no encontrado");
        const link = document.createElement('a');
        link.href = formDef.file;
        link.download = `${formDef.name}_Plantilla.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) { alert(`No se encontró el archivo "${formDef.file}". Verifique la carpeta public/forms/`); }
  };

  // --- GENERADOR DE RESUMEN CLÍNICO ---
  const generateClinicalSummary = async (context: string) => {
    if (!historyText && (!files || files.length === 0)) {
        alert("⚠️ Falta documentación para generar el resumen.");
        return;
    }

    const drugName = window.prompt(`Ingrese el nombre de la droga/medicación para el trámite de ${context}:`);
    if (!drugName || drugName.trim() === "") return; 

    setProcessingId('summary');
    setStatus('Analizando historia clínica...');

    try {
        const today = new Date().toLocaleDateString('es-AR'); 

        let strategyPrompt = "";
        if (context === 'RENOVACIÓN') {
            strategyPrompt = `ESTRATEGIA: RENOVACIÓN DE ${drugName.toUpperCase()}. Objetivo: Demostrar beneficio clínico y tolerancia.`;
        } else {
            strategyPrompt = `ESTRATEGIA: ADMISIÓN / SOLICITUD DE ${drugName.toUpperCase()}. Objetivo: Justificar indicación inicial (ignorar continuidad si ya la tomó).`;
        }

        const prompt = `
        Actúa como un Oncólogo Experto. Redacta un RESUMEN DE HISTORIA CLÍNICA para: ${context} BANCO DE DROGAS.
        
        ${strategyPrompt}
        
        REGLAS DE FORMATO VISUAL (ESTRICTAS):
        1. ❌ SIN ASTERISCOS ni MARKDOWN. Texto plano.
        2. **ESTRUCTURA SIMPLIFICADA (SOLO 3 SECCIONES)**:
           1. IDENTIFICACIÓN
           2. RESUMEN CLÍNICO (Aquí debes integrar: Antecedentes, Cirugías, Tratamientos Previos, Estudios Recientes y Estado Actual en una narrativa cronológica fluida y detallada, sin dividir en tantos subtítulos para evitar redundancia).
           3. JUSTIFICACIÓN
        
        CONTENIDO REQUERIDO:
        - **Fechas exactas (DD/MM/AAAA)** para todo evento mencionado.
        - Detalle explícito de cirugías (especialmente **AMPUTACIONES**) y resultados de patología.
        
        **IMPORTANTE:** NO incluyas ninguna firma ni datos de contacto al final. El documento termina con el punto final de la justificación.
        
        CONTEXTO: ${historyText || ''}
        `;

        const parts: any[] = [{ text: prompt }];
        if (files && files.length > 0) {
            files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
        }

        const res = await callGemini({ parts });
        const summaryText = res.text || "No se pudo generar el texto.";

        setStatus('Generando PDF...');

        // --- CREACIÓN DEL PDF ---
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        
        const marginX = 50; 
        const marginTop = 30;
        const marginBottom = 50; 
        let y = height - marginTop;

        // 1. LOGO
        let logoLoaded = false;
        try {
            const logoUrl = window.location.origin + '/img/header_logo.png';
            const logoRes = await fetch(logoUrl);
            if (logoRes.ok) {
                const logoBytes = await logoRes.arrayBuffer();
                const pngImage = await pdfDoc.embedPng(logoBytes);
                const pngDims = pngImage.scale(0.35);
                page.drawImage(pngImage, {
                    x: (width - pngDims.width) / 2,
                    y: y - pngDims.height,
                    width: pngDims.width,
                    height: pngDims.height,
                });
                y -= (pngDims.height + 20); 
                logoLoaded = true;
            }
        } catch (e) {}

        if (!logoLoaded) {
            const headerText = "HOSPITAL ONCOLÓGICO PROVINCIAL - CÓRDOBA";
            const headerWidth = fontBold.widthOfTextAtSize(headerText, 14);
            page.drawText(headerText, { x: (width - headerWidth) / 2, y: y, size: 14, font: fontBold });
            y -= 30;
        }

        page.drawLine({ start: { x: marginX, y: y }, end: { x: width - marginX, y: y }, thickness: 1.5, color: rgb(0, 0, 0) });
        y -= 25;

        const docTitle = "RESUMEN DE HISTORIA CLÍNICA";
        const docSubTitle = `${context} - BANCO DE DROGAS`;
        const dateText = `Córdoba Capital, ${today}`;

        const titleWidth = fontBold.widthOfTextAtSize(docTitle, 14);
        page.drawText(docTitle, { x: (width - titleWidth) / 2, y: y, size: 14, font: fontBold });
        y -= 18;

        const subTitleWidth = fontBold.widthOfTextAtSize(docSubTitle, 12);
        page.drawText(docSubTitle, { x: (width - subTitleWidth) / 2, y: y, size: 12, font: fontBold });
        y -= 20;

        const dateWidth = font.widthOfTextAtSize(dateText, 10);
        page.drawText(dateText, { x: width - marginX - dateWidth, y: y, size: 10, font });
        y -= 20;

        page.drawLine({ start: { x: marginX, y: y }, end: { x: width - marginX, y: y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
        y -= 30;

        const fontSizeBody = 10;
        const fontSizeHeader = 11;
        const lineHeight = 14;
        const paragraphs = summaryText.split('\n');

        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i].trim();
            if (!paragraph) { y -= 5; continue; }

            const upperPara = paragraph.toUpperCase();
            const isSectionHeader = (
                upperPara.includes("IDENTIFICACIÓN") || 
                upperPara.includes("IDENTIFICACION") ||
                upperPara.includes("RESUMEN CLÍNICO") ||
                upperPara.includes("RESUMEN CLINICO") ||
                upperPara.includes("JUSTIFICACIÓN") ||
                upperPara.includes("JUSTIFICACION")
            ) && paragraph.length < 50;
            
            if (isSectionHeader) {
                y -= 15;
                if (y < marginBottom + 40) { page = pdfDoc.addPage(); y = height - marginTop - 20; }
                page.drawText(paragraph, { x: marginX, y: y, size: fontSizeHeader, font: fontBold });
                y -= 5;
                page.drawLine({ start: { x: marginX, y: y }, end: { x: width - marginX, y: y }, thickness: 0.5, color: rgb(0, 0, 0) });
                y -= 20;
                continue;
            }

            const words = paragraph.split(' ');
            let lineBuffer = '';

            for (const word of words) {
                const cleanWord = word.replace(/\*/g, '');
                const testLine = lineBuffer + cleanWord + ' ';
                const textWidth = font.widthOfTextAtSize(testLine, fontSizeBody);
                const maxWidth = width - (marginX * 2);

                if (textWidth > maxWidth) {
                    page.drawText(lineBuffer, { x: marginX, y: y, size: fontSizeBody, font });
                    y -= lineHeight;
                    lineBuffer = cleanWord + ' ';
                    if (y < marginBottom) { page = pdfDoc.addPage(); y = height - marginTop - 40; }
                } else {
                    lineBuffer = testLine;
                }
            }
            if (lineBuffer) {
                page.drawText(lineBuffer, { x: marginX, y: y, size: fontSizeBody, font });
                y -= (lineHeight * 1.2);
            }
            if (y < marginBottom) { page = pdfDoc.addPage(); y = height - marginTop - 40; }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Resumen_${context}_${patient.name}.pdf`;
        link.click();
        setStatus('¡Listo!');

    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setProcessingId(null); setStatus(''); }
  };

  const extractPamiData = async () => {
    const today = new Date().toLocaleDateString('es-AR');
    
    const promptText = `
        Actúa como un ONCÓLOGO EXPERTO. Hoy es ${today}.
        OBJETIVO: Extraer datos para completar formulario PAMI oncológico.
        IDIOMA: Todo en español.
        
        REGLAS DE EXTRACCIÓN:
        - fecha_nacimiento: buscar "Fecha nac.:", "Fecha de nacimiento:", "F. Nac" en el documento. Formato DD/MM/AAAA.
        - estadio_inicial: estadio FIGO o TNM al momento del diagnóstico (ej: "FIGO IVB", "T2N1M0"). NO el actual.
        - estadio_actual: estado clínico actual (ej: "Remisión completa", "Progresión", "Estable").
        - linea_tratamiento: número de línea actual (ej: "1ra línea", "2da línea", "Seguimiento", "Adyuvancia").
        - antecedentes_qx: Resumen CONCISO de cirugías usando abreviaturas médicas estándar (Cx=cirugía, Nef=nefrectomía, LAP=laparotomía, etc). Incluir fecha y lado. Máximo 120 caracteres. Ej: "Nef izq (02/2024), Extracción implante subdérmico (05/2024)".
- antecedentes_radio: Resumen CONCISO usando abreviaturas (RT=radioterapia, QRT=quimiorradioterapia, BT=braquiterapia, IMRT, SBRT). Incluir dosis si está disponible y fecha. Máximo 120 caracteres. Ej: "QRT (Cisplatino) + BT (09-10/2023)".
        - informe_clinico_detallado: resumen clínico completo, máximo 800 caracteres, sin DNI ni nombre completo.
        - laboratorio_formateado: SOLO parámetros oncológicamente relevantes para este diagnóstico (hemograma, función renal/hepática, marcadores tumorales específicos). Excluir hormonas de fertilidad, lípidos u otros no relacionados. Formato conciso: "Hb 12g/dl, Cr 0.8, LDH 180". Máximo 100 caracteres.
        - Si un dato no está disponible, devolver cadena vacía "".
        - Para droga_1/droga_2: si el paciente está en seguimiento sin tratamiento activo, devolver "".
        
        Devolver ÚNICAMENTE este JSON, sin markdown:
        {
          "paciente_nombre_real": "",
          "paciente_fnac": "DD/MM/AAAA",
          "paciente_celular": "",
          "diagnostico_cie10": "",
          "histopatologico": "",
          "peso": "",
          "talla": "",
          "ecog": "",
          "estadio_inicial": "",
          "estadio_actual": "",
          "fecha_diagnostico_inicial": "DD/MM/AAAA",
          "linea_tratamiento": "",
          "antecedentes_qx": "",
          "antecedentes_radio": "",
          "laboratorio_formateado": "",
          "informe_clinico_detallado": "",
          "motivo_solicitud": "",
          "tipo_tratamiento": "",
          "ciclos_planeados": "",
          "frecuencia_dias": "",
          "droga_1": "",
          "presentacion_1": "",
          "dosis_1": "",
          "droga_2": "",
          "presentacion_2": "",
          "dosis_2": ""
        }
    `;

    const parts: any[] = [{ text: promptText + `\nCONTEXTO: ${historyText}` }];
    if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

    const res = await callGemini({ parts, responseMimeType: "application/json" });
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

      // Auto-fit: shrink font until text fits within field width
      const setText = (name: string, val: string, maxFontSize: number = 10, minFontSize: number = 6) => {
        try {
          const f = form.getTextField(name);
          if (!val || !String(val).trim()) return;
          const text = String(val).trim();

          // Get actual field width from PDF widget
          let fieldWidth = 350; // fallback default
          try {
            const widgets = (f as any).acroField.getWidgets();
            if (widgets && widgets.length > 0) {
              const rect = widgets[0].getRectangle();
              fieldWidth = Math.max(rect.width - 6, 50);
            }
          } catch {}

          // Calculate font size that fits: Helvetica avg char ≈ 0.52 * fontSize wide
          let fontSize = maxFontSize;
          const AVG_CHAR_RATIO = 0.52;
          while (fontSize > minFontSize) {
            const estimatedWidth = text.length * AVG_CHAR_RATIO * fontSize;
            if (estimatedWidth <= fieldWidth) break;
            fontSize = Math.round((fontSize - 0.5) * 10) / 10;
          }

          f.setText(text);
          f.setFontSize(fontSize);
        } catch {}
      };

      setText('Apellido y Nombre', finalName);
      setText('Fecha de nacimiento', cleanDate(aiData.paciente_fnac) || aiData.paciente_fnac);
      setText('Diagnóstico (CIE 10)', aiData.diagnostico_cie10);
      setText('Diagnóstico CIE 10', aiData.diagnostico_cie10);
      setText('Histopatológico', aiData.histopatologico);
      setText('ECOG Performance Status (0-4)', aiData.ecog);
      setText('ECOG', aiData.ecog);
      setText('Estadío actual', aiData.estadio_actual);
      setText('Estadio actual', aiData.estadio_actual);
      setText('Estadio Inicial', aiData.estadio_inicial);
      setText('Fecha de Diagnóstico Inicial', aiData.fecha_diagnostico_inicial);
      setText('Fecha diagnostico inicial', aiData.fecha_diagnostico_inicial);
      setText('Línea de tratamiento', aiData.linea_tratamiento);
      setText('Ciclos', aiData.ciclos_planeados);
      setText('Días', aiData.frecuencia_dias);
      setText('Antecedentes Quirúrgicos', aiData.antecedentes_qx, 9, 7);
      setText('Antecedentes Terapia Radiante', aiData.antecedentes_radio, 9, 7);
      setText('Informe Clínico ActualRow1', aiData.informe_clinico_detallado, 9, 7.5);
      setText('Datos positivos Laboratorio', aiData.laboratorio_formateado, 9, 7.5);;
      setText('Peso', aiData.peso);
      setText('Talla', aiData.talla);
      setText('Sup. Corporal', bsa);
      setText('Sup Corpora', bsa);

      if (aiData.motivo_solicitud?.toLowerCase().includes('inicio')) setCheck('Inicio', true);
      if (aiData.motivo_solicitud?.toLowerCase().includes('renovac')) setCheck('Renovación', true);
      if (aiData.motivo_solicitud?.toLowerCase().includes('toxicidad')) setCheck('Cambio de Toxicidad', true);
      if (aiData.motivo_solicitud?.toLowerCase().includes('progresi')) setCheck('Cambio por Progresión', true);

      if (aiData.tipo_tratamiento?.toLowerCase().includes('adyuvante') && !aiData.tipo_tratamiento.includes('neo')) setCheck('Adyuvante', true);
      if (aiData.tipo_tratamiento?.toLowerCase().includes('neoadyuvante')) setCheck('Neoadyuvante', true);
      if (aiData.tipo_tratamiento?.toLowerCase().includes('avanzado')) setCheck('Avanzado', true);

      if (aiData.droga_1) {
        setText('DrogaGenéricoRow1', aiData.droga_1);
        setText('PresentaciónRow1', aiData.presentacion_1);
        setText('DosisRow1', aiData.dosis_1);
        setText('N CiclosDuración díasRow1', aiData.frecuencia_dias);
      }
      if (aiData.droga_2) {
        setText('DrogaGenéricoRow2', aiData.droga_2);
        setText('PresentaciónRow2', aiData.presentacion_2);
        setText('DosisRow2', aiData.dosis_2);
        setText('N CiclosDuración díasRow2', aiData.frecuencia_dias);
      }

      // Datos del médico
      setText('Apellido y Nombre_2', doctorData.nombre);
      setText('Matricula', doctorData.matricula);
      setText('Especialidad', doctorData.especialidad);
      setText('Email_2', doctorData.email);
      setText('Provincia', doctorData.provincia);
      setText('CUIL', doctorData.cuil_prefix);
      setText('CUIL1', doctorData.cuil_dni);
      setText('CUIL2', doctorData.cuil_suffix);
      setText('CUIT', doctorData.cuil_prefix);
      setText('CUIT1', doctorData.cuil_dni);
      setText('CUIT2', doctorData.cuil_suffix);
      setText('Celular_2', doctorData.cel_area);
      setText('Celular1', doctorData.cel_num);
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
                {form.type === 'auto' ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <button 
                          onClick={() => fillPamiPDF(form)}
                          disabled={processingId !== null}
                          className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                            ${processingId === form.id ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
                        >
                          {processingId === form.id ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                          <span>Generar</span>
                        </button>
                        <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-[9px] text-yellow-700">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5"/>
                            <p>IMPORTANTE: Formulario generado por IA. Revise dosis y fechas antes de presentar.</p>
                        </div>
                    </div>
                ) : (
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

                {form.id === 'pami' && (
                    <div className="flex flex-col gap-1 justify-start">
                        <a href="https://cup.pami.org.ar/controllers/loginController.php" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center px-3 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 border border-teal-100 h-[34px]" title="Ir a PAMI Web"><ExternalLink size={14} /></a>
                        <button onClick={() => generateFieldMap(form)} className="flex items-center justify-center px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 border border-purple-100 h-[34px]" title="Mapa Rojo"><Map size={14} /></button>
                    </div>
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
