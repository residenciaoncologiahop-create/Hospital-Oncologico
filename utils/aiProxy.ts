import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";
import { getApp } from "firebase/app";

// Tipos
interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string }; }
interface CallGeminiParams { prompt?: string; parts?: GeminiPart[]; systemInstruction?: string; responseMimeType?: string; }
interface CallGeminiResult { text: string; }
interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }

// ──────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────
export const callGemini = async (params: CallGeminiParams): Promise<CallGeminiResult> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado. Inicie sesión para continuar.");

  const functions = getFunctions(getApp(), 'us-central1');
  const callGeminiFn = httpsCallable<CallGeminiParams, CallGeminiResult>(functions, "callGemini");
  
  const result = await callGeminiFn(params);
  return result.data;
};

// ──────────────────────────────────────────────
// ESCUDO DE TAMAÑO (Evita que el servidor colapse)
// ──────────────────────────────────────────────
const buildParts = (text: string | undefined, files: FileData[]): GeminiPart[] => {
  const parts: GeminiPart[] = [];
  if (text) parts.push({ text });

  let totalBytes = 0;
  // Procesamos máximo 2 archivos a la vez para no exceder los límites de Google
  const filesToProcess = files.slice(0, 2);

  filesToProcess.forEach(f => {
    if (f.data && f.type) {
      totalBytes += f.data.length * 0.75; // Cálculo aproximado de Base64
      parts.push({ inlineData: { mimeType: f.type, data: f.data } });
    }
  });

  const sizeMB = totalBytes / (1024 * 1024);
  if (sizeMB > 6.5) {
    throw new Error(`⚠️ Los documentos son muy pesados (${sizeMB.toFixed(1)}MB). Firebase permite un máximo de 6.5MB por petición. Sube un PDF más corto o un resumen en texto.`);
  }

  return parts;
};

// ── Funciones Exportadas ──────────────────────────

export const getChatResponseSecure = async (msgs: ChatMessage[], newMsg: string, context: string, files: FileData[]): Promise<string> => {
  const historyText = msgs.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
  const contextBlock = `Contexto Anónimo:\n${context}\n\nHistorial reciente:\n${historyText}`;
  const parts = buildParts(contextBlock, files);
  parts.push({ text: newMsg });

  const res = await callGemini({ parts, systemInstruction: "Eres un oncólogo experto. Responde en español técnico. NUNCA menciones nombres reales, DNI o datos de contacto." });
  return res.text;
};

export const extractTimelineSecure = async (text: string, files: FileData[]): Promise<any[]> => {
  if (!text && files.length === 0) return [];
  const instructionText = `Analiza los documentos y extrae la cronología clínica. REGLA: NO incluyas DNI. Fechas: DD/MM/YYYY. SALIDA ESTRICTA: UN ARRAY JSON: [{"date": "DD/MM/YYYY", "professional": "Nombre", "category": "Categoría", "note": "Nota", "isKey": false}]`;
  const combinedText = text ? `${instructionText}\n\nNotas clínicas: ${text}` : instructionText;
  
  const parts = buildParts(combinedText, files);
  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('['); const end = clean.lastIndexOf(']');
    return JSON.parse(start !== -1 ? clean.substring(start, end + 1) : clean);
  } catch { return []; }
};

export const extractLabsSecure = async (text: string, files: FileData[]): Promise<any[]> => {
  if (!text && files.length === 0) return [];
  const instructionText = `Extrae laboratorios. SALIDA ESTRICTA: ARRAY JSON: [{"date": "DD/MM/YYYY", "test": "nombre", "value": number, "unit": "unidad"}]`;
  const combinedText = text ? `${instructionText}\n\nNotas: ${text}` : instructionText;
  
  const parts = buildParts(combinedText, files);
  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('['); const end = clean.lastIndexOf(']');
    const raw = JSON.parse(start !== -1 ? clean.substring(start, end + 1) : clean);
    return raw.filter((l: any) => l.value !== 0 && !isNaN(parseFloat(l.value)));
  } catch { return []; }
};

export const generateClinicalAuditSecure = async (text: string, files: FileData[]): Promise<string> => {
  const auditPrompt = `ACTUÁ COMO: Extractor y auditor de registros clínicos. REGLAS: SOLO HTML limpio con Tailwind. \n\nNOTAS CLÍNICAS: "${text}"`;
  const parts = buildParts(auditPrompt, files);
  const res = await callGemini({ parts });
  return res.text.replace(/```html|```/g, '').trim();
};

export const generateTextSecure = async (prompt: string, context: string, files: FileData[]): Promise<string> => {
  const combinedText = `${prompt}\n\nIMPORTANTE: NO nombres reales, DNI, ni contacto.\n\n${context}`;
  const parts = buildParts(combinedText, files);
  const res = await callGemini({ parts });
  return res.text;
};

export const getDrugInfoSecure = async (drugName: string): Promise<string> => {
  const prompt = `Actúa como Farmacéutico Oncológico. Ficha para: "${drugName}". Devuelve ÚNICAMENTE HTML con Tailwind.`;
  const res = await callGemini({ prompt });
  return res.text.replace(/```html|```/g, '').trim();
};
