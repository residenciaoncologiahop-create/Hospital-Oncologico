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
    Calendar, PenTool, FileOutput
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
// ------------------------------

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

interface FileData {
    name: string;
    type: string;
    data: string; // base64
}

// --- Helper: Date Sorter & Cleaner ---
const parseDate = (dateStr: string) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    return 0; 
};

// FILTRO DE SEGURIDAD: Elimina eventos basura si la IA los deja pasar
const isEventRelevant = (e: ClinicalEvent): boolean => {
    const text = (e.note + " " + e.category).toLowerCase();
    const forbiddenTerms = [
        "turno", "reprogram", "administrativ", "empadron", "mesa de entrada", 
        "carnet", "validaci", "autorizaci", "consentimiento informado", "firma", 
        "citad", "ausente", "solicitud de", "se solicita", "para evaluar", 
        "plan:", "a confirmar", "asignado", "cupo", "voucher"
    ];
    // Si contiene alguno de los términos prohibidos, se descarta (retorna false)
    return !forbiddenTerms.some(term => text.includes(term));
};

const sortTimeline = (events: ClinicalEvent[]) => {
    return events
        .filter(isEventRelevant) // Aplicamos el filtro aquí
        .sort((a, b) => parseDate(a.date) - parseDate(b.date));
};

// --- API Helpers ---

// 1. EXTRACT TIMELINE
const extractTimelineFromDocs = async (
    historyText: string,
    historyFiles: FileData[]
): Promise<ClinicalEvent[]> => {
    if (!historyText && historyFiles.length === 0) return [];
    
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.5-flash'; 

        const parts: any[] = [];
        parts.push({ text: `
            Analiza los documentos y extrae la cronología clínica.
            
            REGLAS DE EXCLUSIÓN (ESTRICTAS):
            - NO INCLUIR: Turnos, "se solicita turno", "asistirá a", "paciente citado", reprogramaciones, trámites administrativos, empadronamiento, firmas de consentimientos, autorizaciones de obra social, "mesa de entradas".
            - NO INCLUIR: Consultas donde solo se indica "se solicita estudio" sin ver al paciente o sin datos clínicos nuevos.
            - SOLO INCLUIR: Hechos consumados (Cirugías HECHAS, Quimio RECIBIDA, Estudios CON RESULTADO, Consultas CON EXAMEN FÍSICO).
            
            FORMATO:
            1. IDIOMA: Español.
            2. FECHAS: DD/MM/YYYY.
            3. CATEGORÍAS: Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución.
            4. isKey: true solo para hitos mayores (Diagnóstico, Inicio Tratamiento, Progresión).
        `});
        
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

        if (response.text) {
            const rawEvents = JSON.parse(response.text);
            return sortTimeline(rawEvents); 
        }
        return [];
    } catch (e: any) {
        console.error("Extraction error:", e);
        throw e;
    }
};

// 2. GENERATE SUMMARY
const generateClinicalSummary = async (
    patient: Patient,
    files: FileData[]
): Promise<string> => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "Error: API Key faltante";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.5-flash';

        const parts: any[] = [];
        
        const patientData = `
            PACIENTE: ${patient.name}
            EDAD: ${patient.age}
            DIAGNÓSTICO: ${patient.diagnosis}
            NOTAS MANUALES: ${patient.historyText}
            LÍNEA DE TIEMPO EXISTENTE: ${JSON.stringify(patient.timeline)}
        `;

        const prompt = `
            Genera un RESUMEN DE HISTORIA CLÍNICA oncológico completo y profesional.
            
            FORMATO REQUERIDO (Estricto, sin asteriscos de markdown, usar texto plano limpio):
            
            Resumen de Historia Clínica
            Paciente: [Nombre] Edad: [Edad] [Otros datos si figuran]
            
            1. Motivo de Consulta y Enfermedad Actual
            [Redacción narrativa cronológica del diagnóstico y situación actual]
            
            2. Antecedentes
            [Listar APP, AQX, ATOX, AGO, AHF si figuran]
            
            3. Examen Físico
            [Datos de PS, Peso, Talla y hallazgos relevantes]
            
            4. Estudios Complementarios
            [Anatomía Patológica, Laboratorios clave, Imágenes con fechas y conclusiones]
            
            5. Diagnóstico y Estadificación
            Diagnóstico: [Texto]
            Estadificación: [TNM/Estadio]
            
            6. Evolución y Tratamiento
            [Narrativa cronológica de tratamientos recibidos, toxicidades y respuesta hasta la fecha actual]

            IMPORTANTE:
            - No uses negritas (**) ni cursivas.
            - Sé preciso con las fechas.
            - Usa lenguaje médico técnico.
        `;

        parts.push({ text: prompt });
        parts.push({ text: patientData });

        for (const file of files) {
            parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts }
        });

        return response.text || "No se pudo generar el resumen.";

    } catch (e: any) {
        return "Error generando resumen: " + e.message;
    }
};

