import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
    User, FileText, MessageSquare, Plus, LogOut, Search, ChevronRight,
    Upload, Stethoscope, Activity, Trash2, Save, Menu, X, Clock,
    List, File, Loader2, AlertCircle, ShieldAlert, Info, Terminal,
    Calendar, PenTool
} from 'lucide-react';

import { 
    subscribeToPatients, 
    createPatient, 
    updatePatient, 
    deletePatient,
    uploadFile,
    Patient,
    ClinicalNote 
} from './patientService';

// --- Types ---
interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

interface ClinicalEvent {
    date: string;
    professional: string;
    category: string;
    note: string;
    isKey: boolean; 
}

interface FileData {
    name: string;
    type: string;
    data: string; // base64
}

// --- API Helpers (Sin cambios) ---
const extractTimelineFromDocs = async (historyText: string, historyFiles: FileData[]): Promise<ClinicalEvent[]> => {
    if (!historyText && historyFiles.length === 0) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.0-flash'; 
        const parts: any[] = [];
        parts.push({ text: "Analiza los documentos. Extrae eventos con: 1. Fecha 2. Profesional 3. Categoría 4. Resumen 5. isKey (true si es crítico)." });
        if (historyText) parts.push({ text: `Historia manual: ${historyText}` });
        for (const file of historyFiles) {
            parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            professional: { type: Type.STRING },
                            category: { type: Type.STRING },
                            note: { type: Type.STRING },
                            isKey: { type: Type.BOOLEAN }
                        },
                        required: ["date", "professional", "category", "note", "isKey"]
                    }
                }
            }
        });
        if (response.text) return JSON.parse(response.text);
        return [];
    } catch (e: any) {
        console.error("Extraction error:", e);
        throw e;
    }
};

const getAIResponse = async (historyText: string, historyFiles: FileData[], timeline: ClinicalEvent[], guidelineFiles: FileData[], messages: ChatMessage[], newMessage: string) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "ERROR: API_KEY no configurada.";
    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.0-flash'; 
        const parts: any[] = [];
        let contextPrompt = "CONTEXTO ONCOLÓGICO:\n";
        if (timeline?.length > 0) {
            contextPrompt += "\nEVENTOS:\n";
            timeline.forEach(t => contextPrompt += `- ${t.date}: ${t.note}\n`);
        }
        parts.push({ text: contextPrompt });
        for (const file of historyFiles.slice(0, 3)) parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        const recentMessages = messages.slice(-5);
        let conversationHistory = "\nCHAT:\n";
        recentMessages.forEach(msg => conversationHistory += `${msg.role}: ${msg.text}\n`);
        parts.push({ text: conversationHistory });
        parts.push({ text: `\nCONSULTA: ${newMessage}` });

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: { systemInstruction: "Eres oncólogo experto. Usa guías NCCN." }
        });
        return response.text || "Sin respuesta.";
    } catch (error: any) {
        return `ERROR IA: ${error.message}`;
    }
};

// --- Components ---

const FileUploader = ({ label, files, setFiles, accept = "application/pdf,image/*" }: { label: string, files: FileData[], setFiles: (f: FileData[]) => void, accept?: string }) => {
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: FileData[] = [];
            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i];
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                    reader.onload = (evt) => {
                        if (evt.target?.result) {
                            const base64 = (evt.target.result as string).split(',')[1];
                            newFiles.push({ name: file.name, type: file.type, data: base64 });
                        }
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }
            setFiles([...files, ...newFiles]);
        }
    };
    return (
        <div className="mb-4">
            <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">{label}</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[10px] border border-blue-100 font-bold">
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 text-blue-300 hover:text-blue-600"><X size={12} /></button>
                    </div>
                ))}
            </div>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-100 border-dashed rounded-2xl cursor-pointer bg-gray-50 hover:bg-white hover:border-blue-300 transition-all group">
                <Upload className="w-5 h-5 text-gray-300 group-hover:text-blue-400 mb-1" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Seleccionar Archivos</span>
                <input type="file" className="hidden" multiple accept={accept} onChange={handleFileChange} />
            </label>
        </div>
    );
};

