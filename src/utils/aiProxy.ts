/**
 * aiProxy.ts
 * 
 * REEMPLAZA todas las llamadas directas al SDK de Gemini (@google/genai)
 * por llamadas a la Cloud Function segura en el backend.
 * 
 * La API key de Gemini nunca sale del servidor.
 * Todas las llamadas requieren autenticación Firebase activa.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../lib/firebase";

// Tipos
interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface CallGeminiParams {
  prompt?: string;
  parts?: GeminiPart[];
  systemInstruction?: string;
  responseMimeType?: string;
}

interface CallGeminiResult {
  text: string;
}

// ──────────────────────────────────────────────
// CONSTANTES DE TIMEOUT
// ──────────────────────────────────────────────
// La Cloud Function tiene timeoutSeconds: 300 (5 min).
// El cliente espera 270s (4.5 min) para detectar timeout
// antes de que Firebase corte, y mostrar un mensaje claro.
const CLIENT_TIMEOUT_MS = 270_000; // 4.5 minutos

// Mensajes de error clínicamente seguros (sin jerga técnica)
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  timeout:           "El análisis tardó demasiado. Intentá con un documento más corto o reintentá en un momento.",
  "resource-exhausted": "Límite de uso alcanzado. Esperá un momento antes de continuar.",
  unauthenticated:   "Sesión expirada. Recargá la página e iniciá sesión nuevamente.",
  "invalid-argument":"El contenido enviado no pudo procesarse. Verificá el archivo e intentá nuevamente.",
  default:           "No se pudo completar el análisis. El resultado anterior sigue siendo válido. Reintentá en un momento.",
};

function getSafeMessage(error: any): string {
  // Timeout de Firebase o del AbortController
  if (error?.name === "AbortError" || error?.code === "functions/deadline-exceeded")
    return SAFE_ERROR_MESSAGES.timeout;
  // Códigos de error de Firebase Functions
  const code = error?.code?.replace("functions/", "") as string;
  return SAFE_ERROR_MESSAGES[code] ?? SAFE_ERROR_MESSAGES.default;
}

// ──────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────
export const callGemini = async (params: CallGeminiParams): Promise<CallGeminiResult> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error(SAFE_ERROR_MESSAGES.unauthenticated);
  }

  const functions = getFunctions();
  const callGeminiFn = httpsCallable<CallGeminiParams, CallGeminiResult>(
    functions,
    "callGemini",
    { timeout: CLIENT_TIMEOUT_MS }
  );

  // AbortController para detectar timeout antes de Firebase
  try {
  const result = await callGeminiFn(params);
  return result.data;
} catch (error: any) {
  throw new Error(getSafeMessage(error));
}
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }

export const buildParts = (text: string | undefined, files: FileData[]): GeminiPart[] => {
  const parts: GeminiPart[] = [];
  if (text) parts.push({ text });
  files.slice(0, 5).forEach(f => {
    if (f.data && f.type) {
      parts.push({ inlineData: { mimeType: f.type, data: f.data } });
    }
  });
  return parts;
};

// ── Instrucción de Sistema de Alta Precisión Clínica para Chat ──────────────────
export const CLINICAL_CHAT_SYSTEM_INSTRUCTION = `
Eres un asistente clínico y oncólogo consultor de máxima precisión, prudencia y confiabilidad.
Tu objetivo primordial es la PRECISIÓN Y RIGOR CLÍNICO sobre la completitud:
- Es preferible una respuesta incompleta pero exacta antes que una completa pero basada en datos no sustentados.
- Di con total honestidad y claridad cuando algo "No está documentado", "Esto es una inferencia", "Existe una contradicción", o "No puedo determinarlo con la información disponible".

1. REGLA FUNDAMENTAL - NO INVENTAR INFORMACIÓN:
- Distingue rigurosamente entre hechos documentados en la historia, inferencias clínicas e hipótesis que requieren confirmación.
- NUNCA presentes una inferencia o hipótesis como si fuera un hecho documentado.
- ❌ PROHIBIDO escribir etiquetas o prefijos meta en tu respuesta (NUNCA escribas "[Dato Documentado]:", "[Dato Estructurado]:", "[Inferencia]:", "[Hipótesis]:" ni similares). Redacta en prosa médica profesional, fluida y natural.
- Si un dato no figura en la historia, indica claramente: "No está documentado en la información disponible."

2. JERARQUÍA ESTRICTA DE EVIDENCIA:
1° Información explícita de la historia clínica.
2° Información estructurada y normalizada.
3° Información de documentos o estudios adjuntados.
4° Inferencia clínica razonable.
5° Conocimiento médico general.
La información de mayor nivel tiene prioridad absoluta. NUNCA contradigas un dato explícito basándote únicamente en inferencias o conocimiento general.

3. COMPRENSIÓN Y CONTROL DE LA PREGUNTA:
- Identifica qué pregunta exactamente el usuario (paciente, periodo temporal, hecho documentado vs interpretación vs recomendación, qué ocurrió vs qué debería hacerse).
- No asumas la intención si la pregunta es ambigua (ej. "¿Está progresando?": puede ser radiológica, clínica, bioquímica o RECIST). Si no está claro, aclara: "Si te referís a progresión radiológica, ..." o solicita aclaración.
- Si la pregunta contiene una premisa incorrecta (ej. "¿Por qué progresó tras la cirugía?" cuando no hay progresión), corrige la premisa con respeto: "En la información disponible no se documenta progresión posterior a la cirugía...".

4. CONTROL DE DATOS FALTANTES, FECHAS, ESTUDIOS Y PACIENTES:
- No completar datos faltantes: Si no se especifica esquema/ciclos/motivo de suspensión: "No se especifica el esquema de quimioterapia en la información disponible."
- Fechas críticas: Nunca inventar fechas ni desplazar eventos. Distinguir fecha del estudio vs fecha del informe vs fecha de consulta vs fecha de carga.
- No confundir estudios: Distinguir modalidad, fecha, región anatómica e institución (ej. TC tórax ≠ PET/TC de la misma fecha).
- Paciente actual: Utilizar EXCLUSIVAMENTE la información del paciente actual.
- No corregir la historia con conocimiento general: Si hay un dato inusual (ej. PD-L1 80%), consígnalo como "El documento registra PD-L1 80%" y señala si existe una inconsistencia a verificar en el original.
- Contradicciones: Si existen datos contradictorios entre fuentes o fechas, muestra la discrepancia sin elegir una arbitrariamente.
- Ausencia de información ≠ Ausencia de enfermedad: Si no se mencionan metástasis, di "No se documentan metástasis óseas en la información disponible" (NUNCA digas "No tiene metástasis").
- No sobreinterpretar lenguaje radiológico: "leve aumento" ≠ "progresión", "sospechoso" ≠ "metástasis confirmada", "indeterminado" ≠ "nueva metástasis".
- RECIST / iRECIST: No afirmes progresión RECIST sin cumplir todos los criterios de evaluación integral. No uses iRECIST si no hay evidencia de inmunoterapia previa.
- Tratamiento y seguimiento: Para motivos de suspensión, busca causas documentadas. Para seguimiento, usa estadio, guías y tiempos documentados; si falta información, explicita qué dato falta.
- Fuentes adjuntas: Distingue la información del documento adjunto del conocimiento médico general.

5. ESTRUCTURA Y LENGUAJE DE RESPUESTA:
- Responder primero, explicar después: Comienza con una conclusión breve y directa.
- Graduar el nivel de certeza:
  * Alta certeza: "Está documentado que...", "El informe describe..."
  * Certeza moderada: "Esto sugiere...", "Es compatible con..."
  * Incertidumbre: "No puede determinarse con la información disponible", "No está documentado."
- Formato recomendado cuando sea pertinente en preguntas clínicas:
  ### Respuesta
  [Conclusión directa y concreta]
  ### Evidencia
  [Hechos y datos objetivos de la historia/informes que la sustentan redactados de forma natural]
  ### Interpretación
  [Análisis clínico derivado, explicitando si es una inferencia]
  ### Incertidumbre / Datos faltantes
  [Si faltan datos necesarios para mayor precisión]
(Si la pregunta es simple o puntual, responde de forma concisa y directa sin forzar todas las secciones).

6. PRIVACIDAD:
NUNCA menciones nombres de personas reales, DNI o datos de contacto.
`.trim();

// ── Chat con contexto ──────────────────────────
export const getChatResponseSecure = async (
  msgs: ChatMessage[],
  newMsg: string,
  context: string,
  files: FileData[]
): Promise<string> => {
  const historyText = msgs.slice(-6).map(m => `${m.role === 'user' ? 'MÉDICO' : 'ASISTENTE'}: ${m.text}`).join('\n\n');
  const contextBlock = `[INFORMACIÓN CLÍNICA DEL PACIENTE ACTUAL]\n${context}\n\n[HISTORIAL DE DISCUSIÓN CLÍNICA RECIENTE]\n${historyText}`;

  const parts = buildParts(contextBlock, files.slice(0, 3));
  parts.push({ text: `CONSULTA DEL MÉDICO:\n${newMsg}` });

  const res = await callGemini({
    parts,
    systemInstruction: CLINICAL_CHAT_SYSTEM_INSTRUCTION,
  });
  const text = res.text || '';
  return text.replace(/\[(?:Dato Documentado|Dato Estructurado|Dato no estructurado|Inferencia|Hipótesis|Dato Clínico)\]:\s*/gi, '');
};

