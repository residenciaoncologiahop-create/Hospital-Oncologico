import React, { useState, useEffect } from 'react';
import {
  FileText, Loader2, Wand2, UserCog, Save, X, Download, FilePlus, ExternalLink, CheckCircle2, RefreshCcw, Pill, AlertCircle, Check
} from 'lucide-react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { callGemini } from '../utils/aiProxy';

interface FormManagerProps {
  patient: any;
  historyText: string;
  files: any[];
  timeline?: any[];
}

// Lista de campos estrictamente requeridos para el trámite oficial de PAMI
const PAMI_MANDATORY_FIELDS: Array<{ key: string; label: string; id: string }> = [
  { key: 'paciente_nombre_real', label: 'Apellido y Nombre', id: 'pami-paciente_nombre_real' },
  { key: 'paciente_fnac', label: 'Fecha de Nacimiento', id: 'pami-paciente_fnac' },
  { key: 'diagnostico_cie10', label: 'Diagnóstico (CIE-10)', id: 'pami-diagnostico_cie10' },
  { key: 'peso', label: 'Peso', id: 'pami-peso' },
  { key: 'talla', label: 'Talla', id: 'pami-talla' },
  { key: 'ecog', label: 'ECOG', id: 'pami-ecog' },
  { key: 'droga_1', label: 'Droga #1 (Principal)', id: 'pami-droga_1' },
  { key: 'informe_clinico_detallado', label: 'Informe Clínico', id: 'pami-informe_clinico_detallado' },
];

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
  const [showPamiMissingConfirm, setShowPamiMissingConfirm] = useState(false);
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

  // Banco de Drogas Modal State (Admisión y Renovación)
  const [showBancoModal, setShowBancoModal] = useState<'admision' | 'renovacion' | null>(null);
  const [bancoFormData, setBancoFormData] = useState({
    context: 'admision' as 'admision' | 'renovacion',
    droga_1: '',
    dosis_1: '',
    dias_1: '',
    total_dia_1: '',
    droga_2: '',
    dosis_2: '',
    dias_2: '',
    total_dia_2: '',
    droga_3: '',
    dosis_3: '',
    dias_3: '',
    total_dia_3: '',
    intervalo_ciclo: '21',
    ciclos_programados: '6',
    tipo_tratamiento: 'avanzado',
    linea: '1',
    peso: '',
    talla: '',
    ecog: '0',
    telefono: '',
    fnac: '',
    motivo_renovacion: 'continua',
    ciclos_realizados: '',
    respuesta: 'estable',
    sitio_progresion: '',
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
  ];

  const calculateBSA = (weight: string | number, height: string | number) => {
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

  // Extracción rápida y confiable de datos del paciente preexistentes (priorizando datos más recientes)
  const extractFallbackPatientData = () => {
    const context = getEffectiveClinicalContext();

    const name = patient?.name || '';

    let fnac = patient?.birthDate || '';
    if (!fnac) {
      const fnacMatch = context.match(/(?:fecha\s*(?:de)?\s*nac(?:imiento)?\.?|f\.?\s*nac\.?)\s*[:=]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
      if (fnacMatch) fnac = cleanDate(fnacMatch[1]);
    }

    let dni = patient?.dni || '';
    if (!dni) {
      const dniMatch = context.match(/(?:dni|documento|c\.?i\.?)\s*[:=]?\s*([\d.\s]{7,11})/i);
      if (dniMatch) dni = dniMatch[1].replace(/[^\d]/g, '');
    }

    let phone = patient?.phone || patient?.celular || '';
    if (!phone) {
      const phoneMatch = context.match(/(?:tel(?:[eé]fono)?|cel(?:ular)?|m[oó]vil)\s*[:=]?\s*([-+\d\s()]{7,20})/i);
      if (phoneMatch) phone = phoneMatch[1].trim();
    }

    let weight = patient?.weight ? String(patient.weight) : '';
    if (!weight) {
      const weightMatches = [...context.matchAll(/(?:peso|weight)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?/gi)];
      if (weightMatches.length > 0) {
        weight = weightMatches[weightMatches.length - 1][1].replace(',', '.');
      }
    }

    let height = patient?.height ? String(patient.height) : (patient?.talla ? String(patient.talla) : '');
    if (!height) {
      const heightMatches = [...context.matchAll(/(?:talla|estatura|altura|height)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:cm|m|mts)?/gi)];
      if (heightMatches.length > 0) {
        height = heightMatches[heightMatches.length - 1][1].replace(',', '.');
      }
    }

    let ecog = patient?.ecog !== undefined && patient?.ecog !== null ? String(patient.ecog) : '';
    if (!ecog) {
      const ecogMatches = [...context.matchAll(/ecog\s*[:=]?\s*([0-4])/gi)];
      if (ecogMatches.length > 0) {
        ecog = ecogMatches[ecogMatches.length - 1][1];
      }
    }

    const diagnosis = patient?.primaryDiagnosis || patient?.diagnosis || '';
    const stage = patient?.stage || '';

    return { name, fnac, dni, phone, weight, height, ecog, diagnosis, stage };
  };

  // Inicio de flujo para Banco de Drogas (abre modal de carga de celdas antes de generar PDF)
  const handleStartBancoFlow = (formType: 'admision' | 'renovacion') => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }
    const fallback = extractFallbackPatientData();
    
    let prefilledDrug = lastRegenParams[formType]?.drugName || '';
    if (!prefilledDrug) {
      const contextText = getEffectiveClinicalContext();
      const drugMatch = contextText.match(/(?:esquema|tratamiento|indicaci[oó]n|solicita|droga|f[aá]rmaco|plan)\s*[:=]?\s*([-+A-Za-z0-9\s/]{3,40})/i);
      if (drugMatch && !drugMatch[1].toLowerCase().includes('historia')) {
        prefilledDrug = drugMatch[1].trim();
      }
    }

    setBancoFormData({
      context: formType,
      droga_1: prefilledDrug,
      dosis_1: '',
      dias_1: '',
      total_dia_1: '',
      droga_2: '',
      dosis_2: '',
      dias_2: '',
      total_dia_2: '',
      droga_3: '',
      dosis_3: '',
      dias_3: '',
      total_dia_3: '',
      intervalo_ciclo: '21',
      ciclos_programados: '6',
      tipo_tratamiento: 'avanzado',
      linea: '1',
      peso: fallback.weight || '',
      talla: fallback.height || '',
      ecog: fallback.ecog || '0',
      telefono: fallback.phone || '',
      fnac: fallback.fnac || '',
      motivo_renovacion: 'continua',
      ciclos_realizados: '',
      respuesta: 'estable',
      sitio_progresion: '',
    });

    setShowBancoModal(formType);
  };

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

    setProcessingId('summary');
    setStatus('Analizando historia clínica y línea de tiempo...');

    try {
        let strategyPrompt = "";
        if (context === 'RENOVACIÓN') {
            strategyPrompt = `ESTRATEGIA: RENOVACIÓN DE ${drugName.toUpperCase()}. Objetivo: Demostrar beneficio clínico y tolerancia.`;
        } else {
            strategyPrompt = `ESTRATEGIA: ADMISIÓN / SOLICITUD DE ${drugName.toUpperCase()}. Objetivo: Justificar indicación inicial (ignorar continuidad si ya la tomó).`;
        }

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
            const title = "HOSPITAL ONCOLÓGICO PROVINCIAL";
            const subtitle = "RESUMEN DE HISTORIA CLÍNICA";
            page.drawText(title, { x: marginX, y, size: 14, font: fontBold });
            y -= 18;
            page.drawText(subtitle, { x: marginX, y, size: 10, font: fontBold });
            y -= 25;
        }

        const cleanSummary = summaryText
            .replace(/(\r\n|\n|\r)/gm, "\n")
            .replace(/\*\*/g, "")
            .replace(/###/g, "")
            .replace(/##/g, "")
            .replace(/#/g, "");

        const paragraphs = cleanSummary.split('\n');
        const contentWidth = width - (marginX * 2);
        
        for (const p of paragraphs) {
            if (!p.trim()) {
                y -= 8;
                continue;
            }

            const isHeader = p.toUpperCase().includes('IDENTIFICACIÓN') || 
                             p.toUpperCase().includes('RESUMEN CLÍNICO') || 
                             p.toUpperCase().includes('JUSTIFICACIÓN');

            const currentFont = isHeader ? fontBold : font;
            const currentSize = isHeader ? 10 : 9;
            const currentSpacing = isHeader ? 14 : 11;

            if (isHeader) y -= 6;

            const words = p.split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const testWidth = currentFont.widthOfTextAtSize(testLine, currentSize);

                if (testWidth > contentWidth) {
                    if (y < marginBottom + 60) {
                        page = pdfDoc.addPage();
                        y = height - marginTop;
                    }
                    page.drawText(currentLine, { x: marginX, y, size: currentSize, font: currentFont });
                    y -= currentSpacing;
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) {
                if (y < marginBottom + 60) {
                    page = pdfDoc.addPage();
                    y = height - marginTop;
                }
                page.drawText(currentLine, { x: marginX, y, size: currentSize, font: currentFont });
                y -= currentSpacing;
            }
        }

        const footerY = 70;
        if (y < footerY + 20) {
            page = pdfDoc.addPage();
        }
        
        const docName = doctorData.nombre ? `Dr/a. ${doctorData.nombre}` : 'Médico Tratante';
        const docMat = doctorData.matricula ? `M.P. ${doctorData.matricula}` : '';
        const docEsp = doctorData.especialidad || 'Oncología Clínica';

        page.drawText(docName, { x: width - marginX - 200, y: footerY, size: 9, font: fontBold });
        if (docMat) page.drawText(docMat, { x: width - marginX - 200, y: footerY - 12, size: 8, font });
        page.drawText(docEsp, { x: width - marginX - 200, y: footerY - 24, size: 8, font });
        page.drawText('Servicio de Oncología Clínica', { x: width - marginX - 200, y: footerY - 36, size: 8, font });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Resumen_Clinico_${context}_${patient?.name || 'Paciente'}.pdf`;
        link.click();
        setStatus('¡Listo!');
    } catch (e: any) {
        alert("Error al generar resumen clínico: " + e.message);
    } finally {
        setProcessingId(null);
        setStatus('');
    }
  };

  // --- AUTO-RESOLUCIÓN DE PARÁMETROS DE DROGAS AL DESCARGAR PDF PAMI ---
  const resolveDrugDetails = async (
    drugs: string[],
    patientWeight: string,
    patientHeight: string,
    diagnosis: string
  ): Promise<Array<{ droga: string; presentacion: string; dosis: string; duracion_dias: string }>> => {
    const activeDrugs = drugs.filter(d => d && d.trim().length > 0);
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
            - ESTRUCTURA Y HITOS OBLIGATORIOS:
              * Párrafo 1 (Diagnóstico inicial, histología y presentación): Edad del paciente, diagnóstico oncológico exacto con histopatología completa (tipo histológico, grado, Gleason, biomarcadores RE/RP/HER2/Ki67/BRCA/mutaciones), fecha exacta de biopsia y forma de presentación/marcadores iniciales con fechas.
              * Párrafo 2 (Evolución por imágenes y estadificación cronológica): Detallar cronológicamente los estudios complementarios con fechas y hallazgos clave (RMN, Centellograma, TAC, PET/CT, PET-PSMA, etc.), valores cuantitativos relevantes (SUV máx, medidas en mm/cm), estadificación TNM o FIGO inicial y reestadificación si hubo cambios de estadio o descarte/confirmación de secundarismo.
              * Párrafo 3 (Estrategia terapéutica y justificación del esquema): Objetivo terapéutico (intención curativa, control sistémico avanzado, adyuvancia, rescate), tratamientos previos realizados o suspendidos con sus motivos, y justificación oncológica detallada del esquema propuesto en el plan médico actual con fechas.
            - EXTENSIÓN: Entre 850 y 1400 caracteres. Texto corrido en español con saltos de línea entre párrafos, sin asteriscos ni markdown.
        11. DROGAS / FÁRMACOS RELEVANTES DEL PLAN ACTUAL (droga_1, droga_2, droga_3, droga_4):
            - Si en la historia clínica figuran drogas indicadas, colocarlas en droga_1, droga_2, droga_3, droga_4.
        12. motivo_solicitud: Elegir EXACTAMENTE uno: "Inicio", "Renovación", "Cambio de Toxicidad", "Cambio por Progresión".
        13. tipo_tratamiento: Elegir EXACTAMENTE uno: "Adyuvante", "Neoadyuvante", "Avanzado".
        14. esquema_tratamiento_solicitado: Nombre del esquema o combinación solicitada si figura en el plan.
        
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
      const fallback = extractFallbackPatientData();
      
      const mergedData = {
        paciente_nombre_real: aiData.paciente_nombre_real || fallback.name || patient?.name || '',
        paciente_fnac: cleanDate(aiData.paciente_fnac) || aiData.paciente_fnac || fallback.fnac || '',
        paciente_celular: aiData.paciente_celular || fallback.phone || '',
        diagnostico_cie10: aiData.diagnostico_cie10 || fallback.diagnosis || '',
        histopatologico: aiData.histopatologico || '',
        peso: aiData.peso || fallback.weight || '',
        talla: aiData.talla || fallback.height || '',
        ecog: aiData.ecog || fallback.ecog || '',
        estadio_inicial: aiData.estadio_inicial || fallback.stage || '',
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
      setShowPamiMissingConfirm(false);
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
      const finalName = data.paciente_nombre_real || patient?.name || 'Paciente';

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
      link.download = `PAMI_${finalName.replace(/\s+/g, '_')}.pdf`;
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
      setShowPamiMissingConfirm(false);
    } catch (e: any) {
      alert('Error al generar PDF de PAMI: ' + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  const handlePamiDownloadClick = () => {
    const missing = PAMI_MANDATORY_FIELDS.filter(f => !String((pamiFormData as any)[f.key] || '').trim());
    if (missing.length > 0) {
      setShowPamiMissingConfirm(true);
    } else {
      fillPamiPDFFromData(pamiFormData);
    }
  };

  const fillPamiPDF = async (formDef: any, regenParams?: { drugName?: string; correction?: string }) => {
    handleStartPamiFlow(regenParams?.correction);
  };

  // BANCO DE DROGAS: Extracción de datos con IA + sobreescritura de celdas confirmadas
  const extractBancoDrogasData = async (context: string, drugName: string, correction?: string, extraData?: typeof bancoFormData) => {
    const today = new Date().toLocaleDateString('es-AR');
    const isRenovacion = context === 'RENOVACIÓN';
    const fallback = extractFallbackPatientData();

    const prompt = `
      Actúa como oncólogo experto. Hoy es ${today}. Analizá la historia clínica y extraé datos para el formulario Banco de Drogas ${context}.
      FÁRMACO SOLICITADO POR EL MÉDICO: ${drugName}.
      ${extraData?.peso ? `PESO PACIENTE: ${extraData.peso} kg` : ''}
      ${extraData?.talla ? `TALLA PACIENTE: ${extraData.talla} cm` : ''}
      ${extraData?.ecog ? `ECOG PACIENTE: ${extraData.ecog}` : ''}
      ${extraData?.telefono ? `TELÉFONO: ${extraData.telefono}` : ''}
      ${extraData?.fnac ? `FECHA NACIMIENTO: ${extraData.fnac}` : ''}
      IDIOMA: Todo en español. Devolvé ÚNICAMENTE JSON sin markdown.

      REGLAS DE EXTRACCIÓN Y DEDUCCIÓN:
      - fecha_diagnostico: DEDUCE OBLIGATORIAMENTE la fecha de diagnóstico inicial analizando las fechas del primer estudio patológico, biopsia o consulta diagnóstica inicial en los eventos de la Línea de Tiempo o Historia Clínica (Formato DD/MM/AAAA).
      - cx_especificar: EXCLUSIVAMENTE la descripción del procedimiento QUIRÚRGICO (ej: "Mastectomía radical", "Resección de colon", "Nefrectomía"). ❌ NUNCA colocar tratamientos sistémicos ni drogas (como Carboplatino, Dabrafenib, etc.) en cx_especificar ni en campos de cirugía.

      ${isRenovacion ? `
      CONTEXTO RENOVACIÓN: El paciente ya tiene tratamiento aprobado y solicita continuarlo.
      - motivo_renovacion: "${extraData?.motivo_renovacion || 'continua'}"
      - ciclos_realizados: "${extraData?.ciclos_realizados || ''}"
      - ciclos_programados: "${extraData?.ciclos_programados || ''}"
      - respuesta: "${extraData?.respuesta || 'estable'}"
      - sitio_progresion: "${extraData?.sitio_progresion || ''}"
      ` : `
      CONTEXTO ADMISIÓN: Primera solicitud del tratamiento.
      - anatomia_patologica: Resumen MUY CONCISO Y SINTÉTICO de la patología e inmunohistoquímica (tipo tumoral, grado, RE, RP, HER2, Ki67). MÁXIMO 180-200 caracteres. ❌ NO explayarse en párrafos extensos.
      - tnm_t, tnm_n, tnm_m: clasificación TNM si existe
      - receptor_RE, receptor_RP, receptor_HER2, receptor_KRAS, receptor_EGER: positivo/negativo/no aplica
      - tratamiento_previo_cx_si: true si tuvo cirugía de tumor primario
      - cx_especificar: EXCLUSIVAMENTE descripción de cirugía (sin drogas)
      - cx_ganglios_resecados: número si aplica
      - cx_ganglios_comprometidos: número si aplica
      - cx_metastasis_si: true si tuvo cirugía de metástasis
      - rt_primario_si: true si tuvo RT en tumor primario
      - rt_metastasis_si: true si tuvo RT en metástasis
      - rt_localizacion: dónde
      - tratamientos_sistemicos_si: true si tuvo quimio/inmunoterapia previa
      - qt_tipo: "neoadyuvante", "adyuvante" o "avanzado"
      - qt_droga: nombre de la droga sistémica previa si la tuvo
      `}

      Campos comunes requeridos:
      {
        "nombre_apellido": "${fallback.name || patient?.name || ''}",
        "dni": "${fallback.dni || ''}",
        "fnac": "${extraData?.fnac || fallback.fnac || ''}",
        "edad": "${patient?.age || ''}",
        "sexo": "M" o "F",
        "domicilio": "",
        "telefono": "${extraData?.telefono || fallback.phone || ''}",
        "localidad": "",
        "provincia": "Córdoba",
        "pais": "Argentina",
        "institucion": "Hospital Oncológico Provincial - Córdoba",
        "diagnostico": "${fallback.diagnosis || ''}",
        "fecha_diagnostico": "DD/MM/AAAA",
        "cie10": "",
        "estadio": "${fallback.stage || ''}",
        "sup_corporal": "",
        "peso": "${extraData?.peso || fallback.weight || ''}",
        "talla": "${extraData?.talla || fallback.height || ''}",
        "ecog": "${extraData?.ecog || fallback.ecog || '0'}",
        "tipo_tratamiento": "${extraData?.tipo_tratamiento || 'avanzado'}",
        "linea": "${extraData?.linea || '1'}",
        "droga_1": "${extraData?.droga_1 || drugName}", "dosis_1": "${extraData?.dosis_1 || ''}", "dias_1": "${extraData?.dias_1 || ''}", "total_dia_1": "${extraData?.total_dia_1 || ''}",
        "droga_2": "${extraData?.droga_2 || ''}", "dosis_2": "${extraData?.dosis_2 || ''}", "dias_2": "${extraData?.dias_2 || ''}", "total_dia_2": "${extraData?.total_dia_2 || ''}",
        "droga_3": "${extraData?.droga_3 || ''}", "dosis_3": "${extraData?.dosis_3 || ''}", "dias_3": "${extraData?.dias_3 || ''}", "total_dia_3": "${extraData?.total_dia_3 || ''}",
        "intervalo_ciclo": "${extraData?.intervalo_ciclo || '21'}",
        "ciclos_programados": "${extraData?.ciclos_programados || '6'}",
        "lugar_fecha": "${today} - Córdoba",
        "contacto_institucional": "",
        ${isRenovacion ? `
        "motivo_renovacion": "${extraData?.motivo_renovacion || 'continua'}",
        "ciclos_realizados": "${extraData?.ciclos_realizados || ''}",
        "respuesta": "${extraData?.respuesta || 'estable'}",
        "sitio_progresion": "${extraData?.sitio_progresion || ''}",
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
    const parsed = JSON.parse(clean);

    // Sobreescritura estricta con datos confirmados por el médico en el modal
    if (extraData) {
      if (extraData.droga_1) parsed.droga_1 = extraData.droga_1;
      if (extraData.dosis_1) parsed.dosis_1 = extraData.dosis_1;
      if (extraData.dias_1) parsed.dias_1 = extraData.dias_1;
      if (extraData.total_dia_1) parsed.total_dia_1 = extraData.total_dia_1;

      if (extraData.droga_2) parsed.droga_2 = extraData.droga_2;
      if (extraData.dosis_2) parsed.dosis_2 = extraData.dosis_2;
      if (extraData.dias_2) parsed.dias_2 = extraData.dias_2;
      if (extraData.total_dia_2) parsed.total_dia_2 = extraData.total_dia_2;

      if (extraData.droga_3) parsed.droga_3 = extraData.droga_3;
      if (extraData.dosis_3) parsed.dosis_3 = extraData.dosis_3;
      if (extraData.dias_3) parsed.dias_3 = extraData.dias_3;
      if (extraData.total_dia_3) parsed.total_dia_3 = extraData.total_dia_3;

      if (extraData.intervalo_ciclo) parsed.intervalo_ciclo = extraData.intervalo_ciclo;
      if (extraData.ciclos_programados) parsed.ciclos_programados = extraData.ciclos_programados;
      if (extraData.tipo_tratamiento) parsed.tipo_tratamiento = extraData.tipo_tratamiento;
      if (extraData.linea) parsed.linea = extraData.linea;

      if (extraData.peso) parsed.peso = extraData.peso;
      if (extraData.talla) parsed.talla = extraData.talla;
      if (extraData.ecog) parsed.ecog = extraData.ecog;
      if (extraData.telefono) parsed.telefono = extraData.telefono;
      if (extraData.fnac) parsed.fnac = extraData.fnac;

      if (isRenovacion) {
        if (extraData.motivo_renovacion) parsed.motivo_renovacion = extraData.motivo_renovacion;
        if (extraData.ciclos_realizados) parsed.ciclos_realizados = extraData.ciclos_realizados;
        if (extraData.respuesta) parsed.respuesta = extraData.respuesta;
        if (extraData.sitio_progresion) parsed.sitio_progresion = extraData.sitio_progresion;
      }
    }

    if (!parsed.peso && fallback.weight) parsed.peso = fallback.weight;
    if (!parsed.talla && fallback.height) parsed.talla = fallback.height;
    if (!parsed.ecog && fallback.ecog) parsed.ecog = fallback.ecog;
    if (!parsed.telefono && fallback.phone) parsed.telefono = fallback.phone;
    if (!parsed.fnac && fallback.fnac) parsed.fnac = fallback.fnac;

    return parsed;
  };

  const fillAdmisionPDF = async (formDef: any, regenParams?: { drugName: string; correction: string }, extraData?: typeof bancoFormData) => {
    if (!hasClinicalData) { alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero."); return; }
    
    const drugName = extraData?.droga_1 || regenParams?.drugName || '';
    if (!drugName.trim()) return;

    setProcessingId(formDef.id);
    setStatus('Procesando Admisión Banco de Drogas...');
    try {
      const d = await extractBancoDrogasData('ADMISIÓN', drugName, regenParams?.correction, extraData);
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

      const finalPatientName = d.nombre_apellido || patient?.name || 'Paciente';

      setT('Text1', finalPatientName);
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
      link.download = `Admision_BancoDrogas_${finalPatientName.replace(/\s+/g, '_')}.pdf`; link.click();
      setStatus('¡Listo!');
      const newAccumulated = regenParams
        ? (lastRegenParams[formDef.id]?.accumulatedCorrections
            ? `${lastRegenParams[formDef.id].accumulatedCorrections}\n- ${regenParams.correction}`
            : `- ${regenParams.correction}`)
        : '';
      setLastRegenParams(prev => ({ ...prev, [formDef.id]: { drugName: drugName.trim(), accumulatedCorrections: newAccumulated } }));
      setFormGenerated(prev => ({ ...prev, [formDef.id]: true }));
      setFormCorrections(prev => ({ ...prev, [formDef.id]: '' }));
      setShowBancoModal(null);
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  const fillRenovacionPDF = async (formDef: any, regenParams?: { drugName: string; correction: string }, extraData?: typeof bancoFormData) => {
    if (!hasClinicalData) { alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero."); return; }
    
    const drugName = extraData?.droga_1 || regenParams?.drugName || '';
    if (!drugName.trim()) return;

    setProcessingId(formDef.id);
    setStatus('Procesando Renovación Banco de Drogas...');
    try {
      const d = await extractBancoDrogasData('RENOVACIÓN', drugName, regenParams?.correction, extraData);
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

      const finalPatientName = d.nombre_apellido || patient?.name || 'Paciente';

      setT('Text2', finalPatientName);
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
      link.download = `Renovacion_BancoDrogas_${finalPatientName.replace(/\s+/g, '_')}.pdf`; link.click();
      setStatus('¡Listo!');
      const newAccumulated = regenParams
        ? (lastRegenParams[formDef.id]?.accumulatedCorrections
            ? `${lastRegenParams[formDef.id].accumulatedCorrections}\n- ${regenParams.correction}`
            : `- ${regenParams.correction}`)
        : '';
      setLastRegenParams(prev => ({ ...prev, [formDef.id]: { drugName: drugName.trim(), accumulatedCorrections: newAccumulated } }));
      setFormGenerated(prev => ({ ...prev, [formDef.id]: true }));
      setFormCorrections(prev => ({ ...prev, [formDef.id]: '' }));
      setShowBancoModal(null);
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  const generateDinadicPDF = async (esquema?: typeof esquemaData) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }

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
        Actúa como un MÉDICO ONCÓLOGO EXPERTO. Hoy es ${today}.
        Analiza toda la información disponible (Historia Clínica, Línea de Tiempo y archivos adjuntos) y extrae TODOS los datos posibles para completar el formulario DINADIC (ex-DADSE) de solicitud de medicación de alto costo.
        FÁRMACO SOLICITADO: ${drugName}.
        IDIOMA: Todo en español.
        
        REGLAS DE EXTRACCIÓN Y DEDUCCIÓN:
        - fecha_diagnostico: DEDUCE OBLIGATORIAMENTE la fecha de diagnóstico inicial analizando las fechas del primer estudio patológico, biopsia o consulta diagnóstica inicial en los eventos de la Línea de Tiempo o Historia Clínica (Formato DD/MM/AAAA).
        
        Devolver ÚNICAMENTE un objeto JSON con este esquema exacto:
        {
          "paciente_nombre": "",
          "paciente_dni": "",
          "paciente_edad": "",
          "paciente_sexo": "M" o "F",
          "paciente_fnac": "DD/MM/AAAA",
          "paciente_domicilio": "",
          "paciente_localidad": "",
          "paciente_provincia": "Córdoba",
          "paciente_telefono": "",
          "paciente_email": "",
          "paciente_cobertura": "Ninguna / Pública",
          "diagnostico_cie10": "",
          "diagnostico_descripcion": "",
          "estadio": "",
          "fecha_diagnostico": "DD/MM/AAAA",
          "tnm_t": "", "tnm_n": "", "tnm_m": "",
          "ecog": "0",
          "peso": "",
          "talla": "",
          "linea_tratamiento": "1ra línea",
          "intencion_tratamiento": "adyuvante/neoadyuvante/avanzado/paliativo",
          "resumen_historia_clinica": "Breve resumen narrativo del cuadro clínico, tratamientos previos y justificación del fármaco solicitado (máx 500 caracteres).",
          "antecedentes_relevantes": "Comorbilidades relevantes o cirugías previas.",
          "estudios_complementarios": "Estudios diagnósticos clave (biopsia, TAC, RMN, PET) con fechas y resultados.",
          "laboratorio_relevante": "Valores clave de laboratorio (hemograma, función renal, hepática, marcadores).",
          "medicacion_solicitada": "${drugName}",
          "dosis_propuesta": "",
          "frecuencia_administracion": "",
          "duracion_tratamiento": "",
          "medico_solicitante": "",
          "medico_matricula": "",
          "medico_especialidad": "Oncología Clínica",
          "institucion": "Hospital Oncológico Provincial - Córdoba",
          "lugar_fecha": "Córdoba, ${today}"
        }

        CONTEXTO CLÍNICO: ${getEffectiveClinicalContext()}${pendingDinadicCorrection ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${pendingDinadicCorrection}. Incorporar en los campos correspondientes.` : ''}
      `;

      const parts: any[] = [{ text: extractPrompt }];
      if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

      const res = await callGemini({ parts, responseMimeType: "application/json" });
      let clean = res.text.replace(/```json|```/g, '').trim();
      const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
      if (s !== -1 && e !== -1) clean = clean.substring(s, e + 1);
      const d = JSON.parse(clean);

      setStatus('Generando PDF DINADIC...');

      const formUrl = window.location.origin + '/forms/nuevo_dinadic.pdf';
      const formRes = await fetch(formUrl);
      if (!formRes.ok) throw new Error('No se encontró /forms/nuevo_dinadic.pdf');
      const pdfDoc = await PDFDocument.load(await formRes.arrayBuffer());
      const form = pdfDoc.getForm();

      const bsa = calculateBSA(d.peso, d.talla);
      const [fnd, fnm, fna] = (cleanDate(d.paciente_fnac) || '').split('/');
      const [dxd, dxm, dxa] = (cleanDate(d.fecha_diagnostico) || '').split('/');

      const setT = (name: string, val: string, max = 9.5, min = 6.5) => {
        try {
          const f = form.getTextField(name);
          if (!val?.trim()) return;
          const text = String(val).trim();
          let fs = max, w = 350;
          try { const r = (f as any).acroField.getWidgets()[0].getRectangle(); w = Math.max(r.width - 4, 30); } catch { /* widget rect unavailable */ }
          while (fs > min && text.length * 0.52 * fs > w) fs = Math.round((fs - 0.5) * 10) / 10;
          f.setText(text); f.setFontSize(fs);
        } catch { /* field not found in form */ }
      };

      const finalName = d.paciente_nombre || patient?.name || 'Paciente';

      setT('APELLIDO Y NOMBRE', finalName);
      setT('DNI', d.paciente_dni);
      setT('EDAD', d.paciente_edad);
      setT('DOMICILIO', d.paciente_domicilio);
      setT('LOCALIDAD', d.paciente_localidad);
      setT('TELEFONO', d.paciente_telefono);
      setT('EMAIL', d.paciente_email);
      setT('DIAGNOSTICO', d.diagnostico_descripcion || d.diagnostico_cie10);
      setT('CIE 10', d.diagnostico_cie10);
      setT('ESTADIO', d.estadio);
      setT('TNM', [d.tnm_t, d.tnm_n, d.tnm_m].filter(Boolean).join(' '));
      setT('ECOG', d.ecog);
      setT('PESO', d.peso);
      setT('TALLA', d.talla);
      setT('SUP CORPORAL', bsa);
      setT('LINEA DE TRATAMIENTO', d.linea_tratamiento);
      setT('RESUMEN HISTORIA CLINICA', d.resumen_historia_clinica, 8.5, 6);
      setT('ESTUDIOS', d.estudios_complementarios, 8.5, 6);
      setT('LABORATORIO', d.laboratorio_relevante, 8.5, 6);
      setT('MEDICACION SOLICITADA', esquema.medicamentos || drugName);
      setT('DOSIS', esquema.dosis_m2 || d.dosis_propuesta);
      setT('NUMERO DE CICLOS', esquema.numero_ciclos || d.duracion_tratamiento);
      setT('FRECUENCIA', esquema.frecuencia_ciclos || d.frecuencia_administracion);
      setT('TIEMPO DE TRATAMIENTO', esquema.tiempo_tratamiento);
      setT('FECHA DE INICIO', cleanDate(esquema.fecha_inicio));
      setT('DOSIS TOTAL POR CICLO', esquema.dosis_total_ciclo);
      setT('DIAS DE ADMINISTRACION', esquema.dias_admin);
      setT('INTERVALO ENTRE CICLOS', esquema.intervalo);
      setT('INSTITUCION', d.institucion || 'Hospital Oncológico Provincial - Córdoba');
      setT('LUGAR Y FECHA', d.lugar_fecha || `Córdoba, ${today}`);
      setT('MEDICO SOLICITANTE', doctorData.nombre ? `Dr/a. ${doctorData.nombre}` : (d.medico_solicitante || ''));
      setT('MATRICULA', doctorData.matricula || d.medico_matricula || '');

      setT('FNAC_DIA', fnd); setT('FNAC_MES', fnm); setT('FNAC_ANIO', fna);
      setT('DX_DIA', dxd); setT('DX_MES', dxm); setT('DX_ANIO', dxa);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `DINADIC_${finalName.replace(/\s+/g, '_')}_${drugName}.pdf`; link.click();
      setStatus('¡Listo!');
      setLastRegenParams(prev => ({
        ...prev,
        dinadic: {
          drugName: drugName.trim(),
          accumulatedCorrections: prev['dinadic']?.accumulatedCorrections || ''
        }
      }));
      setFormGenerated(prev => ({ ...prev, dinadic: true }));
      setFormCorrections(prev => ({ ...prev, dinadic: '' }));
      setPendingDinadicCorrection('');
    } catch (e: any) { alert('Error DINADIC: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  const liveBSA = calculateBSA(pamiFormData.peso, pamiFormData.talla);
  const missingMandatoryList = PAMI_MANDATORY_FIELDS.filter(f => !String((pamiFormData as any)[f.key] || '').trim());
  const missingMandatoryCount = missingMandatoryList.length;

  const handleFocusField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600" size={20} />
            <span>Gestor de Formularios y Trámites Médicos</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatización y asistencia para PAMI Oncológico, Banco de Drogas y DINADIC.
          </p>
        </div>
        
        <button
          onClick={() => setShowDocConfig(!showDocConfig)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 transition-all self-start sm:self-auto shrink-0"
        >
          <UserCog size={14} className="text-gray-500"/>
          <span>{doctorData.nombre ? `Dr/a. ${doctorData.nombre}` : 'Configurar Médico'}</span>
        </button>
      </div>

      {/* Configuración de Médico */}
      {showDocConfig && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Datos Profesionales para Formularios Oficiales
            </h4>
            <button onClick={() => setShowDocConfig(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Nombre y Apellido</label>
              <input type="text" value={doctorData.nombre} onChange={e => setDoctorData(prev => ({ ...prev, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Matrícula Profesional</label>
              <input type="text" value={doctorData.matricula} onChange={e => setDoctorData(prev => ({ ...prev, matricula: e.target.value }))} placeholder="Ej: 34567" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Especialidad</label>
              <input type="text" value={doctorData.especialidad} onChange={e => setDoctorData(prev => ({ ...prev, especialidad: e.target.value }))} placeholder="Oncología Clínica" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Email de Contacto</label>
              <input type="text" value={doctorData.email} onChange={e => setDoctorData(prev => ({ ...prev, email: e.target.value }))} placeholder="medico@hospital.com" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Provincia</label>
              <input type="text" value={doctorData.provincia} onChange={e => setDoctorData(prev => ({ ...prev, provincia: e.target.value }))} placeholder="Córdoba" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CUIL / CUIT (Prefijo - DNI - Dígito)</label>
              <div className="grid grid-cols-3 gap-1">
                <input type="text" value={doctorData.cuil_prefix} onChange={e => setDoctorData(prev => ({ ...prev, cuil_prefix: e.target.value }))} placeholder="20" className="p-2 text-xs border border-slate-300 rounded-lg bg-white text-center"/>
                <input type="text" value={doctorData.cuil_dni} onChange={e => setDoctorData(prev => ({ ...prev, cuil_dni: e.target.value }))} placeholder="12345678" className="p-2 text-xs border border-slate-300 rounded-lg bg-white text-center"/>
                <input type="text" value={doctorData.cuil_suffix} onChange={e => setDoctorData(prev => ({ ...prev, cuil_suffix: e.target.value }))} placeholder="9" className="p-2 text-xs border border-slate-300 rounded-lg bg-white text-center"/>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={saveDoctorData} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5">
              <Save size={14} /> Guardar Perfil
            </button>
          </div>
        </div>
      )}

      {/* Estado del paciente / Contexto */}
      {!hasClinicalData && (
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="text-slate-400 shrink-0" size={16} />
          <p className="text-xs text-slate-600">
            Cargue la Historia Clínica en "Documentación" o agregue eventos en la Línea de Tiempo para habilitar la generación automática de trámites.
          </p>
        </div>
      )}

      {/* Status Bar */}
      {status && (
        <div className="mb-4 p-2.5 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2 text-xs text-blue-800 font-medium">
          <Loader2 size={14} className="animate-spin text-blue-600 shrink-0" />
          <span>{status}</span>
        </div>
      )}

      {/* Grilla de Formularios */}
      <div className="grid gap-4">
        {forms.map(form => {
          const isProcessing = processingId === form.id;

          return (
            <div key={form.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-200 transition-all shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wide">{form.name}</h4>
                    {form.id === 'pami' && (
                      <span className="text-[10px] text-gray-500">Revisión unificada con deducción automática de esquema</span>
                    )}
                  </div>
                </div>
                {isProcessing ? (
                  <Loader2 className="animate-spin text-blue-600" size={18}/>
                ) : (
                  <CheckCircle2 className="text-gray-200" size={18}/>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {form.type === 'auto' ? (
                  <div className="flex-1 flex gap-2">
                    <button 
                      onClick={() => fillPamiPDF(form)}
                      disabled={processingId !== null}
                      className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50
                        ${isProcessing ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar Formulario PAMI</span>
                    </button>
                    <a
                      href="https://cup.pami.org.ar/controllers/loginController.php"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200 text-xs font-bold"
                      title="Ir a PAMI Web"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                ) : form.type === 'auto_dinadic' ? (
                  <div className="flex-1 flex flex-wrap gap-2">
                    <button
                      onClick={() => generateDinadicPDF()}
                      disabled={processingId !== null}
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-1.5 text-white py-2 px-3 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 transition-all disabled:opacity-50"
                    >
                      {processingId === 'dinadic' ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar</span>
                    </button>
                    <button
                      onClick={() => downloadTemplate(form)}
                      className="flex items-center justify-center space-x-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    >
                      <Download size={14}/><span>Plantilla</span>
                    </button>
                    <button
                      onClick={() => generateClinicalSummary(form.context || 'SOLICITUD', undefined)}
                      disabled={processingId !== null}
                      className="flex items-center justify-center space-x-1.5 bg-purple-700 text-white hover:bg-purple-800 py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                      <span>Resumen Clínico</span>
                    </button>
                  </div>
                ) : form.type === 'auto_banco' ? (
                  <div className="flex-1 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleStartBancoFlow(form.id as 'admision' | 'renovacion')}
                      disabled={processingId !== null}
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-1.5 text-white py-2 px-3 rounded-lg text-xs font-bold bg-green-700 hover:bg-green-800 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar</span>
                    </button>
                    <button
                      onClick={() => downloadTemplate(form)}
                      className="flex items-center justify-center space-x-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    >
                      <Download size={14}/><span>Plantilla</span>
                    </button>
                    <button
                      onClick={() => generateClinicalSummary(form.context || 'SOLICITUD', undefined)}
                      disabled={processingId !== null}
                      className="flex items-center justify-center space-x-1.5 bg-purple-700 text-white hover:bg-purple-800 py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                      <span>Resumen Clínico</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Panel de Corrección posterior */}
              {(() => {
                const MAX_C = 300;
                const isRegen = processingId !== null;

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
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">¿Desea corregir algún dato del formulario?</p>
                      <div className="relative">
                        <textarea
                          value={correction}
                          onChange={e => setFormCorrections(prev => ({ ...prev, [form.id]: e.target.value.slice(0, MAX_C) }))}
                          placeholder="Ej: Modificar estadio a T3N1M0, ajustar dosis..."
                          rows={2}
                          disabled={isRegen}
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white resize-none outline-none focus:border-blue-400"
                        />
                        <span className="absolute bottom-1.5 right-2 text-[9px] text-slate-400">{MAX_C - correction.length}</span>
                      </div>
                      <button
                        onClick={handleRegen}
                        disabled={!correction.trim() || isRegen}
                        className="w-full flex items-center justify-center gap-1.5 bg-slate-800 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 disabled:opacity-40"
                      >
                        {isRegen ? <Loader2 size={12} className="animate-spin"/> : <RefreshCcw size={12}/>}
                        Regenerar con corrección
                      </button>
                    </div>
                  );
                }

                return null;
              })()}

            </div>
          );
        })}
      </div>

      {/* MODAL DE REVISIÓN SIMPLIFICADO: FORMULARIO PAMI ONCOLÓGICO */}
      {showPamiReviewModal && (() => {
        const justificationLength = (pamiFormData.informe_clinico_detallado || '').length;

        const renderField = (
          label: string,
          fieldKey: keyof typeof pamiFormData,
          isMandatory: boolean,
          placeholder = '',
          isSpan2 = false
        ) => {
          const val = pamiFormData[fieldKey] || '';
          const isMissing = !String(val).trim();
          const inputId = `pami-${fieldKey}`;

          return (
            <div className={isSpan2 ? 'col-span-2' : ''}>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={inputId} className="block text-[11px] font-semibold text-gray-700">
                  {label} {isMandatory && <span className="text-blue-600 font-bold">*</span>}
                </label>
              </div>
              <input
                id={inputId}
                type="text"
                placeholder={placeholder}
                value={val}
                onChange={e => setPamiFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                className={`w-full px-3 py-2 text-xs rounded-lg border transition-all outline-none ${
                  isMandatory && isMissing
                    ? 'border-slate-300 bg-slate-50/50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-100'
                    : 'border-gray-200 bg-white text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                }`}
              />
            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-3 sm:p-5">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
              
              {/* Header Minimalista */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-sm text-gray-900">
                        Formulario PAMI Oncológico
                      </h3>
                      {missingMandatoryCount > 0 ? (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-medium">
                          {missingMandatoryCount} {missingMandatoryCount === 1 ? 'dato obligatorio pendiente' : 'datos obligatorios pendientes'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium flex items-center gap-1">
                          <Check size={12} /> Datos completos
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Revise la información clínica. Los campos obligatorios están identificados con asterisco (*).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPamiReviewModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Resumen Único de Datos Faltantes (Discreto y Funcional) */}
              {missingMandatoryCount > 0 && (
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Faltan {missingMandatoryCount} datos obligatorios:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {missingMandatoryList.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleFocusField(item.id)}
                          className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded border border-slate-200 transition-all"
                        >
                          • {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-gray-50/20">
                
                {/* 1. Datos del Paciente */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    1. Datos del Paciente
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField('Apellido y Nombre', 'paciente_nombre_real', true, 'Nombre completo')}
                    {renderField('Fecha de Nacimiento', 'paciente_fnac', true, 'DD/MM/AAAA')}
                    {renderField('Teléfono / Celular', 'paciente_celular', false, 'Ej: 3511234567')}
                  </div>
                </div>

                {/* 2. Datos Clínicos & Antropometría */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    2. Datos Clínicos & Antropometría
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      {renderField('Diagnóstico (CIE-10)', 'diagnostico_cie10', true, 'Ej: C50.9 Cáncer de mama')}
                    </div>
                    {renderField('Peso (kg)', 'peso', true, 'Ej: 70')}
                    {renderField('Talla (cm)', 'talla', true, 'Ej: 165')}
                    {renderField('ECOG (0 - 4)', 'ecog', true, 'Ej: 0, 1')}
                  </div>

                  {/* Superficie Corporal */}
                  <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-gray-700">
                      Superficie Corporal: {liveBSA ? `${liveBSA} m²` : 'Pendiente de peso y talla'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {liveBSA ? 'Calculada automáticamente' : 'Se calcula al ingresar peso y talla'}
                    </span>
                  </div>
                </div>

                {/* 3. Tratamiento & Cronología */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    3. Tratamiento & Cronología
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField('Línea de Tratamiento', 'linea_tratamiento', false, 'Ej: 1ra línea / Adyuvancia')}
                    {renderField('N° Ciclos Planeados', 'ciclos_planeados', false, 'Ej: 6')}
                    {renderField('Frecuencia (Días)', 'frecuencia_dias', false, 'Ej: 21')}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">
                        Motivo de la Solicitud
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['Inicio', 'Renovación', 'Cambio de Toxicidad', 'Cambio por Progresión'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPamiFormData(prev => ({ ...prev, motivo_solicitud: opt }))}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-all ${
                              pamiFormData.motivo_solicitud === opt
                                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">
                        Tipo de Tratamiento
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['Adyuvante', 'Neoadyuvante', 'Avanzado'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPamiFormData(prev => ({ ...prev, tipo_tratamiento: opt }))}
                            className={`px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                              pamiFormData.tipo_tratamiento === opt
                                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Estadificación & Antecedentes */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    4. Estadificación & Antecedentes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField('Estadio Inicial', 'estadio_inicial', false, 'Ej: Estadio IV')}
                    {renderField('Fecha Diagnóstico Inicial', 'fecha_diagnostico_inicial', false, 'DD/MM/AAAA')}
                    {renderField('Estadio Actual', 'estadio_actual', false, 'Ej: Progresión / Estable')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    {renderField('Histopatológico / Inmunohistoquímica', 'histopatologico', false, 'Resumen patológico e IHQ')}
                    {renderField('Laboratorio Relevante', 'laboratorio_formateado', false, 'Hb 12g/dl, Cr 0.8, marcadores')}
                    {renderField('Antecedentes Quirúrgicos', 'antecedentes_qx', false, 'Cirugías y fechas')}
                    {renderField('Antecedentes Terapia Radiante', 'antecedentes_radio', false, 'RT, dosis y fechas')}
                  </div>
                </div>

                {/* 5. Informe Clínico Actual (Cuadro Grande) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      5. Informe Clínico & Justificación Médica <span className="text-blue-600">*</span>
                    </h4>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {justificationLength} / ~1400 caracteres
                    </span>
                  </div>
                  
                  <textarea
                    id="pami-informe_clinico_detallado"
                    rows={7}
                    placeholder="Redacte la justificación médica del tratamiento solicitado: hitos diagnósticos cronológicos, imágenes con fechas y hallazgos, estadio/reestadificación, biopsias, respuesta o suspensión de esquemas previos y fundamentación médica..."
                    value={pamiFormData.informe_clinico_detallado}
                    onChange={e => setPamiFormData(prev => ({ ...prev, informe_clinico_detallado: e.target.value }))}
                    className="w-full p-3 text-xs rounded-xl border border-gray-200 bg-white text-gray-800 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-100 leading-relaxed"
                  />
                  <p className="text-[11px] text-gray-400">
                    El cuadro grande de PAMI admite un informe de 800 a 1400 caracteres con la fundamentación del esquema.
                  </p>
                </div>

                {/* 6. Tabla de Drogas Oncológicas Solicitadas */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Pill size={14} className="text-blue-600"/>
                      <span>6. Drogas Oncológicas Solicitadas</span>
                    </h4>
                    <span className="text-[11px] text-gray-400">
                      Presentación, dosis y ciclos se completan al emitir el PDF
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {renderField('Droga #1 (Principal)', 'droga_1', true, 'Ej: Leuprolide')}
                    {renderField('Droga #2', 'droga_2', false, 'Ej: Darolutamida')}
                    {renderField('Droga #3', 'droga_3', false, 'Opcional')}
                    {renderField('Droga #4', 'droga_4', false, 'Opcional')}
                  </div>

                  {/* Sugerencias Rápidas */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
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
                          className="text-[11px] text-gray-500 hover:text-red-600 transition-colors"
                        >
                          Limpiar
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
                          className="px-2.5 py-1 text-xs font-medium bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-md border border-gray-200 transition-all"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-gray-600">
                  {missingMandatoryCount > 0 ? (
                    <span className="text-slate-600">
                      Faltan {missingMandatoryCount} datos obligatorios marcados con asterisco (*).
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Todos los datos obligatorios están listos.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPamiReviewModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all w-full sm:w-auto"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    disabled={processingId === 'pami'}
                    onClick={handlePamiDownloadClick}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all w-full sm:w-auto disabled:opacity-50"
                  >
                    {processingId === 'pami' ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
                    <span>Descargar Formulario PAMI (PDF)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL DE CONFIRMACIÓN ANTES DE GENERAR PDF PAMI (SI FALTAN DATOS OBLIGATORIOS) */}
      {showPamiMissingConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">Datos pendientes</h4>
                <p className="text-xs text-gray-500">
                  Faltan {missingMandatoryCount} datos obligatorios para completar el formulario.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
              <span className="font-semibold block">Campos pendientes:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {missingMandatoryList.map(m => (
                  <li key={m.key}>{m.label}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPamiMissingConfirm(false);
                  if (missingMandatoryList.length > 0) {
                    handleFocusField(missingMandatoryList[0].id);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-all"
              >
                Completar datos
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPamiMissingConfirm(false);
                  fillPamiPDFFromData(pamiFormData);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Generar igualmente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ESQUEMA Y DATOS: BANCO DE DROGAS (ADMISIÓN Y RENOVACIÓN) */}
      {showBancoModal && (() => {
        const isAdmision = showBancoModal === 'admision';
        const modalBSA = calculateBSA(bancoFormData.peso, bancoFormData.talla);

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-3 sm:p-5">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 text-green-700 rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">
                      {isAdmision ? 'Admisión Banco de Drogas' : 'Renovación Banco de Drogas'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Indique el esquema de fármacos y dosis para completar automáticamente las celdas del formulario.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowBancoModal(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-gray-50/20 text-xs">
                
                {/* 1. Tabla de Drogas y Posología */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100 flex items-center gap-1.5">
                    <Pill size={14} className="text-green-700" />
                    <span>1. Drogas Solicitadas y Dosificación</span>
                  </h4>

                  {/* Fila Droga 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-1">
                      <label className="block font-semibold text-gray-700 mb-1">
                        Droga #1 (Principal) <span className="text-blue-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Nivolumab"
                        value={bancoFormData.droga_1}
                        onChange={e => setBancoFormData(prev => ({ ...prev, droga_1: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Dosis (mg/m² o mg)</label>
                      <input
                        type="text"
                        placeholder="Ej: 3 mg/kg / 240 mg"
                        value={bancoFormData.dosis_1}
                        onChange={e => setBancoFormData(prev => ({ ...prev, dosis_1: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Días de Admin.</label>
                      <input
                        type="text"
                        placeholder="Ej: Día 1"
                        value={bancoFormData.dias_1}
                        onChange={e => setBancoFormData(prev => ({ ...prev, dias_1: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Dosis Total / Día</label>
                      <input
                        type="text"
                        placeholder="Ej: 240 mg"
                        value={bancoFormData.total_dia_1}
                        onChange={e => setBancoFormData(prev => ({ ...prev, total_dia_1: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Fila Droga 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-50">
                    <div className="sm:col-span-1">
                      <label className="block font-semibold text-gray-700 mb-1">Droga #2 (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Ipilimumab"
                        value={bancoFormData.droga_2}
                        onChange={e => setBancoFormData(prev => ({ ...prev, droga_2: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Dosis (mg/m² o mg)</label>
                      <input
                        type="text"
                        placeholder="Ej: 1 mg/kg"
                        value={bancoFormData.dosis_2}
                        onChange={e => setBancoFormData(prev => ({ ...prev, dosis_2: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Días de Admin.</label>
                      <input
                        type="text"
                        placeholder="Ej: Día 1"
                        value={bancoFormData.dias_2}
                        onChange={e => setBancoFormData(prev => ({ ...prev, dias_2: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Dosis Total / Día</label>
                      <input
                        type="text"
                        placeholder="Ej: 80 mg"
                        value={bancoFormData.total_dia_2}
                        onChange={e => setBancoFormData(prev => ({ ...prev, total_dia_2: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Fila Droga 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-50">
                    <div className="sm:col-span-1">
                      <label className="block font-semibold text-gray-700 mb-1">Droga #3 (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={bancoFormData.droga_3}
                        onChange={e => setBancoFormData(prev => ({ ...prev, droga_3: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Dosis</label>
                      <input
                        type="text"
                        placeholder=""
                        value={bancoFormData.dosis_3}
                        onChange={e => setBancoFormData(prev => ({ ...prev, dosis_3: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Días</label>
                      <input
                        type="text"
                        placeholder=""
                        value={bancoFormData.dias_3}
                        onChange={e => setBancoFormData(prev => ({ ...prev, dias_3: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Dosis Total / Día</label>
                      <input
                        type="text"
                        placeholder=""
                        value={bancoFormData.total_dia_3}
                        onChange={e => setBancoFormData(prev => ({ ...prev, total_dia_3: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Sugerencias Rápidas */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
                      Sugerencias:
                    </span>
                    {[
                      { label: 'Nivolumab + Ipilimumab', d1: 'Nivolumab', dos1: '3 mg/kg', dias1: 'Día 1', tot1: '240 mg', d2: 'Ipilimumab', dos2: '1 mg/kg', dias2: 'Día 1', tot2: '80 mg' },
                      { label: 'Trastuzumab + Pertuzumab', d1: 'Trastuzumab', dos1: '6 mg/kg (8 mg/kg carga)', dias1: 'Día 1', tot1: '420 mg', d2: 'Pertuzumab', dos2: '420 mg (840 mg carga)', dias2: 'Día 1', tot2: '420 mg' },
                      { label: 'Pembrolizumab 200mg', d1: 'Pembrolizumab', dos1: '200 mg EV', dias1: 'Día 1', tot1: '200 mg', d2: '', dos2: '', dias2: '', tot2: '' },
                      { label: 'Carboplatino + Paclitaxel', d1: 'Carboplatino', dos1: 'AUC 5', dias1: 'Día 1', tot1: 'AUC 5', d2: 'Paclitaxel', dos2: '175 mg/m²', dias2: 'Día 1', tot2: '300 mg' },
                      { label: 'Dabrafenib + Trametinib', d1: 'Dabrafenib', dos1: '150 mg VO cada 12 hs', dias1: '1 - 28', tot1: '300 mg', d2: 'Trametinib', dos2: '2 mg VO diario', dias2: '1 - 28', tot2: '2 mg' },
                    ].map(sug => (
                      <button
                        key={sug.label}
                        type="button"
                        onClick={() => setBancoFormData(prev => ({
                          ...prev,
                          droga_1: sug.d1, dosis_1: sug.dos1, dias_1: sug.dias1, total_dia_1: sug.tot1,
                          droga_2: sug.d2, dosis_2: sug.dos2, dias_2: sug.dias2, total_dia_2: sug.tot2,
                        }))}
                        className="px-2 py-0.5 text-[11px] font-medium bg-gray-50 hover:bg-green-50 hover:text-green-800 text-gray-700 rounded border border-gray-200 transition-all"
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Parámetros del Esquema */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    2. Parámetros del Esquema
                  </h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">N° Ciclos Programados</label>
                      <input
                        type="text"
                        placeholder="Ej: 6"
                        value={bancoFormData.ciclos_programados}
                        onChange={e => setBancoFormData(prev => ({ ...prev, ciclos_programados: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Intervalo de Ciclo (Días)</label>
                      <input
                        type="text"
                        placeholder="Ej: 21"
                        value={bancoFormData.intervalo_ciclo}
                        onChange={e => setBancoFormData(prev => ({ ...prev, intervalo_ciclo: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Tipo de Tratamiento</label>
                      <select
                        value={bancoFormData.tipo_tratamiento}
                        onChange={e => setBancoFormData(prev => ({ ...prev, tipo_tratamiento: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-500"
                      >
                        <option value="avanzado">Avanzado / Metástasis</option>
                        <option value="adyuvante">Adyuvante</option>
                        <option value="neoadyuvante">Neoadyuvante</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Línea de Tratamiento</label>
                      <select
                        value={bancoFormData.linea}
                        onChange={e => setBancoFormData(prev => ({ ...prev, linea: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-500"
                      >
                        <option value="1">1ra Línea</option>
                        <option value="2">2da Línea</option>
                        <option value="3">3ra Línea o posterior</option>
                      </select>
                    </div>
                  </div>

                  {/* Parámetros específicos de Renovación */}
                  {!isAdmision && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Motivo Renovación</label>
                        <select
                          value={bancoFormData.motivo_renovacion}
                          onChange={e => setBancoFormData(prev => ({ ...prev, motivo_renovacion: e.target.value }))}
                          className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-500"
                        >
                          <option value="continua">Continúa mismo esquema</option>
                          <option value="cambio">Cambio por Progresión / Toxicidad</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Ciclos Realizados</label>
                        <input
                          type="text"
                          placeholder="Ej: 3"
                          value={bancoFormData.ciclos_realizados}
                          onChange={e => setBancoFormData(prev => ({ ...prev, ciclos_realizados: e.target.value }))}
                          className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Respuesta Clínica</label>
                        <select
                          value={bancoFormData.respuesta}
                          onChange={e => setBancoFormData(prev => ({ ...prev, respuesta: e.target.value }))}
                          className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-500"
                        >
                          <option value="estable">Enfermedad Estable</option>
                          <option value="parcial">Respuesta Parcial</option>
                          <option value="completa">Respuesta Completa</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Sitio Progresión (si hubo)</label>
                        <input
                          type="text"
                          placeholder="Ej: Hepático"
                          value={bancoFormData.sitio_progresion}
                          onChange={e => setBancoFormData(prev => ({ ...prev, sitio_progresion: e.target.value }))}
                          className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Datos Clínicos & Antropometría */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    3. Antropometría y Estado Clínico
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Peso (kg)</label>
                      <input
                        type="text"
                        placeholder="Ej: 70"
                        value={bancoFormData.peso}
                        onChange={e => setBancoFormData(prev => ({ ...prev, peso: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Talla (cm)</label>
                      <input
                        type="text"
                        placeholder="Ej: 165"
                        value={bancoFormData.talla}
                        onChange={e => setBancoFormData(prev => ({ ...prev, talla: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Sup. Corporal</label>
                      <input
                        type="text"
                        disabled
                        value={modalBSA ? `${modalBSA} m²` : '—'}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-gray-100 font-bold text-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">ECOG (0 - 4)</label>
                      <input
                        type="text"
                        placeholder="Ej: 0 o 1"
                        value={bancoFormData.ecog}
                        onChange={e => setBancoFormData(prev => ({ ...prev, ecog: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="text"
                        placeholder="Ej: 3511234567"
                        value={bancoFormData.telefono}
                        onChange={e => setBancoFormData(prev => ({ ...prev, telefono: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBancoModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!bancoFormData.droga_1.trim() || processingId !== null}
                  onClick={() => {
                    const formDef = forms.find(f => f.id === showBancoModal);
                    if (showBancoModal === 'admision') {
                      fillAdmisionPDF(formDef, undefined, bancoFormData);
                    } else {
                      fillRenovacionPDF(formDef, undefined, bancoFormData);
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-xl shadow-xs transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {processingId !== null ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>Generar Formulario {isAdmision ? 'Admisión' : 'Renovación'} (PDF)</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL ESQUEMA DINADIC */}
      {showEsquemaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-sm text-gray-900">
                Esquema Terapéutico — DINADIC
              </h4>
              <button onClick={() => setShowEsquemaModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block font-semibold text-gray-700 mb-1">Medicamentos / Esquema</label>
                <input type="text" value={esquemaData.medicamentos} onChange={e => setEsquemaData(prev => ({ ...prev, medicamentos: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">N° de Ciclos</label>
                <input type="text" placeholder="Ej: 6" value={esquemaData.numero_ciclos} onChange={e => setEsquemaData(prev => ({ ...prev, numero_ciclos: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Frecuencia</label>
                <input type="text" placeholder="Ej: Cada 21 días" value={esquemaData.frecuencia_ciclos} onChange={e => setEsquemaData(prev => ({ ...prev, frecuencia_ciclos: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Dosis / m²</label>
                <input type="text" placeholder="Ej: 175 mg/m²" value={esquemaData.dosis_m2} onChange={e => setEsquemaData(prev => ({ ...prev, dosis_m2: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Dosis Total por Ciclo</label>
                <input type="text" placeholder="Ej: 300 mg" value={esquemaData.dosis_total_ciclo} onChange={e => setEsquemaData(prev => ({ ...prev, dosis_total_ciclo: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Días de Administración</label>
                <input type="text" placeholder="Ej: Día 1" value={esquemaData.dias_admin} onChange={e => setEsquemaData(prev => ({ ...prev, dias_admin: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Intervalo entre Ciclos</label>
                <input type="text" placeholder="Ej: 21 días" value={esquemaData.intervalo} onChange={e => setEsquemaData(prev => ({ ...prev, intervalo: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => setShowEsquemaModal(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowEsquemaModal(false);
                  generateDinadicPDF(esquemaData);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl"
              >
                Generar Formulario
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FormManager;
