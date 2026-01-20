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
        Genera una ficha técnica DETALLADA para la droga: "${query}".
        
        FORMATO OBLIGATORIO (HTML simple, limpio, usar clases Tailwind para títulos):
        
        <div class="space-y-4 text-sm text-gray-700 leading-relaxed">
          
          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">1. Mecanismo de Acción</h4>
            <p>...</p>
          </div>

          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">2. Indicaciones Principales</h4>
            <ul class="list-disc pl-4 space-y-1">
               <li>...</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-3 rounded-lg border border-purple-100">
            <h4 class="font-black text-purple-900 uppercase text-xs mb-2">3. Administración y Dosis Habituales</h4>
            <p><strong>Vía:</strong> [Ej: Endovenosa / Oral]</p>
            <p><strong>Tiempo de Infusión:</strong> [Ej: 30-60 minutos] (Si aplica)</p>
            <p><strong>Dosis Estándar:</strong> [Ej: 100 mg/m2 o AUC 5]</p>
            <p><strong>Esquemas Comunes:</strong> [Ej: Cada 21 días, Semanal, etc.]</p>
            <p class="text-[10px] text-gray-500 mt-1 italic">*Verificar siempre según protocolo específico y función orgánica.</p>
          </div>

          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">4. Reacciones Adversas (RAM)</h4>
            <p><strong>Frecuentes:</strong> ...</p>
            <p><strong>Graves/Limitantes:</strong> ...</p>
          </div>

          <div>
            <h4 class="font-black text-purple-800 uppercase text-xs mb-1 border-b border-purple-200 pb-1">5. Ajustes e Interacciones</h4>
            <p>...</p>
          </div>

        </div>
      `;

      const res = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: { parts: [{ text: prompt }] } 
      });
      
      const text = res.text || "Sin respuesta.";
      setData(text.replace(/```html|```/g, ''));

    } catch (e: any) {
      setError(e.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-purple-50">
          <div className="flex items-center gap-2 text-purple-800 font-black text-xs uppercase tracking-widest">
            <Pill size={16} /><span>Vademécum Oncológico</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-purple-600"><X size={20}/></button>
        </div>
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
            <button onClick={handleSearch} disabled={loading || !query} className="absolute right-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={14}/> : 'Buscar'}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          {error && <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-2"><AlertTriangle size={32} /><p className="text-xs font-bold">{error}</p></div>}
          {!data && !loading && !error && <div className="flex flex-col items-center justify-center h-full text-gray-300 space-y-4 opacity-50"><Pill size={64} /><p className="text-xs font-black uppercase tracking-widest">Ingrese una droga para consultar</p></div>}
          {data && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data }} />}
        </div>
      </div>
    </div>
  );
};

export default DrugReference;
