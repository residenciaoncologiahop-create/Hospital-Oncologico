import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, Plus, Search, Trash2, LogOut, Menu, X, 
  FileText, Clock, FileOutput, Calculator, Pill, 
  Stethoscope, User, ChevronRight, PanelLeftClose, PanelLeftOpen, MessageSquare, Loader2, Sparkles, ClipboardCheck, CalendarHeart, Users 
} from 'lucide-react';

// COMPONENTS
import FormManager from './components/FormManager';
import OncoCalculator from './components/OncoCalculator';
import DrugReference from './components/DrugReference';
import FileUploader from './components/FileUploader';
import ClinicalAuditModal from './components/ClinicalAuditModal';
import ClinicalReportModal from './components/ClinicalReportModal'; // IMPORTANTE

// UTILS: Usamos las funciones de residentAI que tienen el FORMATO CORRECTO
import { 
  getResidentChatResponse, // Puedes usar la versión de chat que prefieras, pero esta es estable
  extractResidentTimeline, 
  generateResidentClinicalSummary, // El generador "Bonito"
  generateFollowUpPlan,            // El generador "Bonito"
  generateTumorBoardAnalysis,      // El generador "Bonito"
  generateOncologyVerification     // La auditoría
} from './utils/residentAI';

interface Patient {
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

const App = () => {
  // --- STATES ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'timeline' | 'forms'>('docs');
  
  // UI & Modals
  const [showCalc, setShowCalc] = useState(false);
  const [showDrugs, setShowDrugs] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // REPORT MODAL STATE (Nuevo para Profesional)
  const [reportModal, setReportModal] = useState({ isOpen: false, title: '', content: '' as string | null, isLoading: false });
  
  // AUDIT STATE
  const [showQCModal, setShowQCModal] = useState(false);
  const [qcContent, setQCContent] = useState<string | null>(null);
  const [isQCProcessing, setIsQCProcessing] = useState(false);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Processing
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);

