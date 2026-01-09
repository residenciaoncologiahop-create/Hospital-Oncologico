import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
    User, 
    FileText, 
    MessageSquare, 
    Plus, 
    LogOut, 
    Search, 
    ChevronRight,
    Upload,
    Stethoscope,
    Activity,
    Trash2,
    Save,
    Menu,
    X,
    Clock,
    List,
    File,
    Loader2,
    AlertCircle
} from 'lucide-react';

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
    isKey: boolean; // New field to identify important events
}

interface Patient {
    id: string;
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

    try {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
        const modelId = 'gemini-3-flash-preview'; 

        const parts: any[] = [];
        // Updated prompt to be exhaustive and identify key events
        parts.push({ text: "Analiza los siguientes documentos de historia clínica de manera EXHAUSTIVA. Tu objetivo es extraer TODOS los eventos médicos encontrados, sin omitir consultas de rutina, laboratorios o procedimientos menores. Queremos una bitácora completa.\n\nPara cada evento:\n1. Identifica la fecha exacta.\n2. Identifica el profesional o institución.\n3. Categoriza el evento.\n4. Escribe un resumen.\n5. Determina si es un 'Evento Clave' (isKey). Un evento clave es: Nuevo Diagnóstico, Cirugía, Inicio/Fin de Quimioterapia/Radioterapia, Hospitalización, Recurrencia/Metástasis, o cambio drástico de medicación. Las consultas de seguimiento normales o laboratorios de rutina NO son claves." });
        
        if (historyText) parts.push({ text: `Texto de historia clínica:\n${historyText}` });
        
        for (const file of historyFiles) {
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: file.data
                }
            });
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
                            date: { type: Type.STRING, description: "Fecha del evento (DD/MM/YYYY)" },
                            professional: { type: Type.STRING, description: "Nombre del profesional o institución" },
                            category: { type: Type.STRING, description: "Categoría del evento" },
                            note: { type: Type.STRING, description: "Resumen del evento." },
                            isKey: { type: Type.BOOLEAN, description: "True si es un evento crítico/importante, False si es rutina." }
                        }
                    }
                }
            }
        });

        if (response.text) {
            const parsed = JSON.parse(response.text);
            return parsed;
        }
        return [];
    } catch (e) {
        console.error("Extraction error", e);
        return [];
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
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Using pro model for complex medical reasoning
        const modelId = 'gemini-3-pro-preview'; 
        
        const parts: any[] = [];

        // 1. Add Context (History & Guidelines)
        let contextPrompt = "CONTEXTO MÉDICO:\n";
        
        if (timeline && timeline.length > 0) {
            contextPrompt += "\nLÍNEA DE TIEMPO COMPLETA (Historial de Eventos):\n";
            timeline.forEach(t => {
                const marker = t.isKey ? "[CLAVE] " : "";
                contextPrompt += `- ${marker}[${t.date}] (${t.category}) ${t.professional}: ${t.note}\n`;
            });
        }

        if (historyText) {
            contextPrompt += `\nNOTAS ADICIONALES:\n${historyText}\n`;
        }
        
        parts.push({ text: contextPrompt });

        // Add history files
        for (const file of historyFiles) {
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: file.data
                }
            });
            parts.push({ text: `\n(Archivo adjunto: Historia Clínica - ${file.name})\n` });
        }

        // Add guideline files
        parts.push({ text: "\nGUÍAS NCCN / DOCUMENTOS DE REFERENCIA:\n" });
        for (const file of guidelineFiles) {
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: file.data
                }
            });
            parts.push({ text: `\n(Archivo adjunto: Guía NCCN - ${file.name})\n` });
        }

        // 2. Add Chat History (Simplified context window for this demo)
        const recentMessages = messages.slice(-5);
        let conversationHistory = "\nCONVERSACIÓN PREVIA:\n";
        recentMessages.forEach(msg => {
            conversationHistory += `${msg.role === 'user' ? 'Doctor' : 'AI'}: ${msg.text}\n`;
        });
        parts.push({ text: conversationHistory });

        // 3. Add current query
        parts.push({ text: `\nCONSULTA ACTUAL:\n${newMessage}` });

        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: {
                systemInstruction: "Actúa como un oncólogo experto y asistente clínico. Tu objetivo es analizar la historia clínica del paciente y contrastarla con las guías NCCN proporcionadas (o tu conocimiento general si no se adjuntan) para recomendar pasos de tratamiento, seguimiento o diagnóstico. Tienes acceso a una línea de tiempo exhaustiva; utilízala para identificar tendencias sutiles, pero prioriza los eventos marcados como CLAVE para el resumen general. Sé preciso, cita las guías si es posible, y mantén un tono profesional y médico.",
                temperature: 0.2, 
            }
        });

        return response.text || "No se pudo generar una respuesta.";
    } catch (error) {
        console.error("AI Error:", error);
        return "Error al consultar a la IA. Verifique su conexión o intente nuevamente.";
    }
};

