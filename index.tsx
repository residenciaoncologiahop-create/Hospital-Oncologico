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
    Calendar, PenTool, FileOutput, FileDown, ClipboardCheck, Dna, Presentation, CheckCircle
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

interface OncologyPlan {
    intent: string; // Curativa, Paliativa, Adyuvante
    line: string;   // 1ra, 2da, 3ra
    scheme: string; // Drogas actuales
}

interface Patient {
    id: string;
    doctorId: string; 
    name: string;
    age: number;
    diagnosis: string;
    
    historyText: string;
    molecularData: string; // NUEVO: Biomarcadores
    oncologyPlan: OncologyPlan; // NUEVO: Plan estructurado
    
    lastUpdated: number;
    chatHistory?: ChatMessage[];
    timeline?: ClinicalEvent[];
}

interface FileData {
    name: string;
    type: string;
    data: string; // base64
}

// --- Helper: Date Sorter ---
const parseDate = (dateStr: string) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    return 0; 
};

const sortTimeline = (events: ClinicalEvent[]) => {
    return events.sort((a, b) => parseDate(a.date) - parseDate(b.date));
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
            
            REGLA DE ORO (IDIOMA): TODO el contenido extraído (especialmente el campo 'note') DEBE estar escrito en ESPAÑOL. 
            Si el documento original está en inglés, TRADÚCELO AL ESPAÑOL.

            FORMATO:
            1. FECHAS: DD/MM/YYYY.
            2. CATEGORÍAS: Consulta, Imagen, Lab, Cirugía, Quimio, Radio, Evolución.
            3. isKey: true solo para hitos mayores (Diagnóstico, Inicio Tratamiento, Progresión).
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
            BIOMARCADORES: ${patient.molecularData}
            PLAN ACTUAL: ${JSON.stringify(patient.oncologyPlan)}
            LÍNEA DE TIEMPO: ${JSON.stringify(patient.timeline)}
        `;

        const prompt = `
            Genera un RESUMEN DE HISTORIA CLÍNICA oncológico profesional en ESPAÑOL.
            
            FORMATO REQUERIDO (Texto plano limpio, sin markdown):
            
            Resumen de Historia Clínica
            Paciente: [Nombre] Edad: [Edad]
            
            1. Motivo de Consulta y Enfermedad Actual
            [Narrativa cronológica]
            
            2. Antecedentes
            [APP, AQX, ATOX, AGO, AHF]
            
            3. Biología Molecular y Biomarcadores
            [Incluir datos de biomarcadores si existen]
            
            4. Estudios Complementarios
            [Anatomía Patológica, Labs, Imágenes]
            
            5. Diagnóstico, Estadificación y Plan Actual
            Diagnóstico: [Texto]
            Estadio: [TNM]
            Plan Vigente: [Intención, Línea, Esquema]
            
            6. Evolución
            [Resumen de tratamientos recibidos y respuesta]
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

// 3. GENERATE TUMOR BOARD PRESENTATION (NUEVO: MODO ATENEO)
const generateTumorBoardPresentation = async (
    patient: Patient,
    files: FileData[]
): Promise<string> => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "Error de API Key";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.5-flash';

        const parts: any[] = [];
        
        const context = `
            PACIENTE: ${patient.name}, ${patient.age} años.
            DIAGNÓSTICO: ${patient.diagnosis}.
            MOLECULAR: ${patient.molecularData}.
            PLAN: ${JSON.stringify(patient.oncologyPlan)}.
            HISTORIAL: ${JSON.stringify(patient.timeline)}
        `;

        const prompt = `
            Actúa como un oncólogo presentando un caso en un ATENEO MULTIDISCIPLINARIO (Tumor Board).
            Genera una presentación estructurada y concisa para discusión.
            
            ESTRUCTURA DE LA PRESENTACIÓN:
            
            1. TITULAR DEL CASO
            (Ej: Paciente de X años con Ca de Pulmón E-IV en progresión...)
            
            2. RESUMEN CRONOLÓGICO CLAVE
            (Solo los hitos que definen la situación actual, no todo el historial).
            
            3. ESTATUS MOLECULAR Y PERFORMANCE STATUS
            (Drivers moleculares, PD-L1, ECOG estimado).
            
            4. SITUACIÓN ACTUAL Y PROBLEMA A RESOLVER
            (¿Por qué se presenta? ¿Falla de tratamiento? ¿Toxicidad? ¿Duda diagnóstica?).
            
            5. PREGUNTAS AL COMITÉ
            (Listar 3 preguntas clave para los colegas: Cirugía, Radioterapia, Oncología).
            
            6. BIBLIOGRAFÍA SUGERIDA (NCCN/ESMO)
            (Breve mención de guías aplicables).
        `;

        parts.push({ text: prompt });
        parts.push({ text: context });
        
        for (const file of files) {
            parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts }
        });

        return response.text || "No se pudo generar la presentación.";
    } catch(e: any) {
        return "Error: " + e.message;
    }
};

