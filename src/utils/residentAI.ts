import { callGemini, CLINICAL_CHAT_SYSTEM_INSTRUCTION, buildParts, parseJsonArraySafely } from './aiProxy';
import { 
    validateCandidateSources
} from './nccnGuidelines';

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
        const historyText = msgs.slice(-10).map(m => `${m.role === 'user' ? 'MÉDICO' : 'ASISTENTE ONCOLÓGICO'}: ${m.text}`).join('\n\n');
        const contextBlock = `ANTECEDENTES Y REGISTROS CLÍNICOS DEL PACIENTE:\n${context}\n\nCONVERSACIÓN CLÍNICA EN CURSO:\n${historyText}`;
        const parts: any[] = buildParts(contextBlock, (files && Array.isArray(files)) ? files.slice(0, 3) : []);
        parts.push({ text: `CONSULTA DEL MÉDICO:\n${newMsg}` });
        
        const res = await callGemini({ 
            parts,
            systemInstruction: CLINICAL_CHAT_SYSTEM_INSTRUCTION 
        });
        const text = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return text ? text.replace(/\[(?:Dato Documentado|Dato Estructurado|Dato no estructurado|Inferencia|Hipótesis|Dato Clínico)\]:\s*/gi, '').trim() : "Error.";
    } catch (e: any) {
        return "Error: " + e.message;
    }
};