// --- Components ---

const FileUploader = ({ label, files, setFiles, accept = "application/pdf,image/*,.pdf,.txt,.png,.jpg,.jpeg" }: { label: string, files: FileData[], setFiles: (f: FileData[]) => void, accept?: string }) => {
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
                            newFiles.push({
                                name: file.name,
                                type: file.type,
                                data: base64
                            });
                        }
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }
            setFiles([...files, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            
            {/* File List */}
            {files.length > 0 && (
                <div className="flex flex-col space-y-2 mb-3">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm border border-blue-200">
                            <div className="flex items-center truncate overflow-hidden">
                                <FileText size={16} className="mr-2 flex-shrink-0" />
                                <span className="truncate">{file.name}</span>
                            </div>
                            <button onClick={() => removeFile(idx)} className="ml-2 text-blue-400 hover:text-blue-600 flex-shrink-0">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Dropzone-like Button */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="bg-white p-2 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="mb-1 text-sm text-gray-600 font-medium">Haga clic para subir archivos</p>
                    <p className="text-xs text-gray-400">PDF, Imágenes o Texto</p>
                </div>
                <input type="file" className="hidden" multiple accept={accept} onChange={handleFileChange} />
            </label>
        </div>
    );
};

const AuthScreen = ({ onLogin }: { onLogin: (name: string) => void }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) onLogin(name);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                <div className="flex justify-center mb-6">
                    <div className="bg-blue-600 p-3 rounded-full">
                        <Stethoscope className="text-white w-8 h-8" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">OncoGuide AI</h1>
                <p className="text-center text-gray-500 mb-8">Gestión inteligente de pacientes y guías NCCN</p>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Doctor</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ej. Dr. Juan Pérez"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Ingresar al Sistema
                    </button>
                </form>
            </div>
        </div>
    );
};

