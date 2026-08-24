import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext } from './types';
import { drawOnLines, drawTextAt, cleanDate } from './pdfHelpers';

export const derivacionProfeDefinition: AdminFormDefinition = {
  id: 'profe_133',
  code: 'Form. 133.0',
  name: 'Planilla de Derivación PROFE (Medicación de Alto Costo)',
  shortName: 'Form 133.0 - Planilla PROFE',
  institution: 'Ministerio de Salud de Córdoba / Programa Incluir Salud (PROFE)',
  description: 'Historia clínica de estado actual, evolución mensual y dosis para cobertura de fármacos oncológicos de alto costo vía PROFE.',
  category: 'Programas Especiales',
  templateFile: '/forms/derivacion_profe_133.pdf',

  fields: [
    {
      key: 'medicacion_solicitada',
      label: 'Medicación de Alto Costo Solicitada',
      type: 'text',
      placeholder: 'Ej: Pembrolizumab 200 mg, Trastuzumab emtansina, Osimertinib...',
      required: true,
      gridSpan: 12,
      group: '1. Tratamiento Solicitado',
      helperText: 'Indique el fármaco o esquema oncológico de alto costo a solicitar.'
    },
    {
      key: 'hospital',
      label: 'Hospital o Lugar de Atención',
      type: 'text',
      defaultValue: 'HOSPITAL ONCOLÓGICO PROVINCIAL DE CÓRDOBA',
      required: true,
      gridSpan: 8,
      group: '1. Tratamiento Solicitado'
    },
    {
      key: 'fecha',
      label: 'Fecha de Emisión',
      type: 'date',
      required: true,
      gridSpan: 4,
      group: '1. Tratamiento Solicitado'
    },
    // Datos del Paciente
    {
      key: 'apellido_nombre',
      label: 'Apellido y Nombre',
      type: 'text',
      required: true,
      gridSpan: 8,
      group: '2. Datos de Filiación y Beneficio'
    },
    {
      key: 'nro_beneficio',
      label: 'Número de Beneficio (PROFE / Incluir Salud)',
      type: 'text',
      placeholder: 'N° de Beneficio PROFE...',
      required: true,
      gridSpan: 4,
      group: '2. Datos de Filiación y Beneficio',
      helperText: 'Requerido para la auditoría de PROFE.'
    },
    {
      key: 'dni',
      label: 'DNI',
      type: 'text',
      required: true,
      gridSpan: 4,
      group: '2. Datos de Filiación y Beneficio'
    },
    {
      key: 'edad',
      label: 'Edad',
      type: 'text',
      gridSpan: 2,
      group: '2. Datos de Filiación y Beneficio'
    },
    {
      key: 'telefono',
      label: 'Teléfono',
      type: 'text',
      gridSpan: 6,
      group: '2. Datos de Filiación y Beneficio'
    },
    {
      key: 'domicilio',
      label: 'Domicilio Completo',
      type: 'text',
      placeholder: 'Calle, N°, Barrio, Localidad...',
      gridSpan: 12,
      group: '2. Datos de Filiación y Beneficio'
    },
    // Secciones Clínicas
    {
      key: 'diagnostico',
      label: 'Diagnóstico Oncológico',
      type: 'textarea',
      placeholder: 'Diagnóstico principal, estadificación TNM e histología...',
      required: true,
      rows: 2,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'antecedentes_heredofamiliares',
      label: 'Antecedentes Personales y Heredofamiliares',
      type: 'textarea',
      placeholder: 'Antecedentes médicos, comorbilidades, factores de riesgo y antecedentes familiares...',
      rows: 2,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'resumen_semiologico',
      label: 'Resumen Semiológico Actual – Medicación Alto Costo',
      type: 'textarea',
      placeholder: 'Examen físico, síntomas actuales, ECOG, hallazgos de laboratorios e imágenes relevantes...',
      required: true,
      rows: 4,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'evolucion_pronostico',
      label: 'Evolución y Pronóstico – Evolución Mensual para Alto Costo',
      type: 'textarea',
      placeholder: 'Respuesta al tratamiento previo, evolución mensual, tolerancia clínica y pronóstico oncológico...',
      required: true,
      rows: 4,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'tratamiento_propuesto',
      label: 'Tratamiento/s Propuesto – Dosis Mensual de Medicación Alto Costo',
      type: 'textarea',
      placeholder: 'Esquema de tratamiento, droga, dosis mensual, posología y duración prevista...',
      required: true,
      rows: 4,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    }
  ],

  extractData: async (context: AdminFormContext, initialValues?: Record<string, any>) => {
    const today = new Date().toLocaleDateString('es-AR');
    const p = context.patient || {};

    const baseData: Record<string, any> = {
      medicacion_solicitada: initialValues?.medicacion_solicitada || '',
      hospital: 'HOSPITAL ONCOLÓGICO PROVINCIAL DE CÓRDOBA',
      fecha: today,
      apellido_nombre: p.name || '',
      nro_beneficio: '',
      dni: p.dni || '',
      edad: p.age ? String(p.age) : '',
      telefono: '',
      domicilio: '',
      diagnostico: p.diagnosis || '',
      antecedentes_heredofamiliares: '',
      resumen_semiologico: '',
      evolucion_pronostico: '',
      tratamiento_propuesto: ''
    };

    if (!context.historyText && (!context.timeline || context.timeline.length === 0)) {
      return baseData;
    }

    try {
      const drugHint = initialValues?.medicacion_solicitada ? `FÁRMACO ALTO COSTO SOLICITADO: ${initialValues.medicacion_solicitada}.` : '';

      const prompt = `
Actúa como oncólogo médico del Hospital Oncológico Provincial de Córdoba. Hoy es ${today}.
Analizá la historia clínica y extraé los datos para completar el "Form 133.0 Planilla derivacion Profe - Medicación Alto Costo" (Ministerio de Salud de Córdoba / Programa Incluir Salud).
${drugHint}

DATOS DEL PACIENTE:
- Nombre: ${baseData.apellido_nombre}
- DNI: ${baseData.dni}
- Diagnóstico Base: ${baseData.diagnostico}

INSTRUCCIONES DE EXTRACCIÓN:
Devuelve ÚNICAMENTE un objeto JSON válido con los siguientes campos en texto clínico claro y profesional en español:
{
  "medicacion_solicitada": "Nombre del fármaco de alto costo con dosis mensual sugerida (ej: Pembrolizumab 200 mg EV c/21 días)",
  "diagnostico": "Diagnóstico oncológico con histopatología y estadificación.",
  "antecedentes_heredofamiliares": "Antecedentes patológicos personales y heredofamiliares oncológicos y no oncológicos relevantes.",
  "resumen_semiologico": "Resumen del examen físico actual, ECOG, síntomas, laboratorios clave y hallazgos radiológicos que justifiquen el requerimiento de alto costo.",
  "evolucion_pronostico": "Evolución oncológica reciente del paciente, respuesta a tratamientos previos, estabilidad/progresión y pronóstico con el tratamiento propuesto.",
  "tratamiento_propuesto": "Esquema terapéutico detallado con dosis mensual prescripta, vía de administración, intervalos y justificación técnica para el Programa PROFE."
}

HISTORIA CLÍNICA Y TIMELINE:
${context.historyText}
      `;

      const parts: any[] = [{ text: prompt }];
      if (context.files && context.files.length > 0) {
        context.files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
      }

      const res = await callGemini({ parts, responseMimeType: 'application/json' });
      let clean = (res.text || '{}').replace(/```json|```/g, '').trim();
      const si = clean.indexOf('{'), ei = clean.lastIndexOf('}');
      if (si !== -1 && ei !== -1) clean = clean.substring(si, ei + 1);
      const parsed = JSON.parse(clean);

      return {
        ...baseData,
        medicacion_solicitada: initialValues?.medicacion_solicitada || parsed.medicacion_solicitada || baseData.medicacion_solicitada,
        diagnostico: parsed.diagnostico || baseData.diagnostico,
        antecedentes_heredofamiliares: parsed.antecedentes_heredofamiliares || '',
        resumen_semiologico: parsed.resumen_semiologico || '',
        evolucion_pronostico: parsed.evolucion_pronostico || '',
        tratamiento_propuesto: parsed.tratamiento_propuesto || ''
      };
    } catch {
      return baseData;
    }
  },

  generatePDF: async (data: Record<string, any>, context: AdminFormContext) => {
    const formUrl = window.location.origin + '/forms/derivacion_profe_133.pdf';
    const res = await fetch(formUrl);
    if (!res.ok) throw new Error('No se encontró la plantilla original de Planilla PROFE 133.0 (/forms/derivacion_profe_133.pdf)');

    const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.getPages()[0];
    const textColor = rgb(0, 0, 0);

    // HOSPITAL O LUGAR DE ATENCIÓN
    drawTextAt(page, data.hospital || 'HOSPITAL ONCOLÓGICO PROVINCIAL DE CÓRDOBA', 225, 753, fontBold, 8, textColor);

    // FILIACIÓN Y BENEFICIO
    drawTextAt(page, (data.apellido_nombre || '').toUpperCase(), 175, 672, fontBold, 8.5, textColor);
    drawTextAt(page, data.nro_beneficio || '', 180, 650, fontBold, 8.5, textColor);

    drawTextAt(page, data.edad || '', 110, 628, font, 8.5, textColor);
    drawTextAt(page, data.dni || '', 270, 628, fontBold, 8.5, textColor);

    drawTextAt(page, data.telefono || '', 135, 606, font, 8.5, textColor);
    drawTextAt(page, data.domicilio || '', 320, 606, font, 8.5, textColor);

    // ANTECEDENTES PERSONALES Y HEREDOFAMILIARES (3 líneas)
    drawOnLines(page, data.antecedentes_heredofamiliares, [
      { x: 310, y: 562, width: 225 },
      { x: 64,  y: 542, width: 476 },
      { x: 64,  y: 522, width: 476 },
    ], font, 8, textColor);

    // RESUMEN SEMIOLÓGICO ACTUAL – MEDICACIÓN ALTO COSTO (8 líneas)
    drawOnLines(page, data.resumen_semiologico, [
      { x: 345, y: 492, width: 190 },
      { x: 64,  y: 472, width: 476 },
      { x: 64,  y: 452, width: 476 },
      { x: 64,  y: 432, width: 476 },
      { x: 64,  y: 412, width: 476 },
      { x: 64,  y: 392, width: 476 },
      { x: 64,  y: 372, width: 476 },
      { x: 64,  y: 352, width: 476 },
    ], font, 8, textColor);

    // DIAGNOSTICO (3 líneas)
    drawOnLines(page, data.diagnostico, [
      { x: 150, y: 322, width: 385 },
      { x: 64,  y: 302, width: 476 },
      { x: 64,  y: 282, width: 476 },
    ], font, 8, textColor);

    // EVOLUCION Y PRONOSTICO – EVOLUCIÓN MENSUAL PARA ALTO COSTO (7 líneas)
    drawOnLines(page, data.evolucion_pronostico, [
      { x: 385, y: 252, width: 150 },
      { x: 64,  y: 232, width: 476 },
      { x: 64,  y: 212, width: 476 },
      { x: 64,  y: 192, width: 476 },
      { x: 64,  y: 172, width: 476 },
      { x: 64,  y: 152, width: 476 },
      { x: 64,  y: 132, width: 476 },
    ], font, 8, textColor);

    // TRATAMIENTO/S PROPUESTO – DOSIS MENSUAL DE MEDICACIÓN ALTO COSTO (8 líneas)
    drawOnLines(page, data.tratamiento_propuesto, [
      { x: 425, y: 102, width: 110 },
      { x: 64,  y: 82,  width: 476 },
      { x: 64,  y: 62,  width: 476 },
      { x: 64,  y: 42,  width: 476 },
    ], font, 8, textColor);

    // FECHA Y FIRMA
    drawTextAt(page, cleanDate(data.fecha) || data.fecha || '', 110, 22, fontBold, 8.5, textColor);

    const docName = context.doctorData?.nombre || '';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    if (docName) {
      drawTextAt(page, docName, 390, 22, fontBold, 7.5, textColor);
      if (docMat) drawTextAt(page, docMat, 390, 12, font, 7, textColor);
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
    const filename = `Planilla_PROFE_133_${(data.apellido_nombre || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
