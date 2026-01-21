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
ACTUÁ COMO:
Extractor y auditor de registros clínicos oncológicos.

OBJETIVO:
Organizar la información clínica existente, detectar datos faltantes y señalar inconsistencias documentales.
NO realizar interpretación clínica ni sugerir decisiones.

REGLAS DE SEGURIDAD (CERO TOLERANCIA):
1. NO emitas opiniones clínicas ni sugerencias terapéuticas.
2. NO infieras datos no escritos.
3. Si un dato no está explícito, usar "NO DOCUMENTADO".
4. NO usar Markdown. SOLO HTML limpio con clases Tailwind.

ENTRADA DE DATOS:
- Notas clínicas: "${text}"
- Archivos adjuntos: analizar solo su contenido explícito.

TAREAS A REALIZAR:

1) EXTRAER DATOS CLÍNICOS ESTRUCTURADOS:
- Edad
- Sexo
- Diagnóstico principal exacto
- Fecha de diagnóstico
- Hallazgos patológicos
- Biomarcadores
- Estadio TNM/FIGO
- Performance Status (ECOG/WHO)
- Estudios de extensión con fechas
- Tratamientos previos con fechas

2) GENERAR CHECKLIST DE COMPLETITUD:
Para cada ítem, marcar ✔ si existe o ⚠ si falta:
- Estadio completo
- Performance status
- Informe de biopsia
- Biomarcadores
- Imágenes relevantes (TAC, PET, RM)
- Tratamientos previos documentados

3) DETECTAR INCONSISTENCIAS DOCUMENTALES:
Ejemplos:
- Fecha de diagnóstico posterior a estudios
- Estadio que no concuerda con patología
Presentar como:
- “Inconsistencias encontradas” o
- “Sin inconsistencias detectadas”

FORMATO DE SALIDA OBLIGATORIO (HTML):

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
          <div class="text-sm text-gray-700 space-y-1">
  <div>• HER2</div>
  <div>• PD-L1</div>
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
        
<div class="mt-4 p-3 bg-amber-50 border border-amber-200 text-[10px] text-amber-800 rounded-lg">
  Este reporte organiza información documentada. 
  No constituye recomendación clínica ni reemplaza la revisión médica profesional.
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
