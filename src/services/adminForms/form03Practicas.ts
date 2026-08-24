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

    // Encabezado superior derecho
    drawTextAt(page, data.numero_derivacion || '', 495, 786, fontBold, 8.5, textColor);
    drawTextAt(page, cleanDate(data.fecha_emision) || data.fecha_emision || '', 460, 768, font, 8.5, textColor);

    // Establecimiento y Servicio
    drawTextAt(page, data.establecimiento || 'HOSPITAL ONCOLÓGICO PROVINCIAL', 165, 720, fontBold, 8, textColor);
    drawTextAt(page, data.servicio || 'ONCOLOGÍA CLÍNICA', 425, 720, fontBold, 8, textColor);

    // Apellido y Nombre / Tipo y N° Doc
    drawTextAt(page, (data.apellido_nombre || '').toUpperCase(), 145, 699, fontBold, 8.5, textColor);
    drawTextAt(page, data.tipo_nro_documento || '', 445, 699, fontBold, 8.5, textColor);

    // Fecha Internación y Condición Social
    drawTextAt(page, data.fecha_internacion || '', 155, 663, font, 8, textColor);
    drawTextAt(page, data.condicion_obra_social || '', 360, 663, fontBold, 8, textColor);

    // Carácter de Atención (Checkboxes en el original)
    const caracter = data.caracter_atencion || 'Ambulatorio';
    if (caracter === 'Emergencia') drawMark(page, 72, 624, 11, fontBold, textColor);
    else if (caracter === 'Urgencia') drawMark(page, 195, 624, 11, fontBold, textColor);
    else if (caracter === 'Estabilizado') drawMark(page, 334, 624, 11, fontBold, textColor);
    else drawMark(page, 448, 624, 11, fontBold, textColor); // Ambulatorio

    // Diagnóstico Presuntivo (3 líneas)
    drawOnLines(page, data.diagnostico_presuntivo, [
      { x: 160, y: 596, width: 380 },
      { x: 64,  y: 578, width: 476 },
      { x: 64,  y: 560, width: 476 },
    ], font, 8, textColor);

    // Solicitud de estudio (3 líneas)
    drawOnLines(page, data.solicitud_estudio, [
      { x: 160, y: 524, width: 380 },
      { x: 64,  y: 506, width: 476 },
      { x: 64,  y: 488, width: 476 },
    ], font, 8, textColor);

    // Código según decreto
    drawTextAt(page, data.codigo_decreto || '', 175, 447, font, 8, textColor);

    // Estudios Previos Efectuados y Resultados (5 líneas)
    drawOnLines(page, data.estudios_previos, [
      { x: 250, y: 422, width: 290 },
      { x: 64,  y: 404, width: 476 },
      { x: 64,  y: 386, width: 476 },
      { x: 64,  y: 368, width: 476 },
      { x: 64,  y: 350, width: 476 },
    ], font, 8, textColor);

    // Fundamentos del Pedido y Plan Terapéutico (Epicrisis) (6 líneas)
    drawOnLines(page, data.fundamentos_pedido, [
      { x: 64, y: 312, width: 476 },
      { x: 64, y: 294, width: 476 },
      { x: 64, y: 276, width: 476 },
      { x: 64, y: 258, width: 476 },
      { x: 64, y: 240, width: 476 },
      { x: 64, y: 222, width: 476 },
    ], font, 8, textColor);

    // Observaciones (3 líneas)
    drawOnLines(page, data.observaciones, [
      { x: 135, y: 186, width: 405 },
      { x: 64,  y: 168, width: 476 },
      { x: 64,  y: 150, width: 476 },
    ], font, 8, textColor);

    // Firmas al pie
    const docName = context.doctorData?.nombre || '';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    if (docName) {
      drawTextAt(page, docName, 64, 60, fontBold, 7.5, textColor);
      if (docMat) drawTextAt(page, docMat, 64, 50, font, 7, textColor);
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
    const filename = `Form03_Practicas_${(data.apellido_nombre || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha_emision || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
