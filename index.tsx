import LabPanel, { LabResult } from './components/LabPanel';
import { labMocks } from "./mocks/labMocks";
import ClinicalReportModal from './components/ClinicalReportModal';
import { generateResidentClinicalSummary, generateFollowUpPlan, generateTumorBoardAnalysis } from './utils/residentAI';
import RootOrchestrator from './RootOrchestrator';
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import PendientesPanel from './components/PendientesPanel';
import ImagingPanel, { ImagingStudy } from './components/ImagingPanel';
import { extractImagingFromHistorySecure } from './utils/aiProxy';

// --- FIREBASE IMPORTS ---
import { db } from './firebase'; 
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";

import { 
    User as LucideUser, FileText, MessageSquare, Plus, LogOut, Search, ChevronRight,
    Upload, Stethoscope, Activity, Trash2, Save, Menu, X, Clock,
    List, File, Loader2, AlertCircle, ShieldAlert, Info, Terminal,
    Calendar, PenTool, FileOutput, FileDown, ClipboardCheck, Presentation,
    PanelLeftClose, PanelLeftOpen, FileInput, Image
} from 'lucide-react';

import FormManager from './components/FormManager';
import ClinicalAuditModal from './components/ClinicalAuditModal';

import { User } from 'firebase/auth';
import AuthWrapper, { logout } from './components/AuthWrapper';
import { getChatResponseSecure, extractTimelineSecure, extractLabsSecure, generateClinicalAuditSecure, generateTextSecure } from './utils/aiProxy';

// --- RANGOS ETARIOS ---
const AGE_RANGES = ['0-18', '19-30', '31-40', '41-50', '51-60', '61-70', '71-80', '80+'];

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
            action,
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
    hcNumber: string;
    ageRange: string;
    diagnosis: string;
    historyText: string;
    lastUpdated: number;
    chatHistory?: ChatMessage[];
    timeline?: ClinicalEvent[];
    labResults?: LabResult[];
    imagingStudies?: ImagingStudy[];
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

interface AppProps { user: User; }

