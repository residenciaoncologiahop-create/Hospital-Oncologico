import { callGemini, buildParts } from './aiProxy';

export interface EvolutionParams {
  patientBaselineContext: string;
  attachedFiles: { name: string; type: string; data: string }[];
  noNewStudies: boolean;
  actualidad: string;
  examenFisico: string;
  plan: string;
}

const EVOLUTION_SYSTEM_INSTRUCTION = `
Sos un asistente de documentación clínica médica en oncología de máxima rigurosidad y precisión.
Tu única tarea es redactar una NOTA DE EVOLUCIÓN MÉDICA para la Historia Clínica Digital (HCD).

REGLAS DE FORMATO Y ESTRUCTURA OBLIGATORIA:

1. PROHIBIDO NUMERAR LOS SUBTÍTULOS: No uses números (nada de "1.", "2.", "3.", etc.).
2. SIN TÍTULO DE RESUMEN AL INICIO: La evolución comienza DIRECTAMENTE con el texto de resumen e historia clínica (párrafo introductorio sin encabezado como "RESUMEN DE HISTORIA CLÍNICA").
3. ENCABEZADOS PERMITIDOS (en mayúsculas, sin números):
   - ESTUDIOS QUE TRAE
   - ACTUALIDAD DEL PACIENTE
   - EF
   - PLAN

4. FORMATO DE ESTUDIOS ADJUNTOS EN "ESTUDIOS QUE TRAE":
   - Cada estudio adjunto DEBE comenzar obligatoriamente con un guión (-), espacio ( ), nombre del estudio con fecha si está disponible, seguido de dos puntos (:) y el contenido literal correspondiente.
     Ejemplo:
     - 05/08/2026 Ecografía abdominal: Hígado de contornos regulares, tamaño y ecogenicidad normal, sin lesiones focales del parénquima...
     - 17/07/2026 Informe de tratamiento radioterapia: Ca de mama derecha. Técnica VMAT. Dosis total 40.05 Gy...
   - FORMATO ESTRICTO PARA LABORATORIOS: Cuando el estudio sea un laboratorio de análisis clínicos, DEBE informarse sintetizado y separado por barras oblicuas (/), exactamente como en este modelo:
     - [Fecha] Laboratorio: Hb [valor] / HTO [valor]% / GB [valor] / NS [valor]% / Plaq [valor] / Gluc [valor] / Creat [valor] / Uremia [valor] / GOT [valor] / GPT [valor] / FAL [valor] / GGT [valor] / BT [valor] (BD [valor] / BI [valor]) / [Marcadores tumorales u otros parámetros analizados]...
   - Si no trae estudios nuevos o no se adjuntó ninguno: Escribir exactamente "No presenta estudios nuevos." debajo de ESTUDIOS QUE TRAE.
   - PROHIBIDO modificar, parafrasear, interpretar o inventar resultados de los estudios adjuntos.

5. ACTUALIDAD DEL PACIENTE:
   - Situación clínica actual, síntomas y datos de la consulta referidos por el médico.

6. EF:
   - Examen físico del día. Consignar ÚNICAMENTE los hallazgos ingresados por el médico tratante. NO inventar ningún dato ni signos vitales.

7. PLAN:
   - Plan diagnóstico y terapéutico definido en la consulta según lo indicado por el profesional.

8. NO INVENTAR NINGUNA INFORMACIÓN.

ESQUEMA FINAL VISUAL:

[Párrafo introductorio directo con el resumen de historia clínica, diagnóstico, cirugías y tratamientos previos, SIN título]

ESTUDIOS QUE TRAE
- [Fecha] [Nombre del estudio]: [Contenido literal del informe]
- [Fecha] Laboratorio: Hb ... / HTO ...% / GB ... / NS ...% / Plaq ... / Gluc ... / Creat ... / Uremia ... / GOT ... / GPT ... / FAL ... / BT ... (BD ... / BI ...) / ...

ACTUALIDAD DEL PACIENTE
[Texto de actualidad de la consulta]

EF
[Hallazgos de examen físico]

PLAN
[Conducta y plan terapéutico]
`.trim();

export const generateClinicalEvolution = async (params: EvolutionParams): Promise<string> => {
  const {
    patientBaselineContext,
    attachedFiles,
    noNewStudies,
    actualidad,
    examenFisico,
    plan,
  } = params;

  const todayStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const promptContent = `
FECHA DE CONSULTA ACTUAL: ${todayStr}

=== ANTECEDENTES Y REGISTROS PREVIOS DE LA HISTORIA CLÍNICA (USAR PARA EL PÁRRAFO INICIAL SIN TÍTULO) ===
${patientBaselineContext || 'No hay antecedentes previos cargados en el sistema.'}

=== ESTUDIOS NUEVOS QUE TRAE A LA CONSULTA ===
${noNewStudies || attachedFiles.length === 0 
  ? 'INDICACIÓN MÉDICA: No presenta estudios nuevos.' 
  : `El médico adjuntó ${attachedFiles.length} archivo(s) con estudios/informes del paciente. Lee cada archivo, identifica el estudio y fecha, y transcríbelo con el formato requerido (- [Fecha] [Nombre de estudio]: [Contenido]). Si es un laboratorio, usa el formato sintético con barras (/): - [Fecha] Laboratorio: Hb ... / HTO ...% / GB ... / NS ...% / Plaq ... / Gluc ... / Creat ... / Uremia ... / GOT ... / GPT ... / FAL ... / BT ... (BD ... / BI ...) / ...`}

=== DATOS DE LA CONSULTA ACTUAL APORTADOS POR EL MÉDICO ===
- ACTUALIDAD DEL PACIENTE / SÍNTOMAS:
${actualidad.trim() ? actualidad.trim() : 'No se refieren síntomas agudos en la consulta actual.'}

- EF (EXAMEN FÍSICO DEL DÍA):
${examenFisico.trim() ? examenFisico.trim() : 'No se registran datos adicionales de examen físico.'}

- PLAN:
${plan.trim() ? plan.trim() : 'Continuar seguimiento según esquema pautado.'}

RECUERDA:
1. Comienza DIRECTAMENTE con el texto de resumen clínico, SIN encabezado "RESUMEN DE HISTORIA CLÍNICA" ni números.
2. Los siguientes encabezados NO llevan números: ESTUDIOS QUE TRAE, ACTUALIDAD DEL PACIENTE, EF, PLAN.
3. Para cada estudio usa el formato "- [Fecha] [Nombre]: [Contenido]" y para laboratorios el formato con "/".
4. No inventes ningún dato.
`.trim();

  const parts = buildParts(promptContent, noNewStudies ? [] : attachedFiles);

  const res = await callGemini({
    parts,
    systemInstruction: EVOLUTION_SYSTEM_INSTRUCTION,
  });

  return (res.text || '').trim();
};
