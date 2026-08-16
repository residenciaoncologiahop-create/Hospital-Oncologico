import React, { useState, useEffect } from 'react';
import {
  FileText, Loader2, Wand2, UserCog, Save, X, Download, FilePlus, ExternalLink, AlertTriangle, CheckCircle2, Map, Share2, RefreshCcw, Clock, Plus, Trash2, HelpCircle, Check, Edit3, Pill, Sparkles, AlertCircle
} from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../utils/aiProxy';

interface FormManagerProps {
  patient: any;
  historyText: string;
  files: any[];
  timeline?: any[];
}

const FormManager: React.FC<FormManagerProps> = ({ patient, historyText, files, timeline }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [formGenerated, setFormGenerated] = useState<Record<string, boolean>>({});
  const [formCorrections, setFormCorrections] = useState<Record<string, string>>({});
  const [lastRegenParams, setLastRegenParams] = useState<Record<string, {
    drugName?: string;
    context?: string;
    servicioDestino?: string;
    motivoSolicitud?: string;
    accumulatedCorrections: string;
  }>>({});
  const [showEsquemaModal, setShowEsquemaModal] = useState(false);
  const [esquemaData, setEsquemaData] = useState({
    numero_ciclos: '', frecuencia_ciclos: '', tiempo_tratamiento: '',
    fecha_inicio: '', medicamentos: '', dosis_m2: '',
    dosis_total_ciclo: '', dias_admin: '', intervalo: ''
  });
  const [pendingDinadicDrug, setPendingDinadicDrug] = useState('');
  const [pendingDinadicCorrection, setPendingDinadicCorrection] = useState('');

  // PAMI State
  const [showPamiReviewModal, setShowPamiReviewModal] = useState(false);
  const [pamiFormData, setPamiFormData] = useState({
    paciente_nombre_real: '',
    paciente_fnac: '',
    paciente_celular: '',
    diagnostico_cie10: '',
    histopatologico: '',
    peso: '',
    talla: '',
    ecog: '',
    estadio_inicial: '',
    estadio_actual: '',
    fecha_diagnostico_inicial: '',
    linea_tratamiento: '',
    antecedentes_qx: '',
    antecedentes_radio: '',
    laboratorio_formateado: '',
    informe_clinico_detallado: '',
    motivo_solicitud: 'Inicio',
    tipo_tratamiento: 'Avanzado',
    ciclos_planeados: '',
    frecuencia_dias: '',
    esquema_tratamiento_solicitado: '',
    droga_1: '',
    droga_2: '',
    droga_3: '',
    droga_4: '',
  });
  
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
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf', type: 'auto_banco', context: 'ADMISIÓN' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf', type: 'auto_banco', context: 'RENOVACIÓN' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/nuevo_dinadic.pdf', type: 'auto_dinadic', context: 'SOLICITUD' },
    { id: 'interconsulta', name: 'Resumen de Interconsulta / Derivación', file: '', type: 'interconsulta' },
  ];

  const calculateBSA = (weight: string, height: string) => {
    const w = parseFloat(weight?.toString().replace(',', '.'));
    let h = parseFloat(height?.toString().replace(',', '.'));
    if (!isNaN(h) && h > 0 && h < 3) h = Math.round(h * 100);
    if (!isNaN(w) && !isNaN(h) && w > 0 && w <= 350 && h >= 40 && h <= 250) {
      return Math.sqrt((w * h) / 3600).toFixed(2);
    }
    return '';
  };

  const cleanDate = (val: string) => {
    if (!val) return "";
    const match = val.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
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
    } catch { alert(`No se encontró el archivo "${formDef.file}". Verifique la carpeta public/forms/`); }
  };

  // --- INTEGRACIÓN DE LÍNEA DE TIEMPO Y HISTORIA CLÍNICA ---
  const getEffectiveClinicalContext = () => {
    let combined = historyText ? historyText.trim() : '';
    const effectiveTimeline = timeline || patient?.timeline || [];
    if (effectiveTimeline && effectiveTimeline.length > 0) {
      const timelineStr = effectiveTimeline
        .map((e: any) => {
          const date = e.date || e.fecha || 'Sin fecha';
          const category = e.category || e.categoria || e.type || 'Evento';
          const prof = e.professional || e.profesional || e.doctor || '';
          const note = e.note || e.nota || e.description || e.descripcion || '';
          const detail = e.detail || e.details || e.detalle || '';
          const keyMarker = e.isKey ? ' [CLAVE]' : '';

          let line = `• [${date}] ${category}${keyMarker}: ${note}`;
          if (prof && prof !== 'N/A' && prof !== '') line += ` (Prof: ${prof})`;
          if (detail) line += `\n  Detalles: ${detail}`;
          return line;
        })
        .join('\n');

      if (combined) {
        combined += `\n\n--- LÍNEA DE TIEMPO / HISTORIAL DE EVENTOS ---\n${timelineStr}`;
      } else {
        combined = `LÍNEA DE TIEMPO / HISTORIAL DE EVENTOS:\n${timelineStr}`;
      }
    }
    return combined;
  };

  const effectiveTimeline = timeline || patient?.timeline || [];
  const hasClinicalData = !!(historyText?.trim() || (files && files.length > 0) || (effectiveTimeline && effectiveTimeline.length > 0));

  // --- GENERADOR DE RESUMEN CLÍNICO ---
  const generateClinicalSummary = async (
    context: string,
    regenParams?: { drugName: string; formId: string; accumulatedCorrections: string }
  ) => {
    if (!hasClinicalData) {
        alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
        return;
    }

    const drugName = regenParams?.drugName ?? window.prompt(`Ingrese el nombre de la droga/medicación para el trámite de ${context}:`);
    if (!drugName || drugName.trim() === "") return;

    const panelId = regenParams?.formId ?? ('summary-' + context);
    setProcessingId('summary');
    setStatus('Analizando historia clínica y línea de tiempo...');

    try {
        const today = new Date().toLocaleDateString('es-AR'); 

        let strategyPrompt = "";
        if (context === 'RENOVACIÓN') {
            strategyPrompt = `ESTRATEGIA: RENOVACIÓN DE ${drugName.toUpperCase()}. Objetivo: Demostrar beneficio clínico y tolerancia.`;
        } else {
            strategyPrompt = `ESTRATEGIA: ADMISIÓN / SOLICITUD DE ${drugName.toUpperCase()}. Objetivo: Justificar indicación inicial (ignorar continuidad si ya la tomó).`;
        }

        // CAMBIO 3: subtítulo correcto según entidad
        const entityLabel = context === 'SOLICITUD'
          ? 'DINADIC - Dir. de Asistencia Directa por Situaciones Especiales'
          : `${context} - BANCO DE DROGAS`;

        const prompt = `
        Actúa como un Oncólogo Experto. Redacta un RESUMEN DE HISTORIA CLÍNICA para: ${entityLabel}.
        
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
        
        CONTEXTO: ${getEffectiveClinicalContext()}${regenParams?.accumulatedCorrections ? `\n\nCORRECCIONES SOLICITADAS POR EL MÉDICO (incorporar todas):\n${regenParams.accumulatedCorrections}` : ''}
        `;

        const parts: any[] = [{ text: prompt }];
        if (files && files.length > 0) {
            files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
        }

        const res = await callGemini({ parts });
        const summaryText = res.text || "No se pudo generar el texto.";

        setStatus('Generando PDF...');

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        
        const marginX = 50; 
        const marginTop = 30;
        const marginBottom = 50; 
        let y = height - marginTop;

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
        } catch { /* logo load failed, use text fallback */ }

        if (!logoLoaded) {
            const headerText = "HOSPITAL ONCOLÓGICO PROVINCIAL - CÓRDOBA";
            const headerWidth = fontBold.widthOfTextAtSize(headerText, 14);
            page.drawText(headerText, { x: (width - headerWidth) / 2, y: y, size: 14, font: fontBold });
            y -= 30;
        }

        page.drawLine({ start: { x: marginX, y: y }, end: { x: width - marginX, y: y }, thickness: 1.5, color: rgb(0, 0, 0) });
        y -= 25;

        const docTitle = "RESUMEN DE HISTORIA CLÍNICA";
        const docSubTitle = entityLabel;
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
        const newAccumulated = regenParams?.accumulatedCorrections ?? '';
        setLastRegenParams(prev => ({ ...prev, [panelId]: { drugName: drugName.trim(), context, formId: panelId, accumulatedCorrections: newAccumulated } }));
        setFormGenerated(prev => ({ ...prev, [panelId]: true }));
        setFormCorrections(prev => ({ ...prev, [panelId]: '' }));

    } catch (e: any) { alert("Error: " + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  // --- AUTOMATIZACIÓN Y FLUJO AVANZADO PAMI ---
  const resolveDrugDetails = async (
    drugs: string[],
    patientWeight: string,
    patientHeight: string,
    diagnosis: string
  ) => {
    const activeDrugs = drugs.filter(d => d && d.trim());
    if (activeDrugs.length === 0) return [];

    const prompt = `
      Actúa como un MÉDICO ONCÓLOGO EXPERTO.
      Paciente: Diagnóstico: "${diagnosis}", Peso: "${patientWeight} kg", Talla: "${patientHeight} cm".
      Lista de drogas solicitadas: ${JSON.stringify(activeDrugs)}.
      
      Para cada droga de la lista, completa sus parámetros para el formulario oficial PAMI:
      - droga: Nombre genérico oficial (ej: "Leuprolide", "Darolutamida", "Pembrolizumab", "Carboplatino", "Paclitaxel", "Osimertinib", "Docetaxel", "Capecitabina").
      - presentacion: Presentación farmacéutica habitual en Argentina (ej: "Fco amp 22.5 mg", "Comp 300 mg", "Fco amp 100 mg / 4 ml", "Comp 80 mg", "Fco amp 150 mg / 15 ml", "Fco amp 300 mg / 50 ml").
      - dosis: Dosis posológica estándar recomendada calculada según peso/BSA si corresponde o dosis habitual de ficha técnica (ej: "22.5 mg IM", "600 mg VO cada 12 hs", "200 mg EV", "AUC 5 (750 mg) EV", "175 mg/m² (295 mg) EV", "80 mg VO diario").
      - duracion_dias: Frecuencia y duración habitual (ej: "Cada 84 días / Hasta prog/tox", "Continuo / Hasta prog/tox", "Cada 21 días / 6 ciclos", "Cada 28 días / Hasta prog/tox").

      Devolver ÚNICAMENTE un array JSON válido sin formato markdown:
      [
        { "droga": "", "presentacion": "", "dosis": "", "duracion_dias": "" }
      ]
    `;

    try {
      const res = await callGemini({ parts: [{ text: prompt }], responseMimeType: "application/json" });
      const text = res.text || "[]";
      let cleanText = text.replace(/```json|```/g, '').trim();
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }
      return JSON.parse(cleanText);
    } catch (e) {
      console.error("Error completando detalles de drogas:", e);
      return activeDrugs.map(d => ({ droga: d, presentacion: '', dosis: '', duracion_dias: '' }));
    }
  };

  const extractPamiData = async (correction?: string) => {
    const today = new Date().toLocaleDateString('es-AR');
    
    const promptText = `
        Actúa como un MÉDICO ONCÓLOGO EXPERTO. Hoy es ${today}.
        OBJETIVO: Extraer y deducir de forma experta todos los datos requeridos para completar el formulario PAMI Oncológico oficial de provisión de medicamentos.
        IDIOMA: Todo en español.
        
        REGLAS DE EXTRACCIÓN Y DEDUCCIÓN CLÍNICA:
        1. fecha_diagnostico_inicial: DEDUCE OBLIGATORIAMENTE la fecha de diagnóstico analizando la fecha del primer estudio patológico, biopsia o consulta inicial en los eventos de la Línea de Tiempo o Historia Clínica (Formato DD/MM/AAAA).
        2. histopatologico: Resumen MUY CONCISO Y SINTÉTICO de la anatomía patológica e inmunohistoquímica (tipo tumoral, grado, RE, RP, HER2, Ki67, mutaciones si aplican). MÁXIMO 180-200 caracteres. ❌ NO explayarse en párrafos extensos.
        3. antecedentes_qx: EXCLUSIVAMENTE procedimientos QUIRÚRGICOS con fecha aproximada (ej: "Mastectomía radical mod. (02/2024)", "Nefrectomía (05/2023)"). ❌ NUNCA colocar tratamientos sistémicos (quimioterapia o drogas) en antecedentes quirúrgicos.
        4. antecedentes_radio: Resumen CONCISO usando abreviaturas médicas estándar (RT=radioterapia, QRT=quimiorradioterapia, BT=braquiterapia, IMRT, SBRT). Incluir dosis y fecha si están disponibles. Máximo 120 caracteres. Ej: "RT adyuvante 50 Gy + boost (09-10/2023)".
        5. fecha_nacimiento (paciente_fnac): Buscar "Fecha nac.:", "Fecha de nacimiento:", "F. Nac" o deducir si está disponible. Formato DD/MM/AAAA.
        6. estadio_inicial: Estadio FIGO o TNM al momento del diagnóstico inicial (ej: "FIGO IVB", "T2N1M0 Estadio IIB", "miT3b N1 M0"). NO el actual.
        7. estadio_actual: Estado de la enfermedad actual (ej: "Enfermedad localmente avanzada (miT3b N1 M0)", "Progresión", "Respuesta parcial", "Remisión completa").
        8. linea_tratamiento: Línea de tratamiento actual (ej: "1ra línea", "2da línea", "Adyuvancia", "Mantenimiento").
        9. laboratorio_formateado: SOLO parámetros oncológicamente relevantes o positivos (hemograma, función renal/hepática, marcadores tumorales como PSA, CEA, CA125). Formato conciso: "Hb 12g/dl, Cr 0.8, PSA 2.27 ng/ml". Máximo 110 caracteres.
        10. INFORME CLÍNICO ACTUAL Y JUSTIFICACIÓN ONCOLÓGICA DETALLADA (informe_clinico_detallado):
            - Redactar un informe clínico oncológico EXHAUSTIVO, PRECISO Y CRONOLÓGICO estructurado en párrafos claros que detalle todos los hitos diagnósticos, imagenológicos y terapéuticos del paciente para fundamentar de manera irrefutable la indicación del esquema de tratamiento oncológico.
            - ESTRUCTURA Y HITOS OBLIGATORIOS (adaptados a cada paciente según sus antecedentes):
              * Párrafo 1 (Diagnóstico inicial, histología y presentación): Edad del paciente, diagnóstico oncológico exacto con histopatología completa (tipo histológico, grado, Gleason, porcentaje de patrones/ductal/cribiforme si aplica, invasión perineural/vascular, biomarcadores RE/RP/HER2/Ki67/BRCA/mutaciones), fecha exacta de biopsia y forma de presentación/marcadores iniciales (ej. PSA, CEA, CA125, etc. con fechas).
              * Párrafo 2 (Evolución por imágenes y estadificación cronológica con fechas): Detallar cronológicamente los estudios complementarios con fechas y hallazgos clave (RMN, Centellograma, TAC, PET/CT, PET-PSMA, etc.), valores cuantitativos relevantes (SUV máx, medidas en mm/cm), estadificación TNM o FIGO inicial y reestadificación si hubo cambios de estadio o descarte/confirmación de secundarismo.
              * Párrafo 3 (Estrategia terapéutica, justificación del esquema y plan actual): Objetivo terapéutico (intención curativa, control sistémico avanzado, adyuvancia, rescate), tratamientos previos realizados o suspendidos/modificados con sus motivos, y justificación oncológica detallada del esquema propuesto en el plan médico actual con fechas.
            - EXTENSIÓN: Entre 850 y 1400 caracteres (aproximadamente 2 a 3 párrafos compactos y densos de información médica). Texto corrido en español con saltos de línea entre párrafos, sin asteriscos ni markdown.
        11. DROGAS / FÁRMACOS RELEVANTES DEL PLAN ACTUAL (droga_1, droga_2, droga_3, droga_4):
            - Si en la historia clínica o plan actual figuran drogas indicadas (ej: Leuprolide, Darolutamida, Pembrolizumab, etc.), colocarlas en droga_1, droga_2, droga_3, droga_4. Si no están especificadas, devolver cadena vacía "".
        12. motivo_solicitud: Elegir EXACTAMENTE uno: "Inicio", "Renovación", "Cambio de Toxicidad", "Cambio por Progresión".
        13. tipo_tratamiento: Elegir EXACTAMENTE uno: "Adyuvante", "Neoadyuvante", "Avanzado".
        14. esquema_tratamiento_solicitado: Nombre del esquema o combinación solicitada si figura en el plan.
        15. Si un dato no se encuentra disponible en la historia clínica o eventos, devolver cadena vacía "".
        
        Devolver ÚNICAMENTE este objeto JSON sin markdown:
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
          "motivo_solicitud": "Inicio",
          "tipo_tratamiento": "Avanzado",
          "ciclos_planeados": "",
          "frecuencia_dias": "",
          "esquema_tratamiento_solicitado": "",
          "droga_1": "",
          "droga_2": "",
          "droga_3": "",
          "droga_4": ""
        }
    `;

    const correctionNote = correction ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${correction}. Incorporar en los campos correspondientes.` : '';
    const parts: any[] = [{ text: promptText + `\nCONTEXTO CLÍNICO:\n${getEffectiveClinicalContext()}${correctionNote}` }];
    if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

    const res = await callGemini({ parts, responseMimeType: "application/json" });
    const text = res.text || "{}";
    let cleanText = text.replace(/```json|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    return JSON.parse(cleanText);
  };

  const handleStartPamiFlow = async (correction?: string) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }
    setProcessingId('pami');
    setStatus('Analizando historia clínica y preparando formulario PAMI...');

    try {
      const aiData = await extractPamiData(correction);
      
      const mergedData = {
        paciente_nombre_real: aiData.paciente_nombre_real || patient.name || '',
        paciente_fnac: cleanDate(aiData.paciente_fnac) || aiData.paciente_fnac || patient.birthDate || '',
        paciente_celular: aiData.paciente_celular || patient.phone || '',
        diagnostico_cie10: aiData.diagnostico_cie10 || patient.primaryDiagnosis || '',
        histopatologico: aiData.histopatologico || '',
        peso: aiData.peso || patient.weight || '',
        talla: aiData.talla || patient.height || '',
        ecog: aiData.ecog || patient.ecog || '',
        estadio_inicial: aiData.estadio_inicial || patient.stage || '',
        estadio_actual: aiData.estadio_actual || '',
        fecha_diagnostico_inicial: cleanDate(aiData.fecha_diagnostico_inicial) || aiData.fecha_diagnostico_inicial || '',
        linea_tratamiento: aiData.linea_tratamiento || '',
        antecedentes_qx: aiData.antecedentes_qx || '',
        antecedentes_radio: aiData.antecedentes_radio || '',
        laboratorio_formateado: aiData.laboratorio_formateado || '',
        informe_clinico_detallado: aiData.informe_clinico_detallado || '',
        motivo_solicitud: aiData.motivo_solicitud || 'Inicio',
        tipo_tratamiento: aiData.tipo_tratamiento || 'Avanzado',
        ciclos_planeados: aiData.ciclos_planeados || '',
        frecuencia_dias: aiData.frecuencia_dias || '',
        esquema_tratamiento_solicitado: aiData.esquema_tratamiento_solicitado || '',
        droga_1: aiData.droga_1 || '',
        droga_2: aiData.droga_2 || '',
        droga_3: aiData.droga_3 || '',
        droga_4: aiData.droga_4 || '',
      };

      setPamiFormData(mergedData);
      setShowPamiReviewModal(true);
    } catch (e: any) {
      alert("Error al preparar formulario PAMI: " + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  const fillPamiPDFFromData = async (data: typeof pamiFormData) => {
    setProcessingId('pami');
    setStatus('Completando datos de medicación y generando PDF PAMI...');

    try {
      const bsa = calculateBSA(data.peso, data.talla);
      const finalName = data.paciente_nombre_real || patient.name;

      // Resuelve automáticamente presentación, dosis y duración para las drogas indicadas
      const activeDrugs = [data.droga_1, data.droga_2, data.droga_3, data.droga_4].map(d => (d || '').trim()).filter(Boolean);
      let drugDetails: Array<{ droga: string; presentacion: string; dosis: string; duracion_dias: string }> = [];
      if (activeDrugs.length > 0) {
        drugDetails = await resolveDrugDetails(activeDrugs, data.peso, data.talla, data.diagnostico_cie10);
      }

      const formUrl = window.location.origin + '/forms/pami.pdf';
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró /forms/pami.pdf`);
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      const setText = (name: string, val: string, maxFontSize: number = 10, minFontSize: number = 6) => {
        try {
          const f = form.getTextField(name);
          if (!val || !String(val).trim()) return;
          const text = String(val).trim();
          let fieldWidth = 350;
          try {
            const widgets = (f as any).acroField.getWidgets();
            if (widgets && widgets.length > 0) {
              const rect = widgets[0].getRectangle();
              fieldWidth = Math.max(rect.width - 6, 50);
            }
          } catch { /* field rect unavailable */ }
          let fontSize = maxFontSize;
          const AVG_CHAR_RATIO = 0.52;
          while (fontSize > minFontSize) {
            const estimatedWidth = text.length * AVG_CHAR_RATIO * fontSize;
            if (estimatedWidth <= fieldWidth) break;
            fontSize = Math.round((fontSize - 0.5) * 10) / 10;
          }
          f.setText(text);
          f.setFontSize(fontSize);
        } catch { /* field not found in form */ }
      };

      const setCheck = (name: string, shouldCheck: boolean) => {
        try {
          if (shouldCheck) form.getCheckBox(name).check();
          else form.getCheckBox(name).uncheck();
        } catch { /* field not found */ }
      };

      // Patient info
      setText('Apellido y Nombre', finalName);
      setText('fill_21', cleanDate(data.paciente_fnac) || data.paciente_fnac);
      setText('Fecha de nacimiento', cleanDate(data.paciente_fnac) || data.paciente_fnac);
      setText('NUMERO CELULAR', data.paciente_celular);
      setText('NUMERO CELULAR 1', data.paciente_celular);

      // Clinical & staging
      setText('Diagnóstico (CIE 10)', data.diagnostico_cie10);
      setText('Diagnóstico CIE 10', data.diagnostico_cie10);
      setText('Histopatológico', data.histopatologico, 9, 6.5);
      setText('ECOG Performance Status (0-4)', data.ecog);
      setText('ECOG', data.ecog);
      setText('Estadío actual', data.estadio_actual);
      setText('Estadio actual', data.estadio_actual);
      setText('Estadio Inicial', data.estadio_inicial);
      setText('Fecha de Diagnóstico Inicial', data.fecha_diagnostico_inicial);
      setText('Fecha diagnostico inicial', data.fecha_diagnostico_inicial);
      setText('Fecha de Diagnóstico Inicial Estadio Inicial', data.estadio_inicial);
      setText('Línea de tratamiento', data.linea_tratamiento);
      setText('Línea tratamiento', data.linea_tratamiento);
      setText('Ciclos', data.ciclos_planeados);
      setText('Días', data.frecuencia_dias);
      setText('Ciclos Días', data.frecuencia_dias);

      // Antecedents & labs
      setText('Antecedentes Quirúrgicos', data.antecedentes_qx, 9, 7);
      setText('Antecedentes Terapia Radiante', data.antecedentes_radio, 9, 7);
      
      // EL INFORME CLÍNICO VA EXCLUSIVAMENTE EN EL CUADRO GRANDE (Informe Clínico ActualRow1)
      // La tira angosta al lado del título (Informe clínico actual) se deja deliberadamente vacía.
      try {
        const fTitleStrip = form.getTextField('Informe clínico actual');
        fTitleStrip.setText('');
      } catch { /* skip */ }

      try {
        const fLargeBox = form.getTextField('Informe Clínico ActualRow1');
        if (data.informe_clinico_detallado && data.informe_clinico_detallado.trim()) {
          const reportText = data.informe_clinico_detallado.trim();
          fLargeBox.enableMultiline();
          const fontSize = reportText.length > 1300 ? 7.8 : reportText.length > 1000 ? 8.2 : 8.5;
          fLargeBox.setFontSize(fontSize);
          fLargeBox.setText(reportText);
        }
      } catch { /* skip */ }

      setText('Datos positivos Laboratorio', data.laboratorio_formateado, 8.5, 7);
      setText('Peso', data.peso);
      setText('Talla', data.talla);
      setText('Sup. Corporal', bsa);
      setText('Sup Corpora', bsa);
      setText('Esquema de tratamiento solicitado', data.esquema_tratamiento_solicitado || activeDrugs.join(' + '));

      // Checkboxes Motivo
      const motivo = (data.motivo_solicitud || '').toLowerCase();
      setCheck('Inicio', motivo.includes('inicio'));
      setCheck('Renovación', motivo.includes('renovac'));
      setCheck('Cambio de Toxicidad', motivo.includes('toxicidad'));
      setCheck('Cambio por Progresión', motivo.includes('progresi'));

      // Checkboxes Tipo de Tratamiento
      const tipo = (data.tipo_tratamiento || '').toLowerCase();
      setCheck('Adyuvante', tipo.includes('adyuvante') && !tipo.includes('neo'));
      setCheck('Neoadyuvante', tipo.includes('neoadyuvante'));
      setCheck('Avanzado', tipo.includes('avanzado'));

      // Drugs Table (Rows 1 to 4)
      for (let i = 1; i <= 4; i++) {
        const d = drugDetails[i - 1];
        if (d && d.droga) {
          setText(`DrogaGenéricoRow${i}`, d.droga, 9, 7);
          setText(`PresentaciónRow${i}`, d.presentacion, 8.5, 6.5);
          setText(`DosisRow${i}`, d.dosis, 8.5, 6.5);
          setText(`N CiclosDuración díasRow${i}`, d.duracion_dias || data.frecuencia_dias, 8.5, 6.5);
        } else {
          setText(`DrogaGenéricoRow${i}`, '');
          setText(`PresentaciónRow${i}`, '');
          setText(`DosisRow${i}`, '');
          setText(`N CiclosDuración díasRow${i}`, '');
        }
      }

      // Doctor information
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
      setText('Celular', doctorData.cel_area);
      setText('Celular_2', doctorData.cel_area);
      setText('Celular1', doctorData.cel_num);
      setText('Lugar y fecha', `Córdoba, ${new Date().toLocaleDateString('es-AR')}`);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PAMI_${finalName}.pdf`;
      link.click();
      setStatus('¡Listo!');
      
      const effectiveDrug = activeDrugs.join(' + ') || 'PAMI';
      setLastRegenParams(prev => ({
        ...prev,
        pami: {
          drugName: effectiveDrug,
          accumulatedCorrections: prev['pami']?.accumulatedCorrections || ''
        }
      }));
      setFormGenerated(prev => ({ ...prev, pami: true }));
      setFormCorrections(prev => ({ ...prev, pami: '' }));
      setShowPamiReviewModal(false);
    } catch (e: any) {
      alert('Error al generar PDF de PAMI: ' + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  const fillPamiPDF = async (formDef: any, regenParams?: { drugName?: string; correction?: string }) => {
    handleStartPamiFlow(regenParams?.correction);
  };

  // CAMBIO 4: extractBancoDrogasData recibe drugName
  const extractBancoDrogasData = async (context: string, drugName: string, correction?: string) => {
    const today = new Date().toLocaleDateString('es-AR');
    const isRenovacion = context === 'RENOVACIÓN';

    const prompt = `
      Actúa como oncólogo experto. Hoy es ${today}. Analizá la historia clínica y extraé datos para el formulario Banco de Drogas ${context}.
      FÁRMACO SOLICITADO POR EL MÉDICO: ${drugName}. Usar en droga_1.
      IDIOMA: Todo en español. Devolvé ÚNICAMENTE JSON sin markdown.

      REGLAS DE EXTRACCIÓN Y DEDUCCIÓN:
      - fecha_diagnostico: DEDUCE OBLIGATORIAMENTE la fecha de diagnóstico inicial analizando las fechas del primer estudio patológico, biopsia o consulta diagnóstica inicial en los eventos de la Línea de Tiempo o Historia Clínica (Formato DD/MM/AAAA).

      ${isRenovacion ? `
      CONTEXTO RENOVACIÓN: El paciente ya tiene tratamiento aprobado y solicita continuarlo.
      - motivo_renovacion: "continua" si sigue igual, "cambio" si hubo toxicidad o progresión
      - ciclos_realizados: número de ciclos ya completados
      - ciclos_programados: número total planificado
      - respuesta: "estable", "parcial" o "completa"
      - sitio_progresion: si hubo progresión, dónde
      ` : `
      CONTEXTO ADMISIÓN: Primera solicitud del tratamiento.
      - anatomia_patologica: Resumen MUY CONCISO Y SINTÉTICO de la patología e inmunohistoquímica (tipo tumoral, grado, RE, RP, HER2, Ki67). MÁXIMO 180-200 caracteres. ❌ NO explayarse en párrafos extensos.
      - tnm_t, tnm_n, tnm_m: clasificación TNM si existe
      - receptor_RE, receptor_RP, receptor_HER2, receptor_KRAS, receptor_EGER: positivo/negativo/no aplica
      - tratamiento_previo_cx_si: true si tuvo cirugía de tumor primario
      - cx_especificar: EXCLUSIVAMENTE la descripción del procedimiento QUIRÚRGICO (ej: "Mastectomía radical", "Resección de colon", "Nefrectomía"). ❌ NUNCA colocar tratamientos sistémicos (quimioterapia, esquemas de drogas como AC-T o inmunoterapia) en cx_especificar.
      - cx_ganglios_resecados: número si aplica
      - cx_ganglios_comprometidos: número si aplica
      - cx_metastasis_si: true si tuvo cirugía de metástasis
      - rt_primario_si: true si tuvo RT en tumor primario
      - rt_metastasis_si: true si tuvo RT en metástasis
      - rt_localizacion: dónde
      - tratamientos_sistemicos_si: true si tuvo quimio/hormonoterapia/biologicos previos
      - qt_tipo: "neoadyuvante", "adyuvante" o "avanzado"
      - qt_droga: nombre de la droga de quimioterapia o tratamiento sistémico
      `}

      Campos comunes requeridos:
      {
        "nombre_apellido": "",
        "dni": "",
        "fnac": "DD/MM/AAAA",
        "edad": "",
        "sexo": "M" o "F",
        "domicilio": "",
        "telefono": "",
        "localidad": "",
        "provincia": "Córdoba",
        "pais": "Argentina",
        "institucion": "Hospital Oncológico Provincial - Córdoba",
        "diagnostico": "",
        "fecha_diagnostico": "DD/MM/AAAA",
        "cie10": "",
        "estadio": "",
        "sup_corporal": "",
        "peso": "",
        "talla": "",
        "ecog": "0",
        "tipo_tratamiento": "adyuvante/neoadyuvante/avanzado",
        "linea": "1",
        "droga_1": "${drugName}", "dosis_1": "", "dias_1": "", "total_dia_1": "",
        "droga_2": "", "dosis_2": "", "dias_2": "", "total_dia_2": "",
        "droga_3": "", "dosis_3": "", "dias_3": "", "total_dia_3": "",
        "intervalo_ciclo": "",
        "ciclos_programados": "",
        "lugar_fecha": "${today} - Córdoba",
        "contacto_institucional": "",
        ${isRenovacion ? `
        "motivo_renovacion": "continua",
        "ciclos_realizados": "",
        "respuesta": "estable",
        "sitio_progresion": "",
        "receptor_RE": "", "receptor_RP": "", "receptor_HER2": "", "receptor_KRAS": "", "receptor_EGER": ""
        ` : `
        "anatomia_patologica": "",
        "tnm_t": "", "tnm_n": "", "tnm_m": "",
        "receptor_RE": "", "receptor_RP": "", "receptor_HER2": "", "receptor_KRAS": "", "receptor_EGER": "",
        "tratamiento_previo_cx_si": false,
        "cx_especificar": "", "cx_ganglios_resecados": "", "cx_ganglios_comprometidos": "",
        "cx_metastasis_si": false, "cx_fecha": "",
        "rt_primario_si": false, "rt_metastasis_si": false, "rt_localizacion": "",
        "tratamientos_sistemicos_si": false,
        "qt_tipo": "", "qt_droga": ""
        `}
      }

      CONTEXTO CLÍNICO: ${getEffectiveClinicalContext()}${correction ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${correction}. Incorporar en los campos correspondientes.` : ''}
    `;

    const parts: any[] = [{ text: prompt }];
    if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

    const res = await callGemini({ parts, responseMimeType: "application/json" });
    let clean = res.text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1) clean = clean.substring(s, e + 1);
    return JSON.parse(clean);
  };

  const fillAdmisionPDF = async (formDef: any, regenParams?: { drugName: string; correction: string }) => {
    if (!hasClinicalData) { alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero."); return; }
    const drugName = regenParams?.drugName ?? window.prompt('Ingrese el/los fármaco/s para la Admisión Banco de Drogas:');
    if (!drugName || !drugName.trim()) return;

    setProcessingId(formDef.id);
    setStatus('Procesando Admisión...');
    try {
      const d = await extractBancoDrogasData('ADMISIÓN', drugName, regenParams?.correction);
      const bsa = calculateBSA(d.peso, d.talla);
      const [fnd, fnm, fna] = (cleanDate(d.fnac) || '').split('/');
      const [dxd, dxm, dxa] = (cleanDate(d.fecha_diagnostico) || '').split('/');

      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
      const form = pdfDoc.getForm();

      const setT = (name: string, val: string, max = 10, min = 7) => {
        try {
          const f = form.getTextField(name);
          if (!val?.trim()) return;
          const text = String(val).trim();
          let fs = max, w = 350;
          try { const r = (f as any).acroField.getWidgets()[0].getRectangle(); w = Math.max(r.width - 4, 30); } catch { /* widget rect unavailable */ }
          while (fs > min && text.length * 0.52 * fs > w) fs = Math.round((fs - 0.5) * 10) / 10;
          f.setText(text); f.setFontSize(fs);
        } catch { /* field not found in form, skip */ }
      };
      const setBtn = (name: string) => { try { form.getCheckBox(name).check(); } catch { /* field not found */ } };

      setT('Text1', d.nombre_apellido);
      setT('Text2', 'Argentina');
      setT('Text3', fnd); setT('Text4', fnm); setT('Text5', fna);
      setT('Text6', d.dni);
      setT('Text11', d.edad);
      setT('Text12', d.domicilio);
      setT('Text13', d.telefono);
      setT('Text14', d.localidad);
      setT('Text15', d.provincia);
      setT('Text16', d.pais);
      setT('Text17', d.institucion);
      setT('Text18', d.diagnostico);
      setT('Text19', d.cie10);

      if (d.sexo === 'F') setBtn('Button9'); else setBtn('Button8');

      setT('Text20', d.receptor_RE);
      setT('Text21', d.receptor_RP);
      setT('Text22', d.receptor_HER2);
      setT('Text23', d.receptor_KRAS);
      setT('Text24', d.receptor_EGER);

      setT('Text27', dxd); setT('Text28', dxm); setT('Text29', dxa);
      setT('Text30', d.tnm_t); setT('Text31', d.tnm_n); setT('Text32', d.tnm_m);
      setT('Text33', d.estadio);

      const ap = d.anatomia_patologica || '';
      setT('Text34', ap.substring(0, 220), 9, 6.5);
      if (ap.length > 220) setT('Text35', ap.substring(220, 440), 9, 6.5);

      setT('Text36', bsa || d.sup_corporal);
      setT('Text37', d.peso);
      setT('Text38', d.talla);

      const ecogBtn = ['Button39','Button40','Button41','Button42'];
      const ecogIdx = parseInt(d.ecog || '0');
      if (ecogIdx >= 0 && ecogIdx <= 3) setBtn(ecogBtn[ecogIdx]);

      if (d.tratamientos_sistemicos_si) setBtn('Button44'); else setBtn('Button45');
      setT('Text46', d.qt_droga, 9, 6.5);

      if (d.rt_primario_si) setBtn('Button52'); else setBtn('Button53');
      if (d.rt_localizacion) setT('Text54', d.rt_localizacion, 9, 7);

      const tipo = (d.tipo_tratamiento || '').toLowerCase();
      if (tipo.includes('adyuvante') && !tipo.includes('neo')) setBtn('Button68');
      else if (tipo.includes('neoadyuvante')) setBtn('Button70');

      const lineaBtns: Record<string, string> = {'1':'Button89','2':'Button90','3':'Button91'};
      if (lineaBtns[d.linea]) setBtn(lineaBtns[d.linea]);

      setT('Text92', d.intervalo_ciclo);
      setT('Text94', d.ciclos_programados);

      const drugRows = [
        [d.droga_1, d.dosis_1, d.dias_1, d.total_dia_1, 'Text95','Text96','Text97','Text98'],
        [d.droga_2, d.dosis_2, d.dias_2, d.total_dia_2, 'Text99','Text100','Text101','Text102'],
        [d.droga_3, d.dosis_3, d.dias_3, d.total_dia_3, 'Text103','Text104','Text105','Text106'],
      ];
      drugRows.forEach(([drg, dos, dias, tot, td, tds, tdi, tto]) => {
        if (drg) { setT(td, String(drg).toUpperCase(), 9, 7); setT(tds, String(dos)); setT(tdi, String(dias)); setT(tto, String(tot)); }
      });

      setT('Text141', d.lugar_fecha);
      setT('Text142', `Hospital Oncológico Prov. Cba - ${doctorData.nombre} Mat.${doctorData.matricula}`);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `Admision_BancoDrogas_${d.nombre_apellido || patient.name}.pdf`; link.click();
      setStatus('¡Listo!');
      const newAccumulated = regenParams
        ? (lastRegenParams[formDef.id]?.accumulatedCorrections
            ? `${lastRegenParams[formDef.id].accumulatedCorrections}\n- ${regenParams.correction}`
            : `- ${regenParams.correction}`)
        : '';
      setLastRegenParams(prev => ({ ...prev, [formDef.id]: { drugName: drugName.trim(), accumulatedCorrections: newAccumulated } }));
      setFormGenerated(prev => ({ ...prev, [formDef.id]: true }));
      setFormCorrections(prev => ({ ...prev, [formDef.id]: '' }));
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  const fillRenovacionPDF = async (formDef: any, regenParams?: { drugName: string; correction: string }) => {
    if (!hasClinicalData) { alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero."); return; }
    const drugName = regenParams?.drugName ?? window.prompt('Ingrese el/los fármaco/s para la Renovación Banco de Drogas:');
    if (!drugName || !drugName.trim()) return;

    setProcessingId(formDef.id);
    setStatus('Procesando Renovación...');
    try {
      const d = await extractBancoDrogasData('RENOVACIÓN', drugName, regenParams?.correction);
      const bsa = calculateBSA(d.peso, d.talla);
      const [fnd, fnm, fna] = (cleanDate(d.fnac) || '').split('/');

      const formUrl = window.location.origin + formDef.file;
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró ${formDef.file}`);
      const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
      const form = pdfDoc.getForm();

      const setT = (name: string, val: string, max = 10, min = 7) => {
        try {
          const f = form.getTextField(name);
          if (!val?.trim()) return;
          const text = String(val).trim();
          let fs = max, w = 350;
          try { const r = (f as any).acroField.getWidgets()[0].getRectangle(); w = Math.max(r.width - 4, 30); } catch { /* widget rect unavailable */ }
          while (fs > min && text.length * 0.52 * fs > w) fs = Math.round((fs - 0.5) * 10) / 10;
          f.setText(text); f.setFontSize(fs);
        } catch { /* field not found in form, skip */ }
      };
      const setBtn = (name: string) => { try { form.getCheckBox(name).check(); } catch { /* field not found */ } };

      setT('Text2', d.nombre_apellido);
      setT('Text3', 'Argentina');
      setT('Text4', fnd); setT('Text5', fnm); setT('Text6', fna);
      setT('Text7', d.dni);
      setT('Text12', d.edad);
      setT('Text13', d.domicilio);
      setT('Text14', d.telefono);
      setT('Text15', d.localidad);
      setT('Text16', d.provincia);
      setT('Text17', d.pais);
      setT('Text19', d.institucion);
      setT('Text20', d.diagnostico);
      setT('Text21', d.cie10);

      if (d.sexo === 'F') setBtn('Button10'); else setBtn('Button9');

      if ((d.motivo_renovacion || '').includes('continua')) setBtn('Button23'); else setBtn('Button24');

      if (d.sitio_progresion) setT('Text31', d.sitio_progresion, 9, 6.5);

      setT('Text32', d.receptor_RE);
      setT('Text33', d.receptor_RP);
      setT('Text34', d.receptor_HER2);
      setT('Text35', d.receptor_KRAS);
      setT('Text36', d.receptor_EGER);

      setT('Text51', bsa || d.sup_corporal);
      setT('Text52', d.peso);
      setT('Text53', d.talla);

      const ecogBtn = ['Button57','Button58','Button59','Button60'];
      const ecogIdx = parseInt(d.ecog || '0');
      if (ecogIdx >= 0 && ecogIdx <= 3) setBtn(ecogBtn[ecogIdx]);

      const tipo = (d.tipo_tratamiento || '').toLowerCase();
      if (tipo.includes('adyuvante') && !tipo.includes('neo')) { setBtn('Button62'); }
      else if (tipo.includes('neoadyuvante')) { setBtn('Button64'); }
      else if (tipo.includes('avanzado')) { setBtn('Button66'); }

      const lineaBtns: Record<string, string> = {'1':'Button68','2':'Button69','3':'Button70'};
      if (lineaBtns[d.linea]) setBtn(lineaBtns[d.linea]);

      setT('Text71', d.intervalo_ciclo);
      setT('Text72', d.ciclos_realizados);
      setT('Text73', d.ciclos_programados);

      const resp = (d.respuesta || '').toLowerCase();
      if (resp.includes('estable')) setBtn('Button137');
      else if (resp.includes('parcial')) setBtn('Button138');
      else if (resp.includes('completa')) setBtn('Button139');

      const drugRows = [
        [d.droga_1, d.dosis_1, d.dias_1, d.total_dia_1, 'Text76','Text79','Text80','Text81'],
        [d.droga_2, d.dosis_2, d.dias_2, d.total_dia_2, 'Text82','Text83','Text84','Text85'],
        [d.droga_3, d.dosis_3, d.dias_3, d.total_dia_3, 'Text86','Text87','Text88','Text89'],
      ];
      drugRows.forEach(([drg, dos, dias, tot, td, tds, tdi, tto]) => {
        if (drg) { setT(td, String(drg).toUpperCase(), 9, 7); setT(tds, String(dos)); setT(tdi, String(dias)); setT(tto, String(tot)); }
      });

      setT('Text140', d.lugar_fecha);
      setT('Text141', `Hospital Oncológico Prov. Cba - ${doctorData.nombre} Mat.${doctorData.matricula}`);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `Renovacion_BancoDrogas_${d.nombre_apellido || patient.name}.pdf`; link.click();
      setStatus('¡Listo!');
      const newAccumulated = regenParams
        ? (lastRegenParams[formDef.id]?.accumulatedCorrections
            ? `${lastRegenParams[formDef.id].accumulatedCorrections}\n- ${regenParams.correction}`
            : `- ${regenParams.correction}`)
        : '';
      setLastRegenParams(prev => ({ ...prev, [formDef.id]: { drugName: drugName.trim(), accumulatedCorrections: newAccumulated } }));
      setFormGenerated(prev => ({ ...prev, [formDef.id]: true }));
      setFormCorrections(prev => ({ ...prev, [formDef.id]: '' }));
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  const generateDinadicPDF = async (esquema?: typeof esquemaData) => {
  if (!hasClinicalData) {
    alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
    return;
  }

  // Si no viene esquema, es el primer llamado: pedir droga y abrir modal
  if (!esquema) {
    const drugName = window.prompt('Ingrese el/los fármaco/s a solicitar en el formulario DINADIC:');
    if (!drugName || !drugName.trim()) return;
    setPendingDinadicDrug(drugName);
    setEsquemaData(prev => ({ ...prev, medicamentos: drugName }));
    setShowEsquemaModal(true);
    return;
  }

  const drugName = pendingDinadicDrug;
  setProcessingId('dinadic');
    setStatus('Analizando historia clínica y línea de tiempo...');
    try {
      const today = new Date().toLocaleDateString('es-AR');

      const extractPrompt = `
Actúa como oncólogo experto. Hoy es ${today}.
Analizá la historia clínica y extraé datos para el formulario DINADIC (Solicitud de Medicamentos - DADSE).
FÁRMACO SOLICITADO POR EL MÉDICO: ${drugName}. Usar EXACTAMENTE este valor en el campo "medicamentos".
IDIOMA: Todo en español. Devolvé ÚNICAMENTE JSON sin markdown ni bloques de código.

{
  "nombre_apellido": "",
  "tipo_documento": "DNI",
  "numero_documento": "",
  "edad": "",
  "sexo": "Femenino o Masculino",
  "domicilio": "",
  "localidad": "",
  "provincia": "Córdoba",
  "telefono": "",
  "celular": "",
  "email": "",
  "diagnostico": "",
  "altura": "",
  "peso": "",
  "n_ciclo": "1",
  "fecha_diagnostico": "DD/MM/AAAA",
    "resumen_hc": "Resumen clínico con estadio e inmunohistoquímica. Narrativa cronológica. Máx 690 chars (6 líneas × 115).",
  "metodos_complementarios": "Estudios de imagen y laboratorio con fechas y resultados clave. Máx 575 chars (5 líneas).",
  "estado_general": "ECOG y comorbilidades relevantes. Máx 345 chars (3 líneas).",
 "tratamientos_previos": "Tratamientos oncológicos previos con fechas. Máx 345 chars (3 líneas).",
  "tipo_terapia_previa": "Cx, QT, RT, etc con fechas. Abreviaturas médicas. Máx 460 chars (4 líneas).",
  "fundamentacion": "Justificación oncológica MUY CONCISA. Máximo 2 oraciones. No más de 200 caracteres. Sin cortes abruptos, terminar siempre con punto final y con coherencia."
}

CONTEXTO CLÍNICO: ${getEffectiveClinicalContext()}${pendingDinadicCorrection ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${pendingDinadicCorrection}. Incorporar en los campos correspondientes.` : ''}
      `;

      const parts: any[] = [{ text: extractPrompt }];
      if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

      const res = await callGemini({ parts, responseMimeType: "application/json" });
      let clean = (res.text || '{}').replace(/```json|```/g, '').trim();
      const si = clean.indexOf('{'), ei = clean.lastIndexOf('}');
      if (si !== -1 && ei !== -1) clean = clean.substring(si, ei + 1);
      const d = JSON.parse(clean);
      let alturaCorregida = d.altura ? String(d.altura).replace(',', '.') : '';
if (alturaCorregida && parseFloat(alturaCorregida) < 3) alturaCorregida = String(Math.round(parseFloat(alturaCorregida) * 100));
const bsa = calculateBSA(d.peso, alturaCorregida);

      setStatus('Generando PDF...');

      const formUrl = window.location.origin + '/forms/nuevo_dinadic.pdf';
      const pdfRes = await fetch(formUrl);
      if (!pdfRes.ok) throw new Error('No se encontró el formulario DINADIC.');
      const pdfDoc = await PDFDocument.load(await pdfRes.arrayBuffer());
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pages = pdfDoc.getPages();
      const p1 = pages[0];
      const p2 = pages[1];
      const pH = 841.9;
      const FS = 8;
      const maxW = 480;
      const lineSpacing = 12;

      // CAMBIO 1: offset corregido a +3 (encima de la línea de puntos)
      const draw = (page: any, x: number, top: number, text: string, fs = FS, f = font) => {
        if (!text?.trim()) return;
        const str = String(text).trim();
        page.drawText(str, { x, y: pH - top + 3, size: fs, font: f });
      };

      const drawLines = (page: any, x: number, firstTop: number, text: string, maxLines: number, fs = FS) => {
        if (!text?.trim()) return;
        const charPerLine = Math.floor(maxW / (0.52 * fs));
        const words = String(text).trim().split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          if (lines.length >= maxLines) break;
          const test = cur ? cur + ' ' + w : w;
          if (test.length > charPerLine && cur) { lines.push(cur); cur = w; }
          else { cur = test; }
        }
        if (cur && lines.length < maxLines) lines.push(cur);
        lines.forEach((line, i) => {
          page.drawText(line, { x, y: pH - firstTop + 3 - i * lineSpacing, size: fs, font });
        });
      };

      // const markX = (page: any, x: number, top: number) => {
      //   page.drawText('X', { x, y: pH - top + 3, size: 9, font: fontBold });
      // };

      // ── PÁGINA 1 ──
      draw(p1, 153, 285.5, d.nombre_apellido);
draw(p1, 276, 297.5, `${d.tipo_documento || 'DNI'} ${d.numero_documento}`);
draw(p1, 87,  309.5, d.edad);
draw(p1, 229, 309.5, d.sexo);
draw(p1, 115, 321.5, d.domicilio);
draw(p1, 110, 333.5, d.localidad);
draw(p1, 347, 333.5, d.provincia || 'Córdoba');
draw(p1, 103, 345.5, d.telefono);
draw(p1, 318, 345.5, d.celular);
draw(p1, 152, 357.5, d.email);
draw(p1, 121, 369.5, d.diagnostico);
draw(p1, 114, 381.5, d.n_ciclo || '1');
draw(p1, 91,  393.5, alturaCorregida ? `${alturaCorregida} cm` : '');
draw(p1, 191, 393.5, d.peso ? `${d.peso} kg` : '');
draw(p1, 362, 393.5, bsa ? `${bsa} m²` : '');

      draw(p1, 253, 435.1, doctorData.nombre);
      draw(p1, 124, 446.6, doctorData.especialidad || 'Oncología Clínica');
      draw(p1, 100, 459.6, 'Oncología');
      draw(p1, 226, 483.1, doctorData.cel_area && doctorData.cel_num ? `${doctorData.cel_area} ${doctorData.cel_num}` : '');
      draw(p1, 96,  495.1, doctorData.cel_area && doctorData.cel_num ? `${doctorData.cel_area} ${doctorData.cel_num}` : '');
      draw(p1, 358, 495.6, doctorData.email);

      draw(p1, 121, 539.1, d.diagnostico);
      const [fdd, fdm, fda] = (cleanDate(d.fecha_diagnostico) || '').split('/');
draw(p1, 490, 539.1, fdd || '');
draw(p1, 512, 539.1, fdm || '');
draw(p1, 530, 539.1, fda || '');

      drawLines(p1, 57, 589.0, d.resumen_hc, 6);
drawLines(p1, 57, 697.0, d.metodos_complementarios, 5);

      // ── PÁGINA 2 ──
      drawLines(p2, 57, 89.6, d.estado_general, 3);  
      drawLines(p2, 57, 220.1, d.tratamientos_previos, 3);
      drawLines(p2, 57, 293.3, d.tipo_terapia_previa, 4);
      draw(p2, 173, 449.2, esquema.numero_ciclos);
draw(p2, 178, 461.2, esquema.frecuencia_ciclos);
draw(p2, 176, 475.2, esquema.tiempo_tratamiento);
      
      const [fid, fim, fia] = (cleanDate(esquema.fecha_inicio) || esquema.fecha_inicio || '').split('/');
draw(p2, 277, 487.2, fid || '');
draw(p2, 340, 487.2, fim || '');
draw(p2, 385, 487.2, fia || '');

      drawLines(p2, 57, 510.5, esquema.medicamentos, 3);
draw(p2, 230, 534.2, esquema.dosis_total_ciclo);
draw(p2, 344, 534.2, esquema.dias_admin);
draw(p2, 447, 534.2, esquema.intervalo);

      const fundTrunc = d.fundamentacion
  ? d.fundamentacion.length > 220
    ? d.fundamentacion.substring(0, d.fundamentacion.lastIndexOf(' ', 220)) + '.'
    : d.fundamentacion
  : '';
drawLines(p2, 57, 570.6, fundTrunc, 3);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `DINADIC_${d.nombre_apellido || patient.name}_${today.replace(/\//g, '-')}.pdf`;
      link.click();
      setStatus('¡Listo!');
      const prevDinadicCorrections = lastRegenParams['dinadic']?.accumulatedCorrections ?? '';
      const newDinadicAccumulated = pendingDinadicCorrection
        ? (prevDinadicCorrections ? `${prevDinadicCorrections}\n- ${pendingDinadicCorrection}` : `- ${pendingDinadicCorrection}`)
        : prevDinadicCorrections;
      setLastRegenParams(prev => ({ ...prev, dinadic: { drugName: drugName, accumulatedCorrections: newDinadicAccumulated } }));
      setPendingDinadicCorrection('');
      setFormGenerated(prev => ({ ...prev, dinadic: true }));
      setFormCorrections(prev => ({ ...prev, dinadic: '' }));
    } catch (e: any) {
      alert("Error al generar DINADIC: " + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  // ─── INTERCONSULTA / DERIVACIÓN ─────────────────────────────────────────────
  const generateInterconsultaPDF = async (regenParams?: { servicioDestino: string; motivoSolicitud: string; accumulatedCorrections: string }) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }

    const servicioDestino = regenParams?.servicioDestino ?? window.prompt('¿A qué servicio se deriva? (ej: Cirugía, Radiología, Ginecología, etc.)');
    if (!servicioDestino || !servicioDestino.trim()) return;

    const motivoSolicitud = regenParams?.motivoSolicitud ?? window.prompt('¿Cuál es el motivo de la interconsulta / derivación?');
    if (!motivoSolicitud || !motivoSolicitud.trim()) return;

    setProcessingId('interconsulta');
    setStatus('Analizando historia clínica y línea de tiempo...');
    try {
      const today = new Date().toLocaleDateString('es-AR');

      // 1. Extracción estructurada vía IA
      // CORRECCIÓN 1 y 2: narración en párrafo + unidades sin duplicar
      const extractPrompt = `
Actúa como oncólogo experto. Hoy es ${today}.
SERVICIO AL QUE SE DERIVA: ${servicioDestino}
MOTIVO INDICADO POR EL MÉDICO: ${motivoSolicitud}

Analizá la historia clínica y devolvé ÚNICAMENTE este JSON sin markdown:
{
  "nombre": "",
  "nhc": "",
  "fnac": "DD/MM/AAAA",
  "edad": "",
  "sexo": "Masculino/Femenino",
  "cobertura": "",
  "diagnostico": "",
  "estadio": "",
  "ecog": "0/1/2/3/4",
  "peso": "solo el número, sin unidad. Ej: 68",
  "talla": "solo el número en cm, sin unidad. Ej: 165",
  "tratamiento_actual": "",
  "laboratorio_reciente": "",
  "comorbilidades": "",
  "resumen_clinico": "Narrativa cronológica fluida en párrafos. Incluir: antecedentes relevantes, diagnóstico con fecha y método, tratamientos realizados con fechas y dosis, estudios de imagen con resultados clave, estado actual. Máx 1200 chars. SIN bullets, SIN asteriscos.",
  "motivo_derivacion": "Redactá el motivo de derivación al servicio de ${servicioDestino} integrando el motivo clínico indicado: '${motivoSolicitud}'. Contexto clínico resumido + justificación. Máx 400 chars."
}
REGLAS ESTRICTAS:
- ecog: devolver SOLO el número (0, 1, 2, 3 o 4). Sin letras ni prefijos.
- peso: SOLO el número sin "kg" ni ninguna unidad.
- talla: SOLO el número en centímetros, sin "cm" ni "m".
- Si un dato no está disponible devolver "".
CONTEXTO: ${getEffectiveClinicalContext()}${regenParams?.accumulatedCorrections ? `\n\nCORRECCIONES SOLICITADAS POR EL MÉDICO (incorporar en los campos correspondientes):\n${regenParams.accumulatedCorrections}` : ''}
      `;

      const parts: any[] = [{ text: extractPrompt }];
      if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

      const res = await callGemini({ parts, responseMimeType: "application/json" });
      let clean = (res.text || '{}').replace(/```json|```/g, '').trim();
      const si = clean.indexOf('{'), ei = clean.lastIndexOf('}');
      if (si !== -1 && ei !== -1) clean = clean.substring(si, ei + 1);
      const d = JSON.parse(clean);

      // Sanear valores numéricos: quitar unidades si la IA las incluyó igual
      const rawPeso  = String(d.peso  || '').replace(/[^0-9.,]/g, '').replace(',', '.');
      const rawTalla = String(d.talla || '').replace(/[^0-9.,]/g, '').replace(',', '.');
      // Convertir talla a cm si vino en metros
      let tallaNum = parseFloat(rawTalla);
      if (!isNaN(tallaNum) && tallaNum < 3) tallaNum = tallaNum * 100;
      const tallaCm = isNaN(tallaNum) ? '' : String(Math.round(tallaNum));
      const bsa = calculateBSA(rawPeso, tallaCm);
      // Sanear ECOG: quitar "PS", "ECOG", espacios, quedarse solo con el número
      const ecogVal = String(d.ecog || '').replace(/[^0-4]/g, '').trim();

      setStatus('Generando PDF...');

      // 2. Construcción del PDF con pdf-lib
      const pdfDoc = await PDFDocument.create();
      const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const W = 595.28;
      const H = 841.89;
      const mX = 45;
      const mBottom = 50;
      const bodyW = W - mX * 2;

      let page = pdfDoc.addPage([W, H]);
      let y = H - 30;

      const checkPage = (needed = 20) => {
        if (y < mBottom + needed) {
          page = pdfDoc.addPage([W, H]);
          y = H - 50;
        }
      };

      const drawWrapped = (
        text: string, x: number, startY: number,
        maxW: number, fs: number, f = font, lineH = fs * 1.4
      ): number => {
        if (!text?.trim()) return startY;
        const words = String(text).trim().split(' ');
        let line = '';
        let cy = startY;
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (font.widthOfTextAtSize(test, fs) > maxW && line) {
            checkPage(lineH + 4);
            page.drawText(line, { x, y: cy, size: fs, font: f });
            cy -= lineH;
            line = w;
          } else { line = test; }
        }
        if (line) {
          checkPage(lineH + 4);
          page.drawText(line, { x, y: cy, size: fs, font: f });
          cy -= lineH;
        }
        return cy;
      };

      const hLine = (yPos: number, thickness = 0.5, c = rgb(0.7, 0.7, 0.7)) => {
        page.drawLine({ start: { x: mX, y: yPos }, end: { x: W - mX, y: yPos }, thickness, color: c });
      };

      const sectionHeader = (label: string) => {
        checkPage(30);
        y -= 10;
        page.drawRectangle({ x: mX, y: y - 2, width: bodyW, height: 16, color: rgb(0.12, 0.22, 0.40) });
        page.drawText(label, { x: mX + 6, y: y + 2, size: 9, font: fontBold, color: rgb(1, 1, 1) });
        y -= 18;
      };

      // ── LOGO ──────────────────────────────────────────────────────────────────
      let logoH = 0;
      try {
        const logoRes = await fetch(window.location.origin + '/img/header_logo.png');
        if (logoRes.ok) {
          const logoBytes = await logoRes.arrayBuffer();
          const img = await pdfDoc.embedPng(logoBytes);
          const dims = img.scale(0.32);
          page.drawImage(img, { x: (W - dims.width) / 2, y: y - dims.height, width: dims.width, height: dims.height });
          logoH = dims.height + 10;
        }
      } catch { /* logo load failed, use text fallback */ }
      if (logoH === 0) {
        const ht = "HOSPITAL ONCOLÓGICO PROVINCIAL - CÓRDOBA";
        page.drawText(ht, { x: (W - fontBold.widthOfTextAtSize(ht, 13)) / 2, y, size: 13, font: fontBold });
        logoH = 20;
      }
      y -= logoH;

      // ── LÍNEA + TÍTULO ────────────────────────────────────────────────────────
      hLine(y, 1.5, rgb(0.12, 0.22, 0.40));
      y -= 20;

      const title = "RESUMEN DE INTERCONSULTA / DERIVACIÓN";
      page.drawText(title, { x: (W - fontBold.widthOfTextAtSize(title, 13)) / 2, y, size: 13, font: fontBold });
      y -= 16;

      const subServicio = `Dirigido a: Servicio de ${servicioDestino}`;
      page.drawText(subServicio, { x: (W - fontBold.widthOfTextAtSize(subServicio, 9)) / 2, y, size: 9, font: fontBold, color: rgb(0.12, 0.22, 0.40) });
      y -= 13;

      const sub = "Hospital Oncológico Provincial · Córdoba";
      page.drawText(sub, { x: (W - font.widthOfTextAtSize(sub, 9)) / 2, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 12;

      const dateStr = `Córdoba Capital, ${today}`;
      page.drawText(dateStr, { x: W - mX - font.widthOfTextAtSize(dateStr, 9), y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 6;
      hLine(y, 0.5, rgb(0.5, 0.5, 0.5));
      y -= 16;

      // ── DATOS DEL PACIENTE ────────────────────────────────────────────────────
      sectionHeader("DATOS DEL PACIENTE");

      const col1x = mX;
      const col2x = mX + bodyW / 2 + 5;
      const labelFs = 7.5;
      const valFs = 9;
      const rowH = 14;

      const drawField = (lx: number, label: string, value: string, rowY: number) => {
        page.drawText(label.toUpperCase(), { x: lx, y: rowY, size: labelFs, font, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(value || '—', { x: lx, y: rowY - 9, size: valFs, font: fontBold });
      };

      drawField(col1x, 'Apellido y nombre', d.nombre || patient.name, y);
      drawField(col2x, 'NHC', d.nhc || '—', y);
      y -= rowH * 1.8;

      drawField(col1x, 'Fecha de nacimiento', d.fnac || '—', y);
      drawField(col2x, 'Edad / Sexo', `${d.edad || '?'} años · ${d.sexo || '—'}`, y);
      y -= rowH * 1.8;

      drawField(col1x, 'Cobertura', d.cobertura || '—', y);
      // CORRECCIÓN 1: ECOG saneado, sin duplicar "PS"
      drawField(col2x, 'ECOG', ecogVal !== '' ? `PS ${ecogVal}` : '—', y);
      y -= rowH * 1.8;

      // CORRECCIÓN 2: unidades limpias, sin duplicar
      if (rawPeso || tallaCm || bsa) {
        drawField(col1x, 'Peso / Talla / SC',
          `${rawPeso ? rawPeso + ' kg' : '?'} · ${tallaCm ? tallaCm + ' cm' : '?'} · ${bsa ? bsa + ' m²' : '?'}`, y);
        y -= rowH * 1.8;
      }

      page.drawText('DIAGNÓSTICO', { x: mX, y, size: labelFs, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 10;
      y = drawWrapped(`${d.diagnostico || '—'}${d.estadio ? ' · ' + d.estadio : ''}`, mX, y, bodyW, 10, fontBold);
      y -= 6;

      if (d.comorbilidades) {
        page.drawText('COMORBILIDADES', { x: mX, y, size: labelFs, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 10;
        y = drawWrapped(d.comorbilidades, mX, y, bodyW, 9);
        y -= 4;
      }

      hLine(y);
      y -= 8;

      // ── RESUMEN CLÍNICO (párrafo narrativo) ───────────────────────────────────
      // CORRECCIÓN 3: reemplaza la línea de tiempo por texto narrativo
      if (d.resumen_clinico) {
        sectionHeader("ANTECEDENTES Y EVOLUCIÓN CLÍNICA");
        y = drawWrapped(d.resumen_clinico, mX, y, bodyW, 9);
        y -= 8;
      }

      // ── TRATAMIENTO ACTUAL ────────────────────────────────────────────────────
      if (d.tratamiento_actual) {
        sectionHeader("TRATAMIENTO ACTUAL");
        y = drawWrapped(d.tratamiento_actual, mX, y, bodyW, 9);
        y -= 8;
      }

      // ── LABORATORIO ───────────────────────────────────────────────────────────
      if (d.laboratorio_reciente) {
        sectionHeader("LABORATORIO RECIENTE");
        y = drawWrapped(d.laboratorio_reciente, mX, y, bodyW, 9);
        y -= 8;
      }

      // ── MOTIVO DE DERIVACIÓN ──────────────────────────────────────────────────
      sectionHeader(`MOTIVO DE INTERCONSULTA — SERVICIO DE ${servicioDestino.toUpperCase()}`);
      y = drawWrapped(d.motivo_derivacion || motivoSolicitud, mX, y, bodyW, 9);
      y -= 12;

      // ── FIRMA ─────────────────────────────────────────────────────────────────
      checkPage(70);
      y -= 10;
      hLine(y, 1, rgb(0.12, 0.22, 0.40));
      y -= 18;

      if (doctorData.nombre) {
        page.drawText('Médico solicitante:', { x: mX, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 11;
        page.drawText(doctorData.nombre, { x: mX, y, size: 10, font: fontBold });
        if (doctorData.especialidad)
          page.drawText(doctorData.especialidad, { x: mX, y: y - 12, size: 8.5, font });
        if (doctorData.matricula)
          page.drawText(`Mat. ${doctorData.matricula}`, { x: mX, y: y - 22, size: 8.5, font });
        if (doctorData.email)
          page.drawText(doctorData.email, { x: mX, y: y - 32, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      }

      const sigX = W - mX - 160;
      page.drawLine({ start: { x: sigX, y: y - 30 }, end: { x: W - mX, y: y - 30 }, thickness: 0.8, color: rgb(0, 0, 0) });
      page.drawText('Firma y sello', { x: sigX + 42, y: y - 42, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

      // Pie de página en cada hoja
      const pageCount = pdfDoc.getPageCount();
      for (let pi = 0; pi < pageCount; pi++) {
        const pg = pdfDoc.getPage(pi);
        pg.drawText(`Página ${pi + 1} de ${pageCount}`, {
          x: W - mX - 60, y: 22, size: 7.5, font, color: rgb(0.6, 0.6, 0.6)
        });
        pg.drawText('Hospital Oncológico Provincial · Córdoba ', {
          x: mX, y: 22, size: 7.5, font, color: rgb(0.6, 0.6, 0.6)
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Interconsulta_${d.nombre || patient.name}_${today.replace(/\//g, '-')}.pdf`;
      link.click();
      setStatus('¡Listo!');
      const newAccumulated = regenParams?.accumulatedCorrections ?? '';
      setLastRegenParams(prev => ({ ...prev, interconsulta: { servicioDestino: servicioDestino.trim(), motivoSolicitud: motivoSolicitud.trim(), accumulatedCorrections: newAccumulated } }));
      setFormGenerated(prev => ({ ...prev, interconsulta: true }));
      setFormCorrections(prev => ({ ...prev, interconsulta: '' }));
    } catch (e: any) {
      alert("Error al generar interconsulta: " + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
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
            (textField as any).setFont?.(helveticaFont);
            (textField as any).setTextColor?.(rgb(1, 0, 0));
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
      
      {hasClinicalData ? (
        effectiveTimeline.length > 0 && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="text-blue-600 shrink-0" size={16} />
              <p className="text-[10px] text-blue-800 font-bold">
                Conectado a la Línea de Tiempo: {effectiveTimeline.length} evento{effectiveTimeline.length !== 1 ? 's' : ''} disponible{effectiveTimeline.length !== 1 ? 's' : ''} para autocompletar formularios.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-black text-[9px] rounded-full uppercase tracking-wider shrink-0">
              Línea de Tiempo Activa
            </span>
          </div>
        )
      ) : (
        <div className="mb-6 p-3 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-2">
            <AlertTriangle className="text-orange-500 shrink-0" size={16} />
            <p className="text-[10px] text-orange-700 font-bold">
                Cargue la Historia Clínica en "Documentación" o agregue eventos en "Eventos" para habilitar la generación de formularios.
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
                ) : form.type === 'auto_dinadic' ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <button
                          onClick={() => generateDinadicPDF()}
                          disabled={processingId !== null}
                          className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                            ${processingId === 'dinadic' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-800'}`}
                        >
                          {processingId === 'dinadic' ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                          <span>Generar</span>
                        </button>
                        <button
                          onClick={() => downloadTemplate(form)}
                          className="flex-1 flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <Download size={14}/><span>Plantilla Vacía</span>
                        </button>
                        <button
                          onClick={() => generateClinicalSummary(form.context || 'SOLICITUD', undefined)}
                          disabled={processingId !== null}
                          className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 text-white hover:bg-purple-700 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                          <span>Resumen Clínico</span>
                        </button>
                        <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-[9px] text-yellow-700">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5"/>
                            <p>Generado por IA. Revise antes de presentar.</p>
                        </div>
                    </div>
                ) : form.type === 'auto_banco' ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <button
                          onClick={() => form.id === 'admision' ? fillAdmisionPDF(form) : fillRenovacionPDF(form)}
                          disabled={processingId !== null}
                          className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                            ${processingId === form.id ? 'bg-green-600' : 'bg-green-700 hover:bg-green-800'}`}
                        >
                          {processingId === form.id ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                          <span>Generar</span>
                        </button>
                        <button
                          onClick={() => downloadTemplate(form)}
                          className="flex-1 flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <Download size={14}/><span>Plantilla Vacía</span>
                        </button>
                        <button
                          onClick={() => generateClinicalSummary(form.context || 'SOLICITUD', undefined)}
                          disabled={processingId !== null}
                          className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 text-white hover:bg-purple-700 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                          <span>Resumen Clínico</span>
                        </button>
                        <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-[9px] text-yellow-700">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5"/>
                            <p>Generado por IA. Revise antes de presentar.</p>
                        </div>
                    </div>
                ) : form.type === 'interconsulta' ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <button
                          onClick={() => generateInterconsultaPDF()}
                          disabled={processingId !== null}
                          className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                            ${processingId === 'interconsulta' ? 'bg-indigo-600' : 'bg-indigo-700 hover:bg-indigo-800'}`}
                        >
                          {processingId === 'interconsulta' ? <Loader2 className="animate-spin" size={14}/> : <Share2 size={14}/>}
                          <span>Generar PDF</span>
                        </button>
                        <div className="flex items-start gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-[9px] text-indigo-700">
                          <AlertTriangle size={10} className="shrink-0 mt-0.5"/>
                          <p>Genera un resumen clínico completo con cronología para interconsultas y derivaciones.</p>
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
                          onClick={() => generateClinicalSummary(form.context || 'SOLICITUD', undefined)}
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

            {/* PANEL DE CORRECCIÓN — se muestra después de la primera generación */}
            {(() => {
              const MAX_C = 300;
              const isRegen = processingId !== null;

              // Correction panels for direct form fills (PAMI, Admision, Renovacion)
              if ((form.type === 'auto' || form.type === 'auto_banco') && formGenerated[form.id]) {
                const correction = formCorrections[form.id] || '';
                const params = lastRegenParams[form.id];
                const handleRegen = () => {
                  if (!correction.trim() || !params?.drugName) return;
                  const newAccumulated = params.accumulatedCorrections
                    ? `${params.accumulatedCorrections}\n- ${correction}`
                    : `- ${correction}`;
                  if (form.type === 'auto') fillPamiPDF(form, { drugName: params.drugName, correction });
                  else if (form.id === 'admision') fillAdmisionPDF(form, { drugName: params.drugName, correction });
                  else fillRenovacionPDF(form, { drugName: params.drugName, correction });
                  setLastRegenParams(prev => ({ ...prev, [form.id]: { ...params, accumulatedCorrections: newAccumulated } }));
                };
                return (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">¿Algo incorrecto en el formulario generado?</p>
                    <div className="relative">
                      <textarea value={correction} onChange={e => setFormCorrections(prev => ({ ...prev, [form.id]: e.target.value.slice(0, MAX_C) }))}
                        placeholder="Ej: El estadio es T3N2M1, corregir el ECOG a 1..."
                        rows={2} disabled={isRegen}
                        className="w-full p-2 text-[10px] border border-amber-200 rounded-lg bg-white resize-none outline-none focus:border-amber-400"/>
                      <span className="absolute bottom-1.5 right-2 text-[9px] text-amber-400 font-bold">{MAX_C - correction.length}</span>
                    </div>
                    <button onClick={handleRegen} disabled={!correction.trim() || isRegen}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-600 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 disabled:opacity-40">
                      {isRegen ? <Loader2 size={11} className="animate-spin"/> : <RefreshCcw size={11}/>}
                      Regenerar con corrección
                    </button>
                  </div>
                );
              }

              // Correction panel for DINADIC
              if (form.type === 'auto_dinadic' && formGenerated['dinadic']) {
                const correction = formCorrections['dinadic'] || '';
                return (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">¿Algo incorrecto en el formulario DINADIC?</p>
                    <div className="relative">
                      <textarea value={correction} onChange={e => setFormCorrections(prev => ({ ...prev, dinadic: e.target.value.slice(0, MAX_C) }))}
                        placeholder="Ej: La dosis debe ser 175mg/m², corregir el diagnóstico..."
                        rows={2} disabled={isRegen}
                        className="w-full p-2 text-[10px] border border-amber-200 rounded-lg bg-white resize-none outline-none focus:border-amber-400"/>
                      <span className="absolute bottom-1.5 right-2 text-[9px] text-amber-400 font-bold">{MAX_C - correction.length}</span>
                    </div>
                    <button
                      onClick={() => { if (!correction.trim()) return; setPendingDinadicCorrection(correction); generateDinadicPDF(); }}
                      disabled={!correction.trim() || isRegen}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-600 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 disabled:opacity-40">
                      {isRegen ? <Loader2 size={11} className="animate-spin"/> : <RefreshCcw size={11}/>}
                      Regenerar con corrección
                    </button>
                  </div>
                );
              }

              // Correction panel for Interconsulta
              if (form.type === 'interconsulta' && formGenerated['interconsulta']) {
                const correction = formCorrections['interconsulta'] || '';
                const params = lastRegenParams['interconsulta'];
                return (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">¿Algo incorrecto en la interconsulta?</p>
                    <div className="relative">
                      <textarea value={correction} onChange={e => setFormCorrections(prev => ({ ...prev, interconsulta: e.target.value.slice(0, MAX_C) }))}
                        placeholder="Ej: Agregar comorbilidades, corregir el ECOG..."
                        rows={2} disabled={isRegen}
                        className="w-full p-2 text-[10px] border border-amber-200 rounded-lg bg-white resize-none outline-none focus:border-amber-400"/>
                      <span className="absolute bottom-1.5 right-2 text-[9px] text-amber-400 font-bold">{MAX_C - correction.length}</span>
                    </div>
                    <button
                      onClick={() => { if (!correction.trim() || !params) return;
                        const newAcc = params.accumulatedCorrections ? `${params.accumulatedCorrections}\n- ${correction}` : `- ${correction}`;
                        generateInterconsultaPDF({ servicioDestino: params.servicioDestino!, motivoSolicitud: params.motivoSolicitud!, accumulatedCorrections: newAcc });
                        setLastRegenParams(prev => ({ ...prev, interconsulta: { ...params, accumulatedCorrections: newAcc } }));
                      }}
                      disabled={!correction.trim() || isRegen}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-600 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 disabled:opacity-40">
                      {isRegen ? <Loader2 size={11} className="animate-spin"/> : <RefreshCcw size={11}/>}
                      Regenerar con corrección
                    </button>
                  </div>
                );
              }

              return null;
            })()}

            {/* Correction panels for Resumen Clínico (shown per form that triggers summary) */}
            {(form.type === 'auto_dinadic' || form.type === 'auto_banco') && (() => {
              const panelId = 'summary-' + (form.context || 'SOLICITUD');
              if (!formGenerated[panelId]) return null;
              const MAX_C = 300;
              const correction = formCorrections[panelId] || '';
              const params = lastRegenParams[panelId];
              const isRegen = processingId !== null;
              return (
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-2">
                  <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">¿Algo incorrecto en el Resumen Clínico?</p>
                  <div className="relative">
                    <textarea value={correction} onChange={e => setFormCorrections(prev => ({ ...prev, [panelId]: e.target.value.slice(0, MAX_C) }))}
                      placeholder="Ej: Falta mencionar la cirugía de 2023, corregir el estadio..."
                      rows={2} disabled={isRegen}
                      className="w-full p-2 text-[10px] border border-purple-200 rounded-lg bg-white resize-none outline-none focus:border-purple-400"/>
                    <span className="absolute bottom-1.5 right-2 text-[9px] text-purple-400 font-bold">{MAX_C - correction.length}</span>
                  </div>
                  <button
                    onClick={() => { if (!correction.trim() || !params?.drugName || !params?.context) return;
                      const newAcc = params.accumulatedCorrections ? `${params.accumulatedCorrections}\n- ${correction}` : `- ${correction}`;
                      generateClinicalSummary(params.context!, { drugName: params.drugName, formId: panelId, accumulatedCorrections: newAcc });
                    }}
                    disabled={!correction.trim() || isRegen}
                    className="w-full flex items-center justify-center gap-1.5 bg-purple-600 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 disabled:opacity-40">
                    {isRegen ? <Loader2 size={11} className="animate-spin"/> : <RefreshCcw size={11}/>}
                    Regenerar Resumen con corrección
                  </button>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {status && <div className="mt-4 text-center"><span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">{status}</span></div>}

      {showEsquemaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">
                Esquema Terapéutico
              </h3>
              <button onClick={() => setShowEsquemaModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18}/>
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-wide">
              Complete los datos del esquema antes de generar el formulario DINADIC
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Medicamento/s', key: 'medicamentos', span: true },
                { label: 'Dosis/m² o kg', key: 'dosis_m2' },
                { label: 'Dosis total por ciclo', key: 'dosis_total_ciclo' },
                { label: 'Días de administración', key: 'dias_admin' },
                { label: 'Intervalo', key: 'intervalo' },
                { label: 'N° total de ciclos', key: 'numero_ciclos' },
                { label: 'Frecuencia de ciclos', key: 'frecuencia_ciclos' },
                { label: 'Tiempo de tratamiento', key: 'tiempo_tratamiento' },
                { label: 'Fecha inicio (DD/MM/AAAA)', key: 'fecha_inicio', span: true },
              ].map(({ label, key, span }) => (
                <div key={key} className={span ? 'col-span-2' : ''}>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">{label}</label>
                  <input
                    className="w-full p-2 border rounded-lg text-xs"
                    value={(esquemaData as any)[key]}
                    onChange={e => setEsquemaData(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowEsquemaModal(false);
                generateDinadicPDF(esquemaData);
              }}
              className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Wand2 size={14}/> Generar DINADIC
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE REVISIÓN Y COMPLETADO PAMI ONCOLÓGICO */}
      {showPamiReviewModal && (() => {
        const liveBSA = calculateBSA(pamiFormData.peso, pamiFormData.talla);
        
        // Count empty essential fields
        const essentialFields: (keyof typeof pamiFormData)[] = [
          'paciente_nombre_real', 'paciente_fnac', 'diagnostico_cie10', 'histopatologico',
          'peso', 'talla', 'ecog', 'estadio_inicial', 'fecha_diagnostico_inicial',
          'estadio_actual', 'linea_tratamiento', 'informe_clinico_detallado',
          'droga_1'
        ];
        const missingCount = essentialFields.filter(f => !String(pamiFormData[f] || '').trim()).length;

        const renderField = (label: string, fieldKey: keyof typeof pamiFormData, placeholder = '', isSpan2 = false) => {
          const val = pamiFormData[fieldKey] || '';
          const isMissing = !String(val).trim();
          return (
            <div className={isSpan2 ? 'col-span-2' : ''}>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  {label}
                </label>
                {isMissing && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <AlertCircle size={9}/> Celda vacía
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder={placeholder}
                value={val}
                onChange={e => setPamiFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                className={`w-full p-2 text-xs rounded-lg border transition-all outline-none ${
                  isMissing
                    ? 'border-amber-400 bg-amber-50/50 text-gray-900 focus:border-amber-600 focus:bg-white ring-1 ring-amber-200'
                    : 'border-gray-200 bg-white text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                }`}
              />
            </div>
          );
        };

        const justificationLength = (pamiFormData.informe_clinico_detallado || '').length;
        const isJustificationOptimal = justificationLength >= 750 && justificationLength <= 1450;
        const isJustificationTooLong = justificationLength > 1500;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">
                        Formulario PAMI Oncológico
                      </h3>
                      {missingCount > 0 ? (
                        <span className="px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                          <AlertTriangle size={11} className="text-amber-600" />
                          {missingCount} {missingCount === 1 ? 'campo vacío' : 'campos vacíos'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Completo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Verifique los datos del paciente y el informe. Las celdas resaltadas en naranja pueden completarse directamente antes de descargar el PDF.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPamiReviewModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-gray-50/30">
                
                {/* 1. Datos del Paciente y Antropometría */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <span>1. Datos del Paciente & Antropometría</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {renderField('Apellido y Nombre', 'paciente_nombre_real', 'Nombre completo')}
                    {renderField('Fecha de Nacimiento', 'paciente_fnac', 'DD/MM/AAAA')}
                    {renderField('Teléfono / Celular', 'paciente_celular', 'Ej: 3511234567')}
                    {renderField('Diagnóstico (CIE-10)', 'diagnostico_cie10', 'Ej: C50.9 Cáncer de mama')}
                    {renderField('Peso (kg)', 'peso', 'Ej: 70')}
                    {renderField('Talla (cm)', 'talla', 'Ej: 165')}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                        Sup. Corporal (Calculada)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={liveBSA ? `${liveBSA} m²` : 'Completar peso y talla'}
                        className="w-full p-2 text-xs rounded-lg border border-gray-200 bg-gray-100 text-gray-700 font-bold"
                      />
                    </div>
                    {renderField('ECOG (0 - 4)', 'ecog', 'Ej: 0 o 1')}
                  </div>
                </div>

                {/* 2. Estadificación y Cronología */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <span>2. Estadificación & Cronología</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {renderField('Estadio Inicial', 'estadio_inicial', 'Ej: Estadio IVB')}
                    {renderField('Fecha Diagnóstico Inicial', 'fecha_diagnostico_inicial', 'DD/MM/AAAA')}
                    {renderField('Estadio Actual', 'estadio_actual', 'Ej: Progresión hepática')}
                    {renderField('Línea de Tratamiento', 'linea_tratamiento', 'Ej: 1ra línea / 2da línea / Adyuvancia')}
                    {renderField('N° Ciclos Planeados', 'ciclos_planeados', 'Ej: 6')}
                    {renderField('Frecuencia (Días)', 'frecuencia_dias', 'Ej: 21')}
                  </div>
                </div>

                {/* 3. Antecedentes y Laboratorio */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <span>3. Antecedentes Quirúrgicos, Radiantes & Laboratorio</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {renderField('Histopatológico / Inmunohistoquímica', 'histopatologico', 'Resumen patológico e IHQ')}
                    {renderField('Laboratorio Positivo Relevante', 'laboratorio_formateado', 'Hb 12g/dl, Cr 0.8, marcadores')}
                    {renderField('Antecedentes Quirúrgicos', 'antecedentes_qx', 'Cirugías con fechas (Ej: Mastectomía 02/2024)')}
                    {renderField('Antecedentes Terapia Radiante', 'antecedentes_radio', 'RT, dosis y fechas')}
                  </div>
                </div>

                {/* 4. Clasificación del Tratamiento & Checkboxes */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <span>4. Motivo de Solicitud y Tipo de Tratamiento</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                        Motivo de la Solicitud
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Inicio', 'Renovación', 'Cambio de Toxicidad', 'Cambio por Progresión'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPamiFormData(prev => ({ ...prev, motivo_solicitud: opt }))}
                            className={`px-3 py-2 text-xs font-bold rounded-lg border text-left transition-all ${
                              pamiFormData.motivo_solicitud === opt
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                        Tipo de Tratamiento
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Adyuvante', 'Neoadyuvante', 'Avanzado'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPamiFormData(prev => ({ ...prev, tipo_tratamiento: opt }))}
                            className={`px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                              pamiFormData.tipo_tratamiento === opt
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Informe Médico y Justificación Oncológica */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-900">
                      5. Informe Clínico & Justificación de la Droga (Cuadro Grande)
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isJustificationOptimal
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isJustificationTooLong
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {justificationLength} / ~1400 caracteres {isJustificationOptimal ? '✓ Longitud óptima' : isJustificationTooLong ? '⚠️ Puede desbordar' : ''}
                      </span>
                    </div>
                  </div>
                  
                  <textarea
                    rows={8}
                    placeholder="Redacte la justificación oncológica detallada: hitos diagnósticos cronológicos, RMN/PET/TAC con fechas y hallazgos, estadio/reestadificación, biopsias, respuesta o suspensión de esquemas previos y fundamentación médica del plan actual..."
                    value={pamiFormData.informe_clinico_detallado}
                    onChange={e => setPamiFormData(prev => ({ ...prev, informe_clinico_detallado: e.target.value }))}
                    className={`w-full p-3 text-xs rounded-xl border outline-none transition-all leading-relaxed ${
                      !pamiFormData.informe_clinico_detallado.trim()
                        ? 'border-amber-400 bg-amber-50/50 focus:bg-white focus:border-amber-600'
                        : isJustificationTooLong
                        ? 'border-red-400 bg-red-50/30 focus:border-red-600'
                        : 'border-gray-200 bg-white focus:border-blue-500'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500">
                    💡 El cuadro grande de PAMI admite un informe exhaustivo de <strong>800 a 1400 caracteres</strong> detallando los hitos oncológicos cronológicos y la fundamentación del tratamiento.
                  </p>
                </div>

                {/* 6. Tabla de Drogas Oncológicas Solicitadas */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Pill size={14} className="text-blue-600"/>
                      <span>6. Tabla de Drogas Oncológicas Solicitadas</span>
                    </h4>
                    <span className="text-[10px] text-gray-500">
                      Hasta 4 fármacos por formulario
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-600">
                    Indique los nombres de las drogas a solicitar. La presentación, dosis y duración se completarán automáticamente en el formulario PDF al momento de la descarga.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {renderField('Droga #1 (Principal)', 'droga_1', 'Ej: Leuprolide')}
                    {renderField('Droga #2', 'droga_2', 'Ej: Darolutamida')}
                    {renderField('Droga #3', 'droga_3', 'Opcional')}
                    {renderField('Droga #4', 'droga_4', 'Opcional')}
                  </div>

                  {/* Sugerencias rápidas */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Sugerencias frecuentes:
                      </span>
                      {(pamiFormData.droga_1 || pamiFormData.droga_2 || pamiFormData.droga_3 || pamiFormData.droga_4) && (
                        <button
                          type="button"
                          onClick={() => setPamiFormData(prev => ({
                            ...prev,
                            droga_1: '',
                            droga_2: '',
                            droga_3: '',
                            droga_4: '',
                          }))}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700"
                        >
                          Limpiar drogas
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Leuprolide + Darolutamida',
                        'Pembrolizumab',
                        'Trastuzumab + Pertuzumab',
                        'Carboplatino + Paclitaxel',
                        'Osimertinib 80mg',
                        'Abemaciclib + Fulvestrant',
                        'Docetaxel',
                        'Capecitabina'
                      ].map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            const parts = sug.split('+').map(s => s.trim());
                            setPamiFormData(prev => ({
                              ...prev,
                              droga_1: parts[0] || '',
                              droga_2: parts[1] || '',
                              droga_3: parts[2] || '',
                              droga_4: parts[3] || '',
                              esquema_tratamiento_solicitado: sug,
                            }));
                          }}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-lg border border-gray-200 transition-all"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-100/90 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-gray-600">
                  {missingCount > 0 ? (
                    <span className="text-amber-800 font-bold flex items-center gap-1">
                      <AlertTriangle size={14} className="text-amber-600" />
                      Hay {missingCount} celdas vacías. Puede completarlas ahora o generar el PDF con los datos actuales.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Todos los campos requeridos están completos y listos para exportar.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPamiReviewModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all w-full sm:w-auto"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    disabled={processingId === 'pami'}
                    onClick={() => fillPamiPDFFromData(pamiFormData)}
                    className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all w-full sm:w-auto disabled:opacity-50"
                  >
                    {processingId === 'pami' ? <Loader2 size={15} className="animate-spin"/> : <Download size={15}/>}
                    <span>Descargar Formulario PAMI (PDF)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default FormManager;
