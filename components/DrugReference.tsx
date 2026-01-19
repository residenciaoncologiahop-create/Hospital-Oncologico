import React, { useState } from 'react';
import { Pill, X, Search, Loader2, AlertTriangle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface DrugReferenceProps {
  onClose: () => void;
}

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
      const prompt = `
        Actúa como Farmacólogo Oncológico Experto.
        Genera una ficha técnica concisa y estructurada para la droga: "${query}".
        
        FORMATO OBLIGATORIO (HTML simple sin markdown):
        <div class="space-y-4">
          <div><h4 class="font-bold text-indigo-700 uppercase text-xs mb-1">Mecanismo de Acción</h4><p class="text-xs text-gray-600">...</p></div>
          <div><h4 class="font-bold text-indigo-700 uppercase text-xs mb-1">Indicaciones Principales</h4><p class="text-xs text-gray-600">...</p></div>
          <div><h4 class="font-bold text-indigo-700 uppercase text-xs mb-1">Efectos Adversos (RAM)</h4><p class="text-xs text-gray-600">...</p></div>
          <div><h4 class="font-bold text-indigo-700 uppercase text-xs mb-1">Contraindicaciones e Interacciones</h4><p class="text-xs text-gray-600">...</p></div>
        </div>
      `;

      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
      setData(res.text || "Sin respuesta.");
    } catch (e: any) {
      setError(e.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2 text-purple-700 font-black text-xs uppercase tracking-widest">
            <Pill size={16} />
            <span>Vademécum Oncológico</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-purple-600"><X size={20}/></button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b bg-white">
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-gray-400" size={16} />
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-purple-200 rounded-xl text-sm font-bold outline-none transition-all"
              placeholder="Ej: Pembrolizumab, Carboplatino..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button 
              onClick={handleSearch}
              disabled={loading || !query}
              className="absolute right-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={14}/> : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {error && (
            <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-2">
              <AlertTriangle size={32} />
              <p className="text-xs font-bold">{error}</p>
            </div>
          )}
          
          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 space-y-4 opacity-50">
              <Pill size={64} />
              <p className="text-xs font-black uppercase tracking-widest">Ingrese una droga para consultar</p>
            </div>
          )}

          {data && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data }} />
          )}
        </div>

        <div className="p-3 bg-gray-50 border-t text-[9px] text-center text-gray-400 font-medium">
          Información generada por IA. Verificar con bibliografía oficial.
        </div>
      </div>
    </div>
  );
};

export default DrugReference;
