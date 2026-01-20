import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BookOpen, GraduationCap, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface FileData { name: string; type: string; data: string; }

// --- LÓGICA (HOOK) ---
const useResidentLearning = (caseContext: string, files: FileData[]) => {
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
      
      const prompt = `
        ROL: Profesor Titular de Oncología Clínica.
        OBJETIVO: Realizar un análisis teórico-académico profundo del caso.
        
        CONTEXTO DEL CASO:
        ${caseContext}
        
        INSTRUCCIONES:
        1. Analiza el texto proporcionado Y LOS ARCHIVOS ADJUNTOS (Imágenes, PDFs) para entender el estadio y la biología real del paciente.
        2. Basa tu explicación en guías NCCN/ESMO vigentes.
        3. NO inventes datos. Si falta información en los archivos, indícalo como "Dato faltante a relevar".
        
        FORMATO DE SALIDA (HTML LIMPIO):
        Usa <h3>, <p>, <ul>, <li>. Clases Tailwind: text-indigo-800, font-bold, etc.
        
        ESTRUCTURA:
        1. 🧬 BIO-PATOLOGÍA DEL CASO: Análisis molecular/histológico según los informes adjuntos.
        2. 📊 ESTADIFICACIÓN (TNM): Razonamiento basado en las imágenes/informes disponibles.
        3. 📚 DISCUSIÓN TERAPÉUTICA: Standard of Care para este escenario específico.
        4. 💡 PERLAS CLÍNICAS: Puntos clave de aprendizaje.
      `;

      // Construimos el payload con texto y archivos
      const parts: any[] = [{ text: prompt }];
      
      // Adjuntamos hasta 5 archivos para no saturar el contexto, priorizando imágenes/pdf
      files.slice(0, 5).forEach(f => {
          parts.push({ inlineData: { mimeType: f.type, data: f.data } });
      });

      const res = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: { parts } 
      });
      
      const text = res.text || "No se pudo generar la lección.";
      setContent(text.replace(/```html|```/g, ''));
      
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
  files: FileData[]; // Nueva prop
}

const ResidentLearningModule: React.FC<Props> = ({ caseContext, files }) => {
  const { loading, content, error, generateLesson, clearContent } = useResidentLearning(caseContext, files);

  if (!content && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-50 p-8 rounded-full shadow-inner ring-4 ring-indigo-50/50">
          <BookOpen size={64} className="text-indigo-500" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight">Aula Virtual del Caso</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            La IA analizará tus notas <strong>y los archivos adjuntos</strong> para generar una clase basada en NCCN/ESMO.
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
            <Sparkles size={16} /> Analizar Caso Completo
          </span>
        </button>
      </div>
    );
  }

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
          <p className="text-xs font-black text-indigo-800 uppercase tracking-widest animate-pulse">Leyendo historia clínica...</p>
          <p className="text-[10px] text-gray-400 font-medium">Procesando imágenes y documentos</p>
        </div>
      </div>
    );
  }

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
            Material educativo. Verificar con bibliografía oficial.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResidentLearningModule;
