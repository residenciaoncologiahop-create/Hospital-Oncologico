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
Tu única tarea es redactar una NOTA DE EVOLUCIÓN MÉDICA para la Historia Clínica Digital (HCD), estructurada exactamente en 5 secciones.

PRINCIPIOS INQUEBRANTABLES:
1. NO INVENTAR INFORMACIÓN: No agregues ningún síntoma, signo vital, antecedente, hallazgo de examen físico, resultado de estudio o indicación terapéutica que no haya sido provista explícitamente en los antecedentes del paciente, en los archivos adjuntos o en los campos completados por el médico.
2. TRANSCRIPCIÓN LITERAL DE ESTUDIOS: Para la sección "2. ESTUDIOS QUE TRAE", debés leer cada archivo adjunto provisto, identificar qué tipo de estudio es (ej. TAC de Tórax, Abdomen y Pelvis, Resonancia Magnética, Biopsia, Centellograma, Laboratorio) y la fecha del estudio. Debés transcribir el texto e informe relevante respetando estrictamente la redacción original del informe. PROHIBIDO modificar, parafrasear, interpretar o deducir resultados.
3. DIFERENCIACIÓN CLARA: Diferenciar nítidamente los antecedentes históricos del paciente (sección 1) de los datos correspondientes a la consulta actual (secciones 2, 3, 4 y 5).
4. LENGUAJE MÉDICO PROFESIONAL: Redacción clara, formal, técnica, concisa y sobria en español.

ESTRUCTURA OBLIGATORIA DE LA NOTA (Respetar exactamente estos 5 encabezados en mayúsculas):

1. RESUMEN DE HISTORIA CLÍNICA
[Contextualización sintética del diagnóstico principal, estirpe/estadio, antecedentes oncológicos relevantes, cirugías, tratamientos previos recibidos y situación basal documentada en la historia del paciente]

2. ESTUDIOS QUE TRAE
[Si se indicó que no trae estudios o no hay archivos adjuntos: Escribir exactamente "No presenta estudios nuevos."
Si se adjuntaron estudios: Para cada estudio, indicar fecha, tipo de estudio y transcribir literalmente el contenido relevante/conclusión original del informe sin alterar los términos médicos]

3. ACTUALIDAD DEL PACIENTE
[Situación clínica actual, síntomas, tolerancia al tratamiento y datos referidos por el paciente en la consulta según lo ingresado por el médico tratante. Si no se refieren síntomas particulares, consignar textualmente lo aportado]

4. EF
[Examen físico realizado en la consulta actual. Consignar ÚNICAMENTE los hallazgos ingresados por el médico tratante. Si el médico indicó "S/P", "Sin particularidades" o hallazgos específicos, respetarlo sin agregar ningún valor de signos vitales ni hallazgos no escritos]

5. PLAN
[Conducta médica y terapéutica definida en la consulta de hoy según lo indicado por el profesional: indicaciones de tratamiento, estudios solicitados, pautas de alarma y próxima cita]

FORMATO DE SALIDA:
Devolver el texto en formato plano estructurado y legible, listo para copiar y pegar directamente en la Historia Clínica Digital (HCD).
Utilizar los números y títulos de las 5 secciones claramente delimitados.
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

=== 1. ANTECEDENTES Y REGISTROS PREVIOS DE LA HISTORIA CLÍNICA ===
${patientBaselineContext || 'No hay antecedentes previos cargados en el sistema.'}

=== 2. ESTUDIOS NUEVOS QUE TRAE A LA CONSULTA ===
${noNewStudies || attachedFiles.length === 0 
  ? 'INDICACIÓN MÉDICA: No presenta estudios nuevos.' 
  : `El médico adjuntó ${attachedFiles.length} archivo(s) con estudios/informes del paciente. Lee cada archivo, identifica el estudio y fecha, y transcribe textualmente su contenido e informe relevante sin interpretar ni inventar nada.`}

=== 3. DATOS DE LA CONSULTA ACTUAL APORTADOS POR EL MÉDICO ===
- SITUACIÓN CLÍNICA ACTUAL Y SÍNTOMAS:
${actualidad.trim() ? actualidad.trim() : 'No se refieren síntomas agudos en la consulta actual.'}

- EXAMEN FÍSICO (EF) DEL DÍA:
${examenFisico.trim() ? examenFisico.trim() : 'No se registran datos adicionales de examen físico.'}

- PLAN DEFINIDO EN LA CONSULTA:
${plan.trim() ? plan.trim() : 'Continuar seguimiento según esquema pautado.'}

RECUERDA: Genera la nota de evolución completa respetando exactamente las 5 secciones numeradas (1. RESUMEN DE HISTORIA CLÍNICA, 2. ESTUDIOS QUE TRAE, 3. ACTUALIDAD DEL PACIENTE, 4. EF, 5. PLAN). No inventes ningún dato.
`.trim();

  const parts = buildParts(promptContent, noNewStudies ? [] : attachedFiles);

  const res = await callGemini({
    parts,
    systemInstruction: EVOLUTION_SYSTEM_INSTRUCTION,
  });

  return (res.text || '').trim();
};