// ── Extracción de Timeline ─────────────────────
export const extractTimelineSecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
    Eres un asistente médico experto en oncología. Analiza la documentación y extrae la cronología clínica del paciente.

    REGLAS ESTRICTAS DE NO DUPLICACIÓN:
    1. ❌ NUNCA generes eventos duplicados para la misma fecha ni repitas la misma consulta, cirugía, estudio o tratamiento.
    2. Si en la misma fecha ocurren varios sucesos o hay múltiples menciones del mismo evento, agrupa la información en UN SOLO evento en la línea de tiempo.

    IDIOMA OBLIGATORIO: Todo en español. Si el documento está en inglés, traduce el contenido.

    REGLA DE PRIVACIDAD: NO incluyas DNI, nombres reales ni datos personales.

    Fechas: formato DD/MM/YYYY.

    Categorías permitidas (usar exactamente estas palabras): Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución.

    CRITERIO DE HITOS ONCOLÓGICOS CLAVE (isKey):
    - isKey = true EXCLUSIVAMENTE para HITOS ONCOLÓGICOS DETERMINANTES:
      • Diagnóstico patológico / biopsia inicial con inmunohistoquímica (RE, RP, HER2, Ki67, etc.) y marcadores moleculares (EGFR, KRAS, BRAF, BRCA, PD-L1).
      • Estadificación TNM y Estadio clínico.
      • Cirugías mayores u oncológicas (tipo de resección, márgenes, ganglios examinados/comprometidos).
      • Inicio, cambio de esquema o finalización de tratamientos sistémicos (Quimioterapia, Inmunoterapia, Terapia Dirigida, Hormonoterapia), especificando fármacos, dosis y número de ciclos.
      • Radioterapia (sitio, dosis en Gy, fracciones).
      • Progresión de enfermedad, recidiva, o respuesta objetiva (RC, RP, EE, PE).
      • Toxicidades severas (Grado ≥ 3) o desenlaces críticos.
    - isKey = false para: Controles de rutina estables, laboratorios generales normales, consultas de seguimiento sin cambios terapéuticos o trámites administrativos.

    NIVEL DE DETALLE EN "note" Y "detail":
    - HITOS CLAVE (isKey = true): "note" DEBE SER MUY DETALLADO, EXHAUSTIVO Y RIGUROSO (incluir fechas exactas, esquema de tratamiento, dosis, estadios, resultados histológicos completos y conducta). Si la información es extensa, incluir extractos extendidos en el campo "detail".
    - EVENTOS SECUNDARIOS (isKey = false): "note" DEBE SER MUY CONCISO (1 sola frase breve, máx 80-100 caracteres). NO recargar la línea de tiempo con detalles secundarios irrelevantes.

    ESTRUCTURA JSON REQUERIDA — devolver ÚNICAMENTE el array:
    [
      {
        "date": "DD/MM/YYYY",
        "professional": "especialidad o nombre del profesional en español",
        "category": "una de las categorías permitidas",
        "note": "resumen del evento según nivel de detalle indicado",
        "isKey": true o false,
        "detail": "información extendida opcional, solo para eventos clave"
      }
    ]
  `;


  const parts = buildParts(instructionText, []);
  if (text) parts.push({ text: `Notas clínicas anónimas: ${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start !== -1 && end !== -1) return JSON.parse(clean.substring(start, end + 1));
    return JSON.parse(clean);
  } catch {
    return [];
  }
};

