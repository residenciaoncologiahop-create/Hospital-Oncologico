import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext, DrugTableRow } from './types';
import { calculateBSA, drawOnLinesFitted, drawTextAt, drawMark, cleanDate } from './pdfHelpers';

export const solicitudMedicamentosDefinition: AdminFormDefinition = {
  id: 'solicitud_medicamentos_onco',
  code: 'Ficha Med. Onco',
  name: 'Ficha de Solicitud de Medicamentos Oncológicos',
  shortName: 'Ficha Solicitud Medicamentos Oncológicos',
  institution: 'Hospital Oncológico Provincial / Ministerio de Salud de Córdoba',
  description: 'Solicitud institucional de fármacos oncológicos con tabla de drogas, dosis/m², ciclos y reseña de historia clínica (2 páginas).',
  category: 'Medicación y Farmacia',
  templateFile: '/forms/solicitud_medicamentos.pdf',

  fields: [
    {
      key: 'droga_principal',
      label: 'Fármaco / Esquema Principal a Solicitar',
      type: 'text',
      placeholder: 'Ej: Pembrolizumab, FOLFIRINOX, Trastuzumab + Pertuzumab...',
      required: true,
      gridSpan: 12,
      group: '1. Esquema Terapéutico Solicitado',
      helperText: 'Indique la medicación que requiere el paciente para generar automáticamente las dosis.'
    },
    {
      key: 'fecha_pedido',
      label: 'Fecha de Pedido',
      type: 'date',
      required: true,
      gridSpan: 3,
      group: '1. Esquema Terapéutico Solicitado'
    },
    {
      key: 'hospital',
      label: 'Hospital',
      type: 'text',
      defaultValue: 'Hospital Oncológico Provincial',
      required: true,
      gridSpan: 5,
      group: '1. Esquema Terapéutico Solicitado'
    },
    {
      key: 'localidad_hosp',
      label: 'Localidad Hospital',
      type: 'text',
      defaultValue: 'Córdoba',
      gridSpan: 4,
      group: '1. Esquema Terapéutico Solicitado'
    },
    {
      key: 'telefono_profesional',
      label: 'N° Teléfono Médico (Uso Profesional)',
      type: 'text',
      placeholder: 'Ej: 351 155123456',
      gridSpan: 6,
      group: '1. Esquema Terapéutico Solicitado'
    },
    {
      key: 'nombre_apellido',
      label: 'Nombre y Apellido del Paciente',
      type: 'text',
      required: true,
      gridSpan: 6,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'dni',
      label: 'D.N.I.',
      type: 'text',
      required: true,
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'nro_hc',
      label: 'N° de H.C.',
      type: 'text',
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'edad',
      label: 'Edad',
      type: 'text',
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'sexo',
      label: 'Sexo',
      type: 'text',
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'domicilio',
      label: 'Domicilio',
      type: 'text',
      gridSpan: 6,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'localidad',
      label: 'Localidad Paciente',
      type: 'text',
      defaultValue: 'Córdoba',
      gridSpan: 6,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'fecha_nacimiento',
      label: 'Fecha de Nacimiento',
      type: 'date',
      gridSpan: 4,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'telefono_paciente',
      label: 'T.E. Paciente',
      type: 'text',
      gridSpan: 4,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'nro_expediente',
      label: 'N° de Expediente',
      type: 'text',
      gridSpan: 4,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'paciente_internado',
      label: 'Paciente Internado',
      type: 'radio',
      options: [
        { label: 'NO', value: 'NO' },
        { label: 'SI', value: 'SI' }
      ],
      defaultValue: 'NO',
      gridSpan: 4,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'tratamiento_prolongado',
      label: 'Tratamiento Prolongado',
      type: 'radio',
      options: [
        { label: 'SI', value: 'SI' },
        { label: 'NO', value: 'NO' }
      ],
      defaultValue: 'SI',
      gridSpan: 4,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'diagnostico',
      label: 'Diagnóstico Oncológico',
      type: 'textarea',
      placeholder: 'Histología, primario y subtipo tumoral...',
      required: true,
      rows: 2,
      gridSpan: 12,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'estadio',
      label: 'Estadío TNM / Clínico',
      type: 'text',
      placeholder: 'Ej: Estadío IV (cT2 cN1 cM1b)',
      required: true,
      gridSpan: 4,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'peso',
      label: 'Peso (kg)',
      type: 'text',
      gridSpan: 2,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'talla',
      label: 'Talla (cm)',
      type: 'text',
      gridSpan: 2,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'superficie_corporal',
      label: 'Superficie Corporal (m²)',
      type: 'text',
      gridSpan: 4,
      group: '3. Datos Clínicos y Antropométricos'
    },
    {
      key: 'dosis_m2',
      label: 'Dosis por m² / Dosis Total',
      type: 'text',
      placeholder: 'Ej: 200 mg fijos o 175 mg/m²',
      gridSpan: 4,
      group: '4. Posología y Ciclos'
    },
    {
      key: 'ciclo_solicitado',
      label: 'Ciclo Solicitado N°',
      type: 'text',
      defaultValue: '1',
      gridSpan: 4,
      group: '4. Posología y Ciclos'
    },
    {
      key: 'total_ciclos',
      label: 'Total de Ciclos Previstos',
      type: 'text',
      defaultValue: '6 ciclos',
      gridSpan: 4,
      group: '4. Posología y Ciclos'
    },
    {
      key: 'antecedentes_clinicos',
      label: 'Antecedentes Clínicos (Dorso)',
      type: 'textarea',
      placeholder: 'Comorbilidades, ECOG, síntomas y toxicidades...',
      rows: 4,
      gridSpan: 12,
      group: '5. Reseña de Historia Clínica (Dorso)'
    },
    {
      key: 'antecedentes_quirurgicos',
      label: 'Antecedentes Quirúrgicos (Dorso)',
      type: 'textarea',
      placeholder: 'Cirugías oncológicas previas con fechas...',
      rows: 3,
      gridSpan: 12,
      group: '5. Reseña de Historia Clínica (Dorso)'
    },
    {
      key: 'tratamientos_previos',
      label: 'Tratamientos Previos y Fechas (Dorso)',
      type: 'textarea',
      placeholder: 'Quimioterapia, radioterapia o líneas previas...',
      rows: 3,
      gridSpan: 12,
      group: '5. Reseña de Historia Clínica (Dorso)'
    },
    {
      key: 'estudios_adjuntos',
      label: 'Estudios Adjuntos e Inmunohistoquímica (Dorso)',
      type: 'textarea',
      placeholder: 'Biopsias, IHQ (RE/RP/HER2/Ki67), TC o PET...',
      rows: 3,
      gridSpan: 12,
      group: '5. Reseña de Historia Clínica (Dorso)'
    }
  ],

  extractData: async (context: AdminFormContext, initialValues?: Record<string, any>) => {
    const today = new Date().toLocaleDateString('es-AR');
    const p = context.patient || {};
    const weight = p.weight ? parseFloat(p.weight) : undefined;
    const height = p.height ? parseFloat(p.height) : undefined;
    const bsa = calculateBSA(weight, height);

    const baseData: Record<string, any> = {
      droga_principal: initialValues?.droga_principal || '',
      fecha_pedido: today,
      hospital: 'Hospital Oncológico Provincial',
      localidad_hosp: 'Córdoba',
      telefono_profesional: '',
      nombre_apellido: p.name || '',
      dni: p.dni || '',
      nro_hc: p.recordNumber || '',
      edad: p.age ? String(p.age) : '',
      sexo: p.sex === 'M' ? 'Masculino' : p.sex === 'F' ? 'Femenino' : '',
      domicilio: '',
      localidad: 'Córdoba',
      fecha_nacimiento: p.birthDate || '',
      telefono_paciente: '',
      nro_expediente: '',
      paciente_internado: 'NO',
      tratamiento_prolongado: 'SI',
      diagnostico: p.diagnosis || '',
      estadio: p.stage || '',
      peso: weight ? String(weight) : '',
      talla: height ? String(height) : '',
      superficie_corporal: bsa ? String(bsa) : '',
      dosis_m2: '',
      ciclo_solicitado: '1',
      total_ciclos: '6 ciclos',
      antecedentes_clinicos: '',
      antecedentes_quirurgicos: '',
      tratamientos_previos: '',
      estudios_adjuntos: '',
      drogas_tabla: []
    };

    if (!context.historyText && (!context.timeline || context.timeline.length === 0)) {
      return baseData;
    }

    try {
      const drugHint = initialValues?.droga_principal ? `FÁRMACO/ESQUEMA SOLICITADO: ${initialValues.droga_principal}.` : '';

      const prompt = `
Actúa como oncólogo médico del Hospital Oncológico Provincial de Córdoba. Hoy es ${today}.
Analizá la historia clínica del paciente y extraé los datos para completar la "FICHA DE SOLICITUD DE MEDICAMENTOS ONCOLÓGICOS" oficial (2 páginas).
${drugHint}

DATOS DEL PACIENTE:
- Nombre: ${baseData.nombre_apellido}
- DNI: ${baseData.dni}
- Diagnóstico Base: ${baseData.diagnostico}
- Estadío: ${baseData.estadio}
- Peso: ${baseData.peso} kg | Talla: ${baseData.talla} cm | SC: ${baseData.superficie_corporal} m²

INSTRUCCIONES DE EXTRACCIÓN:
Devuelve ÚNICAMENTE un objeto JSON válido con los siguientes campos en texto claro, conciso y profesional en español:
{
  "droga_principal": "Nombre del fármaco o esquema oncológico principal (ej: Pembrolizumab, Letrozol, etc.)",
  "diagnostico": "Diagnóstico histopatológico y subtipo tumoral conciso (máximo 150 caracteres).",
  "estadio": "Estadío TNM o estadío clínico resumido (ej: Estadío IV cT2 cN1 cM1b).",
  "dosis_m2": "Dosis calculada por m² o dosis fija de la droga (ej: 200 mg fijos c/21d, o 175 mg/m²).",
  "ciclo_solicitado": "Número de ciclo solicitado (ej: 1)",
  "total_ciclos": "Total de ciclos previstos para el tratamiento (ej: 6 ciclos o 5 años)",
  "antecedentes_clinicos": "Comorbilidades relevantes, ECOG actual, síntomas y toxicidades de forma concisa.",
  "antecedentes_quirurgicos": "Cirugías previas con fecha si están disponibles.",
  "tratamientos_previos": "Líneas de quimioterapia, radioterapia u hormonoterapia previas con fechas y dosis.",
  "estudios_adjuntos": "Resumen de biopsia, inmunohistoquímica (RE, RP, HER2, Ki67) e imágenes clave.",
  "drogas_tabla": [
    {
      "droga": "Nombre de la droga 1",
      "concentracion": "Concentración (ej: 100 mg / 4 ml o 2.5 mg)",
      "envase": "comp. o F.A.",
      "dosisDiaria": "Dosis diaria/aplicación (ej: 2.5 mg/día o 200 mg EV)",
      "cantidadEnvases": "Cantidad requerida para el ciclo (ej: 1 caja o 2 F.A.)",
      "duracionTto": "Duración del tratamiento o intervalo (ej: 21 días o Diario continuo)"
    }
  ]
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
        droga_principal: initialValues?.droga_principal || parsed.droga_principal || baseData.droga_principal,
        diagnostico: parsed.diagnostico || baseData.diagnostico,
        estadio: parsed.estadio || baseData.estadio,
        dosis_m2: parsed.dosis_m2 || baseData.dosis_m2,
        ciclo_solicitado: parsed.ciclo_solicitado || '1',
        total_ciclos: parsed.total_ciclos || '6 ciclos',
        antecedentes_clinicos: parsed.antecedentes_clinicos || '',
        antecedentes_quirurgicos: parsed.antecedentes_quirurgicos || '',
        tratamientos_previos: parsed.tratamientos_previos || '',
        estudios_adjuntos: parsed.estudios_adjuntos || '',
        drogas_tabla: Array.isArray(parsed.drogas_tabla) && parsed.drogas_tabla.length > 0 ? parsed.drogas_tabla : [
          {
            droga: initialValues?.droga_principal || parsed.droga_principal || 'Medicación Oncológica',
            concentracion: '',
            envase: 'F.A.',
            dosisDiaria: parsed.dosis_m2 || '',
            cantidadEnvases: '1',
            duracionTto: '21 días'
          }
        ]
      };
    } catch {
      return baseData;
    }
  },

  generatePDF: async (data: Record<string, any>, context: AdminFormContext) => {
    const formUrl = window.location.origin + '/forms/solicitud_medicamentos.pdf';
    const res = await fetch(formUrl);
    if (!res.ok) throw new Error('No se encontró la plantilla original de Solicitud de Medicamentos (/forms/solicitud_medicamentos.pdf)');

    const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const p1 = pages[0];
    const p2 = pages[1];
    const textColor = rgb(0, 0, 0);

    // ─────────────────────────────────────────────────────────────
    // PÁGINA 1
    // ─────────────────────────────────────────────────────────────
    // 1. Fecha de pedido (encolumnada sobre las barras de fecha)
    const fechaClean = cleanDate(data.fecha_pedido) || data.fecha_pedido || '';
    const fechaParts = fechaClean.split('/');
    if (fechaParts.length === 3) {
      drawTextAt(p1, fechaParts[0], 174, 708.82, fontBold, 8.8, textColor);
      drawTextAt(p1, fechaParts[1], 207, 708.82, fontBold, 8.8, textColor);
      drawTextAt(p1, fechaParts[2], 238, 708.82, fontBold, 8.8, textColor);
    } else if (fechaClean) {
      drawTextAt(p1, fechaClean, 174, 708.82, fontBold, 8.8, textColor);
    }

    // 2. Hospital y Localidad
    drawTextAt(p1, data.hospital || 'Hospital Oncológico Provincial', 135, 679.54, fontBold, 8.8, textColor);
    drawTextAt(p1, data.localidad_hosp || 'Córdoba', 422, 679.54, fontBold, 8.8, textColor);

    // 3. Teléfono médico profesional
    drawTextAt(p1, data.telefono_profesional || '', 395, 650.14, fontBold, 8.5, textColor);

    // 4. DATOS DEL PACIENTE
    drawTextAt(p1, (data.nombre_apellido || '').toUpperCase(), 185, 586.15, fontBold, 9.0, textColor);
    drawTextAt(p1, data.nro_expediente || '', 480, 586.15, fontBold, 9.0, textColor);

    drawTextAt(p1, data.dni || '', 120, 564.19, fontBold, 8.8, textColor);
    drawTextAt(p1, data.nro_hc || '', 300, 564.19, fontBold, 8.8, textColor);
    drawTextAt(p1, data.edad || '', 395, 564.19, fontBold, 8.8, textColor);
    drawTextAt(p1, data.sexo || '', 470, 564.19, fontBold, 8.8, textColor);

    drawTextAt(p1, data.domicilio || '', 140, 542.23, font, 8.8, textColor);
    drawTextAt(p1, data.localidad || 'Córdoba', 390, 542.23, fontBold, 8.8, textColor);

    drawTextAt(p1, cleanDate(data.fecha_nacimiento) || data.fecha_nacimiento || '', 135, 520.27, fontBold, 8.8, textColor);
    drawTextAt(p1, data.telefono_paciente || '', 290, 520.27, fontBold, 8.8, textColor);

    // 5. DATOS MÉDICOS: Paciente Internado
    if (data.paciente_internado === 'SI') {
      p1.drawText('X', { x: 241, y: 447.67 + 1.5, size: 9, font: fontBold, color: textColor });
    } else {
      p1.drawText('X', { x: 316.5, y: 447.67 + 1.5, size: 9, font: fontBold, color: textColor });
    }

    // 6. Diagnóstico (2 líneas con ajuste dinámico)
    drawOnLinesFitted(p1, data.diagnostico || '', [
      { x: 150, y: 420.41, width: 395 },
      { x: 85,  y: 405.77, width: 460 }
    ], fontBold, 8.5, 6.8, textColor);

    // 7. Estadío
    drawTextAt(p1, data.estadio || '', 135, 391.13, fontBold, 8.8, textColor);

    // 8. TABLA DE DROGAS (Filas en y = 298, 269, 239, 209)
    const drugs: DrugTableRow[] = (data.drogas_tabla && data.drogas_tabla.length > 0) ? data.drogas_tabla : [
      { droga: data.droga_principal || '', concentracion: '', envase: 'F.A.', dosisDiaria: data.dosis_m2 || '', cantidadEnvases: '1', duracionTto: '21 días' }
    ];

    const tableYs = [298, 269, 239, 209];
    for (let i = 0; i < Math.min(drugs.length, 4); i++) {
      const d = drugs[i];
      const y = tableYs[i];
      drawTextAt(p1, d.droga || '', 85, y, fontBold, 8.2, textColor);
      drawTextAt(p1, d.concentracion || '', 216, y, font, 8.0, textColor);
      drawTextAt(p1, d.envase || '', 294, y, font, 8.0, textColor);
      drawTextAt(p1, d.dosisDiaria || '', 358, y, fontBold, 8.0, textColor);
      drawTextAt(p1, d.cantidadEnvases || '', 408, y, font, 7.8, textColor);
      drawTextAt(p1, d.duracionTto || '', 478, y, font, 7.8, textColor);
    }

    // 9. Tratamiento prolongado
    if (data.tratamiento_prolongado === 'SI') {
      p1.drawText('X', { x: 268.5, y: 168.62 + 1.5, size: 9, font: fontBold, color: textColor });
    } else {
      p1.drawText('X', { x: 351.5, y: 168.62 + 1.5, size: 9, font: fontBold, color: textColor });
    }

    // 10. Antropometría y Ciclos
    const pesoStr = data.peso ? (String(data.peso).includes('kg') ? data.peso : `${data.peso} kg`) : '';
    drawTextAt(p1, pesoStr, 118, 139.1, fontBold, 8.8, textColor);

    const bsaStr = data.superficie_corporal ? (String(data.superficie_corporal).includes('m') ? data.superficie_corporal : `${data.superficie_corporal} m²`) : '';
    drawTextAt(p1, bsaStr, 290, 139.1, fontBold, 8.8, textColor);

    drawTextAt(p1, data.total_ciclos || '', 512, 139.1, fontBold, 8.2, textColor);

    const tallaStr = data.talla ? (String(data.talla).includes('cm') ? data.talla : `${data.talla} cm`) : '';
    drawTextAt(p1, tallaStr, 118, 109.68, fontBold, 8.8, textColor);

    drawTextAt(p1, data.dosis_m2 || '', 265, 109.68, fontBold, 8.8, textColor);
    drawTextAt(p1, data.ciclo_solicitado || '1', 428, 109.68, fontBold, 8.8, textColor);

    // ─────────────────────────────────────────────────────────────
    // PÁGINA 2 (DORSO)
    // ─────────────────────────────────────────────────────────────
    // Antecedentes clínicos (9 líneas)
    drawOnLinesFitted(p2, data.antecedentes_clinicos || '', [
      { x: 198,    y: 755.62, width: 345 },
      { x: 85.104, y: 740.98, width: 460 },
      { x: 85.104, y: 719.02, width: 460 },
      { x: 85.104, y: 697.06, width: 460 },
      { x: 85.104, y: 675.10, width: 460 },
      { x: 85.104, y: 653.14, width: 460 },
      { x: 85.104, y: 631.18, width: 460 },
      { x: 85.104, y: 609.22, width: 460 },
      { x: 85.104, y: 587.11, width: 460 }
    ], font, 8.2, 6.5, textColor);

    // Antecedentes Quirúrgicos (5 líneas)
    drawOnLinesFitted(p2, data.antecedentes_quirurgicos || '', [
      { x: 220,    y: 565.15, width: 325 },
      { x: 85.104, y: 550.51, width: 460 },
      { x: 85.104, y: 528.55, width: 460 },
      { x: 85.104, y: 506.59, width: 460 },
      { x: 85.104, y: 484.63, width: 460 }
    ], font, 8.2, 6.5, textColor);

    // Tratamientos previos y fechas (7 líneas)
    drawOnLinesFitted(p2, data.tratamientos_previos || '', [
      { x: 355,    y: 448.03, width: 190 },
      { x: 85.104, y: 433.37, width: 460 },
      { x: 85.104, y: 411.41, width: 460 },
      { x: 85.104, y: 389.45, width: 460 },
      { x: 85.104, y: 367.37, width: 460 },
      { x: 85.104, y: 345.41, width: 460 },
      { x: 85.104, y: 323.45, width: 460 }
    ], font, 8.2, 6.5, textColor);

    // Estudios adjuntos (4 líneas)
    drawOnLinesFitted(p2, data.estudios_adjuntos || '', [
      { x: 85.104, y: 242.90, width: 460 },
      { x: 85.104, y: 220.94, width: 460 },
      { x: 85.104, y: 198.98, width: 460 },
      { x: 85.104, y: 176.90, width: 460 }
    ], font, 8.0, 6.2, textColor);

    // Firmas al pie
    const docName = context.doctorData?.nombre || '';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    if (docName) {
      drawTextAt(p2, docName, 106, 122, fontBold, 8.0, textColor);
      if (docMat) drawTextAt(p2, `${docMat} - Oncología Clínica`, 106, 112, font, 7.5, textColor);
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
    const filename = `Solicitud_Medicamentos_${(data.nombre_apellido || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha_pedido || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
