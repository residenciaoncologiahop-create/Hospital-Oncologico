import { GoogleGenAI } from "@google/genai";

interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }
interface ClinicalEvent { date: string; professional: string; category: string; note: string; isKey: boolean; }

// --- CONFIGURACIÓN ---
const MODEL_NAME = 'gemini-2.5-flash';

// --- UTILS ---
const parseDate = (dateStr: string) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    return 0; 
};

// --- CONSTANTE DE ESTILO STRICTO (TIPO AUDITORÍA) ---
const AUDIT_STYLE_INSTRUCTIONS = `
  REGLAS DE FORMATO VISUAL (ESTRICTO - HTML PURO):
  1. PROHIBIDO USAR NUMERALES EN TÍTULOS (Nada de "1.", "2.", "A.", "B.").
  2. PROHIBIDO USAR MARKDOWN. NADA DE ASTERISCOS (*), NADA DE GUIONES (-).
  3. SALIDA: ÚNICAMENTE HTML VÁLIDO dentro de un div contenedor.
  4. CLASES OBLIGATORIAS (Tailwind):
     - Contenedor Principal: <div class="space-y-4 font-sans text-gray-800 text-sm">
     - Cada Tarjeta/Sección: <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
     - Títulos de Sección: <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">
     - Texto: <p class="mb-2 leading-relaxed text-gray-700">
     - Negritas: <strong class="font-bold text-gray-900">
  5. ESTILO DE REDACCIÓN:
     - Narrativo, fluido, clínico, institucional.
     - NO hagas listas verticales. Escribe en párrafos completos.
`;

// --- FUNCIONES DE UTILIDAD (CHAT Y TIMELINE) ---

export const getResidentChatResponse = async (msgs: ChatMessage[], newMsg: string, context: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "Error: API Key faltante";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `CONTEXTO DEL CASO:\n${context}` }];
        
        if (files && Array.isArray(files)) {
            files.slice(0, 3).forEach(f => {
                if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
            });
        }
        
        msgs.slice(-5).forEach(m => parts.push({ text: `${m.role}: ${m.text}` }));
        parts.push({ text: newMsg });
        
        const res = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts },
            config: { systemInstruction: "Eres un oncólogo docente. Responde en texto plano breve." }
        });
        return res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "Error.";
    } catch (e: any) {
        return "Error: " + e.message;
    }
};

export const extractResidentTimeline = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && (!files || files.length === 0)) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return [];
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `
            Extrae eventos clínicos clave (Fecha, Profesional, Categoría, Nota).
            Salida JSON array.
        `}];
        
        if (text) parts.push({ text: `Notas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });

        if (res.text) {
            const txt = typeof res.text === 'function' ? res.text() : res.text;
            const clean = txt.replace(/```json|```/g, '').trim();
            const events = JSON.parse(clean);
            return events.sort((a: any, b: any) => parseDate(a.date) - parseDate(b.date));
        }
        return [];
    } catch (e) {
        return [];
    }
};

// --- GENERADORES CON FORMATO "AUDITORÍA" UNIFICADO ---

// 1. RESUMEN CLÍNICO
export const generateResidentClinicalSummary = async (text: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key faltante");

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `
            ACTÚA COMO: Jefe de Residentes de Oncología.
            TAREA: Redactar un Resumen Clínico Institucional.
            
            ${AUDIT_STYLE_INSTRUCTIONS}

            ESTRUCTURA HTML REQUERIDA (SIN NUMERALES EN TÍTULOS):
            
            <div class="space-y-4 font-sans text-gray-800 text-sm">
                
                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Identificación y Diagnóstico</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        Se presenta el caso de un paciente de [Edad/Sexo] con diagnóstico principal de <strong class="font-bold text-gray-900">[Diagnóstico completo con estadio y fecha]</strong>.
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Antecedentes y Perfil Biológico</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        Como antecedentes de relevancia se destaca [Comorbilidades]. Desde el punto de vista molecular/histológico, el tumor presenta <strong class="font-bold text-gray-900">[Biomarcadores/Histología]</strong>.
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Evolución Oncológica</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        [Narrativa cronológica fluida de los tratamientos recibidos, cirugías y respuestas obtenidas, sin usar listas].
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Situación Actual</h3>
                    <p class="mb-0 leading-relaxed text-gray-700">
                        Actualmente el paciente se encuentra con enfermedad <strong class="font-bold text-gray-900">[Estable/Progresión/Remisión]</strong> y un performance status de [ECOG].
                    </p>
                </div>

            </div>

            ENTRADA: "${text}"
        `;

        const parts: any[] = [{ text: prompt }];
        if (files) files.slice(0, 5).forEach(f => { if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } }) });

        const res = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts } });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};

// 2. PLAN DE SEGUIMIENTO
export const generateFollowUpPlan = async (text: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key faltante");

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            ACTÚA COMO: Oncólogo Clínico.
            TAREA: Redactar Plan de Seguimiento (NCCN/ESMO).
            
            ${AUDIT_STYLE_INSTRUCTIONS}

            ESTRUCTURA HTML REQUERIDA (SIN NUMERALES EN TÍTULOS):

            <div class="space-y-4 font-sans text-gray-800 text-sm">
                
                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Objetivo Terapéutico</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        El seguimiento se orienta con intención <strong class="font-bold text-gray-900">[Curativa/Paliativa/Control]</strong>, priorizando [Calidad de vida / Detección temprana].
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Cronograma de Controles</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        Se sugiere control clínico con frecuencia de <strong class="font-bold text-gray-900">[Frecuencia]</strong> durante [Tiempo].
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Solicitud de Estudios</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        Respecto a imágenes, se solicita <strong class="font-bold text-gray-900">[Tipo de estudio]</strong> con una periodicidad de [Tiempo]. En laboratorio monitorear [Marcadores/Función].
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Pautas de Alarma</h3>
                    <p class="mb-0 leading-relaxed text-gray-700">
                        Instruir al paciente a consultar inmediatamente ante la aparición de [Síntomas específicos de recaída o toxicidad].
                    </p>
                </div>

            </div>

            ENTRADA: "${text}"
        `;

        const parts: any[] = [{ text: prompt }];
        if (files) files.slice(0, 5).forEach(f => { if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } }) });

        const res = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts } });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};