// ── Normalización de Parámetros de Laboratorio ─────────────────
export const normalizeLabTestName = (rawName: string): string => {
  if (!rawName) return '';
  const name = rawName.trim();
  const lower = name.toLowerCase();

  // Hemograma
  if (/^(hb|hgb|hemog|hemo|hg)$/i.test(lower) || lower.includes('hemoglobina')) return 'Hemoglobina';
  if (/^(hto|hct)$/i.test(lower) || lower.includes('hematocrito')) return 'Hematocrito';
  if (/^(gb|g\.b\.|wbc|blancos)$/i.test(lower) || lower.includes('leucocito') || lower.includes('glóbulos blancos')) return 'Leucocitos';
  if (/^(plaq|plt|platelets)$/i.test(lower) || lower.includes('plaqueta')) return 'Plaquetas';
  if (/^(neut|neu|anc|pmn|segmentados)$/i.test(lower) || lower.includes('neutrófilo')) return 'Neutrófilos';

  // Función renal
  if (/^(cr|crea|creat)$/i.test(lower) || lower.includes('creatinina')) return 'Creatinina';
  if (/^(bun|azoemia)$/i.test(lower) || lower.includes('urea')) return 'Urea';

  // Función hepática
  if (/^(bt|bil t|bil total)$/i.test(lower) || lower.includes('bilirrubina total')) return 'Bilirrubina total';
  if (lower.includes('bilirrubina directa')) return 'Bilirrubina directa';
  if (lower.includes('bilirrubina indirecta')) return 'Bilirrubina indirecta';
  if (/^(got|ast)$/i.test(lower)) return 'GOT';
  if (/^(gpt|alt)$/i.test(lower)) return 'GPT';
  if (/^(fal|alp)$/i.test(lower) || lower.includes('fosfatasa alcalina')) return 'FAL';
  if (/^(ggt)$/i.test(lower)) return 'GGT';
  if (lower.includes('albúmina') || lower.includes('albumina')) return 'Albúmina';

  // Electrolitos
  if (/^(na|sodio)$/i.test(lower)) return 'Sodio';
  if (/^(k|potasio)$/i.test(lower)) return 'Potasio';
  if (/^(ca|calcio)$/i.test(lower)) return 'Calcio';
  if (/^(mg|magnesio)$/i.test(lower)) return 'Magnesio';

  // Coagulación
  if (/^(inr)$/i.test(lower)) return 'INR';
  if (/^(ttpa|kptt)$/i.test(lower)) return 'TTPA';
  if (lower.includes('fibrinógeno') || lower.includes('fibrinogeno')) return 'Fibrinógeno';

  // Marcadores tumorales
  if (/^(cea)$/i.test(lower) || lower.includes('antígeno carcinoembrionario')) return 'CEA';
  if (/^(ca 19-9|ca19-9|ca 19.9)$/i.test(lower)) return 'CA 19-9';
  if (/^(ca 125|ca125)$/i.test(lower)) return 'CA 125';
  if (/^(ca 15-3|ca15-3|ca 15.3)$/i.test(lower)) return 'CA 15-3';
  if (/^(psa)$/i.test(lower)) return 'PSA';
  if (/^(afp)$/i.test(lower) || lower.includes('alfafetoproteína')) return 'AFP';
  if (/^(beta-hcg|b-hcg|bhcg|β-hcg)$/i.test(lower)) return 'β-HCG';
  if (lower.includes('calcitonina')) return 'Calcitonina';
  if (lower.includes('tireoglobulina')) return 'Tireoglobulina';

  return name;
};

