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

// ── Instrucción de Sistema de Alta Precisión y Discusión Clínica para Chat ──────
export const CLINICAL_CHAT_SYSTEM_INSTRUCTION = `
Eres un asistente y consultor oncólogo senior en una discusión clínica interactiva de interconsulta. Tu propósito es brindar apoyo clínico de alta calidad, médicamente riguroso, prudente y fundamentado al médico tratante.

1. PRIORIDAD A LA PREGUNTA ACTUAL Y MANEJO DE ANTECEDENTES:
- Responde primero, de manera directa y concreta a la pregunta o consulta realizada por el médico.
- CONSULTAS SOBRE ESTUDIOS O ANTECEDENTES PREVIOS: Si el médico pregunta expresamente si el paciente se realizó o cuenta con determinado estudio, laboratorio, biopsia o marcador (ej. "¿Se realizó PSA?", "¿Tiene centellograma óseo?", "¿Hay registro de TAC o mutaciones?"):
  • Revisa minuciosamente los antecedentes, laboratorio, imágenes y cronología del paciente.
  • Si no existe registro, responde con total claridad médica: "No figura registro de [estudio/marcador] en los antecedentes clínicos documentados del paciente."
- APORTE DE DATOS NUEVOS Y CONSULTAS TERAPÉUTICAS: Si el médico aporta información nueva o plantea una situación clínica (ej. "El paciente inició Darolutamida", "Presenta dolor óseo y fosfatasa alcalina elevada, ¿qué conducta sugieres?"):
  • NUNCA evadas la pregunta diciendo que el dato no está cargado en el sistema.
  • Incorpora de inmediato el dato aportado por el médico como contexto clínico activo de la consulta y responde la pregunta médica basándote en ese escenario.
- Recuerda y utiliza toda la información clínica mencionada en los mensajes previos del diálogo. No pidas datos que el médico ya haya proporcionado en la conversación.

2. PRECISIÓN MÉDICA Y JERARQUÍA ESTRICTA DE EVIDENCIA:
Basa tus respuestas en este orden estricto de prioridad:
1° Información clínica concreta del paciente: antecedentes, historia clínica, cronología, laboratorios, imágenes, tratamientos Y los datos clínicos aportados por el médico en la conversación.
2° Guías clínicas adjuntadas por el usuario en la sesión, si existen.
3° Guías y consensos oncológicos oficiales vigentes pertinentes EXACTAMENTE al diagnóstico específico, estirpe histológica, subtipo molecular, estadio y situación clínica del paciente (ej. NCCN, ESMO, ASCO, ASTRO, EORTC).
4° Evidencia médica disponible y conocimiento farmacológico oncológico confiable.

3. CORRESPONDENCIA EXACTA Y CITACIÓN DE GUÍAS:
- CORRESPONDENCIA ESTRICTA: La guía o evidencia debe corresponder exactamente al diagnóstico, subtipo, estadio y situación clínica del paciente. PROHIBIDO utilizar guías o extrapolaciones de otras estirpes tumorales.
- Cuando exista evidencia o recomendación de guía que sustente una respuesta, menciónala brevemente (ej. "según guías NCCN / ESMO..."), evitando citas o referencias inventadas.
- En preguntas clínicas complejas (ej. indicación de tratamientos sistémicos, adyuvancia, secuenciación, toxicidades o dudas de progresión), razona brevemente el fundamento oncológico de la recomendación en lugar de limitarte a una conclusión aislada.

4. REGLA DE SEGURIDAD CLÍNICA Y MANEJO DE INCERTIDUMBRE:
- NUNCA presentes como un hecho una inferencia del modelo.
- Diferencia siempre con rigor:
  • Dato confirmado (en la historia o aportado por el médico).
  • Interpretación clínica razonada.
  • Recomendación basada en evidencia.
  • Hipótesis o posibilidad diagnóstica que requiere confirmación.
  • Información que falta para poder responder con seguridad.
- Si existen dos interpretaciones posibles de la información clínica (ej. progresión vs. pseudoprogresión, necrosis vs. recidiva, toxicidad vs. complicación tumoral), explicita la incertidumbre y plantea qué dato o estudio es necesario antes de emitir una recomendación específica.
- Si la evidencia o la información no son suficientes para responder con seguridad, dilo explícitamente y explica qué dato sería necesario.

5. ESTILO Y FORMATO:
- Redacta en prosa médica profesional, fluida, respetuosa y natural en español.
- ❌ PROHIBIDO escribir etiquetas o prefijos meta como "[Dato Documentado]:", "[Dato Estructurado]:", "[Inferencia]:", "[Hipótesis]:", etc.
- No es obligatorio usar plantillas rígidas en todas las respuestas; responde de forma ágil y clara a la pregunta, estructurando con subtítulos breves solo cuando la complejidad del caso lo amerite.

6. PRIVACIDAD:
- NUNCA menciones nombres reales de personas, DNI ni datos de contacto.
`.trim();

