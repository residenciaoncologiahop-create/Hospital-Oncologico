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
    Calendar, PenTool, FileOutput, FileDown, ClipboardCheck, Presentation,
    PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
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

// --- AUDIT SYSTEM ---
const getOrInitFingerprint = () => {
    let fp = localStorage.getItem('doctor_fingerprint');
    if (!fp) {
        fp = crypto.randomUUID();
        localStorage.setItem('doctor_fingerprint', fp);
    }
    return fp;
};

const logAction = async (action: string, patientId: string | null, doctorName: string | null) => {
    try {
        const fingerprint = getOrInitFingerprint();
        await addDoc(collection(db, "audit_logs"), {
            action: action,
            patientId: patientId || 'N/A',
            doctorName: doctorName || 'Unknown',
            doctorFingerprint: fingerprint,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error logging audit:", error);
    }
};

// --- TYPES ---
interface ChatMessage { role: 'user' | 'model'; text: string; timestamp: number; }
interface ClinicalEvent { date: string; professional: string; category: string; note: string; isKey: boolean; }

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

// --- AI FUNCTIONS (PRIVACIDAD REFORZADA & MEJORA DE DATOS) ---

// 1. EXTRACT TIMELINE (CORREGIDO: EXTRACCIÓN ROBUSTA DE JSON)
const extractTimelineFromDocs = async (text: string, files: FileData[]): Promise<ClinicalEvent[]> => {
    if (!text && files.length === 0) return [];
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API Key Missing");
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [{ text: `
            Analiza los documentos y extrae la cronología clínica.
            
            REGLA DE PRIVACIDAD (CRÍTICA): 
            - NO incluyas DNI, CUIT, direcciones, teléfonos ni el nombre propio del paciente en la salida.
            - Si encuentras un DNI, ignóralo.
            
            REGLAS DE FORMATO:
            - Idioma: ESPAÑOL.
            - Fechas: DD/MM/YYYY.
            - Categorías: Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución.
            - SOLO DEVUELVE EL ARRAY JSON. NO ESCRIBAS TEXTO ADICIONAL.
        `}];
        if (text) parts.push({ text: `Notas clínicas anónimas: ${text}` });
        files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });

        if (res.text) {
            // --- CORRECCIÓN: BUSCAR EL JSON DENTRO DEL TEXTO ---
            // A veces la IA añade texto antes o después. Buscamos el primer '[' y el último ']'.
            const firstBracket = res.text.indexOf('[');
            const lastBracket = res.text.lastIndexOf(']');
            
            let rawEvents = [];
            
            if (firstBracket !== -1 && lastBracket !== -1) {
                const jsonString = res.text.substring(firstBracket, lastBracket + 1);
                rawEvents = JSON.parse(jsonString);
            } else {
                // Fallback si no encuentra array, intenta parsear todo (ej: si devolvió un objeto)
                const parsed = JSON.parse(res.text);
                // Si es un objeto { events: [...] }, extraemos el array
                if (!Array.isArray(parsed)) {
                    const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
                    rawEvents = possibleArray || [];
                } else {
                    rawEvents = parsed;
                }
            }

            // --- FILTRO DE CALIDAD ---
            const validEvents = rawEvents.map((e: any) => ({
                date: e.date || "S/F", // Fecha fallback
                professional: e.professional || "N/A",
                category: e.category || "General",
                note: e.note || e.description || "Evento sin descripción", // Fallback para alucinaciones de nombre de campo
                isKey: !!e.isKey
            })).filter((e: any) => e.note.length > 2); // Filtro final de contenido mínimo
            
            return sortTimeline(validEvents); 
        }
        return [];
    } catch (e) { console.error(e); return []; }
};

// 2. GENERATORS (MEJORADO PARA INCLUIR ANTECEDENTES Y EF)
const generateText = async (prompt: string, context: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    
    // REGLA DE PRIVACIDAD GLOBAL INYECTADA
    const privacyRule = "\n\nIMPORTANTE: Protege la privacidad. NO incluyas nombres reales, DNI, ni datos de contacto. Usa términos genéricos como 'El paciente'.";
    
    const parts: any[] = [{ text: prompt + privacyRule }, { text: context }];
    files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
    const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
    return res.text || "Error.";
};