// ── Extracción de Laboratorios ─────────────────
export const extractLabsSecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
    Eres un oncólogo y bioquímico clínico experto. Analiza la historia clínica y extrae los resultados de laboratorio clínico.

    REGLA 0: NORMALIZACIÓN INTELIGENTE DE PARÁMETROS:
    Antes de extraer, interpreta los nombres de los parámetros utilizando razonamiento clínico.
    Identifica qué analito representa cada término y normalízalo a su nombre estándar único en español:
    - Hb, hb, HB, HGB, Hgb, Hemog, Hemo, Hg -> "Hemoglobina"
    - Hto, HTO, Hct, HCT, Hematocrito -> "Hematocrito"
    - GB, G.B., WBC, Blancos, Leucocitos, Glóbulos blancos -> "Leucocitos"
    - Plaq, Plaquetas, PLT, Platelets -> "Plaquetas"
    - Neut, Neu, ANC, PMN, Segmentados, Neutrófilos -> "Neutrófilos"
    - Cr, CREA, Creat, Creatinina -> "Creatinina"
    - Urea, BUN, Azoemia -> "Urea"
    - BT, Bil T, Bil Total, Bilirrubina Total -> "Bilirrubina total"
    - GOT, GPT, FAL, GGT, Albúmina, Sodio, Potasio, Calcio, Magnesio, PCR, VSG, INR, TTPA, Fibrinógeno, CEA, CA 19-9, CA 125, CA 15-3, PSA, AFP, β-HCG, Calcitonina, Tireoglobulina.

    REGLA 1: EXTRAER ÚNICAMENTE LABORATORIO CLÍNICO (parámetros bioquímicos, hematológicos, microbiológicos o marcadores tumorales).

    REGLA 2: EXCLUSIONES ESTRICTAS — ❌ NUNCA INCLUIR EN LABORATORIO:
    - SUV, SUVmax, SUVpeak, MTV, TLG, RECIST, TNM, cTNM, pTNM.
    - Biomarcadores moleculares e inmunohistoquímica: PD-L1, TPS, CPS, TMB, MSI, dMMR, HER2, EGFR, KRAS, NRAS, BRAF, ALK, ROS1, MET, RET, FGFR, NTRK, ESR1, BRCA, PIK3CA, Ki67.
    - Porcentajes de expresión de inmunohistoquímica, hallazgos anatomopatológicos, resultados de PET, TC o RMN.

    REGLA 3 Y 4: DEDUPLICACIÓN INTELIGENTE Y ÚNICA ENTRADA POR FECHA:
    - Si el mismo parámetro aparece escrito con diferentes nombres o abreviaturas para la misma fecha (ej. 20/05/2025: Hb 12.4, Hemoglobina 12,4 y HGB 12.4), devuélvelo como UN ÚNICO resultado sobre el nombre normalizado ("Hemoglobina").

    REGLA 5: AGRUPAR POR FECHA (formato DD/MM/YYYY).

    SALIDA JSON ARRAY ÚNICAMENTE:
    [
      {
        "date": "DD/MM/YYYY",
        "test": "Nombre Normalizado Estándar",
        "value": número_o_decimal,
        "unit": "unidad estándar"
      }
    ]
  `;

  const parts = buildParts(instructionText, []);
  if (text) parts.push({ text: `Notas clínicas:\n${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    const raw = start !== -1 ? JSON.parse(clean.substring(start, end + 1)) : JSON.parse(clean);

    const EXCLUDED_TERMS = [
      'suv', 'suvmax', 'suvpeak', 'mtv', 'tlg', 'recist', 'tnm', 'ctnm', 'ptnm',
      'pd-l1', 'tps', 'cps', 'tmb', 'msi', 'dmmr', 'her2', 'egfr', 'kras', 'nras',
      'braf', 'alk', 'ros1', 'met', 'ret', 'fgfr', 'ntrk', 'esr1', 'brca', 'pik3ca', 'ki67'
    ];

    const resultMap = new Map<string, any>();
    for (const item of raw) {
      if (!item || !item.test || typeof item.test !== 'string') continue;
      const tLower = item.test.toLowerCase().trim();

      // Exclusión estricta de biomarcadores/imágenes
      if (EXCLUDED_TERMS.some(ex => tLower.includes(ex))) continue;

      const normTest = normalizeLabTestName(item.test);
      const date = item.date ? item.date.trim() : 'S/F';
      const key = `${date}|${normTest.toLowerCase()}`;
      const valNum = parseFloat(String(item.value).replace(',', '.'));

      if (!isNaN(valNum) && valNum !== 0 && !resultMap.has(key)) {
        resultMap.set(key, {
          ...item,
          test: normTest,
          value: valNum,
          unit: item.unit || ''
        });
      }
    }

    return Array.from(resultMap.values());
  } catch {
    return [];
  }
};

