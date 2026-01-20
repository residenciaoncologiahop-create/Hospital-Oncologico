import React, { useState } from 'react';
import { Pill, X, Search, Loader2, AlertTriangle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface DrugReferenceProps { onClose: () => void; }

const DrugReference: React.FC<DrugReferenceProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) throw new Error("API Key no configurada.");

      const ai = new GoogleGenAI({ apiKey });
      
      // --- PROMPT ACTUALIZADO CON DATOS TÉCNICOS DE PREPARACIÓN ---
      const prompt = `
        Actúa como un Farmacéutico Oncológico Clínico Experto.
        Genera una ficha técnica precisa para la droga: "${query}".
        
        REGLA CRÍTICA: Devuelve ÚNICAMENTE HTML sin markdown.
        
        FORMATO OBLIGATORIO (HTML):
        <div class="space-y-4 text-sm text-gray-700 leading-relaxed">
          
          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">1. Mecanismo de Acción</h4>
            <p>...</p>
          </div>

          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">2. Indicaciones Aprobadas</h4>
            <ul class="list-disc pl-4 space-y-1"><li>...</li></ul>
          </div>

          <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 class="font-black text-blue-800 uppercase text-xs mb-3 flex items-center gap-2">
              3. Preparación y Administración (Datos Técnicos)
            </h4>
            <div class="grid grid-cols-1 gap-2 text-xs">
              <p><strong class="text-blue-900">Vía de Administración:</strong> ...</p>
              
              <p><strong class="text-blue-900">Solventes Compatibles:</strong> [Ej: SF 0.9%, Dextrosa 5%, etc.]</p>
              <p><strong class="text-blue-900">Dilución / Concentración:</strong> [Ej: Diluir en 100ml o 250ml]</p>
              <p><strong class="text-blue-900">Tiempo de Infusión:</strong> [Ej: Administrar en 30-60 minutos]</p>
              <p><strong class="text-blue-900">Cuidados Especiales:</strong> [Ej: Usar filtro 0.2 micras, proteger de la luz, premedicación requerida]</p>
            </div>
          </div>

          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">4. Posología Habitual</h4>
            <p>...</p>
          </div>

          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">5. Reacciones Adversas (RAM)</h4>
            <p>...</p>
          </div>

        </div>
      `;

      const res = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: { parts: [{ text: prompt }] } 
      });
      
      const text = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "Sin respuesta.";
      
      // Limpieza de respuesta
      let cleanText = text.replace(/```html|```/g, '').trim();
      const firstDivIndex = cleanText.indexOf('<div');
      if (firstDivIndex > 0) cleanText = cleanText.substring(firstDivIndex);
      
      setData(cleanText);

    } catch (e: any) {
      setError(e.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-purple-50">
          <div className="flex items-center gap-2 text-purple-800 font-black text-xs uppercase tracking-widest">
            <Pill size={16} /><span>Vademécum Oncológico</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-purple-600"><X size={20}/></button>
        </div>

        {/* Search */}
        <div className="p-4 border-b bg-white">
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-gray-400" size={16} />
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-purple-200 rounded-xl text-sm font-bold outline-none transition-all"
              placeholder="Ej: Paclitaxel, Cisplatino, Imatinib..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={loading || !query} className="absolute right-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={14}/> : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          {error && <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-2"><AlertTriangle size={32} /><p className="text-xs font-bold">{error}</p></div>}
          {!data && !loading && !error && <div className="flex flex-col items-center justify-center h-full text-gray-300 space-y-4 opacity-50"><Pill size={64} /><p className="text-xs font-black uppercase tracking-widest">Ingrese una droga para consultar</p></div>}
          
          {/* Renderizado HTML Seguro */}
          {data && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data }} />}
        </div>

        <div className="p-3 bg-gray-50 border-t text-[9px] text-center text-gray-400 font-medium">
          Información generada por IA (Gemini 2.5). Verificar SIEMPRE con prospecto oficial antes de administrar.
        </div>
      </div>
    </div>
  );
};

export default DrugReference;
