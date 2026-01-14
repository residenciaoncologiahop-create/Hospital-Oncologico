import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
// ------------------------
import { 
    User, FileText, MessageSquare, Plus, LogOut, Search, ChevronRight,
    Upload, Stethoscope, Activity, Trash2, Save, Menu, X, Clock,
    List, File, Loader2, AlertCircle, ShieldAlert, Info, Terminal,
    Calendar, PenTool, FileOutput, FileDown, ClipboardCheck, Presentation, Dna
} from 'lucide-react';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY_FIREBASE,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- AUDIT LOGGING SYSTEM (NUEVO) ---
const getOrInitFingerprint = () => {
    let fp = localStorage.getItem('doctor_fingerprint');
    if (!fp) {
        fp = crypto.randomUUID();
        localStorage.setItem('doctor_fingerprint', fp);
    }
    return fp;
};

const logAction = async (action: string, patientId: string | null, doctorName: string) => {
    try {
        const fingerprint = getOrInitFingerprint();
        await addDoc(collection(db, "audit_logs"), {
            action,
            patientId: patientId || 'N/A',
            doctorName,
            doctorFingerprint: fingerprint,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error("Audit log failed", e);
    }
};
// ------------------------------------

// --- TYPES ---
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }
interface ClinicalEvent { date: string; professional: string; category: string; note: string; isKey: boolean; }
interface Biomarker { name: string; status: string; date: string; technique?: string; } 

interface Patient {
    id: string;
    doctorId: string; 
    name: string;
    age: number;
    diagnosis: string;
    historyText: string;
    lastUpdated: number;
    chatHistory?: ChatMessage[];
    timeline?: ClinicalEvent[];
    biomarkers?: Biomarker[];
}

interface FileData { name: string; type: string; data: string; }

// --- HELPERS ---
const parseDate = (dateStr: string) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    return 0; 
};
const sortTimeline = (events: ClinicalEvent[]) => events.sort((a, b) => parseDate(a.date) - parseDate(b.date));

// --- AI FUNCTIONS ---

// 1. EXTRACT TIMELINE
const extractTimelineFromDocs = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && files.length === 0) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key Missing");
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `
            Extrae la cronología clínica en ESPAÑOL.
            FORMATO: JSON Array.
            CAMPOS: date (DD/MM/YYYY), category (Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución), note (breve), professional, isKey (boolean).
            REGLA: Traduce todo al español.
        `}];
        if (text) parts.push({ text: `Notas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        return sortTimeline(JSON.parse(res.text || "[]"));
    } catch (e) { console.error(e); return []; }
};

// 2. EXTRACT BIOMARKERS
const extractBiomarkersFromDocs = async (text: string, files: FileData[]): Promise<Biomarker[]> => {
    if (!text && files.length === 0) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey! });
        const parts: any[] = [{ text: `
            Actúa como un patólogo molecular. Analiza los documentos y extrae TABLA DE BIOMARCADORES.
            Busca explícitamente: Receptores Hormonales, HER2, Ki67, PD-L1, Mutaciones (EGFR, KRAS, BRAF, BRCA, etc), MSI.
            Retorna un JSON Array con: { "name": "Nombre", "status": "Resultado", "date": "Fecha", "technique": "Técnica" }
            Si no hay datos, devuelve [].
        `}];
        
        if (text) parts.push({ text: `Contexto: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(res.text || "[]");
    } catch (e) { return []; }
};

// 3. GENERATORS
const generateText = async (prompt: string, context: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    const parts: any[] = [{ text: prompt }, { text: context }];
    files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
    const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
    return res.text || "Error.";
};

// 4. CHAT
const getChatResponse = async (msgs: ChatMessage[], newMsg: string, context: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    const parts: any[] = [{ text: `Contexto Clínico:\n${context}` }];
    files.slice(0, 3).forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
    msgs.slice(-5).forEach(m => parts.push({ text: `${m.role}: ${m.text}` }));
    parts.push({ text: newMsg });
    
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { systemInstruction: "Eres oncólogo experto. Responde en español técnico." }
    });
    return res.text || "Error.";
};

// --- COMPONENTS ---