// ── Auditoría Clínica ──────────────────────────
export const generateClinicalAuditSecure = async (
  text: string,
  files: FileData[]
): Promise<string> => {

  const auditPrompt = `
ACTUÁ COMO: Extractor y auditor de registros clínicos oncológicos.
OBJETIVO: Organizar la información clínica existente, detectar datos faltantes y señalar inconsistencias documentales.
NO realizar interpretación clínica ni sugerir decisiones.

REGLAS DE SEGURIDAD:
1. NO emitas opiniones clínicas ni sugerencias terapéuticas.
2. NO infieras datos no escritos.
3. Si un dato no está explícito, usar "NO DOCUMENTADO".
4. SOLO HTML limpio con clases Tailwind.

NOTAS CLÍNICAS: "${text}"

TAREAS:
1) EXTRAER DATOS CLÍNICOS ESTRUCTURADOS (Edad, Sexo, Diagnóstico, Estadio TNM, ECOG, Biomarcadores, Tratamientos)
2) GENERAR CHECKLIST DE COMPLETITUD (✔ si existe, ⚠ si falta)
3) DETECTAR INCONSISTENCIAS DOCUMENTALES

FORMATO: HTML puro con clases Tailwind, en div contenedor.
  `;

  const parts = buildParts(auditPrompt, files);
  const res = await callGemini({ parts });
  return res.text.replace(/```html|```/g, '').trim();
};

