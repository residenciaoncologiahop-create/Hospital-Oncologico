import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";
import { getApp } from "firebase/app";

// Tipos
interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string }; }
interface CallGeminiParams { prompt?: string; parts?: GeminiPart[]; systemInstruction?: string; responseMimeType?: string; }
interface CallGeminiResult { text: string; }
interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }

export const callGemini = async (params: CallGeminiParams): Promise<CallGeminiResult> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado. Inicie sesión para continuar.");

  const functions = getFunctions(getApp(), 'us-central1');
  
  // ⏳ SOLUCIÓN TIMEOUT: Le decimos al navegador que espere hasta 5 minutos (300000 ms)
  const callGeminiFn = httpsCallable<CallGeminiParams, CallGeminiResult>(
    functions, 
    "callGemini",
    { timeout: 300000 } 
  );
  
  const result = await callGeminiFn(params);
  return result.data;
};

// ──────────────────────────────────────────────
// LIMPIADOR DE ARCHIVOS (Evita el colapso del servidor)
// ──────────────────────────────────────────────
const buildParts = (text: string | undefined, files: FileData[]): GeminiPart[] => {
  const parts: GeminiPart[] = [];
  if (text) parts.push({ text });

  files.slice(0, 3).forEach(f => {
    if (f.data && f.type) {
      // LIMPIEZA VITAL: Cortamos la "basura" del string para que la IA y Firebase lo acepten
      let cleanData = f.data;
      if (cleanData.includes("base64,")) {
        cleanData = cleanData.split("base64,")[1];
      }
      parts.push({ inlineData: { mimeType: f.type, data: cleanData } });
    }
  });

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

// ──────────────────────────────────────────────
// LÍNEA DE TIEMPO REFORMULADA Y RESUMIDA
// ──────────────────────────────────────────────
export const extractTimelineSecure = async (text: string, files: FileData[]): Promise<any[]> => {
  if (!text && files.length === 0) return [];
  
  const instructionText = `
    Analiza los documentos y extrae la cronología clínica de manera ordenada.
    
    REGLAS DE PRIVACIDAD: NO incluyas DNI ni nombres reales.
    REGLAS DE FORMATO: Fechas siempre en formato DD/MM/YYYY.
    
    REGLAS DE REDACCIÓN (CRÍTICAS Y OBLIGATORIAS):
    1. ¡PROHIBIDO TRANSCRIBIR LITERAMENTE LAS EVOLUCIONES MÉDICAS! Para las notas de evolución o consultas, debes REFORMULAR, interpretar y RESUMIR lo sucedido usando tus propias palabras con un lenguaje médico fluido, técnico y conciso.
    2. Los resultados de estudios complementarios (laboratorios, biopsias, tomografías) SÍ deben transcribirse de manera exacta y objetiva sin inventar datos.
    
    SALIDA ESTRICTA: ÚNICAMENTE UN ARRAY JSON CON ESTA ESTRUCTURA EXACTA:
    [
      {
        "date": "DD/MM/YYYY",
        "professional": "Nombre del médico o Institución",
        "category": "Consulta, Imagen, Lab, Cirugía, Quimio, Radio o Evolución",
        "note": "Texto reformulado y resumido del evento",
        "isKey": false
      }
    ]
  `;
  
  const combinedText = text ? `${instructionText}\n\nNotas clínicas: ${text}` : instructionText;
  const parts = buildParts(combinedText, files);
  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('['); const end = clean.lastIndexOf(']');
    return JSON.parse(start !== -1 ? clean.substring(start, end + 1) : clean);
  } catch { return []; }
};