// 3. CHAT
const getChatResponse = async (msgs: ChatMessage[], newMsg: string, context: string, files: FileData[]) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    const parts: any[] = [{ text: `Contexto Anónimo:\n${context}` }];
    files.slice(0, 3).forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
    msgs.slice(-5).forEach(m => parts.push({ text: `${m.role}: ${m.text}` }));
    parts.push({ text: newMsg });
    
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { systemInstruction: "Eres un oncólogo experto. Responde en español técnico. NUNCA menciones nombres reales, DNI o datos de contacto." }
    });
    return res.text || "Error.";
};

// --- COMPONENTS ---

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
        <div className="mb-3">
            <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">{label}</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] border border-blue-100 font-bold">
                        <span className="truncate max-w-[100px]">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 text-blue-300 hover:text-blue-600"><X size={12} /></button>
                    </div>
                ))}
            </div>
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-100 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-white hover:border-blue-300 transition-all group">
                <Upload className="w-5 h-5 text-gray-300 group-hover:text-blue-400 mb-1" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Seleccionar Archivos</span>
                <input type="file" className="hidden" multiple accept={accept} onChange={handleFileChange} />
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

    // NUEVO ESTADO: Panel Izquierdo Visible
    const [showLeftPanel, setShowLeftPanel] = useState(true);

    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientAge, setNewPatientAge] = useState('');
    const [newPatientDiagnosis, setNewPatientDiagnosis] = useState('');

    const [historyText, setHistoryText] = useState('');
    const [historyFiles, setHistoryFiles] = useState<FileData[]>([]);
    const [timeline, setTimeline] = useState<ClinicalEvent[]>([]);
    const [guidelineFiles, setGuidelineFiles] = useState<FileData[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessingDocs, setIsProcessingDocs] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    
    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Manual Evolution
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualDoctor, setManualDoctor] = useState(doctorName || '');
    const [manualNote, setManualNote] = useState('');

    // Modal States
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [followUpText, setFollowUpText] = useState('');
    const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

    const [showTumorBoardModal, setShowTumorBoardModal] = useState(false); 
    const [tumorBoardText, setTumorBoardText] = useState('');
    const [isGeneratingTumorBoard, setIsGeneratingTumorBoard] = useState(false);

    const [activeTab, setActiveTab] = useState<'docs' | 'timeline'>('docs');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setApiKeyExists(!!import.meta.env.VITE_API_KEY);
        getOrInitFingerprint();
    }, []);

    // Firebase Load
    useEffect(() => {
        if (!doctorName) { setPatients([]); return; }
        const q = query(collection(db, "patients"), where("doctorId", "==", doctorName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    name: data.name || '', 
                    diagnosis: data.diagnosis || ''
                } as Patient;
            });
            list.sort((a, b) => b.lastUpdated - a.lastUpdated);
            setPatients(list);
        });
        return () => unsubscribe();
    }, [doctorName]);

    useEffect(() => {
        if (doctorName) {
            localStorage.setItem('doctor_name', doctorName);
            setManualDoctor(doctorName);
        }
    }, [doctorName]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    useEffect(() => {
        if (selectedPatientId) {
            const p = patients.find(pat => pat.id === selectedPatientId);
            if (p) {
                setHistoryText(p.historyText || '');
                setTimeline(p.timeline || []);
                setChatMessages(p.chatHistory || []);
                setHistoryFiles([]); setGuidelineFiles([]);
                setLastError(null);
                setActiveTab(p.timeline && p.timeline.length > 0 ? 'timeline' : 'docs');
                setManualDate(new Date().toISOString().split('T')[0]); 
                setManualDoctor(doctorName || '');
                setShowLeftPanel(true); // Restablecer vista
            }
        }
    }, [selectedPatientId]);

    // --- HELPER PARA ANONIMIZACIÓN (SIN SEXO, SOLO EDAD Y DX) ---
    const getAnonContext = (p: Patient) => {
        return `Paciente de ${p.age} años.
        Diagnóstico: ${p.diagnosis}.
        Historial: ${JSON.stringify(p.timeline || [])}.
        Notas Clínicas (Anónimas): ${p.historyText || ''}`;
    };
    // ----------------------------------------

    // Save Patient Details Helper
    const savePatientDetails = async () => {
        if (selectedPatientId) {
            const patientRef = doc(db, "patients", selectedPatientId);
            await updateDoc(patientRef, { 
                historyText, 
                lastUpdated: Date.now() 
            });
            logAction("UPDATE_PATIENT_DATA", selectedPatientId, doctorName);
        }
    };

    const handleProcessDocuments = async () => {
        if (!historyText && historyFiles.length === 0) return;
        setIsProcessingDocs(true);
        setLastError(null);
        try {
            const events = await extractTimelineFromDocs(historyText, historyFiles);
            const currentTimeline = timeline || [];
            const combinedTimeline = sortTimeline([...currentTimeline, ...events]);
            setTimeline(combinedTimeline);
            
            if (selectedPatientId) {
                const patientRef = doc(db, "patients", selectedPatientId);
                await updateDoc(patientRef, {
                    timeline: combinedTimeline,
                    historyText: historyText,
                    lastUpdated: Date.now()
                });
                logAction("PROCESS_DOCUMENTS", selectedPatientId, doctorName);
            }
            setActiveTab('timeline');
        } catch (e: any) {
            setLastError(e.message || "Error procesando documentos.");
        } finally {
            setIsProcessingDocs(false);
        }
    };

    const handleAddManualEvolution = async () => {
        if (!manualNote.trim() || !selectedPatientId) return;
        const [y, m, d] = manualDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        const newEvent: ClinicalEvent = {
            date: formattedDate,
            professional: manualDoctor,
            category: "Evolución Manual",
            note: manualNote,
            isKey: false
        };

        const updatedTimeline = sortTimeline([...timeline, newEvent]);
        setTimeline(updatedTimeline);
        setManualNote('');

        const patientRef = doc(db, "patients", selectedPatientId);
        await updateDoc(patientRef, { timeline: updatedTimeline, lastUpdated: Date.now() });
        logAction("ADD_MANUAL_EVOLUTION", selectedPatientId, doctorName);
    };

    const handleDeleteEvent = async (indexToDelete: number) => {
        if (!selectedPatientId || !timeline) return;
        if (confirm("¿Eliminar este evento?")) {
            const updatedTimeline = timeline.filter((_, index) => index !== indexToDelete);
            setTimeline(updatedTimeline); 
            const patientRef = doc(db, "patients", selectedPatientId);
            await updateDoc(patientRef, { timeline: updatedTimeline, lastUpdated: Date.now() });
            logAction("DELETE_TIMELINE_EVENT", selectedPatientId, doctorName);
        }
    };

    // GENERATORS - USAN getAnonContext & PROMPTS MEJORADOS
    const handleGenerateSummary = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setIsGeneratingSummary(true); setShowSummaryModal(true); setSummaryText("Generando resumen...");
        
        const context = getAnonContext(p);
        // PROMPT MEJORADO: Pide explícitamente Antecedentes y Examen Físico de los documentos adjuntos
        const prompt = `
            Genera un RESUMEN DE HISTORIA CLÍNICA oncológico profesional en ESPAÑOL basándote en los documentos adjuntos y las notas.
            
            ES OBLIGATORIO INCLUIR LAS SIGUIENTES SECCIONES (Extraer datos de los archivos adjuntos):
            1. Motivo de Consulta y Enfermedad Actual.
            2. ANTECEDENTES PERSONALES (Indagar en los archivos: Comorbilidades, Qx, Tóxicos, Familiares). SI NO HAY DATOS, INDICAR "No constan en documentos".
            3. EXAMEN FÍSICO (Indagar en los archivos: ECOG/PS, hallazgos positivos). SI NO HAY DATOS, INDICAR "No consta en documentos".
            4. Estudios Complementarios (Imágenes, Labs, AP).
            5. Diagnóstico y Estadificación.
            6. Evolución y Tratamientos previos.
        `;
        
        const summary = await generateText(prompt, context, historyFiles);
        setSummaryText(summary); setIsGeneratingSummary(false);
        logAction("GENERATE_SUMMARY", selectedPatientId, doctorName);
    };

    const handleGenerateFollowUp = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setIsGeneratingFollowUp(true); setShowFollowUpModal(true); setFollowUpText("Analizando guías...");
        
        const context = getAnonContext(p);
        const prompt = "Sugiere PLAN DE SEGUIMIENTO (Follow-up) detallado basado en NCCN/ESMO (Estado, Estudios prox, Consultas) en Español.";
        
        const advice = await generateText(prompt, context, guidelineFiles);
        setFollowUpText(advice); setIsGeneratingFollowUp(false);
        logAction("GENERATE_FOLLOWUP", selectedPatientId, doctorName);
    };

    const handleGenerateTumorBoard = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setIsGeneratingTumorBoard(true); setShowTumorBoardModal(true); setTumorBoardText("Preparando presentación...");
        
        const context = getAnonContext(p);
        // PROMPT MEJORADO PARA ATENEO
        const prompt = `
            Genera Presentación para Ateneo/Comité de Tumores (Tumor Board) en ESPAÑOL.
            
            ESTRUCTURA OBLIGATORIA:
            1. TITULAR DEL CASO.
            2. ANTECEDENTES RELEVANTES Y EXAMEN FÍSICO (Extraer de documentos: Comorbilidades, PS).
            3. RESUMEN CRONOLÓGICO DEL CASO.
            4. PROBLEMA ACTUAL / MOTIVO DE PRESENTACIÓN.
            5. PREGUNTAS AL COMITÉ.
            6. BIBLIOGRAFÍA SUGERIDA.
        `;
        
        const text = await generateText(prompt, context, historyFiles);
        setTumorBoardText(text); setIsGeneratingTumorBoard(false);
        logAction("GENERATE_TUMOR_BOARD", selectedPatientId, doctorName);
    };

    const handlePrintPDF = (content: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>OncoGuide Doc</title><style>body { font-family: monospace; padding: 40px; white-space: pre-wrap; font-size: 13px; line-height: 1.5; } h1 { font-family: sans-serif; font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;}</style></head><body><h1>OncoGuide - Documento Clínico</h1>${content}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if(!p) return;

        setLastError(null);
        const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updatedUser = [...chatMessages, newUserMsg];
        setChatMessages(updatedUser); setChatInput(''); setIsTyping(true);
        
        // Contexto Anonimizado para el chat
        const context = getAnonContext(p);
        
        const responseText = await getChatResponse(updatedUser, newUserMsg.text, context, [...historyFiles, ...guidelineFiles]);
        
        const newAiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        const updatedAI = [...updatedUser, newAiMsg];
        setChatMessages(updatedAI); setIsTyping(false);

        const patientRef = doc(db, "patients", selectedPatientId);
        await updateDoc(patientRef, { chatHistory: updatedAI, lastUpdated: Date.now() });
        logAction("CHAT_MESSAGE", selectedPatientId, doctorName);
    };

    const handleCreatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!doctorName) return;
        const p = {
            doctorId: doctorName,
            name: newPatientName,
            age: parseInt(newPatientAge),
            diagnosis: newPatientDiagnosis,
            historyText: '',
            lastUpdated: Date.now(),
            chatHistory: [],
            timeline: []
        };
        try {
            const docRef = await addDoc(collection(db, "patients"), p);
            setSelectedPatientId(docRef.id); setShowNewPatientModal(false);
            setNewPatientName(''); setNewPatientAge(''); setNewPatientDiagnosis('');
            logAction("CREATE_PATIENT", docRef.id, doctorName);
        } catch (error: any) { setLastError("Error creando paciente: " + error.message); }
    };

    const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (confirm("¿Eliminar paciente permanentemente?")) {
            try {
                await deleteDoc(doc(db, "patients", id));
                if (selectedPatientId === id) setSelectedPatientId(null);
                logAction("DELETE_PATIENT", id, doctorName);
            } catch (error: any) { setLastError("Error al eliminar: " + error.message); }
        }
    };

    // Filter logic
    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!doctorName) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-gray-100 text-center">
                <div className="inline-block bg-blue-600 p-5 rounded-3xl shadow-xl shadow-blue-100 mb-8"><Stethoscope className="text-white w-10 h-10" /></div>
                <h1 className="text-2xl font-black text-gray-800 mb-2 tracking-tighter">OncoGuide AI</h1>
                <p className="text-gray-400 mb-8 text-xs font-medium">Herramienta de apoyo a la discusión clínica y docencia</p>
                <div className="space-y-4">
                    <input type="text" className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-100 outline-none transition-all font-bold text-center text-base" placeholder="Nombre del profesional" onKeyDown={(e) => {if(e.key==='Enter' && (e.target as any).value && legalAccepted) setDoctorName((e.target as any).value)}} />
                    
                    <div className="flex items-start space-x-2 text-left px-2">
                        <input type="checkbox" id="legal" checked={legalAccepted} onChange={e => setLegalAccepted(e.target.checked)} className="mt-1" />
                        <label htmlFor="legal" className="text-[10px] text-gray-400 leading-tight">
                            Confirmo que esta herramienta es de apoyo y no sustituye el juicio clínico ni la historia clínica institucional.
                        </label>
                    </div>

                    <button disabled={!legalAccepted} onClick={() => { const i = document.querySelector('input'); if(i?.value) setDoctorName(i.value) }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">Ingresar</button>
                </div>
            </div>
        </div>
    );

    const selP = patients.find(p => p.id === selectedPatientId);

    return (
        <div className="flex h-screen bg-white text-gray-800 font-medium text-xs overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-6 border-b flex items-center justify-between bg-white">
                    <div className="flex items-center space-x-2 text-blue-600 font-black text-xl tracking-tighter"><Activity size={24} /><span>OncoGuide</span></div>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-gray-300"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                        <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-3"><span>Casos Clínicos</span><button onClick={() => setShowNewPatientModal(true)} className="text-blue-600 bg-blue-50 p-1 rounded-lg"><Plus size={14}/></button></div>
                        <div className="px-2 mb-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
                                <input type="text" placeholder="Buscar caso..." className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-blue-300 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            {filteredPatients.length === 0 && <p className="text-center text-[10px] text-gray-400 py-4">Sin resultados.</p>}
                            {filteredPatients.map(p => (
                                <div key={p.id} onClick={() => {setSelectedPatientId(p.id); setMobileMenuOpen(false);}} className={`group w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${selectedPatientId === p.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}>
                                    <div className="flex flex-col truncate pr-2">
                                        <span className="font-bold text-xs truncate">{p.name}</span>
                                        <span className={`text-[10px] font-semibold truncate ${selectedPatientId === p.id ? 'text-blue-100 opacity-80' : 'text-gray-400'}`}>{p.diagnosis}</span>
                                    </div>
                                    <button onClick={(e) => handleDeletePatient(p.id, e)} className={`p-1.5 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors ${selectedPatientId === p.id ? 'text-blue-200 hover:text-white hover:bg-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}><Trash2 size={12} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t bg-white flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 truncate">
                            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md">{doctorName[0]}</div>
                            <div className="flex flex-col truncate"><span className="text-[9px] font-black text-gray-400 uppercase leading-none mb-0.5">Profesional</span><span className="text-xs font-bold truncate leading-none">Dr. {doctorName}</span></div>
                        </div>
                        <button onClick={() => setDoctorName(null)} className="text-gray-200 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
                    </div>
                    <p className="text-[8px] text-gray-300 text-center font-medium">Herramienta de apoyo para discusión clínica y docencia. No sustituye la historia clínica ni el juicio médico.</p>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white/80 backdrop-blur-md border-b h-16 flex items-center px-6 justify-between z-20">
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400"><Menu size={24} /></button>
                        {/* TOGGLE PANEL BUTTON */}
                        {selP && (
                            <button 
                                onClick={() => setShowLeftPanel(!showLeftPanel)} 
                                className="hidden lg:block text-gray-400 hover:text-blue-600 transition-colors"
                                title={showLeftPanel ? "Expandir Chat" : "Mostrar Documentación"}
                            >
                                {showLeftPanel ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                            </button>
                        )}
                        <div className="flex flex-col">
                            <h1 className="font-black text-gray-800 text-lg tracking-tight leading-none truncate max-w-md">{selP ? `Caso: ${selP.name}` : 'Bienvenido'}</h1>
                            {selP && <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">{selP.diagnosis} – {selP.age} Años</span>}
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl flex items-center space-x-2 text-[10px] font-bold tracking-widest uppercase transition-all ${apiKeyExists ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                        {apiKeyExists ? <div className="w-2 h-2 bg-green-500 rounded-full"></div> : <ShieldAlert size={12}/>}
                        <span>{apiKeyExists ? 'Online' : 'Error API'}</span>
                    </div>
                </header>

                {selP ? (
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50">
                        {/* Left Panel */}
                        <div className={`${showLeftPanel ? 'lg:w-1/2 border-r' : 'hidden'} flex flex-col bg-white h-full transition-all duration-300`}>
                            <div className="flex border-b text-[10px] font-black uppercase tracking-[0.2em] bg-gray-50/50">
                                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-4 transition-all border-r border-gray-100 ${activeTab === 'docs' ? 'text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>1. Documentación</button>
                                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-4 transition-all ${activeTab === 'timeline' ? 'text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>2. Historial de Eventos</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                                {activeTab === 'docs' ? (
                                    <>
                                        <section className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-2"><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Documentación del Caso</h3><button onClick={savePatientDetails} className="text-blue-600 font-bold text-[10px] hover:underline uppercase">Guardar cambios</button></div>
                                            <FileUploader label="Archivos Digitales" files={historyFiles} setFiles={setHistoryFiles} />
                                            <textarea className="w-full h-32 p-4 border-2 border-gray-100 rounded-2xl text-xs font-medium bg-gray-50 focus:bg-white focus:border-blue-200 transition-all outline-none resize-none shadow-inner" placeholder="Resumen manual del caso..." value={historyText} onChange={(e) => setHistoryText(e.target.value)} onBlur={savePatientDetails} />
                                            <button onClick={handleProcessDocuments} disabled={isProcessingDocs} className="w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black tracking-widest shadow-xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center">
                                                {isProcessingDocs ? <><Loader2 className="animate-spin mr-2" size={16}/>Analizando...</> : "Procesar documentos"}
                                            </button>
                                        </section>

                                        <section className="space-y-3 pt-6 border-t border-gray-100">
                                            <div className="flex items-center space-x-2 text-gray-400"><PenTool size={14} /><h3 className="text-xs font-black uppercase tracking-widest">Registro de evolución clínica (resumen)</h3></div>
                                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                                <div className="flex space-x-2">
                                                    <input type="date" className="bg-white px-3 py-2 rounded-xl text-xs font-bold border border-gray-200" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                                                    <input type="text" className="flex-1 bg-white px-3 py-2 rounded-xl text-xs font-bold border border-gray-200" placeholder="Médico" value={manualDoctor} onChange={e => setManualDoctor(e.target.value)} />
                                                </div>
                                                <textarea className="w-full h-20 bg-white p-3 rounded-xl text-xs font-medium border border-gray-200 resize-none" placeholder="Registrar información relevante para la comprensión del caso (no constituye evolución en historia clínica)." value={manualNote} onChange={e => setManualNote(e.target.value)} />
                                                <button onClick={handleAddManualEvolution} disabled={!manualNote.trim()} className="w-full bg-gray-800 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-50">Agregar hito clínico</button>
                                            </div>
                                        </section>

                                        <section className="space-y-4 pt-4 border-t border-gray-100">
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 py-3 rounded-xl hover:bg-indigo-100 transition-all">
                                                    {isGeneratingSummary ? <Loader2 className="animate-spin mb-1" size={14} /> : <FileOutput size={14} className="mb-1" />}
                                                    <span className="text-[10px] font-black tracking-widest uppercase">RESUMEN CLÍNICO</span>
                                                </button>
                                                <button onClick={handleGenerateFollowUp} disabled={isGeneratingFollowUp} className="flex flex-col items-center justify-center bg-teal-50 text-teal-600 border border-teal-100 py-3 rounded-xl hover:bg-teal-100 transition-all">
                                                    {isGeneratingFollowUp ? <Loader2 className="animate-spin mb-1" size={14} /> : <ClipboardCheck size={14} className="mb-1" />}
                                                    <span className="text-[10px] font-black tracking-widest uppercase">PLAN SEGUIMIENTO</span>
                                                </button>
                                                <button onClick={handleGenerateTumorBoard} disabled={isGeneratingTumorBoard} className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 border border-rose-100 py-3 rounded-xl hover:bg-rose-100 transition-all">
                                                    {isGeneratingTumorBoard ? <Loader2 className="animate-spin mb-1" size={14} /> : <Presentation size={14} className="mb-1" />}
                                                    <span className="text-[10px] font-black tracking-widest uppercase">ATENEO / COMITÉ</span>
                                                </button>
                                            </div>
                                            <FileUploader label="Guías NCCN / Protocolos" files={guidelineFiles} setFiles={setGuidelineFiles} accept=".pdf" />
                                        </section>
                                    </>
                                ) : (
                                    <div className="space-y-4 pt-2">
                                        {timeline.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-gray-200"><Clock size={40} className="mb-3 opacity-10" /><p className="text-xs font-black uppercase tracking-widest">Sin eventos</p></div>
                                        ) : (
                                            timeline.map((ev, i) => (
                                                <div key={i} className="relative pl-10 border-l-4 border-gray-100 pb-8 group">
                                                    <div className={`absolute -left-[14px] top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-md transition-all group-hover:scale-110 flex items-center justify-center ${ev.isKey ? 'bg-red-500 text-white' : 'bg-blue-400 text-white'}`}>
                                                        {ev.isKey ? <AlertCircle size={10}/> : <Info size={10}/>}
                                                    </div>
                                                    <div className={`p-5 rounded-2xl border transition-all hover:shadow-xl ${ev.isKey ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-50 shadow-sm'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase ${ev.isKey ? 'bg-red-500 text-white shadow-md' : 'bg-blue-50 text-blue-600'}`}>{ev.date}</span>
                                                            <div className="flex items-center space-x-2">
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[150px]">{ev.professional}</span>
                                                                <button onClick={() => handleDeleteEvent(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                                            </div>
                                                        </div>
                                                        <h4 className={`font-bold text-xs mb-1 uppercase tracking-tight ${ev.isKey ? 'text-red-900' : 'text-gray-800'}`}>{ev.category}</h4>
                                                        <p className={`leading-relaxed text-xs font-medium ${ev.isKey ? 'text-red-900' : 'text-gray-600'}`}>{ev.note}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel: Chat */}
                        <div className={`${showLeftPanel ? 'lg:w-1/2' : 'w-full'} flex flex-col bg-gray-50 h-full overflow-hidden relative transition-all duration-300`}>
                            {lastError && (
                                <div className="absolute top-4 left-4 right-4 z-30 bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-start space-x-3 border border-red-500 animate-in slide-in-from-top">
                                    <Terminal className="flex-shrink-0 mt-0.5" size={16}/>
                                    <div><p className="text-[10px] font-black uppercase tracking-widest mb-0.5">Error:</p><p className="text-xs font-bold leading-tight">{lastError}</p></div>
                                    <button onClick={() => setLastError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={16}/></button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30 select-none">
                                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm"><MessageSquare size={48} className="text-blue-600" /></div>
                                        <div className="space-y-2">
                                            <p className="text-sm font-black uppercase tracking-widest">Asistente de Discusión</p>
                                            <p className="text-xs font-bold max-w-[200px] mx-auto leading-relaxed">Las respuestas generadas son orientativas y educativas. Toda decisión clínica corresponde al equipo tratante y debe registrarse en la historia clínica institucional.</p>
                                        </div>
                                    </div>
                                )}
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-6 rounded-[2rem] text-sm shadow-md leading-relaxed font-medium ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-100' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                                            <div className="whitespace-pre-wrap">{m.text}</div>
                                            <div className={`text-[10px] mt-2 font-black uppercase tracking-widest ${m.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-300'}`}>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    </div>
                                ))}
                                {isTyping && <div className="flex justify-start"><div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm animate-pulse text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">IA Razonando...</div></div>}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-6 bg-white/80 backdrop-blur-md border-t">
                                <div className="relative flex items-center bg-gray-50 rounded-3xl border-2 border-transparent focus-within:border-blue-100 focus-within:bg-white transition-all p-3 pl-6">
                                    <textarea className="flex-1 bg-transparent text-sm font-bold outline-none resize-none max-h-32 scrollbar-hide py-2" placeholder="Plantear dudas / aspectos a discutir" rows={1} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                                    <button onClick={handleSendMessage} disabled={!chatInput.trim() || isTyping} className="ml-3 p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-90 transition-all"><MessageSquare size={20} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50">
                        <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-gray-100 max-w-sm">
                            <Activity size={64} className="mb-6 text-blue-600 mx-auto opacity-10 animate-pulse" />
                            <h2 className="text-xl font-black text-gray-800 tracking-tight">Consola de Decisión</h2>
                            <p className="text-gray-400 text-xs mt-4 font-bold leading-relaxed">Seleccione un caso o inicie un nuevo registro.</p>
                            <button onClick={() => setShowNewPatientModal(true)} className="mt-8 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase">Crear caso clínico</button>
                        </div>
                    </div>
                )}
            </main>

            {/* SHARED MODAL COMPONENT */}
            {(showSummaryModal || showFollowUpModal || showTumorBoardModal) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-6">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center space-x-3 text-gray-800 font-black text-xs uppercase tracking-widest">
                                {showSummaryModal ? <><FileOutput size={18} className="text-indigo-600"/><span>Resumen Clínico</span></> : 
                                 showFollowUpModal ? <><ClipboardCheck size={18} className="text-teal-600"/><span>Seguimiento</span></> :
                                 <><Presentation size={18} className="text-rose-600"/><span>Ateneo / Tumor Board</span></>}
                            </div>
                            <button onClick={() => {setShowSummaryModal(false); setShowFollowUpModal(false); setShowTumorBoardModal(false);}} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
                            {(isGeneratingSummary || isGeneratingFollowUp || isGeneratingTumorBoard) ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                                    <Loader2 size={40} className="animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest">Generando análisis experto...</p>
                                </div>
                            ) : (
                                <textarea className="w-full h-full bg-white p-8 rounded-2xl border border-gray-100 text-sm font-mono leading-relaxed resize-none focus:outline-none" value={showSummaryModal ? summaryText : showFollowUpModal ? followUpText : tumorBoardText} readOnly />
                            )}
                        </div>
                        <div className="p-6 border-t bg-white flex justify-end space-x-3">
                            <button onClick={() => handlePrintPDF(showSummaryModal ? summaryText : showFollowUpModal ? followUpText : tumorBoardText)} className="flex items-center space-x-2 bg-gray-800 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">
                                <FileDown size={14} /><span>Descargar PDF</span>
                            </button>
                            <button onClick={() => {navigator.clipboard.writeText(showSummaryModal ? summaryText : showFollowUpModal ? followUpText : tumorBoardText); alert("Copiado");}} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Copiar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Paciente */}
            {showNewPatientModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-6">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Registro de Caso Clínico</h3>
                            <button onClick={() => setShowNewPatientModal(false)} className="text-gray-300 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreatePatient} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Nombre completo del paciente</label>
                                <input type="text" required className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="Ej: Juan Pérez" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                            </div>
                            <div className="flex space-x-4">
                                <div className="w-1/3 space-y-2">
                                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Edad</label>
                                    <input type="number" required className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="--" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} />
                                </div>
                                <div className="w-2/3 space-y-2">
                                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Base</label>
                                    <input type="text" required className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="Ej: Ca Mama" value={newPatientDiagnosis} onChange={e => setNewPatientDiagnosis(e.target.value)} />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-4 text-center">Uso exclusivo del equipo de salud. Este registro no reemplaza la historia clínica institucional.</p>
                            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest">Crear caso clínico</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