const App = () => {
    const [doctorName, setDoctorName] = useState<string | null>(localStorage.getItem('doctor_name'));
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    
    // UI States
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isCreatingPatient, setIsCreatingPatient] = useState(false); // NUEVO: Para evitar doble click
    
    // Forms
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientAge, setNewPatientAge] = useState('');
    const [newPatientDiagnosis, setNewPatientDiagnosis] = useState('');

    // Selected Patient Data
    const [historyText, setHistoryText] = useState('');
    const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]); // NUEVO: Evoluciones
    const [newNoteText, setNewNoteText] = useState(''); // Input nueva evolución

    const [historyFiles, setHistoryFiles] = useState<FileData[]>([]);
    const [timeline, setTimeline] = useState<ClinicalEvent[]>([]);
    const [guidelineFiles, setGuidelineFiles] = useState<FileData[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    
    // Chat & Processing
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessingDocs, setIsProcessingDocs] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'docs' | 'timeline' | 'evolutions'>('docs'); // NUEVO TAB
    
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeToPatients((data) => setPatients(data));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (doctorName) localStorage.setItem('doctor_name', doctorName);
    }, [doctorName]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    useEffect(() => {
        if (selectedPatientId) {
            const p = patients.find(pat => pat.id === selectedPatientId);
            if (p) {
                setHistoryText(p.historyText || '');
                setClinicalNotes(p.clinicalNotes || []); // Cargar evoluciones
                setChatMessages(p.chatHistory || []);
                setTimeline(p.timeline || []); 
                setHistoryFiles([]); setGuidelineFiles([]);
                setLastError(null);
                // Si estaba en evoluciones, quedarse ahí, sino ir a docs
                setActiveTab(prev => prev === 'evolutions' ? 'evolutions' : 'docs');
            }
        }
    }, [selectedPatientId, patients]);

    // --- HANDLERS ---

    const handleCreatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isCreatingPatient) return; // BLOQUEAR si ya se está creando

        setIsCreatingPatient(true);
        const newPatient: Patient = {
            name: newPatientName,
            age: parseInt(newPatientAge),
            diagnosis: newPatientDiagnosis,
            historyText: '',
            clinicalNotes: [],
            lastUpdated: Date.now(),
            chatHistory: [],
            timeline: []
        };

        try {
            await createPatient(newPatient);
            setShowNewPatientModal(false);
            setNewPatientName(''); setNewPatientAge(''); setNewPatientDiagnosis('');
        } catch (e: any) {
            setLastError("Error creando paciente: " + e.message);
        } finally {
            setIsCreatingPatient(false); // DESBLOQUEAR
        }
    };

    const handleDeletePatient = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar este paciente y todos sus datos?")) {
            if (selectedPatientId === id) setSelectedPatientId(null);
            await deletePatient(id);
        }
    };

    const handleProcessDocuments = async () => {
        if (!historyText && historyFiles.length === 0) return;
        setIsProcessingDocs(true);
        setLastError(null);
        try {
            const events = await extractTimelineFromDocs(historyText, historyFiles);
            setTimeline(events);
            if (selectedPatientId) {
                await updatePatient(selectedPatientId, { timeline: events, historyText });
            }
            setActiveTab('timeline');
        } catch (e: any) {
            setLastError(e.message || "Error al procesar documentos.");
        } finally {
            setIsProcessingDocs(false);
        }
    };

    // NUEVO: Guardar Evolución
    const handleAddNote = async () => {
        if (!newNoteText.trim() || !selectedPatientId) return;
        
        const newNote: ClinicalNote = {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            text: newNoteText
        };

        const updatedNotes = [newNote, ...clinicalNotes]; // La más nueva primero
        setClinicalNotes(updatedNotes);
        setNewNoteText('');

        await updatePatient(selectedPatientId, { clinicalNotes: updatedNotes });
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;
        const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updatedUserMsgs = [...chatMessages, newUserMsg];
        setChatMessages(updatedUserMsgs);
        setChatInput('');
        setIsTyping(true);
        
        const responseText = await getAIResponse(historyText, historyFiles, timeline, guidelineFiles, updatedUserMsgs, newUserMsg.text);
        
        const newAiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        const updatedAllMsgs = [...updatedUserMsgs, newAiMsg];
        setChatMessages(updatedAllMsgs);
        setIsTyping(false);
        await updatePatient(selectedPatientId, { chatHistory: updatedAllMsgs });
    };

    // --- RENDER ---

    if (!doctorName) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-gray-100 text-center">
                <div className="inline-block bg-blue-600 p-5 rounded-3xl shadow-xl shadow-blue-100 mb-8"><Stethoscope className="text-white w-10 h-10" /></div>
                <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tighter">OncoGuide AI</h1>
                <input type="text" className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-100 outline-none transition-all font-bold text-center" placeholder="Tu Nombre Profesional" onKeyDown={(e) => {if(e.key==='Enter' && (e.target as any).value) setDoctorName((e.target as any).value)}} />
            </div>
        </div>
    );

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    return (
        <div className="flex h-screen overflow-hidden bg-white text-gray-800 font-medium">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div 
                    onClick={() => setSelectedPatientId(null)} // CLICK EN LOGO PARA VOLVER AL HOME
                    className="p-6 border-b flex items-center justify-between bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center space-x-2 text-blue-600 font-black text-xl tracking-tighter"><Activity size={28} /><span>OncoGuide</span></div>
                    <button onClick={(e) => {e.stopPropagation(); setMobileMenuOpen(false);}} className="lg:hidden text-gray-300"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <div className="flex items-center justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest px-2 mb-4"><span>Pacientes (Cloud)</span><button onClick={() => setShowNewPatientModal(true)} className="text-blue-600 bg-blue-50 p-1.5 rounded-xl hover:bg-blue-100"><Plus size={16}/></button></div>
                        <div className="space-y-2">
                            {patients.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin pacientes</p>}
                            {patients.map(p => (
                                <div key={p.id} onClick={() => {setSelectedPatientId(p.id!); setMobileMenuOpen(false);}} className={`group w-full text-left p-4 rounded-[1.5rem] transition-all flex items-center justify-between cursor-pointer ${selectedPatientId === p.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}>
                                    <div className="flex flex-col truncate pr-2">
                                        <span className="font-black text-sm truncate">{p.name}</span>
                                        <span className={`text-[10px] font-bold truncate ${selectedPatientId === p.id ? 'text-blue-100 opacity-80' : 'text-gray-400'}`}>{p.diagnosis}</span>
                                    </div>
                                    {/* BOTÓN DE BORRAR */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeletePatient(p.id!); }}
                                        className={`p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 ${selectedPatientId === p.id ? 'hover:bg-blue-500 text-white' : 'hover:bg-red-50 text-gray-300 hover:text-red-500'}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-3 truncate">
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-50">{doctorName[0]}</div>
                        <div className="flex flex-col truncate"><span className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">Profesional</span><span className="text-xs font-black truncate leading-none">Dr. {doctorName}</span></div>
                    </div>
                    <button onClick={() => setDoctorName(null)} className="text-gray-200 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white/80 backdrop-blur-md border-b h-20 flex items-center px-8 justify-between z-20">
                    <div className="flex items-center space-x-6">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400"><Menu size={28} /></button>
                        <div className="flex flex-col">
                            <h1 className="font-black text-gray-800 text-2xl tracking-tight leading-none truncate max-w-xs">{selectedPatient ? selectedPatient.name : 'Bienvenido'}</h1>
                            {selectedPatient && <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">{selectedPatient.diagnosis} • {selectedPatient.age} Años</span>}
                        </div>
                    </div>
                </header>

                {selectedPatient ? (
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50">
                        {/* Left Panel */}
                        <div className="lg:w-1/2 flex flex-col border-r bg-white h-full overflow-hidden shadow-2xl relative z-10">
                            {/* PESTAÑAS DE NAVEGACIÓN */}
                            <div className="flex border-b text-[10px] font-black uppercase tracking-[0.2em] bg-gray-50/50">
                                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-6 transition-all border-r border-gray-100 ${activeTab === 'docs' ? 'text-blue-600 bg-white' : 'text-gray-300 hover:text-gray-500'}`}>1. Historia</button>
                                <button onClick={() => setActiveTab('evolutions')} className={`flex-1 py-6 transition-all border-r border-gray-100 ${activeTab === 'evolutions' ? 'text-blue-600 bg-white' : 'text-gray-300 hover:text-gray-500'}`}>2. Evoluciones</button>
                                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-6 transition-all ${activeTab === 'timeline' ? 'text-blue-600 bg-white' : 'text-gray-300 hover:text-gray-500'}`}>3. Línea de Tiempo</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
                                {activeTab === 'docs' && (
                                    <>
                                        <section className="space-y-6">
                                            <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 pb-2">Resumen de Historia Clínica</h3>
                                            <textarea className="w-full h-40 p-6 border-2 border-gray-50 rounded-3xl text-sm font-semibold bg-gray-50 focus:bg-white focus:border-blue-100 transition-all outline-none resize-none shadow-inner" placeholder="Escribe el resumen base del paciente..." value={historyText} onChange={(e) => setHistoryText(e.target.value)} onBlur={() => updatePatient(selectedPatient.id!, { historyText })} />
                                            
                                            <FileUploader label="Adjuntar Estudios (PDF/Img)" files={historyFiles} setFiles={setHistoryFiles} />
                                            
                                            <button onClick={handleProcessDocuments} disabled={isProcessingDocs} className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] text-xs font-black tracking-widest shadow-2xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center">
                                                {isProcessingDocs ? <><Loader2 className="animate-spin mr-2" size={18}/>Analizando Documentos...</> : "ANALIZAR CON IA"}
                                            </button>
                                        </section>
                                        <section className="space-y-6 pt-4">
                                            <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 pb-2">Material de Referencia</h3>
                                            <FileUploader label="Guías NCCN / Protocolos" files={guidelineFiles} setFiles={setGuidelineFiles} accept=".pdf" />
                                        </section>
                                    </>
                                )}

                                {activeTab === 'evolutions' && (
                                    <div className="space-y-6">
                                        <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100">
                                            <div className="flex items-center space-x-2 mb-4 text-blue-600">
                                                <PenTool size={16} />
                                                <span className="text-xs font-black uppercase tracking-widest">Nueva Evolución</span>
                                            </div>
                                            <textarea 
                                                className="w-full h-24 bg-white rounded-xl p-4 text-sm font-medium outline-none border border-transparent focus:border-blue-200 transition-all mb-4" 
                                                placeholder="Escribe la evolución del día..."
                                                value={newNoteText}
                                                onChange={(e) => setNewNoteText(e.target.value)}
                                            />
                                            <button onClick={handleAddNote} disabled={!newNoteText.trim()} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all w-full">Agregar Evolución</button>
                                        </div>

                                        <div className="space-y-4">
                                            {clinicalNotes.length === 0 && <p className="text-center text-gray-400 text-xs py-10 font-medium">No hay evoluciones registradas.</p>}
                                            {clinicalNotes.map((note) => (
                                                <div key={note.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center space-x-2 mb-2 text-gray-400">
                                                        <Calendar size={12} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{note.date}</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'timeline' && (
                                    <div className="space-y-4 pt-4">
                                        {timeline.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-gray-200"><Clock size={48} className="mb-4 opacity-10" /><p className="text-xs font-black uppercase tracking-widest">Sin línea de tiempo</p></div>
                                        ) : (
                                            timeline.map((ev, i) => (
                                                <div key={i} className="relative pl-10 border-l-4 border-gray-50 pb-8 group">
                                                    <div className={`absolute -left-[14px] top-2 w-6 h-6 rounded-full border-4 border-white shadow-xl transition-all group-hover:scale-110 flex items-center justify-center ${ev.isKey ? 'bg-red-500 text-white' : 'bg-blue-400 text-white'}`}>
                                                        {ev.isKey ? <AlertCircle size={10}/> : <Info size={10}/>}
                                                    </div>
                                                    <div className={`p-6 rounded-[2rem] border-2 transition-all hover:shadow-2xl ${ev.isKey ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-50 shadow-sm'}`}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full tracking-widest uppercase ${ev.isKey ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'bg-blue-50 text-blue-600'}`}>{ev.date}</span>
                                                            <span className="text-[10px] text-gray-300 font-black uppercase truncate max-w-[150px]">{ev.professional}</span>
                                                        </div>
                                                        <h4 className={`font-black text-sm mb-2 uppercase tracking-tight ${ev.isKey ? 'text-red-900' : 'text-gray-800'}`}>{ev.category}</h4>
                                                        <p className={`leading-relaxed text-xs font-semibold ${ev.isKey ? 'text-red-800' : 'text-gray-500'}`}>{ev.note}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel: Chat (Sin cambios mayores) */}
                        <div className="lg:w-1/2 flex flex-col bg-gray-50 h-full overflow-hidden relative">
                            {lastError && (
                                <div className="absolute top-4 left-4 right-4 z-30 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-start space-x-3 border border-red-500 animate-in slide-in-from-top">
                                    <Terminal className="flex-shrink-0 mt-1" size={18}/>
                                    <div><p className="text-[10px] font-black uppercase tracking-widest mb-1">Error:</p><p className="text-xs font-bold leading-tight">{lastError}</p></div>
                                    <button onClick={() => setLastError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={16}/></button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30 select-none">
                                        <div className="bg-white p-8 rounded-[3rem] shadow-sm"><MessageSquare size={56} className="text-blue-600" /></div>
                                        <div className="space-y-2"><p className="text-sm font-black uppercase tracking-widest">Asistente Oncológico</p><p className="text-xs font-bold max-w-[220px] mx-auto leading-relaxed">Analice el caso clínico y contraste con las guías internacionales.</p></div>
                                    </div>
                                )}
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-sm shadow-xl leading-relaxed font-bold ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-100' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                                            <div className="whitespace-pre-wrap">{m.text}</div>
                                            <div className={`text-[9px] mt-4 font-black uppercase tracking-widest ${m.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-300'}`}>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    </div>
                                ))}
                                {isTyping && <div className="flex justify-start"><div className="bg-white px-6 py-4 rounded-[1.5rem] border border-gray-100 shadow-sm animate-pulse text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">IA Razonando...</div></div>}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-8 bg-white/80 backdrop-blur-md border-t">
                                <div className="relative flex items-center bg-gray-50 rounded-[2rem] border-2 border-transparent focus-within:border-blue-100 focus-within:bg-white transition-all p-3 pl-6">
                                    <textarea className="flex-1 bg-transparent text-sm font-bold outline-none resize-none max-h-32 scrollbar-hide py-2" placeholder="Consulta Médica..." rows={2} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                                    <button onClick={handleSendMessage} disabled={!chatInput.trim() || isTyping} className="ml-3 p-4 bg-blue-600 text-white rounded-[1.5rem] shadow-xl shadow-blue-100 disabled:opacity-50 active:scale-90 transition-all"><MessageSquare size={24} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50">
                        <div className="bg-white p-16 rounded-[4rem] shadow-2xl border border-gray-100 max-w-sm">
                            <Activity size={80} className="mb-8 text-blue-600 mx-auto opacity-10 animate-pulse" />
                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Consola de Decisión</h2>
                            <p className="text-gray-400 text-sm mt-4 font-bold leading-relaxed">Seleccione un paciente o inicie un nuevo registro.</p>
                            <button onClick={() => setShowNewPatientModal(true)} className="mt-10 bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-xs tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 uppercase">Nuevo Paciente</button>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal */}
            {showNewPatientModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-6">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden transform animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Registro Clínico</h3>
                            <button onClick={() => setShowNewPatientModal(false)} className="text-gray-300 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreatePatient} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Paciente</label>
                                <input type="text" required className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="Nombre Completo" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                            </div>
                            <div className="flex space-x-6">
                                <div className="w-1/3 space-y-3">
                                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Edad</label>
                                    <input type="number" required className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="--" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} />
                                </div>
                                <div className="w-2/3 space-y-3">
                                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Base</label>
                                    <input type="text" required className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="Ej: Ca Mama" value={newPatientDiagnosis} onChange={e => setNewPatientDiagnosis(e.target.value)} />
                                </div>
                            </div>
                            {/* BOTÓN BLOQUEADO SI ESTÁ CARGANDO */}
                            <button 
                                type="submit" 
                                disabled={isCreatingPatient}
                                className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] text-xs font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                {isCreatingPatient ? "Registrando..." : "Registrar Paciente"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
