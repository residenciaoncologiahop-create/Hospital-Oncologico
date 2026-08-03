import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, GraduationCap, Loader2, Sparkles, RefreshCw, Maximize2, Minimize2, Play, User, CheckCircle2, MousePointerClick } from 'lucide-react';
// IMPORTACIÓN NUEVA: Usamos el proxy seguro en lugar del SDK de Gemini
import { callGemini } from '../utils/aiProxy';

interface FileData { name: string; type: string; data: string; }
interface SimMessage { role: 'model' | 'user'; text: string; }

// Estados del flujo pedagógico
type LearningPhase = 'IDLE' | 'SIMULATION' | 'TRANSITION' | 'THEORY';

// --- LÓGICA (HOOK) ---
const useResidentLearning = (caseContext: string, files: FileData[] = []) => {
  const [phase, setPhase] = useState<LearningPhase>('IDLE');
  const [error, setError] = useState<string | null>(null);
  
  // Simulación
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);

  // Teoría
  const [theoryContent, setTheoryContent] = useState<string | null>(null);
  const [theoryLoading, setTheoryLoading] = useState(false);

  // Helper para limpiar texto
  const cleanAndFormat = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
      .replace(/^\* /gm, '') 
      .replace(/\*/g, '')
      .replace(/```html|```/g, '')
      .trim();
  };

  // 1. LÓGICA DE SIMULACIÓN (CON INSTRUCCIÓN CRÍTICA DE OPCIONES HTML)
  const runSimulationTurn = async (selectedOption?: string) => {
    setSimLoading(true);
    try {
      let historyContext = "";
      simMessages.forEach(m => {
        historyContext += `${m.role === 'model' ? 'MENTOR' : 'RESIDENTE'}: ${m.text}\n`;
      });

      const isLastTurn = turnCount >= 3;

      const simPrompt = `
        ACTÚA COMO: Mentor Docente de Oncología (Senior).
        
        CONTEXTO DEL CASO Y ARCHIVOS:
        ${caseContext}
        (IMPORTANTE: Analiza primero los ARCHIVOS ADJUNTOS para extraer estadiaje real, biología y antecedentes).
        
        OBJETIVO: Simulación clínica (Turno ${turnCount + 1}/4).
        
        REGLAS DE FORMATO VISUAL (ESTRICTO - HTML PURO):
        1. NO USES MARKDOWN. NO USES ASTERISCOS (*).
        2. ESTRUCTURA TU RESPUESTA DE ARRIBA A ABAJO (Lectura lineal).
        3. PARA LA PREGUNTA FINAL, USA ESTE CONTENEDOR EXACTO:
           <br>
           <div class="p-5 bg-indigo-50 rounded-xl border-l-4 border-indigo-500 shadow-sm mt-2">
             <p class="font-bold text-indigo-900 text-sm uppercase tracking-wide mb-1">🛑 Decisión Clínica</p>
             <p class="text-indigo-800 text-lg font-medium leading-snug">[TU PREGUNTA AQUÍ]</p>
           </div>

        4. INSTRUCCIÓN CRÍTICA ADICIONAL (OBLIGATORIA):
           Cuando presentes la "Decisión Clínica", DEBES generar inmediatamente después TRES OPCIONES DE CONDUCTA (A, B y C) en el siguiente FORMATO HTML OBLIGATORIO:

           <br>
           <div class="mt-4 space-y-3">
             <div class="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
               <p class="font-bold text-gray-800 text-base mb-1">Opción A</p>
               <p class="text-gray-600 text-sm leading-snug">[Texto de la opción A]</p>
             </div>

             <div class="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
               <p class="font-bold text-gray-800 text-base mb-1">Opción B</p>
               <p class="text-gray-600 text-sm leading-snug">[Texto de la opción B]</p>
             </div>

             <div class="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
               <p class="font-bold text-gray-800 text-base mb-1">Opción C</p>
               <p class="text-gray-600 text-sm leading-snug">[Texto de la opción C]</p>
             </div>
           </div>

           REGLA CRÍTICA DE ORDEN DE SALIDA (OBLIGATORIA):

1. El PRIMER bloque de la respuesta DEBE ser siempre el inicio del caso clínico
   o el feedback inicial si no es el primer turno.

2. ESTÁ PROHIBIDO comenzar la respuesta con:
   - La decisión clínica
   - La pregunta
   - Las opciones A/B/C
   - Un bloque destacado
   - Un mensaje de cierre o conclusión

3. La pregunta y las opciones A/B/C DEBEN aparecer
   ÚNICAMENTE DESPUÉS del contexto clínico completo y la evolución.

4. El primer carácter del output debe pertenecer
   al texto introductorio del caso.

Esta regla tiene prioridad sobre cualquier otra instrucción.


        HISTORIAL PREVIO:
        ${historyContext}

        ACCIÓN DEL RESIDENTE: "${selectedOption || '(Inicio de simulación)'}"

        TU RESPUESTA (HTML):
        ${selectedOption 
          ? `
             <p class="text-gray-700 leading-relaxed">
               <strong>FEEDBACK:</strong> Evalúa la opción elegida (${selectedOption}). Sé directo sobre si fue adecuada o no.
             </p>
             <br>
             <div class="pl-4 border-l-2 border-gray-200">
               <p class="text-gray-600 italic">
                 <strong>EVOLUCIÓN:</strong> Relata qué sucede después (ej: toxicidad, resultado de TAC, progresión) basándote en el caso real.
               </p>
             </div>
            ` 
          : `
             <p class="text-lg text-gray-800 leading-relaxed font-medium">
               Bienvenido, doctor. Iniciemos el análisis del caso.
             </p>
             <br>
             <div class="text-gray-700 leading-relaxed">
               Presenta el caso clínico de forma narrativa, destacando antecedentes y enfermedad actual según los documentos.
             </div>
            `
        }
        
        ${!isLastTurn 
          ? `[AQUÍ INSERTA EL BLOQUE DE PREGUNTA FINAL Y LUEGO LAS 3 OPCIONES HTML]`
          : `<br><div class="p-5 bg-green-50 rounded-xl border border-green-200 text-center">
               <p class="font-bold text-green-800 text-lg">¡Simulación Finalizada!</p>
               <p class="text-green-700 mt-2">Hemos recorrido los puntos críticos. Ahora revisemos el análisis teórico completo.</p>
             </div>`
        }
      `;

      const parts: any[] = [{ text: simPrompt }];
      
      if (files && Array.isArray(files)) {
          files.slice(0, 5).forEach(f => {
              if (f.data && f.type) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
          });
      }

      // LLAMADA SEGURA A GEMINI
      const res = await callGemini({ parts });
      const rawText = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "Error.";
      
      const aiText = cleanAndFormat(rawText);

      const newMsgs = [...simMessages];
      if (selectedOption) newMsgs.push({ role: 'user', text: `Opción seleccionada: ${selectedOption}` });
      newMsgs.push({ role: 'model', text: aiText });

      setSimMessages(newMsgs);
      setTurnCount(prev => prev + 1);
      
      if (turnCount === 0) setPhase('SIMULATION');
      if (isLastTurn) setPhase('TRANSITION');

    } catch (e: any) {
      setError("Error: " + e.message);
    } finally {
      setSimLoading(false);
    }
  };

  // 2. GENERAR TEORÍA
  const generateTheory = async () => {
    setTheoryLoading(true);
    setError(null);
    try {
      const fullPrompt = `
        ROL: Profesor Titular de Oncología.
        TAREA: Generar el MARCO TEÓRICO FINAL.
        CONTEXTO: ${caseContext}
        
        INSTRUCCIONES DE FORMATO (SOLO HTML LIMPIO - SIN ASTERISCOS):
        1. NO uses Markdown. NO uses asteriscos (**). 
        2. Usa <strong class="text-indigo-900"> para resaltar conceptos.
        3. ESTRUCTURA VISUAL:
           - Títulos (h3): <h3 class="text-xl font-bold text-indigo-800 mt-10 mb-4 pb-2 border-b border-indigo-100">
           - Subtítulos (h4): <h4 class="text-lg font-bold text-gray-800 mt-6 mb-2">
           - Párrafos (p): <p class="mb-4 text-gray-700 leading-7 text-justify">
           - Listas (ul): <ul class="space-y-2 mb-6 ml-1">
           - Ítems (li): <li class="flex gap-3 bg-gray-50 p-3 rounded-lg text-gray-700 text-sm"><span class="text-indigo-500 font-bold">•</span><span>...</span></li>
        
        CONTENIDO REQUERIDO:
        
        1. 🧬 FISIOPATOLOGÍA RELEVANTE
           - Explica mecanismos moleculares. Sé claro.
        
        2. 📊 ESTADIFICACIÓN Y PRONÓSTICO
           - <div class="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400 mb-4">
               Define el estadio TNM/FIGO del caso y el pronóstico asociado.
             </div>
        
        3. 📚 DISCUSIÓN TERAPÉUTICA (Standard of Care)
           - Explica el manejo estándar (NCCN/ESMO).
           - Usa lenguaje afirmativo y explicativo.
        
        4. 💡 PERLAS CLÍNICAS
           - <div class="bg-amber-50 p-6 rounded-2xl border border-amber-100 my-8">
               <h4 class="text-amber-900 font-bold uppercase text-xs tracking-widest mb-4">⚠️ Puntos Clave</h4>
               [Lista de 3-4 conceptos clave]
             </div>
        
        5. ✅ CHECKLIST DE APRENDIZAJE
           - <div class="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 my-8">
               <h4 class="text-emerald-900 font-bold uppercase text-xs tracking-widest mb-4">🎯 Metas Alcanzadas</h4>
               [Lista de verificación en primera persona para el residente]
             </div>

             REGLA DE LECTURA INICIAL (OBLIGATORIA):

1. El documento DEBE iniciar siempre con el encabezado de:
   "FISIOPATOLOGÍA RELEVANTE".

2. ESTÁ PROHIBIDO iniciar con:
   - Perlas clínicas
   - Cajas destacadas
   - Checklists
   - Conclusiones

3. Todo bloque visual destacado debe aparecer
   solo después de que el concepto haya sido explicado en texto normal.

      `;

      const parts: any[] = [{ text: fullPrompt }];
      if (files && Array.isArray(files)) {
          files.slice(0, 5).forEach(f => {
              if (f.data && f.type) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
          });
      }

      // LLAMADA SEGURA A GEMINI
      const res = await callGemini({ parts });
      const rawText = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
      
      setTheoryContent(cleanAndFormat(rawText));
      setPhase('THEORY');
      
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTheoryLoading(false);
    }
  };

  const resetModule = () => {
    setPhase('IDLE');
    setSimMessages([]);
    setTheoryContent(null);
    setTurnCount(0);
    setError(null);
  };

  return { phase, error, simMessages, simLoading, runSimulationTurn, theoryContent, theoryLoading, generateTheory, resetModule };
};

