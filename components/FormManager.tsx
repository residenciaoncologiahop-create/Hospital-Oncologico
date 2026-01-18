import React, { useState, useEffect } from 'react';
import { 
  FileText, Loader2, Wand2, UserCog, Save, X, Download, FilePlus, ExternalLink, AlertTriangle, CheckCircle2, Map 
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
    nombre: '', matricula: '', especialidad: 'Oncología Clínica',
    email: '', provincia: '', cuil_prefix: '', cuil_dni: '', cuil_suffix: '',
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
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/nuevo_dinadic.pdf', type: 'manual', context: 'SOLICITUD' },
  ];

  const calculateBSA = (weight: string, height: string) => {
    const w = parseFloat(weight?.toString().replace(',', '.'));
    const h = parseFloat(height?.toString().replace(',', '.'));
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
        const link = document.createElement('a');
        link.href = formDef.file;
        link.download = `${formDef.name}_Plantilla.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) { alert("Error al descargar plantilla."); }
  };

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

        const prompt = `
        Actúa como Oncólogo del Hospital Oncológico Dr. José Miguel Urrutia.
        Redacta un RESUMEN DE HISTORIA CLÍNICA para: ${context} BANCO DE DROGAS.
        
        IMPORTANTE: 
        - Formato de texto plano profesional.
        - NO uses negritas (markdown) ni símbolos extraños.
        - Sé conciso y directo.
        
        ESTRUCTURA:
        1. Identificación: Paciente (Nombre, DNI, Edad) y Diagnóstico.
        2. Antecedentes: Comorbilidades y oncológicos previos.
        3. Enfermedad Actual: Estado actual, estudios recientes (fechas y hallazgos clave).
        4. Justificación (PÁRRAFO FINAL): "Por lo expuesto, se solicita [Droga]..."
        
        CONTEXTO: ${historyText || ''}
        `;

        const parts: any[] = [{ text: prompt }];
        if (files && files.length > 0) {
            files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
        }

        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
        const summaryText = res.text || "No se pudo generar el resumen.";

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        
        const marginX = 50; 
        const marginTop = 50;
        const marginBottom = 100;
        let y = height - marginTop;

        const headerText = "HOSPITAL ONCOLÓGICO PROVINCIAL - CÓRDOBA";
        const headerWidth = fontBold.widthOfTextAtSize(headerText, 14);
        page.drawText(headerText, { x: (width - headerWidth) / 2, y: y, size: 14, font: fontBold });
        y -= 20;
        
        page.drawLine({ start: { x: marginX, y: y }, end: { x: width - marginX, y: y }, thickness: 1, color: rgb(0, 0, 0) });
        y -= 30;

        const dateText = `Córdoba, ${today}`;
        const dateWidth = font.widthOfTextAtSize(dateText, 11);
        page.drawText(dateText, { x: width - marginX - dateWidth, y: y, size: 11, font });
        y -= 40;

        const title = `RESUMEN DE HISTORIA CLÍNICA - ${context}`;
        const titleWidth = fontBold.widthOfTextAtSize(title, 12);
        page.drawText(title, { x: (width - titleWidth) / 2, y: y, size: 12, font: fontBold });
        y -= 30;

        const fontSize = 11;
        const lineHeight = 15;
        const paragraphs = summaryText.split('\n');

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) { y -= 8; continue; }

            const words = paragraph.split(' ');
            let lineBuffer = '';

            for (const word of words) {
                const testLine = lineBuffer + word + ' ';
                const textWidth = font.widthOfTextAtSize(testLine, fontSize);
                const maxWidth = width - (marginX * 2);

                if (textWidth > maxWidth) {
                    page.drawText(lineBuffer, { x: marginX, y: y, size: fontSize, font });
                    y -= lineHeight;
                    lineBuffer = word + ' ';
                    if (y < marginBottom) {
                        page = pdfDoc.addPage();
                        y = height - marginTop;
                    }
                } else {
                    lineBuffer = testLine;
                }
            }
            if (lineBuffer) {
                page.drawText(lineBuffer, { x: marginX, y: y, size: fontSize, font });
                y -= (lineHeight * 1.5);
            }
            if (y < marginBottom) {
                page = pdfDoc.addPage();
                y = height - marginTop;
            }
        }

        if (y < 120) { page = pdfDoc.addPage(); }

        const signatureY = 60; 
        const centerX = width / 2;

        page.drawLine({ start: { x: centerX - 70, y: signatureY + 30 }, end: { x: centerX + 70, y: signatureY + 30 }, thickness: 1, color: rgb(0, 0, 0) });

        const docName = doctorData.nombre || "Firma Médico";
        const docMat = doctorData.matricula ? `M.P. ${doctorData.matricula}` : "";
        
        const nameWidth = fontBold.widthOfTextAtSize(docName, 11);
        page.drawText(docName, { x: centerX - (nameWidth / 2), y: signatureY + 15, size: 11, font: fontBold });
        if (docMat) {
            const matWidth = font.widthOfTextAtSize(docMat, 10);
            page.drawText(docMat, { x: centerX - (matWidth / 2), y: signatureY, size: 10, font });
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
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("Falta API Key");
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toLocaleDateString('es-AR');
    
    const promptText = `
        Actúa como un ONCÓLOGO EXPERTO. Hoy es ${today}.
        OBJETIVO: Completar planilla PAMI.
        Extrae JSON: {
          "paciente_nombre_real": "Nombre", "paciente_dni": "DNI", "paciente_celular": "Celular", "paciente_fnac": "DD/MM/AAAA",
          "diagnostico_cie10": "Dx", "histopatologico": "Histo", "peso": "kg", "talla": "cm", "ecog": "0-4",
          "estadio_inicial": "EI", "estadio_actual": "EA", "fecha_diagnostico_inicial": "DD/MM/AAAA",
          "linea_tratamiento": "Línea", "antecedentes_qx": "Cx", "antecedentes_radio": "RT",
          "laboratorio_formateado": "Lab", "informe_clinico_detallado": "Informe",
          "motivo_solicitud": "Inicio...", "tipo_tratamiento": "Adyuvante...",
          "ciclos_planeados": "Ciclos", "frecuencia_dias": "D1",
          "droga_1": "D1", "presentacion_1": "P1", "dosis_1": "Dosis1", "droga_2": "D2", "presentacion_2": "P2", "dosis_2": "Dosis2"
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
          className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors
