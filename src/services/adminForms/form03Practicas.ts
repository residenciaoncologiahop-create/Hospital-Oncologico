import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext } from './types';
import { drawWrappedTextLines, drawCheckbox, tryEmbedHeaderLogo } from './pdfHelpers';

export const form03PracticasDefinition: AdminFormDefinition = {
  id: 'form03_practicas',
  code: 'Form. 03',
  name: 'Solicitud de Prácticas Especializadas Extrahospitalarias',
  shortName: 'Form 03 - Prácticas Extrahospitalarias',
  institution: 'Ministerio de Salud de Córdoba (Anexo III Exp. 0425-68637/99)',
  description: 'Derivación y solicitud de estudios de alta complejidad fuera del hospital (PET-TC, RMN específica, Centellograma, Biología Molecular, etc.).',
  category: 'Prácticas y Estudios',

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
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4 vertical
    const { width, height } = page.getSize();
    const marginX = 40;
    const contentWidth = width - marginX * 2;
    let y = height - 30;

    // Logo / Encabezado
    y = await tryEmbedHeaderLogo(pdfDoc, page, y, 32);

    // Título Principal
    const title = 'SOLICITUD PRÁCTICAS ESPECIALIZADAS';
    const subTitle = 'EXTRAHOSPITALARIAS';
    const expediente = 'Anexo III Expediente 0425-68637/99';

    page.drawText(title, { x: marginX + 110, y: y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(subTitle, { x: marginX + 145, y: y - 11, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(expediente, { x: marginX + 125, y: y - 22, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });

    // Bloque Derivación / Fecha
    page.drawText(`Form. 03 – Número Derivación: ${data.numero_derivacion || '………………'}`, {
      x: width - marginX - 180,
      y: y,
      size: 8,
      font: fontBold
    });
    page.drawText(`Fecha de Emisión: ${data.fecha_emision || '……/……/……'}`, {
      x: width - marginX - 180,
      y: y - 12,
      size: 8,
      font
    });

    y -= 38;

    // FORMULARIO 03 Label
    page.drawText('FORMULARIO 03', { x: marginX, y, size: 9, font: fontBold });
    y -= 14;

    // Establecimiento y Servicio
    page.drawText(`ESTABLECIMIENTO: ${data.establecimiento || ''}`, { x: marginX, y, size: 8, font: fontBold });
    page.drawText(`SERVICIO: ${data.servicio || ''}`, { x: marginX + 280, y, size: 8, font: fontBold });
    page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;

    // Apellido y Nombre / Documento
    page.drawText(`Apellido y Nombre: ${data.apellido_nombre || ''}`, { x: marginX, y, size: 8.5, font });
    page.drawText(`Tipo y N° documento: ${data.tipo_nro_documento || ''}`, { x: marginX + 280, y, size: 8.5, font });
    page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;

    // Fecha internación y Condición social
    page.drawText(`Fecha Internación: ${data.fecha_internacion || '……/……/……'}`, { x: marginX, y, size: 8, font });
    page.drawText(`Condición Social y/o Obra Social: ${data.condicion_obra_social || ''}`, { x: marginX + 170, y, size: 8, font });
    page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 18;

    // Carácter de atención (Checkboxes)
    const caracter = data.caracter_atencion || 'Ambulatorio';
    drawCheckbox(page, marginX + 10, y, 10, caracter === 'Emergencia', 'Emergencia', font, 8);
    drawCheckbox(page, marginX + 130, y, 10, caracter === 'Urgencia', 'Urgencia', font, 8);
    drawCheckbox(page, marginX + 250, y, 10, caracter === 'Estabilizado', 'Estabilizado', font, 8);
    drawCheckbox(page, marginX + 370, y, 10, caracter === 'Ambulatorio', 'Ambulatorio', font, 8);
    y -= 18;

    // Función de sección con recuadro
    const drawSection = (titleLabel: string, content: string, linesCount: number) => {
      page.drawText(titleLabel, { x: marginX, y, size: 8.5, font: fontBold, color: rgb(0, 0, 0) });
      y -= 11;
      const boxHeight = linesCount * 11 + 6;
      page.drawRectangle({
        x: marginX,
        y: y - boxHeight + 8,
        width: contentWidth,
        height: boxHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
        color: rgb(0.98, 0.98, 0.98),
      });

      drawWrappedTextLines(page, content || '', marginX + 4, y + 2, contentWidth - 8, linesCount, 11, 8, font);
      y -= (boxHeight + 6);
    };

    // 1. Diagnóstico Presuntivo
    drawSection('Diagnóstico Presuntivo:', data.diagnostico_presuntivo, 3);

    // 2. Solicitud de estudio
    const codigoStr = data.codigo_decreto ? ` (Código según decreto: ${data.codigo_decreto})` : '';
    drawSection(`Solicitud de estudio:${codigoStr}`, data.solicitud_estudio, 3);

    // 3. Estudios Previos Efectuados y Resultados
    drawSection('Estudios Previos Efectuados y Resultados:', data.estudios_previos, 5);

    // 4. Fundamentos del Pedido y Plan Terapéutico (Epicrisis)
    drawSection('Fundamentos del Pedido y Plan Terapéutico (Epicrisis):', data.fundamentos_pedido, 6);

    // 5. Observaciones
    drawSection('Observaciones:', data.observaciones, 3);

    // Firmas al pie
    y = 55;
    const sigColWidth = contentWidth / 4;
    const docName = context.doctorData?.nombre || 'Médico Solicitante';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';

    const drawSigLine = (colIdx: number, titleSig: string, extra = '') => {
      const sx = marginX + colIdx * sigColWidth;
      page.drawLine({
        start: { x: sx + 5, y: y + 15 },
        end: { x: sx + sigColWidth - 10, y: y + 15 },
        thickness: 0.6,
        color: rgb(0.4, 0.4, 0.4)
      });
      page.drawText(titleSig, { x: sx + 10, y: y + 4, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      if (extra) {
        page.drawText(extra, { x: sx + 10, y: y - 5, size: 6.5, font, color: rgb(0.4, 0.4, 0.4) });
      }
    };

    drawSigLine(0, docName, docMat);
    drawSigLine(1, 'Jefe de Servicio', 'Firma y Sello');
    drawSigLine(2, 'Médico Auditor', 'Firma y Sello');
    drawSigLine(3, 'Director / SubDirector', 'Hospital Oncológico');

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `Form03_Practicas_${(data.apellido_nombre || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha_emision || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