// 3. ATENEO / COMITÉ DE TUMORES
export const generateTumorBoardAnalysis = async (text: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key faltante");

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            ACTÚA COMO: Secretario de Comité de Tumores.
            TAREA: Redactar Presentación de Caso para Discusión.
            
            ${AUDIT_STYLE_INSTRUCTIONS}

            ESTRUCTURA HTML REQUERIDA (SIN NUMERALES EN TÍTULOS):

            <div class="space-y-4 font-sans text-gray-800 text-sm">
                
                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Presentación del Caso</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        Paciente de [Edad/Sexo] con [Diagnóstico]. El motivo de presentación al comité es <strong class="font-bold text-gray-900">[Motivo de discusión]</strong>.
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Interrogante Clínico</h3>
                    <p class="mb-2 leading-relaxed text-gray-900 font-medium">
                        ¿Cuál es la conducta terapéutica óptima en este escenario: [Opción A] vs [Opción B]?
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Balance de Decisión</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        <strong class="font-bold text-gray-900">A favor de intervención:</strong> [Argumentos clínicos].
                    </p>
                    <p class="mb-0 leading-relaxed text-gray-700">
                        <strong class="font-bold text-gray-900">Factores limitantes:</strong> [Comorbilidades, toxicidad, riesgos].
                    </p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Evidencia de Soporte</h3>
                    <p class="mb-0 leading-relaxed text-gray-700">
                        Se basa la discusión en los resultados del estudio <strong class="font-bold text-gray-900">[Nombre Trial]</strong> y las guías [NCCN/ESMO].
                    </p>
                </div>

            </div>

            ENTRADA: "${text}"
        `;

        const parts: any[] = [{ text: prompt }];
        if (files) files.slice(0, 5).forEach(f => { if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } }) });

        const res = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts } });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};

// 4. AUDITORÍA CLÍNICA (MISMO FORMATO STRICTO)
export const generateOncologyVerification = async (text: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key faltante");

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `
            ACTÚA COMO: Auditor Clínico.
            TAREA: Auditoría de Completitud.
            
            ${AUDIT_STYLE_INSTRUCTIONS}
            
            ESTRUCTURA HTML REQUERIDA (SIN NUMERALES EN TÍTULOS):
            
            <div class="space-y-4 font-sans text-gray-800 text-sm">
                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Resumen Estructurado</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">Paciente: [Edad/Sexo]. Diagnóstico: [Dx]. Estadio: [TNM].</p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Variables Detectadas</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">[Variable 1], [Variable 2], [Variable 3].</p>
                </div>

                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Datos Faltantes (Control)</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        ⚠️ Se detecta ausencia de: [Dato faltante 1], [Dato faltante 2].
                    </p>
                </div>
            </div>

            ENTRADA: "${text}"
        `;

        const parts: any[] = [{ text: prompt }];
        if (files) files.slice(0, 5).forEach(f => { if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } }) });

        const res = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts } });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};