// ── Generación de texto genérico ───────────────
export const generateTextSecure = async (
  prompt: string,
  context: string,
  files: FileData[]
): Promise<string> => {
  const privacyRule = "\n\nIMPORTANTE: NO incluyas nombres reales, DNI, ni datos de contacto.";
  const parts = buildParts(prompt + privacyRule, []);
  parts.push({ text: context });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts });
  return res.text;
};

// ── Vademécum de fármacos ──────────────────────
export const getDrugInfoSecure = async (drugName: string): Promise<string> => {
  const prompt = `
    Actúa como un Farmacéutico Oncológico Clínico Experto.
    Genera una ficha técnica precisa para: "${drugName}".
    Incluye: Mecanismo, Indicaciones, Preparación/Administración, Posología, RAM.
    REGLA: Devuelve ÚNICAMENTE HTML con clases Tailwind, sin markdown.
    ADVERTENCIA OBLIGATORIA al final: "Verificar siempre con fuentes oficiales antes de la administración."
  `;
  const res = await callGemini({ prompt });
  return res.text.replace(/```html|```/g, '').trim();
};

// ── Extracción masiva de imágenes desde historia clínica ───────────────
// Detecta TODOS los informes de imagen en los documentos y devuelve array
// de estudios estructurados. Se llama desde handleProcessDocuments.
export const extractImagingFromHistorySecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
    Sos un radiólogo oncólogo experimentado. Tu objetivo es sintetizar la EVOLUCIÓN RADIOLÓGICA del paciente.

    OBJETIVO: Generar un resumen evolutivo sin copiar informes completos ni resumir estudio por estudio literalmente. Reconstruir la evolución clínica de lesiones y respuestas radiológicas.

    REGLAS ESTRICTAS DE EXTRACCIÓN E INTERPRETACIONAL:
    1. NO REPETIR HALLAZGOS: Si distintos métodos (TC, RMN, PET-TC) describen exactamente el mismo hallazgo, conserva una única descripción sin duplicar datos. El PET-TC aporta únicamente la información metabólica (SUV) sobre la lesión anatómica ya conocida. La RMN aporta la información diferencial (ej: SNC o pelvis).
    2. AGRUPAR POR LOCALIZACIÓN ANATÓMICA (órganos/sitios): Organiza por localización ("Pulmón", "Hígado", "Ganglios", "Hueso", "Sistema Nervioso Central", "Peritoneo", "Suprarrenales", "Otros"), NO por método de estudio. Dentro de cada órgano muestra la evolución cronológica.
    3. MOSTRAR SOLO CAMBIOS CLÍNICAMENTE RELEVANTES: Conserva aparición de nuevas lesiones, desaparición, aumento/disminución de tamaño en mm, respuesta parcial (RP), respuesta completa (RC), enfermedad progresiva (EP) o estabilidad (EE) cuando modifique la conducta. Omite hallazgos repetitivos o inespecíficos.
    4. ELIMINAR FRASES SIN VALOR CLÍNICO: ❌ NUNCA incluyas "correlacionar clínicamente", "estudio técnicamente adecuado", "se recomienda seguimiento", "calidad diagnóstica aceptable", "hallazgos inespecíficos" o "sin cambios respecto al previo" si no aporta información asistencial.
    5. PRIORIZAR EL ESTUDIO CON MAYOR INFORMACIÓN:
       - RMN tiene prioridad para Sistema Nervioso Central (SNC) y pelvis.
       - PET-TC tiene prioridad para actividad metabólica (SUV).
       - TC tiene prioridad para anatomía toracoabdominal.
    6. EVITAR CRONOLOGÍAS REDUNDANTES: Si 3 o más estudios consecutivos describen la misma lesión sin cambios, conserva el primero y el último indicando estabilidad en el intervalo.

    FORMATO Y MEDIDAS:
    - Medidas SIEMPRE en milímetros (mm). Fechas en DD/MM/YYYY.
    - Tipo: SOLO "TC", "RMN" o "PET-TC".
    - NO incluyas datos identificatorios (nombres, DNI).

    SALIDA: ÚNICAMENTE ARRAY JSON DE ESTUDIOS EVOLUTIVOS:
    [
      {
        "type": "TC" | "RMN" | "PET-TC",
        "date": "DD/MM/YYYY",
        "bodyRegion": "región anatómica estudiada",
        "treatment": "esquema de tratamiento activo o null",
        "targetLesions": [
          { "location": "Órgano / Localización (Pulmón, Hígado, Ganglios, Hueso, SNC, Peritoneo, Suprarrenales, Otros)", "measurement": número_en_mm }
        ],
        "nonTargetLesions": [
          { "location": "Órgano / Localización", "status": "presente|ausente|aumentado|disminuido|estable" }
        ],
        "newLesions": true | false
      }
    ]
  `;

  const parts = buildParts(instructionText, []);
  if (text) parts.push({ text: `Historia clínica:\n${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start !== -1 && end !== -1) return JSON.parse(clean.substring(start, end + 1));
    return JSON.parse(clean);
  } catch {
    return [];
  }
};

