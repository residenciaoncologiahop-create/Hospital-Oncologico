import { GoogleGenAI } from "@google/genai";

interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }
interface ClinicalEvent { date: string; professional: string; category: string; note: string; isKey: boolean; }

const parseDate = (dateStr: string) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    return 0; 
};

export const getResidentChatResponse = async (msgs: ChatMessage[], newMsg: string, context: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "Error: API Key faltante";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `CONTEXTO DEL CASO (Modo Residente):\n${context}` }];
        
        if (files && Array.isArray(files)) {
            files.slice(0, 3).forEach(f => {
                if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
            });
        }
        
        msgs.slice(-5).forEach(m => parts.push({ text: `${m.role}: ${m.text}` }));
        parts.push({ text: newMsg });
        
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { systemInstruction: "Eres un oncólogo docente. Responde SIEMPRE en ESPAÑOL. Sé breve y educativo." }
        });
        return res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "Error en respuesta.";
    } catch (e: any) {
        return "Error de conexión: " + e.message;
    }
};

export const extractResidentTimeline = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && (!files || files.length === 0)) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return [];
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `
            ACTÚA COMO UN TRADUCTOR Y ANALISTA CLÍNICO EXPERTO.
            TAREA: Analiza documentos y notas. Extrae cronología.
            REGLA DE IDIOMA: SALIDA 100% EN ESPAÑOL. Traduce términos si es necesario.
            FORMATO JSON: [{ "date": "DD/MM/YYYY", "professional": "...", "category": "...", "note": "...", "isKey": boolean }]
        `}];
        
        if (text) parts.push({ text: `Notas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
        console.error(e);
        return [];
    }
};

// --- NUEVA FUNCIÓN: GENERAR RESUMEN ---
export const generateResidentClinicalSummary = async (text: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key faltante");

    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `
            ACTÚA COMO UN ONCÓLOGO EXPERTO.
            Genera un RESUMEN DE HISTORIA CLÍNICA completo, cronológico y profesional basado en las notas y archivos proporcionados.

            ESTRUCTURA OBLIGATORIA DEL RESUMEN:
            1. 🆔 IDENTIFICACIÓN Y MOTIVO: Datos básicos y por qué consulta hoy.
            2. 📜 ANTECEDENTES ONCOLÓGICOS:
               - Fecha de diagnóstico inicial y estadificación (TNM).
               - Histología y Biología Molecular (Receptores, mutaciones).
               - Tratamientos previos realizados (Cirugías, QT, RT, Inmunoterapia) con fechas aproximadas.
            3. 🏥 ENFERMEDAD ACTUAL / EVOLUCIÓN: Estado actual, síntomas, respuesta a últimos tratamientos.
            4. 🔎 ESTUDIOS COMPLEMENTARIOS RECIENTES: Resumen de hallazgos en imágenes (TC, PET, RM) y laboratorios relevantes.
            5. 📝 PENDIENTES / PLAN SUGERIDO: Próximos pasos lógicos basados en la evidencia.

            REGLAS:
            - Usa lenguaje médico técnico preciso en ESPAÑOL.
            - Sé conciso pero exhaustivo con los datos duros (fechas, dosis, tamaños).
            - Si falta información crítica, indícalo entre paréntesis (Ej: "Biomarcadores: No constan en archivos").
        `}];

        if (text) parts.push({ text: `Notas manuales: ${text}` });
        
        // Adjuntamos archivos (PDFs/Imágenes)
        if (files && Array.isArray(files)) {
            files.slice(0, 5).forEach(f => {
                 if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
            });
        }

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts }
        });

        return res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "No se pudo generar el resumen.";
    } catch (e: any) {
        return "Error al generar resumen: " + e.message;
    }
};