// ── Chat con contexto ──────────────────────────
export const getChatResponseSecure = async (
  msgs: ChatMessage[],
  newMsg: string,
  context: string,
  files: FileData[]
): Promise<string> => {
  // Mantener los últimos 10 mensajes para conversación continua
  const historyText = msgs.slice(-10).map(m => `${m.role === 'user' ? 'MÉDICO' : 'ASISTENTE ONCOLÓGICO'}: ${m.text}`).join('\n\n');
  const contextBlock = `ANTECEDENTES Y REGISTROS CLÍNICOS DEL PACIENTE:\n${context}\n\nCONVERSACIÓN CLÍNICA EN CURSO:\n${historyText}`;

  const parts = buildParts(contextBlock, files.slice(0, 3));
  parts.push({ text: `CONSULTA DEL MÉDICO:\n${newMsg}` });

  const res = await callGemini({
    parts,
    systemInstruction: CLINICAL_CHAT_SYSTEM_INSTRUCTION,
  });
  const text = res.text || '';
  return text.replace(/\[(?:Dato Documentado|Dato Estructurado|Dato no estructurado|Inferencia|Hipótesis|Dato Clínico)\]:\s*/gi, '').trim();
};

// ── Parser JSON resiliente ─────────────────────
export const parseJsonArraySafely = (rawText: string): any[] => {
  if (!rawText) return [];
  const clean = rawText.replace(/```json|```/g, '').trim();

  // 1. Extracción directa del bloque entre corchetes
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(clean.substring(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Continuar con recuperación
    }
  }

  // 2. Parseo directo del texto completo
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
  } catch {
    // Continuar con recuperación
  }

  // 3. Reparación de JSON truncado (cerrando con ']')
  if (start !== -1) {
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace > start) {
      try {
        const repaired = clean.substring(start, lastBrace + 1) + ']';
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Continuar con extracción por objetos
      }
    }
  }

  // 4. Extracción individual de objetos JSON
  const results: any[] = [];
  const objectRegex = /\{[\s\S]*?\}(?=\s*,\s*\{|\s*\]|\s*$)/g;
  let match;
  while ((match = objectRegex.exec(clean)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj && typeof obj === 'object') {
        results.push(obj);
      }
    } catch {
      // Ignorar fragmentos incompletos
    }
  }

  return results;
};

import { splitFilesIntoProcessableChunks, DocumentChunk } from './pdfChunker';
import { consolidateTimelineEvents, ClinicalEvent } from './timelineConsolidator';
export { consolidateTimelineEvents, normalizeEventCategory, normalizeEventDate } from './timelineConsolidator';
export { splitPdfIntoChunks, splitFilesIntoProcessableChunks } from './pdfChunker';
export type { ClinicalEvent } from './timelineConsolidator';
export type { DocumentChunk } from './pdfChunker';
export { computeChunkHash, filterProcessableChunks, computeContentHash } from './chunkHasher';
export type { ProcessedChunkRecord, ChunkFilterResult } from './chunkHasher';

