import { db, storage } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ImagingStudy } from '../components/ImagingPanel'; // Asegúrate de importar la interfaz
import { ProcessedChunkRecord } from '../utils/chunkHasher';

export interface Patient {
    id?: string;
    name: string;
    age: number;
    diagnosis: string;
    historyText: string;
    clinicalNotes?: ClinicalNote[];
    timeline: any[];
    chatHistory: any[];
    lastUpdated: number;
    fileUrls?: string[];
    imagingStudies?: ImagingStudy[];
    clinicalContext?: string;
    clinicalContextUpdatedAt?: number;
    processedChunks?: ProcessedChunkRecord[];
}

// Definición de una Evolución Médica
export interface ClinicalNote {
    id: string;
    date: string;     // Fecha de la nota
    text: string;     // Contenido
}

export interface Patient {
    id?: string;
    name: string;
    age: number;
    diagnosis: string;
    historyText: string;
    clinicalNotes?: ClinicalNote[];
    timeline: any[];
    chatHistory: any[];
    lastUpdated: number;
    fileUrls?: string[];
    clinicalContext?: string;
    clinicalContextUpdatedAt?: number;
}

const PATIENTS_COLLECTION = 'patients';

// Escuchar cambios
export const subscribeToPatients = (callback: (patients: Patient[]) => void) => {
    const q = query(collection(db, PATIENTS_COLLECTION), orderBy('lastUpdated', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        callback(patients);
    });
};

export const cleanForFirestore = <T,>(obj: T): T => {
    if (obj === undefined) return null as unknown as T;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => cleanForFirestore(item)).filter(item => item !== undefined) as unknown as T;
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
        if (value !== undefined) {
            clean[key] = cleanForFirestore(value);
        }
    }
    return clean as T;
};

// Crear
export const createPatient = async (patientData: Patient) => {
    return await addDoc(collection(db, PATIENTS_COLLECTION), cleanForFirestore(patientData));
};

// Actualizar
export const updatePatient = async (id: string, data: Partial<Patient>) => {
    const docRef = doc(db, PATIENTS_COLLECTION, id);
    await updateDoc(docRef, cleanForFirestore({ ...data, lastUpdated: Date.now() }));
};

// NUEVO: Borrar paciente
export const deletePatient = async (id: string) => {
    const docRef = doc(db, PATIENTS_COLLECTION, id);
    await deleteDoc(docRef);
};

// Subir archivos
export const uploadFile = async (fileBase64: string, fileName: string, patientId: string) => {
    const storageRef = ref(storage, `patients/${patientId}/${Date.now()}_${fileName}`);
    await uploadString(storageRef, fileBase64, 'base64');
    return await getDownloadURL(storageRef);
};

// Persistir contexto clínico acumulado (sin datos personales y sin duplicación infinita)
export const saveClinicalContext = async (patientId: string, newText: string): Promise<void> => {
    const docRef = doc(db, 'patients', patientId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? (snap.data().clinicalContext || '') : '';
    const trimmedNew = (newText || '').trim();
    const trimmedExisting = (existing || '').trim();

    if (!trimmedNew) return;
    if (trimmedNew === trimmedExisting) return;

    let accumulated = trimmedNew;
    if (trimmedExisting && !trimmedNew.includes(trimmedExisting) && !trimmedExisting.includes(trimmedNew)) {
        const date = new Date().toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        accumulated = `${trimmedExisting}\n\n--- Actualización ${date} ---\n\n${trimmedNew}`;
    }

    await updateDoc(docRef, {
        clinicalContext: accumulated,
        clinicalContextUpdatedAt: Date.now(),
        lastUpdated: Date.now(),
    });
};

// Obtener contexto clínico guardado
export const getClinicalContext = async (patientId: string): Promise<{ text: string; updatedAt: number | null }> => {
    const docRef = doc(db, 'patients', patientId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        return { text: data.clinicalContext || '', updatedAt: data.clinicalContextUpdatedAt || null };
    }
    return { text: '', updatedAt: null };
};

// Borrar contexto clínico
export const clearClinicalContext = async (patientId: string): Promise<void> => {
    const docRef = doc(db, 'patients', patientId);
    await updateDoc(docRef, { clinicalContext: '', clinicalContextUpdatedAt: null, lastUpdated: Date.now() });
};
