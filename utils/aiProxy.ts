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
import { auth } from "../firebase";

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
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────
export const callGemini = async (params: CallGeminiParams): Promise<CallGeminiResult> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuario no autenticado. Inicie sesión para continuar.");
  }

  const functions = getFunctions();
  
  // ⏳ SOLUCIÓN TIMEOUT: Le decimos al navegador que espere hasta 9 minutos (540000 ms)
  const callGeminiFn = httpsCallable<CallGeminiParams, CallGeminiResult>(
    functions, 
    "callGemini",
    { timeout: 540000 } 
  );

  const result = await callGeminiFn(params);
  return result.data;
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }

const buildParts = (text: string | undefined, files: FileData[]): GeminiPart[] => {
  const parts: GeminiPart[] = [];
  if (text) parts.push({ text });
  files.slice(0, 5).forEach(f => {
    if (f.data && f.type) {
      parts.push({ inlineData: { mimeType: f.type, data: f.data } });
    }
  });
  return parts;
};

// ── Chat con contexto ──────────────────────────
export const getChatResponseSecure = async (
  msgs: ChatMessage[],
  newMsg: string,
  context: string,
  files: FileData[]
): Promise<string> => {
  const historyText = msgs.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
  const contextBlock = `Contexto Anónimo:\n${context}\n\nHistorial reciente:\n${historyText}`;

  const parts = buildParts(contextBlock, files.slice(0, 3));
  parts.push({ text: newMsg });

  const res = await callGemini({
    parts,
    systemInstruction: "Eres un oncólogo experto. Responde en español técnico. NUNCA menciones nombres reales, DNI o datos de contacto.",
  });
  return res.text;
};

// ── Extracción de Timeline ─────────────────────
export const extractTimelineSecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
    Eres un asistente médico argentino. Analiza los documentos y extrae la cronología clínica.
    
    IDIOMA OBLIGATORIO: Todo el contenido de los campos "professional", "category" y "note" DEBE estar en español, sin excepción. Si el documento fuente está en inglés, traduce el contenido al español.
    
    REGLA DE PRIVACIDAD: NO incluyas DNI, nombre del paciente ni datos personales.
    
    Fechas: formato DD/MM/YYYY.
    
    Categorías permitidas (usar exactamente estas palabras): Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución.
    
    ESTRUCTURA JSON REQUERIDA — devolver ÚNICAMENTE el array:
    [
      {
        "date": "DD/MM/YYYY",
        "professional": "especialidad o nombre del profesional en español",
        "category": "una de las categorías permitidas",
        "note": "resumen conciso del evento clínico EN ESPAÑOL",
        "isKey": true o false
      }
    ]
    
    isKey = true solo para: diagnóstico inicial, recaída, cirugía mayor, inicio de quimioterapia, fallecimiento.
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

// ── Extracción de Laboratorios ─────────────────
export const extractLabsSecure = async (
  text: string,
  files: FileData[]
): Promise<any[]> => {
  if (!text && files.length === 0) return [];

  const instructionText = `
    Extrae resultados de laboratorio del texto clínico y documentos.
    Normaliza abreviaciones (hb → Hemoglobina, plaq → Plaquetas, etc).
    SALIDA: ÚNICAMENTE ARRAY JSON: [{ "date": "DD/MM/YYYY", "test": "nombre", "value": number, "unit": "unidad" }]
  `;

  const parts = buildParts(instructionText, []);
  if (text) parts.push({ text: `Notas: ${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    const raw = start !== -1 ? JSON.parse(clean.substring(start, end + 1)) : JSON.parse(clean);
    return raw.filter((l: any) => l.value !== 0 && !isNaN(parseFloat(l.value)));
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
Sos un radiólogo oncológico experto en criterios RECIST 1.1.

Analizá TODOS los documentos adjuntos y el texto clínico. Buscá TODOS los informes de imágenes oncológicas (TC, RMN, PET-TC). Puede haber múltiples estudios en un mismo documento o en documentos distintos.

REGLAS ESTRICTAS:
- Medidas SIEMPRE en milímetros (mm). Si dice "2.3 cm" → 23. Si dice "12 mm" → 12.
- Fechas en DD/MM/YYYY. Si solo hay mes/año, usar "01/MM/YYYY".
- Tipo: SOLO "TC", "RMN" o "PET-TC". Si es "TAC" o "tomografía" → "TC".
- Lesiones diana: medibles según RECIST 1.1 (>10mm tejidos blandos, >15mm ganglios).
- Lesiones no diana: no medibles o no seleccionadas como diana.
- Tratamiento: esquema activo AL MOMENTO del estudio según contexto clínico cercano. Si no está claro → null.
- NO incluyas datos identificatorios (nombres, DNI, nro de historia clínica).
- Si no hay ningún informe de imagen, devolvé [].

SALIDA: ÚNICAMENTE ARRAY JSON:
[
  {
    "type": "TC" | "RMN" | "PET-TC",
    "date": "DD/MM/YYYY",
    "bodyRegion": "región anatómica estudiada",
    "treatment": "esquema de tratamiento activo o null",
    "targetLesions": [
      { "location": "localización anatómica precisa", "measurement": número_en_mm }
    ],
    "nonTargetLesions": [
      { "location": "localización", "status": "presente|ausente|aumentado|disminuido|estable" }
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