export interface TimelineProgressCallback {
  (progress: { current: number; total: number; message: string; stage?: string }): void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Extracción de Timeline (Procesamiento Progresivo Multi-Bloque) ─────────────────────
export const extractTimelineSecure = async (
  text: string,
  files: FileData[],
  onProgress?: TimelineProgressCallback,
  onWarning?: (msg: string) => void,
  precomputedChunks?: DocumentChunk[]
): Promise<ClinicalEvent[]> => {
  if (!text && (!files || files.length === 0) && (!precomputedChunks || precomputedChunks.length === 0)) return [];

  const instructionText = `
    Eres un asistente médico experto en oncología. Analiza toda la documentación y extrae la cronología clínica completa del paciente.

    REGLAS DE EXTRACCIÓN Y COBERTURA:
    1. ❌ Extrae TODOS los eventos clínicos documentados a lo largo de este fragmento de historia clínica sin omitir ninguno.
    2. Si en la misma fecha ocurren sucesos de distinta índole (ej: una Cirugía y una Biopsia, o una Quimio y un Control/Estudio), registra cada acontecimiento relevante por separado en su categoría correspondiente.
    3. No inventes eventos ni repitas el mismo acontecimiento idéntico.

    IDIOMA OBLIGATORIO: Todo en español. Si el documento está en inglés, traduce el contenido.

    REGLA DE PRIVACIDAD: NO incluyas DNI, nombres reales ni datos personales.

    Fechas: formato DD/MM/YYYY (o S/F si no figura fecha exacta).

    Categorías permitidas (usar exactamente estas palabras): Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución, Anatomía Patológica, Diagnóstico.

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
    - EVENTOS SECUNDARIOS (isKey = false): "note" DEBE SER CONCISO Y CLARO (1 o 2 frases descriptivas).

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

  const accumulatedRawEvents: any[] = [];
  const failedChunks: string[] = [];

  try {
    // 1. Particionar archivos PDF en bloques de páginas manejables (o usar bloques precalculados)
    const chunks = precomputedChunks && precomputedChunks.length > 0
      ? precomputedChunks
      : await splitFilesIntoProcessableChunks(files || []);

    if (chunks.length > 0) {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: chunks.length,
            message: `Extrayendo eventos clínicos: ${chunk.label}...`,
            stage: 'extracting',
          });
        }

        const parts = buildParts(instructionText, []);
        // Si hay texto clínico y es el primer bloque, incluirlo
        if (text && i === 0 && chunks.length === 1) {
          parts.push({ text: `Notas clínicas anónimas: ${text}` });
        }
        parts.push({
          inlineData: { mimeType: chunk.file.type, data: chunk.file.data },
        });

        try {
          const res = await callGemini({ parts, responseMimeType: 'application/json' });
          const parsed = parseJsonArraySafely(res.text || '');
          if (Array.isArray(parsed) && parsed.length > 0) {
            accumulatedRawEvents.push(...parsed);
          }
        } catch (chunkErr: any) {
          console.warn(`[extractTimelineSecure] Error en bloque "${chunk.label}":`, chunkErr);
          failedChunks.push(chunk.label);
          if (onWarning) {
            onWarning(`No se pudo procesar completamente ${chunk.label} (${chunkErr.message || 'Error'}).`);
          }
        }

        // Pequeña pausa entre bloques para respetar rate limits si hay múltiples bloques
        if (i < chunks.length - 1) {
          await sleep(600);
        }
      }
    }

    // 2. Si hay texto clínico puro sin archivos o con múltiples archivos, procesarlo
    if (text && (chunks.length === 0 || chunks.length > 1)) {
      if (onProgress) {
        onProgress({
          current: chunks.length || 1,
          total: chunks.length || 1,
          message: 'Extrayendo eventos de las notas clínicas de texto...',
          stage: 'text',
        });
      }
      try {
        const parts = buildParts(instructionText, []);
        parts.push({ text: `Notas clínicas anónimas:\n${text}` });
        const res = await callGemini({ parts, responseMimeType: 'application/json' });
        const parsed = parseJsonArraySafely(res.text || '');
        if (Array.isArray(parsed) && parsed.length > 0) {
          accumulatedRawEvents.push(...parsed);
        }
      } catch (textErr: any) {
        console.warn('[extractTimelineSecure] Error en extracción de texto:', textErr);
        if (onWarning) {
          onWarning(`Error al extraer eventos de las notas de texto: ${textErr.message}`);
        }
      }
    }

    if (onProgress) {
      onProgress({
        current: chunks.length || 1,
        total: chunks.length || 1,
        message: 'Consolidando y ordenando cronología clínica...',
        stage: 'consolidating',
      });
    }

    // 3. Consolidar, deduplicar entre bloques y ordenar cronológicamente
    const consolidated = consolidateTimelineEvents([], accumulatedRawEvents);

    if (failedChunks.length > 0 && onWarning) {
      onWarning(`Atención: ${failedChunks.length} bloque(s) tuvieron dificultades: ${failedChunks.join(', ')}.`);
    }

    return consolidated;
  } catch (err: any) {
    console.error('Error general en extractTimelineSecure:', err);
    if (onWarning) {
      onWarning(`Error general en la extracción de eventos: ${err.message}`);
    }
    return consolidateTimelineEvents([], accumulatedRawEvents);
  }
};

// ── Normalización y Validación de Parámetros de Laboratorio ───
export { normalizeLabTestName, normalizeLabUnit, isPlausibleLabResult, validateLabResult } from './labValidation';
import { normalizeLabTestName, isPlausibleLabResult } from './labValidation';

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
    const raw = parseJsonArraySafely(res.text || '');

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
      const unit = item.unit || '';

      // Validación de plausibilidad clínica: descarta valores imposibles o errores de OCR sin alterar valores originales
      if (
        !isNaN(valNum) &&
        valNum !== 0 &&
        !resultMap.has(key) &&
        isPlausibleLabResult(normTest, valNum, unit)
      ) {
        resultMap.set(key, {
          ...item,
          test: normTest,
          value: valNum,
          unit: unit
        });
      }
    }

    return Array.from(resultMap.values());
  } catch (err) {
    console.error("Error en extractLabsSecure:", err);
    return [];
  }
};

// ── Auditoría Clínica / Control de Calidad ──────────────────
export const generateClinicalAuditSecure = async (
  text: string,
  files: FileData[]
): Promise<string> => {

  const auditPrompt = `
ACTUÁ COMO: Extractor y auditor de registros clínicos oncológicos.
OBJETIVO: Detectar vacíos documentales críticos e inconsistencias en la historia clínica del paciente.
NO realizar interpretación clínica ni sugerir conductas terapéuticas.

REGLAS DE SEGURIDAD (CERO TOLERANCIA):
1. NO emitas opiniones clínicas subjetivas ni sugerencias terapéuticas.
2. NO infieras datos que no estén expresamente documentados.
3. Si un dato esencial no está explícito, señalarlo como alerta.

CRITERIOS CLÍNICOS Y DOCUMENTALES A AUDITAR:
1) COMPLETITUD DE VARIABLES CLAVE:
   - Estadio tumoral completo (TNM / FIGO)
   - Performance status (ECOG / WHO)
   - Confirmación histopatológica / informe de biopsia
   - Biomarcadores / perfil molecular / inmunohistoquímica requerida
   - Estudios de imágenes relevantes de estadificación o reevaluación
   - Registro de tratamientos previos o en curso
2) INCONSISTENCIAS Y DISCORDANCIAS DOCUMENTALES:
   - Discordancia cronológica de fechas
   - Discordancia entre estadio asignado y hallazgos patológicos o radiológicos
   - Falta de criterios de respuesta documentados (ej. iRECIST en inmunoterapia) o discrepancias en la indicación

