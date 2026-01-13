import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } from "firebase/firestore";
// ------------------------
import { 
    User, FileText, MessageSquare, Plus, LogOut, Search, ChevronRight,
    Upload, Stethoscope, Activity, Trash2, Save, Menu, X, Clock,
    List, File, Loader2, AlertCircle, ShieldAlert, Info, Terminal
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
    doctorId: string; // NUEVO: Para identificar al médico
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

// --- API Helpers ---

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
        parts.push({ text: "Analiza los siguientes documentos médicos de forma EXHAUSTIVA. No resumas; extrae CADA evento, consulta, resultado de laboratorio o estudio de imagen mencionado. \n\nPara cada evento determina:\n1. Fecha (DD/MM/YYYY).\n2. Profesional/Institución.\n3. Categoría (Consulta, Laboratorio, Imagen, Cirugía, Quimio, Radio, etc).\n4. Resumen detallado de hallazgos.\n5. 'isKey' (true/false): Marca como true solo eventos CRÍTICOS (diagnósticos, cirugías, cambios de tratamiento, progresión de enfermedad). Eventos de rutina deben ser false." });
        
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

const getAIResponse = async (
    historyText: string,
    historyFiles: FileData[],
    timeline: ClinicalEvent[],
    guidelineFiles: FileData[],
    messages: ChatMessage[],
    newMessage: string
) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return "ERROR: API_KEY no configurada. Verifica las variables de entorno en Vercel.";

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
                systemInstruction: "Eres un oncólogo experto y asistente de guías clínicas. Analiza el historial completo del paciente y responde basándote en la evidencia y las guías NCCN. Si no hay guías adjuntas, usa tu conocimiento médico actualizado. Sé técnico, preciso y profesional.",
                temperature: 0.1,
            }
        });

        return response.text || "Sin respuesta del modelo.";
    } catch (error: any) {
        return `ERROR DE IA: ${error.message || "Error desconocido en la comunicación con Gemini"}.`;
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
    const [apiKeyExists, setApiKeyExists] = useState<boolean>(!!import.meta.env.VITE_API_KEY);;

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
    
    const [activeTab, setActiveTab] = useState<'docs' | 'timeline'>('docs');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setApiKeyExists(!!import.meta.env.VITE_API_KEY);
    }, []);

    // --- FIREBASE: Cargar Pacientes (Filtrados por Médico) ---
    useEffect(() => {
        if (!doctorName) {
            setPatients([]);
            return;
        }

        // Filtramos por doctorId. 
        // NOTA: Para evitar errores de índices compuestos en Firebase si usas 'where' + 'orderBy',
        // hacemos el filtrado en query y ordenamos en cliente.
        const q = query(collection(db, "patients"), where("doctorId", "==", doctorName));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firebasePatients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Patient));
            
            // Ordenamiento manual en cliente por última actualización
            firebasePatients.sort((a, b) => b.lastUpdated - a.lastUpdated);
            
            setPatients(firebasePatients);
        });
        
        return () => unsubscribe();
    }, [doctorName]); // Se ejecuta cuando cambia el doctor

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
                setChatMessages(p.chatHistory || []);
                setTimeline(p.timeline || []); 
                setHistoryFiles([]); setGuidelineFiles([]);
                setLastError(null);
                setActiveTab(p.timeline && p.timeline.length > 0 ? 'timeline' : 'docs');
            }
        }
    }, [selectedPatientId, patients]);

    const handleProcessDocuments = async () => {
        if (!historyText && historyFiles.length === 0) return;
        setIsProcessingDocs(true);
        setLastError(null);
        try {
            const events = await extractTimelineFromDocs(historyText, historyFiles);
            setTimeline(events);
            
            if (selectedPatientId) {
                const patientRef = doc(db, "patients", selectedPatientId);
                await updateDoc(patientRef, {
                    timeline: events,
                    historyText: historyText,
                    lastUpdated: Date.now()
                });
            }
            setActiveTab('timeline');
        } catch (e: any) {
            setLastError(e.message || "Error desconocido al procesar documentos.");
        } finally {
            setIsProcessingDocs(false);
        }
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
        
        if (responseText.startsWith("ERROR")) {
            setLastError(responseText);
        }

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
            doctorId: doctorName, // Guardamos el ID del médico
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
            setLastError("Error creando paciente en la nube: " + error.message);
        }
    };

    // Función para borrar paciente
    const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Evitar seleccionar el paciente al borrar
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
                                    <button 
                                        onClick={(e) => handleDeletePatient(p.id, e)} 
                                        className={`p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors ${selectedPatientId === p.id ? 'text-blue-200 hover:text-white hover:bg-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t bg-white flex i
