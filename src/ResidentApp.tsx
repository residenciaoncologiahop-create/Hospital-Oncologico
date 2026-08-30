import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, Plus, Search, Trash2, LogOut, Menu, X, 
  FileText, Clock, GraduationCap, Calculator, Pill, 
  MessageSquare, Loader2, AlertCircle, ClipboardList, CalendarHeart, Info, Maximize2, Minimize2, Sparkles
} from 'lucide-react';

import FormManager from './components/FormManager';
import OncoCalculator from './components/OncoCalculator';
import DrugReference from './components/DrugReference';
import FileUploader from './components/FileUploader';
import ResidentLearningModule from './components/ResidentLearningModule';
import ClinicalAuditModal from './components/ClinicalAuditModal';
import ClinicalReportModal from './components/ClinicalReportModal';
import ClinicalEvolutionModal from './components/ClinicalEvolutionModal';

import { 
  getResidentChatResponse, 
  extractResidentTimeline, 
  generateResidentClinicalSummary,
  generateFollowUpPlan,
  generateOncologyVerification 
} from './utils/residentAI';
import { consolidateTimelineEvents } from './utils/aiProxy';

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
  const [patients, setPatients] = useState<ResidentPatient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'timeline' | 'forms' | 'learning'>('docs');
  
  const [showCalc, setShowCalc] = useState(false);
  const [showDrugs, setShowDrugs] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState('Todas');

  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditContent, setAuditContent] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const [reportModal, setReportModal] = useState({ isOpen: false, title: '', content: '' as string | null, isLoading: false });
  const [guidelineFiles, setGuidelineFiles] = useState<{ name: string; type: string; data: string }[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isChatFullScreen, setIsChatFullScreen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('oncoguide_chat', { detail: { open: showChat } }));
  }, [showChat]);

  const [isProcessingDocs, setIsProcessingDocs] = useState(false);

  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newDx, setNewDx] = useState('');

  const selectedPatient = patients.find(p => p.id === selectedId);
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const isLearningMode = activeTab === 'learning';

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedPatient?.chatHistory, isTyping]);

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

  const renderMarkdown = (text: string) => {
    const cleanText = text.replace(/\[(?:Dato Documentado|Dato Estructurado|Dato no estructurado|Inferencia|Hipótesis|Dato Clínico)\]:\s*/gi, '');
    return cleanText.split('\n').map((line, i) => {
      if (/^###\s+/.test(line)) {
        const heading = line.replace(/^###\s+/, '');
        return (
          <h4 key={i} className="text-xs font-black uppercase tracking-wider text-indigo-900 mt-3 mb-1.5 border-b border-indigo-100 pb-0.5">
            {heading}
          </h4>
        );
      }
      if (/^##\s+/.test(line)) {
        const heading = line.replace(/^##\s+/, '');
        return (
          <h3 key={i} className="text-xs font-black uppercase tracking-wider text-indigo-950 mt-3.5 mb-1.5">
            {heading}
          </h3>
        );
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const content = line.replace(/^\s*[-*]\s+/, '');
        return <div key={i} className="flex gap-2 mb-1 pl-1"><span className="text-indigo-500 mt-0.5 flex-shrink-0 font-bold">•</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}/></div>;
      }
      if (/^\d+\.\s+/.test(line)) {
        const num = line.match(/^(\d+)\./)?.[1];
        const content = line.replace(/^\d+\.\s+/, '');
        return <div key={i} className="flex gap-2 mb-1 pl-1"><span className="text-indigo-500 flex-shrink-0 font-bold">{num}.</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}/></div>;
      }
      if (!line.trim()) return <div key={i} className="h-1.5"/>;
      return <p key={i} className="mb-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}/>;
    });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedPatient) return;
    const newMsg = { role: 'user' as const, text: chatInput, timestamp: Date.now() };
    const updatedHistory = [...selectedPatient.chatHistory, newMsg];
    updateCurrentPatient({ chatHistory: updatedHistory });
    setChatInput(''); setIsTyping(true);

    const eventsText = (selectedPatient.timeline && selectedPatient.timeline.length > 0)
      ? selectedPatient.timeline.map((e: any) => `• [${e.date}] ${e.category ? `(${e.category}) ` : ''}${e.professional ? `[${e.professional}]: ` : ''}${e.note}${e.detail ? ` — Detalle: ${e.detail}` : ''}`).join('\n')
      : 'Sin eventos previos registrados en la cronología.';

    const context = `INFORMACIÓN CLÍNICA Y ANTECEDENTES DEL PACIENTE:
- Diagnóstico Oncológico: ${selectedPatient.diagnosis || 'No especificado'}
- Edad: ${selectedPatient.age || 'No especificada'} años

CRONOLOGÍA CLÍNICA Y ANTECEDENTES:
${eventsText}

NOTAS CLÍNICAS Y DOCUMENTACIÓN:
${selectedPatient.historyText || 'Sin notas adicionales.'}`;

    const response = await getResidentChatResponse(updatedHistory, newMsg.text, context, selectedPatient.files);
    const aiMsg = { role: 'model' as const, text: response, timestamp: Date.now() };
    updateCurrentPatient({ chatHistory: [...updatedHistory, aiMsg] });
    setIsTyping(false);
  };

  const handleProcessTimeline = async () => {
    if (!selectedPatient) return;
    setIsProcessingDocs(true);
    try {
      const events = await extractResidentTimeline(selectedPatient.historyText, selectedPatient.files);
      const combinedTimeline = consolidateTimelineEvents(selectedPatient.timeline || [], events);
      updateCurrentPatient({ timeline: combinedTimeline });
      setActiveTab('timeline');
    } catch (err) {
      console.error("Error procesando timeline:", err);
    } finally {
      setIsProcessingDocs(false);
    }
  };

  const getEffectiveClinicalText = () => {
    if (!selectedPatient) return '';
    const diagnosisBlock = selectedPatient.diagnosis ? `DIAGNÓSTICO ONCOLÓGICO PRINCIPAL: ${selectedPatient.diagnosis}` : '';
    const timelineContext = selectedPatient.timeline && selectedPatient.timeline.length > 0
      ? `LÍNEA DE TIEMPO DE EVENTOS DEL PACIENTE:\n` +
        selectedPatient.timeline.map((e: any) => `- [${e.date}] (${e.category || 'Evento'} - ${e.professional || 'Médico'}): ${e.note}${e.detail ? ` | ${e.detail}` : ''}${e.isKey ? ' (HITO CLAVE)' : ''}`).join('\n')
      : '';
    return [diagnosisBlock, selectedPatient.historyText, timelineContext].filter(Boolean).join('\n\n');
  };

  const runReportGeneration = async (title: string, generatorFn: (text: string, files: any[], guidelines?: any[], explicitDx?: string) => Promise<string>) => {
    if (!selectedPatient) return;
    const effectiveText = getEffectiveClinicalText();
    if (!effectiveText && selectedPatient.files.length === 0) { 
      alert("Sin datos ni eventos para procesar."); 
      return; 
    }
    setReportModal({ isOpen: true, title, content: null, isLoading: true });
    const htmlResult = await generatorFn(effectiveText, selectedPatient.files, guidelineFiles, selectedPatient.diagnosis);
    setReportModal({ isOpen: true, title, content: htmlResult, isLoading: false });
  };

  const handleRunAudit = async () => {
    if (!selectedPatient) return;
    const effectiveText = getEffectiveClinicalText();
    if (!effectiveText && selectedPatient.files.length === 0) {
      alert("Sin datos ni eventos para auditar.");
      return;
    }
    setShowAuditModal(true); setIsAuditing(true); setAuditContent(null);
    const result = await generateOncologyVerification(effectiveText, selectedPatient.files);
    setAuditContent(result); setIsAuditing(false);
  };

  const handleSaveEvolutionToTimeline = (evolutionText: string) => {
    if (!selectedPatient || !evolutionText) return;
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const newEvent = {
      date: formattedDate,
      professional: 'Residente',
      category: 'Evolución',
      note: evolutionText,
      isKey: true,
    };
    const updatedTimeline = [...(selectedPatient.timeline || []), newEvent];
    updateCurrentPatient({ timeline: updatedTimeline });
  };

  const handleAddStudiesFromEvolution = async (files: { name: string; type: string; data: string }[]): Promise<number> => {
    if (!selectedPatient || !files || files.length === 0) return 0;
    try {
      const rawEvents = await extractResidentTimeline('', files);
      if (rawEvents.length > 0) {
        const combinedTimeline = consolidateTimelineEvents(selectedPatient.timeline || [], rawEvents);
        updateCurrentPatient({ timeline: combinedTimeline });
      }
      return rawEvents.length;
    } catch (err) {
      console.error("Error al extraer y guardar estudios en timeline:", err);
      return 0;
    }
  };

  const handleExit = () => { 
    if (window.confirm("Se borrarán los datos. ¿Salir?")) window.location.reload(); 
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-gray-800 font-sans text-xs overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b flex items-center justify-between bg-[#f8f9fa]">
          <div className="flex items-center space-x-2 text-indigo-600 font-black text-xl tracking-tighter"><GraduationCap size={24} /><span>OncoResidente</span></div>
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
          <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-2">
            <span>Casos en memoria</span>
            <button onClick={() => setShowNewPatientModal(true)} className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors"><Plus size={14}/></button>
          </div>
          <div className="px-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input type="text" placeholder="Filtrar..." className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-300 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
          </div>
          <div className="space-y-1.5">
            {filteredPatients.map(p => (
              <div key={p.id} onClick={() => { setSelectedId(p.id); setMobileMenuOpen(false); }} className={`group w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${selectedId === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}>
                <div className="flex flex-col pr-2 flex-1 min-w-0">
                  <span className="font-bold text-xs break-words">{p.name}</span>
                  <span className={`text-[10px] font-semibold truncate ${selectedId === p.id ? 'text-indigo-200' : 'text-gray-400'}`}>{p.diagnosis}</span>
                </div>
                <button onClick={(e) => handleDeletePatient(p.id, e)} className={`p-1.5 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors ${selectedId === p.id ? 'text-indigo-300 hover:text-white hover:bg-indigo-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t bg-[#f8f9fa]">
          <button onClick={handleExit} className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
            <LogOut size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Salir</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8f9fa]">
        <header className="bg-[#f8f9fa]/95 backdrop-blur-md border-b h-16 flex items-center px-6 justify-between z-20">
          <div className="flex items-center space-x-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400"><Menu size={24} /></button>
            <div className="flex flex-col">
              <h1 className="font-black text-gray-800 text-lg tracking-tight leading-none truncate max-w-md">{selectedPatient ? selectedPatient.name : 'Bienvenido, Residente'}</h1>
              {selectedPatient && <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{selectedPatient.diagnosis}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedPatient && (
              <button
                onClick={() => setShowEvolutionModal(true)}
                className="px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase transition-all bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-100 active:scale-95"
                title="Generar evolución médica para Historia Clínica Digital"
              >
                <Sparkles size={13} />
                <span>Generar Evolución</span>
              </button>
            )}
            <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl flex items-center space-x-2 text-[10px] font-bold tracking-widest uppercase">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
              <span>Sesión Volátil</span>
            </div>
          </div>
        </header>

        {selectedPatient ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* PANEL IZQUIERDO — ancho completo siempre */}
            <div className={`${isLearningMode ? 'w-full' : 'w-full'} flex flex-col bg-[#f8f9fa] h-full transition-all duration-300`}>
              <div className="flex border-b text-[10px] font-black uppercase tracking-[0.2em] bg-gray-50/50">
                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'docs' ? 'text-indigo-600 bg-[#f8f9fa]' : 'text-gray-400 hover:text-gray-600'}`}>1. Datos</button>
                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'timeline' ? 'text-indigo-600 bg-[#f8f9fa]' : 'text-gray-400 hover:text-gray-600'}`}>2. Historia</button>
                <button onClick={() => setActiveTab('forms')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'forms' ? 'text-indigo-600 bg-[#f8f9fa]' : 'text-gray-400 hover:text-gray-600'}`}>3. Trámites</button>
                <button onClick={() => setActiveTab('learning')} className={`flex-1 py-4 transition-all ${activeTab === 'learning' ? 'text-white bg-indigo-600' : 'text-indigo-400 hover:text-indigo-600'}`}>4. Aprender</button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                {activeTab === 'docs' && (
                  <div className="space-y-6">
                    <FileUploader label="Documentos del Caso" files={selectedPatient.files} setFiles={(newFiles) => updateCurrentPatient({ files: newFiles })} />
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button 
                        onClick={() => setShowEvolutionModal(true)}
                        className="flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 p-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all shadow-md"
                      >
                        <Sparkles size={16} className="mb-1" /> Evolución
                      </button>
                      <button 
                        onClick={handleRunAudit} disabled={isAuditing}
                        className="flex flex-col items-center justify-center gap-1 bg-gray-800 text-white hover:bg-gray-700 p-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all shadow-lg"
                      >
                        <ClipboardList size={16} className="mb-1" /> Auditoría
                      </button>
                      <button 
                        onClick={() => runReportGeneration('Resumen Clínico Institucional', generateResidentClinicalSummary)} 
                        className="flex flex-col items-center justify-center gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 p-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border border-indigo-100"
                      >
                        <FileText size={16} className="mb-1" /> Resumen
                      </button>
                      <button 
                        onClick={() => runReportGeneration('Plan de Seguimiento Oncológico', generateFollowUpPlan)} 
                        className="flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 p-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border border-emerald-100"
                      >
                        <CalendarHeart size={16} className="mb-1" /> Seguimiento
                      </button>
                    </div>

                    <FileUploader 
                      label="Guías Clínicas / Protocolos Adjuntos (NCCN, ESMO, ASCO)" 
                      files={guidelineFiles} 
                      setFiles={setGuidelineFiles} 
                      accept=".pdf" 
                      onClearAll={() => setGuidelineFiles([])} 
                      clearAllLabel="Limpiar guías"
                    />

                    <textarea 
                      className="w-full h-64 p-4 border-2 border-gray-100 rounded-2xl text-xs font-medium bg-gray-50 focus:bg-white focus:border-indigo-200 transition-all outline-none resize-none shadow-inner leading-relaxed" 
                      placeholder="Notas manuales del caso..." 
                      value={selectedPatient.historyText} 
                      onChange={(e) => updateCurrentPatient({ historyText: e.target.value })} 
                    />
                    <button 
                      onClick={handleProcessTimeline} 
                      disabled={isProcessingDocs} 
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black tracking-widest shadow-xl shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 transition-all uppercase flex items-center justify-center"
                    >
                      {isProcessingDocs ? <><Loader2 className="animate-spin mr-2" size={14}/>Analizando...</> : "Procesar Historia Clínica"}
                    </button>
                  </div>
                )}

                {activeTab === 'timeline' && (() => {
                  const baseCategories = ['Consulta', 'Imagen', 'Lab', 'Cirugía', 'Quimio', 'Radio', 'Evolución', 'Anatomía Patológica'];
                  const presentCategories = Array.from(new Set((selectedPatient.timeline || []).map((e: any) => e.category).filter(Boolean)));
                  const allCategories = Array.from(new Set([...baseCategories, ...presentCategories]));

                  const normalizeSearch = (str: string) =>
                    (str || '')
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '');

                  const rawList = (selectedPatient.timeline || [])
                    .filter((ev: any) => ev.note && ev.note.trim() !== '' && !ev.note.toLowerCase().includes('sin descripción'));

                  const filteredEvents = rawList.filter((ev: any) => {
                    if (timelineCategoryFilter !== 'Todas') {
                      const catNorm = normalizeSearch(ev.category || '');
                      const filterNorm = normalizeSearch(timelineCategoryFilter);
                      if (!catNorm.includes(filterNorm) && !filterNorm.includes(catNorm)) {
                        return false;
                      }
                    }
                    if (timelineSearch.trim()) {
                      const q = normalizeSearch(timelineSearch.trim());
                      const targetText = normalizeSearch(
                        `${ev.date || ''} ${ev.category || ''} ${ev.professional || ''} ${ev.note || ''} ${ev.detail || ''}`
                      );
                      if (!targetText.includes(q)) {
                        return false;
                      }
                    }
                    return true;
                  });

                  return (
                    <div className="space-y-4 pt-2">
                      {rawList.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input
                              type="text"
                              placeholder="Buscar eventos (ej: carboplatino, biopsia, PET, neutropenia)..."
                              value={timelineSearch}
                              onChange={e => setTimelineSearch(e.target.value)}
                              className="w-full pl-9 pr-8 py-1.5 bg-transparent text-xs font-semibold text-gray-700 placeholder-gray-400 outline-none"
                            />
                            {timelineSearch && (
                              <button
                                onClick={() => setTimelineSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                title="Limpiar búsqueda"
                              >
                                <X size={12}/>
                              </button>
                            )}
                          </div>
                          <div className="h-4 w-px bg-gray-200 hidden sm:block"/>
                          <div className="flex items-center gap-2">
                            <select
                              value={timelineCategoryFilter}
                              onChange={e => setTimelineCategoryFilter(e.target.value)}
                              className="bg-gray-50 sm:bg-transparent px-3 py-1.5 rounded-xl sm:rounded-none text-xs font-bold text-gray-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                            >
                              <option value="Todas">Todas las categorías</option>
                              {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            {(timelineSearch.trim() || timelineCategoryFilter !== 'Todas') && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 whitespace-nowrap">
                                {filteredEvents.length} de {rawList.length}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {rawList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-200">
                          <Clock size={40} className="mb-3 opacity-10" />
                          <p className="text-xs font-black uppercase tracking-widest">Sin eventos. Procesá los documentos primero.</p>
                        </div>
                      ) : filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                          <Search size={28} className="mb-2 opacity-30 text-gray-400"/>
                          <p className="text-xs font-bold text-gray-600">No se encontraron eventos coincidentes</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Prueba con otros términos de búsqueda o selecciona otra categoría</p>
                          <button
                            onClick={() => { setTimelineSearch(''); setTimelineCategoryFilter('Todas'); }}
                            className="mt-3 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Restablecer filtros
                          </button>
                        </div>
                      ) : (
                        filteredEvents.map((ev: any, i: number) => (
                          <div key={i} className="relative pl-10 border-l-4 border-gray-100 pb-8 group">
                            <div className={`absolute -left-[14px] top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-md flex items-center justify-center transition-all group-hover:scale-110 ${ev.isKey ? 'bg-red-500 text-white' : 'bg-indigo-400 text-white'}`}>
                              {ev.isKey ? <AlertCircle size={10}/> : <Info size={10}/>}
                            </div>
                            <div className={`p-5 rounded-2xl border transition-all hover:shadow-xl ${ev.isKey ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-50 shadow-sm'}`}>
                              <div className="flex justify-between items-center mb-2">
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase ${ev.isKey ? 'bg-red-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-600'}`}>{ev.date}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[150px]">{ev.professional}</span>
                              </div>
                              {ev.category && ev.category !== 'General' && (
                                <h4 className={`font-bold text-xs mb-1 uppercase tracking-tight ${ev.isKey ? 'text-red-900' : 'text-gray-800'}`}>{ev.category}</h4>
                              )}
                              <p className={`leading-relaxed text-xs font-medium ${ev.isKey ? 'text-red-900' : 'text-gray-600'}`}>{ev.note}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                {activeTab === 'forms' && (
                  <FormManager patient={selectedPatient as any} historyText={selectedPatient.historyText} files={selectedPatient.files} timeline={selectedPatient?.timeline} />
                )}

                {activeTab === 'learning' && (
                  <ResidentLearningModule 
                    caseContext={`DIAGNÓSTICO: ${selectedPatient.diagnosis}.\nNOTAS: ${selectedPatient.historyText}`} 
                    files={selectedPatient.files}
                  />
                )}
              </div>
            </div>

            {/* BOTÓN FLOTANTE ASISTENTE */}
            {!isLearningMode && (
              <button
                onClick={() => setShowChat(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-indigo-600 text-white pl-4 pr-5 py-3 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                <MessageSquare size={16}/>
                <span className="text-xs font-black uppercase tracking-widest">Asistente</span>
                {selectedPatient.chatHistory.length > 0 && (
                  <span className="w-5 h-5 bg-white text-indigo-600 rounded-full text-[9px] font-black flex items-center justify-center">
                    {selectedPatient.chatHistory.length}
                  </span>
                )}
              </button>
            )}

            {/* DRAWER ASISTENTE */}
            {showChat && !isLearningMode && (
              <div className="fixed inset-0 z-50 flex justify-end">
                <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowChat(false)}/>
                <div className={`relative bg-gray-50 flex flex-col h-full shadow-2xl transition-all duration-300 ${isChatFullScreen ? 'w-full max-w-full' : 'w-full max-w-lg'}`}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-[#f8f9fa] border-b">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-100">
                        <Activity size={13} className="text-white"/>
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800 uppercase tracking-widest">Asistente Oncológico</p>
                        <p className="text-[9px] text-gray-400 font-medium">{selectedPatient.name} · {selectedPatient.diagnosis}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIsChatFullScreen(prev => !prev)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                        title={isChatFullScreen ? "Restaurar tamaño normal" : "Pantalla completa"}
                      >
                        {isChatFullScreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                      </button>
                      <button onClick={() => setShowChat(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all" title="Cerrar">
                        <X size={16}/>
                      </button>
                    </div>
                  </div>
                  {/* Mensajes */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                    {selectedPatient.chatHistory.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 select-none opacity-40">
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                          <MessageSquare size={36} className="text-indigo-200 mx-auto"/>
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-300">Asistente Oncológico</p>
                      </div>
                    )}
                    {selectedPatient.chatHistory.map((m, i) => (
                      <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'model' && (
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-100 mb-1">
                            <Activity size={13} className="text-white"/>
                          </div>
                        )}
                        <div className={`max-w-[82%] rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm px-5 py-3.5' : 'bg-white border border-gray-100 rounded-bl-sm px-5 py-4'}`}>
                          <div className={`leading-relaxed space-y-1 ${m.role === 'user' ? 'text-xs font-semibold' : 'text-xs font-normal text-gray-700'}`}>
                            {m.role === 'model' ? renderMarkdown(m.text) : m.text}
                          </div>
                          <div className={`text-[9px] mt-2 font-black uppercase tracking-widest ${m.role === 'user' ? 'text-indigo-200 text-right' : 'text-gray-300'}`}>
                            {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex items-end gap-2">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-100">
                          <Activity size={13} className="text-white"/>
                        </div>
                        <div className="bg-white px-5 py-3.5 rounded-2xl rounded-bl-sm border border-gray-100 shadow-sm flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef}/>
                  </div>
                  {/* Input */}
                  <div className="p-4 bg-[#f8f9fa]/95 backdrop-blur-md border-t">
                    <div className="flex items-center bg-gray-50 rounded-2xl border-2 border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all p-2.5 pl-4 gap-2">
                      <textarea
                        className="flex-1 bg-transparent text-sm font-medium outline-none resize-none max-h-32 scrollbar-hide py-1"
                        placeholder="Consulta..."
                        rows={1}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || isTyping}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100 disabled:opacity-50 active:scale-90 transition-all flex-shrink-0"
                      >
                        <MessageSquare size={16}/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-80">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 max-w-sm">
              <GraduationCap size={64} className="mb-6 text-indigo-500 mx-auto" />
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Espacio de Formación</h2>
              <p className="text-gray-400 text-xs mt-4 font-bold leading-relaxed">Los casos se almacenan solo en memoria y se borran al salir.</p>
              <button onClick={() => setShowNewPatientModal(true)} className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase">Iniciar Caso</button>
            </div>
          </div>
        )}
      </main>

      {/* MODALES */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-indigo-50/50">
              <h3 className="font-black text-indigo-900 text-[10px] uppercase tracking-widest">Nuevo Caso</h3>
              <button onClick={() => setShowNewPatientModal(false)} className="text-gray-400 hover:text-indigo-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreatePatient} className="p-8 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Identificación del caso</label>
                <input autoFocus type="text" required className="w-full px-5 py-3 bg-gray-50 rounded-xl text-xs font-bold outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 transition-all" placeholder="Ej: Caso Mama HER2+" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Diagnóstico</label>
                <input type="text" className="w-full px-5 py-3 bg-gray-50 rounded-xl text-xs font-bold outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 transition-all" placeholder="Ej: Ca Mama HER2+" value={newDx} onChange={e => setNewDx(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest">Crear</button>
            </form>
          </div>
        </div>
      )}

      {selectedPatient && (
        <ClinicalEvolutionModal
          key={selectedPatient.id || selectedPatient.name}
          isOpen={showEvolutionModal}
          onClose={() => setShowEvolutionModal(false)}
          patientData={{
            hcOrName: selectedPatient.name,
            diagnosis: selectedPatient.diagnosis || 'No especificado',
            age: selectedPatient.age ? `${selectedPatient.age} años` : undefined,
            baselineContext: getEffectiveClinicalText(),
          }}
          onSaveToTimeline={handleSaveEvolutionToTimeline}
          onAddAttachedStudiesToTimeline={handleAddStudiesFromEvolution}
        />
      )}

      {showCalc && <OncoCalculator onClose={() => setShowCalc(false)} />}
      {showDrugs && <DrugReference onClose={() => setShowDrugs(false)} />}
      
      <ClinicalAuditModal isOpen={showAuditModal} onClose={() => setShowAuditModal(false)} content={auditContent} isLoading={isAuditing} />
      
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

export default ResidentApp;
