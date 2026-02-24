/**
 * aiProxy.ts
 * 
 * REEMPLAZA todas las llamadas directas al SDK de Gemini (@google/genai)
 * por llamadas a la Cloud Function segura en el backend.
 * 
 * La API key de Gemini nunca sale del servidor.
 * Todas las llamadas requieren autenticación Firebase activa.
 * 
 * USO:
 *   // Antes (INSEGURO):
 *   const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
 *   const res = await ai.models.generateContent({ ... });
 * 
 *   // Ahora (SEGURO):
 *   const res = await callGemini({ prompt: "..." });
 *   console.log(res.text);
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
  // Verificar sesión activa antes de llamar
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuario no autenticado. Inicie sesión para continuar.");
  }

  const functions = getFunctions();
  const callGeminiFn = httpsCallable<CallGeminiParams, CallGeminiResult>(functions, "callGemini");

  const result = await callGeminiFn(params);
  return result.data;
};

// ──────────────────────────────────────────────
// HELPERS: funciones que reemplazan a las de
// residentAI.ts y clinicalAuditAI.ts
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
    Analiza los documentos y extrae la cronología clínica.
    REGLA DE PRIVACIDAD: NO incluyas DNI ni datos personales.
    Fechas: DD/MM/YYYY. Categorías: Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución.
    SALIDA: ÚNICAMENTE UN ARRAY JSON.
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

  // El prompt de auditoría completo (idéntico al original en clinicalAuditAI.ts)
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
// ── Extracción de datos de informe de imagen ──────────────────────────
export const extractImagingDataSecure = async (
  text: string,
  files: FileData[]
): Promise<any> => {

  const instructionText = `
Sos un radiólogo oncológico experto en criterios RECIST 1.1.
Analizá el informe de imagen adjunto y extraé los datos estructurados.

REGLAS:
- Medidas SIEMPRE en milímetros (mm). Si el informe dice "2.3 cm", convertí a 23 mm.
- Fechas en formato DD/MM/YYYY.
- Tipo de estudio: solo "TC", "RMN" o "PET-TC".
- Si no podés determinar un campo, usá null.
- Las lesiones diana son las medibles según RECIST 1.1 (eje largo >10mm para tejidos blandos, >15mm para ganglios).
- Las lesiones no diana son lesiones conocidas no medibles o no seleccionadas como diana.

SALIDA: ÚNICAMENTE JSON con esta estructura exacta:
{
  "type": "TC" | "RMN" | "PET-TC",
  "date": "DD/MM/YYYY",
  "bodyRegion": "descripción de región estudiada",
  "targetLesions": [
    { "location": "localización anatómica", "measurement": número_en_mm }
  ],
  "nonTargetLesions": [
    { "location": "localización", "status": "presente/ausente/aumentado/disminuido" }
  ],
  "newLesions": true | false,
  "rawSummary": "resumen del informe en 2-3 líneas"
}
  `;

  const parts = buildParts(instructionText, []);
  if (text) parts.push({ text: `Informe: ${text}` });
  files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1) return JSON.parse(clean.substring(start, end + 1));
    return JSON.parse(clean);
  } catch {
    throw new Error("No se pudo interpretar el informe de imagen.");
  }
};

// ── Comparación RECIST 1.1 entre estudios ─────────────────────────────
export const compareRecistSecure = async (
  studies: any[]
): Promise<string> => {

  const prompt = `
Sos un oncólogo experto en criterios RECIST 1.1 (versión 2009).

Analizá la siguiente serie de estudios de imagen del mismo paciente y generá un informe de respuesta al tratamiento.

ESTUDIOS (ordenados cronológicamente):
${JSON.stringify(studies, null, 2)}

CRITERIOS RECIST 1.1 A APLICAR:
- Respuesta Completa (RC): Desaparición de todas las lesiones diana. Ganglios <10mm.
- Respuesta Parcial (RP): Reducción ≥30% de la suma de diámetros vs baseline.
- Enfermedad Progresiva (EP): Aumento ≥20% de la suma vs nadir + aumento absoluto ≥5mm. O aparición de nuevas lesiones.
- Enfermedad Estable (EE): No cumple criterios de RP ni EP.
- Para lesiones no diana: RC si desaparecen todas, EP si progresan inequívocamente, EE/RP si persisten sin progresión clara.
- La respuesta global considera tanto lesiones diana como no diana y nuevas lesiones.

FORMATO DE SALIDA: HTML puro con clases Tailwind en un div contenedor. Incluir:
1. Tabla comparativa de lesiones diana (baseline → cada estudio posterior, con variación % respecto a baseline y nadir)
2. Evaluación de lesiones no diana
3. Nuevas lesiones detectadas
4. Respuesta por estudio (usando badges de color: verde=RC/RP, amarillo=EE, rojo=EP)
5. Conclusión RECIST global con razonamiento

IMPORTANTE: No incluyas nombres ni datos identificatorios del paciente.
  `;

  const res = await callGemini({ prompt });
  return res.text.replace(/```html|```/g, '').trim();
};
