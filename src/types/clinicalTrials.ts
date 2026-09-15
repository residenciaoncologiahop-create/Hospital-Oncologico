/**
 * Tipos e interfaces independientes para el módulo de Ensayos Clínicos
 * Modelo interno: ClinicalTrial, Extractor Clínico y Matching
 */

export type TrialSourceType = 'clinicaltrials.gov' | 'renis' | 'unensayoparami';

export type TrialStatusType = 
  | 'RECRUITING' 
  | 'NOT_YET_RECRUITING' 
  | 'ENROLLING_BY_INVITATION' 
  | 'ACTIVE_NOT_RECRUITING' 
  | 'COMPLETED' 
  | 'TERMINATED' 
  | 'SUSPENDED' 
  | 'WITHDRAWN' 
  | 'UNKNOWN';

export type TrialPhaseType = 
  | 'PHASE1' 
  | 'PHASE2' 
  | 'PHASE3' 
  | 'PHASE4' 
  | 'EARLY_PHASE1' 
  | 'NA' 
  | 'COMBINED';

export interface TrialLocation {
  facility?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  status?: string;
  isCordoba: boolean;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface TrialContact {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface ClinicalTrial {
  id: string; // e.g. ctgov_NCT06282575
  source: TrialSourceType;
  sourceId: string;
  nctId?: string;
  title: string;
  officialTitle?: string;
  sponsor: string;
  status: TrialStatusType;
  statusLabel: string;
  phase: string;
  phaseNormalized: string;
  conditions: string[];
  interventions: string[];
  briefSummary: string;
  eligibilityCriteria: string; // Texto original completo
  inclusionCriteria: string[]; // Criterios de inclusión parseados
  exclusionCriteria: string[]; // Criterios de exclusión parseados
  minimumAge?: string;
  minimumAgeYears?: number;
  maximumAge?: string;
  maximumAgeYears?: number;
  sex: 'ALL' | 'FEMALE' | 'MALE';
  locations: TrialLocation[];
  hasCordobaCenter: boolean;
  hasArgentinaCenter: boolean;
  cordobaCenters: string[];
  contact?: TrialContact;
  url: string;
  lastUpdated: string; // ISO o fecha provista por la fuente
  importedAt: number;
  // Campos normalizados para búsqueda y matching rápido
  tumorTypes: string[]; // ej. 'colon', 'mama', 'pulmon', 'melanoma', 'pancreas', etc.
  biomarkers: string[]; // ej. 'KRAS', 'BRAF', 'EGFR', 'HER2', 'ALK', 'PD-L1', etc.
  lineOfTherapy?: string[]; // ej. '1L', '2L+', 'adjuvant', 'metastatic'
  isMetastaticEligible?: boolean;
}

/**
 * Perfil estructurado extraído de un paciente existente para matching
 * Estrictamente conservador: NO infiere ni inventa datos ausentes.
 */
export interface PatientClinicalProfile {
  patientId: string;
  hcNumber: string;
  name: string;
  age?: number;
  sex?: 'MALE' | 'FEMALE' | 'OTHER';
  diagnosisRaw: string;
  organOrSite?: string; // ej. 'colon', 'pulmon', 'mama', 'melanoma', 'pancreas'
  histology?: string;   // ej. 'adenocarcinoma', 'carcinoma ductal'
  stageDocumented?: string; // Solo si está explícito, sino undefined
  isMetastaticDocumented?: boolean; // true si explícitamente se describe metastásico
  biomarkersDocumented: Array<{
    name: string;      // ej. 'KRAS', 'BRAF', 'HER2', 'EGFR', 'MSI'
    status: string;    // ej. 'Mutado', 'Wild-Type', 'Positivo', 'Negativo', 'MSS', 'Exón 19 del'
    rawText: string;
  }>;
  linesDocumented: string[]; // ej. '1ra Línea: mFOLFOX6 + Bevacizumab'
  priorTreatments: string[]; // drogas mencionadas explícitamente
  currentTreatment?: string;
  progressionDocumented?: boolean;
  ecogDocumented?: number; // Solo si está explícito (ej. ECOG 1 -> 1)
  labsDocumented: {
    hemoglobin?: number;
    platelets?: number;
    neutrophils?: number;
    creatinine?: number;
    totalBilirubin?: number;
    ast?: number;
    alt?: number;
  };
}

export type MatchCategory = 
  | 'potential_candidate'         // 🟢 Candidato potencial
  | 'potential_missing_data'      // 🟡 Potencialmente compatible — faltan datos
  | 'not_compatible';             // 🔴 Probablemente no compatible

export interface TrialMatchResult {
  trial: ClinicalTrial;
  category: MatchCategory;
  categoryLabel: string;
  categoryBadge: string; // '🟢 Candidato potencial' | '🟡 Potencialmente compatible — faltan datos' | '🔴 Probablemente no compatible'
  score: number;
  matches: string[];             // "Coincidencias encontradas"
  missingData: string[];         // "Datos faltantes"
  incompatibilities: string[];   // "Posibles incompatibilidades"
  requiredVerificationNotice: string; // "Paciente potencialmente elegible. Requiere verificación de criterios por el equipo investigador."
}

export interface PatientMatchingEvaluation {
  patientId: string;
  hcNumber: string;
  patientName: string;
  diagnosis: string;
  stageDocumented?: string;
  profile: PatientClinicalProfile;
  matches: TrialMatchResult[];
  potentialCandidateCount: number;
  potentialMissingDataCount: number;
  bestCategory: MatchCategory;
  lastEvaluatedAt: number;
}

export interface DoctorMatchingSummary {
  totalPatientsAnalyzed: number;
  patientsWithMatchesCount: number;
  totalMatchesCount: number;
  evaluations: PatientMatchingEvaluation[];
  analyzedAt: number;
}
