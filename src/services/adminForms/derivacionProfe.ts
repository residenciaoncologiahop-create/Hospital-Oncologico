import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext } from './types';
import { drawOnLinesFitted, drawTextAt, cleanDate } from './pdfHelpers';

export const derivacionProfeDefinition: AdminFormDefinition = {
  id: 'derivacion_profe_133',
  code: 'Form 133.0',
  name: 'Planilla Derivación PROFE - Medicación Alto Costo',
  shortName: 'Form 133 - Derivación PROFE',
  institution: 'Ministerio de Salud de Córdoba / Programa Incluir Salud (PROFE)',
  description: 'Planilla médica oficial 133.0 para derivación y solicitud mensual de medicamentos oncológicos y tratamientos especiales de alto costo.',
  category: 'Farmacia y Medicación',
  templateFile: '/forms/derivacion_profe_133.pdf',

  fields: [
    {
      key: 'medicacion_solicitada',
      label: 'Fármaco / Medicación de Alto Costo Solicitada',
      type: 'text',
      placeholder: 'Ej: Pembrolizumab 200 mg / Trastuzumab emtansina 160 mg...',
      required: true,
      gridSpan: 8,
      group: '1. Datos de la Solicitud',
      description: 'Nombre del esquema o droga de alto costo a autorizar por PROFE.'
    },
    {
      key: 'fecha',
      label: 'Fecha de Emisión',
      type: 'date',
      required: true,
      gridSpan: 4,
      group: '1. Datos de la Solicitud'
    },
    {
      key: 'hospital',
      label: 'Hospital o Lugar de Atención',
      type: 'text',
      required: true,
      gridSpan: 12,
      group: '1. Datos de la Solicitud'
    },
    {
      key: 'apellido_nombre',
      label: 'Apellido y Nombre del Paciente',
      type: 'text',
      required: true,
      gridSpan: 6,
      group: '2. Filiación y Cobertura'
    },
    {
      key: 'nro_beneficio',
      label: 'Número de Beneficio PROFE',
      type: 'text',
      placeholder: 'Ej: 04-25-000000-00',
      required: true,
      gridSpan: 6,
      group: '2. Filiación y Cobertura'
    },
    {
      key: 'edad',
      label: 'Edad',
      type: 'text',
      required: true,
      gridSpan: 3,
      group: '2. Filiación y Cobertura'
    },
    {
      key: 'dni',
      label: 'DNI / Documento',
      type: 'text',
      required: true,
      gridSpan: 3,
      group: '2. Filiación y Cobertura'
    },
    {
      key: 'telefono',
      label: 'Teléfono',
      type: 'text',
      placeholder: 'Contacto del paciente',
      gridSpan: 3,
      group: '2. Filiación y Cobertura'
    },
    {
      key: 'domicilio',
      label: 'Domicilio Completo',
      type: 'text',
      placeholder: 'Calle, número, barrio y localidad',
      gridSpan: 3,
      group: '2. Filiación y Cobertura'
    },
    {
      key: 'antecedentes_heredofamiliares',
      label: 'Antecedentes Personales y Heredofamiliares',
      type: 'textarea',
      placeholder: 'Comorbilidades, cirugías previas, antecedentes oncológicos en la familia...',
      required: true,
      rows: 3,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'resumen_semiologico',
      label: 'Resumen Semiológico Actual / Justificación de Alto Costo',
      type: 'textarea',
      placeholder: 'Examen físico actual, ECOG, síntomas, laboratorios relevantes y estudios radiológicos...',
      required: true,
      rows: 5,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'diagnostico',
      label: 'Diagnóstico Oncológico',
      type: 'textarea',
      placeholder: 'Diagnóstico histopatológico completo, estadificación TNM y subtipo...',
      required: true,
      rows: 3,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'evolucion_pronostico',
      label: 'Evolución y Pronóstico (Evolución Mensual)',
      type: 'textarea',
      placeholder: 'Evolución de la enfermedad, respuesta al tratamiento previo y pronóstico esperado...',
      required: true,
      rows: 5,
      gridSpan: 12,
      group: '3. Reseña Clínica y Evolución para Alto Costo'
    },
    {
      key: 'tratamiento_propuesto',
      label: 'Tratamiento Propuesto y Dosis Mensual',
      type: 'textarea',
      placeholder: 'Fármaco, dosis mensual, vía, intervalos de administración y fundamentación...',
      required: true,
      rows: 5,
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

    // 1. HOSPITAL O LUGAR DE ATENCIÓN
    drawTextAt(page, data.hospital || 'HOSPITAL ONCOLÓGICO PROVINCIAL DE CÓRDOBA', 215, 773.76 + 2, fontBold, 8.5, textColor);

    // 2. APELLIDO Y NOMBRE
    drawTextAt(page, (data.apellido_nombre || '').toUpperCase(), 165, 703.18 + 2, fontBold, 8.5, textColor);

    // 3. NÚMERO DE BENEFICIO
    drawTextAt(page, data.nro_beneficio || '', 180, 684.82 + 2, fontBold, 8.5, textColor);

    // 4. EDAD Y DNI
    const edadStr = data.edad ? (String(data.edad).includes('año') ? String(data.edad) : `${data.edad} años`) : '';
    drawTextAt(page, edadStr, 85, 666.58 + 2, fontBold, 8.5, textColor);
    drawTextAt(page, data.dni || '', 250, 666.58 + 2, fontBold, 8.5, textColor);

    // 5. TELÉFONO Y DOMICILIO (2 líneas para domicilio)
    drawTextAt(page, data.telefono || '', 110, 648.22 + 2, fontBold, 8.5, textColor);
    drawOnLinesFitted(page, data.domicilio || '', [
      { x: 365, y: 648.22 + 2, width: 190 },
      { x: 36,  y: 629.86 + 2, width: 520 }
    ], font, 8.0, 6.0, textColor);

    // 6. ANTECEDENTES PERSONALES Y HEREDOFAMILIARES (3 líneas)
    drawOnLinesFitted(page, data.antecedentes_heredofamiliares || '', [
      { x: 310, y: 611.62 + 2, width: 246 },
      { x: 36,  y: 593.26 + 2, width: 520 },
      { x: 36,  y: 575.02 + 2, width: 520 }
    ], font, 7.5, 5.5, textColor);

    // 7. RESUMEN SEMIOLÓGICO ACTUAL – MEDICACIÓN ALTO COSTO (8 líneas)
    drawOnLinesFitted(page, data.resumen_semiologico || '', [
      { x: 360, y: 556.63 + 2, width: 196 },
      { x: 36,  y: 538.39 + 2, width: 520 },
      { x: 36,  y: 520.03 + 2, width: 520 },
      { x: 36,  y: 501.67 + 2, width: 520 },
      { x: 36,  y: 483.43 + 2, width: 520 },
      { x: 36,  y: 465.07 + 2, width: 520 },
      { x: 36,  y: 446.83 + 2, width: 520 },
      { x: 36,  y: 428.47 + 2, width: 520 }
    ], font, 7.5, 5.5, textColor);

    // 8. DIAGNÓSTICO (3 líneas)
    drawOnLinesFitted(page, data.diagnostico || '', [
      { x: 120, y: 410.11 + 2, width: 436 },
      { x: 36,  y: 391.87 + 2, width: 520 },
      { x: 36,  y: 373.49 + 2, width: 520 }
    ], fontBold, 7.8, 5.8, textColor);

    // 9. EVOLUCIÓN Y PRONÓSTICO – EVOLUCIÓN MENSUAL PARA ALTO COSTO (7 líneas)
    drawOnLinesFitted(page, data.evolucion_pronostico || '', [
      { x: 410, y: 355.25 + 2, width: 146 },
      { x: 36,  y: 336.89 + 2, width: 520 },
      { x: 36,  y: 318.53 + 2, width: 520 },
      { x: 36,  y: 300.29 + 2, width: 520 },
      { x: 36,  y: 281.93 + 2, width: 520 },
      { x: 36,  y: 263.69 + 2, width: 520 },
      { x: 36,  y: 245.33 + 2, width: 520 }
    ], font, 7.5, 5.5, textColor);

    // 10. TRATAMIENTO/S PROPUESTO – DOSIS MENSUAL DE MEDICACIÓN ALTO COSTO (8 líneas)
    drawOnLinesFitted(page, data.tratamiento_propuesto || '', [
      { x: 445, y: 227.09 + 2, width: 111 },
      { x: 36,  y: 208.73 + 2, width: 520 },
      { x: 36,  y: 190.37 + 2, width: 520 },
      { x: 36,  y: 172.10 + 2, width: 520 },
      { x: 36,  y: 153.74 + 2, width: 520 },
      { x: 36,  y: 135.50 + 2, width: 520 },
      { x: 36,  y: 117.14 + 2, width: 520 },
      { x: 36,  y: 98.784 + 2, width: 520 }
    ], font, 7.5, 5.5, textColor);

    // 11. FECHA Y FIRMA
    drawTextAt(page, cleanDate(data.fecha) || data.fecha || '', 85, 53.544 + 2, fontBold, 8.5, textColor);

    const docName = context.doctorData?.nombre || '';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    if (docName) {
      drawTextAt(page, docName, 370, 70 + 2, fontBold, 8, textColor);
      if (docMat) drawTextAt(page, `${docMat} - Oncología Clínica`, 370, 60 + 2, font, 7.5, textColor);
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
    const filename = `Planilla_PROFE_133_${(data.apellido_nombre || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