// 4. FOLLOW UP
const generateFollowUpAdvice = async (
    patient: Patient,
    files: FileData[]
): Promise<string> => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "Error de API Key";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.5-flash';

        const parts: any[] = [];
        const context = `PACIENTE: ${patient.name}. DIAGNÓSTICO: ${patient.diagnosis}. MOLECULAR: ${patient.molecularData}. PLAN: ${JSON.stringify(patient.oncologyPlan)}. HISTORIAL: ${JSON.stringify(patient.timeline)}`;
        const prompt = "Sugiere PLAN DE SEGUIMIENTO (Follow-up) detallado basado en NCCN/ESMO. Incluir: Estado Actual, Próximos Estudios, Frecuencia consultas.";

        parts.push({ text: prompt });
        parts.push({ text: context });
        for (const file of files) parts.push({ inlineData: { mimeType: file.type, data: file.data } });

        const response = await ai.models.generateContent({model: modelId, contents: { parts }});
        return response.text || "Sin respuesta.";
    } catch(e: any) { return "Error: " + e.message; }
};

// 5. CHAT BOT
const getAIResponse = async (
    historyText: string,
    historyFiles: FileData[],
    timeline: ClinicalEvent[],
    guidelineFiles: FileData[],
    messages: ChatMessage[],
    newMessage: string,
    molecularData: string,
    oncologyPlan: OncologyPlan
) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "ERROR: API_KEY no configurada.";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const modelId = 'gemini-2.5-flash'; 
        
        const parts: any[] = [];
        let contextPrompt = `CONTEXTO ONCOLÓGICO:\nBIOMARCADORES: ${molecularData}\nPLAN ACTUAL: ${JSON.stringify(oncologyPlan)}\n`;
        
        if (timeline && timeline.length > 0) {
            contextPrompt += "\nEVENTOS RECIENTES:\n";
            timeline.slice(-15).forEach(t => {
                contextPrompt += `- ${t.date}: ${t.note} (${t.category})\n`;
            });
        }
        
        parts.push({ text: contextPrompt });

        for (const file of historyFiles.slice(0, 3)) parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        if (guidelineFiles.length > 0) {
            parts.push({ text: "\nGUÍAS NCCN ADJUNTAS:\n" });
            for (const file of guidelineFiles.slice(0, 3)) parts.push({ inlineData: { mimeType: file.type, data: file.data } });
        }

        const recentMessages = messages.slice(-5);
        let conversationHistory = "\nCHAT PREVIO:\n";
        recentMessages.forEach(msg => conversationHistory += `${msg.role === 'user' ? 'Dr' : 'IA'}: ${msg.text}\n`);
        parts.push({ text: conversationHistory });
        parts.push({ text: `\nCONSULTA MÉDICA: ${newMessage}` });

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: { systemInstruction: "Eres un oncólogo experto. Responde en español técnico.", temperature: 0.1 }
        });

        return response.text || "Sin respuesta.";
    } catch (error: any) { return `ERROR IA: ${error.message}`; }
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
            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">{label}</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs border border-blue-100 font-bold">
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 text-blue-300 hover:text-blue-600"><X size={14} /></button>
                    </div>
                ))}
            </div>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-100 border-dashed rounded-2xl cursor-pointer bg-gray-50 hover:bg-white hover:border-blue-300 transition-all group">
                <Upload className="w-5 h-5 text-gray-300 group-hover:text-blue-400 mb-2" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-tight">Seleccionar Archivos</span>
                <input type="file" className="hidden" multiple accept={accept} onChange={handleFileChange} />
            </label>
        </div>
    );
};

