import { GoogleGenAI } from "@google/genai";

interface FileData { name: string; type: string; data: string; }

export const generateClinicalAudit = async (text: string, files: FileData[]) => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) throw new Error("API Key no configurada.");

  try {
    const ai = new GoogleGenAI({ apiKey });

    // PROMPT UNIFICADO (Single String Strategy)
    // Diseñado para actuar como un "Data Extractor" estricto.
    const auditPrompt = `
      ACTÚA COMO: Auditor de Calidad de Registros Médicos Oncológicos.
      TU OBJETIVO: Escanear el texto y los archivos adjuntos para estructurar la información existente y señalar explícitamente qué datos obligatorios faltan.
      
      REGLAS DE SEGURIDAD (CERO TOLERANCIA):
      1. NO emitas opiniones clínicas ni sugerencias de tratamiento.
      2. NO interpretes "silencios" (si el dato no está escrito, clasifícalo como AUSENTE).
      3. NO uses Markdown. Genera SOLAMENTE HTML limpio y estilizado con clases Tailwind (text-sm, font-bold, p-2, border, etc.).

      ENTRADA DE DATOS:
      - Notas Clínicas: "${text}"
      - Archivos Adjuntos: (Analiza el contenido de los documentos provistos).

      ESTRUCTURA DE SALIDA REQUERIDA (HTML):

      <div class="space-y-4 font-sans text-gray-800">
        
        <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
          <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">1. Ficha Oncológica</h3>
          <div class="grid grid-cols-2 gap-y-2 text-sm">
            <div><span class="font-bold">Paciente:</span> [Extraer edad/sexo]</div>
            <div><span class="font-bold">Diagnóstico:</span> [Extraer tipo tumoral exacto]</div>
            <div><span class="font-bold">Estadio (TNM/FIGO):</span> [Extraer o "NO DOCUMENTADO"]</div>
            <div><span class="font-bold">Performance Status (ECOG):</span> [Extraer o "NO DOCUMENTADO"]</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
          <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">2. Perfil Biológico</h3>
          <p class="text-xs text-gray-500 mb-2">Biomarcadores / Mutaciones / Inmunohistoquímica detectada:</p>
          <ul class="list-disc pl-5 text-sm text-gray-700">
            <li>[Ej: HER2, PD-L1, BRAF, etc.]</li>
          </ul>
        </div>

        <div class="bg-red-50 p-4 rounded-lg border border-red-100">
          <h3 class="text-xs font-black text-red-800 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span>⚠️ Control de Calidad de Historia Clínica</span>
          </h3>
          <p class="text-xs text-red-600 mb-2">Se han detectado los siguientes vacíos de información que impiden una toma de decisión segura:</p>
          <ul class="space-y-1 text-sm text-red-700 font-medium">
            <li>[Dato faltante 1]</li>
            <li>[Dato faltante 2]</li>
          </ul>
        </div>

        <div class="text-[10px] text-gray-400 text-center pt-2">
          Reporte generado por algoritmo de auditoría. Verifica la completitud del registro médico.
        </div>

      </div>
    `;

    const parts: any[] = [{ text: auditPrompt }];

    // Inyección de archivos adjuntos (Solo si existen)
    if (files && Array.isArray(files)) {
      files.slice(0, 5).forEach(f => {
        if (f.data && f.type) {
          parts.push({ inlineData: { mimeType: f.type, data: f.data } });
        }
      });
    }

    // Llamada al modelo (Usando 1.5 Flash para velocidad en tareas de extracción)
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts }
    });

    const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
    return raw.replace(/```html|```/g, '').trim();

  } catch (e: any) {
    console.error("Audit Error:", e);
    return `<div class="p-4 bg-gray-100 text-gray-500 text-xs">No se pudo realizar la auditoría: ${e.message}</div>`;
  }
};
