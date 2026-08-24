import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../../utils/aiProxy';
import { AdminFormDefinition, AdminFormContext, DrugTableRow } from './types';
import { calculateBSA, drawWrappedTextLines, drawCheckbox, tryEmbedHeaderLogo } from './pdfHelpers';

export const solicitudMedicamentosDefinition: AdminFormDefinition = {
  id: 'solicitud_medicamentos_onco',
  code: 'Ficha Med. Onco',
  name: 'Ficha de Solicitud de Medicamentos Oncológicos',
  shortName: 'Ficha Solicitud Medicamentos Oncológicos',
  institution: 'Hospital Oncológico Provincial / Ministerio de Salud de Córdoba',
  description: 'Solicitud institucional de fármacos oncológicos con tabla de drogas, dosis/m², ciclos y reseña de historia clínica (2 páginas).',
  category: 'Medicación y Farmacia',

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
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const marginX = 40;
    const contentWidth = 595.28 - marginX * 2;

    // ─────────────────────────────────────────────────────────────
    // PÁGINA 1
    // ─────────────────────────────────────────────────────────────
    const p1 = pdfDoc.addPage([595.28, 841.89]);
    let y1 = 841.89 - 30;

    // Logo
    y1 = await tryEmbedHeaderLogo(pdfDoc, p1, y1, 32);

    // Box Título
    p1.drawRectangle({
      x: marginX,
      y: y1 - 20,
      width: contentWidth,
      height: 22,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.8,
      color: rgb(0.96, 0.96, 0.96),
    });
    const titleText = 'FICHA DE SOLICITUD DE MEDICAMENTOS ONCOLÓGICOS';
    const tw = fontBold.widthOfTextAtSize(titleText, 10);
    p1.drawText(titleText, { x: marginX + (contentWidth - tw) / 2, y: y1 - 14, size: 10, font: fontBold });
    y1 -= 32;

    // Metadatos encabezado
    p1.drawText(`Fecha de pedido: ${data.fecha_pedido || '……/……/……'}`, { x: marginX, y: y1, size: 8.5, font });
    y1 -= 13;
    p1.drawText(`Hospital: ${data.hospital || ''}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`Localidad: ${data.localidad_hosp || 'Córdoba'}`, { x: marginX + 280, y: y1, size: 8.5, font });
    y1 -= 13;
    p1.drawText(`Nº de teléfono para comunicación exclusivamente profesional: ${data.telefono_profesional || ''}`, { x: marginX, y: y1, size: 8, font: fontBold });
    y1 -= 16;

    // SECCIÓN DATOS DEL PACIENTE
    const drawSectionHeader = (page: any, yPos: number, title: string) => {
      page.drawRectangle({
        x: marginX,
        y: yPos - 16,
        width: contentWidth,
        height: 18,
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.6,
        color: rgb(0.93, 0.93, 0.93),
      });
      page.drawText(title, { x: marginX + 6, y: yPos - 12, size: 8.5, font: fontBold, color: rgb(0, 0, 0) });
      return yPos - 22;
    };

    y1 = drawSectionHeader(p1, y1, 'DATOS DEL PACIENTE');
    y1 -= 4;

    p1.drawText(`Nombre y Apellido: ${data.nombre_apellido || ''}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`Nº de exp. : ${data.nro_expediente || '………………'}`, { x: marginX + 320, y: y1, size: 8.5, font });
    y1 -= 13;

    p1.drawText(`D.N.I.: ${data.dni || ''}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`N° de H.C.: ${data.nro_hc || ''}`, { x: marginX + 160, y: y1, size: 8.5, font });
    p1.drawText(`Edad: ${data.edad || ''}`, { x: marginX + 320, y: y1, size: 8.5, font });
    p1.drawText(`Sexo: ${data.sexo || ''}`, { x: marginX + 410, y: y1, size: 8.5, font });
    y1 -= 13;

    p1.drawText(`Domicilio: ${data.domicilio || ''}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`Localidad: ${data.localidad || 'Córdoba'}`, { x: marginX + 320, y: y1, size: 8.5, font });
    y1 -= 13;

    p1.drawText(`F. Nacim: ${data.fecha_nacimiento || '……/……/……'}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`T.E.: ${data.telefono_paciente || ''}`, { x: marginX + 320, y: y1, size: 8.5, font });
    y1 -= 18;

    // SECCIÓN DATOS MÉDICOS
    y1 = drawSectionHeader(p1, y1, 'DATOS MÉDICOS');
    y1 -= 4;

    const isInternado = data.paciente_internado === 'SI';
    p1.drawText('Paciente internado', { x: marginX, y: y1, size: 8.5, font });
    drawCheckbox(p1, marginX + 130, y1 - 2, 9, isInternado, 'SI', font, 8);
    drawCheckbox(p1, marginX + 190, y1 - 2, 9, !isInternado, 'NO', font, 8);
    y1 -= 14;

    p1.drawText(`Diagnóstico: ${data.diagnostico || ''}`, { x: marginX, y: y1, size: 8.5, font: fontBold });
    y1 -= 13;
    p1.drawText(`Estadío: ${data.estadio || ''}`, { x: marginX, y: y1, size: 8.5, font: fontBold });
    y1 -= 18;

    // TABLA DE DROGAS
    const tableCols = [
      { header: 'Nombre de las drogas', width: 150 },
      { header: 'Concentración\n(gr, Mg, UI)', width: 80 },
      { header: 'Contenido env.\n(ml, comp)', width: 75 },
      { header: 'Dosis\ndiaria', width: 65 },
      { header: 'Cant. envases\n(caja, frasco)', width: 75 },
      { header: 'Duración\ndel tto.', width: 70 },
    ];

    // Header de la tabla
    const thHeight = 22;
    p1.drawRectangle({
      x: marginX,
      y: y1 - thHeight,
      width: contentWidth,
      height: thHeight,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.6,
      color: rgb(0.95, 0.95, 0.95),
    });

    let colX = marginX;
    tableCols.forEach(col => {
      p1.drawText(col.header.split('\n')[0], { x: colX + 4, y: y1 - 10, size: 7, font: fontBold });
      if (col.header.includes('\n')) {
        p1.drawText(col.header.split('\n')[1], { x: colX + 4, y: y1 - 18, size: 6.5, font });
      }
      p1.drawLine({ start: { x: colX, y: y1 }, end: { x: colX, y: y1 - thHeight }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
      colX += col.width;
    });
    y1 -= thHeight;

    // Filas de la tabla (5 filas)
    const drugs: DrugTableRow[] = (data.drogas_tabla && data.drogas_tabla.length > 0) ? data.drogas_tabla : [
      { droga: data.droga_principal || '', concentracion: '', envase: 'F.A.', dosisDiaria: data.dosis_m2 || '', cantidadEnvases: '1', duracionTto: '21 días' }
    ];

    const rowHeight = 20;
    for (let r = 0; r < 5; r++) {
      const drug = drugs[r] || { droga: '', concentracion: '', envase: '', dosisDiaria: '', cantidadEnvases: '', duracionTto: '' };
      p1.drawRectangle({
        x: marginX,
        y: y1 - rowHeight,
        width: contentWidth,
        height: rowHeight,
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.5,
        color: r % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.98)
      });

      let rx = marginX;
      p1.drawText(drug.droga || '', { x: rx + 4, y: y1 - 13, size: 7.5, font: fontBold });
      rx += tableCols[0].width;
      p1.drawLine({ start: { x: rx, y: y1 }, end: { x: rx, y: y1 - rowHeight }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      p1.drawText(drug.concentracion || '', { x: rx + 4, y: y1 - 13, size: 7.5, font });
      rx += tableCols[1].width;
      p1.drawLine({ start: { x: rx, y: y1 }, end: { x: rx, y: y1 - rowHeight }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      p1.drawText(drug.envase || '', { x: rx + 4, y: y1 - 13, size: 7.5, font });
      rx += tableCols[2].width;
      p1.drawLine({ start: { x: rx, y: y1 }, end: { x: rx, y: y1 - rowHeight }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      p1.drawText(drug.dosisDiaria || '', { x: rx + 4, y: y1 - 13, size: 7.5, font });
      rx += tableCols[3].width;
      p1.drawLine({ start: { x: rx, y: y1 }, end: { x: rx, y: y1 - rowHeight }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      p1.drawText(drug.cantidadEnvases || '', { x: rx + 4, y: y1 - 13, size: 7.5, font });
      rx += tableCols[4].width;
      p1.drawLine({ start: { x: rx, y: y1 }, end: { x: rx, y: y1 - rowHeight }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      p1.drawText(drug.duracionTto || '', { x: rx + 4, y: y1 - 13, size: 7.5, font });

      y1 -= rowHeight;
    }

    y1 -= 14;

    // Tratamiento prolongado
    const isProlongado = data.tratamiento_prolongado === 'SI';
    p1.drawText('Tratamiento prolongado:', { x: marginX, y: y1, size: 8.5, font });
    drawCheckbox(p1, marginX + 150, y1 - 2, 9, isProlongado, 'SI', font, 8);
    drawCheckbox(p1, marginX + 220, y1 - 2, 9, !isProlongado, 'NO', font, 8);
    y1 -= 16;

    // Datos Antropométricos y Ciclos
    p1.drawText(`Peso: ${data.peso ? `${data.peso} kg` : ''}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`Superficie corporal: ${data.superficie_corporal ? `${data.superficie_corporal} m²` : ''}`, { x: marginX + 140, y: y1, size: 8.5, font: fontBold });
    p1.drawText(`Total de ciclos de tto: ${data.total_ciclos || ''}`, { x: marginX + 320, y: y1, size: 8.5, font });
    y1 -= 14;

    p1.drawText(`Talla: ${data.talla ? `${data.talla} cm` : ''}`, { x: marginX, y: y1, size: 8.5, font });
    p1.drawText(`Dosis por M2 : ${data.dosis_m2 || ''}`, { x: marginX + 140, y: y1, size: 8.5, font });
    p1.drawText(`Ciclo solicitado Nº: ${data.ciclo_solicitado || '1'}`, { x: marginX + 320, y: y1, size: 8.5, font: fontBold });

    // Footer Página 1
    p1.drawText('(VER AL DORSO) ⇒', { x: 595.28 - marginX - 100, y: 40, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

    // ─────────────────────────────────────────────────────────────
    // PÁGINA 2 (DORSO)
    // ─────────────────────────────────────────────────────────────
    const p2 = pdfDoc.addPage([595.28, 841.89]);
    let y2 = 841.89 - 40;

    // Header Dorso
    y2 = drawSectionHeader(p2, y2, 'RESEÑA DE H.C.');
    y2 -= 6;

    // Función de sección en dorso con recuadro
    const drawBackSection = (titleLabel: string, content: string, linesCount: number) => {
      p2.drawText(titleLabel, { x: marginX, y: y2, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y2 -= 11;
      const bHeight = linesCount * 12 + 6;
      p2.drawRectangle({
        x: marginX,
        y: y2 - bHeight + 8,
        width: contentWidth,
        height: bHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
        color: rgb(0.99, 0.99, 0.99),
      });

      drawWrappedTextLines(p2, content || '', marginX + 5, y2 + 2, contentWidth - 10, linesCount, 12, 8, font);
      y2 -= (bHeight + 10);
    };

    // 1. Antecedentes clínicos (9 líneas)
    drawBackSection('Antecedentes clínicos:', data.antecedentes_clinicos, 8);

    // 2. Antecedentes Quirúrgicos (5 líneas)
    drawBackSection('Antecedentes Quirúrgicos:', data.antecedentes_quirurgicos, 4);

    // 3. Tratamientos previos y fechas (7 líneas)
    drawBackSection(
      'Detallar tratamientos previos y fechas de los mismos (Oncológicos, radioterapia; quimioterapia, inmunoterapia, hormonoterapia, etc) :',
      data.tratamientos_previos,
      6
    );

    // 4. Estudios solicitados / adjuntos (4 líneas)
    drawBackSection(
      'Se solicita que se adjunte original o copia de los siguientes estudios:\nAnatomía patológica, Inmuno histoquímica, Inmuno fenotipos o similares; y estudios por imágenes inherentes a estatificación. En el caso puntual del L.N.H. biopsia medular ósea.',
      data.estudios_adjuntos,
      4
    );

    // Firmas al pie página 2
    y2 = 60;
    const docName = context.doctorData?.nombre || 'Médico Especialista';
    const docMat = context.doctorData?.matricula ? `M.P. ${context.doctorData.matricula}` : '';
    const sigColWidth = contentWidth / 3;

    const drawSigLineP2 = (colIdx: number, titleSig: string, extra = '') => {
      const sx = marginX + colIdx * sigColWidth;
      p2.drawLine({
        start: { x: sx + 10, y: y2 + 15 },
        end: { x: sx + sigColWidth - 15, y: y2 + 15 },
        thickness: 0.6,
        color: rgb(0.4, 0.4, 0.4)
      });
      p2.drawText(titleSig, { x: sx + 15, y: y2 + 4, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      if (extra) {
        p2.drawText(extra, { x: sx + 15, y: y2 - 5, size: 6.5, font, color: rgb(0.4, 0.4, 0.4) });
      }
    };

    drawSigLineP2(0, docName, docMat || 'Firma y Sello Médico Especialista');
    drawSigLineP2(1, 'Jefe de Servicio', 'Firma y Sello');
    drawSigLineP2(2, 'Director del Hosp.', 'Hospital Oncológico');

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `Solicitud_Medicamentos_${(data.nombre_apellido || 'Paciente').replace(/\s+/g, '_')}_${(data.fecha_pedido || '').replace(/\//g, '-')}.pdf`;

    return { blob, filename };
  }
};
