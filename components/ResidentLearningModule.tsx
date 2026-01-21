import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BookOpen, GraduationCap, Loader2, Sparkles, AlertCircle, RefreshCw, Maximize2, Minimize2, MessageCircle, Play, User, CheckCircle2, MousePointerClick } from 'lucide-react';

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

  const apiKey = import.meta.env.VITE_API_KEY;

  // Helper para limpiar texto (elimina asteriscos y aplica formato HTML seguro)
  const cleanAndFormat = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convierte **texto** en negrita
      .replace(/^\* /gm, '• ') // Convierte * lista en bullets
      .replace(/\*/g, '') // Elimina asteriscos sueltos
      .trim();
  };

  // 1. LÓGICA DE SIMULACIÓN
  const runSimulationTurn = async (selectedOption?: string) => {
    if (!apiKey) { setError("API Key faltante"); return; }
    
    setSimLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      let historyContext = "";
      simMessages.forEach(m => {
        historyContext += `${m.role === 'model' ? 'MENTOR' : 'RESIDENTE'}: ${m.text}\n`;
      });

      const isLastTurn = turnCount >= 3;

      const simPrompt = `
        ACTÚA COMO: Mentor Docente de Oncología (Senior).
        
        CONTEXTO DEL CASO Y ARCHIVOS ADJUNTOS:
        ${caseContext}
        (Prioriza siempre los datos de los archivos adjuntos sobre el resumen).
        
        OBJETIVO: Simulación clínica (Turno ${turnCount + 1}/4).
        
        REGLAS DE FORMATO VISUAL (CRÍTICO):
        1. NUNCA uses Markdown ni asteriscos (**texto**). El sistema no los lee bien.
        2. Para resaltar conceptos clave, usa la etiqueta <strong>...</strong>.
        3. LA PREGUNTA FINAL O CONDUCTA A TOMAR debe estar muy destacada. Enciérrala SIEMPRE en este bloque HTML exacto:
           <div class="bg-indigo-50 p-4 rounded-xl border-l-4 border-indigo-500 mt-4 mb-2 shadow-sm"><p class="font-bold text-indigo-900 text-base">PREGUNTA: [Tu pregunta aquí]</p></div>
        4. Usa párrafos cortos. <br> para saltos de línea.

        HISTORIAL:
        ${historyContext}

        ACCIÓN RECIENTE: "${selectedOption || '(Inicio)'}"

        TU RESPUESTA:
        ${selectedOption 
          ? `1. FEEDBACK: <p class="mb-2">Evalúa la opción elegida con claridad.</p>
             2. EVOLUCIÓN: <p class="mb-2">Relata qué sucede después (resultado de estudios, evolución clínica) basándote en los datos reales del caso.</p>` 
          : `1. ESCENARIO INICIAL: <p class="mb-2">Presenta el caso clínico de forma narrativa y atrapante.</p>`
        }
        
        ${!isLastTurn 
          ? `3. PLANTEAMIENTO: Cierra con el bloque de PREGUNTA destacado.`
          : `3. CIERRE: Felicita al residente y pídele revisar la teoría completa.`
        }
      `;

      const parts: any[] = [{ text: simPrompt }];
      
      if (files && Array.isArray(files)) {
          files.slice(0, 5).forEach(f => {
              if (f.data && f.type) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
          });
      }

      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
      const rawText = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "Error.";
      
      // Limpieza post-procesamiento para asegurar que no queden asteriscos
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
      if (!apiKey) throw new Error("API Key no configurada.");
      const ai = new GoogleGenAI({ apiKey });
      
      const fullPrompt = `
        ROL: Profesor Titular de Oncología.
        TAREA: Generar el MARCO TEÓRICO FINAL.
        CONTEXTO: ${caseContext}
        
        INSTRUCCIONES DE FORMATO (ESTRICTAS - SIN ASTERISCOS):
        1. SALIDA: HTML LIMPIO. 
           - NO uses Markdown. NO uses asteriscos (**). 
           - Usa <strong> para negritas.
        2. ESTRUCTURA VISUAL:
           - Títulos: <h3> con clase "text-lg font-bold text-indigo-700 mt-6 mb-3 border-b border-indigo-100 pb-1".
           - Subtítulos: <h4> con clase "font-bold text-gray-800 mt-3 mb-1".
           - Texto: <p> con clase "mb-2 leading-relaxed text-gray-700".
           - Listas: <ul> con clase "list-disc pl-5 space-y-1 text-gray-700 mb-4".
        
        CONTENIDO:
        1. 🧬 FISIOPATOLOGÍA RELEVANTE (Mecanismos moleculares del caso).
        2. 📊 ESTADIFICACIÓN Y PRONÓSTICO (TNM/FIGO explicado).
        3. 📚 DISCUSIÓN TERAPÉUTICA (Standard of Care NCCN/ESMO).
        4. 💡 PERLAS CLÍNICAS (Puntos clave).
        5. ✅ CHECKLIST DE CONCEPTOS (Lista de verificación para el residente).
      `;

      const parts: any[] = [{ text: fullPrompt }];
      if (files && Array.isArray(files)) {
          files.slice(0, 5).forEach(f => {
              if (f.data && f.type) parts.push({ inlineData: { mimeType: f.type, data: f.data } });
          });
      }

      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
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
  
  // Refs para control de scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  // EFECTO DE SCROLL: SIMULACIÓN
  useEffect(() => {
    if (simMessages.length > 0) {
      const lastMsg = simMessages[simMessages.length - 1];
      // Si el mensaje es del modelo (docente), scrolleamos para que el INICIO del mensaje quede visible arriba
      if (lastMsg.role === 'model') {
        setTimeout(() => {
          lastMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        // Si es el usuario, scrolleamos al fondo normal
        scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [simMessages]);

  // EFECTO DE SCROLL: TEORÍA
  useEffect(() => {
    if (phase === 'THEORY' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
              // Referencia al último mensaje para el scroll
              ref={idx === simMessages.length - 1 ? lastMsgRef : null}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-500`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'model' ? 'bg-white text-indigo-600 border border-indigo-100' : 'bg-indigo-600 text-white'}`}>
                {msg.role === 'model' ? <GraduationCap size={20}/> : <User size={20}/>}
              </div>
              <div className={`p-5 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[90%] ${msg.role === 'model' ? 'bg-white text-gray-700 rounded-tl-none border border-gray-100' : 'bg-indigo-600 text-white rounded-tr-none font-medium'}`}>
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
          {/* Espaciador final para que no quede pegado */}
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
