import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext } from './types';
import { drawWrappedTextLines, tryEmbedHeaderLogo } from './pdfHelpers';

export const derivacionProfeDefinition: AdminFormDefinition = {
  id: 'profe_133',
  code: 'Form. 133.0',
  name: 'Planilla de Derivación PROFE (Medicación de Alto Costo)',
  shortName: 'Form 133.0 - Planilla PROFE',
  institution: 'Ministerio de Salud de Córdoba / Programa Incluir Salud (PROFE)',
  description: 'Historia clínica de estado actual, evolución mensual y dosis para cobertura de fármacos oncológicos de alto costo vía PROFE.',
  category: 'Programas Especiales',

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
Analizá la historia clínica y extraé los datos para completar el "Form 133.0 Planilla derivación Profe - Medicación Alto Costo" (Ministerio de Salud de Córdoba / Programa Incluir Salud).
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
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const marginX = 40;
    const contentWidth = width - marginX * 2;
    let y = height - 28;

    // Logo Encabezado
    y = await tryEmbedHeaderLogo(pdfDoc, page, y, 32);

    // Header oficial Form 133
    page.drawText('Form 133.0 Planilla derivacion Profe', {
      x: marginX,
      y,
      size: 7.5,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    y -= 12;

    page.drawText(`HOSPITAL O LUGAR DE ATENCION: ${data.hospital || 'HOSPITAL ONCOLÓGICO PROVINCIAL'}`, {
      x: marginX,
      y,
      size: 8.5,
      font: fontBold
    });
    y -= 12;

    page.drawText('HISTORIA CLINICA (estado actual) Formulario para completar en todos sus ítems', {
      x: marginX,
      y,
      size: 8,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 10;

    page.drawText('Adjuntar informes escritos de estudios previos de laboratorio, diagnóstico por imágenes, etc.', {
      x: marginX,
      y,
      size: 7.5,
      font,
      color: rgb(0.4, 0.4, 0.4)
    });
    page.drawLine({ start: { x: marginX, y: y - 4 }, end: { x: width - marginX, y: y - 4 }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;

    // Filiación y Beneficio
    page.drawText(`APELLIDO Y NOMBRE: ${data.apellido_nombre || ''}`, { x: marginX, y, size: 8.5, font });
    y -= 13;

    page.drawText(`NÚMERO DE BENEFICIO: ${data.nro_beneficio || '……………………………………'}`, { x: marginX, y, size: 8.5, font: fontBold });
    y -= 13;

    page.drawText(`EDAD: ${data.edad || ''}`, { x: marginX, y, size: 8.5, font });
    page.drawText(`DNI: ${data.dni || ''}`, { x: marginX + 180, y, size: 8.5, font });
    y -= 13;

    page.drawText(`TELEFONO: ${data.telefono || ''}`, { x: marginX, y, size: 8.5, font });
    page.drawText(`DOMICILIO: ${data.domicilio || ''}`, { x: marginX + 180, y, size: 8.5, font });
    page.drawLine({ start: { x: marginX, y: y - 4 }, end: { x: width - marginX, y: y - 4 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 18;

    // Función de sección con recuadro y líneas
    const drawProfeSection = (titleLabel: string, content: string, linesCount: number) => {
      page.drawText(titleLabel, { x: marginX, y, size: 8, font: fontBold, color: rgb(0, 0, 0) });
      y -= 10;
      const bHeight = linesCount * 11 + 6;
      page.drawRectangle({
        x: marginX,
        y: y - bHeight + 8,
        width: contentWidth,
        height: bHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
        color: rgb(0.98, 0.98, 0.98),
      });

      drawWrappedTextLines(page, content || '', marginX + 4, y + 2, contentWidth - 8, linesCount, 11, 7.5, font);
      y -= (bHeight + 8);
    };

    // 1. Antecedentes personales y heredofamiliares (3 líneas)
    drawProfeSection('ANTECEDENTES PERSONALES Y HEREDOFAMILIARES:', data.antecedentes_heredofamiliares, 3);

    // 2. Resumen semiológico actual - Medicación alto costo (6 líneas)
    drawProfeSection('RESUMEN SEMIOLÓGICO ACTUAL – MEDICACIÓN ALTO COSTO:', data.resumen_semiologico, 6);

    // 3. Diagnóstico (2 líneas)
    drawProfeSection('DIAGNOSTICO:', data.diagnostico, 2);

    // 4. Evolución y pronóstico - Evolución mensual para alto costo (6 líneas)
    drawProfeSection('EVOLUCION Y PRONOSTICO – EVOLUCIÓN MENSUAL PARA ALTO COSTO:', data.evolucion_pronostico, 6);

    // 5. Tratamiento propuesto - Dosis mensual (6 líneas)
    drawProfeSection('TRATAMIENTO/S PROPUESTO – DOSIS MENSUAL DE MEDICACIÓN ALTO COSTO:', data.tratamiento_propuesto, 6);

    // Footer de firmas y fecha
    y = 45;
    page.drawText(`FECHA: ${data.fecha || '……/……/…………'}`, { x: marginX, y, size: 8.5, font: fontBold });

    const docName = context.doctorData?.nombre || 'Firma y Sello del Profesional';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    const sigX = width - marginX - 200;

    page.drawLine({
      start: { x: sigX, y: y + 15 },
      end: { x: sigX + 190, y: y + 15 },
      thickness: 0.6,
      color: rgb(0.3, 0.3, 0.3)
    });
    page.drawText(docName, { x: sigX + 10, y: y + 4, size: 8, font: fontBold });
    page.drawText(docMat || 'FIRMA Y SELLO DEL PROFESIONAL', { x: sigX + 10, y: y - 6, size: 7, font, color: rgb(0.4, 0.4, 0.4) });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `Planilla_PROFE_133_${(data.apellido_nombre || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
