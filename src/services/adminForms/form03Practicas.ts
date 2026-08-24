import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext } from './types';
import { drawOnLines, drawTextAt, drawMark, cleanDate } from './pdfHelpers';

export const form03PracticasDefinition: AdminFormDefinition = {
  id: 'form03_practicas',
  code: 'Form. 03',
  name: 'Solicitud de Prácticas Especializadas Extrahospitalarias',
  shortName: 'Form 03 - Prácticas Extrahospitalarias',
  institution: 'Ministerio de Salud de Córdoba (Anexo III Exp. 0425-68637/99)',
  description: 'Derivación y solicitud de estudios de alta complejidad fuera del hospital (PET-TC, RMN específica, Centellograma, Biología Molecular, etc.).',
  category: 'Prácticas y Estudios',
  templateFile: '/forms/form03_practicas.pdf',

  fields: [
    {
      key: 'solicitud_estudio',
      label: 'Práctica / Estudio Solicitado',
      type: 'textarea',
      placeholder: 'Ej: PET/TC corporal total con 18F-FDG para re-estadificación...',
      required: true,
      rows: 2,
      gridSpan: 12,
      group: '1. Datos de la Solicitud',
      helperText: 'Especifique con precisión la práctica, estudio o biopsia solicitada.'
    },
    {
      key: 'caracter_atencion',
      label: 'Carácter de la Atención',
      type: 'select',
      defaultValue: 'Ambulatorio',
      required: true,
      options: [
        { label: 'Ambulatorio', value: 'Ambulatorio' },
        { label: 'Urgencia', value: 'Urgencia' },
        { label: 'Emergencia', value: 'Emergencia' },
        { label: 'Estabilizado', value: 'Estabilizado' }
      ],
      gridSpan: 4,
      group: '1. Datos de la Solicitud'
    },
    {
      key: 'numero_derivacion',
      label: 'N° de Derivación (Opcional)',
      type: 'text',
      placeholder: 'Ej: 0425-...',
      gridSpan: 4,
      group: '1. Datos de la Solicitud'
    },
    {
      key: 'fecha_emision',
      label: 'Fecha de Emisión',
      type: 'date',
      required: true,
      gridSpan: 4,
      group: '1. Datos de la Solicitud'
    },
    {
      key: 'establecimiento',
      label: 'Establecimiento Solicitante',
      type: 'text',
      defaultValue: 'HOSPITAL ONCOLÓGICO PROVINCIAL',
      required: true,
      gridSpan: 6,
      group: '2. Datos del Paciente e Institución'
    },
    {
      key: 'servicio',
      label: 'Servicio',
      type: 'text',
      defaultValue: 'ONCOLOGÍA CLÍNICA',
      required: true,
      gridSpan: 6,
      group: '2. Datos del Paciente e Institución'
    },
    {
      key: 'apellido_nombre',
      label: 'Apellido y Nombre del Paciente',
      type: 'text',
      required: true,
      gridSpan: 6,
      group: '2. Datos del Paciente e Institución'
    },
    {
      key: 'tipo_nro_documento',
      label: 'Tipo y N° Documento',
      type: 'text',
      required: true,
      gridSpan: 6,
      group: '2. Datos del Paciente e Institución'
    },
    {
      key: 'condicion_obra_social',
      label: 'Condición Social / Obra Social',
      type: 'text',
      placeholder: 'Ej: Sin cobertura / PROFE / APROSS...',
      gridSpan: 6,
      group: '2. Datos del Paciente e Institución'
    },
    {
      key: 'fecha_internacion',
      label: 'Fecha Internación (si corresponde)',
      type: 'text',
      placeholder: 'DD/MM/AAAA',
      gridSpan: 6,
      group: '2. Datos del Paciente e Institución'
    },
    {
      key: 'diagnostico_presuntivo',
      label: 'Diagnóstico Presuntivo / Clínico',
      type: 'textarea',
      placeholder: 'Diagnóstico oncológico, subtipo histológico y estadificación...',
      required: true,
      rows: 2,
      gridSpan: 12,
      group: '3. Fundamentación Clínica'
    },
    {
      key: 'codigo_decreto',
      label: 'Código según Decreto (Opcional)',
      type: 'text',
      placeholder: 'Código de nomenclador...',
      gridSpan: 4,
      group: '3. Fundamentación Clínica'
    },
    {
      key: 'estudios_previos',
      label: 'Estudios Previos Efectuados y Resultados',
      type: 'textarea',
      placeholder: 'Imágenes previas, laboratorios, biopsia, etc.',
      required: true,
      rows: 3,
      gridSpan: 12,
      group: '3. Fundamentación Clínica'
    },
    {
      key: 'fundamentos_pedido',
      label: 'Fundamentos del Pedido y Plan Terapéutico (Epicrisis)',
      type: 'textarea',
      placeholder: 'Justificación médica del estudio y conducta terapéutica posterior...',
      required: true,
      rows: 4,
      gridSpan: 12,
      group: '3. Fundamentación Clínica'
    },
    {
      key: 'observaciones',
      label: 'Observaciones / Requisitos Especiales',
      type: 'textarea',
      placeholder: 'Aclaraciones adicionales, preparación del paciente, etc.',
      rows: 2,
      gridSpan: 12,
      group: '3. Fundamentación Clínica'
    }
  ],

  extractData: async (context: AdminFormContext, initialValues?: Record<string, any>) => {
    const today = new Date().toLocaleDateString('es-AR');
    const p = context.patient || {};
    const doc = context.doctorData || {};

    const baseData: Record<string, any> = {
      establecimiento: 'HOSPITAL ONCOLÓGICO PROVINCIAL',
      servicio: doc.especialidad || 'ONCOLOGÍA CLÍNICA',
      numero_derivacion: '',
      fecha_emision: today,
      apellido_nombre: p.name || '',
      tipo_nro_documento: `${p.dniType || 'DNI'} ${p.dni || ''}`.trim(),
      fecha_internacion: '',
      condicion_obra_social: p.healthInsurance || 'Sin Cobertura (Programa Provincial)',
      caracter_atencion: 'Ambulatorio',
      diagnostico_presuntivo: p.diagnosis || '',
      solicitud_estudio: initialValues?.solicitud_estudio || '',
      codigo_decreto: '',
      estudios_previos: '',
      fundamentos_pedido: '',
      observaciones: ''
    };

    if (!context.historyText && (!context.timeline || context.timeline.length === 0)) {
      return baseData;
    }

    try {
      const prompt = `
Actúa como oncólogo médico del Hospital Oncológico Provincial de Córdoba. Hoy es ${today}.
Analizá la historia clínica y extraé información precisa para completar el formulario oficial de "SOLICITUD DE PRÁCTICAS ESPECIALIZADAS EXTRAHOSPITALARIAS" (Form. 03 - Ministerio de Salud de Córdoba).

DATOS DEL PACIENTE:
- Nombre: ${baseData.apellido_nombre}
- DNI: ${baseData.tipo_nro_documento}
- Diagnóstico Base: ${baseData.diagnostico_presuntivo}

INSTRUCCIONES DE EXTRACCIÓN:
Devuelve ÚNICAMENTE un objeto JSON válido con los siguientes campos en texto plano y profesional en español:
{
  "diagnostico_presuntivo": "Diagnóstico oncológico completo con estadío clínico y subtipo histológico.",
  "solicitud_estudio": "Práctica o estudio de alta complejidad sugerido según la última evolución (ej: PET/TC con 18F-FDG, RMN SNC, etc. Si no se especifica, dejar vacío).",
  "estudios_previos": "Resumen cronológico conciso de biopsias, TAC, RMN, laboratorios y estudios relevantes previos con sus fechas y hallazgos clave.",
  "fundamentos_pedido": "Justificación clínica sólida para solicitar la práctica extrahospitalaria y su impacto en la toma de decisión o plan terapéutico.",
  "observaciones": "Observaciones clínicas pertinentes (ej: creatinina normal, requiere contraste, alergias, ECOG, etc.)."
}

HISTORIA CLÍNICA Y EVOLUCIONES:
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
        diagnostico_presuntivo: parsed.diagnostico_presuntivo || baseData.diagnostico_presuntivo,
        solicitud_estudio: initialValues?.solicitud_estudio || parsed.solicitud_estudio || baseData.solicitud_estudio,
        estudios_previos: parsed.estudios_previos || '',
        fundamentos_pedido: parsed.fundamentos_pedido || '',
        observaciones: parsed.observaciones || ''
      };
    } catch {
      return baseData;
    }
  },

  generatePDF: async (data: Record<string, any>, context: AdminFormContext) => {
    const formUrl = window.location.origin + '/forms/form03_practicas.pdf';
    const res = await fetch(formUrl);
    if (!res.ok) throw new Error('No se encontró la plantilla original de Formulario 03 (/forms/form03_practicas.pdf)');

    const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.getPages()[0];
    const textColor = rgb(0, 0, 0);

    // 1. Número de Derivación (superior derecho)
    drawTextAt(page, data.numero_derivacion || '', 535, 809.64, fontBold, 8.5, textColor);

    // 2. Fecha de Emisión (encolumnada sobre las barras de fecha)
    const emisionClean = cleanDate(data.fecha_emision) || data.fecha_emision || '';
    const emisionParts = emisionClean.split('/');
    if (emisionParts.length === 3) {
      drawTextAt(page, emisionParts[0], 474, 787.56, fontBold, 8.5, textColor);
      drawTextAt(page, emisionParts[1], 506, 787.56, fontBold, 8.5, textColor);
      drawTextAt(page, emisionParts[2], 536, 787.56, fontBold, 8.5, textColor);
    } else if (emisionClean) {
      drawTextAt(page, emisionClean, 474, 787.56, fontBold, 8.5, textColor);
    }

    // 3. Establecimiento y Servicio (sobre las líneas punteadas oficiales)
    drawTextAt(page, data.establecimiento || 'HOSPITAL ONCOLÓGICO PROVINCIAL', 160, 733.9, fontBold, 8, textColor);
    drawTextAt(page, data.servicio || 'ONCOLOGÍA CLÍNICA', 430, 733.9, fontBold, 8, textColor);

    // 4. Apellido y Nombre / Tipo y N° documento
    drawTextAt(page, (data.apellido_nombre || '').toUpperCase(), 155, 711.7, fontBold, 8.5, textColor);
    drawTextAt(page, data.tipo_nro_documento || '', 465, 711.7, fontBold, 8.5, textColor);

    // 5. Fecha Internación (dentro del recuadro izquierdo)
    const internacionClean = cleanDate(data.fecha_internacion) || data.fecha_internacion || '';
    const internacionParts = internacionClean.split('/');
    if (internacionParts.length === 3) {
      drawTextAt(page, internacionParts[0], 152, 678.46, font, 8, textColor);
      drawTextAt(page, internacionParts[1], 175, 678.46, font, 8, textColor);
      drawTextAt(page, internacionParts[2], 200, 678.46, font, 8, textColor);
    } else if (internacionClean) {
      drawTextAt(page, internacionClean, 152, 678.46, font, 8, textColor);
    }

    // 6. Condición Social y/o Obra Social
    drawTextAt(page, data.condicion_obra_social || '', 405, 667.42, fontBold, 8, textColor);

    // 7. Carácter de Atención (Checkboxes preimpresos)
    const caracter = data.caracter_atencion || 'Ambulatorio';
    if (caracter === 'Emergencia') drawMark(page, 75, 623, 10, fontBold, textColor);
    else if (caracter === 'Urgencia') drawMark(page, 201, 623, 10, fontBold, textColor);
    else if (caracter === 'Estabilizado') drawMark(page, 343, 623, 10, fontBold, textColor);
    else drawMark(page, 452, 623, 10, fontBold, textColor); // Ambulatorio

    // 8. Diagnóstico Presuntivo (3 líneas)
    const diagText = data.diagnostico_presuntivo || '';
    const diagFontSize = diagText.length > 180 ? 7.2 : 7.8;
    drawOnLines(page, diagText, [
      { x: 125, y: 586.99, width: 440 },
      { x: 63.864, y: 564.91, width: 505 },
      { x: 63.864, y: 542.83, width: 505 }
    ], font, diagFontSize, textColor);

    // 9. Solicitud de estudio (3 líneas)
    const solText = data.solicitud_estudio || '';
    const solFontSize = solText.length > 120 ? 7.5 : 8.0;
    drawOnLines(page, solText, [
      { x: 160, y: 520.75, width: 405 },
      { x: 63.864, y: 498.67, width: 505 },
      { x: 63.864, y: 476.47, width: 505 }
    ], fontBold, solFontSize, textColor);

    // 10. Código según decreto
    drawTextAt(page, data.codigo_decreto || '', 175, 454.39, font, 8, textColor);

    // 11. Estudios Previos Efectuados y Resultados (5 líneas)
    const prevText = data.estudios_previos || '';
    const prevFontSize = prevText.length > 350 ? 7.0 : 7.5;
    drawOnLines(page, prevText, [
      { x: 265, y: 418.85, width: 300 },
      { x: 63.864, y: 396.77, width: 505 },
      { x: 63.864, y: 374.69, width: 505 },
      { x: 63.864, y: 352.61, width: 505 },
      { x: 63.864, y: 330.53, width: 505 }
    ], font, prevFontSize, textColor);

    // 12. Fundamentos del Pedido y Plan Terapéutico (Epicrisis) (5 líneas debajo del título)
    const fundText = data.fundamentos_pedido || '';
    const fundFontSize = fundText.length > 380 ? 7.0 : 7.5;
    drawOnLines(page, fundText, [
      { x: 63.864, y: 294.29, width: 505 },
      { x: 63.864, y: 272.18, width: 505 },
      { x: 63.864, y: 250.10, width: 505 },
      { x: 63.864, y: 227.90, width: 505 },
      { x: 63.864, y: 205.82, width: 505 }
    ], font, fundFontSize, textColor);

    // 13. Observaciones (3 líneas)
    const obsText = data.observaciones || '';
    const obsFontSize = obsText.length > 220 ? 7.0 : 7.5;
    drawOnLines(page, obsText, [
      { x: 145, y: 183.74, width: 420 },
      { x: 63.864, y: 161.66, width: 505 },
      { x: 63.864, y: 139.58, width: 505 }
    ], font, obsFontSize, textColor);

    // 14. Firmas al pie
    const docName = context.doctorData?.nombre || '';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    if (docName) {
      drawTextAt(page, docName, 64, 56, fontBold, 7.5, textColor);
      if (docMat) drawTextAt(page, docMat, 64, 46, font, 7, textColor);
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
    const filename = `Form03_Practicas_${(data.apellido_nombre || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha_emision || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
