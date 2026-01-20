import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, Plus, Search, Trash2, LogOut, Menu, X, 
  FileText, Clock, FileOutput, GraduationCap, Calculator, Pill, 
  Stethoscope, User, ChevronRight, PanelLeftClose, PanelLeftOpen, MessageSquare, Loader2, AlertCircle 
} from 'lucide-react';

// --- IMPORTS ---
import FormManager from './components/FormManager';
import OncoCalculator from './components/OncoCalculator';
import DrugReference from './components/DrugReference';
import FileUploader from './components/FileUploader';
import ResidentLearningModule from './components/ResidentLearningModule';
import { getResidentChatResponse, extractResidentTimeline } from './utils/residentAI';

// --- TIPOS ---
interface ResidentPatient {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  historyText: string;
  files: { name: string; type: string; data: string }[];
  timeline: any[]; 
  chatHistory: { role: 'user' | 'model'; text: string; timestamp: number }[];
  lastUpdated: number;
}

const ResidentApp = () => {
  // --- ESTADOS ---
  const [patients, setPatients] = useState<ResidentPatient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'timeline' | 'forms' | 'learning'>('docs');
  
  // UI & Modals
  const [showCalc, setShowCalc] = useState(false);
  const [showDrugs, setShowDrugs] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timeline Processing State
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);

  // New Patient Form
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newDx, setNewDx] = useState('');

  // --- DERIVED STATE ---
  const selectedPatient = patients.find(p => p.id === selectedId);
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedPatient?.chatHistory, isTyping]);

  // --- HANDLERS ---

  const updateCurrentPatient = (updates: Partial<ResidentPatient>) => {
    setPatients(prev => prev.map(p => p.id === selectedId ? { ...p, ...updates, lastUpdated: Date.now() } : p));
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: ResidentPatient = {
      id: `res-${Date.now()}`,
      name: newName,
      age: parseInt(newAge) || 0,
      diagnosis: newDx,
      historyText: '',
      files: [],
      timeline: [],
      chatHistory: [],
      lastUpdated: Date.now()
    };
    setPatients(prev => [newPatient, ...prev]);
    setSelectedId(newPatient.id);
    setShowNewPatientModal(false);
    setNewName(''); setNewAge(''); setNewDx('');
  };

  const handleDeletePatient = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Descartar caso?")) {
      setPatients(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedPatient) return;
    
    const newMsg = { role: 'user' as const, text: chatInput, timestamp: Date.now() };
    const updatedHistory = [...selectedPatient.chatHistory, newMsg];
    
    updateCurrentPatient({ chatHistory: updatedHistory });
    setChatInput('');
    setIsTyping(true);

    const context = `Paciente: ${selectedPatient.name}, ${selectedPatient.age} años. Dx: ${selectedPatient.diagnosis}.\nHistoria: ${selectedPatient.historyText}`;
    
    const response = await getResidentChatResponse(updatedHistory, newMsg.text, context, selectedPatient.files);
    
    const aiMsg = { role: 'model' as const, text: response, timestamp: Date.now() };
    updateCurrentPatient({ chatHistory: [...updatedHistory, aiMsg] });
    setIsTyping(false);
  };

  const handleProcessTimeline = async () => {
    if (!selectedPatient) return;
    if (!selectedPatient.historyText && selectedPatient.files.length === 0) return;
    
    setIsProcessingDocs(true);
    const events = await extractResidentTimeline(selectedPatient.historyText, selectedPatient.files);
    updateCurrentPatient({ timeline: events });
    setIsProcessingDocs(false);
    setActiveTab(prev => prev === 'learning' ? prev : 'timeline');
  };

  const handleExit = () => { if (window.confirm("Se borrarán los datos. ¿Salir?")) window.location.reload(); };

  return (
    // CAMBIO 1: Revertido a text-xs para letra más compacta
    <div className="flex h-screen bg-white text-gray-800 font-sans text-xs overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2 text-indigo-600 font-black text-xl tracking-tighter">
            <GraduationCap size={24} /><span>OncoResidente</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-gray-300"><X size={24}/></button>
        </div>

        <div className="px-4 py-4 border-b border-gray-100 bg-indigo-50/30">
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 px-2">Herramientas</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowCalc(true)} className="flex flex-col items-center justify-center p-3 bg-white border border-indigo-100 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-all text-[10px] font-bold text-gray-500"><Calculator size={16} className="mb-1"/>Calculadoras</button>
            <button onClick={() => setShowDrugs(true)} className="flex flex-col items-center justify-center p-3 bg-white border border-indigo-100 rounded-xl hover:border-purple-400 hover:text-purple-600 transition-all text-[10px] font-bold text-gray-500"><Pill size={16} className="mb-1"/>Fármacos</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-2"><span>Casos en memoria</span><button onClick={() => setShowNewPatientModal(true)} className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors"><Plus size={14}/></button></div>
          <div className="px-2 mb-3"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} /><input type="text" placeholder="Filtrar..." className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-300 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div></div>
          
          <div className="space-y-1.5">
            {filteredPatients.length === 0 && <div className="text-center py-8 opacity-40"><p className="text-[10px] font-bold text-gray-400">Sin casos activos</p></div>}
            {filteredPatients.map(p => (
              <div key={p.id} onClick={() => { setSelectedId(p.id); setMobileMenuOpen(false); }} className={`group w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${selectedId === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}>
                <div className="flex flex-col pr-2 flex-1 min-w-0"><span className="font-bold text-xs break-words">{p.name}</span><span className={`text-[10px] font-semibold truncate ${selectedId === p.id ? 'text-indigo-200' : 'text-gray-400'}`}>{p.diagnosis}</span></div>
                <button onClick={(e) => handleDeletePatient(p.id, e)} className={`p-1.5 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors ${selectedId === p.id ? 'text-indigo-300 hover:text-white hover:bg-indigo-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t bg-white"><button onClick={handleExit} className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"><LogOut size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Salir</span></button></div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        <header className="bg-white/80 backdrop-blur-md border-b h-16 flex items-center px-6 justify-between z-20">
          <div className="flex items-center space-x-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400"><Menu size={24} /></button>
            {selectedPatient && <button onClick={() => setShowLeftPanel(!showLeftPanel)} className="hidden lg:block text-gray-400 hover:text-indigo-600 transition-colors">{showLeftPanel ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}</button>}
            <div className="flex flex-col"><h1 className="font-black text-gray-800 text-lg tracking-tight leading-none truncate max-w-md">{selectedPatient ? selectedPatient.name : 'Bienvenido, Residente'}</h1>{selectedPatient && <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{selectedPatient.diagnosis}</span>}</div>
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl flex items-center space-x-2 text-[10px] font-bold tracking-widest uppercase"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div><span>Sesión Volátil</span></div>
        </header>

        {selectedPatient ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className={`${showLeftPanel ? 'lg:w-1/2 border-r' : 'hidden'} flex flex-col bg-white h-full transition-all duration-300`}>
              <div className="flex border-b text-[10px] font-black uppercase tracking-[0.2em] bg-gray-50/50">
                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'docs' ? 'text-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>1. Datos</button>
                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'timeline' ? 'text-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>2. Historia</button>
                <button onClick={() => setActiveTab('forms')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'forms' ? 'text-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>3. Trámites</button>
                <button onClick={() => setActiveTab('learning')} className={`flex-1 py-4 transition-all ${activeTab === 'learning' ? 'text-white bg-indigo-600' : 'text-indigo-400 hover:text-indigo-600'}`}>4. Aprender</button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                {activeTab === 'docs' && (
                  <div className="space-y-6">
                    {/* CAMBIO 3: Eliminado el cartel de advertencia amarillo */}
                    
                    <FileUploader label="Documentos del Caso" files={selectedPatient.files} setFiles={(newFiles) => updateCurrentPatient({ files: newFiles })} />
                    <textarea 
                      className="w-full h-32 p-4 border-2 border-gray-100 rounded-2xl text-xs font-medium bg-gray-50 focus:bg-white focus:border-indigo-200 transition-all outline-none resize-none shadow-inner" 
                      placeholder="Notas del caso, resumen manual..." 
                      value={selectedPatient.historyText}
                      onChange={(e) => updateCurrentPatient({ historyText: e.target.value })}
                    />
                    <button onClick={handleProcessTimeline} disabled={isProcessingDocs} className="w-full bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black tracking-widest shadow-xl shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 transition-all uppercase">
                      {isProcessingDocs ? <><Loader2 className="animate-spin inline mr-2" size={14}/>Analizando...</> : "Procesar Historia Clínica"}
                    </button>
                  </div>
                )}

                {activeTab === 'timeline' && (
                   <div className="space-y-4">
                     {selectedPatient.timeline.length === 0 ? (
                       <div className="text-center py-10 text-gray-400 font-bold text-[10px] uppercase opacity-60">Sin eventos. Procese documentos en la pestaña 1.</div>
                     ) : (
                       selectedPatient.timeline.map((ev, i) => (
                         <div key={i} className="relative pl-10 border-l-4 border-gray-100 pb-8">
                           <div className={`absolute -left-[14px] top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-md ${ev.isKey ? 'bg-red-500' : 'bg-indigo-400'}`}></div>
                           <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                             <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">{ev.date}</span>
                             <p className="mt-2 text-[10px] text-gray-600">{ev.note}</p>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                )}
                
                {activeTab === 'forms' && <FormManager patient={selectedPatient as any} historyText={selectedPatient.historyText} files={selectedPatient.files} />}
                
                {activeTab === 'learning' && (
                   <ResidentLearningModule 
                     caseContext={`
                       PACIENTE: ${selectedPatient.name}. EDAD: ${selectedPatient.age}. DIAGNÓSTICO: ${selectedPatient.diagnosis}.
                       NOTAS CLÍNICAS: ${selectedPatient.historyText || "No hay notas cargadas."}
                     `} 
                     files={selectedPatient.files}
                   />
                )}
              </div>
            </div>

            <div className={`${showLeftPanel ? 'lg:w-1/2' : 'w-full'} flex flex-col bg-gray-50 h-full overflow-hidden relative`}>
               <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                 {selectedPatient.chatHistory.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30 select-none">
                     <div className="bg-white p-8 rounded-[2.5rem] shadow-sm"><MessageSquare size={48} className="text-indigo-600" /></div>
                     {/* CAMBIO 2: Texto por defecto ajustado al profesional */}
                     <p className="text-xs font-black uppercase tracking-widest">Asistente Oncológico</p>
                   </div>
                 )}
                 {selectedPatient.chatHistory.map((m, i) => (
                   <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-5 rounded-[2rem] text-xs shadow-md font-medium ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}>
                       <div className="whitespace-pre-wrap">{m.text}</div>
                     </div>
                   </div>
                 ))}
                 {isTyping && <div className="text-[10px] text-gray-400 font-bold animate-pulse pl-4">Analizando...</div>}
                 <div ref={chatEndRef} />
               </div>
               <div className="p-6 bg-white/80 backdrop-blur-md border-t">
                 <div className="relative flex items-center bg-gray-50 rounded-3xl border-2 border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all p-3 pl-6">
                   {/* CAMBIO 2: Placeholder ajustado */}
                   <textarea className="flex-1 bg-transparent text-xs font-bold outline-none resize-none max-h-32 scrollbar-hide py-2" placeholder="Escriba su consulta..." rows={1} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                   <button onClick={handleSendMessage} disabled={!chatInput.trim()} className="ml-3 p-3 bg-indigo-600 text-white rounded-2xl shadow-lg disabled:opacity-50"><MessageSquare size={20} /></button>
                 </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-80">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 max-w-sm">
              <GraduationCap size={64} className="mb-6 text-indigo-500 mx-auto" />
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Espacio de Formación</h2>
              <p className="text-gray-400 text-xs mt-4 font-bold leading-relaxed">Cree un caso temporal para comenzar a trabajar, estudiar y practicar.</p>
              <button onClick={() => setShowNewPatientModal(true)} className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase">Iniciar Caso</button>
            </div>
          </div>
        )}
      </main>

      {showNewPatientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-indigo-50/50">
              <h3 className="font-black text-indigo-900 text-[10px] uppercase tracking-widest">Nuevo Caso de Estudio</h3>
              <button onClick={() => setShowNewPatientModal(false)} className="text-gray-400 hover:text-indigo-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreatePatient} className="p-8 space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Identificación</label><input autoFocus type="text" required className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-indigo-200 outline-none transition-all" placeholder="Ej: Paciente A.B." value={newName} onChange={e => setNewName(e.target.value)} /></div>
              <div className="flex space-x-4">
                <div className="w-1/3 space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Edad</label><input type="number" required className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-indigo-200 outline-none transition-all" placeholder="--" value={newAge} onChange={e => setNewAge(e.target.value)} /></div>
                <div className="w-2/3 space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Diagnóstico</label><input type="text" required className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-indigo-200 outline-none transition-all" placeholder="Ej: Ca Pulmón" value={newDx} onChange={e => setNewDx(e.target.value)} /></div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all uppercase tracking-widest">Crear Caso Temporal</button>
            </form>
          </div>
        </div>
      )}

      {showCalc && <OncoCalculator onClose={() => setShowCalc(false)} />}
      {showDrugs && <DrugReference onClose={() => setShowDrugs(false)} />}
    </div>
  );
};

export default ResidentApp;