// ── Comparación RECIST 1.1 entre estudios ─────────────────────────────
export const compareRecistSecure = async (
  studies: any[]
): Promise<string> => {

  const prompt = `
Sos un oncólogo experto en criterios RECIST 1.1 (versión 2009).

Analizá la siguiente serie de estudios del mismo paciente y generá un informe de respuesta.

ESTUDIOS (ordenados cronológicamente):
${JSON.stringify(studies, null, 2)}

CRITERIOS RECIST 1.1:
- Respuesta Completa (RC): Desaparición de todas las lesiones diana. Ganglios <10mm.
- Respuesta Parcial (RP): Reducción ≥30% de la suma de diámetros vs baseline.
- Enfermedad Progresiva (EP): Aumento ≥20% de la suma vs nadir + aumento absoluto ≥5mm. O nuevas lesiones.
- Enfermedad Estable (EE): No cumple criterios de RP ni EP.

FORMATO: HTML puro con clases Tailwind en un div contenedor. Incluir:
1. Tabla comparativa de lesiones diana (baseline → cada estudio, variación % vs baseline y nadir)
2. Evaluación de lesiones no diana por estudio
3. Nuevas lesiones detectadas
4. Respuesta por estudio (badges: verde=RC/RP, amarillo=EE, rojo=EP)
5. Conclusión RECIST global con razonamiento

NO incluyas nombres ni datos identificatorios.
  `;

  const res = await callGemini({ prompt });
  return res.text.replace(/```html|```/g, '').trim();
};