  // New Patient Form
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newDx, setNewDx] = useState('');

  const selectedPatient = patients.find(p => p.id === selectedId);
  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedPatient?.chatHistory, isTyping]);

  // --- HANDLERS ---

  const updateCurrentPatient = (updates: Partial<Patient>) => {
    setPatients(prev => prev.map(p => p.id === selectedId ? { ...p, ...updates, lastUpdated: Date.now() } : p));
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: Patient = { id: Date.now().toString(), name: newName, age: parseInt(newAge) || 0, diagnosis: newDx, historyText: '', files: [], timeline: [], chatHistory: [], lastUpdated: Date.now() };
    setPatients(prev => [newPatient, ...prev]);
    setSelectedId(newPatient.id);
    setShowNewPatientModal(false);
    setNewName(''); setNewAge(''); setNewDx('');
  };

  const handleDeletePatient = (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (window.confirm("¿Eliminar paciente?")) { setPatients(prev => prev.filter(p => p.id !== id)); if (selectedId === id) setSelectedId(null); } };

  // CHAT (Usamos getResidentChatResponse por estabilidad, o puedes mantener tu propia lógica de chat si era diferente)
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedPatient) return;
    const newMsg = { role: 'user' as const, text: chatInput, timestamp: Date.now() };
    const updatedHistory = [...selectedPatient.chatHistory, newMsg];
    updateCurrentPatient({ chatHistory: updatedHistory });
    setChatInput(''); setIsTyping(true);
    
    // Usamos la función importada de residentAI para consistencia
    const context = `Paciente: ${selectedPatient.name}, ${selectedPatient.age} años. Dx: ${selectedPatient.diagnosis}.\nHistoria: ${selectedPatient.historyText}`;
    const response = await getResidentChatResponse(updatedHistory, newMsg.text, context, selectedPatient.files);
    
    const aiMsg = { role: 'model' as const, text: response, timestamp: Date.now() };
    updateCurrentPatient({ chatHistory: [...updatedHistory, aiMsg] });
    setIsTyping(false);
  };

  const handleProcessTimeline = async () => {
    if (!selectedPatient) return;
    setIsProcessingDocs(true);
    const events = await extractResidentTimeline(selectedPatient.historyText, selectedPatient.files);
    updateCurrentPatient({ timeline: events });
    setIsProcessingDocs(false);
    setActiveTab('timeline');
  };

  // --- HANDLER GENÉRICO DE REPORTES (USANDO LAS FUNCIONES "BONITAS") ---
  const runReportGeneration = async (title: string, generatorFn: (text: string, files: any[]) => Promise<string>) => {
    if (!selectedPatient) return;
    if (!selectedPatient.historyText && selectedPatient.files.length === 0) { alert("Sin documentación para procesar."); return; }

    setReportModal({ isOpen: true, title, content: null, isLoading: true });
    // Llamada a la función importada de residentAI (que devuelve HTML limpio)
    const htmlResult = await generatorFn(selectedPatient.historyText, selectedPatient.files);
    setReportModal({ isOpen: true, title, content: htmlResult, isLoading: false });
  };

  // Handler Control Calidad (Auditoría)
  const handleQualityControl = async () => {
    if (!selectedPatient) return;
    if (!selectedPatient.historyText && selectedPatient.files.length === 0) { alert("Sin documentación."); return; }
    setShowQCModal(true); setIsQCProcessing(true); setQCContent(null);
    const result = await generateOncologyVerification(selectedPatient.historyText, selectedPatient.files);
    setQCContent(result); setIsQCProcessing(false);
  };

  const handleExit = () => { if (window.confirm("¿Cerrar sesión?")) window.location.reload(); };

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans text-xs overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-white border-r border-slate-800 transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-lg tracking-tight"><Activity size={24} className="text-blue-400"/><span>OncoGuide AI</span></div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-400"><X size={24}/></button>
        </div>
        <div className="px-4 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowCalc(true)} className="flex flex-col items-center justify-center p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all text-[10px] font-bold text-slate-300"><Calculator size={16} className="mb-1 text-blue-400"/>Calculadoras</button>
            <button onClick={() => setShowDrugs(true)} className="flex flex-col items-center justify-center p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all text-[10px] font-bold text-slate-300"><Pill size={16} className="mb-1 text-purple-400"/>Fármacos</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2"><span>Pacientes Activos</span><button onClick={() => setShowNewPatientModal(true)} className="text-blue-400 hover:text-white transition-colors"><Plus size={16}/></button></div>
          <div className="px-2 mb-3"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={12} /><input type="text" placeholder="Buscar..." className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-transparent focus:border-blue-500 rounded-lg text-[11px] outline-none text-slate-200 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div></div>
          <div className="space-y-1.5">
            {filteredPatients.map(p => (
              <div key={p.id} onClick={() => { setSelectedId(p.id); setMobileMenuOpen(false); }} className={`group w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${selectedId === p.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
                <div className="flex flex-col pr-2 flex-1 min-w-0"><span className="font-bold text-xs break-words">{p.name}</span><span className={`text-[10px] truncate opacity-70`}>{p.diagnosis}</span></div>
                <button onClick={(e) => handleDeletePatient(p.id, e)} className="p-1.5 rounded-full hover:bg-red-500/20 hover:text-red-400 text-slate-600 transition-colors"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-800"><button onClick={handleExit} className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"><LogOut size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Cerrar Sesión</span></button></div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        <header className="bg-white border-b h-16 flex items-center px-6 justify-between z-20 shadow-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-slate-400"><Menu size={24} /></button>
            {selectedPatient && <button onClick={() => setShowLeftPanel(!showLeftPanel)} className="hidden lg:block text-slate-400 hover:text-blue-600 transition-colors">{showLeftPanel ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}</button>}
            <div className="flex flex-col"><h1 className="font-black text-slate-800 text-lg tracking-tight leading-none truncate max-w-md">{selectedPatient ? selectedPatient.name : 'Panel Profesional'}</h1>{selectedPatient && <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">{selectedPatient.diagnosis}</span>}</div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200"><User size={12} className="text-slate-500"/><span className="text-[10px] font-bold text-slate-600 uppercase">Dr. Oncólogo</span></div>
          </div>
        </header>

        {selectedPatient ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* WORKSPACE */}
            <div className={`${showLeftPanel ? 'lg:w-1/2 border-r' : 'hidden'} flex flex-col bg-white h-full transition-all duration-300`}>
              <div className="flex border-b text-[10px] font-black uppercase tracking-[0.2em] bg-slate-50">
                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-4 transition-all border-r border-slate-200 ${activeTab === 'docs' ? 'text-blue-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>1. Historia & Docs</button>
                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-4 transition-all border-r border-slate-200 ${activeTab === 'timeline' ? 'text-blue-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>2. Cronología</button>
                <button onClick={() => setActiveTab('forms')} className={`flex-1 py-4 transition-all ${activeTab === 'forms' ? 'text-blue-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>3. Formularios</button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                {activeTab === 'docs' && (
                  <div className="space-y-6">
                    <FileUploader label="Historia Clínica Digital (PDF/IMG)" files={selectedPatient.files} setFiles={(newFiles) => updateCurrentPatient({ files: newFiles })} />
                    
                    {/* ACCIONES INTELIGENTES - AHORA USANDO LAS FUNCIONES NUEVAS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        
                        <button 
                          onClick={handleQualityControl}
                          disabled={isQCProcessing}
                          className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm"
                        >
                          <ClipboardCheck size={16} className="text-blue-600 mb-1" /> Control Calidad
                        </button>

                        <button 
                          onClick={() => runReportGeneration('Resumen Clínico Profesional', generateResidentClinicalSummary)}
                          className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm"
                        >
                          <FileText size={16} className="text-indigo-600 mb-1" /> Resumen HC
                        </button>

                        <button 
                          onClick={() => runReportGeneration('Plan de Seguimiento', generateFollowUpPlan)}
                          className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm"
                        >
                          <CalendarHeart size={16} className="text-emerald-600 mb-1" /> Seguimiento
                        </button>

                        <button 
                          onClick={() => runReportGeneration('Presentación Comité Tumores', generateTumorBoardAnalysis)}
                          className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm"
                        >
                          <Users size={16} className="text-amber-600 mb-1" /> Comité
                        </button>

                    </div>

                    <textarea className="w-full h-64 p-4 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 focus:bg-white focus:border-blue-300 transition-all outline-none resize-none shadow-inner leading-relaxed" placeholder="Evolución clínica..." value={selectedPatient.historyText} onChange={(e) => updateCurrentPatient({ historyText: e.target.value })} />
                    <button onClick={handleProcessTimeline} disabled={isProcessingDocs} className="w-full bg-slate-800 text-white py-4 rounded-xl text-[10px] font-black tracking-widest shadow-lg hover:bg-slate-700 transition-all uppercase">{isProcessingDocs ? <><Loader2 className="animate-spin inline mr-2" size={14}/>Procesando...</> : "Actualizar Cronología"}</button>
                  </div>
                )}

                {activeTab === 'timeline' && (
                   <div className="space-y-4">
                     {selectedPatient.timeline.length === 0 ? <div className="text-center py-10 text-slate-400 font-bold text-[10px] uppercase opacity-60">Sin datos cronológicos.</div> : selectedPatient.timeline.map((ev, i) => (
                       <div key={i} className="relative pl-10 border-l-2 border-slate-200 pb-8"><div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${ev.isKey ? 'bg-red-500' : 'bg-blue-400'}`}></div><div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm"><span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{ev.date}</span><p className="mt-2 text-[11px] text-slate-600 leading-relaxed">{ev.note}</p></div></div>
                     ))}
                   </div>
                )}
                {activeTab === 'forms' && <FormManager patient={selectedPatient as any} historyText={selectedPatient.historyText} files={selectedPatient.files} />}
              </div>
            </div>

            {/* CHAT ASISTENTE */}
            <div className={`${showLeftPanel ? 'lg:w-1/2' : 'w-full'} flex flex-col bg-slate-50 h-full overflow-hidden relative border-l border-slate-200`}>
               <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                 {selectedPatient.chatHistory.length === 0 && <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40 select-none"><div className="bg-white p-6 rounded-full shadow-sm"><Stethoscope size={40} className="text-slate-400" /></div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Asistente Clínico Inteligente</p></div>}
                 {selectedPatient.chatHistory.map((m, i) => (
                   <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-4 rounded-2xl text-xs shadow-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-sm'}`}><div className="whitespace-pre-wrap">{m.text}</div></div></div>
                 ))}
                 {isTyping && <div className="text-[10px] text-slate-400 font-bold animate-pulse pl-4">Procesando consulta...</div>}
                 <div ref={chatEndRef} />
               </div>
               <div className="p-4 bg-white border-t border-slate-200"><div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200 focus-within:border-blue-300 focus-within:bg-white transition-all p-2 pl-4"><textarea className="flex-1 bg-transparent text-xs font-medium outline-none resize-none max-h-32 scrollbar-hide py-2" placeholder="Escriba su consulta clínica o solicite bibliografía..." rows={1} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} /><button onClick={handleSendMessage} disabled={!chatInput.trim()} className="ml-2 p-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"><MessageSquare size={18} /></button></div></div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-60">
            <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-100 max-w-md">
              <Activity size={64} className="mb-6 text-blue-500 mx-auto" />
              <h2 className="text-xl font-black text-slate-800 tracking-tight">OncoGuide AI</h2>
              <p className="text-slate-400 text-xs mt-4 font-medium leading-relaxed">Seleccione un paciente del panel lateral o cree un nuevo registro para comenzar.</p>
              <button onClick={() => setShowNewPatientModal(true)} className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-lg uppercase">Nuevo Paciente</button>
            </div>
          </div>
        )}
      </main>

      {/* MODALES */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">Registro de Paciente</h3><button onClick={() => setShowNewPatientModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
            <form onSubmit={handleCreatePatient} className="p-6 space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo</label><input autoFocus type="text" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 transition-all" value={newName} onChange={e => setNewName(e.target.value)} /></div>
              <div className="flex gap-4">
                 <div className="w-1/3 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Edad</label><input type="number" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 transition-all" value={newAge} onChange={e => setNewAge(e.target.value)} /></div>
                 <div className="w-2/3 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diagnóstico</label><input type="text" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 transition-all" value={newDx} onChange={e => setNewDx(e.target.value)} /></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg text-[10px] font-bold shadow-md hover:bg-blue-700 transition-all uppercase tracking-wide">Crear Ficha</button>
            </form>
          </div>
        </div>
      )}

      {showCalc && <OncoCalculator onClose={() => setShowCalc(false)} />}
      {showDrugs && <DrugReference onClose={() => setShowDrugs(false)} />}
      
      {/* MODAL AUDITORÍA (Mismo que residente pero en modo professional para textos sobrios) */}
      <ClinicalAuditModal 
        isOpen={showQCModal} 
        onClose={() => setShowQCModal(false)} 
        content={qcContent} 
        isLoading={isQCProcessing}
        mode="professional"
      />

      {/* MODAL REPORTES (EL NUEVO, VISUALIZADOR HTML) */}
      <ClinicalReportModal 
        isOpen={reportModal.isOpen} 
        onClose={() => setReportModal({ ...reportModal, isOpen: false })} 
        title={reportModal.title} 
        content={reportModal.content} 
        isLoading={reportModal.isLoading} 
      />

    </div>
  );
};

export default App;
