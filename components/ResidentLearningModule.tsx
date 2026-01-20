import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BookOpen, GraduationCap, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface FileData { name: string; type: string; data: string; }

// --- LÓGICA (HOOK) ---
const useResidentLearning = (caseContext: string, files: FileData[] = []) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateLesson = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) throw new Error("API Key no configurada.");

      const ai = new GoogleGenAI({ apiKey });
      
      // A) PROMPT DE SISTEMA (ROL)
      // Define estrictamente el comportamiento docente y las restricciones de seguridad.
      const systemInstruction = `
        ACTÚA COMO: Profesor Titular de Oncología Clínica (Mentor Académico).
        AUDIENCIA: Médicos Residentes en formación.
        
        PRINCIPIOS DE OPERACIÓN (ESTRICTOS):
        1. MODO EXCLUSIVAMENTE EDUCATIVO: Todo análisis es teórico. No emitas juicios clínicos sobre pacientes reales.
        2. SEGURIDAD: NO emitas órdenes médicas, recetas ni planes de tratamiento directivos.
        3. LENGUAJE: Usa un tono reflexivo y académico ("La evidencia sugiere...", "Las guías proponen...", "Consideraríamos...").
        4. OBJETIVO: Fomentar el razonamiento clínico, la fisiopatología y el conocimiento de las guías (NCCN/ESMO).
      `;

      // B) PROMPT DE TAREA (CONTENIDO)
      // Solicita la estructura específica de la clase sin ambigüedades asistenciales.
      const taskPrompt = `
        MODO APRENDER: ACTIVADO.
        
        INSTRUCCIONES DE LA TAREA:
        Analiza la siguiente información como un CASO CLÍNICO EDUCATIVO (FICTICIO O ANONIMIZADO) para una sesión de docencia.
        No intentes determinar el estadio real si faltan datos; señala las variables teóricas necesarias.
        
        CONTEXTO DEL CASO A ANALIZAR:
        ${caseContext}
        
        REQUISITOS DE RESPUESTA:
        Genera una discusión académica estructurada en HTML LIMPIO (sin bloques de código, sin markdown, solo etiquetas html).
        Usa clases de Tailwind CSS básicas para el formato (text-indigo-700, font-bold, list-disc, etc.).

ENFOQUE PEDAGÓGICO:
- Prioriza claridad y utilidad práctica.
- Evita extensiones innecesarias.
- Si un apartado no aplica por falta de datos, indícalo brevemente y continúa.
- El objetivo es ayudar al residente a razonar, no a memorizar.

        
        ESTRUCTURA OBLIGATORIA DE LA LECCIÓN:
        1. 🧬 FISIOPATOLOGÍA RELEVANTE: Breve repaso de los mecanismos moleculares/celulares teóricos de este tipo de patología.
        2. 📊 VARIABLES DE ESTADIFICACIÓN (TEÓRICA): Qué factores TNM y biomarcadores definen el pronóstico en este escenario (explica el "por qué").
        3. 📚 DISCUSIÓN TERAPÉUTICA (NCCN/ESMO): Resumen de las opciones de tratamiento estándar (Standard of Care) según las guías vigentes para un caso de estas características.
        4. 💡 PERLAS CLÍNICAS: 3 conceptos clave o "pitfalls" comunes para residentes.
        5. ❓ AUTOEVALUACIÓN:
   - 1 pregunta breve de opción múltiple
   - Explica por qué esa es la correcta

      `;
      const fullPrompt = `
${systemInstruction}

--------------------------------
${taskPrompt}
`;
      
      const parts: any[] = [{ text: fullPrompt }];
      
      // PROTECCIÓN CONTRA CRASH: Aseguramos que files sea un array
      const safeFiles = Array.isArray(files) ? files : [];
      
      // Ingesta de archivos como contexto educativo
      safeFiles.slice(0, 5).forEach(f => {
          if (f.data && f.type) {
            parts.push({ inlineData: { mimeType: f.type, data: f.data } });
          }
      });

      // LLAMADA A LA API
      // Usamos gemini-2.5-flash para estabilidad y rapidez en modo docente
      const res = await ai.models.generateContent({ 
  model: 'gemini-2.5-flash', 
  contents: { parts },
  temperature: 0.3,
});;
      
      const rawText = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
      
      // Limpieza de Markdown si la IA lo incluyera por error
      const cleanText = rawText.replace(/```html|```/g, '').trim();
      
      if (!cleanText) {
        throw new Error("El sistema docente no pudo generar una lección válida.");
      }
      
      setContent(cleanText);
      
    } catch (e: any) {
      console.error("Error en Módulo de Aprendizaje:", e);
      setError(e.message || "Error de conexión con el servicio docente.");
    } finally {
      setLoading(false);
    }
  };

  const clearContent = () => {
    setContent(null);
    setError(null);
  };

  return { loading, content, error, generateLesson, clearContent };
};

// --- UI (COMPONENTE) ---
interface Props {
  caseContext: string;
  files: FileData[]; 
}

const ResidentLearningModule: React.FC<Props> = ({ caseContext, files }) => {
  const { loading, content, error, generateLesson, clearContent } = useResidentLearning(caseContext, files);

  // ESTADO INICIAL: INVITACIÓN AL APRENDIZAJE
  if (!content && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-50 p-8 rounded-full shadow-inner ring-4 ring-indigo-50/50">
          <BookOpen size={64} className="text-indigo-500" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight">Aula Virtual del Caso</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            Genera una <strong>discusión académica instantánea</strong> basada en las guías NCCN/ESMO, analizando las variables clínicas cargadas.
          </p>
          <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
            Exclusivo para fines educativos
          </p>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 px-4 py-2 rounded-lg border border-red-100">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        <button 
          onClick={generateLesson}
          className="group relative bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-3">
            <Sparkles size={16} /> Iniciar Clase del Caso
          </span>
        </button>
      </div>
    );
  }

  // ESTADO DE CARGA: SIMULACIÓN DE ANÁLISIS DOCENTE
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-8">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <GraduationCap size={32} className="text-indigo-600" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-xs font-black text-indigo-800 uppercase tracking-widest animate-pulse">Analizando evidencia clínica...</p>
          <p className="text-[10px] text-gray-400 font-medium">Consultando guías NCCN / ESMO / ASCO</p>
        </div>
      </div>
    );
  }

  // ESTADO DE CONTENIDO: LECCIÓN GENERADA
  return (
    <div className="h-full flex flex-col overflow-hidden bg-white animate-in slide-in-from-bottom-4 duration-500">
      {/* HEADER FIJO */}
      <div className="p-6 border-b bg-white/95 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
            <GraduationCap size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-gray-800 uppercase tracking-wide">Discusión Académica</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Modo Aprendizaje</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearContent} 
          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all"
        >
          <RefreshCw size={14} />
          <span>Otro Análisis</span>
        </button>
      </div>

      {/* CONTENIDO SCROLLABLE */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-3xl mx-auto prose prose-indigo prose-sm text-gray-600 leading-relaxed">
          {/* INYECCIÓN SEGURA DEL HTML EDUCATIVO */}
          <div dangerouslySetInnerHTML={{ __html: content || '' }} />
        </div>
        
        {/* DISCLAIMER FINAL OBLIGATORIO */}
        <div className="mt-12 pt-6 border-t border-dashed border-gray-200 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Material generado con IA con fines exclusivamente educativos.<br/>
            El residente debe verificar toda la información con bibliografía oficial. No apto para toma de decisiones clínicas reales.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResidentLearningModule;