// 3. CHAT BOT
const getAIResponse = async (
    historyText: string,
    historyFiles: FileData[],
    timeline: ClinicalEvent[],
    guidelineFiles: FileData[],
    messages: ChatMessage[],
    newMessage: string
) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "ERROR: API_KEY no configurada.";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.5-flash'; 
        
        const parts: any[] = [];
        let contextPrompt = "CONTEXTO ONCOLÓGICO DEL PACIENTE:\n";
        
        if (timeline && timeline.length > 0) {
            contextPrompt += "\nEVENTOS DEL HISTORIAL (Ordenados):\n";
            timeline.forEach(t => {
                contextPrompt += `- ${t.isKey ? '[CRÍTICO] ' : ''}${t.date}: ${t.note} (${t.category})\n`;
            });
        }
        
        parts.push({ text: contextPrompt });

        for (const file of historyFiles.slice(0, 3)) {
            parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        }

        if (guidelineFiles.length > 0) {
            parts.push({ text: "\nGUÍAS NCCN ADJUNTAS:\n" });
            for (const file of guidelineFiles.slice(0, 3)) {
                parts.push({ inlineData: { mimeType: file.type, data: file.data } });
            }
        }

        const recentMessages = messages.slice(-5);
        let conversationHistory = "\nCHAT PREVIO:\n";
        recentMessages.forEach(msg => {
            conversationHistory += `${msg.role === 'user' ? 'Dr' : 'IA'}: ${msg.text}\n`;
        });
        parts.push({ text: conversationHistory });
        parts.push({ text: `\nCONSULTA MÉDICA: ${newMessage}` });

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: {
                systemInstruction: "Eres un oncólogo experto. Responde en español técnico.",
                temperature: 0.1,
            }
        });

        return response.text || "Sin respuesta del modelo.";
    } catch (error: any) {
        return `ERROR DE IA: ${error.message}`;
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
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [apiKeyExists, setApiKeyExists] = useState<boolean>(!!import.meta.env.VITE_API_KEY);

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
    
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualDoctor, setManualDoctor] = useState(doctorName || '');
    const [manualNote, setManualNote] = useState('');

    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    const [activeTab, setActiveTab] = useState<'docs' | 'timeline'>('docs');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setApiKeyExists(!!import.meta.env.VITE_API_KEY);
    }, []);

    useEffect(() => {
        if (!doctorName) {
            setPatients([]);
            return;
        }
        const q = query(collection(db, "patients"), where("doctorId", "==", doctorName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firebasePatients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Patient));
            firebasePatients.sort((a, b) => b.lastUpdated - a.lastUpdated);
            setPatients(firebasePatients);
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
                setChatMessages(p.chatHistory || []);
                setTimeline(p.timeline ? sortTimeline([...p.timeline]) : []); 
                setHistoryFiles([]); setGuidelineFiles([]);
                setLastError(null);
                setActiveTab(p.timeline && p.timeline.length > 0 ? 'timeline' : 'docs');
                setManualDate(new Date().toISOString().split('T')[0]); 
                setManualDoctor(doctorName || '');
            }
        }
    }, [selectedPatientId, patients]);

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
        await updateDoc(patientRef, {
            timeline: updatedTimeline,
            lastUpdated: Date.now()
        });
    };

    const handleGenerateSummary = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;

        setIsGeneratingSummary(true);
        setShowSummaryModal(true);
        setSummaryText("Generando resumen detallado...");

        const summary = await generateClinicalSummary(p, historyFiles);
        setSummaryText(summary);
        setIsGeneratingSummary(false);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;
        setLastError(null);
        const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updatedUser = [...chatMessages, newUserMsg];
        setChatMessages(updatedUser);
        setChatInput('');
        setIsTyping(true);
        
        const responseText = await getAIResponse(historyText, historyFiles, timeline, guidelineFiles, updatedUser, newUserMsg.text);
        
        const newAiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        const updatedAI = [...updatedUser, newAiMsg];
        setChatMessages(updatedAI);
        setIsTyping(false);

        const patientRef = doc(db, "patients", selectedPatientId);
        await updateDoc(patientRef, {
            chatHistory: updatedAI,
            lastUpdated: Date.now()
        });
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
            setSelectedPatientId(docRef.id);
            setShowNewPatientModal(false);
            setNewPatientName(''); setNewPatientAge(''); setNewPatientDiagnosis('');
        } catch (error: any) {
            setLastError("Error creando paciente: " + error.message);
        }
    };

    const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (confirm("¿Estás seguro de que deseas eliminar este paciente permanentemente?")) {
            try {
                await deleteDoc(doc(db, "patients", id));
                if (selectedPatientId === id) setSelectedPatientId(null);
            } catch (error: any) {
                setLastError("Error al eliminar: " + error.message);
            }
        }
    };

    if (!doctorName) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-gray-100 text-center">
                <div className="inline-block bg-blue-600 p-5 rounded-3xl shadow-xl shadow-blue-100 mb-8"><Stethoscope className="text-white w-10 h-10" /></div>
                <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tighter">OncoGuide AI</h1>
                <p className="text-gray-400 mb-10 text-sm font-medium">Asistente Clínico de Nueva Generación</p>
                <div className="space-y-4">
                    <input type="text" className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-100 outline-none transition-all font-bold text-center" placeholder="Tu Nombre Profesional" onKeyDown={(e) => {if(e.key==='Enter' && (e.target as any).value) setDoctorName((e.target as any).value)}} />
                    <button onClick={() => {
                        const input = document.querySelector('input');
                        if(input?.value) setDoctorName(input.value);
                    }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">Acceder al Sistema</button>
                </div>
            </div>
        </div>
    );

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    return (
        <div className="flex h-screen overflow-hidden bg-white text-gray-800 font-medium">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b flex items-center justify-between bg-white">
                    <div className="flex items-center space-x-2 text-blue-600 font-black text-xl tracking-tighter"><Activity size={28} /><span>OncoGuide</span></div>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-gray-300"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <div className="flex items-center justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest px-2 mb-4"><span>Pacientes (Nube)</span><button onClick={() => setShowNewPatientModal(true)} className="text-blue-600 bg-blue-50 p-1.5 rounded-xl"><Plus size={16}/></button></div>
                        <div className="space-y-2">
                            {patients.length === 0 && <p className="text-center text-xs text-gray-400 py-4">No tienes pacientes aún.</p>}
                            {patients.map(p => (
                                <div key={p.id} onClick={() => {setSelectedPatientId(p.id); setMobileMenuOpen(false);}} className={`group w-full text-left p-4 rounded-[1.5rem] transition-all flex items-center justify-between cursor-pointer ${selectedPatientId === p.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}>
                                    <div className="flex flex-col truncate pr-2">
                                        <span className="font-black text-sm truncate">{p.name}</span>
                                        <span className={`text-[10px] font-bold truncate ${selectedPatientId === p.id ? 'text-blue-100 opacity-80' : 'text-gray-400'}`}>{p.diagnosis}</span>
                                    </div>
                                    <button onClick={(e) => handleDeletePatient(p.id, e)} className={`p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors ${selectedPatientId === p.id ? 'text-blue-200 hover:text-white hover:bg-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}><Trash2 size={14} /></button>
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
                    <div className={`px-4 py-2 rounded-2xl flex items-center space-x-2 text-[10px] font-black tracking-widest uppercase transition-all ${apiKeyExists ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                        {apiKeyExists ? <div className="w-2 h-2 bg-green-500 rounded-full"></div> : <ShieldAlert size={14}/>}
                        <span>{apiKeyExists ? 'API Cloud: Conectado' : 'API Cloud: Error Vercel'}</span>
                    </div>
                </header>

                {selectedPatient ? (
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50">
                        {/* Left Panel */}
                        <div className="lg:w-1/2 flex flex-col border-r bg-white h-full overflow-hidden shadow-2xl relative z-10">
                            <div className="flex border-b text-[10px] font-black uppercase tracking-[0.2em] bg-gray-50/50">
                                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-6 transition-all border-r border-gray-100 ${activeTab === 'docs' ? 'text-blue-600 bg-white' : 'text-gray-300 hover:text-gray-500'}`}>1. Documentación</button>
                                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-6 transition-all ${activeTab === 'timeline' ? 'text-blue-600 bg-white' : 'text-gray-300 hover:text-gray-500'}`}>2. Historial de Eventos</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
                                {activeTab === 'docs' ? (
                                    <>
                                        <section className="space-y-6">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-2"><h3 className="text-xs font-black text-gray-300 uppercase tracking-widest">Información Base</h3><button onClick={() => {
                                                if(selectedPatientId) {
                                                    const patientRef = doc(db, "patients", selectedPatientId);
                                                    updateDoc(patientRef, { historyText, lastUpdated: Date.now() });
                                                }
                                            }} className="text-blue-500 font-black text-[10px] hover:underline uppercase">Guardar Cambios</button></div>
                                            <FileUploader label="Historia Clínica Digital" files={historyFiles} setFiles={setHistoryFiles} />
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notas Manuales del Profesional</label>
                                                <textarea className="w-full h-40 p-6 border-2 border-gray-50 rounded-3xl text-sm font-semibold bg-gray-50 focus:bg-white focus:border-blue-100 transition-all outline-none resize-none shadow-inner" placeholder="Escribe hallazgos adicionales..." value={historyText} onChange={(e) => setHistoryText(e.target.value)} />
                                            </div>
                                            <button onClick={handleProcessDocuments} disabled={isProcessingDocs} className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] text-xs font-black tracking-widest shadow-2xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center">
                                                {isProcessingDocs ? <><Loader2 className="animate-spin mr-2" size={18}/>Analizando Documentos...</> : "PROCESAR HISTORIA COMPLETA"}
                                            </button>
                                        </section>

                                        <section className="space-y-4 pt-6 border-t border-gray-100">
                                            <div className="flex items-center space-x-2 text-gray-400"><PenTool size={14} /><h3 className="text-xs font-black uppercase tracking-widest">Evolución Manual (Al Timeline)</h3></div>
                                            <div className="bg-gray-50 p-4 rounded-[1.5rem] border border-gray-100 space-y-3">
                                                <div className="flex space-x-2">
                                                    <input type="date" className="bg-white px-3 py-2 rounded-xl text-xs font-bold border border-gray-200" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                                                    <input type="text" className="flex-1 bg-white px-3 py-2 rounded-xl text-xs font-bold border border-gray-200" placeholder="Médico" value={manualDoctor} onChange={e => setManualDoctor(e.target.value)} />
                                                </div>
                                                <textarea className="w-full h-20 bg-white p-3 rounded-xl text-sm font-medium border border-gray-200 resize-none" placeholder="Escribir evolución..." value={manualNote} onChange={e => setManualNote(e.target.value)} />
                                                <button onClick={handleAddManualEvolution} disabled={!manualNote.trim()} className="w-full bg-gray-800 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-50">Agregar a Línea de Tiempo</button>
                                            </div>
                                        </section>

                                        <section className="space-y-6 pt-4 border-t border-gray-100">
                                            <button onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="w-full flex items-center justify-center space-x-2 bg-indigo-50 text-indigo-600 border border-indigo-100 py-4 rounded-[1.5rem] text-xs font-black tracking-widest hover:bg-indigo-100 transition-all">
                                                {isGeneratingSummary ? <Loader2 className="animate-spin" size={16} /> : <FileOutput size={16} />}
                                                <span>GENERAR RESUMEN CLÍNICO</span>
                                            </button>
                                            <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 pb-2">Material de Referencia</h3>
                                            <FileUploader label="Guías NCCN / Protocolos Locales" files={guidelineFiles} setFiles={setGuidelineFiles} accept=".pdf" />
                                        </section>
                                    </>
                                ) : (
                                    <div className="space-y-4 pt-4">
                                        {timeline.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-gray-200"><Clock size={48} className="mb-4 opacity-10" /><p className="text-xs font-black uppercase tracking-widest">No hay datos procesados aún</p></div>
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

                        {/* Right Panel: Chat */}
                        <div className="lg:w-1/2 flex flex-col bg-gray-50 h-full overflow-hidden relative">
                            {lastError && (
                                <div className="absolute top-4 left-4 right-4 z-30 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-start space-x-3 border border-red-500 animate-in slide-in-from-top">
                                    <Terminal className="flex-shrink-0 mt-1" size={18}/>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">Diagnóstico de Error (Vercel):</p>
                                        <p className="text-xs font-bold leading-tight">{lastError}</p>
                                    </div>
                                    <button onClick={() => setLastError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={16}/></button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30 select-none">
                                        <div className="bg-white p-8 rounded-[3rem] shadow-sm"><MessageSquare size={56} className="text-blue-600" /></div>
                                        <div className="space-y-2">
                                            <p className="text-sm font-black uppercase tracking-widest">Asistente Oncológico</p>
                                            <p className="text-xs font-bold max-w-[220px] mx-auto leading-relaxed">Analice el caso clínico y contraste con las guías internacionales.</p>
                                        </div>
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
                                    <textarea className="flex-1 bg-transparent text-sm font-bold outline-none resize-none max-h-32 scrollbar-hide py-2" placeholder="Consulta Médica / Plan de Tratamiento..." rows={2} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
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
                            <p className="text-gray-400 text-sm mt-4 font-bold leading-relaxed">Seleccione un paciente o inicie un nuevo registro para comenzar el análisis oncológico asistido por IA.</p>
                            <button onClick={() => setShowNewPatientModal(true)} className="mt-10 bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-xs tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 uppercase">Nuevo Paciente</button>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal de Resumen */}
            {showSummaryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-6">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center space-x-2 text-indigo-600 font-black text-sm uppercase tracking-widest"><FileOutput size={18}/><span>Resumen de Historia Clínica</span></div>
                            <button onClick={() => setShowSummaryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
                            {isGeneratingSummary ? (
                                <div className="h-full flex flex-col items-center justify-center text-indigo-400 space-y-4">
                                    <Loader2 size={40} className="animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest">Redactando resumen profesional...</p>
                                </div>
                            ) : (
                                <textarea className="w-full h-full bg-white p-8 rounded-xl border border-gray-100 text-sm font-mono leading-relaxed resize-none focus:outline-none" value={summaryText} readOnly />
                            )}
                        </div>
                        <div className="p-6 border-t bg-white flex justify-end">
                            <button onClick={() => {navigator.clipboard.writeText(summaryText); alert("Copiado al portapapeles");}} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Copiar Texto</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Paciente */}
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
                            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] text-xs font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest">Registrar Paciente</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
