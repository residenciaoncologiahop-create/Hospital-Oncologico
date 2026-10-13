import type { LabResult } from '../components/LabPanel';
import type { ImagingStudy } from '../components/ImagingPanel';
import type { ClinicalValidationChecklist } from '../mocks/demoCases';
import type { ProcessedChunkRecord } from '../utils/chunkHasher';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ClinicalEvent {
  date: string;
  professional: string;
  category: string;
  note: string;
  isKey: boolean;
  detail?: string;
}

export interface ClinicalNote {
  id?: string;
  date?: string;
  text?: string;
  [key: string]: unknown;
}

export interface BiomarkerEntry {
  name: string;
  status: string;
  rawText: string;
}

export type StageCategory =
  | 'Estadio I'
  | 'Estadio II'
  | 'Estadio III'
  | 'Estadio IV'
  | 'No consignado';

export type StageConfidence = 'confirmed' | 'auto' | 'pending';

export interface Patient {
  // Identificador (opcional en creación / payload, obligatorio en persistencia)
  id?: string;
  doctorId?: string;
  hcNumber?: string;

  // Filiación y demografía (opcionales)
  name?: string;
  age?: number;
  ageRange?: string;
  dni?: string;
  phone?: string;
  celular?: string;
  gender?: string;
  birthDate?: string;

  // Datos clínicos (no obligatorios para admitir orígenes heterogéneos)
  diagnosis?: string;
  historyText?: string;
  lastUpdated?: number;

  // Colecciones, eventos y estudios
  chatHistory?: ChatMessage[];
  timeline?: ClinicalEvent[];
  clinicalNotes?: Array<ClinicalNote | string>;
  labResults?: LabResult[];
  imagingStudies?: Array<ImagingStudy | any>;
  validationCriteria?: ClinicalValidationChecklist;
  processedChunks?: ProcessedChunkRecord[];
  fileUrls?: string[];

  // Contexto clínico persistente
  clinicalContext?: string;
  clinicalContextUpdatedAt?: number | null;

  // Perfil oncológico estructurado
  stage?: StageCategory | string;
  stageConfidence?: StageConfidence;
  organOrSite?: string;
  isMetastatic?: boolean;
  biomarkersStructured?: BiomarkerEntry[];
}

export type NewPatient = Omit<Patient, 'id'>;
