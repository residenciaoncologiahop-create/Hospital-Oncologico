import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext, DrugTableRow } from './types';
import { calculateBSA, drawOnLines, drawTextAt, drawMark, cleanDate } from './pdfHelpers';

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
      key: 'paciente_internado',
      label: 'Paciente Internado',
      type: 'select',
      defaultValue: 'NO',
      options: [{ label: 'NO', value: 'NO' }, { label: 'SI', value: 'SI' }],
      gridSpan: 3,
      group: '1. Esquema Terapéutico Solicitado'
    },
    {
      key: 'tratamiento_prolongado',
      label: 'Tratamiento Prolongado',
      type: 'select',
      defaultValue: 'SI',
      options: [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }],
      gridSpan: 3,
      group: '1. Esquema Terapéutico Solicitado'
    },
    // Datos del Paciente
    {
      key: 'nombre_apellido',
      label: 'Nombre y Apellido',
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
      key: 'nro_expediente',
      label: 'N° de Expediente (Opcional)',
      type: 'text',
      placeholder: 'Ej: 0425-...',
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
      type: 'select',
      options: [{ label: 'Femenino', value: 'Femenino' }, { label: 'Masculino', value: 'Masculino' }],
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'fecha_nacimiento',
      label: 'Fecha de Nacimiento',
      type: 'text',
      placeholder: 'DD/MM/AAAA',
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
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    {
      key: 'telefono_paciente',
      label: 'Teléfono Contacto Paciente',
      type: 'text',
      gridSpan: 3,
      group: '2. Filiación del Paciente'
    },
    // Antropometría y Dosis
    {
      key: 'diagnostico',
      label: 'Diagnóstico Oncológico',
      type: 'text',
      required: true,
      gridSpan: 8,
      group: '3. Parámetros Clínicos y Dosis'
    },
    {
      key: 'estadio',
      label: 'Estadío',
      type: 'text',
      placeholder: 'Ej: IV, IIIB, cT3 N1 M0...',
      required: true,
      gridSpan: 4,
      group: '3. Parámetros Clínicos y Dosis'
    },
    {
      key: 'peso',
      label: 'Peso (kg)',
      type: 'number',
      required: true,
      gridSpan: 3,
      group: '3. Parámetros Clínicos y Dosis'
    },
    {
      key: 'talla',
      label: 'Talla (cm)',
      type: 'number',
      required: true,
      gridSpan: 3,
      group: '3. Parámetros Clínicos y Dosis'
    },
    {
      key: 'superficie_corporal',
      label: 'Superficie Corporal (m²)',
      type: 'text',
      required: true,
      gridSpan: 3,
      group: '3. Parámetros Clínicos y Dosis',
      helperText: 'Cálculo por Mosteller.'
    },
    {
      key: 'dosis_m2',
      label: 'Dosis por m² / Dosis Plana',
      type: 'text',
      placeholder: 'Ej: 200 mg c/21d o 85 mg/m²',
      gridSpan: 3,
      group: '3. Parámetros Clínicos y Dosis'
    },
    {
      key: 'ciclo_solicitado',
      label: 'Ciclo Solicitado N°',
      type: 'text',
      defaultValue: '1',
      gridSpan: 6,
      group: '3. Parámetros Clínicos y Dosis'
    },
    {
      key: 'total_ciclos',
      label: 'Total de Ciclos Planeados',
      type: 'text',
      defaultValue: '6 ciclos',
      gridSpan: 6,
      group: '3. Parámetros Clínicos y Dosis'
    },
    // Reseña HC (Página 2)
    {
      key: 'antecedentes_clinicos',
      label: 'Antecedentes Clínicos y Comorbilidades',
      type: 'textarea',
      placeholder: 'Comorbilidades, factores de riesgo, ECOG...',
      rows: 3,
      gridSpan: 12,
      group: '4. Reseña de Historia Clínica (Página 2)'
    },
    {
      key: 'antecedentes_quirurgicos',
      label: 'Antecedentes Quirúrgicos',
      type: 'textarea',
      placeholder: 'Cirugías oncológicas y no oncológicas previas con fecha...',
      rows: 2,
      gridSpan: 12,
      group: '4. Reseña de Historia Clínica (Página 2)'
    },
    {
      key: 'tratamientos_previos',
      label: 'Tratamientos Previos y Fechas (QT, RT, Inmuno, Hormono)',
      type: 'textarea',
      placeholder: 'Líneas previas de quimioterapia, esquemas, fechas y respuesta...',
      rows: 3,
      gridSpan: 12,
      group: '4. Reseña de Historia Clínica (Página 2)'
    },
    {
      key: 'estudios_adjuntos',
      label: 'Estudios Adjuntos (AP, IHQ, Biopsia, Imágenes)',
      type: 'textarea',
      placeholder: 'Biopsia con fecha e IHQ (receptores, HER2, etc.) y estudios por imágenes...',
      rows: 3,
      gridSpan: 12,
      group: '4. Reseña de Historia Clínica (Página 2)'
    }
  ],

  extractData: async (context: AdminFormContext, initialValues?: Record<string, any>) => {
    const today = new Date().toLocaleDateString('es-AR');
    const p = context.patient || {};
    const doc = context.doctorData || {};

    const rawWeight = p.weight || '';
    const rawHeight = p.height || '';
    const bsa = calculateBSA(rawWeight, rawHeight);

    const baseData: Record<string, any> = {
      droga_principal: initialValues?.droga_principal || '',
      fecha_pedido: today,
      hospital: 'Hospital Oncológico Provincial',
      localidad_hosp: 'Córdoba',
      telefono_profesional: doc.cel_area && doc.cel_num ? `${doc.cel_area} ${doc.cel_num}` : '',
      paciente_internado: 'NO',
      tratamiento_prolongado: 'SI',
      nombre_apellido: p.name || '',
      nro_expediente: '',
      dni: p.dni || '',
      nro_hc: p.hcNumber || p.id || '',
      edad: p.age ? String(p.age) : '',
      sexo: p.gender || 'Femenino',
      fecha_nacimiento: p.birthDate || '',
      domicilio: '',
      localidad: 'Córdoba',
      telefono_paciente: '',
      diagnostico: p.diagnosis || '',
      estadio: p.stage || '',
      peso: rawWeight ? String(rawWeight) : '',
      talla: rawHeight ? String(rawHeight) : '',
      superficie_corporal: bsa,
      dosis_m2: '',
      ciclo_solicitado: '1',
      total_ciclos: '6 ciclos',
      antecedentes_clinicos: '',
      antecedentes_quirurgicos: '',
      tratamientos_previos: '',
      estudios_adjuntos: '',
      drogas_tabla: [] as DrugTableRow[]
    };

    if (!context.historyText && (!context.timeline || context.timeline.length === 0)) {
      return baseData;
    }

    try {
      const drugHint = initialValues?.droga_principal ? `FÁRMACO SOLICITADO POR EL MÉDICO: ${initialValues.droga_principal}.` : '';

      const prompt = `
Actúa como oncólogo médico del Hospital Oncológico Provincial de Córdoba. Hoy es ${today}.
Analizá la historia clínica y extraé los datos para completar la "FICHA DE SOLICITUD DE MEDICAMENTOS ONCOLÓGICOS".
${drugHint}

DATOS DEL PACIENTE:
- Nombre: ${baseData.nombre_apellido}
- DNI: ${baseData.dni}
- Diagnóstico: ${baseData.diagnostico}
- Peso: ${baseData.peso} kg, Talla: ${baseData.talla} cm

INSTRUCCIONES DE EXTRACCIÓN:
Devuelve ÚNICAMENTE un objeto JSON válido con los campos exactos:
{
  "droga_principal": "Nombre del fármaco o esquema oncológico principal (ej: Pembrolizumab, Carboplatino + Paclitaxel, Trastuzumab, etc.)",
  "diagnostico": "Diagnóstico oncológico con histología",
  "estadio": "Estadío clínico/TNM (ej: IV, IIIA, etc.)",
  "dosis_m2": "Dosis por m2 o dosis fija según el fármaco",
  "ciclo_solicitado": "1",
  "total_ciclos": "Cantidad de ciclos estimada (ej: 6 ciclos)",
  "drogas_tabla": [
    {
      "droga": "Nombre de la droga",
      "concentracion": "ej: 100 mg / 4 ml o 200 mg",
      "envase": "ej: F.A. o comp.",
      "dosisDiaria": "ej: 200 mg d1 o 80 mg/m2",
      "cantidadEnvases": "ej: 2 F.A.",
      "duracionTto": "ej: 21 días"
    }
  ],
  "antecedentes_clinicos": "Antecedentes patológicos relevantes, comorbilidades y ECOG.",
  "antecedentes_quirurgicos": "Cirugías previas relevantes con fechas.",
  "tratamientos_previos": "Tratamientos oncológicos previos recibidos con fechas de inicio/fin y esquema.",
  "estudios_adjuntos": "Resumen de biopsia/anatomía patológica, inmunohistoquímica (receptores, HER2, Ki-67) y estudios por imágenes."
}

HISTORIA CLÍNICA:
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
    drawTextAt(p1, cleanDate(data.fecha_pedido) || data.fecha_pedido || '', 145, 740, font, 8.5, textColor);
    drawTextAt(p1, data.hospital || 'Hospital Oncológico Provincial', 110, 716, fontBold, 8, textColor);
    drawTextAt(p1, data.localidad_hosp || 'Córdoba', 425, 716, fontBold, 8, textColor);
    drawTextAt(p1, data.telefono_profesional || '', 315, 693, fontBold, 8, textColor);

    // DATOS DEL PACIENTE
    drawTextAt(p1, (data.nombre_apellido || '').toUpperCase(), 165, 627, fontBold, 8.5, textColor);
    drawTextAt(p1, data.nro_expediente || '', 460, 627, fontBold, 8.5, textColor);

    drawTextAt(p1, data.dni || '', 115, 607, fontBold, 8.5, textColor);
    drawTextAt(p1, data.nro_hc || '', 285, 607, fontBold, 8.5, textColor);
    drawTextAt(p1, data.edad || '', 420, 607, font, 8.5, textColor);
    drawTextAt(p1, data.sexo || '', 495, 607, font, 8.5, textColor);

    drawTextAt(p1, data.domicilio || '', 125, 587, font, 8.5, textColor);
    drawTextAt(p1, data.localidad || 'Córdoba', 390, 587, font, 8.5, textColor);

    drawTextAt(p1, cleanDate(data.fecha_nacimiento) || data.fecha_nacimiento || '', 135, 567, font, 8.5, textColor);
    drawTextAt(p1, data.telefono_paciente || '', 350, 567, font, 8.5, textColor);

    // DATOS MÉDICOS
    const isInternado = data.paciente_internado === 'SI';
    if (isInternado) drawMark(p1, 232, 514, 10, fontBold, textColor);
    else drawMark(p1, 308, 514, 10, fontBold, textColor);

    drawTextAt(p1, data.diagnostico || '', 145, 488, fontBold, 8.5, textColor);
    drawTextAt(p1, data.estadio || '', 125, 461, fontBold, 8.5, textColor);

    // TABLA DE DROGAS
    const drugs: DrugTableRow[] = (data.drogas_tabla && data.drogas_tabla.length > 0) ? data.drogas_tabla : [
      { droga: data.droga_principal || '', concentracion: '', envase: 'F.A.', dosisDiaria: data.dosis_m2 || '', cantidadEnvases: '1', duracionTto: '21 días' }
    ];

    const rowYs = [370, 315, 260, 205];
    for (let i = 0; i < Math.min(drugs.length, 4); i++) {
      const d = drugs[i];
      const y = rowYs[i];
      drawTextAt(p1, d.droga || '', 64, y, fontBold, 7.5, textColor);
      drawTextAt(p1, d.concentracion || '', 205, y, font, 7.5, textColor);
      drawTextAt(p1, d.envase || '', 282, y, font, 7.5, textColor);
      drawTextAt(p1, d.dosisDiaria || '', 355, y, fontBold, 7.5, textColor);
      drawTextAt(p1, d.cantidadEnvases || '', 425, y, fontBold, 7.5, textColor);
      drawTextAt(p1, d.duracionTto || '', 492, y, font, 7.5, textColor);
    }

    // Tratamiento prolongado
    const isProlongado = data.tratamiento_prolongado === 'SI';
    if (isProlongado) drawMark(p1, 262, 139, 10, fontBold, textColor);
    else drawMark(p1, 344, 139, 10, fontBold, textColor);

    // Antropometría y Ciclos
    drawTextAt(p1, data.peso ? `${data.peso} kg` : '', 110, 113, font, 8.5, textColor);
    drawTextAt(p1, data.superficie_corporal ? `${data.superficie_corporal} m²` : '', 270, 113, fontBold, 8.5, textColor);
    drawTextAt(p1, data.total_ciclos || '', 465, 113, font, 8.5, textColor);

    drawTextAt(p1, data.talla ? `${data.talla} cm` : '', 110, 87, font, 8.5, textColor);
    drawTextAt(p1, data.dosis_m2 || '', 250, 87, font, 8.5, textColor);
    drawTextAt(p1, data.ciclo_solicitado || '1', 465, 87, fontBold, 8.5, textColor);

    // ─────────────────────────────────────────────────────────────
    // PÁGINA 2 (DORSO)
    // ─────────────────────────────────────────────────────────────
    // Antecedentes clínicos (9 líneas)
    drawOnLines(p2, data.antecedentes_clinicos, [
      { x: 185, y: 744, width: 350 },
      { x: 64,  y: 724, width: 476 },
      { x: 64,  y: 704, width: 476 },
      { x: 64,  y: 684, width: 476 },
      { x: 64,  y: 664, width: 476 },
      { x: 64,  y: 644, width: 476 },
      { x: 64,  y: 624, width: 476 },
      { x: 64,  y: 604, width: 476 },
      { x: 64,  y: 584, width: 476 },
    ], font, 8, textColor);

    // Antecedentes Quirúrgicos (5 líneas)
    drawOnLines(p2, data.antecedentes_quirurgicos, [
      { x: 205, y: 544, width: 330 },
      { x: 64,  y: 524, width: 476 },
      { x: 64,  y: 504, width: 476 },
      { x: 64,  y: 484, width: 476 },
      { x: 64,  y: 464, width: 476 },
    ], font, 8, textColor);

    // Tratamientos previos y fechas (7 líneas)
    drawOnLines(p2, data.tratamientos_previos, [
      { x: 350, y: 407, width: 185 },
      { x: 64,  y: 387, width: 476 },
      { x: 64,  y: 367, width: 476 },
      { x: 64,  y: 347, width: 476 },
      { x: 64,  y: 327, width: 476 },
      { x: 64,  y: 307, width: 476 },
      { x: 64,  y: 287, width: 476 },
    ], font, 8, textColor);

    // Estudios adjuntos (4 líneas)
    drawOnLines(p2, data.estudios_adjuntos, [
      { x: 64, y: 227, width: 476 },
      { x: 64, y: 207, width: 476 },
      { x: 64, y: 187, width: 476 },
      { x: 64, y: 167, width: 476 },
    ], font, 8, textColor);

    // Firmas al pie
    const docName = context.doctorData?.nombre || '';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    if (docName) {
      drawTextAt(p2, docName, 100, 50, fontBold, 7.5, textColor);
      if (docMat) drawTextAt(p2, docMat, 100, 40, font, 7, textColor);
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
    const filename = `Solicitud_Medicamentos_${(data.nombre_apellido || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha_pedido || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
