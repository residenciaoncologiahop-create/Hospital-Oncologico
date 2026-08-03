import { callGemini } from './aiProxy';
import { findNCCNGuideline } from './nccnGuidelines';

interface FileData { name: string; type: string; data: string; }
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }
interface ClinicalEvent { date: string; professional: string; category: string; note: string; isKey: boolean; }

// --- CONFIGURACIÓN ---

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
    try {
        const parts: any[] = [{ text: `CONTEXTO DEL CASO:\n${context}` }];
        
        if (files && Array.isArray(files)) {
            files.slice(0, 3).forEach(f => {
                if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
            });
        }
        
        msgs.slice(-5).forEach(m => parts.push({ text: `${m.role}: ${m.text}` }));
        parts.push({ text: newMsg });
        
        const res = await callGemini({ parts });
        return res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "Error.";
    } catch (e: any) {
        return "Error: " + e.message;
    }
};

export const extractResidentTimeline = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && (!files || files.length === 0)) return [];
    
    try {
        const parts: any[] = [{ text: `
            Eres un oncólogo experto. Extrae los eventos clínicos del paciente sin duplicados.
            
            REGLAS:
            1. ❌ NO DUPLICAR eventos para la misma fecha o el mismo acontecimiento.
            2. HITOS ONCOLÓGICOS CLAVE (isKey = true): Biopsia/Diagnóstico, Inmunohistoquímica, Estadio TNM, Cirugías oncológicas, inicio/cambio de Quimioterapia/Inmunoterapia/RT, progresión/respuesta. "note" DEBE SER MUY DETALLADO (fechas, esquema, dosis, estadios, marcadores).
            3. EVENTOS SECUNDARIOS (isKey = false): Controles o laboratorios estables. "note" DEBE SER CONCISO (1 oración corta, máx 100 caracteres).
            
            Format JSON array:
            [
              { "date": "DD/MM/YYYY", "professional": "Especialidad", "category": "Consulta|Imagen|Lab|Cirugía|Quimio|Radio|Evolución", "note": "resumen", "isKey": true/false, "detail": "detalle opcional" }
            ]
        `}];
        
        if (text) parts.push({ text: `Notas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await callGemini({ parts });

        if (res.text) {
            const txt = typeof res.text === 'function' ? res.text() : res.text;
            const clean = txt.replace(/```json|```/g, '').trim();
            const events = JSON.parse(clean);
            return events.sort((a: any, b: any) => parseDate(a.date) - parseDate(b.date));
        }
        return [];
    } catch {
        return [];
    }
};

// --- GENERADORES CON FORMATO "AUDITORÍA" UNIFICADO ---

// 1. RESUMEN CLÍNICO
export const generateResidentClinicalSummary = async (text: string, files: FileData[]) => {
    try {
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

        const res = await callGemini({ parts });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};

// 2. PLAN DE SEGUIMIENTO Y VIGILANCIA CLÍNICA ACCIONABLE
export const generateFollowUpPlan = async (text: string, files: FileData[]) => {
    try {
        const guideline = findNCCNGuideline(text);
        const today = new Date().toLocaleDateString('es-AR');

        let guidelineContext = '';
        if (guideline) {
            guidelineContext = `
=== GUÍA NCCN DE REFERENCIA OBLIGATORIA ===
Patología: ${guideline.pathology}
Fuente: ${guideline.source}
Cronograma: ${guideline.schedule}
Imágenes: ${guideline.imaging}
Laboratorio/Marcadores: ${guideline.labs}
==========================================`;
        }

        const prompt = `
            ACTÚA COMO: Oncólogo Clínico experto elaborando un PLAN DE VIGILANCIA CLÍNICA, CONCRETO Y ACCIONABLE según guías NCCN vigentes.
            HOY ES: ${today}.

            ${guidelineContext}

            OBJETIVO PRINCIPAL:
            Construir un plan de vigilancia clínico, concreto y accionable para la toma de decisiones asistenciales durante la consulta.
            Responde principalmente a la pregunta: "¿Qué estudios necesita este paciente, cuándo corresponden y con qué frecuencia deben realizarse según NCCN?".

            REGLA DE RAZONAMIENTO PREVIO (Resumir explícitamente al inicio):
            Identificar automáticamente a partir de la historia y línea de tiempo:
            - Diagnóstico principal y subtipo histológico / inmunohistoquímica.
            - Sitio primario y estadio TNM actual.
            - Estado de la enfermedad (Libre de enfermedad / NED, Respuesta Completa, Respuesta Parcial, Enfermedad Estable, Progresión, etc.).
            - Tratamiento recibido y tratamiento activo actual.
            - Tiempo transcurrido desde cirugía o finalización de tratamiento curativo.
            - Fecha de última consulta, última TC/RMN/PET y últimos laboratorios/marcadores.
            - Situaciones especiales (Port-a-cath, ostomías, hormonoterapia prolongada, etc.).
            * Si algún dato no puede determinarse con certeza, indícalo explícitamente como "Dato no documentado (requiere confirmación)".

            CONSTRUCCIÓN DEL PLAN DE VIGILANCIA (TABLA ESTRUCTURADA):
            Genera una TABLA ESTRUCTURADA con las siguientes columnas exactas:
            1. Estudio / Control
            2. Última Fecha Documentada
            3. Próxima Fecha Sugerida (CÁLCULO INTELIGENTE de fecha exacta o mes/año usando la cronología y fecha de hoy ${today})
            4. Frecuencia Posterior (según ventana de tiempo 0-2 años, 3-5 años o >5 años)
            5. Motivo Clínico y Fundamento NCCN (breve explicación de 1 frase del por qué)

            ESTUDIOS A INCLUIR (solamente los indicados por NCCN para el tumor y escenario específico):
            - Consulta Oncológica
            - TC de Tórax / Abdomen / Pelvis
            - RMN (ej: SNC o Pelvis si corresponde)
            - Laboratorio Clínico General (función renal/hepática/hemograma)
            - Marcadores Tumorales (ej: CEA, CA 19-9, CA 125, PSA, etc. ÚNICAMENTE si indicados por NCCN)
            - Estudios endoscópicos / mamografía / ecografía (según patología)

            REGLAS ESTRICTAS DE CÁLCULO Y ADAPTACIÓN:
            1. CÁLCULO INTELIGENTE DE FECHAS: Si la cirugía fue 15/04/2025 y corresponde TC cada 6 meses, y la última fue 12/02/2026, calcula la fecha o mes de la próxima TC ("Agosto 2026 - Corresponde realizar"). Utiliza la fecha actual (${today}) como referencia.
            2. ADAPTACIÓN POR TIEMPO DE SEGUIMIENTO:
               - 0–2 años: Controles más frecuentes.
               - 3–5 años: Reducir frecuencia.
               - >5 años: Seguimiento anual cuando corresponda.
            3. ADAPTACIÓN SEGÚN ESCENARIO CLÍNICO: Diferenciar si es seguimiento curativo post-tratamiento, enfermedad metastásica en tratamiento activo, enfermedad estable, watch & wait o cuidados paliativos.
            4. PRIORIZAR LO ÚTIL: NO solicitar PET/TC o marcadores innecesarios si las guías NCCN no los indican de rutina para ese tumor y situación.

            FORMATO DE SALIDA:
            Devuelve ÚNICAMENTE HTML puro en un <div> contenedor con estilos Tailwind CSS. Sin bloques markdown \`\`\`html.

            ESTRUCTURA HTML DE SALIDA:
            <div class="space-y-5 font-sans text-gray-800 text-xs">
                <!-- Alertas de datos faltantes (si aplica) -->

                <!-- Resumen de Razonamiento Clínico -->
                <div class="bg-blue-50/70 p-4 rounded-xl border border-blue-100">
                    <h3 class="text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Perfil y Escenario Clínico del Paciente</h3>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                        <div><span class="font-bold text-blue-700">Diagnóstico:</span> [Diagnóstico]</div>
                        <div><span class="font-bold text-blue-700">Estadio:</span> [Estadio]</div>
                        <div><span class="font-bold text-blue-700">Estado Actual:</span> [NED / Activa / PR / EP]</div>
                        <div><span class="font-bold text-blue-700">Tratamiento Activo:</span> [Fármaco / Ninguno]</div>
                        <div><span class="font-bold text-blue-700">Tiempo de Seguimiento:</span> [Meses / Años]</div>
                        <div><span class="font-bold text-blue-700">Escenario:</span> [Curativo / Avanzado]</div>
                    </div>
                </div>

                <!-- Tabla del Plan de Vigilancia -->
                <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="text-xs font-black text-gray-700 uppercase tracking-widest">Cronograma de Vigilancia Oncológica (NCCN)</h3>
                        <span class="text-[10px] text-gray-400 font-bold">Hoy: ${today}</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-gray-100/70 text-gray-500 uppercase text-[9px] font-black tracking-wider border-b">
                                <tr>
                                    <th class="py-2.5 px-3">Estudio / Control</th>
                                    <th class="py-2.5 px-3">Último Realizado</th>
                                    <th class="py-2.5 px-3">Próxima Fecha Sugerida</th>
                                    <th class="py-2.5 px-3">Frecuencia Posterior</th>
                                    <th class="py-2.5 px-3">Motivo y Fundamento NCCN</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ...
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Pautas de Alarma y Consideraciones Especiales -->
                <div class="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
                    <h4 class="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Pautas de Alarma & Consideraciones Especiales</h4>
                    <p class="text-amber-900 text-[11px] leading-relaxed">...</p>
                </div>
            </div>

            HISTORIA CLÍNICA Y EVENTOS DEL PACIENTE:
            "${text}"
        `;

        const parts: any[] = [{ text: prompt }];
        if (files) files.slice(0, 5).forEach(f => { if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } }) });

        const res = await callGemini({ parts });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};

// 3. ATENEO / COMITÉ DE TUMORES
export const generateTumorBoardAnalysis = async (text: string, files: FileData[]) => {
    try {
        const prompt = `
            ACTÚA COMO: Secretario de Comité de Tumores.
            TAREA: Redactar Presentación de Caso para Discusión.
            
            ${AUDIT_STYLE_INSTRUCTIONS}

            ESTRUCTURA HTML REQUERIDA (SIN NUMERALES EN TÍTULOS):

            <div class="space-y-4 font-sans text-gray-800 text-sm">
                
                <div class="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Presentación del Caso</h3>
                    <p class="mb-2 leading-relaxed text-gray-700">
                        Paciente de [Edad/Sexo] con [Diagnóstico]. El motivo de presentation al comité es <strong class="font-bold text-gray-900">[Motivo de discusión]</strong>.
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

        const res = await callGemini({ parts });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};

// 4. AUDITORÍA CLÍNICA (MISMO FORMATO STRICTO)
export const generateOncologyVerification = async (text: string, files: FileData[]) => {
    try {
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

        const res = await callGemini({ parts });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```html|```/g, '').trim();

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error: ${e.message}</div>`;
    }
};