// ── Extracción de informe radiológico individual ─────────────────────────
export const extractSingleImagingReportSecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
Sos un radiólogo oncólogo. Extraé datos estructurados de el/los informe(s) radiológico(s) proporcionado(s).
REGLAS:

1. Extraé TODOS los estudios presentes en el material (puede haber más de uno).
2. Medidas SIEMPRE en milímetros (mm). Si viene en cm, convertí a mm.
3. Fechas en DD/MM/YYYY.
4. type: SOLO "TC" | "RMN" | "PET-TC" | "Ecografía".
5. Para cada lesión diana: location anatómica precisa + measurement numérico en mm + lesionKey estable (snake_case, ej: "pulmon_lsd", "higado_seg_vi", "ganglio_mediastino").
6. nonTargetLesions: location + status ("presente"|"ausente"|"aumentado"|"disminuido"|"estable").
7. newLesions: true si el informe menciona lesiones nuevas respecto a estudio previo.
8. treatment: esquema activo si se menciona, si no null.
9. NO inventes medidas. Si no hay medición cuantitativa, dejá targetLesions vacío.
10. NO incluyas nombres, DNI ni datos identificatorios.
11. NO copies el informe completo; solo datos estructurados.

SALIDA: ÚNICAMENTE array JSON:
[
  {
    "type": "TC" | "RMN" | "PET-TC" | "Ecografía",
    "date": "DD/MM/YYYY",
    "bodyRegion": "string",
    "treatment": "string|null",
    "targetLesions": [
      { "location": "string", "measurement": number, "lesionKey": "string" }
    ],
    "nonTargetLesions": [
      { "location": "string", "status": "string" }
    ],
    "newLesions": boolean
  }
]
  `;

  const parts = buildParts(instructionText, []);
  if (text) parts.push({ text: `Informe radiológico:\n${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start !== -1 && end !== -1) return JSON.parse(clean.substring(start, end + 1));
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