const FileUploader = ({ label, files, setFiles }: any) => {
    const handleChange = async (e: any) => {
        if (e.target.files) {
            const newFiles = [];
            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i];
                const reader = new FileReader();
                await new Promise<void>(resolve => {
                    reader.onload = (evt: any) => {
                        newFiles.push({ name: file.name, type: file.type, data: evt.target.result.split(',')[1] });
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }
            // @ts-ignore
            setFiles([...files, ...newFiles]);
        }
    };
    return (
        <div className="mb-3">
            <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">{label}</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f: any, i: number) => (
                    <div key={i} className="flex items-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] border border-blue-100 font-bold">
                        <span className="truncate max-w-[100px]">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_: any, idx: number) => idx !== i))} className="ml-1 text-blue-300 hover:text-blue-600"><X size={12} /></button>
                    </div>
                ))}
            </div>
            <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-gray-100 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-white hover:border-blue-300 transition-all">
                <Upload className="w-4 h-4 text-gray-300 mb-1" />
                <span className="text-[9px] text-gray-400 font-bold uppercase">Subir PDF/Img</span>
                <input type="file" className="hidden" multiple accept="application/pdf,image/*" onChange={handleChange} />
            </label>
        </div>
    );
};

const App = () => {
    const [doctorName, setDoctorName] = useState<string | null>(localStorage.getItem('doctor_name'));
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [apiKeyExists, setApiKeyExists] = useState<boolean>(!!import.meta.env.VITE_API_KEY);

    // Patient Data
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientAge, setNewPatientAge] = useState('');
    const [newPatientDiagnosis, setNewPatientDiagnosis] = useState('');
    
    const [historyText, setHistoryText] = useState('');
    const [historyFiles, setHistoryFiles] = useState<FileData[]>([]);
    const [timeline, setTimeline] = useState<ClinicalEvent[]>([]);
    const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
    const [guidelineFiles, setGuidelineFiles] = useState<FileData[]>([]);
    
    // Chat & Tools
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzingBio, setIsAnalyzingBio] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualDoctor, setManualDoctor] = useState(doctorName || '');
    const [manualNote, setManualNote] = useState('');

    // Modals
    const [modalContent, setModalContent] = useState({ title: '', text: '', show: false, loading: false });

    const [activeTab, setActiveTab] = useState<'docs' | 'timeline' | 'bio'>('docs');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initial Setup
    useEffect(() => {
        getOrInitFingerprint(); // Ensure fingerprint exists on load
    }, []);

    useEffect(() => {
        if (!doctorName) return;
        const q = query(collection(db, "patients"), where("doctorId", "==", doctorName));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => {
                const data = d.data();
                return { 
                    id: d.id, 
                    ...data,
                    name: data.name || '', 
                    diagnosis: data.diagnosis || ''
                } as Patient;
            });
            list.sort((a, b) => b.lastUpdated - a.lastUpdated);
            setPatients(list);
        });
    }, [doctorName]);

    useEffect(() => {
        if (selectedPatientId) {
            const p = patients.find(pat => pat.id === selectedPatientId);
            if (p) {
                setHistoryText(p.historyText || '');
                setTimeline(p.timeline || []);
                setBiomarkers(p.biomarkers || []);
                setChatMessages(p.chatHistory || []);
                setHistoryFiles([]); setGuidelineFiles([]);
                setActiveTab(p.timeline?.length ? 'timeline' : 'docs');
            }
        }
    }, [selectedPatientId]);

    const savePatient = async (data: Partial<Patient>) => {
        if (!selectedPatientId) return;
        await updateDoc(doc(db, "patients", selectedPatientId), { ...data, lastUpdated: Date.now() });
        // Log basic update
        if(doctorName) logAction('UPDATE_PATIENT_DATA', selectedPatientId, doctorName);
    };

    // --- HANDLERS ---

    const handleProcessDocs = async () => {
        if (!historyText && historyFiles.length === 0) return;
        setIsProcessing(true);
        const events = await extractTimelineFromDocs(historyText, historyFiles);
        const newTimeline = sortTimeline([...timeline, ...events]);
        setTimeline(newTimeline);
        await savePatient({ timeline: newTimeline, historyText });
        if(doctorName) logAction('PROCESS_DOCUMENTS', selectedPatientId, doctorName);
        setIsProcessing(false);
        setActiveTab('timeline');
    };

    const handleAnalyzeBiomarkers = async () => {
        setIsAnalyzingBio(true);
        const bios = await extractBiomarkersFromDocs(historyText, historyFiles);
        const combined = [...biomarkers, ...bios];
        setBiomarkers(combined);
        await savePatient({ biomarkers: combined });
        if(doctorName) logAction('ANALYZE_BIOMARKERS', selectedPatientId, doctorName);
        setIsAnalyzingBio(false);
    };

    const handleManualEvolution = async () => {
        if (!manualNote) return;
        const [y, m, d] = manualDate.split('-');
        const newEvent: ClinicalEvent = { date: `${d}/${m}/${y}`, professional: manualDoctor, category: 'Evolución Manual', note: manualNote, isKey: false };
        const newTimeline = sortTimeline([...timeline, newEvent]);
        setTimeline(newTimeline);
        setManualNote('');
        await savePatient({ timeline: newTimeline });
        if(doctorName) logAction('ADD_MANUAL_EVOLUTION', selectedPatientId, doctorName);
    };

    const runGenerator = async (type: 'summary' | 'followup' | 'board') => {
        if (!selectedPatientId) return;
        const p = patients.find(x => x.id === selectedPatientId)!;
        setModalContent({ title: type === 'summary' ? 'Resumen Clínico' : type === 'followup' ? 'Seguimiento' : 'Ateneo', text: '', show: true, loading: true });
        
        let prompt = "", context = `Pac: ${p.name}, Dx: ${p.diagnosis}, Hist: ${JSON.stringify(p.timeline)}, Bio: ${JSON.stringify(p.biomarkers)}`;
        if (type === 'summary') prompt = "Genera Resumen HC Oncológico estructurado (Motivo, AP, Estudios, Dx, Tto) en Español.";
        if (type === 'followup') prompt = "Genera Plan Seguimiento NCCN/ESMO (Estado, Estudios prox, Consultas) en Español.";
        if (type === 'board') prompt = "Genera Presentación Ateneo (Titular, Resumen, Problema, Preguntas, Biblio) en Español.";

        const text = await generateText(prompt, context, [...historyFiles, ...guidelineFiles]);
        setModalContent(prev => ({ ...prev, text, loading: false }));
        if(doctorName) logAction(`GENERATE_${type.toUpperCase()}`, selectedPatientId, doctorName);
    };

    const handleChat = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;
        const p = patients.find(x => x.id === selectedPatientId)!;
        const newMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updated = [...chatMessages, newMsg];
        setChatMessages(updated); setChatInput(''); setIsTyping(true);
        
        const context = `Pac: ${p.name}. Dx: ${p.diagnosis}. Bio: ${JSON.stringify(p.biomarkers)}. Timeline: ${JSON.stringify(p.timeline)}`;
        const respText = await getChatResponse(updated, newMsg.text, context, [...historyFiles, ...guidelineFiles]);
        
        const finalMsgs = [...updated, { role: 'model', text: respText, timestamp: Date.now() } as ChatMessage];
        setChatMessages(finalMsgs); setIsTyping(false);
        await savePatient({ chatHistory: finalMsgs });
        // Chat is frequent, logging per message might be too much, but we'll log it as requested
        if(doctorName) logAction('CHAT_MESSAGE', selectedPatientId, doctorName);
    };

    const handleDeleteEvent = async (indexToDelete: number) => {
        if (!selectedPatientId || !timeline) return;
        if (confirm("¿Eliminar este evento?")) {
            const updatedTimeline = timeline.filter((_, index) => index !== indexToDelete);
            setTimeline(updatedTimeline); 
            await savePatient({ timeline: updatedTimeline });
            if(doctorName) logAction('DELETE_TIMELINE_EVENT', selectedPatientId, doctorName);
        }
    };

    // --- RENDER ---
    if (!doctorName) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center">
                <div className="inline-block bg-blue-600 p-4 rounded-2xl shadow-lg mb-6"><Stethoscope className="text-white w-8 h-8" /></div>
                <h1 className="text-2xl font-black text-gray-800 tracking-tighter mb-6">OncoGuide AI</h1>
                <input className="w-full px-6 py-4 bg-gray-50 rounded-2xl font-bold text-center text-base mb-4 outline-none focus:ring-2 ring-blue-100" placeholder="Nombre Profesional" onKeyDown={(e:any) => e.key === 'Enter' && legalAccepted && setDoctorName(e.target.value)} />
                <div className="flex items-start space-x-2 px-2 mb-6"><input type="checkbox" onChange={e => setLegalAccepted(e.target.checked)} /><p className="text-[10px] text-gray-400 text-left">Herramienta de apoyo. No sustituye juicio clínico.</p></div>
                <button disabled={!legalAccepted} onClick={() => { const i = document.querySelector('input'); if(i?.value) setDoctorName(i.value) }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">Ingresar</button>
            </div>
        </div>
    );

    const selP = patients.find(p => p.id === selectedPatientId);

    // Filter patients safely
    const filteredPatients = patients.filter(p => 
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.diagnosis || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-white text-gray-800 font-medium text-xs overflow-hidden">
            {/* SIDEBAR */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-50 border-r flex flex-col transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-5 border-b flex justify-between items-center bg-white">
                    <div className="flex items-center space-x-2 text-blue-600 font-black text-lg tracking-tighter"><Activity size={20} /><span>OncoGuide</span></div>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden"><X size={20}/></button>
                </div>
                <div className="flex-1 p-3 overflow-y-auto">
                    <div className="flex justify-between items-center px-1 mb-2"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pacientes</span><button onClick={() => setShowNewPatientModal(true)} className="text-blue-600 bg-blue-100 p-1 rounded"><Plus size={14}/></button></div>
                    <div className="relative mb-3"><Search className="absolute left-2 top-2 text-gray-400" size={12}/><input className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none" placeholder="Buscar..." onChange={e => setSearchTerm(e.target.value)} /></div>
                    <div className="space-y-1">
                        {filteredPatients.map(p => (
                            <div key={p.id} onClick={() => { setSelectedPatientId(p.id); setMobileMenuOpen(false); }} className={`p-3 rounded-xl cursor-pointer flex justify-between group ${selP?.id === p.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white border border-transparent hover:border-gray-200'}`}>
                                <div><div className="font-bold text-xs truncate max-w-[140px]">{p.name}</div><div className={`text-[9px] truncate max-w-[140px] ${selP?.id === p.id ? 'text-blue-200' : 'text-gray-400'}`}>{p.diagnosis}</div></div>
                                <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if(confirm('Borrar?')) { 
                                        deleteDoc(doc(db, "patients", p.id));
                                        if(doctorName) logAction('DELETE_PATIENT', p.id, doctorName); 
                                    } 
                                }} className={`opacity-0 group-hover:opacity-100 ${selP?.id === p.id ? 'text-white' : 'text-gray-400 hover:text-red-500'}`}><Trash2 size={12}/></button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t flex justify-between items-center"><div className="flex items-center space-x-2"><div className="w-6 h-6 bg-blue-500 rounded-full text-white flex items-center justify-center font-bold text-[10px]">{doctorName[0]}</div><span className="text-[10px] font-bold truncate max-w-[100px]">{doctorName}</span></div><button onClick={() => setDoctorName(null)}><LogOut size={14} className="text-gray-400 hover:text-red-500"/></button></div>
            </aside>

            {/* MAIN */}
            <main className="flex-1 flex flex-col h-full lg:ml-0">
                <header className="h-14 border-b flex items-center justify-between px-6 bg-white/90 backdrop-blur z-20">
                    <div className="flex items-center space-x-4"><button onClick={() => setMobileMenuOpen(true)} className="lg:hidden"><Menu size={20}/></button>
                        <div><h1 className="font-black text-base leading-none truncate max-w-[200px]">{selP ? selP.name : 'Bienvenido'}</h1>{selP && <span className="text-[10px] text-blue-500 font-bold tracking-wider">{selP.diagnosis} • {selP.age} Años</span>}</div>
                    </div>
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${apiKeyExists ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${apiKeyExists ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-[9px] font-bold tracking-wider">{apiKeyExists ? "ONLINE" : "OFFLINE"}</span>
                    </div>
                </header>

                {selP ? (
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                        {/* LEFT PANEL */}
                        <div className="lg:w-1/2 flex flex-col border-r bg-white">
                            <div className="flex border-b text-[10px] font-black uppercase tracking-widest">
                                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-3 border-r ${activeTab === 'docs' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}>1. Docs</button>
                                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-3 border-r ${activeTab === 'timeline' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}>2. Timeline</button>
                                <button onClick={() => setActiveTab('bio')} className={`flex-1 py-3 flex items-center justify-center space-x-1 ${activeTab === 'bio' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}><Dna size={12}/><span>Bio Molecular</span></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-gray-50/30">
                                {activeTab === 'docs' && (
                                    <>
                                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                            <div className="flex justify-between items-center"><h3 className="text-[10px] font-black text-gray-400 uppercase">Historia Base</h3><button onClick={() => savePatient({ historyText })} className="text-blue-600 text-[10px] font-bold hover:underline">Guardar Texto</button></div>
                                            <FileUploader label="PDFs / Imágenes" files={historyFiles} setFiles={setHistoryFiles} />
                                            <textarea className="w-full h-24 p-3 text-xs border rounded-xl bg-gray-50 focus:bg-white resize-none" placeholder="Notas manuales..." value={historyText} onChange={e => setHistoryText(e.target.value)} onBlur={() => savePatient({ historyText })} />
                                            <button onClick={handleProcessDocs} disabled={isProcessing} className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black tracking-widest hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center">{isProcessing ? <Loader2 className="animate-spin" size={12}/> : "PROCESAR DOCUMENTOS"}</button>
                                        </div>
                                        
                                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                            <div className="flex items-center space-x-2 text-gray-400"><PenTool size={12}/><h3 className="text-[10px] font-black uppercase">Evolución Manual</h3></div>
                                            <div className="flex space-x-2"><input type="date" className="bg-gray-50 px-2 py-1 rounded-lg border" value={manualDate} onChange={e => setManualDate(e.target.value)} /><input className="flex-1 bg-gray-50 px-2 py-1 rounded-lg border" value={manualDoctor} onChange={e => setManualDoctor(e.target.value)} /></div>
                                            <textarea className="w-full h-16 p-2 text-xs border rounded-lg bg-gray-50 resize-none" placeholder="Escribir evolución..." value={manualNote} onChange={e => setManualNote(e.target.value)} />
                                            <button onClick={handleManualEvolution} disabled={!manualNote} className="w-full py-2 bg-gray-800 text-white rounded-lg text-[10px] font-black tracking-widest hover:bg-black disabled:opacity-50">AGREGAR EVENTO</button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 pt-2">
                                            {['summary', 'followup', 'board'].map(t => (
                                                <button key={t} onClick={() => runGenerator(t as any)} className="py-3 border border-indigo-100 bg-indigo-50 text-indigo-600 rounded-xl flex flex-col items-center justify-center hover:bg-indigo-100">
                                                    {t === 'summary' ? <FileOutput size={14}/> : t === 'followup' ? <ClipboardCheck size={14}/> : <Presentation size={14}/>}
                                                    <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{t === 'summary' ? 'Resumen' : t === 'followup' ? 'Seguimiento' : 'Ateneo'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {activeTab === 'timeline' && (
                                    <div className="space-y-3 pl-2">
                                        {timeline.length === 0 && <div className="text-center text-gray-300 py-10"><Clock size={32} className="mx-auto mb-2 opacity-20"/><p>Sin eventos</p></div>}
                                        {timeline.map((ev, i) => (
                                            <div key={i} className="relative pl-6 border-l-2 border-gray-100 pb-6 last:border-0 group">
                                                <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow ${ev.isKey ? 'bg-red-500' : 'bg-blue-400'}`}></div>
                                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{ev.date}</span>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-[9px] text-gray-400 font-bold uppercase">{ev.professional}</span>
                                                            <button onClick={() => handleDeleteEvent(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={10}/></button>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] font-black text-gray-800 uppercase tracking-tight mb-1">{ev.category}</div>
                                                    <p className="text-xs text-gray-600 leading-snug">{ev.note}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'bio' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest">Perfil Molecular</h3>
                                            <button onClick={handleAnalyzeBiomarkers} disabled={isAnalyzingBio} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 hover:bg-purple-200">
                                                {isAnalyzingBio ? <Loader2 className="animate-spin" size={10}/> : <Dna size={12}/>}<span>Detectar Biomarcadores</span>
                                            </button>
                                        </div>
                                        {biomarkers.length === 0 ? (
                                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200"><Dna className="mx-auto text-gray-200 mb-2" size={32}/><p className="text-gray-400 text-[10px]">No se detectaron datos moleculares.<br/>Sube informes de patología y pulsa Detectar.</p></div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-2">
                                                {biomarkers.map((bio, i) => (
                                                    <div key={i} className="bg-white p-3 rounded-xl border-l-4 border-purple-500 shadow-sm flex justify-between items-center">
                                                        <div>
                                                            <div className="text-xs font-black text-gray-800">{bio.name}</div>
                                                            <div className="text-[10px] text-gray-500">{bio.date} {bio.technique ? `• ${bio.technique}` : ''}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-md">{bio.status}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <FileUploader label="Informes Patología / NGS" files={historyFiles} setFiles={setHistoryFiles} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT PANEL (CHAT) */}
                        <div className="lg:w-1/2 flex flex-col bg-gray-50 relative">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {chatMessages.length === 0 && <div className="text-center py-20 opacity-30"><MessageSquare size={48} className="mx-auto mb-2 text-blue-600"/><p>Asistente Oncológico</p></div>}
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                                            <div className="whitespace-pre-wrap">{m.text}</div>
                                            <div className={`text-[9px] mt-1 font-bold ${m.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    </div>
                                ))}
                                {isTyping && <div className="text-[10px] text-gray-400 animate-pulse ml-4">Escribiendo...</div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-4 bg-white border-t">
                                <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-2">
                                    <textarea className="flex-1 bg-transparent text-sm outline-none resize-none max-h-32" rows={1} placeholder="Escriba su consulta..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => {if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleChat();}}} />
                                    <button onClick={handleChat} disabled={!chatInput.trim() || isTyping} className="ml-2 text-blue-600 disabled:opacity-50"><MessageSquare size={20}/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-gray-400">
                        <Activity size={64} className="mb-4 text-gray-200"/>
                        <p>Seleccione o cree un paciente para comenzar.</p>
                    </div>
                )}
            </main>

            {/* SHARED MODAL */}
            {modalContent.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-black text-sm uppercase text-gray-700">{modalContent.title}</h3>
                            <button onClick={() => setModalContent({ ...modalContent, show: false })}><X size={20} className="text-gray-400 hover:text-black"/></button>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 text-sm font-mono whitespace-pre-wrap">
                            {modalContent.loading ? <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-blue-600" size={32}/></div> : modalContent.text}
                        </div>
                        <div className="p-4 border-t bg-white flex justify-end space-x-2">
                            <button onClick={() => {
                                const w = window.open('','_blank'); w?.document.write(`<pre style="font-family:monospace;padding:20px">${modalContent.text}</pre>`); w?.document.close(); w?.print();
                            }} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1"><FileDown size={14}/><span>PDF</span></button>
                            <button onClick={() => navigator.clipboard.writeText(modalContent.text)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Copiar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE PATIENT MODAL */}
            {showNewPatientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="font-black text-lg mb-4 text-gray-800">Nuevo Paciente</h3>
                        <div className="space-y-3">
                            <input className="w-full p-3 border rounded-xl text-sm" placeholder="Nombre Completo" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                            <div className="flex space-x-2">
                                <input type="number" className="w-1/3 p-3 border rounded-xl text-sm" placeholder="Edad" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} />
                                <input className="flex-1 p-3 border rounded-xl text-sm" placeholder="Diagnóstico (ej: Mama)" value={newPatientDiagnosis} onChange={e => setNewPatientDiagnosis(e.target.value)} />
                            </div>
                            <button onClick={async () => {
                                if(!newPatientName) return;
                                const docRef = await addDoc(collection(db, "patients"), { doctorId: doctorName, name: newPatientName, age: Number(newPatientAge), diagnosis: newPatientDiagnosis, lastUpdated: Date.now(), historyText:'', timeline: [], biomarkers: [], chatHistory: [] });
                                if(doctorName) logAction('CREATE_PATIENT', docRef.id, doctorName);
                                setShowNewPatientModal(false); setNewPatientName(''); setNewPatientAge(''); setNewPatientDiagnosis('');
                            }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-2">Crear Ficha</button>
                            <button onClick={() => setShowNewPatientModal(false)} className="w-full text-gray-400 text-xs py-2">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
