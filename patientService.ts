import { db, storage } from './firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export interface Patient {
    id?: string;
    name: string;
    age: number;
    diagnosis: string;
    historyText: string;
    timeline: any[];
    chatHistory: any[];
    lastUpdated: number;
    fileUrls?: string[]; 
}

const PATIENTS_COLLECTION = 'patients';

// Escuchar cambios en tiempo real
export const subscribeToPatients = (callback: (patients: Patient[]) => void) => {
    const q = query(collection(db, PATIENTS_COLLECTION), orderBy('lastUpdated', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        callback(patients);
    });
};

// Crear paciente
export const createPatient = async (patientData: Patient) => {
    return await addDoc(collection(db, PATIENTS_COLLECTION), patientData);
};

// Actualizar paciente
export const updatePatient = async (id: string, data: Partial<Patient>) => {
    const docRef = doc(db, PATIENTS_COLLECTION, id);
    await updateDoc(docRef, { ...data, lastUpdated: Date.now() });
};

// Subir archivos a la nube
export const uploadFile = async (fileBase64: string, fileName: string, patientId: string) => {
    const storageRef = ref(storage, `patients/${patientId}/${Date.now()}_${fileName}`);
    await uploadString(storageRef, fileBase64, 'base64'); 
    return await getDownloadURL(storageRef);
};
