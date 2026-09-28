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
  hasCordobaRecruitingCenter?: boolean; // FASE 4.1: true solo si la sede específica de Córdoba está activamente reclutando
  cordobaRecruitingStatus?: string;      // ej. 'RECRUITING', 'NOT_YET_RECRUITING', 'SUSPENDED', 'UNKNOWN'
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
  // FASE 3: Normalización y estructuración de criterios de elegibilidad (sin reemplazar texto original)
  structuredCriteria?: StructuredCriterion[];
  ecogMaxAdmissible?: number; // Máximo ECOG admitido explícito del protocolo (undefined si el protocolo no especifica ECOG)
}

export type CriterionType = 'inclusion' | 'exclusion';

export type CriterionCategory = 
  | 'AGE'
  | 'SEX'
  | 'ECOG'
  | 'BIOMARKER'
  | 'MOLECULAR_ALTERATION'
  | 'STAGE'
  | 'CLINICAL_SCENARIO'
  | 'PRIOR_TREATMENT'
  | 'LINE_OF_THERAPY'
  | 'LAB'
  | 'CNS_METASTASIS'
  | 'OTHER';

export type CriterionParseStatus = 'STRUCTURED' | 'PARTIALLY_STRUCTURED' | 'UNSTRUCTURED';

export interface StructuredCriterionDetails {
  // ECOG
  ecogMin?: number;
  ecogMax?: number;
  // LAB
  labParameter?: 'hemoglobin' | 'neutrophils' | 'platelets' | 'total_bilirubin' | 'ast' | 'alt' | 'creatinine' | 'creatinine_clearance' | 'inr' | string;
  labOperator?: '>=' | '<=' | '>' | '<' | 'BETWEEN';
  labValue?: number;
  labMaxValue?: number;
  labUnit?: string;
  labReference?: string; // ej. 'ULN'
  // BIOMARKER / MOLECULAR_ALTERATION
  gene?: string;
  statusRequired?: 'MUTATED' | 'WILD_TYPE' | 'POSITIVE' | 'NEGATIVE' | 'OVEREXPRESSED' | 'AMPLIFIED' | 'ANY';
  specificAlteration?: string; // ej. 'Exon 19 del', 'L858R', 'G12C', 'V600E'
  minNumericThreshold?: number; // ej. 50 (para PD-L1 >= 50%)
  // PRIOR_TREATMENT / LINE_OF_THERAPY
  treatmentName?: string;
  treatmentRequirement?: 'MUST_HAVE_RECEIVED' | 'FORBIDDEN' | 'TREATMENT_NAIVE';
  minLines?: number;
  maxLines?: number;
  lineAllowed?: string;
  // STAGE / SCENARIO
  stage?: string;
  scenario?: 'metastatic' | 'unresectable' | 'locally_advanced' | 'recurrent' | 'adjuvant' | 'neoadjuvant';
  // CNS
  cnsRule?: 'ACTIVE_EXCLUDED' | 'STABLE_TREATED_ALLOWED' | 'STRICTLY_EXCLUDED';
}

export interface StructuredCriterion {
  id: string;
  criterionType: CriterionType;
  category: CriterionCategory;
  operator?: string;
  value?: unknown;
  mandatory: boolean;
  sourceText: string;
  parseStatus: CriterionParseStatus;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  details?: StructuredCriterionDetails;
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
    uln?: Record<string, number | undefined>; // FASE 4.1: Valores de referencia ULN verificables
  };
}

export type CriterionEvaluationStatus = 'CUMPLE' | 'NO CUMPLE' | 'NO DOCUMENTADO' | 'NO EVALUABLE';

export interface CriterionEvaluationDetail {
  id: string;
  criterionType: CriterionType;
  category: CriterionCategory;
  name: string;
  status: CriterionEvaluationStatus;
  statusLabel: string;
  patientValueDescription?: string;
  evidenceSource?: string;
  sourceText: string;
  isExclusion: boolean;
  missingAction?: string;
  isIncompatible?: boolean;
}

export type MatchCategory = 
  | 'potential_candidate'         // 🟢 Potencialmente elegible
  | 'potential_missing_data'      // 🟡 Potencialmente elegible — falta información
  | 'not_compatible'              // 🔴 No cumple criterio documentado
  | 'not_evaluable';              // ⚪ No evaluable

export interface TrialMatchResult {
  trial: ClinicalTrial;
  category: MatchCategory;
  categoryLabel: string;
  categoryBadge: string;
  score: number;
  matches: string[];             // "Coincidencias encontradas"
  missingData: string[];         // "Datos faltantes"
  incompatibilities: string[];   // "Posibles incompatibilidades"
  requiredVerificationNotice: string;
  // FASE 4: Pre-screening detallado por criterio y acciones faltantes
  criteriaEvaluations?: CriterionEvaluationDetail[];
  missingItems?: string[];       // Acciones/estudios que faltan para completar el pre-screening
  unstructuredCriteriaCount?: number;
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
  notCompatibleCount?: number;
  notEvaluableCount?: number;
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