// ──────────────────────────────────────────────
// EXTRACCIÓN DE LABORATORIOS (NORMALIZADA)
// ──────────────────────────────────────────────
export const extractLabsSecure = async (text: string, files: FileData[]): Promise<any[]> => {
  if (!text && files.length === 0) return [];
  
  const instructionText = `
    Extrae todos los resultados de laboratorio clínico y marcadores tumorales.
    SALIDA ESTRICTA: ÚNICAMENTE UN ARRAY JSON CON ESTA ESTRUCTURA: 
    [{"date": "DD/MM/YYYY", "test": "Nombre Original", "value": number, "unit": "unidad"}]
  `;
  
  const combinedText = text ? `${instructionText}\n\nNotas clínicas: ${text}` : instructionText;
  const parts = buildParts(combinedText, files);
  const res = await callGemini({ parts, responseMimeType: "application/json" });

  try {
    const clean = res.text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('['); 
    const end = clean.lastIndexOf(']');
    const raw = JSON.parse(start !== -1 ? clean.substring(start, end + 1) : clean);
    
    // 🛡️ DICCIONARIO DE BLINDAJE (Código duro para forzar la unificación)
    const normalizeName = (name: string) => {
      if (!name) return "Desconocido";
      const lower = name.toLowerCase().trim();
      
      const dict: Record<string, string> = {
        'hb': 'Hemoglobina', 'hgb': 'Hemoglobina', 'hemoglobina': 'Hemoglobina',
        'hto': 'Hematocrito', 'hct': 'Hematocrito', 'hematocrito': 'Hematocrito',
        'gb': 'Glóbulos Blancos', 'leucos': 'Glóbulos Blancos', 'leucocitos': 'Glóbulos Blancos', 'gl blancos': 'Glóbulos Blancos', 'globulos blancos': 'Glóbulos Blancos', 'glóbulos blancos': 'Glóbulos Blancos',
        'ns': 'Neutrófilos', 'neutro': 'Neutrófilos', 'neutrofilos': 'Neutrófilos', 'neutrófilos': 'Neutrófilos', 'segmentados': 'Neutrófilos',
        'plaq': 'Plaquetas', 'pq': 'Plaquetas', 'pqt': 'Plaquetas', 'plaquetas': 'Plaquetas',
        'cr': 'Creatinina', 'creat': 'Creatinina', 'crea': 'Creatinina', 'creatinina': 'Creatinina',
        'urea': 'Urea', 'uremia': 'Urea',
        'glu': 'Glucemia', 'glucosa': 'Glucemia', 'glucemia': 'Glucemia',
        'ast': 'TGO', 'got': 'TGO', 'tgo': 'TGO',
        'alt': 'TGP', 'gpt': 'TGP', 'tgp': 'TGP',
        'fal': 'FAL', 'fosfatasa alcalina': 'FAL',
        'bt': 'Bilirrubina Total', 'bilirrubina': 'Bilirrubina Total',
        'na': 'Sodio', 'sodio': 'Sodio', 'natremia': 'Sodio',
        'k': 'Potasio', 'potasio': 'Potasio', 'kalemia': 'Potasio',
        'ca': 'Calcio', 'calcio': 'Calcio', 'calcemia': 'Calcio',
        'mg': 'Magnesio', 'magnesio': 'Magnesio', 'magnesemia': 'Magnesio',
        'ldh': 'LDH', 'lactato deshidrogenasa': 'LDH',
        'cea': 'CEA', 'antigeno carcinoembrionario': 'CEA', 'ag carcinoembrionario': 'CEA', 'antígeno carcinoembrionario': 'CEA',
        'ca 125': 'CA 125', 'ca-125': 'CA 125', 'ca125': 'CA 125',
        'ca 15-3': 'CA 15-3', 'ca-15-3': 'CA 15-3', 'ca153': 'CA 15-3', 'ca 15.3': 'CA 15-3', 'ca 15 3': 'CA 15-3',
        'ca 19-9': 'CA 19-9', 'ca-19-9': 'CA 19-9', 'ca199': 'CA 19-9', 'ca 19.9': 'CA 19-9', 'ca 19 9': 'CA 19-9',
        'psa': 'PSA Total', 'psa total': 'PSA Total', 'antigeno prostatico': 'PSA Total', 'antígeno prostático': 'PSA Total',
        'psa libre': 'PSA Libre',
        'afp': 'AFP', 'alfafetoproteina': 'AFP', 'alfa-fetoproteina': 'AFP',
        'b-hcg': 'Beta-hCG', 'bhcg': 'Beta-hCG', 'hcg': 'Beta-hCG', 'subunidad beta': 'Beta-hCG', 'gonadotropina corionica': 'Beta-hCG', 'beta-hcg': 'Beta-hCG',
        'tg': 'Tiroglobulina', 'tiroglobulina': 'Tiroglobulina',
        'calcitonina': 'Calcitonina',
        'b2m': 'Beta-2 Microglobulina', 'b2-microglobulina': 'Beta-2 Microglobulina', 'beta 2 microglobulina': 'Beta-2 Microglobulina',
        'cga': 'Cromogranina A', 'cromogranina': 'Cromogranina A', 'cromogranina a': 'Cromogranina A',
        'he4': 'HE4', 'proteina epididimal humana 4': 'HE4'
      };
      
      // Si encontramos una coincidencia exacta en el diccionario, la usamos
      if (dict[lower]) return dict[lower];
      
      // Búsqueda parcial (por si la IA pone "nivel de hb" o algo similar)
      for (const [key, value] of Object.entries(dict)) {
        if (lower.includes(key) && key.length > 2) return value; // > 2 para no cruzar "ca" (calcio) con otras palabras
      }
      
      // Si no coincide, devolvemos la primera en mayúscula para que quede prolijo
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    // Mapeamos y unificamos los resultados antes de devolverlos
    return raw
      .filter((l: any) => l.value !== null && l.value !== undefined && !isNaN(parseFloat(l.value)))
      .map((l: any) => ({
         ...l,
         test: normalizeName(l.test) // <-- Aquí ocurre la magia de la unificación
      }));
      
  } catch { 
    return []; 
  }
};

// ──────────────────────────────────────────────
// AUDITORÍA CLÍNICA (TU DISEÑO FAVORITO)
// ──────────────────────────────────────────────
export const generateClinicalAuditSecure = async (text: string, files: FileData[]): Promise<string> => {
  
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
