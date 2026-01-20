import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BookOpen, GraduationCap, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

// --- LÓGICA (HOOK) ---
const useResidentLearning = (caseContext: string) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateLesson = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) throw new Error("API Key no configurada.");

      // Instancia local para no depender de archivos externos
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        ROL: Profesor Titular de Oncología Clínica (Mentor Académico).
        AUDIENCIA: Médicos Residentes en formación.
        OBJETIVO: Realizar un análisis teórico-académico basado en el caso presentado.
        
        CONTEXTO DEL CASO (EDUCATIVO/FICTICIO):
        ${caseContext}
        
        INSTRUCCIONES DE SEGURIDAD:
        - NO emitas órdenes médicas ni recetas.
        - NO uses lenguaje directivo ("Haga esto", "Recete aquello").
        - Usa lenguaje reflexivo ("Las guías sugieren...", "La evidencia apoya...").
        - Enfócate en el razonamiento clínico y la fisiopatología.
        
        FORMATO DE SALIDA (HTML LIMPIO, SIN MARKDOWN):
        Usa etiquetas <h3>, <p>, <ul>, <li> y clases de Tailwind básicas (text-indigo-700, font-bold, etc).
        
        ESTRUCTURA DE LA CLASE:
        1. 🧬 FISIOPATOLOGÍA Y BIOLOGÍA MOLECULAR: Breve explicación del mecanismo tumoral.
        2. 📊 ESTADIFICACIÓN Y FACTORES PRONÓSTICOS: Qué variables definen el pronóstico en este escenario.
        3. 📚 DISCUSIÓN TERAPÉUTICA (NCCN/ESMO): Opciones estándar de tratamiento (Standard of Care) y su racionalidad.
        4. 💡 PERLAS CLÍNICAS: 3 conceptos clave o errores comunes a evitar.
      `;

      const res = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: { parts: [{ text: prompt }] } 
      });
      
      const text = res.text || "No se pudo generar la lección.";
      setContent(text.replace(/```html|```/g, '')); // Limpieza de seguridad
      
    } catch (e: any) {
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
}

const ResidentLearningModule: React.FC<Props> = ({ caseContext }) => {
  const { loading, content, error, generateLesson, clearContent } = useResidentLearning(caseContext);

  // Estado Inicial
  if (!content && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-50 p-8 rounded-full shadow-inner ring-4 ring-indigo-50/50">
          <BookOpen size={64} className="text-indigo-500" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight">Aula Virtual de Residencia</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            Genera una discusión académica instantánea basada en las guías NCCN/ESMO aplicadas a las variables de este caso.
          </p>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 px-4 py-2 rounded-lg">
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

  // Estado de Carga
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

  // Estado de Contenido
  return (
    <div className="h-full flex flex-col overflow-hidden bg-white animate-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b bg-white/95 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
            <GraduationCap size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-gray-800 uppercase tracking-wide">Discusión Académica</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Modo Aprendizaje</span>
              <span className="text-[10px] text-gray-400">No apto para decisión clínica</span>
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

      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-3xl mx-auto prose prose-indigo prose-sm text-gray-600 leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: content || '' }} />
        </div>
        
        <div className="mt-12 pt-6 border-t border-dashed border-gray-200 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Material generado con IA para fines exclusivamente educativos. <br/>
            El residente debe verificar toda la información con bibliografía oficial.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResidentLearningModule;