const App = ({ user }: AppProps) => {
    const doctorName = user.displayName || user.email || 'Profesional';
    
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [apiKeyExists, setApiKeyExists] = useState<boolean>(true);
    const [imagingStudies, setImagingStudies] = useState<ImagingStudy[]>([]);
    const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xl'>(() => {
        return (localStorage.getItem('onco_fontsize') as any) || 'large';
    });
    const cycleFontSize = () => {
        const next = fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'xl' : 'normal';
        setFontSize(next);
        localStorage.setItem('onco_fontsize', next);
    };
    const fontSizeLabel = { normal: 'A', large: 'A+', xl: 'A++' };

    const [showChat, setShowChat] = useState(false);
    const [activeTab, setActiveTab] = useState<'docs' | 'timeline' | 'forms' | 'labs' | 'imaging'>('docs');

    const [newPatientHC, setNewPatientHC] = useState('');
    const [newPatientAgeRange, setNewPatientAgeRange] = useState('41-50');
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
    const [searchTerm, setSearchTerm] = useState('');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualDoctor, setManualDoctor] = useState(doctorName || '');
    const [manualNote, setManualNote] = useState('');

    const [reportModal, setReportModal] = useState({ isOpen: false, title: '', content: '' as string | null, isLoading: false });
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [auditContent, setAuditContent] = useState<string | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { getOrInitFingerprint(); }, []);

    useEffect(() => {
        if (!user.uid) { setPatients([]); return; }
        const q = query(collection(db, "patients"), where("doctorId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, ...data,
                    hcNumber: data.hcNumber || data.name || 'S/N',
                    ageRange: data.ageRange || (data.age ? `${data.age}` : 'N/D'),
                    diagnosis: data.diagnosis || ''
                } as Patient;
            });
            list.sort((a, b) => b.lastUpdated - a.lastUpdated);
            setPatients(list);
        });
        return () => unsubscribe();
    }, [user.uid]);

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
                setActiveTab('docs');
                setManualDate(new Date().toISOString().split('T')[0]);
                setManualDoctor(doctorName || '');
                setImagingStudies(p.imagingStudies || []);
            }
        }
    }, [selectedPatientId]);

    const getAnonContext = (p: Patient) => `Paciente en rango etario: ${p.ageRange} años.\nDiagnóstico: ${p.diagnosis}.\nHistorial cronológico: ${JSON.stringify(p.timeline || [])}.\nNotas Clínicas: ${p.historyText || ''}`;

    const savePatientDetails = async () => {
        if (selectedPatientId) {
            const patientRef = doc(db, "patients", selectedPatientId);
            await updateDoc(patientRef, { historyText, lastUpdated: Date.now() });
            logAction("UPDATE_PATIENT_DATA", selectedPatientId, doctorName);
        }
    };

    const saveImagingStudies = async (studies: ImagingStudy[]) => {
        if (selectedPatientId) {
            await updateDoc(doc(db, "patients", selectedPatientId), { imagingStudies: studies, lastUpdated: Date.now() });
        }
    };

    const handleImagingStudiesChange = (studies: ImagingStudy[]) => {
        setImagingStudies(studies);
        saveImagingStudies(studies);
    };

    const handleProcessDocuments = async () => {
        if (!historyText && historyFiles.length === 0) return;
        setIsProcessingDocs(true);
        setLastError(null);
        try {
            const rawEvents = await extractTimelineSecure(historyText, historyFiles);
            const events = rawEvents.map((e: any) => ({
                date: e.date || e.fecha || "S/F",
                professional: e.professional || e.profesional || e.medico || "N/A",
                category: e.category || e.categoria || e.tipo || "General",
                note: e.note || e.nota || e.descripcion || "Evento",
                isKey: !!e.isKey || !!e.clave || !!e.importante
            }));
            const combinedTimeline = sortTimeline([...(timeline || []), ...events]);
            setTimeline(combinedTimeline);

            const extractedLabs = await extractLabsSecure(historyText, historyFiles);
            const currentLabs = patients.find(p => p.id === selectedPatientId)?.labResults || [];
            const combinedLabs = [...currentLabs, ...extractedLabs];

            if (selectedPatientId) {
                const patientRef = doc(db, "patients", selectedPatientId);
                await updateDoc(patientRef, { timeline: combinedTimeline, labResults: combinedLabs, historyText, lastUpdated: Date.now() });
                logAction("PROCESS_DOCS_AND_LABS", selectedPatientId, doctorName);

                const extractedImaging = await extractImagingFromHistorySecure(historyText, historyFiles);
                if (extractedImaging.length > 0) {
                    const currentImaging = patients.find(p => p.id === selectedPatientId)?.imagingStudies || [];
                    const newStudies: ImagingStudy[] = extractedImaging.map((d: any) => ({
                        id: `img-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                        type: d.type || 'TC',
                        date: d.date || 'S/F',
                        bodyRegion: d.bodyRegion || 'No especificado',
                        treatment: d.treatment || null,
                        targetLesions: d.targetLesions || [],
                        nonTargetLesions: d.nonTargetLesions || [],
                        newLesions: !!d.newLesions,
                        extractedAt: Date.now(),
                    }));
                    const combinedImaging = [...currentImaging, ...newStudies];
                    setImagingStudies(combinedImaging);
                    await updateDoc(patientRef, { imagingStudies: combinedImaging, lastUpdated: Date.now() });
                }
            }
            alert(`Procesado: ${events.length} eventos y ${extractedLabs.length} laboratorios.`);
        } catch (e: any) {
            setLastError(e.message);
        } finally {
            setIsProcessingDocs(false);
        }
    };

    const handleAddManualLab = async (newLab: LabResult) => {
        if (!selectedPatientId) return;
        const labWithAuthor = { ...newLab, professional: doctorName || 'Manual' };
        const currentLabs = patients.find(p => p.id === selectedPatientId)?.labResults || [];
        await updateDoc(doc(db, "patients", selectedPatientId), { labResults: [...currentLabs, labWithAuthor], lastUpdated: Date.now() });
    };

    const handleAddManualEvolution = async () => {
        if (!manualNote.trim() || !selectedPatientId) return;
        const [y, m, d] = manualDate.split('-');
        const newEvent: ClinicalEvent = {
            date: `${d}/${m}/${y}`,
            professional: manualDoctor,
            category: "Evolución Manual",
            note: manualNote,
            isKey: false
        };
        const updatedTimeline = sortTimeline([...timeline, newEvent]);
        setTimeline(updatedTimeline);
        setManualNote('');
        await updateDoc(doc(db, "patients", selectedPatientId), { timeline: updatedTimeline, lastUpdated: Date.now() });
        logAction("ADD_MANUAL_EVOLUTION", selectedPatientId, doctorName);
    };

    const handleDeleteEvent = async (ev: ClinicalEvent) => {
        if (!selectedPatientId || !timeline) return;
        if (confirm("¿Eliminar este evento?")) {
            const updatedTimeline = timeline.filter(e => e !== ev);
            setTimeline(updatedTimeline);
            await updateDoc(doc(db, "patients", selectedPatientId), { timeline: updatedTimeline, lastUpdated: Date.now() });
            logAction("DELETE_TIMELINE_EVENT", selectedPatientId, doctorName);
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedPatientId) return;
        const p = patients.find(pat => pat.id === selectedPatientId);
        if (!p) return;
        setLastError(null);
        const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updatedUser = [...chatMessages, newUserMsg];
        setChatMessages(updatedUser); setChatInput(''); setIsTyping(true);
        try {
            const responseText = await getChatResponseSecure(updatedUser, newUserMsg.text, getAnonContext(p), [...historyFiles, ...guidelineFiles]);
            const newAiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
            const updatedAI = [...updatedUser, newAiMsg];
            setChatMessages(updatedAI);
            await updateDoc(doc(db, "patients", selectedPatientId), { chatHistory: updatedAI, lastUpdated: Date.now() });
            logAction("CHAT_MESSAGE", selectedPatientId, doctorName);
        } catch (e: any) {
            setLastError(e.message);
        } finally {
            setIsTyping(false);
        }
    };

    const handleCreatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPatientHC.trim()) return;
        try {
            const docRef = await addDoc(collection(db, "patients"), {
                doctorId: user.uid,
                hcNumber: newPatientHC.trim(),
                ageRange: newPatientAgeRange,
                diagnosis: newPatientDiagnosis,
                historyText: '',
                lastUpdated: Date.now(),
                chatHistory: [], timeline: [], labResults: []
            });
            setSelectedPatientId(docRef.id);
            setShowNewPatientModal(false);
            setNewPatientHC(''); setNewPatientAgeRange('41-50'); setNewPatientDiagnosis('');
            logAction("CREATE_PATIENT", docRef.id, doctorName);
        } catch (error: any) {
            setLastError("Error creando caso: " + error.message);
        }
    };

    const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("¿Eliminar este caso permanentemente?")) {
            try {
                await deleteDoc(doc(db, "patients", id));
                if (selectedPatientId === id) setSelectedPatientId(null);
                logAction("DELETE_PATIENT", id, doctorName);
            } catch (error: any) { setLastError("Error al eliminar: " + error.message); }
        }
    };

    const handleRunClinicalAudit = async () => {
        if (!selectedPatientId || (!historyText && historyFiles.length === 0)) {
            alert("No hay documentación clínica para auditar.");
            return;
        }
        setShowAuditModal(true); setIsAuditing(true); setAuditContent(null);
        try {
            const result = await generateClinicalAuditSecure(historyText, historyFiles);
            setAuditContent(result);
            logAction("RUN_CLINICAL_AUDIT", selectedPatientId, doctorName);
        } catch {
            setAuditContent("<div class='text-red-600 text-xs'>Error en la auditoría clínica.</div>");
        } finally {
            setIsAuditing(false);
        }
    };

    const runReportGeneration = async (title: string, generatorFn: (text: string, files: FileData[]) => Promise<string>) => {
        if (!selectedPatientId) return;
        const p = patients.find(p => p.id === selectedPatientId);
        if (!p || (!p.historyText && historyFiles.length === 0)) { alert("Sin documentación para procesar."); return; }
        setReportModal({ isOpen: true, title, content: null, isLoading: true });
        try {
            const result = await generatorFn(p.historyText, historyFiles);
            setReportModal(prev => ({ ...prev, content: result, isLoading: false }));
        } catch {
            setReportModal(prev => ({ ...prev, content: `<div class="p-4 text-red-600 bg-red-50 rounded-lg">Error al generar el informe.</div>`, isLoading: false }));
        }
    };

    const filteredPatients = patients.filter(p =>
        p.hcNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderMarkdown = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (/^\s*\*\s+/.test(line)) {
                const content = line.replace(/^\s*\*\s+/, '');
                return <div key={i} className="flex gap-2 mb-1"><span className="text-blue-300 mt-0.5 flex-shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}/></div>;
            }
            if (/^\d+\.\s+/.test(line)) {
                const num = line.match(/^(\d+)\./)?.[1];
                const content = line.replace(/^\d+\.\s+/, '');
                return <div key={i} className="flex gap-2 mb-1"><span className="text-blue-300 flex-shrink-0 font-black">{num}.</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}/></div>;
            }
            if (!line.trim()) return <div key={i} className="h-2"/>;
            return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}/>;
        });
    };

    const selP = patients.find(p => p.id === selectedPatientId);
    const isLabTab = activeTab === 'labs' || activeTab === 'imaging';

    return (
        <>
            <style>{`
                .fs-large { font-size: 112% !important; }
                .fs-large .text-\\[10px\\] { font-size: 12px !important; }
                .fs-large .text-\\[9px\\] { font-size: 11px !important; }
                .fs-large .text-xs { font-size: 13px !important; }
                .fs-large .text-sm { font-size: 15px !important; }
                .fs-xl { font-size: 125% !important; }
                .fs-xl .text-\\[10px\\] { font-size: 13px !important; }
                .fs-xl .text-\\[9px\\] { font-size: 12px !important; }
                .fs-xl .text-xs { font-size: 14px !important; }
                .fs-xl .text-sm { font-size: 16px !important; }
            `}</style>

            <div className={`flex h-screen bg-white text-gray-800 font-medium text-xs overflow-hidden ${fontSize === 'large' ? 'fs-large' : fontSize === 'xl' ? 'fs-xl' : ''}`}>

                {/* ── SIDEBAR ─────────────────────────────────── */}
                <aside className={`fixed inset-y-0 left-0 z-40 bg-gray-50 border-r lg:static flex flex-col transition-all duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarOpen ? 'w-72 lg:translate-x-0' : 'w-0 lg:translate-x-0 overflow-hidden'}`}>
                    <div className="px-5 py-4 border-b flex items-center justify-between bg-white">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
                                <Activity size={16} className="text-white"/>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="font-black text-gray-800 text-sm tracking-tight">OncoGuide</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Soporte Clínico</span>
                            </div>
                        </div>
                        <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-gray-300 hover:text-gray-500"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div>
                            <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-3">
                                <span>Casos Clínicos</span>
                                <button onClick={() => setShowNewPatientModal(true)} className="text-blue-600 bg-blue-50 p-1 rounded-lg"><Plus size={14}/></button>
                            </div>
                            <div className="px-2 mb-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12}/>
                                    <input
                                        type="text"
                                        placeholder="Buscar por N° HC o diagnóstico..."
                                        className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-blue-300 transition-all"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {filteredPatients.length === 0 && <p className="text-center text-[10px] text-gray-400 py-4">Sin resultados.</p>}
                                {filteredPatients.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => { setSelectedPatientId(p.id); setMobileMenuOpen(false); }}
                                        className={`group w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${selectedPatientId === p.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}
                                    >
                                        <div className="flex flex-col pr-2 flex-1 min-w-0">
                                            <span className="font-bold text-xs">HC-{p.hcNumber}</span>
                                            <span className={`text-[10px] font-semibold truncate ${selectedPatientId === p.id ? 'text-blue-100 opacity-80' : 'text-gray-400'}`}>{p.diagnosis}</span>
                                        </div>
                                        <button
                                            onClick={e => handleDeletePatient(p.id, e)}
                                            className={`p-1.5 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors ${selectedPatientId === p.id ? 'text-blue-200 hover:text-white hover:bg-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                                        >
                                            <Trash2 size={12}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <PendientesPanel doctorId={user.uid}/>

                    <div className="p-5 border-t bg-white flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 truncate">
                                <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md">{doctorName[0].toUpperCase()}</div>
                                <div className="flex flex-col truncate">
                                    <span className="text-[9px] font-black text-gray-400 uppercase leading-none mb-0.5">Profesional</span>
                                    <span className="text-xs font-bold truncate leading-none">Dr. {doctorName}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={cycleFontSize} className="text-[10px] font-black text-gray-400 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors tracking-widest" title="Cambiar tamaño de letra">
                                    {fontSizeLabel[fontSize]}
                                </button>
                                <button onClick={logout} className="text-gray-200 hover:text-red-500 transition-colors"><LogOut size={16}/></button>
                            </div>
                        </div>
                        <p className="text-[8px] text-gray-300 text-center font-medium">Herramienta de apoyo para discusión clínica y docencia. No sustituye la historia clínica ni el juicio médico.</p>
                    </div>
                </aside>

                {/* ── MAIN ────────────────────────────────────── */}
                <main className="flex-1 flex flex-col h-full overflow-hidden">

                    {/* Header */}
                    <header className="bg-white border-b h-14 flex items-center px-5 justify-between z-20 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400"><Menu size={22}/></button>
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="hidden lg:flex items-center justify-center w-7 h-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
                            >
                                {sidebarOpen ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
                            </button>
                            {selP ? (
                                <div className="flex items-center gap-3 pl-2 border-l border-gray-100 ml-1">
                                    <div className="flex flex-col">
                                        <h1 className="font-black text-gray-800 text-base tracking-tight leading-none truncate max-w-xs">HC-{selP.hcNumber}</h1>
                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">{selP.diagnosis} — {selP.ageRange} años</span>
                                    </div>
                                </div>
                            ) : (
                                <h1 className="font-black text-gray-700 text-sm tracking-tight">Seleccioná un caso</h1>
                            )}
                        </div>
                        <div className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase transition-all ${apiKeyExists ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                            {apiKeyExists ? <div className="w-1.5 h-1.5 bg-green-500 rounded-full"/> : <ShieldAlert size={11}/>}
                            <span>{apiKeyExists ? 'Seguro' : 'Error API'}</span>
                        </div>
                    </header>

                    {selP ? (
                        <>
                            {/* Panel principal ancho completo */}
                            <div className="flex-1 flex flex-col bg-white overflow-hidden">

                                {/* Tabs */}
                                <div className="flex border-b bg-gray-50/50 flex-shrink-0">
                                    {([
                                        { id: 'docs',     icon: <FileText size={13}/>,      label: 'Docs'     },
                                        { id: 'timeline', icon: <Clock size={13}/>,          label: 'Eventos'  },
                                        { id: 'forms',    icon: <ClipboardCheck size={13}/>, label: 'Trámites' },
                                        { id: 'labs',     icon: <Activity size={13}/>,       label: 'Lab'      },
                                        { id: 'imaging',  icon: <Image size={13}/>,          label: 'Imágenes' },
                                    ] as const).map((tab, i, arr) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all text-[9px] font-black uppercase tracking-widest
                                                ${i < arr.length - 1 ? 'border-r border-gray-100' : ''}
                                                ${activeTab === tab.id
                                                    ? 'text-blue-600 bg-white shadow-sm border-b-2 border-b-blue-600'
                                                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/60 border-b-2 border-b-transparent'
                                                }`}
                                        >
                                            {tab.icon}
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Contenido de tabs */}
                                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">

                                    {/* DOCS */}
                                    {activeTab === 'docs' && (
                                        <>
                                            <section className="space-y-4">
                                                <div className="border-b border-gray-50 pb-2">
                                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Documentación del Caso</h3>
                                                </div>
                                                <FileUploader label="Archivos Digitales" files={historyFiles} setFiles={setHistoryFiles}/>
                                                <div className="flex items-center space-x-2 text-gray-400 mb-2">
                                                    <PenTool size={13}/>
                                                    <h3 className="text-xs font-black uppercase tracking-widest">Registro de evolución clínica (resumen)</h3>
                                                </div>
                                                <div className="flex space-x-2 mb-2">
                                                    <input type="date" className="bg-white px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 focus:border-blue-200 outline-none" value={manualDate} onChange={e => setManualDate(e.target.value)}/>
                                                    <input type="text" className="flex-1 bg-white px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 focus:border-blue-200 outline-none" placeholder="Médico responsable" value={manualDoctor} onChange={e => setManualDoctor(e.target.value)}/>
                                                </div>
                                                <textarea
                                                    className="w-full h-32 p-4 border-2 border-gray-100 rounded-2xl text-xs font-medium bg-gray-50 focus:bg-white focus:border-blue-200 transition-all outline-none resize-none shadow-inner"
                                                    placeholder="Registrar información relevante para la comprensión del caso (no constituye evolución en historia clínica)."
                                                    value={historyText}
                                                    onChange={e => setHistoryText(e.target.value)}
                                                    onBlur={savePatientDetails}
                                                />
                                                <button
                                                    onClick={handleProcessDocuments}
                                                    disabled={isProcessingDocs}
                                                    className="w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black tracking-widest shadow-xl shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center"
                                                >
                                                    {isProcessingDocs ? <><Loader2 className="animate-spin mr-2" size={16}/>Analizando...</> : "Procesar historia"}
                                                </button>
                                            </section>

                                            <section className="space-y-4 pt-4 border-t border-gray-100">
                                                <div className="grid grid-cols-4 gap-2">
                                                    <button onClick={handleRunClinicalAudit} disabled={isAuditing} className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm">
                                                        <ClipboardCheck size={16} className="text-blue-600 mb-1"/> Control Calidad
                                                    </button>
                                                    <button onClick={() => runReportGeneration('Resumen Clínico Profesional', generateResidentClinicalSummary)} className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm">
                                                        <FileText size={16} className="text-indigo-600 mb-1"/> Resumen HC
                                                    </button>
                                                    <button onClick={() => runReportGeneration('Plan de Seguimiento', generateFollowUpPlan)} className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm">
                                                        <Calendar size={16} className="text-emerald-600 mb-1"/> Seguimiento
                                                    </button>
                                                    <button onClick={() => runReportGeneration('Presentación Comité de Tumores', generateTumorBoardAnalysis)} className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all shadow-sm">
                                                        <Presentation size={16} className="text-amber-600 mb-1"/> Comité
                                                    </button>
                                                </div>
                                                <FileUploader label="Guías NCCN / Protocolos" files={guidelineFiles} setFiles={setGuidelineFiles} accept=".pdf"/>
                                            </section>
                                        </>
                                    )}

                                    {/* TIMELINE */}
                                    {activeTab === 'timeline' && (() => {
                                        const CATEGORY_STYLES: Record<string, { dot: string; card: string; badge: string; border: string }> = {
                                            'Quimio':     { dot: 'bg-violet-500', card: 'bg-violet-50/40 border-violet-100', badge: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
                                            'Cirugía':    { dot: 'bg-orange-500', card: 'bg-orange-50/40 border-orange-100', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
                                            'Imagen':     { dot: 'bg-cyan-500',   card: 'bg-cyan-50/40 border-cyan-100',     badge: 'bg-cyan-100 text-cyan-700',     border: 'border-cyan-200' },
                                            'Lab':        { dot: 'bg-green-500',  card: 'bg-green-50/40 border-green-100',   badge: 'bg-green-100 text-green-700',   border: 'border-green-200' },
                                            'Radio':      { dot: 'bg-yellow-500', card: 'bg-yellow-50/40 border-yellow-100', badge: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' },
                                            'Consulta':   { dot: 'bg-blue-400',   card: 'bg-blue-50/30 border-blue-100',     badge: 'bg-blue-100 text-blue-600',     border: 'border-blue-200' },
                                            'Evolución Manual': { dot: 'bg-gray-400', card: 'bg-gray-50 border-gray-100', badge: 'bg-gray-100 text-gray-600', border: 'border-gray-200' },
                                        };
                                        const KEY_STYLE    = { dot: 'bg-red-500',  card: 'bg-red-50/50 border-red-100',  badge: 'bg-red-500 text-white',       border: 'border-red-200'  };
                                        const DEFAULT_STYLE = { dot: 'bg-blue-400', card: 'bg-white border-gray-100',    badge: 'bg-blue-50 text-blue-600',    border: 'border-gray-100' };
                                        const getStyle = (ev: ClinicalEvent) => {
                                            if (ev.isKey) return KEY_STYLE;
                                            const cat = Object.keys(CATEGORY_STYLES).find(k => ev.category?.toLowerCase().includes(k.toLowerCase()));
                                            return cat ? CATEGORY_STYLES[cat] : DEFAULT_STYLE;
                                        };
                                        const sorted = [...timeline].sort((a, b) => parseDate(a.date) - parseDate(b.date));
                                        return (
                                            <div className="space-y-3 pt-2">
                                                {sorted.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 text-gray-200">
                                                        <Clock size={40} className="mb-3 opacity-10"/>
                                                        <p className="text-xs font-black uppercase tracking-widest">Sin eventos</p>
                                                    </div>
                                                ) : sorted.map((ev, i) => {
                                                    const s = getStyle(ev);
                                                    return (
                                                        <div key={i} className="relative pl-9 pb-6 group">
                                                            {i < sorted.length - 1 && <div className="absolute left-[13px] top-6 bottom-0 w-px bg-gray-100"/>}
                                                            <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-md flex items-center justify-center transition-transform group-hover:scale-110 ${s.dot}`}>
                                                                {ev.isKey ? <AlertCircle size={10} className="text-white"/> : <Info size={10} className="text-white"/>}
                                                            </div>
                                                            <div className={`rounded-2xl border p-4 transition-all hover:shadow-md ${s.card}`}>
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase ${s.badge}`}>{ev.date}</span>
                                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest text-gray-600 bg-white ${s.border}`}>{ev.category}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <span className="text-[10px] text-gray-400 font-bold truncate max-w-[120px]">{ev.professional}</span>
                                                                        <button onClick={() => handleDeleteEvent(ev)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={11}/></button>
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs font-medium text-gray-600 leading-relaxed">{ev.note}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* FORMS */}
                                    {activeTab === 'forms' && (
                                        <div className="h-full overflow-y-auto">
                                            <FormManager patient={selP} historyText={historyText} files={historyFiles}/>
                                        </div>
                                    )}

                                    {/* LABS */}
                                    {activeTab === 'labs' && (
                                        <div className="h-full p-6 overflow-y-auto">
                                            <LabPanel results={selP?.labResults || []} onAddManual={handleAddManualLab} isResident={false}/>
                                        </div>
                                    )}

                                    {/* IMAGING */}
                                    {activeTab === 'imaging' && (
                                        <div className="h-full p-6 overflow-y-auto">
                                            <ImagingPanel studies={imagingStudies} onStudiesChange={handleImagingStudiesChange}/>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Botón flotante Asistente */}
                            <button
                                onClick={() => setShowChat(true)}
                                className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-blue-600 text-white pl-4 pr-5 py-3 rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                            >
                                <MessageSquare size={16}/>
                                <span className="text-xs font-black uppercase tracking-widest">Asistente</span>
                                {chatMessages.length > 0 && (
                                    <span className="w-5 h-5 bg-white text-blue-600 rounded-full text-[9px] font-black flex items-center justify-center">
                                        {chatMessages.length}
                                    </span>
                                )}
                            </button>

                            {/* Chat Drawer */}
                            {showChat && (
                                <div className="fixed inset-0 z-50 flex justify-end">
                                    <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowChat(false)}/>
                                    <div className="relative w-full max-w-lg bg-gray-50 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
                                        <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-md shadow-blue-100">
                                                    <Activity size={13} className="text-white"/>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-widest">Asistente Clínico</p>
                                                    <p className="text-[9px] text-gray-400 font-medium">HC-{selP.hcNumber} · {selP.diagnosis}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowChat(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                                                <X size={16}/>
                                            </button>
                                        </div>

                                        {lastError && (
                                            <div className="mx-4 mt-3 bg-red-600 text-white p-3 rounded-2xl flex items-start gap-2 text-xs">
                                                <Terminal size={14} className="flex-shrink-0 mt-0.5"/>
                                                <span className="font-bold">{lastError}</span>
                                                <button onClick={() => setLastError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={14}/></button>
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                                            {chatMessages.length === 0 && (
                                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 select-none">
                                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                                        <MessageSquare size={36} className="text-blue-200 mx-auto"/>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs font-black uppercase tracking-widest text-gray-300">Asistente de Discusión Clínica</p>
                                                        <p className="text-[10px] font-medium text-gray-300 max-w-[180px] mx-auto leading-relaxed">Las respuestas son orientativas. Toda decisión clínica corresponde al equipo tratante.</p>
                                                    </div>
                                                </div>
                                            )}
                                            {chatMessages.map((m, i) => (
                                                <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    {m.role === 'model' && (
                                                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-100 mb-1">
                                                            <Activity size={13} className="text-white"/>
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[82%] rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm px-5 py-3.5' : 'bg-white border border-gray-100 rounded-bl-sm px-5 py-4'}`}>
                                                        <div className={`leading-relaxed space-y-1 ${m.role === 'user' ? 'text-sm font-semibold' : 'text-[13px] font-normal text-gray-700'}`}>
                                                            {m.role === 'model' ? renderMarkdown(m.text) : m.text}
                                                        </div>
                                                        <div className={`text-[9px] mt-2 font-black uppercase tracking-widest ${m.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-300'}`}>
                                                            {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </div>
                                                    </div>
                                                    {m.role === 'user' && (
                                                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-gray-600 to-gray-400 flex items-center justify-center flex-shrink-0 shadow-sm mb-1">
                                                            <span className="text-white font-black text-[10px]">{doctorName[0].toUpperCase()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {isTyping && (
                                                <div className="flex items-end gap-2">
                                                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-100">
                                                        <Activity size={13} className="text-white"/>
                                                    </div>
                                                    <div className="bg-white px-5 py-3.5 rounded-2xl rounded-bl-sm border border-gray-100 shadow-sm flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={chatEndRef}/>
                                        </div>

                                        <div className="p-4 bg-white/90 backdrop-blur-md border-t">
                                            <div className="flex items-center bg-gray-50 rounded-2xl border-2 border-transparent focus-within:border-blue-100 focus-within:bg-white transition-all p-2.5 pl-4 gap-2">
                                                <textarea
                                                    className="flex-1 bg-transparent text-sm font-medium outline-none resize-none max-h-32 scrollbar-hide py-1"
                                                    placeholder="Plantear dudas / aspectos a discutir..."
                                                    rows={1}
                                                    value={chatInput}
                                                    onChange={e => setChatInput(e.target.value)}
                                                    onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                                />
                                                <button
                                                    onClick={handleSendMessage}
                                                    disabled={!chatInput.trim() || isTyping}
                                                    className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-100 disabled:opacity-50 active:scale-90 transition-all flex-shrink-0"
                                                >
                                                    <MessageSquare size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Pantalla vacía */
                        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 relative overflow-hidden">
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60"/>
                                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-40"/>
                            </div>
                            <div className="relative z-10 flex flex-col items-center text-center max-w-xs px-8 space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl border border-gray-100 flex items-center justify-center">
                                        <Activity size={36} className="text-blue-500"/>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                        <Plus size={14} className="text-white"/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-lg font-black text-gray-800 tracking-tight">Ningún caso seleccionado</h2>
                                    <p className="text-xs text-gray-400 font-medium leading-relaxed">Seleccioná un caso existente del panel izquierdo o creá uno nuevo para comenzar.</p>
                                </div>
                                <button
                                    onClick={() => setShowNewPatientModal(true)}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 uppercase"
                                >
                                    <Plus size={14}/>
                                    Crear caso clínico
                                </button>
                                <div className="flex items-center gap-4 pt-2">
                                    <div className="flex flex-col items-center">
                                        <span className="text-lg font-black text-gray-800">{patients.length}</span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Casos</span>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100"/>
                                    <div className="flex flex-col items-center">
                                        <span className="text-lg font-black text-gray-800">{new Date().toLocaleDateString('es-AR', {day:'2-digit', month:'short'})}</span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Hoy</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* ── MODAL CREAR CASO ────────────────────────── */}
                {showNewPatientModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-6">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform animate-in fade-in zoom-in duration-300">
                            <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Registro de Caso Clínico</h3>
                                <button onClick={() => setShowNewPatientModal(false)} className="text-gray-300 hover:text-gray-600"><X size={24}/></button>
                            </div>
                            <form onSubmit={handleCreatePatient} className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Número de Historia Clínica</label>
                                    <input
                                        type="text" required autoFocus
                                        className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all"
                                        placeholder="Ej: 9014766"
                                        value={newPatientHC}
                                        onChange={e => setNewPatientHC(e.target.value)}
                                    />
                                </div>
                                <div className="flex space-x-4">
                                    <div className="w-1/2 space-y-2">
                                        <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Rango Etario</label>
                                        <select
                                            className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all"
                                            value={newPatientAgeRange}
                                            onChange={e => setNewPatientAgeRange(e.target.value)}
                                        >
                                            {AGE_RANGES.map(r => <option key={r} value={r}>{r} años</option>)}
                                        </select>
                                    </div>
                                    <div className="w-1/2 space-y-2">
                                        <label className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Diagnóstico Base</label>
                                        <input
                                            type="text" required
                                            className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all"
                                            placeholder="Ej: Ca Mama"
                                            value={newPatientDiagnosis}
                                            onChange={e => setNewPatientDiagnosis(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-300 text-center leading-relaxed">Los datos se almacenan sin nombre ni DNI del paciente, en cumplimiento con la Ley 25.326.</p>
                                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest">Crear caso clínico</button>
                            </form>
                        </div>
                    </div>
                )}

                <ClinicalAuditModal isOpen={showAuditModal} onClose={() => setShowAuditModal(false)} content={auditContent} isLoading={isAuditing} mode="professional"/>
                <ClinicalReportModal isOpen={reportModal.isOpen} onClose={() => setReportModal({ ...reportModal, isOpen: false })} title={reportModal.title} content={reportModal.content} isLoading={reportModal.isLoading}/>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(
    <AuthWrapper>
        {(user) => <RootOrchestrator DoctorApp={() => <App user={user}/>}/>}
    </AuthWrapper>
);