const App = () => {
    const [doctorName, setDoctorName] = useState<string | null>(localStorage.getItem('doctor_name'));
    const [legalAccepted, setLegalAccepted] = useState(false); // NUEVO: Check legal
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [apiKeyExists, setApiKeyExists] = useState<boolean>(!!import.meta.env.VITE_API_KEY);

    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientAge, setNewPatientAge] = useState('');
    const [newPatientDiagnosis, setNewPatientDiagnosis] = useState('');

    const [historyText, setHistoryText] = useState('');
    const [molecularData, setMolecularData] = useState(''); // NUEVO
    const [oncologyPlan, setOncologyPlan] = useState<OncologyPlan>({ intent: '', line: '', scheme: '' }); // NUEVO

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

    const [showTumorBoardModal, setShowTumorBoardModal] = useState(false); // NUEVO: Modal Ateneo
    const [tumorBoardText, setTumorBoardText] = useState('');
    const [isGeneratingTumorBoard, setIsGeneratingTumorBoard] = useState(false);

    const [activeTab, setActiveTab] = useState<'docs' | 'timeline'>('docs');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setApiKeyExists(!!import.meta.env.VITE_API_KEY);
    }, []);

    // Firebase Load
    useEffect(() => {
        if (!doctorName) { setPatients([]); return; }
        const q = query(collection(db, "patients"), where("doctorId", "==", doctorName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firebasePatients = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    doctorId: data.doctorId,
                    name: data.name,
                    age: data.age,
                    diagnosis: data.diagnosis,
                    historyText: data.historyText || '',
                    molecularData: data.molecularData || '', // Default empty
                    oncologyPlan: data.oncologyPlan || { intent: '', line: '', scheme: '' }, // Default obj
                    lastUpdated: data.lastUpdated,
                    chatHistory: data.chatHistory,
                    timeline: data.timeline
                } as Patient;
            });
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
                setMolecularData(p.molecularData || '');
                setOncologyPlan(p.oncologyPlan || { intent: '', line: '', scheme: '' });
                
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

    // Save Patient Details Helper
    const savePatientDetails = async () => {
        if (selectedPatientId) {
            const patientRef = doc(db, "patients", selectedPatientId);
            await updateDoc(patientRef, { 
                historyText, 
                molecularData, 
                oncologyPlan,
                lastUpdated: Date.now() 
            });
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
    };

    const handleDeleteEvent = async (indexToDelete: number) => {
        if (!selectedPatientId || !timeline) return;
        if (confirm("¿Eliminar este evento?")) {
            const updatedTimeline = timeline.filter((_, index) => index !== indexToDelete);
            setTimeline(updatedTimeline); 
            const patientRef = doc(db, "patients", selectedPatientId);
            await updateDoc(patientRef, { timeline: updatedTimeline, lastUpdated: Date.now() });
        }
    };

    // GENERATORS
    const handleGenerateSummary = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setIsGeneratingSummary(true); setShowSummaryModal(true); setSummaryText("Generando resumen...");
        const summary = await generateClinicalSummary(p, historyFiles);
        setSummaryText(summary); setIsGeneratingSummary(false);
    };

    const handleGenerateFollowUp = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setIsGeneratingFollowUp(true); setShowFollowUpModal(true); setFollowUpText("Analizando guías...");
        const advice = await generateFollowUpAdvice(p, guidelineFiles);
        setFollowUpText(advice); setIsGeneratingFollowUp(false);
    };

    const handleGenerateTumorBoard = async () => {
        if (!selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setIsGeneratingTumorBoard(true); setShowTumorBoardModal(true); setTumorBoardText("Preparando presentación...");
        const text = await generateTumorBoardPresentation(p, historyFiles);
        setTumorBoardText(text); setIsGeneratingTumorBoard(false);
    };

    const handlePrintPDF = (content: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>OncoGuide Doc</title><style>body { font-family: monospace; padding: 40px; white-space: pre-wrap; font-size: 14px; line-height: 1.5; } h1 { font-family: sans-serif; font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;}</style></head><body><h1>OncoGuide - Documento Clínico</h1>${content}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;
        setLastError(null);
        const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updatedUser = [...chatMessages, newUserMsg];
        setChatMessages(updatedUser); setChatInput(''); setIsTyping(true);
        
        const responseText = await getAIResponse(historyText, historyFiles, timeline, guidelineFiles, updatedUser, newUserMsg.text, molecularData, oncologyPlan);
        
        const newAiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        const updatedAI = [...updatedUser, newAiMsg];
        setChatMessages(updatedAI); setIsTyping(false);

        const patientRef = doc(db, "patients", selectedPatientId);
        await updateDoc(patientRef, { chatHistory: updatedAI, lastUpdated: Date.now() });
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
            molecularData: '', // Init empty
            oncologyPlan: { intent: '', line: '', scheme: '' }, // Init empty
            lastUpdated: Date.now(),
            chatHistory: [],
            timeline: []
        };
        try {
            const docRef = await addDoc(collection(db, "patients"), p);
            setSelectedPatientId(docRef.id); setShowNewPatientModal(false);
            setNewPatientName(''); setNewPatientAge(''); setNewPatientDiagnosis('');
        } catch (error: any) { setLastError("Error creando paciente: " + error.message); }
    };

    const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (confirm("¿Eliminar paciente permanentemente?")) {
            try {
                await deleteDoc(doc(db, "patients", id));
                if (selectedPatientId === id) setSelectedPatientId(null);
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
                <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tighter">OncoGuide AI</h1>
                <p className="text-gray-400 mb-8 text-sm font-medium">Asistente Clínico de Nueva Generación</p>
                <div className="space-y-4">
                    <input type="text" className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-100 outline-none transition-all font-bold text-center text-lg" placeholder="Tu Nombre Profesional" onKeyDown={(e) => {if(e.key==='Enter' && (e.target as any).value && legalAccepted) setDoctorName((e.target as any).value)}} />
                    
                    {/* LEGAL CHECKBOX */}
                    <div className="flex items-start space-x-2 text-left px-2">
                        <input type="checkbox" id="legal" checked={legalAccepted} onChange={e => setLegalAccepted(e.target.checked)} className="mt-1" />
                        <label htmlFor="legal" className="text-[10px] text-gray-400 leading-tight">
                            Entiendo que esta herramienta utiliza IA como apoyo y <strong>no sustituye el juicio clínico</strong>. La responsabilidad de las decisiones médicas recae exclusivamente en el profesional tratante.
                        </label>
                    </div>

                    <button onClick={() => {
                        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                        if(input?.value && legalAccepted) setDoctorName(input.value);
                    }} disabled={!legalAccepted} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-base shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">Acceder al Sistema</button>
                </div>
            </div>
        </div>
    );

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    return (
        <div className="flex h-screen overflow-hidden bg-white text-gray-800 font-medium text-sm">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r transform lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b flex items-center justify-between bg-white">
                    <div className="flex items-center space-x-2 text-blue-600 font-black text-2xl tracking-tighter"><Activity size={28} /><span>OncoGuide</span></div>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-gray-300"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                        <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-4"><span>Pacientes (Nube)</span><button onClick={() => setShowNewPatientModal(true)} className="text-blue-600 bg-blue-50 p-1.5 rounded-xl"><Plus size={16}/></button></div>
                        <div className="px-2 mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                                <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-300 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            {filteredPatients.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Sin resultados.</p>}
                            {filteredPatients.map(p => (
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
                <div className="p-6 border-t bg-white flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 truncate">
                            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-50">{doctorName[0]}</div>
                            <div className="flex flex-col truncate"><span className="text-xs font-black text-gray-400 uppercase leading-none mb-1">Profesional</span><span className="text-sm font-black truncate leading-none">Dr. {doctorName}</span></div>
                        </div>
                        <button onClick={() => setDoctorName(null)} className="text-gray-200 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
                    </div>
                    <p className="text-[9px] text-gray-300 text-center font-medium">Uso exclusivo médico. <br/>Decisión clínica no automatizada.</p>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white/80 backdrop-blur-md border-b h-20 flex items-center px-8 justify-between z-20">
                    <div className="flex items-center space-x-6">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400"><Menu size={28} /></button>
                        <div className="flex flex-col">
                            <h1 className="font-black text-gray-800 text-2xl tracking-tight leading-none truncate max-w-lg">{selectedPatient ? selectedPatient.name : 'Bienvenido'}</h1>
                            {selectedPatient && <span className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">{selectedPatient.diagnosis} • {selectedPatient.age} Años</span>}
                        </div>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl flex items-center space-x-2 text-xs font-black tracking-widest uppercase transition-all ${apiKeyExists ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                        {apiKeyExists ? <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div> : <ShieldAlert size={16}/>}
                        <span>{apiKeyExists ? 'API Cloud: Conectado' : 'API Cloud: Error'}</span>
                    </div>
                </header>

                {selectedPatient ? (
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50">
                        {/* Left Panel */}
                        <div className="lg:w-1/2 flex flex-col border-r bg-white h-full overflow-hidden shadow-2xl relative z-10">
                            <div className="flex border-b text-xs font-black uppercase tracking-[0.2em] bg-gray-50/50">
                                <button onClick={() => setActiveTab('docs')} className={`flex-1 py-6 transition-all border-r border-gray-100 ${activeTab === 'docs' ? 'text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>1. Documentación</button>
                                <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-6 transition-all ${activeTab === 'timeline' ? 'text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>2. Historial de Eventos</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
                                {activeTab === 'docs' ? (
                                    <>
                                        {/* SECTION 1: ONCOLOGY PLAN (NUEVO) */}
                                        <section className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                                            <div className="flex items-center space-x-2 text-blue-600"><CheckCircle size={16} /><h3 className="text-xs font-black uppercase tracking-widest">Plan Oncológico Vigente</h3></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <input type="text" placeholder="Intención (Curativa/Pal...)" className="bg-white px-4 py-3 rounded-2xl text-xs font-bold border border-blue-100 text-blue-800 placeholder-blue-300" value={oncologyPlan.intent} onChange={e => setOncologyPlan({...oncologyPlan, intent: e.target.value})} onBlur={savePatientDetails} />
                                                <input type="text" placeholder="Línea (1ra, 2da...)" className="bg-white px-4 py-3 rounded-2xl text-xs font-bold border border-blue-100 text-blue-800 placeholder-blue-300" value={oncologyPlan.line} onChange={e => setOncologyPlan({...oncologyPlan, line: e.target.value})} onBlur={savePatientDetails} />
                                            </div>
                                            <input type="text" placeholder="Esquema Actual (Drogas)" className="w-full bg-white px-4 py-3 rounded-2xl text-xs font-bold border border-blue-100 text-blue-800 placeholder-blue-300" value={oncologyPlan.scheme} onChange={e => setOncologyPlan({...oncologyPlan, scheme: e.target.value})} onBlur={savePatientDetails} />
                                        </section>

                                        {/* SECTION 2: BIOMARKERS (NUEVO) */}
                                        <section className="space-y-2">
                                            <div className="flex items-center space-x-2 text-gray-400 px-2"><Dna size={14} /><h3 className="text-xs font-black uppercase tracking-widest">Biología Molecular / Biomarcadores</h3></div>
                                            <textarea className="w-full h-24 p-4 border-2 border-gray-100 rounded-3xl text-sm font-medium bg-gray-50 focus:bg-white focus:border-purple-200 transition-all outline-none resize-none" placeholder="Ej: BRCA1+, PD-L1 80%, MSI-High..." value={molecularData} onChange={(e) => setMolecularData(e.target.value)} onBlur={savePatientDetails} />
                                        </section>

                                        {/* SECTION 3: BASE DOCS */}
                                        <section className="space-y-6">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-2"><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Historia Clínica Base</h3><button onClick={savePatientDetails} className="text-blue-600 font-black text-[10px] hover:underline uppercase">Guardar Notas</button></div>
                                            <FileUploader label="Archivos Digitales" files={historyFiles} setFiles={setHistoryFiles} />
                                            <textarea className="w-full h-40 p-6 border-2 border-gray-100 rounded-3xl text-sm font-medium bg-gray-50 focus:bg-white focus:border-blue-200 transition-all outline-none resize-none shadow-inner" placeholder="Resumen manual del caso..." value={historyText} onChange={(e) => setHistoryText(e.target.value)} onBlur={savePatientDetails} />
                                            <button onClick={handleProcessDocuments} disabled={isProcessingDocs} className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] text-xs font-black tracking-widest shadow-2xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center">
                                                {isProcessingDocs ? <><Loader2 className="animate-spin mr-3" size={18}/>Analizando...</> : "PROCESAR DOCUMENTOS"}
                                            </button>
                                        </section>

                                        {/* SECTION 4: MANUAL EVOLUTION */}
                                        <section className="space-y-4 pt-6 border-t border-gray-100">
                                            <div className="flex items-center space-x-2 text-gray-400"><PenTool size={14} /><h3 className="text-xs font-black uppercase tracking-widest">Evolución Manual</h3></div>
                                            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                                                <div className="flex space-x-3">
                                                    <input type="date" className="bg-white px-4 py-3 rounded-2xl text-xs font-bold border border-gray-200" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                                                    <input type="text" className="flex-1 bg-white px-4 py-3 rounded-2xl text-xs font-bold border border-gray-200" placeholder="Médico" value={manualDoctor} onChange={e => setManualDoctor(e.target.value)} />
                                                </div>
                                                <textarea className="w-full h-24 bg-white p-4 rounded-2xl text-sm font-medium border border-gray-200 resize-none" placeholder="Escribir evolución..." value={manualNote} onChange={e => setManualNote(e.target.value)} />
                                                <button onClick={handleAddManualEvolution} disabled={!manualNote.trim()} className="w-full bg-gray-800 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-50">Agregar a Timeline</button>
                                            </div>
                                        </section>

                                        {/* SECTION 5: TOOLS & GUIDELINES */}
                                        <section className="space-y-6 pt-6 border-t border-gray-100">
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 py-4 rounded-[1.5rem] hover:bg-indigo-100 transition-all">
                                                    {isGeneratingSummary ? <Loader2 className="animate-spin mb-1" size={16} /> : <FileOutput size={16} className="mb-1" />}
                                                    <span className="text-[9px] font-black tracking-widest">RESUMEN</span>
                                                </button>
                                                <button onClick={handleGenerateFollowUp} disabled={isGeneratingFollowUp} className="flex flex-col items-center justify-center bg-teal-50 text-teal-600 border border-teal-100 py-4 rounded-[1.5rem] hover:bg-teal-100 transition-all">
                                                    {isGeneratingFollowUp ? <Loader2 className="animate-spin mb-1" size={16} /> : <ClipboardCheck size={16} className="mb-1" />}
                                                    <span className="text-[9px] font-black tracking-widest">SEGUIMIENTO</span>
                                                </button>
                                                <button onClick={handleGenerateTumorBoard} disabled={isGeneratingTumorBoard} className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 border border-rose-100 py-4 rounded-[1.5rem] hover:bg-rose-100 transition-all">
                                                    {isGeneratingTumorBoard ? <Loader2 className="animate-spin mb-1" size={16} /> : <Presentation size={16} className="mb-1" />}
                                                    <span className="text-[9px] font-black tracking-widest">ATENEO</span>
                                                </button>
                                            </div>
                                            <FileUploader label="Guías NCCN / Protocolos" files={guidelineFiles} setFiles={setGuidelineFiles} accept=".pdf" />
                                        </section>
                                    </>
                                ) : (
                                    <div className="space-y-6 pt-4">
                                        {timeline.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-gray-200"><Clock size={56} className="mb-4 opacity-10" /><p className="text-sm font-black uppercase tracking-widest">Sin eventos registrados</p></div>
                                        ) : (
                                            timeline.map((ev, i) => (
                                                <div key={i} className="relative pl-12 border-l-4 border-gray-100 pb-10 group">
                                                    <div className={`absolute -left-[14px] top-2 w-6 h-6 rounded-full border-4 border-white shadow-xl transition-all group-hover:scale-110 flex items-center justify-center ${ev.isKey ? 'bg-red-500 text-white' : 'bg-blue-400 text-white'}`}>
                                                        {ev.isKey ? <AlertCircle size={12}/> : <Info size={12}/>}
                                                    </div>
                                                    <div className={`p-8 rounded-[2.5rem] border-2 transition-all hover:shadow-2xl ${ev.isKey ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-50 shadow-sm'}`}>
                                                        <div className="flex justify-between items-center mb-4">
                                                            <span className={`text-xs font-black px-4 py-2 rounded-full tracking-widest uppercase ${ev.isKey ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'bg-blue-50 text-blue-600'}`}>{ev.date}</span>
                                                            <div className="flex items-center space-x-3">
                                                                <span className="text-xs text-gray-400 font-black uppercase truncate max-w-[200px]">{ev.professional}</span>
                                                                <button onClick={() => handleDeleteEvent(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                                            </div>
                                                        </div>
                                                        <h4 className={`font-black text-base mb-3 uppercase tracking-tight ${ev.isKey ? 'text-red-900' : 'text-gray-800'}`}>{ev.category}</h4>
                                                        <p className={`leading-relaxed text-sm font-medium ${ev.isKey ? 'text-red-900' : 'text-gray-600'}`}>{ev.note}</p>
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
                                <div className="absolute top-6 left-6 right-6 z-30 bg-red-600 text-white p-6 rounded-3xl shadow-2xl flex items-start space-x-4 border border-red-500 animate-in slide-in-from-top">
                                    <Terminal className="flex-shrink-0 mt-1" size={20}/>
                                    <div><p className="text-xs font-black uppercase tracking-widest mb-1">Error:</p><p className="text-sm font-bold leading-tight">{lastError}</p></div>
                                    <button onClick={() => setLastError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={20}/></button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-8 opacity-30 select-none">
                                        <div className="bg-white p-10 rounded-[3rem] shadow-sm"><MessageSquare size={64} className="text-blue-600" /></div>
                                        <div className="space-y-3">
                                            <p className="text-base font-black uppercase tracking-widest">Asistente Oncológico</p>
                                            <p className="text-sm font-bold max-w-[260px] mx-auto leading-relaxed">Soporte a la decisión clínica.</p>
                                        </div>
                                    </div>
                                )}
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-8 rounded-[3rem] text-base shadow-xl leading-relaxed font-medium ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-100' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                                            <div className="whitespace-pre-wrap">{m.text}</div>
                                            <div className={`text-xs mt-4 font-black uppercase tracking-widest ${m.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-300'}`}>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    </div>
                                ))}
                                {isTyping && <div className="flex justify-start"><div className="bg-white px-8 py-5 rounded-[2rem] border border-gray-100 shadow-sm animate-pulse text-xs font-black text-blue-600 tracking-[0.2em] uppercase">IA Razonando...</div></div>}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-10 bg-white/80 backdrop-blur-md border-t">
                                <div className="relative flex items-center bg-gray-50 rounded-[2.5rem] border-2 border-transparent focus-within:border-blue-100 focus-within:bg-white transition-all p-4 pl-8">
                                    <textarea className="flex-1 bg-transparent text-base font-bold outline-none resize-none max-h-40 scrollbar-hide py-3" placeholder="Consulta Médica / Plan de Tratamiento..." rows={2} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                                    <button onClick={handleSendMessage} disabled={!chatInput.trim() || isTyping} className="ml-4 p-5 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-100 disabled:opacity-50 active:scale-90 transition-all"><MessageSquare size={28} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-16 text-center bg-gray-50">
                        <div className="bg-white p-20 rounded-[5rem] shadow-2xl border border-gray-100 max-w-md">
                            <Activity size={96} className="mb-10 text-blue-600 mx-auto opacity-10 animate-pulse" />
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">Consola de Decisión</h2>
                            <p className="text-gray-400 text-base mt-6 font-bold leading-relaxed">Seleccione un paciente o inicie un nuevo registro.</p>
                            <button onClick={() => setShowNewPatientModal(true)} className="mt-12 bg-blue-600 text-white px-12 py-6 rounded-[2.5rem] font-black text-sm tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 uppercase">Nuevo Paciente</button>
                        </div>
                    </div>
                )}
            </main>

            {/* SHARED MODAL COMPONENT */}
            {(showSummaryModal || showFollowUpModal || showTumorBoardModal) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-8">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center space-x-3 text-gray-800 font-black text-sm uppercase tracking-widest">
                                {showSummaryModal ? <><FileOutput size={20} className="text-indigo-600"/><span>Resumen Clínico</span></> : 
                                 showFollowUpModal ? <><ClipboardCheck size={20} className="text-teal-600"/><span>Seguimiento</span></> :
                                 <><Presentation size={20} className="text-rose-600"/><span>Ateneo / Tumor Board</span></>}
                            </div>
                            <button onClick={() => {setShowSummaryModal(false); setShowFollowUpModal(false); setShowTumorBoardModal(false);}} className="text-gray-400 hover:text-gray-600"><X size={28}/></button>
                        </div>
                        <div className="flex-1 p-10 overflow-y-auto bg-gray-50/50">
                            {(isGeneratingSummary || isGeneratingFollowUp || isGeneratingTumorBoard) ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6">
                                    <Loader2 size={48} className="animate-spin" />
                                    <p className="text-sm font-black uppercase tracking-widest">Generando análisis experto...</p>
                                </div>
                            ) : (
                                <textarea className="w-full h-full bg-white p-10 rounded-3xl border border-gray-100 text-base font-mono leading-loose resize-none focus:outline-none" value={showSummaryModal ? summaryText : showFollowUpModal ? followUpText : tumorBoardText} readOnly />
                            )}
                        </div>
                        <div className="p-8 border-t bg-white flex justify-end space-x-4">
                            <button onClick={() => handlePrintPDF(showSummaryModal ? summaryText : showFollowUpModal ? followUpText : tumorBoardText)} className="flex items-center space-x-3 bg-gray-800 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
                                <FileDown size={16} /><span>Descargar PDF</span>
                            </button>
                            <button onClick={() => {navigator.clipboard.writeText(showSummaryModal ? summaryText : showFollowUpModal ? followUpText : tumorBoardText); alert("Copiado");}} className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Copiar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Paciente */}
            {showNewPatientModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-8">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden transform animate-in fade-in zoom-in duration-300">
                        <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">Registro Clínico</h3>
                            <button onClick={() => setShowNewPatientModal(false)} className="text-gray-300 hover:text-gray-600"><X size={28} /></button>
                        </div>
                        <form onSubmit={handleCreatePatient} className="p-12 space-y-10">
                            <div className="space-y-4">
                                <label className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] px-1">Paciente</label>
                                <input type="text" required className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-2xl text-base font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="Nombre Completo" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                            </div>
                            <div className="flex space-x-6">
                                <div className="w-1/3 space-y-4">
                                    <label className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] px-1">Edad</label>
                                    <input type="number" required className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-2xl text-base font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="--" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} />
                                </div>
                                <div className="w-2/3 space-y-4">
                                    <label className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] px-1">Base</label>
                                    <input type="text" required className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-2xl text-base font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" placeholder="Ej: Ca Mama" value={newPatientDiagnosis} onChange={e => setNewPatientDiagnosis(e.target.value)} />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-6 rounded-[2rem] text-sm font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest">Registrar Paciente</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