FORMATO DE SALIDA ESTRICTO (JSON):
- Si NO se detectan inconsistencias ni vacíos críticos relevantes:
  {
    "hasIssues": false,
    "alerts": []
  }

- Si se detectan inconsistencias o vacíos críticos:
  {
    "hasIssues": true,
    "alerts": [
      {
        "category": "Tratamiento" | "Estadificación" | "Biopsia" | "Biomarcadores" | "Imágenes" | "Performance Status" | "Cronología",
        "summary": "Frase breve y directa (ej: verificar correspondencia con inmunoterapia/iRECIST o falta información para confirmar el estadio).",
        "detail": "Explicación contextual y justificación documental precisa en 1-2 oraciones."
      }
    ]
  }

IMPORTANTE:
- NO incluyas en la lista de alertas los controles que fueron correctos.
- NO agregues texto fuera del JSON.

NOTAS CLÍNICAS: "${text}"
  `;

  const parts = buildParts(auditPrompt, files);
  const res = await callGemini({ parts, responseMimeType: "application/json" });
  const raw = res.text ? (typeof res.text === 'function' ? (res as any).text() : res.text) : "";
  return raw.replace(/```json|```html|```/g, '').trim();
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
// Detecta ÚNICAMENTE estudios con hallazgos oncológicos relevantes o positivos
export const extractImagingFromHistorySecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
    Sos un radiólogo oncólogo experimentado. Tu objetivo es identificar y sintetizar la EVOLUCIÓN RADIOLÓGICA del paciente.

    OBJETIVO PRINCIPAL:
    Extraer SOLAMENTE los estudios de imágenes que tengan hallazgos oncológicamente relevantes o positivos:
    - PET/CT con enfermedad activa, captación hipermetabólica patológica o SUV relevante.
    - TC con lesiones tumorales, metástasis, adenopatías patológicas o cambios evolutivos.
    - RM con hallazgos oncológicos patológicos (ej: SNC, hepáticas, pélvicas).
    - Otros estudios que documenten enfermedad activa o resolución/respuesta completa de lesiones previas.
    ❌ EVITAR incorporar estudios normales o sin hallazgos relevantes, salvo que sean necesarios para documentar remisión completa.

    REGLAS DE SÍNTESIS:
    1. NO COPIAR INFORMES COMPLETOS: Extrae únicamente información concisa y cuantitativa.
    2. relevantFindings: Redacta una línea breve y directa del hallazgo oncológico principal (ej: "Lesión hepática segmentaria: 32 mm", "Lesión hepática hipermetabólica: SUVmáx 8,4", "Nódulo pulmonar LSD: 14 mm", "Múltiples metástasis óseas blásticas").
    3. Medidas en milímetros (mm). Fechas en DD/MM/YYYY.
    4. suvMax: Si es PET-TC y se especifica SUVmáx o captación metabólica, extraer el valor.
    5. targetLesions: Lesiones mensurables con localización precisa, medida en mm y lesionKey única (snake_case).
    6. nonTargetLesions: Hallazgos no mensurables (location + status: "presente"|"ausente"|"aumentado"|"disminuido"|"estable").
    7. newLesions: true si se identifican lesiones nuevas respecto a estudios anteriores.
    8. NO incluyas datos identificatorios (nombres de personas, DNI).

    SALIDA: ÚNICAMENTE ARRAY JSON:
    [
      {
        "type": "TC" | "RMN" | "PET-TC" | "Ecografía",
        "date": "DD/MM/YYYY",
        "bodyRegion": "región anatómica estudiada (ej: TAP, Tórax, Abdomen y Pelvis, Cerebro)",
        "treatment": "esquema de tratamiento activo o null",
        "relevantFindings": "resumen breve del hallazgo oncológico relevante",
        "suvMax": number_o_null,
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
  if (text) parts.push({ text: `Historia clínica:\n${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    return parseJsonArraySafely(res.text || '');
  } catch (err) {
    console.error("Error en extractImagingFromHistorySecure:", err);
    return [];
  }
};

// ── Comparación RECIST 1.1 entre estudios ─────────────────────────────
export const compareRecistSecure = async (
  studies: any[]
): Promise<string> => {

  const prompt = `
Sos un oncólogo experto en criterios RECIST 1.1 (versión 2009) y iRECIST.

Analizá la siguiente serie de estudios del mismo paciente y generá un informe conciso y riguroso de respuesta.

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
5. Conclusión RECIST global con razonamiento clínico

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
Sos un radiólogo oncólogo. Extraé datos estructurados y sintetizados de el/los informe(s) radiológico(s) proporcionado(s).
REGLAS:

1. Extraé ÚNICAMENTE los estudios presentes que contengan hallazgos oncológicos positivos o relevantes.
2. Medidas SIEMPRE en milímetros (mm). Si viene en cm, convertí a mm.
3. Fechas en DD/MM/YYYY.
4. type: SOLO "TC" | "RMN" | "PET-TC" | "Ecografía".
5. relevantFindings: Resumen directo y breve del hallazgo principal (ej: "Lesión hepática segmentaria: 32 mm", "PET hipermetabólico SUVmáx 8.4").
6. suvMax: Extraer valor numérico si se especifica SUVmáx en PET-TC.
7. targetLesions: location anatómica precisa + measurement numérico en mm + lesionKey estable (snake_case).
8. nonTargetLesions: location + status ("presente"|"ausente"|"aumentado"|"disminuido"|"estable").
9. newLesions: true si el informe menciona lesiones nuevas respecto a estudio previo.
10. treatment: esquema activo si se menciona, si no null.
11. NO copies el informe completo; solo datos estructurados y el hallazgo sintético.
12. NO incluyas nombres, DNI ni datos identificatorios.

SALIDA: ÚNICAMENTE array JSON:
[
  {
    "type": "TC" | "RMN" | "PET-TC" | "Ecografía",
    "date": "DD/MM/YYYY",
    "bodyRegion": "string",
    "treatment": "string|null",
    "relevantFindings": "string",
    "suvMax": number|null,
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

  try {
    const res = await callGemini({ parts, responseMimeType: "application/json" });
    return parseJsonArraySafely(res.text || '');
  } catch (err) {
    console.error("Error en extractSingleImagingReportSecure:", err);
    return [];
  }
};

