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
        files.slice(0, 3).forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
        msgs.slice(-5).forEach(m => parts.push({ text: `${m.role}: ${m.text}` }));
        parts.push({ text: newMsg });
        
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { systemInstruction: "Eres un oncólogo docente. Responde en español." }
        });
        return res.text || "Error en respuesta.";
    } catch (e: any) {
        return "Error de conexión: " + e.message;
    }
};

export const extractResidentTimeline = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && files.length === 0) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return [];
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `
            ACTÚA COMO UN TRADUCTOR Y ANALISTA CLÍNICO EXPERTO.
            
            TAREA:
            1. Analiza los documentos y notas adjuntas.
            2. Extrae la cronología de eventos clínicos relevantes.
            
            REGLA DE ORO (IDIOMA):
            - SI EL TEXTO ORIGINAL ESTÁ EN INGLÉS, DEBES TRADUCIRLO AL ESPAÑOL PERFECTO.
            - La salida final debe estar 100% en ESPAÑOL.
            - No dejes términos médicos en inglés (ej: "Surgery" -> "Cirugía", "Chemotherapy" -> "Quimioterapia").

            FORMATO DE SALIDA (JSON ARRAY):
            [{ 
                "date": "DD/MM/YYYY", 
                "professional": "Dr/a... o Especialidad", 
                "category": "Consulta, Imagen, Lab, Cirugía, Quimio, Radio", 
                "note": "Descripción del evento en ESPAÑOL", 
                "isKey": boolean 
            }]
        `}];
        
        if (text) parts.push({ text: `Notas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });

        if (res.text) {
            const clean = res.text.replace(/```json|```/g, '').trim();
            const events = JSON.parse(clean);
            return events.sort((a: any, b: any) => parseDate(a.date) - parseDate(b.date));
        }
        return [];
    } catch (e) {
        console.error(e);
        return [];
    }
};