// --- UI (COMPONENTE) ---
interface Props { caseContext: string; files: FileData[]; }

const ResidentLearningModule: React.FC<Props> = ({ caseContext, files }) => {
  const { phase, error, simMessages, simLoading, runSimulationTurn, theoryContent, theoryLoading, generateTheory, resetModule } = useResidentLearning(caseContext, files);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  // SCROLL: SIMULACIÓN (Al inicio del mensaje nuevo)
  useEffect(() => {
    if (simMessages.length > 0) {
      const lastMsg = simMessages[simMessages.length - 1];
      if (lastMsg.role === 'model') {
        setTimeout(() => {
          lastMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [simMessages]);

  // SCROLL: TEORÍA (Siempre arriba al cargar)
  useEffect(() => {
    if (phase === 'THEORY' && scrollContainerRef.current) {
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [phase, theoryContent]);

  const handleOptionSelect = (option: string) => {
    runSimulationTurn(`Opción ${option}`);
  };

  // 1. FASE IDLE
  if (phase === 'IDLE') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-50 p-8 rounded-full shadow-inner ring-4 ring-indigo-50/50">
          <BookOpen size={64} className="text-indigo-500" />
        </div>
        <div className="max-w-md space-y-4">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight">Aprendizaje Basado en Problemas</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            Completa una <strong>simulación guiada</strong> basada en la documentación del caso para desbloquear el marco teórico.
          </p>
          <div className="flex gap-2 justify-center text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            <span className="bg-indigo-50 px-2 py-1 rounded">1. Análisis</span>
            <span className="text-gray-300">→</span>
            <span className="bg-indigo-50 px-2 py-1 rounded">2. Decisión</span>
            <span className="text-gray-300">→</span>
            <span className="bg-indigo-50 px-2 py-1 rounded">3. Estudio</span>
          </div>
        </div>
        {error && <div className="text-red-500 text-xs font-bold">{error}</div>}
        <button onClick={() => runSimulationTurn()} disabled={simLoading} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2">
          {simLoading ? <Loader2 className="animate-spin" /> : <Play size={16} />} Iniciar Simulación
        </button>
      </div>
    );
  }

  // 2. FASE SIMULACIÓN Y TRANSICIÓN
  if (phase === 'SIMULATION' || phase === 'TRANSITION') {
    return (
      <div className={`flex flex-col bg-gray-50/50 transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-[100] w-screen h-screen bg-white' : 'h-full'}`}>
        <div className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg"><Sparkles size={18} /></div>
            <div>
              <h3 className="font-bold text-sm text-gray-800">Simulación Guiada</h3>
              <p className="text-[10px] text-gray-500 font-medium">Selecciona la opción más adecuada</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={resetModule} className="text-gray-400 hover:text-red-500 text-xs font-bold px-3">Abandonar</button>
          </div>
        </div>

        {/* ÁREA DE CHAT SCROLLABLE */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {simMessages.map((msg, idx) => (
            <div 
              key={idx} 
              ref={idx === simMessages.length - 1 ? lastMsgRef : null}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-500`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'model' ? 'bg-white text-indigo-600 border border-indigo-100' : 'bg-indigo-600 text-white'}`}>
                {msg.role === 'model' ? <GraduationCap size={20}/> : <User size={20}/>}
              </div>
              <div className={`p-6 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[90%] ${msg.role === 'model' ? 'bg-white text-gray-700 rounded-tl-none border border-gray-100' : 'bg-indigo-600 text-white rounded-tr-none font-medium'}`}>
                <div dangerouslySetInnerHTML={{ __html: msg.text }} />
              </div>
            </div>
          ))}
          {simLoading && (
            <div className="flex gap-4 animate-pulse">
               <div className="w-10 h-10 rounded-full bg-white text-indigo-600 border border-indigo-100 flex items-center justify-center"><GraduationCap size={20}/></div>
               <div className="bg-gray-100 px-5 py-3 rounded-full text-xs text-gray-500 font-bold flex items-center gap-2">
                 <Loader2 size={14} className="animate-spin"/> Analizando escenario clínico...
               </div>
            </div>
          )}
          <div className="h-4"></div>
        </div>

        {/* CONTROLES */}
        <div className="p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {phase === 'SIMULATION' ? (
            <div className="max-w-4xl mx-auto">
              <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Selecciona tu conducta clínica</p>
              <div className="grid grid-cols-3 gap-3">
                {['A', 'B', 'C'].map((opt) => (
                  <button key={opt} onClick={() => handleOptionSelect(opt)} disabled={simLoading} className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-indigo-50 bg-indigo-50/30 hover:bg-indigo-100 hover:border-indigo-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group">
                    <span className="text-xl font-black text-indigo-300 group-hover:text-indigo-600 mb-1">{opt}</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-indigo-700">Opción {opt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-bottom-4 fade-in">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 text-green-600 p-2 rounded-full"><CheckCircle2 size={20} /></div>
                  <div>
                    <h4 className="font-bold text-sm text-green-800">Simulación Completada</h4>
                    <p className="text-xs text-green-600">Has desbloqueado el análisis teórico completo.</p>
                  </div>
                </div>
                <button onClick={generateTheory} disabled={theoryLoading} className="bg-green-600 text-white px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-200">
                  {theoryLoading ? <Loader2 className="animate-spin" size={14}/> : <MousePointerClick size={14} />} Ver Teoría
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. FASE TEORÍA
  return (
    <div className={`flex flex-col bg-white transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-[100] w-screen h-screen bg-white' : 'h-full animate-in zoom-in-95 duration-500'}`}>
      <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 text-green-700 p-2 rounded-lg"><BookOpen size={20} /></div>
          <div>
            <h3 className="font-black text-sm text-gray-800 uppercase tracking-wide">Marco Teórico & Evidencia</h3>
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">Desbloqueado</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={resetModule} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all">
              <RefreshCw size={14} /> <span>Nuevo Caso</span>
            </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto scrollbar-hide ${isFullScreen ? 'p-16' : 'p-8'}`}>
        <div className={`mx-auto prose prose-indigo prose-sm text-gray-600 leading-relaxed ${isFullScreen ? 'max-w-5xl text-base' : 'max-w-3xl'}`}>
          <div dangerouslySetInnerHTML={{ __html: theoryContent || '' }} />
        </div>
        <div className="mt-12 pt-6 border-t border-dashed border-gray-200 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Material generado con IA con fines exclusivamente educativos.</p>
        </div>
      </div>
    </div>
  );
};

export default ResidentLearningModule;