export const extractResidentTimeline = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && (!files || files.length === 0)) return [];
    
    try {
        const parts: any[] = [{ text: `
            Eres un oncólogo experto. Extrae todos los eventos clínicos del paciente cronológicamente.
            
            REGLAS:
            1. ❌ Extrae TODOS los eventos documentados a lo largo de toda la historia clínica.
            2. Si en la misma fecha ocurren sucesos de distinta naturaleza, registra cada uno en su categoría sin omitir ninguno.
            3. HITOS ONCOLÓGICOS CLAVE (isKey = true): Biopsia/Diagnóstico, Inmunohistoquímica, Estadio TNM, Cirugías oncológicas, inicio/cambio de Quimioterapia/Inmunoterapia/RT, progresión/respuesta. "note" DEBE SER MUY DETALLADO (fechas, esquema, dosis, estadios, marcadores).
            4. EVENTOS SECUNDARIOS (isKey = false): Controles o laboratorios estables. "note" DEBE SER CONCISO Y CLARO.
            
            Format JSON array:
            [
              { "date": "DD/MM/YYYY", "professional": "Especialidad", "category": "Consulta|Imagen|Lab|Cirugía|Quimio|Radio|Evolución", "note": "resumen", "isKey": true/false, "detail": "detalle opcional" }
            ]
        `}];
        
        if (text) parts.push({ text: `Notas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await callGemini({ parts, responseMimeType: "application/json" });

        if (res.text) {
            const txt = typeof res.text === 'function' ? res.text() : res.text;
            const events = parseJsonArraySafely(txt);
            return events.sort((a: any, b: any) => parseDate(a.date) - parseDate(b.date));
        }
        return [];
    } catch (err) {
        console.error("Error en extractResidentTimeline:", err);
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

// 2. PLAN DE SEGUIMIENTO Y VIGILANCIA CLÍNICA ACCIONABLE (CON BLOQUEO ESTRICTO DE FUENTE)
export const generateFollowUpPlan = async (
    text: string, 
    files: FileData[] = [], 
    guidelineFiles: FileData[] = [],
    explicitDiagnosis: string = ''
) => {
    try {
        const today = new Date().toLocaleDateString('es-AR');
        
        // 1. VALIDACIÓN PREVIA ESTRICTA DE FUENTES CANDIDATAS (Diagnóstico -> Guía)
        const validation = validateCandidateSources(text, guidelineFiles, explicitDiagnosis);

        // 2. SI HAY BLOQUEO DE SEGURIDAD O INFORMACIÓN INCOMPLETA / INDETERMINADA
        if (!validation.canProceed) {
            return `
            <div class="space-y-4 font-sans text-gray-800 text-xs">
                
                <!-- PERFIL DIAGNÓSTICO ESTRUCTURADO -->
                <div class="bg-blue-50/70 p-4 rounded-xl border border-blue-200 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-1.5">
                            Perfil Oncológico y Escenario Clínico
                        </h3>
                        <span class="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">Auditoría: ${today}</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px] mt-2">
                        <div><span class="font-bold text-blue-800">Tumor Primario:</span> ${validation.profile.organ}</div>
                        <div><span class="font-bold text-blue-800">Estirpe / Subtipo:</span> ${validation.profile.histology}</div>
                        <div><span class="font-bold text-blue-800">Estadio:</span> ${validation.profile.stage}</div>
                        <div><span class="font-bold text-blue-800">Escenario:</span> <span class="font-bold text-indigo-900">${validation.profile.modeLabel}</span></div>
                        <div><span class="font-bold text-blue-800">Estado de Enfermedad:</span> ${validation.profile.diseaseStatusDescription || validation.profile.diseaseStatus}</div>
                        <div><span class="font-bold text-blue-800">Tratamiento Actual:</span> ${validation.profile.activeTreatment}</div>
                    </div>
                </div>

                <!-- BLOQUEO CLÍNICO DE SEGURIDAD / ESTADO INDETERMINADO -->
                <div class="bg-red-50/90 p-5 rounded-2xl border-2 border-red-300 shadow-sm space-y-3">
                    <div class="flex items-center gap-2 text-red-900">
                        <svg class="w-5 h-5 flex-shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <h3 class="text-xs font-black uppercase tracking-wider">${validation.stopTitle || 'Bloqueo Clínico de Seguridad'}</h3>
                    </div>
                    
                    <p class="text-xs text-red-950 leading-relaxed font-medium">
                        ${validation.stopMessage}
                    </p>

                    ${validation.excludedSources && validation.excludedSources.length > 0 ? `
                    <div class="bg-white/80 p-3 rounded-xl border border-red-200 text-[11px] space-y-1.5">
                        <div class="font-black text-red-800 uppercase tracking-wide text-[10px]">Fuentes Evaluadas y Excluidas:</div>
                        <ul class="list-disc pl-4 space-y-1 text-red-900">
                            ${validation.excludedSources.map(e => `<li><strong>${e.name}</strong> (${e.detectedTarget}): ${e.reason}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}

                    <div class="p-3 bg-red-100/70 rounded-xl border border-red-200 text-[11px] text-red-900 leading-relaxed font-medium">
                        <strong>Principio de Seguridad Oncológica:</strong> El plan de seguimiento debe corresponder con exactitud al diagnóstico y al escenario clínico del paciente. No se generan cronogramas si el estado de enfermedad no puede determinarse con certeza o si la fuente no coincide.
                    </div>
                </div>

            </div>
            `.trim();
        }

        // 3. SI HAY FUENTE VÁLIDA: CONSTRUIR EL CONTEXTO Y LLAMADA SEGURA POR ESCENARIO
        let closedSourceInstruction = '';
        let guidelineContext = '';
        const validGuidelinesToPass: FileData[] = [];

        if (validation.sourceMode === 'CLOSED_SOURCE_MANUAL') {
            const attachedNames = validation.validAttachedGuidelines.map(g => g.name || 'Guía adjunta').join(', ');
            validGuidelinesToPass.push(...validation.validAttachedGuidelines);

            closedSourceInstruction = `
=== MODO DE FUENTE CERRADA ACTIVO (PRIORIDAD ABSOLUTA) ===
El usuario ha adjuntado MANUALMENTE las siguientes guías pertinentes: [${attachedNames}].
REGLAS OBLIGATORIAS:
1. Utiliza EXCLUSIVAMENTE la información contenida en estos documentos adjuntos.
2. PROHIBIDO complementar con otras guías del sistema, otras versiones, conocimiento general del modelo o información de Internet.
3. Si la guía adjuntada no contiene información para determinar una recomendación específica para el escenario (${validation.profile.modeLabel}):
   - Muestra claramente: "Esta guía no contiene información suficiente para determinar esta recomendación para este escenario."
   - NUNCA inventes ni completes silenciosamente la recomendación.
4. En el pie de fuente indica: "Fuente: Guía(s) adjuntada(s) por el usuario [${attachedNames}]".
==========================================================`;
        } else if (validation.sourceMode === 'SYSTEM_NCCN' && validation.validSystemGuideline) {
            const g = validation.validSystemGuideline;
            const scenarioRec = validation.activeScenarioRecommendations;

            guidelineContext = `
=== GUÍA NCCN DE REFERENCIA ASIGNADA (CORRESPONDENCIA EXACTA VERIFICADA) ===
Patología: ${g.pathology} (Órgano: ${g.organ})
Fuente Oficial: ${g.source} (Versión: ${g.version})
ESCENARIO ASIGNADO AL PACIENTE: ${validation.profile.modeLabel}
${scenarioRec ? `
--- RECOMENDACIONES ESPECÍFICAS PARA ESTE ESCENARIO (${scenarioRec.scenarioTitle}) ---
Intención: ${scenarioRec.intention}
Cronograma / Consultas: ${scenarioRec.schedule}
Reevaluación por Imágenes: ${scenarioRec.imaging}
Laboratorio y Marcadores: ${scenarioRec.labs}
Reglas Específicas del Escenario: ${scenarioRec.specialRules}
` : `
Intención General: ${g.intention}
Cronograma General: ${g.schedule}
Imágenes: ${g.imaging}
Laboratorio: ${g.labs}
`}
Signos de Alarma: ${g.alarmSigns}
Consideraciones Especiales: ${g.specialConsiderations}
REGLA ESTRICTA: Basa el plan EXCLUSIVAMENTE en las especificaciones aplicables al ESCENARIO ACTUAL (${validation.profile.modeLabel}).
=============================================================================`;
        }

        const prompt = `
            ACTÚA COMO: Oncólogo Clínico Especialista en Auditoría y Planificación de Seguimiento Asistencial.
            HOY ES: ${today}.

            ${closedSourceInstruction}
            ${guidelineContext}

            DATOS CLÍNICOS DEL PACIENTE:
            - Diagnóstico Primario: ${validation.profile.organ} — ${validation.profile.histology}
            - Estadio Documentado: ${validation.profile.stage}
            - Modo / Escenario Clínico: ${validation.profile.modeLabel}
            - Estado Actual de Enfermedad: ${validation.profile.diseaseStatusDescription}
            - Tratamiento Sistémico Actual: ${validation.profile.activeTreatment}
            - Intención: ${validation.profile.treatmentIntent}
            - Fecha de Último Estudio de Imagen: ${validation.profile.lastImagingDate}
            - Fecha de Último Ciclo / Tratamiento: ${validation.profile.lastTreatmentDate}

            REGLAS CLÍNICAS FUNDAMENTALES DE APLICABILIDAD POR ESCENARIO:
            
            1. REGLA FUNDAMENTAL DE FILTRADO:
               - Cada recomendación incluida en la tabla DEBE corresponder rigurosamente al escenario clínico actual (${validation.profile.modeLabel}).
               - Si el paciente presenta ENFERMEDAD METASTÁSICA ACTIVA (Modo B):
                 * El objetivo NO es "vigilancia post-resección de estadios II–III a 5 años".
                 * El objetivo es EVALUACIÓN DE RESPUESTA AL TRATAMIENTO SISTÉMICO / CONTROL TUMORAL.
                 * El estudio principal de imágenes es TAC de tórax, abdomen y pelvis con contraste cada 2 a 3 meses (cada 8–12 semanas o cada 4–6 ciclos de quimioterapia) con motivo "Evaluación de Respuesta al Tratamiento (RECIST 1.1)".
                 * Marcadores tumorales (CEA / CA 19-9) como "Monitoreo de Respuesta / Progresión Bioquímica".
                 * PROHIBIDO incluir recomendaciones exclusivas de vigilancia de estadios II–III (ej. Colonoscopía rutinaria de vigilancia de estadios II-III post-resección o TAC cada 6-12 meses de vigilancia II-III).
                 * PROHIBIDO incluir filas que digan "No aplica directamente para estadio IV". Si no aplica, DEBE QUEDAR EXCLUIDA de la tabla.
               - Si el paciente presenta VIGILANCIA POST-TRATAMIENTO CURATIVO (Modo A):
                 * Aplicar recomendaciones de vigilancia post-quirúrgica (TAC cada 6-12m en estadios II-III por 3-5 años, CEA cada 3-6m por 5 años, Colonoscopía al año).
               - Si el paciente presenta VIGILANCIA POST-METASTASECTOMÍA R0 (Modo C):
                 * Aplicar vigilancia intensiva post-resección de metástasis (TAC/RM cada 3-6m los primeros 2 años, luego cada 6-12m; CEA cada 3m por 2 años).

            2. CÁLCULO DE FECHAS PRÓXIMAS:
               - Si existe fecha de último estudio (ej: TAC del ${validation.profile.lastImagingDate}):
                 * Calcular la ventana sugerida según el intervalo recomendado (ej: intervalo 8–12 semanas $\rightarrow$ sugerir mes/ventana aproximada).
                 * No inventar fechas exactas si la guía establece un intervalo (ej: "Septiembre 2026 (a las 8–12 semanas del estudio previo)").
               - Diferenciar estado: "Próximo programado" vs "Atrasado / Pendiente" con respecto a hoy (${today}).

            3. NO RECOMENDAR ESTUDIOS INNECESARIOS:
               - No indicar PET/TC de rutina salvo sospecha fundada o indicación formal de la guía.

            FORMATO DE SALIDA (HTML PURO CON TAILWIND CSS):
            Devuelve ÚNICAMENTE HTML dentro de un contenedor <div> sin bloques de código markdown \`\`\`html.

            ESTRUCTURA VISUAL REQUERIDA:
            <div class="space-y-4 font-sans text-gray-800 text-xs">
                
                <!-- 1. PERFIL CLÍNICO Y ESCENARIO -->
                <div class="bg-blue-50/70 p-4 rounded-xl border border-blue-200 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-1.5">
                            Perfil Oncológico y Escenario Clínico Asignado
                        </h3>
                        <span class="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">Fecha de Referencia: ${today}</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px] mt-2">
                        <div><span class="font-bold text-blue-800">Tumor Primario:</span> ${validation.profile.organ}</div>
                        <div><span class="font-bold text-blue-800">Estirpe / Subtipo:</span> ${validation.profile.histology}</div>
                        <div><span class="font-bold text-blue-800">Estadio:</span> ${validation.profile.stage}</div>
                        <div><span class="font-bold text-blue-800">Escenario Clínico:</span> <span class="font-bold text-indigo-900">${validation.profile.modeLabel}</span></div>
                        <div><span class="font-bold text-blue-800">Estado de Enfermedad:</span> ${validation.profile.diseaseStatusDescription}</div>
                        <div><span class="font-bold text-blue-800">Tratamiento Actual:</span> ${validation.profile.activeTreatment}</div>
                    </div>
                </div>

                <!-- 2. TABLA DEL PLAN DE SEGUIMIENTO / EVALUACIÓN DE RESPUESTA -->
                <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="text-xs font-black text-gray-700 uppercase tracking-widest">${validation.profile.followUpMode === 'ACTIVE_METASTATIC_MONITORING' ? 'Plan de Evaluación de Respuesta y Monitoreo de Enfermedad Activa' : 'Plan de Seguimiento y Vigilancia Individualizado'}</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead class="bg-gray-100/80 text-gray-600 uppercase text-[9px] font-black tracking-wider border-b border-gray-200">
                                <tr>
                                    <th class="py-2.5 px-3">Estudio / Control</th>
                                    <th class="py-2.5 px-3">Último Realizado</th>
                                    <th class="py-2.5 px-3">Próximo Sugerido</th>
                                    <th class="py-2.5 px-3">Frecuencia / Intervalo</th>
                                    <th class="py-2.5 px-3">Objetivo Clínico</th>
                                    <th class="py-2.5 px-3">Fundamento y Fuente</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                <!-- Filas de estudios EXCLUSIVAMENTE aplicables al escenario actual -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 3. PAUTAS DE ALARMA Y CONSIDERACIONES ESPECÍFICAS -->
                <div class="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-sm">
                    <h4 class="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1.5">Signos de Alarma & Criterios de Toxicidad</h4>
                    <p class="text-amber-950 text-[11px] leading-relaxed mb-0">...</p>
                </div>

                <!-- 4. PIE DE FUENTE CLÍNICA -->
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between text-[10px] text-slate-600">
                    <div>
                        <span class="font-black text-slate-800 uppercase tracking-wider">Fuente Oficial:</span> 
                        <span class="font-medium text-slate-700 ml-1">${validation.sourceMode === 'CLOSED_SOURCE_MANUAL' ? 'Guía(s) adjuntada(s) por el usuario' : (validation.validSystemGuideline?.source || 'NCCN')} (${validation.profile.modeLabel})</span>
                    </div>
                    <div class="text-[9px] text-slate-400 font-medium mt-1 md:mt-0">
                        Criterio médico individualizado prevalece sobre guías generales.
                    </div>
                </div>

            </div>

            HISTORIA CLÍNICA Y EVENTOS DEL CASO:
            "${text}"
        `;

        const parts: any[] = [{ text: prompt }];

        // Adjuntar archivos de historia clínica
        if (files && Array.isArray(files)) {
            files.slice(0, 4).forEach(f => {
                if (f.data && f.type) {
                    parts.push({ inlineData: { mimeType: f.type, data: f.data } });
                }
            });
        }

        // Adjuntar únicamente las guías válidas verificadas (las no válidas ya fueron excluidas)
        if (validGuidelinesToPass.length > 0) {
            validGuidelinesToPass.slice(0, 4).forEach(g => {
                if (g.data && g.type) {
                    parts.push({ inlineData: { mimeType: g.type, data: g.data } });
                }
            });
        }

        const res = await callGemini({ parts });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        let cleaned = raw.replace(/```html|```/g, '').trim();

        // 4. VALIDACIÓN POSTERIOR DE SEGURIDAD (Double-Check Guardrail)
        const rawLower = cleaned.toLowerCase();
        const isHypotheticalLeak = rawLower.includes('plan hipotetico') || rawLower.includes('plan de vigilancia hipotetico') || rawLower.includes('como si el paciente tuviera');
        const hasExcludedLeak = validation.excludedSources.some(e => {
            const nameNorm = e.name.toLowerCase().replace('.pdf', '');
            return rawLower.includes(nameNorm) || (e.detectedTarget.toLowerCase().includes('endometrio') && rawLower.includes('uterine neoplasms'));
        });

        if (isHypotheticalLeak || hasExcludedLeak) {
            return `
            <div class="space-y-4 font-sans text-gray-800 text-xs">
                <div class="bg-red-50/90 p-5 rounded-2xl border-2 border-red-300 shadow-sm space-y-3">
                    <div class="flex items-center gap-2 text-red-900">
                        <svg class="w-5 h-5 flex-shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <h3 class="text-xs font-black uppercase tracking-wider">Bloqueo de Seguridad: Plan No Conforme</h3>
                    </div>
                    <p class="text-xs text-red-950 leading-relaxed font-medium">
                        El sistema detectó una inconsistencia de seguridad entre el diagnóstico del paciente (<strong>${validation.profile.organ} — ${validation.profile.histology}</strong>) y las referencias del informe. Se bloqueó la visualización del resultado.
                    </p>
                    <div class="p-3 bg-red-100/70 rounded-xl border border-red-200 text-[11px] text-red-900 font-medium">
                        El sistema no admite planes hipotéticos ni referencias a guías excluidas.
                    </div>
                </div>
            </div>
            `.trim();
        }

        // 5. FILTRADO ESTRICTO DE FILAS INCOMPATIBLES
        // Si el paciente está en Modo B (Metastásico activo), purgamos cualquier fila que mencione "no aplica directamente para estadio iv" o "post-resección de estadios ii-iii"
        if (validation.profile.followUpMode === 'ACTIVE_METASTATIC_MONITORING') {
            cleaned = cleaned.replace(/<tr[^>]*>[\s\S]*?(?:no aplica directamente para estadio iv|estadios ii[–-]iii de alto riesgo|colonoscop[ií]a al a[ñn]o de la resecci[oó]n)[\s\S]*?<\/tr>/gi, '');
        }

        return cleaned;

    } catch (e: any) {
        return `<div class="p-4 text-red-600 border border-red-200 rounded-lg">Error al generar el plan de seguimiento: ${e.message}</div>`;
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

// 4. AUDITORÍA CLÍNICA / CONTROL DE CALIDAD
export const generateOncologyVerification = async (text: string, files: FileData[]) => {
    try {
        const prompt = `
            ACTÚA COMO: Auditor Clínico y Extractor de Calidad Documental Oncológica.
            OBJETIVO: Detectar vacíos documentales críticos e inconsistencias en la historia clínica del paciente.
            NO realizar interpretación clínica subjetiva ni sugerir conductas terapéuticas.
            
            CRITERIOS CLÍNICOS Y DOCUMENTALES A AUDITAR:
            1) COMPLETITUD DE VARIABLES CLAVE:
               - Estadio tumoral completo (TNM / FIGO)
               - Performance status (ECOG / WHO)
               - Confirmación histopatológica / biopsia
               - Biomarcadores / perfil molecular requerido
               - Imágenes relevantes de estadificación/respuesta
               - Registro de tratamientos previos o activos
            2) INCONSISTENCIAS Y DISCORDANCIAS DOCUMENTALES:
               - Discordancia cronológica de fechas
               - Discordancia entre estadio y anatomía patológica o imágenes
               - Falta de criterios de respuesta documentados o discrepancias en la indicación

            FORMATO DE SALIDA ESTRICTO (JSON):
            - Si NO se detectan inconsistencias ni vacíos críticos relevantes:
              {
                "hasIssues": false,
                "alerts": []
              }

            - Si se detectan inconsistencias o vacíos críticos:
              {
                "hasIssues": true,
                "alerts": [
                  {
                    "category": "Tratamiento" | "Estadificación" | "Biopsia" | "Biomarcadores" | "Imágenes" | "Performance Status" | "Cronología",
                    "summary": "Frase breve y directa (ej: verificar correspondencia con inmunoterapia/iRECIST o falta información para confirmar el estadio).",
                    "detail": "Explicación contextual y justificación documental precisa en 1-2 oraciones."
                  }
                ]
              }

            IMPORTANTE:
            - NO incluyas en la lista de alertas los controles que fueron correctos.
            - NO agregues texto fuera del JSON.

            ENTRADA: "${text}"
        `;

        const parts: any[] = [{ text: prompt }];
        if (files) files.slice(0, 5).forEach(f => { if(f.data) parts.push({ inlineData: { mimeType: f.type, data: f.data } }) });

        const res = await callGemini({ parts, responseMimeType: "application/json" });
        const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
        return raw.replace(/```json|```html|```/g, '').trim();

    } catch (e: any) {
        return JSON.stringify({
            hasIssues: true,
            alerts: [{
                category: "Sistema",
                summary: "Error al procesar el control de calidad",
                detail: e.message
            }]
        });
    }
};