const App = () => {
    const [doctorName, setDoctorName] = useState<string | null>(null);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Form states for new patient
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientAge, setNewPatientAge] = useState('');
    const [newPatientDiagnosis, setNewPatientDiagnosis] = useState('');

    // Active Patient State
    const [historyText, setHistoryText] = useState('');
    const [historyFiles, setHistoryFiles] = useState<FileData[]>([]);
    const [timeline, setTimeline] = useState<ClinicalEvent[]>([]);
    const [guidelineFiles, setGuidelineFiles] = useState<FileData[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessingDocs, setIsProcessingDocs] = useState(false);
    
    // View State for Left Panel
    const [activeTab, setActiveTab] = useState<'docs' | 'timeline'>('docs');

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Load data on login
    useEffect(() => {
        if (doctorName) {
            const savedData = localStorage.getItem(`onco_patients_${doctorName}`);
            if (savedData) {
                try {
                    setPatients(JSON.parse(savedData));
                } catch(e) {
                    console.error("Error loading patients", e);
                }
            }
        }
    }, [doctorName]);

    // Save data on change
    useEffect(() => {
        if (doctorName && patients.length > 0) {
            localStorage.setItem(`onco_patients_${doctorName}`, JSON.stringify(patients));
        }
    }, [patients, doctorName]);

    // Scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    // Load patient specific data into view when selected
    useEffect(() => {
        if (selectedPatientId) {
            // Find in current state to ensure we get latest messages
            const p = patients.find(pat => pat.id === selectedPatientId);
            if (p) {
                setHistoryText(p.historyText || '');
                setHistoryFiles([]); 
                setGuidelineFiles([]);
                
                // Load persisted chat and timeline
                setChatMessages(p.chatHistory || []);
                setTimeline(p.timeline || []); 
                
                // Switch to timeline if it exists, otherwise docs
                setActiveTab(p.timeline && p.timeline.length > 0 ? 'timeline' : 'docs');
            }
        }
    }, [selectedPatientId]); // Only run when ID changes, not when patients updates to avoid loops

    const handleLogin = (name: string) => {
        setDoctorName(name);
    };

    const handleLogout = () => {
        setDoctorName(null);
        setPatients([]);
        setSelectedPatientId(null);
    };

    const handleCreatePatient = (e: React.FormEvent) => {
        e.preventDefault();
        const newPatient: Patient = {
            id: Date.now().toString(),
            name: newPatientName,
            age: parseInt(newPatientAge),
            diagnosis: newPatientDiagnosis,
            historyText: '',
            chatHistory: [],
            timeline: [],
            lastUpdated: Date.now()
        };
        const updatedPatients = [...patients, newPatient];
        setPatients(updatedPatients);
        setShowNewPatientModal(false);
        setSelectedPatientId(newPatient.id);
        // Reset form
        setNewPatientName('');
        setNewPatientAge('');
        setNewPatientDiagnosis('');
    };

    const handleProcessDocuments = async () => {
        if (!historyText && historyFiles.length === 0) {
            alert("Por favor ingrese texto o adjunte archivos primero.");
            return;
        }
        setIsProcessingDocs(true);
        const events = await extractTimelineFromDocs(historyText, historyFiles);
        setTimeline(events);
        setIsProcessingDocs(false);
        
        // Persist Timeline
        if (selectedPatientId) {
            setPatients(prev => prev.map(p => 
                p.id === selectedPatientId 
                ? { ...p, timeline: events, lastUpdated: Date.now() } 
                : p
            ));
        }

        if (events.length > 0) {
            setActiveTab('timeline');
        }
    };

    const handleSaveHistory = () => {
        if (selectedPatientId) {
            const updatedPatients = patients.map(p => 
                p.id === selectedPatientId ? { ...p, historyText, lastUpdated: Date.now() } : p
            );
            setPatients(updatedPatients);
            alert('Historia clínica guardada localmente.');
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;

        const newUserMsg: ChatMessage = {
            role: 'user',
            text: chatInput,
            timestamp: Date.now()
        };

        const updatedMessagesUser = [...chatMessages, newUserMsg];
        setChatMessages(updatedMessagesUser);
        setChatInput('');
        setIsTyping(true);

        // Persist User Message
        setPatients(prev => prev.map(p => 
            p.id === selectedPatientId 
            ? { ...p, chatHistory: updatedMessagesUser, lastUpdated: Date.now() } 
            : p
        ));

        const responseText = await getAIResponse(
            historyText,
            historyFiles,
            timeline,
            guidelineFiles,
            updatedMessagesUser,
            newUserMsg.text
        );

        const newAiMsg: ChatMessage = {
            role: 'model',
            text: responseText,
            timestamp: Date.now()
        };

        const updatedMessagesAI = [...updatedMessagesUser, newAiMsg];
        setChatMessages(updatedMessagesAI);
        setIsTyping(false);

        // Persist AI Message
        setPatients(prev => prev.map(p => 
            p.id === selectedPatientId 
            ? { ...p, chatHistory: updatedMessagesAI, lastUpdated: Date.now() } 
            : p
        ));
    };

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    if (!doctorName) return <AuthScreen onLogin={handleLogin} />;

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-blue-600 font-bold text-lg">
                        <Activity />
                        <span>OncoGuide</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Doctor</p>
                    <p className="font-medium text-gray-800 truncate">{doctorName}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mis Pacientes</h2>
                        <button 
                            onClick={() => setShowNewPatientModal(true)}
                            className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    
                    <div className="space-y-1">
                        {patients.map(patient => (
                            <button
                                key={patient.id}
                                onClick={() => {
                                    setSelectedPatientId(patient.id);
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full text-left p-3 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                                    selectedPatientId === patient.id 
                                    ? 'bg-blue-50 text-blue-700 font-medium' 
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                <div className="truncate">
                                    <div className="truncate">{patient.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{patient.diagnosis}</div>
                                </div>
                                <ChevronRight size={16} className={`text-gray-400 ${selectedPatientId === patient.id ? 'text-blue-500' : 'opacity-0 group-hover:opacity-100'}`} />
                            </button>
                        ))}
                        {patients.length === 0 && (
                            <p className="text-sm text-gray-400 italic text-center py-4">No hay pacientes registrados.</p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200">
                    <button onClick={handleLogout} className="flex items-center space-x-2 text-gray-600 hover:text-red-600 text-sm w-full p-2 rounded hover:bg-red-50 transition-colors">
                        <LogOut size={18} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full w-full">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden mr-4 text-gray-500">
                            <Menu size={24} />
                        </button>
                        {selectedPatient ? (
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">{selectedPatient.name}</h1>
                                <p className="text-xs text-gray-500">{selectedPatient.age} años • {selectedPatient.diagnosis}</p>
                            </div>
                        ) : (
                            <h1 className="text-xl font-bold text-gray-800">Panel de Control</h1>
                        )}
                    </div>
                </header>

                {/* Content Area */}
                {selectedPatient ? (
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        {/* Left Panel: Clinical Data & Guidelines */}
                        <div className="flex-1 lg:flex-[0.5] flex flex-col border-r border-gray-200 bg-white overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-gray-200">
                                <button 
                                    onClick={() => setActiveTab('docs')}
                                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
                                        activeTab === 'docs' 
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <File size={16} />
                                    <span>Documentos</span>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('timeline')}
                                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
                                        activeTab === 'timeline' 
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <Clock size={16} />
                                    <span>Línea de Tiempo</span>
                                    {timeline.length > 0 && (
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                            {timeline.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                                {activeTab === 'docs' ? (
                                    <div className="space-y-6">
                                        {/* Clinical History Section */}
                                        <section>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center space-x-2 text-gray-800">
                                                    <FileText className="text-blue-600" size={20} />
                                                    <h2 className="font-semibold">Historia Clínica</h2>
                                                </div>
                                                <button 
                                                    onClick={handleSaveHistory}
                                                    className="text-xs flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition-colors"
                                                >
                                                    <Save size={14} className="mr-1" /> Guardar Texto
                                                </button>
                                            </div>
                                            
                                            <FileUploader 
                                                label="Cargar Historia Clínica (PDF)" 
                                                files={historyFiles} 
                                                setFiles={setHistoryFiles} 
                                            />

                                            <div className="relative my-4">
                                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                    <div className="w-full border-t border-gray-200"></div>
                                                </div>
                                                <div className="relative flex justify-center">
                                                    <span className="px-2 bg-white text-xs text-gray-400">O ingrese texto manualmente</span>
                                                </div>
                                            </div>

                                            <textarea
                                                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-y bg-gray-50"
                                                placeholder="Escriba o pegue la historia clínica del paciente aquí..."
                                                value={historyText}
                                                onChange={(e) => setHistoryText(e.target.value)}
                                            />
                                            
                                            <button 
                                                onClick={handleProcessDocuments}
                                                disabled={isProcessingDocs}
                                                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-medium shadow-sm flex items-center justify-center transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {isProcessingDocs ? (
                                                    <>
                                                        <Loader2 className="animate-spin mr-2" size={18} />
                                                        Procesando Documentos...
                                                    </>
                                                ) : (
                                                    <>
                                                        <List className="mr-2" size={18} />
                                                        Procesar y Generar Cronología
                                                    </>
                                                )}
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2 text-center">
                                                Al procesar, la IA extraerá automáticamente las fechas y eventos clave de los archivos PDF o texto.
                                            </p>
                                        </section>

                                        <hr className="border-gray-100" />

                                        {/* Guidelines Section */}
                                        <section>
                                            <div className="flex items-center space-x-2 text-gray-800 mb-3">
                                                <Activity className="text-purple-600" size={20} />
                                                <h2 className="font-semibold">Guías NCCN / Protocolos</h2>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-3">
                                                Adjunte las guías NCCN específicas (PDF) o protocolos que desea que la IA utilice como referencia principal para este caso.
                                            </p>
                                            <FileUploader 
                                                label="Subir Guías (PDF)" 
                                                files={guidelineFiles} 
                                                setFiles={setGuidelineFiles}
                                                accept="application/pdf,.pdf"
                                            />
                                        </section>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {timeline.length === 0 ? (
                                            <div className="text-center py-10">
                                                <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                                                    <Clock className="text-gray-400" size={24} />
                                                </div>
                                                <p className="text-gray-500 text-sm">No hay eventos procesados aún.</p>
                                                <button 
                                                    onClick={() => setActiveTab('docs')}
                                                    className="text-blue-600 text-sm mt-2 font-medium hover:underline"
                                                >
                                                    Ir a Documentos para procesar
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative pl-4 border-l-2 border-blue-100 space-y-6 my-2">
                                                {timeline.map((event, idx) => (
                                                    <div key={idx} className="relative">
                                                        {/* Marker */}
                                                        <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors ${
                                                            event.isKey ? 'bg-red-500' : 'bg-blue-300'
                                                        }`}></div>
                                                        
                                                        {/* Card */}
                                                        <div className={`p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${
                                                            event.isKey ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'
                                                        }`}>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                                            event.isKey ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'
                                                                        }`}>
                                                                            {event.date}
                                                                        </span>
                                                                        {event.isKey && (
                                                                            <span className="text-[10px] font-bold text-red-600 flex items-center uppercase tracking-wide">
                                                                                <AlertCircle size={10} className="mr-1"/> Clave
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h3 className={`font-bold mt-1 ${event.isKey ? 'text-red-900' : 'text-gray-800'}`}>
                                                                        {event.category}
                                                                    </h3>
                                                                </div>
                                                                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                                                                    {event.professional}
                                                                </span>
                                                            </div>
                                                            <p className={`text-sm leading-relaxed ${event.isKey ? 'text-gray-800' : 'text-gray-600'}`}>
                                                                {event.note}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel: AI Chat */}
                        <div className="flex-1 lg:flex-[0.5] flex flex-col bg-gray-50 h-full">
                            <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
                                <h2 className="font-semibold text-gray-800 flex items-center">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                    Asistente Virtual Oncológico
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {chatMessages.length === 0 && (
                                    <div className="text-center py-10 opacity-60">
                                        <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <MessageSquare size={24} />
                                        </div>
                                        <h3 className="font-medium text-gray-900">Inicie la consulta</h3>
                                        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                                            Pregunte sobre tratamientos, seguimiento o análisis de la historia clínica en base a las guías adjuntas.
                                        </p>
                                    </div>
                                )}
                                
                                {chatMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div 
                                            className={`max-w-[85%] lg:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                                msg.role === 'user' 
                                                ? 'bg-blue-600 text-white rounded-br-none' 
                                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                            }`}
                                        >
                                            <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                                            <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isTyping && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm">
                                            <div className="flex space-x-1">
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-4 bg-white border-t border-gray-200">
                                <div className="relative">
                                    <textarea
                                        className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-gray-50"
                                        placeholder="Escriba su consulta médica..."
                                        rows={2}
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!chatInput.trim() || isTyping}
                                        className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <MessageSquare size={18} />
                                    </button>
                                </div>
                                <p className="text-center text-[10px] text-gray-400 mt-2">
                                    La IA puede cometer errores. Verifique siempre con criterio médico profesional.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md w-full">
                            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                                <User size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">Bienvenido, {doctorName}</h2>
                            <p className="text-gray-500 mb-6">Seleccione un paciente del menú lateral o cree uno nuevo para comenzar a trabajar.</p>
                            <button 
                                onClick={() => setShowNewPatientModal(true)}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                            >
                                <Plus size={18} className="mr-2" />
                                Nuevo Paciente
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal for New Patient */}
            {showNewPatientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Nuevo Paciente</h3>
                            <button onClick={() => setShowNewPatientModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreatePatient} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newPatientName}
                                        onChange={e => setNewPatientName(e.target.value)}
                                        placeholder="Ej. María García"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newPatientAge}
                                            onChange={e => setNewPatientAge(e.target.value)}
                                            placeholder="Ej. 45"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico (Breve)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newPatientDiagnosis}
                                            onChange={e => setNewPatientDiagnosis(e.target.value)}
                                            placeholder="Ej. Ca. Mama"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowNewPatientModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                                >
                                    Crear Paciente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
