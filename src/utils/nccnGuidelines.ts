/**
 * NCCN Clinical Practice Guidelines in Oncology — Versiones de referencia clínica:
 *
 * - Cáncer de mama:              NCCN Breast Cancer v4.2024
 * - Cáncer de cérvix:            NCCN Cervical Cancer v1.2024
 * - Cáncer de colon:             NCCN Colon Cancer v2.2024
 * - Cáncer de recto:             NCCN Rectal Cancer v2.2024
 * - Cáncer de próstata:          NCCN Prostate Cancer v4.2024
 * - Cáncer de ovario:            NCCN Ovarian Cancer/Fallopian Tube Cancer/Primary Peritoneal Cancer v1.2024
 * - Cáncer de endometrio:        NCCN Uterine Neoplasms v1.2024
 * - Melanoma cutáneo:            NCCN Melanoma: Cutaneous v3.2024
 * - Cáncer de piel no melanoma:  NCCN Squamous Cell Skin Cancer v1.2024 / Basal Cell Skin Cancer v2.2024
 * - Cáncer de estómago:          NCCN Gastric Cancer v2.2024
 * - Adenocarcinoma de páncreas:  NCCN Pancreatic Adenocarcinoma v2.2024
 * - Tumores neuroendocrinos:     NCCN Neuroendocrine and Adrenal Tumors v1.2024
 * - Cáncer de testículo:         NCCN Testicular Cancer v1.2024
 * - Cáncer de vejiga:            NCCN Bladder Cancer v3.2024
 * - Cáncer de pulmón (NSCLC):    NCCN Non-Small Cell Lung Cancer v5.2024
 * - Cáncer de pulmón (SCLC):     NCCN Small Cell Lung Cancer v3.2024
 * - Cáncer de vías biliares:     NCCN Hepatobiliary Cancers v3.2024
 * - Cáncer de riñón:             NCCN Kidney Cancer v2.2024
 *
 * AVISO DE SEGURIDAD CLÍNICA:
 * La correspondencia exacta entre diagnóstico (órgano + estirpe histológica + escenario) y guía es de máxima prioridad.
 * No se debe asumir una estirpe ni seleccionar una guía por mera similitud semántica.
 */

export interface ScenarioRecommendations {
  scenarioTitle: string;
  intention: string;
  schedule: string;
  imaging: string;
  labs: string;
  specialRules: string;
}

export interface NCCNGuideline {
  id: string;
  pathology: string;
  organ: string;
  histologies: string[];
  excludedHistologies: string[];
  keywords: string[];
  intention: string;
  schedule: string;
  imaging: string;
  labs: string;
  alarmSigns: string;
  specialConsiderations: string;
  source: string;
  version: string;
  organization: string;
  scenarios?: {
    localizedSurveillance?: ScenarioRecommendations;
    activeMetastatic?: ScenarioRecommendations;
    resectedMetastatic?: ScenarioRecommendations;
    postTreatmentEvaluation?: ScenarioRecommendations;
    symptomaticReevaluation?: ScenarioRecommendations;
  };
}

export type FollowUpMode = 
  | 'CURATIVE_SURVEILLANCE'           
  | 'ACTIVE_METASTATIC_MONITORING'    
  | 'RESECTED_METASTATIC_SURVEILLANCE'
  | 'INDETERMINATE_STATUS';           

export type DiseaseStatus = 
  | 'NED'                              
  | 'POST_TREATMENT_EVALUATION'
  | 'ACTIVE_METASTATIC'                
  | 'PARTIAL_RESPONSE'                 
  | 'STABLE_DISEASE'                   
  | 'PROGRESSION'                      
  | 'RESECTED_OLIGOMETASTATIC_NED'     
  | 'INDETERMINATE';                   

export type FollowUpState =
  | 'ROUTINE_SURVEILLANCE'
  | 'POST_TREATMENT_EVALUATION'
  | 'SYMPTOMATIC_REEVALUATION'
  | 'CONFIRMED_RECURRENCE'
  | 'CONFIRMED_PROGRESSIVE_DISEASE'
  | 'ACTIVE_TREATMENT_MONITORING'
  | 'UNDETERMINED';

export interface PendingStudy {
  type: 'imaging' | 'laboratory' | 'endoscopy' | 'other';
  study: string;
  status: 'pending' | 'requested';
  date?: string;
  reason?: string;
}

export interface ClinicalScenarioProfile {
  organ: string;
  histology: string;
  subtype: string;
  stage: string;
  isStageIV: boolean;
  diseaseStatus: DiseaseStatus;
  diseaseStatusDescription: string;
  followUpMode: FollowUpMode;
  followUpState: FollowUpState;
  modeLabel: string;
  activeTreatment: string;
  hasActiveSystemicTreatment: boolean;
  treatmentIntent: string;
  lastImagingDate: string;
  lastTreatmentDate: string;
  surgeryDate: string;
  isHistologyIncomplete: boolean;
  symptomFlag: boolean;
  relevantSymptoms: string[];
  pendingStudies: PendingStudy[];
  confirmedRecurrence: boolean;
  confirmedProgression: boolean;
  summary: string;
  margin?: string;
  clinicalStatus?: string;
  treatment?: string;
}

export type PatientTumorProfile = ClinicalScenarioProfile;

export interface CandidateValidationResult {
  canProceed: boolean;
  profile: ClinicalScenarioProfile;
  sourceMode: 'CLOSED_SOURCE_MANUAL' | 'SYSTEM_NCCN' | 'NONE';
  validAttachedGuidelines: { name: string; type: string; data: string }[];
  validSystemGuideline: NCCNGuideline | null;
  activeScenarioRecommendations?: ScenarioRecommendations | null;
  excludedSources: { name: string; detectedTarget: string; reason: string }[];
  stopReason?: 'HISTOLOGY_INCOMPLETE' | 'EXCLUDED_ATTACHED_NO_VALID' | 'NO_MATCHING_SYSTEM_GUIDELINE' | 'INDETERMINATE_STATUS';
  stopTitle?: string;
  stopMessage?: string;
}

export const nccnGuidelines: NCCNGuideline[] = [
  {
    id: 'breast-cancer',
    pathology: 'Cáncer de mama',
    organ: 'Mama',
    histologies: ['ductal', 'lobulillar', 'carcinoma invasor de mama', 'carcinoma mamario', 'triple negativo', 'her2', 'luminal'],
    excludedHistologies: ['filodes', 'sarcoma mamario', 'linfoma mamario'],
    keywords: [
      'mama', 'breast', 'carcinoma ductal mamario', 'carcinoma ductal infiltrante',
      'carcinoma lobulillar', 'carcinoma de mama', 'cáncer de mama', 'luminal a', 'luminal b', 'her2 positivo', 'triple negativo'
    ],
    intention: 'Detección precoz de recaída locorregional o a distancia, manejo de secuelas del tratamiento (linfedema, cardiotoxicidad, menopausia inducida), y promoción de adherencia a terapia endocrina o anti-HER2 adyuvante.',
    schedule: 'Años 1–3: consulta oncológica cada 3–6 meses. Años 4–5: cada 6–12 meses. A partir del año 6: anual de por vida. En pacientes con terapia endocrina activa, control por ginecología/endocrinología al menos anual.',
    imaging: 'Mamografía bilateral (o de mama restante en mastectomía unilateral) anual, iniciando 6–12 meses post-radioterapia. RM mamaria solo si riesgo alto residual (mutación BRCA, densidad muy elevada, tejido residual post-conservadora). TAC, PET-TC y gammagrafía ósea NO se recomiendan de rutina en estadios I–III asintomáticos.',
    labs: 'No se recomiendan marcadores tumorales rutinarios (CA 15-3, CA 27.29, CEA) en seguimiento asintomático (categoría 2A). Hemograma y función hepática si hay síntomas o hallazgos clínicos. En terapia con tamoxifeno: ecografía pélvica solo ante sangrado uterino. En inhibidores de aromatasa: densitometría ósea basal y periódica (cada 1–2 años).',
    alarmSigns: 'Nuevo nódulo mamario o adenopatía axilar/supraclavicular; dolor óseo persistente o fractura patológica; disnea inexplicada; cefalea o déficit neurológico; sangrado uterino anormal (tamoxifeno); edema de miembro superior (linfedema).',
    specialConsiderations: 'Portadoras de BRCA1/2: considerar salpingo-ooforectomía y vigilancia específica. Terapia endocrina: optimizar adherencia (5–10 años). Cardioprotección si recibió antraciclinas/trastuzumab (ecocardiograma periódico). Evaluar salud ósea y calidad de vida.',
    source: 'NCCN Breast Cancer v4.2024',
    version: 'v4.2024',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Vigilancia post-tratamiento curativo (Estadios I–III resecados, NED)',
        intention: 'Detección precoz de recaída locorregional o contralateral curable; monitoreo de efectos tardíos.',
        schedule: 'Consulta cada 3–6 meses años 1–3, cada 6–12 meses años 4–5, luego anual.',
        imaging: 'Mamografía anual bilateral (o mama remanente). NO se recomiendan TAC ni PET rutinarios en estadios I–III asintomáticos.',
        labs: 'No se recomiendan marcadores tumorales (CA 15-3, CEA) de rutina.',
        specialRules: 'Monitoreo de densidad ósea con inhibidores de aromatasa (DMO cada 1–2 años). Adherencia hormonal 5–10 años.'
      },
      activeMetastatic: {
        scenarioTitle: 'Enfermedad metastásica activa / Evaluación de respuesta a terapia sistémica',
        intention: 'Evaluación seriada de respuesta antitumoral (RECIST 1.1), control de síntomas, prevención de eventos esqueléticos y manejo de toxicidad.',
        schedule: 'Evaluación clínica previa a cada ciclo de quimioterapia/terapia biológica (cada 3–4 semanas) o cada 2–3 meses en hormonoterapia.',
        imaging: 'TAC de tórax, abdomen y pelvis (o RM dirigida / PET-TC) cada 2 a 3 meses (cada 8–12 semanas) para evaluación de respuesta. Gammagrafía ósea si dolor o metástasis óseas.',
        labs: 'CA 15-3 y CEA basal y seriado junto con imágenes para evaluar respuesta bioquímica. Hemograma, perfil hepático y renal antes de cada ciclo.',
        specialRules: 'En metástasis óseas: considerar agentes antirreabsortivos (ácido zoledrónico / denosumab) y vigilancia odontológica/calcio.'
      }
    }
  },

  {
    id: 'cervical-cancer',
    pathology: 'Cáncer de cérvix (Cuello uterino)',
    organ: 'Cuello uterino (Cérvix)',
    histologies: ['carcinoma epidermoide de cervix', 'carcinoma escamoso cervical', 'adenocarcinoma de cervix', 'adenocarcinoma cervical'],
    excludedHistologies: ['sarcoma cervical', 'neuroendocrino de cervix'],
    keywords: [
      'cérvix', 'cervix', 'cervical', 'cuello uterino', 'carcinoma escamoso de cuello',
      'carcinoma epidermoide de cervix', 'adenocarcinoma de cuello uterino'
    ],
    intention: 'Detección precoz de recaída pélvica o a distancia, manejo de toxicidad por radioterapia pélvica (estenosis vaginal, fístulas, disfunción vesical/rectal), y seguimiento de secuelas del tratamiento.',
    schedule: 'Años 1–2: consulta cada 3–6 meses. Años 3–5: cada 6–12 meses. Después del año 5: anual. Examen pélvico con espéculo y tacto vaginal/rectal en cada visita.',
    imaging: 'Evaluación de respuesta inicial post-tratamiento definitivo no antes de 3 meses de completado el tratamiento (modalidad según evaluación inicial y contexto clínico: PET-TC, RMN de pelvis o TAC). En pacientes asintomáticas con respuesta completa documentada, no se recomiendan imágenes seriadas de rutina. Citología vaginal anual.',
    labs: 'Laboratorio de control general. Función renal periódica en pacientes con antecedentes obstructivos o compromiso parametrial. Marcadores tumorales (SCC o CA-125) solo condicionales si estaban documentadamente elevados al diagnóstico.',
    alarmSigns: 'Sangrado vaginal anormal; dolor pélvico o lumbar persistente; edema unilateral de miembro inferior; hematuria o fístulas; rectorragia o tenesmo; adenopatías inguinales o supraclaviculares.',
    specialConsiderations: 'Radioterapia pélvica previa: dilatadores vaginales y rehabilitación pélvica iniciada 2–4 semanas post-tratamiento. Asesoría en salud sexual y función renal.',
    source: 'NCCN Cervical Cancer v1.2024 / ESGO-ESTRO-ESP 2023',
    version: 'v1.2024',
    organization: 'NCCN / ESGO',
    scenarios: {
      postTreatmentEvaluation: {
        scenarioTitle: 'Evaluación de respuesta post-tratamiento definitivo (Período basal post-CRT / Braquiterapia)',
        intention: 'Evaluación basal de respuesta antitumoral post-tratamiento definitivo y manejo de toxicidad aguda y secuelas tempranas.',
        schedule: 'Consulta clínica y examen físico pélvico en el período post-tratamiento inicial (a las 6–12 semanas) para evaluar síntomas, tolerancia y recuperación de tejidos.',
        imaging: 'La evaluación de respuesta post-tratamiento debe realizarse no antes de 3 meses después de completar el tratamiento definitivo, utilizando la modalidad de imagen apropiada según la evaluación inicial y el contexto clínico (PET-TC de cuerpo entero, RMN de pelvis o TAC con contraste, según disponibilidad y estadificación previa). No realizar imágenes seriadas de rutina.',
        labs: 'Laboratorio general de control. Función renal (urea, creatinina) en pacientes con antecedente de uropatía obstructiva o compromiso parametrial. Marcadores tumorales (SCC / CA-125) únicamente condicionales si estaban documentadamente elevados al diagnóstico.',
        specialRules: 'Prevención y tratamiento de estenosis vaginal: uso de dilatadores vaginales y rehabilitación pélvica iniciada 2–4 semanas post-radioterapia. Asesoramiento en salud sexual. Considerar biopsia únicamente si existe una lesión o respuesta incierta/sospechosa en imágenes/examen y el resultado histológico puede modificar la conducta terapéutica (no realizar biopsia de rutina para demostrar respuesta completa).'
      },
      symptomaticReevaluation: {
        scenarioTitle: 'Reevaluación clínica dirigida por síntomas de alarma / Sospecha de recidiva',
        intention: 'Evaluación diagnóstica dirigida ante síntomas de sospecha para descartar o confirmar persistencia o recurrencia tumoral (locorregional o a distancia), sin asumir a priori progresión no confirmada.',
        schedule: 'Consulta y reevaluación médica oncológica dirigida e inmediata ante la aparición o persistencia de síntomas de alarma.',
        imaging: 'Reevaluación clínica dirigida y estudios por imágenes según la localización de los síntomas y la sospecha clínica: RMN de pelvis para evaluación locorregional (cérvix, parametrios, pared pélvica, plexo lumbosacro), y/o TAC de tórax-abdomen-pelvis / PET-TC cuando esté indicado por el contexto clínico o sospecha de enfermedad extrapelviana. No se exige de forma fija ni obligatoria una modalidad única para todo síntoma.',
        labs: 'Laboratorio de control con función renal y metabólica. Marcadores tumorales (SCC / CA-125) condicionales si existía elevación basal demostrada.',
        specialRules: 'Los síntomas de alarma (dolor pélvico, lumbociatalgia, edema de miembros inferiores, sangrado) exigen reevaluación diagnóstica pero NO constituyen por sí mismos progresión ni recurrencia confirmada. Ante cualquier hallazgo sospechoso de recidiva en imágenes o examen físico, se requiere confirmación histológica mediante biopsia antes de iniciar tratamientos de rescate.'
      },
      localizedSurveillance: {
        scenarioTitle: 'Vigilancia rutinaria post-tratamiento curativo (Respuesta completa documentada, asintomática, NED)',
        intention: 'Detección precoz de recurrencia asintomática y monitoreo de secuelas a largo plazo en pacientes con respuesta completa consolidada.',
        schedule: 'Años 1–2: consulta oncológica y examen físico pélvico cada 3–6 meses. Años 3–5: cada 6–12 meses. A partir del año 6: control anual individualizado.',
        imaging: 'No se recomiendan estudios de imagen seriados rutinarios (TAC ni PET-TC de rutina) en pacientes asintomáticas con respuesta completa documentada. Citología vaginal / Papanicolaou anual (según indicación de NCCN para detección de neoplasias del tracto genital inferior; no como método primario de detección de recurrencia post-radioterapia).',
        labs: 'No se recomiendan marcadores tumorales (SCC, CA-125, CEA) de rutina en el seguimiento asintomático. Función renal periódica si antecedente de uropatía obstructiva.',
        specialRules: 'Educación exhaustiva sobre signos y síntomas de alarma que requieren consulta anticipada (sangrado vaginal, dolor pélvico/lumbar persistente, edema unilateral de miembro inferior, síntomas urinarios o rectales). Mantenimiento de dilatadores vaginales y salud sexual post-radioterapia.'
      },
      activeMetastatic: {
        scenarioTitle: 'Enfermedad metastásica activa / Recidiva no pasible de rescate local en tratamiento sistémico',
        intention: 'Evaluación seriada de respuesta antitumoral objetiva (criterios RECIST 1.1 / iRECIST), control de síntomas y manejo de toxicidad.',
        schedule: 'Evaluación clínica antes de cada ciclo de tratamiento sistémico.',
        imaging: 'TAC de tórax, abdomen y pelvis con contraste IV (o PET-TC) cada 2 a 3 meses (cada 8–12 semanas) para Evaluación de Respuesta al tratamiento.',
        labs: 'Hemograma completo, perfil hepático y renal antes de cada ciclo de tratamiento.',
        specialRules: 'No aplicar pautas de vigilancia rutinaria en pacientes con enfermedad activa bajo tratamiento sistémico.'
      }
    }
  },

  {
    id: 'colon-cancer',
    pathology: 'Cáncer de colon',
    organ: 'Colon',
    histologies: ['adenocarcinoma de colon', 'adenocarcinoma mucinoso de colon', 'adenocarcinoma colorrectal'],
    excludedHistologies: ['neuroendocrino', 'net', 'gist', 'linfoma de colon', 'recto bajo', 'carcinoma epidermoide'],
    keywords: [
      'adenocarcinoma de colon', 'carcinoma de colon', 'cáncer de colon',
      'hemicolectomía', 'colectomía', 'neoplasia de colon'
    ],
    intention: 'Detección precoz de recaída hepática, pulmonar o locorregional potencialmente resecable; vigilancia endoscópica de neoplasias metacrónicas; manejo de secuelas quirúrgicas.',
    schedule: 'Años 1–3: consulta oncológica cada 3–6 meses. Años 4–5: cada 6 meses. A partir del año 6: anual. Colonoscopía al año de la resección (si normal, a los 3 años y luego cada 5 años).',
    imaging: 'TAC de tórax, abdomen y pelvis con contraste IV: cada 6–12 meses durante los primeros 3–5 años en estadios II–III de alto riesgo. PET-TC: no de rutina, indicado ante sospecha de recaída con CEA en ascenso y TAC negativo.',
    labs: 'CEA (antígeno carcinoembrionario): cada 3–6 meses durante los primeros 5 años (estadios II–III). Hemograma y función hepática en controles programados.',
    alarmSigns: 'Cambios en el hábito intestinal, sangrado rectal, dolor abdominal cólico persistente; pérdida de peso involuntaria; ascitis; ictericia; disnea o hemoptisis.',
    specialConsiderations: 'Evaluar síndrome de Lynch (MMR/MSI). Vigilancia de toxicidad por oxaliplatino (neuropatía periférica). Cuidado de ostomías si aplica.',
    source: 'NCCN Colon Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Modo A — Vigilancia post-tratamiento curativo (Estadios I, II, III resecados, NED)',
        intention: 'Detección precoz de recaída hepática, pulmonar o anastomótica potencialmente resecable con intención de rescate curativo.',
        schedule: 'Consulta clínica y oncológica cada 3–6 meses durante los primeros 3 años, luego cada 6 meses durante los años 4 y 5.',
        imaging: 'TAC de tórax, abdomen y pelvis con contraste IV cada 6–12 meses durante los primeros 3–5 años (recomendado en estadios II–III de alto riesgo).',
        labs: 'CEA sérico cada 3–6 meses durante los primeros 5 años.',
        specialRules: 'Colonoscopía al año post-resección (si normal, a los 3 años y luego cada 5 años). NO APLICABLE para estadio IV activo.'
      },
      activeMetastatic: {
        scenarioTitle: 'Modo B — Enfermedad metastásica activa / Evaluación de respuesta a tratamiento sistémico',
        intention: 'Evaluación seriada de respuesta antitumoral objetiva (criterios RECIST 1.1), control de enfermedad, monitoreo de toxicidad y detección precoz de progresión.',
        schedule: 'Evaluación clínica y de toxicidad previa a cada ciclo de quimioterapia/inmunoterapia (cada 2–3 semanas según esquema).',
        imaging: 'TAC de tórax, abdomen y pelvis con contraste IV cada 2 a 3 meses (cada 8–12 semanas o cada 4–6 ciclos de tratamiento) como Evaluación de Respuesta al Tratamiento.',
        labs: 'CEA sérico (y CA 19-9) basal y periódico (previo a cada ciclo o cada 2–3 meses) junto con imágenes para evaluar respuesta o progresión bioquímica. Laboratorio completo antes de cada ciclo.',
        specialRules: 'NO se indica colonoscopía de vigilancia estándar en estadio IV activo salvo síntomas digestivos específicos o sospecha de segundo primario. Si se documenta progresión confirmada por RECIST, evaluar cambio de línea de tratamiento sistémico.'
      },
      resectedMetastatic: {
        scenarioTitle: 'Modo C — Vigilancia intensiva post-resección completa de metástasis (Estadio IV resecado NED / Post-metastasectomía)',
        intention: 'Detección precoz de nueva recurrencia post-metastasectomía hepática/pulmonar o ablación completa con intención de rescate curativo continuado.',
        schedule: 'Consulta clínica y oncológica cada 3 meses durante los primeros 2 años, luego cada 6 meses hasta completar 5 años.',
        imaging: 'TAC de tórax, abdomen y pelvis con contraste IV (o RM hepática trifásica con contraste) cada 3–6 meses durante los primeros 2 años, luego cada 6–12 meses hasta el año 5.',
        labs: 'CEA sérico cada 3 meses durante los primeros 2 años, luego cada 6 meses hasta el año 5.',
        specialRules: 'Colonoscopía al año post-cirugía del tumor primario y luego cada 3–5 años. Monitoreo estricto de sitio quirúrgico hepático/pulmonar.'
      }
    }
  },

  {
    id: 'rectal-cancer',
    pathology: 'Cáncer de recto',
    organ: 'Recto',
    histologies: ['adenocarcinoma de recto', 'adenocarcinoma rectal'],
    excludedHistologies: ['neuroendocrino', 'net', 'gist', 'melanoma anorrectal', 'carcinoma escamoso de ano', 'carcinoma anal'],
    keywords: [
      'adenocarcinoma de recto', 'cáncer de recto', 'carcinoma rectal',
      'resección anterior baja', 'amputación abdominoperineal', 'tme'
    ],
    intention: 'Detección precoz de recaída local (anastomótica, pélvica) o a distancia (hígado, pulmón); vigilancia endoscópica; manejo de disfunción anorrectal, sexual y urinaria post-tratamiento.',
    schedule: 'Años 1–3: consulta cada 3–6 meses (clínica + CEA). Años 4–5: cada 6 meses. Después del año 5: anual. Proctosigmoidoscopía flexible cada 6 meses por 2–3 años en casos de resección anterior sin RT o según abordaje.',
    imaging: 'TAC de tórax, abdomen y pelvis con contraste IV: cada 6–12 meses por 3–5 años (estadios II–III). RM de pelvis ante sospecha de recidiva locorregional.',
    labs: 'CEA cada 3–6 meses por 5 años. Hemograma y perfil metabólico en controles.',
    alarmSigns: 'Rectorragia, dolor pélvico o perianal, tenesmo, cambio en el hábito evacuatorio, masa pélvica palpable, dolor ciático o lumbar.',
    specialConsiderations: 'Manejo del síndrome de resección anterior baja (LARS). Cuidados de colostomía definitiva si AAP. Secuelas de RT pélvica (proctitis actínica).',
    source: 'NCCN Rectal Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Modo A — Vigilancia post-tratamiento curativo (Estadios I–III resecados o TNT completada, NED)',
        intention: 'Detección precoz de recidiva pélvica local, hepática o pulmonar.',
        schedule: 'Consulta clínica cada 3–6 meses años 1–3, cada 6 meses años 4–5. Proctosigmoidoscopía cada 6 meses por 2–3 años si aplica.',
        imaging: 'TAC tórax-abdomen-pelvis cada 6–12 meses por 3–5 años. RM pelvis si sospecha de recurrencia locorregional.',
        labs: 'CEA cada 3–6 meses por 5 años.',
        specialRules: 'Colonoscopía al año post-resección y luego cada 3–5 años.'
      },
      activeMetastatic: {
        scenarioTitle: 'Modo B — Cáncer de recto metastásico activo / Evaluación de respuesta a tratamiento sistémico',
        intention: 'Evaluación de respuesta antitumoral objetiva (RECIST 1.1) a quimioterapia/inmunoterapia, control de síntomas y progresión.',
        schedule: 'Evaluación clínica antes de cada ciclo de tratamiento.',
        imaging: 'TAC tórax-abdomen-pelvis con contraste IV cada 2 a 3 meses (8–12 semanas) para Evaluación de Respuesta.',
        labs: 'CEA seriado previo a cada ciclo o cada 2–3 meses. Laboratorio general previo a ciclos.',
        specialRules: 'NO aplicar pautas rutinarias de vigilancia localizada en estadio IV activo.'
      }
    }
  },

  {
    id: 'prostate-cancer',
    pathology: 'Cáncer de próstata',
    organ: 'Próstata',
    histologies: ['adenocarcinoma de prostata', 'adenocarcinoma prostatico', 'acinar'],
    excludedHistologies: ['neuroendocrino de celulas pequeñas de prostata', 'sarcoma prostatico'],
    keywords: [
      'adenocarcinoma de próstata', 'adenocarcinoma prostatico', 'cáncer de próstata',
      'prostatectomía radical', 'gleason', 'isup', 'psa prostata'
    ],
    intention: 'Detección precoz de recaída bioquímica (elevación de PSA), monitoreo de respuesta a TDA, y manejo de secuelas (disfunción eréctil, incontinencia, osteoporosis, salud cardiovascular).',
    schedule: 'Años 1–5: PSA y evaluación clínica cada 6–12 meses (cada 3–6 meses si alto riesgo o en TDA). Después del año 5: anual.',
    imaging: 'Gammagrafía ósea y TAC/RM de pelvis: indicados ante sospecha de recaída clínica o bioquímica rápida. PET-TC con PSMA indicado en recaída bioquímica post-prostatectomía o post-RT. No se recomiendan imágenes rutinarias en pacientes asintomáticos con PSA indetectable.',
    labs: 'PSA total en cada consulta. Testosterona sérica en pacientes en bloqueo androgénico (objetivo <50 ng/dL). Densitometría ósea y perfil lipídico/glucémico en TDA prolongada.',
    alarmSigns: 'Elevación de PSA >0.2 ng/mL post-prostatectomía; elevación sobre nadir + 2 ng/mL post-radioterapia; dolor óseo nuevo; síntomas urinarios obstructivos agudos; debilidad de miembros inferiores.',
    specialConsiderations: 'Prevención de osteoporosis y riesgo metabólico en TDA. Manejo de continencia y salud sexual.',
    source: 'NCCN Prostate Cancer v4.2024',
    version: 'v4.2024',
    organization: 'NCCN'
  },

  {
    id: 'ovarian-cancer',
    pathology: 'Cáncer de ovario / Trompas / Peritoneal primario',
    organ: 'Ovario',
    histologies: ['carcinoma seroso de alto grado', 'carcinoma endometrioide de ovario', 'carcinoma de celulas claras de ovario', 'carcinoma mucinoso de ovario'],
    excludedHistologies: ['tumor de celulas de la granulosa', 'teratoma inmaduro', 'disgerminoma'],
    keywords: [
      'cáncer de ovario', 'carcinoma seroso de alto grado', 'carcinoma de trompa',
      'citorreducción', 'laparotomía estadificadora', 'ca 125 ovario'
    ],
    intention: 'Detección precoz de recurrencia pélvica o peritoneal, monitoreo de CA-125, y manejo de toxicidad acumulada por quimioterapia basada en platino y mantenimiento con inhibidores de PARP.',
    schedule: 'Años 1–2: consulta cada 2–4 meses. Años 3–5: cada 3–6 meses. Después del año 5: anual. Examen pélvico bimanual y rectovaginal en cada visita.',
    imaging: 'TAC de tórax, abdomen y pelvis con contraste: ante sospecha clínica o ascenso de CA-125. No se recomienda TAC rutinario en respuesta completa asintomática sin elevación de marcadores.',
    labs: 'CA-125 en cada visita de seguimiento. Hemograma y función renal periódica en pacientes con inhibidores de PARP.',
    alarmSigns: 'Aumento sostenido de CA-125; distensión abdominal o ascitis; dolor abdominal/pélvico persistente; alteraciones del tránsito intestinal; disnea inexplicada.',
    specialConsiderations: 'Test de mutación BRCA1/2 y HRD. Consejo genético oncológico familiar. Vigilancia de anemia y plaquetopenia con PARP inhibidores.',
    source: 'NCCN Ovarian Cancer/Fallopian Tube Cancer/Primary Peritoneal Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN'
  },

  {
    id: 'endometrial-cancer',
    pathology: 'Cáncer de endometrio',
    organ: 'Endometrio / Útero',
    histologies: ['endometrioide', 'seroso de endometrio', 'celulas claras de endometrio', 'carcinosarcoma endometrial', 'adenocarcinoma de endometrio'],
    excludedHistologies: ['leiomiosarcoma uterino', 'sarcoma del estroma endometrial', 'sarcoma uterino'],
    keywords: [
      'adenocarcinoma de endometrio', 'carcinoma endometrioide', 'cáncer de endometrio',
      'neoplasia de endometrio', 'carcinoma uterino'
    ],
    intention: 'Detección precoz de recaída en cúpula vaginal o a distancia; manejo de secuelas de radioterapia y cirugía.',
    schedule: 'Años 1–3: consulta cada 3–6 meses. Años 4–5: cada 6 meses. Después del año 5: anual. Examen con espéculo de cúpula vaginal en cada visita.',
    imaging: 'TAC de tórax-abdomen-pelvis: ante síntomas, hallazgos en examen pélvico o estadios avanzados de alto riesgo. No de rutina en estadio I asintomático.',
    labs: 'CA-125 opcional en estadios avanzados o seroso si estuvo elevado basalmente.',
    alarmSigns: 'Sangrado o flujo vaginal post-tratamiento; dolor pélvico o lumbar; disnea, tos; edema unilateral de miembro inferior.',
    specialConsiderations: 'Determinación de subtipo molecular (POLE, MMRd/MSI, p53abn). Síndrome de Lynch screening. Dilatadores vaginales post-braquiterapia.',
    source: 'NCCN Uterine Neoplasms v1.2024',
    version: 'v1.2024',
    organization: 'NCCN'
  },

  {
    id: 'cutaneous-melanoma',
    pathology: 'Melanoma cutáneo',
    organ: 'Piel',
    histologies: ['melanoma de extension superficial', 'melanoma nodular', 'melanoma lentigo maligno', 'melanoma acral lentiginoso', 'melanoma cutaneo'],
    excludedHistologies: ['melanoma uveal', 'melanoma mucoso', 'carcinoma basocelular', 'carcinoma espinocelular'],
    keywords: [
      'melanoma cutáneo', 'melanoma maligno', 'breslow', 'ganglio centinela',
      'ampliación de márgenes', 'melanoma braf'
    ],
    intention: 'Detección precoz de recurrencia locorregional (en tránsito, ganglionar) o a distancia (pulmón, SNC, hígado); detección de segundos primarios de melanoma; fomento de autoexamen de piel.',
    schedule: 'Estadios 0–IA: examen cutáneo anual. Estadios IB–IIA: cada 6–12 meses por 5 años, luego anual. Estadios IIB–IV (NED): cada 3–6 meses por 2 años, cada 6–12 meses por 3 años, luego anual.',
    imaging: 'Estadios 0–IIA: imágenes rutinarias NO recomendadas. Estadios IIB–IV (resecados): TAC tórax-abdomen-pelvis o PET-TC cada 3–12 meses por 3–5 años. RM de cerebro anual en estadio IV o IIIC de alto riesgo.',
    labs: 'LDH basal en enfermedad avanzada (valor pronóstico). No se recomiendan marcadores serológicos de rutina en estadios I–II.',
    alarmSigns: 'Nueva lesión pigmentada o cambio en lunar previo (ABCDE); nódulos subcutáneos indoloros (en tránsito); adenopatía regional palpable; cefalea matutina o síntomas neurológicos (SNC); dolor óseo.',
    specialConsiderations: 'Protección solar estricta. Educación familiar en autoexamen. Testeo de mutación BRAF V600 en estadios III–IV.',
    source: 'NCCN Melanoma: Cutaneous v3.2024',
    version: 'v3.2024',
    organization: 'NCCN'
  },

  {
    id: 'non-melanoma-skin-cancer',
    pathology: 'Cáncer de piel no melanoma (Carcinoma Basocelular / Espinocelular)',
    organ: 'Piel',
    histologies: ['carcinoma basocelular', 'carcinoma espinocelular cutaneo', 'carcinoma epidermoide cutaneo', 'carcinoma de celulas escamosas de piel'],
    excludedHistologies: ['melanoma', 'merkel', 'dermatofibrosarcoma'],
    keywords: [
      'carcinoma basocelular', 'carcinoma espinocelular de piel', 'epitelioma basocelular',
      'cirugía de mohs', 'queratosis actínica', 'cáncer de piel no melanoma'
    ],
    intention: 'Detección precoz de recurrencias locales, segundo primario cutáneo y adenopatías regionales (en CEC de alto riesgo).',
    schedule: 'CBC: examen dermatológico cada 6–12 meses de por vida. CEC de bajo riesgo: cada 6–12 meses por 5 años, luego anual. CEC de alto riesgo: cada 3–6 meses por 2 años, luego cada 6–12 meses.',
    imaging: 'Generalmente no se requieren imágenes de rutina. En CEC de muy alto riesgo o sospecha de invasión perineural/ganglionar: ecografía ganglionar regional o TAC/RM.',
    labs: 'No se requieren análisis de laboratorio específicos para seguimiento.',
    alarmSigns: 'Lesión ulcerada o perlada que no cicatriza en más de 4 semanas; masa palpable en territorio ganglionar tributario; dolor o parestesias faciales.',
    specialConsiderations: 'Fotoeducación y fotoprotección FPS 50+. Autoexamen mensual. Atención especial a pacientes inmunosuprimidos/trasplantados.',
    source: 'NCCN Basal Cell Skin Cancer v2.2024 / Squamous Cell Skin Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN'
  },

  {
    id: 'gastric-cancer',
    pathology: 'Cáncer de estómago (Adenocarcinoma gástrico)',
    organ: 'Estómago',
    histologies: ['adenocarcinoma gastrico', 'adenocarcinoma de estomago', 'adenocarcinoma de la union esofagogastrica'],
    excludedHistologies: ['gist', 'tumor del estroma gastrointestinal', 'linfoma gastrico', 'neuroendocrino gastrico', 'tne gastrico'],
    keywords: [
      'adenocarcinoma gástrico', 'adenocarcinoma de estómago', 'cáncer gástrico',
      'gastrectomía', 'carcinoma gástrico difuso', 'carcinoma gástrico intestinal'
    ],
    intention: 'Detección precoz de recaída local, peritoneal o a distancia; soporte nutricional y monitoreo de secuelas post-gastrectomía.',
    schedule: 'Años 1–3: consulta cada 3–6 meses. Años 4–5: cada 6–12 meses. Después del año 5: anual. Evaluación nutricional estricta en cada visita.',
    imaging: 'TAC de tórax, abdomen y pelvis con contraste oral e IV: cada 6–12 meses por los primeros 3 años (estadios II–III). Endoscopía alta de control a los 6–12 meses si gastrectomía parcial.',
    labs: 'Hemograma, ferritina, vitamina B12 (obligatoria suplementación IM de por vida en gastrectomía total). Marcadores CEA y CA 19-9 ante sospecha clínica.',
    alarmSigns: 'Disfagia, vómitos persistentes, pérdida de peso, dolor epigástrico, melena, ascitis, ictericia.',
    specialConsiderations: 'Soporte nutricional especializado. Evaluación de HER2 y MMR/MSI en enfermedad avanzada.',
    source: 'NCCN Gastric Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN'
  },

  {
    id: 'pancreatic-adenocarcinoma',
    pathology: 'Adenocarcinoma de páncreas',
    organ: 'Páncreas',
    histologies: ['adenocarcinoma de pancreas', 'adenocarcinoma ductal pancreatico', 'adenocarcinoma ductal de pancreas', 'carcinoma pancreatico ductal'],
    excludedHistologies: ['neuroendocrino', 'net', 'pnet', 'tumor neuroendocrino de pancreas', 'carcinoide', 'acinar', 'solido pseudopapilar', 'ipmn', 'cistoadenoma'],
    keywords: [
      'adenocarcinoma de páncreas', 'adenocarcinoma ductal pancreático', 'adenocarcinoma pancreático',
      'duodenopancreatectomía cefálica', 'cirugía de whipple', 'pancreatectomía corporocaudal'
    ],
    intention: 'Detección de recaída locorregional o a distancia (hepática/peritoneal), manejo de insuficiencia pancreática exocrina/endocrina y soporte nutricional.',
    schedule: 'Post-resección: consulta cada 3–6 meses por 2 años, luego cada 6 meses hasta el año 5, luego anual. En enfermedad avanzada: evaluación cada 2–3 ciclos de quimioterapia.',
    imaging: 'TAC multicorte de abdomen y pelvis con contraste trifásico (o RM abdominal): cada 3–6 meses durante los primeros 2 años post-resección, luego cada 6–12 meses. TAC de tórax periódico.',
    labs: 'CA 19-9 sérico en cada control (interpretar junto con función biliar/bilirrubina). Glucemia/HbA1c para control de diabetes post-resección. Elastasa fecal si síntomas de esteatorrea.',
    alarmSigns: 'Ictericia, coluria, dolor epigástrico irradiado a dorso, pérdida de peso rápida, esteatorrea, descontrol glucémico agudo.',
    specialConsiderations: 'Terapia de reemplazo con enzimas pancreáticas (PERT). Consejo genético para test germinal (BRCA1/2, PALB2). Manejo analgésico precoz.',
    source: 'NCCN Pancreatic Adenocarcinoma v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Vigilancia post-resección curativa (Estadios I–III resecados, adyuvancia completada, NED)',
        intention: 'Detección precoz de recidiva local en lecho quirúrgico, hepática o peritoneal.',
        schedule: 'Consulta oncológica y clínica cada 3–6 meses durante los primeros 2 años, luego cada 6 meses hasta el año 5.',
        imaging: 'TAC con contraste trifásico de abdomen y pelvis + TAC de tórax cada 3–6 meses por 2 años, luego cada 6–12 meses.',
        labs: 'CA 19-9 sérico en cada visita de seguimiento. Glucemia / HbA1c periódica.',
        specialRules: 'Terapia enzimática sustitutiva (PERT) si esteatorrea o insuficiencia exocrina.'
      },
      activeMetastatic: {
        scenarioTitle: 'Enfermedad metastásica activa / Evaluación de respuesta a quimioterapia paliativa',
        intention: 'Evaluación de respuesta tumoral (RECIST 1.1), control del dolor, soporte nutricional y monitoreo de toxicidad.',
        schedule: 'Evaluación clínica antes de cada ciclo de quimioterapia (FOLFIRINOX o Gemcitabina/Nab-Paclitaxel).',
        imaging: 'TAC de tórax, abdomen y pelvis con contraste cada 2 a 3 meses (cada 8–12 semanas) para Evaluación de Respuesta.',
        labs: 'CA 19-9 sérico previo a cada ciclo o cada 2–3 meses para correlación de respuesta. Laboratorio completo con perfil hepático y bilirrubinas.',
        specialRules: 'NO aplicar pautas rutinarias de vigilancia post-quirúrgica en enfermedad metastásica activa.'
      }
    }
  },

  {
    id: 'neuroendocrine-tumors',
    pathology: 'Tumores neuroendocrinos pancreáticos y gastrointestinales (TNE / NET)',
    organ: 'Páncreas',
    histologies: ['tumor neuroendocrino', 'tne', 'net g1', 'net g2', 'net g3', 'pnet', 'tumor carcinoide', 'carcinoma neuroendocrino'],
    excludedHistologies: ['adenocarcinoma ductal', 'adenocarcinoma de pancreas', 'carcinoma acinar'],
    keywords: [
      'tumor neuroendocrino', 'tne pancreático', 'pnet', 'net g1', 'net g2',
      'cromogranina a', 'pet dotatate', 'análogos de somatostatina', 'octreotida', 'lanreotida'
    ],
    intention: 'Monitoreo de progresión tumoral y control de síndrome hormonal funcional (carcinoide, insulinoma, gastrinoma). Diferenciado estrictamente del adenocarcinoma ductal.',
    schedule: 'TNE bien diferenciados resecados (G1–G2): consulta cada 3–6 meses en los primeros 2 años, luego cada 6–12 meses hasta el año 10. En TNE G3 o carcinomas neuroendocrinos: cada 2–3 meses.',
    imaging: 'TAC o RM multiparamétrica con contraste trifásico de abdomen y pelvis cada 3–6 meses por 2 años, luego cada 6–12 meses. PET-TC con 68Ga-DOTATATE (o 64Cu-DOTATATE) ante sospecha de progresión o re-estadificación. No usar protocolos rutinarios de adenocarcinoma.',
    labs: 'Cromogranina A (CgA) sérica basal y periódica (si estaba elevada y sin interferencia por IBP). 5-HIAA en orina de 24h en síndrome carcinoide. Péptidos hormonales específicos según funcionalidad (insulina, gastrina, glucagón).',
    alarmSigns: 'Flushing, diarrea secretoria profusa, dolor abdominal, ictericia, disnea (cardiopatía carcinoide), hipoglucemias inexplicadas.',
    specialConsiderations: 'Evaluación de receptores de somatostatina por PET DOTATATE. En pacientes con análogos de somatostatina (octreotida/lanreotida): monitoreo de respuesta y función biliar/glucemia.',
    source: 'NCCN Neuroendocrine and Adrenal Tumors v1.2024',
    version: 'v1.2024',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Vigilancia post-resección / Control de TNE localizado (Estadios I–III resecados, NED)',
        intention: 'Monitoreo de recurrencia locorregional o hepática y control de funcionalidad hormonal.',
        schedule: 'TNE bien diferenciados (G1–G2): consulta clínica cada 3–6 meses años 1–2, luego cada 6–12 meses hasta año 10. TNE G3: cada 2–3 meses.',
        imaging: 'TAC o RM multiparamétrica con contraste trifásico de abdomen y pelvis cada 3–6 meses por 2 años, luego cada 6–12 meses. PET-TC 68Ga-DOTATATE ante sospecha de recidiva.',
        labs: 'Cromogranina A (CgA) periódica si basal elevada. 5-HIAA en orina de 24h si funcional.',
        specialRules: 'NO aplicar protocolos de adenocarcinoma pancreático ductal ni solicitar CA 19-9 de rutina en TNE puros.'
      },
      activeMetastatic: {
        scenarioTitle: 'TNE metastásico activo / Monitoreo bajo Análogos de Somatostatina / PRRT / Terapia sistémica',
        intention: 'Evaluación seriada de estabilidad / progresión tumoral y control de hipersecreción hormonal.',
        schedule: 'Evaluación clínica cada 2–3 meses o en coincidencia con ciclos de análogos de somatostatina (octreotida/lanreotida) o PRRT.',
        imaging: 'TAC/RM multiparamétrica abdominal cada 3–6 meses para evaluar respuesta tumoral. PET-TC con 68Ga-DOTATATE para re-estadificación o evaluar expresión de SSTR.',
        labs: 'Cromogranina A sérica periódica, función hepática y renal completa, y péptidos específicos si es secretor.',
        specialRules: 'Monitoreo de función biliar (litiasis por análogos) y glucemia. Evaluar toxicidad hematológica y renal si PRRT.'
      }
    }
  },

  {
    id: 'testicular-cancer',
    pathology: 'Cáncer de testículo (Tumores de Células Germinales)',
    organ: 'Testículo',
    histologies: ['seminoma', 'no seminoma', 'carcinoma embrionario', 'teratoma', 'tumor del saco vitelino', 'coriocarcinoma', 'tumor de celulas germinales'],
    excludedHistologies: ['linfoma testicular', 'sarcoma testicular', 'tumor de celulas de leydig'],
    keywords: [
      'seminoma testicular', 'tumor germinal de testículo', 'no seminoma testicular',
      'orquiectomía radical', 'afp testiculo', 'bhcg testiculo'
    ],
    intention: 'Detección precoz de recaída retroperitoneal o pulmonar; monitoreo estricto de marcadores tumorales; vigilancia de fertilidad y secuelas de toxicidad a largo plazo.',
    schedule: 'Seminoma estadio I (vigilancia): consulta + marcadores cada 3–4 meses año 1, cada 6 meses años 2–3, luego anual. No seminoma estadio I (vigilancia): cada 2 meses año 1, cada 3 meses año 2, cada 4–6 meses años 3–4, luego anual.',
    imaging: 'TAC de abdomen y pelvis: frecuencia según estadio e histología (cada 4–6 meses en vigilancia activa de seminoma año 1, luego espaciado). RM abdominal en jóvenes para reducir radiación. Ecografía del testículo contralateral anual.',
    labs: 'AFP, β-HCG y LDH séricas en CADA visita de seguimiento. Perfil hormonal (testosterona, LH, FSH) ante síntomas de hipogonadismo.',
    alarmSigns: 'Aumento de marcadores tumorales; masa palpable en retroperitoneo o cuello; disnea o tos; masa en testículo contralateral.',
    specialConsiderations: 'Criopreservación de semen previa a tratamientos. Monitoreo cardiovascular, metabólico y auditivo tras quimioterapia con cisplatino/bleomicina.',
    source: 'NCCN Testicular Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN'
  },

  {
    id: 'bladder-cancer',
    pathology: 'Cáncer de vejiga (Carcinoma Urotelial)',
    organ: 'Vejiga',
    histologies: ['carcinoma urotelial', 'carcinoma de celulas transicionales', 'urotelial'],
    excludedHistologies: ['adenocarcinoma puro de vejiga', 'carcinoma epidermoide puro de vejiga', 'sarcoma vesical'],
    keywords: [
      'carcinoma urotelial de vejiga', 'cáncer de vejiga', 'cistectomía radical',
      'rtup vesical', 'carcinoma transicional de vejiga', 'bcg intravesical'
    ],
    intention: 'Detección de recaída intravesical en tumores no músculo-invasores, o recaída a distancia/vías superiores post-cistectomía.',
    schedule: 'No músculo-invasor (alto riesgo): cistoscopía + citología urinaria cada 3 meses por 2 años, luego cada 6 meses por 2 años, luego anual. Post-cistectomía: consulta cada 3–6 meses por 2 años, luego cada 6 meses.',
    imaging: 'Post-cistectomía: TAC tórax-abdomen-pelvis con contraste cada 6–12 meses por 3 años. Uro-TAC periódico para evaluar tracto urinario superior (uréteres y pelvis renal).',
    labs: 'Citología urinaria en cada cistoscopía. Función renal (urea, creatinina, electrolitos) y vitamina B12 en derivaciones urinarias ileales.',
    alarmSigns: 'Hematuria macroscópica o microscópica nueva, disuria, dolor en flanco o fosa lumbar, fiebre urinaria.',
    specialConsiderations: 'Cumplimiento del esquema de BCG mantenimiento en CVNMI. Cuidado de estomas o neovejiga.',
    source: 'NCCN Bladder Cancer v3.2024',
    version: 'v3.2024',
    organization: 'NCCN'
  },

  {
    id: 'lung-nsclc',
    pathology: 'Cáncer de pulmón de células no pequeñas (NSCLC)',
    organ: 'Pulmón',
    histologies: ['adenocarcinoma de pulmon', 'carcinoma escamoso de pulmon', 'carcinoma epidermoide de pulmon', 'carcinoma de celulas grandes de pulmon', 'nsclc'],
    excludedHistologies: ['microcitico', 'sclc', 'celulas pequenas', 'tumor carcinoide pulmonar'],
    keywords: [
      'cáncer de pulmón no células pequeñas', 'adenocarcinoma de pulmón', 'carcinoma escamoso pulmonar',
      'lobectomía pulmonar', 'egfr pulmon', 'alk pulmon', 'pdl1 pulmon'
    ],
    intention: 'Detección precoz de recaída intratorácica resecable, segundo primario pulmonar (riesgo 1–2%/año), o recaída a distancia (cerebro, suprarrenal, hueso).',
    schedule: 'Años 1–2: consulta cada 3–6 meses. Años 3–5: cada 6 meses. A partir del año 6: anual de por vida. Educación estricta en cesación tabáquica en cada visita.',
    imaging: 'Estadios I–IV resecados (NED): TAC de tórax con contraste (o baja dosis si intolerancia) cada 6 meses por 2–3 años, luego anual. En estadios III resecados o mutados: RM de cerebro anual en los primeros 2–3 años.',
    labs: 'No se recomiendan marcadores tumorales en sangre (CEA, Cyfra 21-1) para seguimiento rutinario.',
    alarmSigns: 'Tos nueva o cambiante, hemoptisis, disnea progresiva, dolor torácico u óseo, cefalea matutina o focalidad neurológica, pérdida de peso.',
    specialConsiderations: 'Cesación tabáquica obligatoria. Monitoreo de toxicidad en pacientes bajo inmunoterapia adyuvante/mantenimiento (atezolizumab/pembrolizumab) o TKI (osimertinib).',
    source: 'NCCN Non-Small Cell Lung Cancer v5.2024',
    version: 'v5.2024',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Vigilancia post-resección curativa (Estadios I–III resecados, NED)',
        intention: 'Detección precoz de recaída torácica o segundo primario.',
        schedule: 'Consulta clínica cada 3–6 meses años 1–2, luego cada 6 meses años 3–5, luego anual.',
        imaging: 'TAC de tórax con contraste cada 6 meses por 2–3 años, luego anual.',
        labs: 'No se recomiendan marcadores en sangre de rutina.',
        specialRules: 'Cesación tabáquica mandatoria. RM cerebro anual en estadio III resecado.'
      },
      activeMetastatic: {
        scenarioTitle: 'Enfermedad metastásica activa (Estadio IV) / Evaluación de respuesta a terapia sistémica/TKI/Inmunoterapia',
        intention: 'Evaluación de respuesta tumoral objetiva (RECIST 1.1 / iRECIST), monitoreo de toxicidades inmunomediadas o de TKIs.',
        schedule: 'Evaluación clínica antes de cada infusión o mensual en terapia oral.',
        imaging: 'TAC tórax-abdomen-pelvis con contraste IV cada 2 a 3 meses (cada 8–12 semanas) para Evaluación de Respuesta. RM cerebral periódica si metástasis en SNC.',
        labs: 'Laboratorio general y perfil tiroideo/hepático antes de cada ciclo de inmunoterapia.',
        specialRules: 'Si progresión a TKI de 1ra/2da generación: considerar rebiopsia líquida o tisular para mutaciones de resistencia (ej. T790M, C797S).'
      }
    }
  },

  {
    id: 'lung-sclc',
    pathology: 'Cáncer de pulmón de células pequeñas (SCLC)',
    organ: 'Pulmón',
    histologies: ['carcinoma microcitico', 'carcinoma de celulas pequenas', 'sclc', 'microcitico de pulmon'],
    excludedHistologies: ['adenocarcinoma', 'escamoso', 'nsclc', 'celulas grandes'],
    keywords: [
      'cáncer de pulmón células pequeñas', 'carcinoma microcítico', 'microcítico pulmonar',
      'quimiorradioterapia torácica', 'irradiación craneal profiláctica', 'pci'
    ],
    intention: 'Detección precoz de recaída rápida intratorácica o en SNC; monitoreo de toxicidad por radioterapia torácica e irradiación craneal profiláctica (PCI).',
    schedule: 'Año 1: consulta cada 2–3 meses. Año 2: cada 3–4 meses. Años 3–5: cada 6 meses. Después del año 5: anual.',
    imaging: 'TAC de tórax, abdomen y pelvis con contraste cada 3–4 meses en los años 1–2, luego cada 6 meses en los años 3–5. RM de cerebro con contraste cada 3–4 meses en el año 1 (si no recibió PCI o ante síntomas), luego cada 6 meses en el año 2.',
    labs: 'Hemograma, función renal y hepática en cada control. No hay marcadores tumorales serológicos de rutina recomendados.',
    alarmSigns: 'Disnea de rápida instalación, síndrome de vena cava superior, estridor, hemoptisis, cefalea, convulsiones o alteraciones cognitivas.',
    specialConsiderations: 'Evaluación neurocognitiva post-PCI. Monitoreo de mantenimiento con inmunoterapia (durvalumab / atezolizumab).',
    source: 'NCCN Small Cell Lung Cancer v3.2024',
    version: 'v3.2024',
    organization: 'NCCN'
  },

  {
    id: 'biliary-cancer',
    pathology: 'Cáncer de vías biliares (Colangiocarcinoma / Vesícula biliar)',
    organ: 'Vías biliares / Vesícula',
    histologies: ['colangiocarcinoma intrahepatico', 'colangiocarcinoma extrahepatico', 'colangiocarcinoma hiliar', 'carcinoma de vesicula biliar', 'adenocarcinoma de vias biliares'],
    excludedHistologies: ['hepatocarcinoma', 'carcinoma hepatocelular', 'neuroendocrino'],
    keywords: [
      'colangiocarcinoma', 'cáncer de vesícula biliar', 'cáncer de vías biliares',
      'tumor de klatskin', 'resección hepática', 'ca 19-9 vias biliares'
    ],
    intention: 'Detección de recaída local (lecho hepático, margen biliar) o a distancia (peritoneo, pulmón), control de colangitis/obstrucción biliar y función hepática.',
    schedule: 'Años 1–2: consulta cada 3–6 meses. Años 3–5: cada 6 meses. Después del año 5: anual.',
    imaging: 'TAC o RM multiparamétrica de abdomen y pelvis con contraste trifásico + TAC de tórax: cada 3–6 meses por 2 años, luego cada 6–12 meses hasta el año 5.',
    labs: 'CA 19-9 y CEA séricos en cada consulta. Perfil hepático completo (bilirrubinas, FA, GGT, transaminasas) para descartar obstrucción biliar temprana.',
    alarmSigns: 'Ictericia, prurito generalizado, acolia, coluria, fiebre o escalofríos (colangitis), dolor en hipocondrio derecho.',
    specialConsiderations: 'Manejo de prótesis/stents biliares endoscópicos o percutáneos. Evaluación molecular (FGFR2, IDH1, MSI/MMR, BRAF, HER2) en enfermedad avanzada.',
    source: 'NCCN Hepatobiliary Cancers v3.2024',
    version: 'v3.2024',
    organization: 'NCCN'
  },

  // ─────────────────────────────────────────────
  // 18. CÁNCER RENAL — NCCN Kidney Cancer v2.2024
  // ─────────────────────────────────────────────
  {
    id: 'kidney-cancer',
    pathology: 'Carcinoma de células renales',
    organ: 'Riñón',
    histologies: ['carcinoma de celulas claras de riñon', 'carcinoma papilar renal', 'carcinoma cromofobo renal', 'carcinoma renal'],
    excludedHistologies: ['carcinoma urotelial de pelvis renal', 'tumor de wilms', 'oncocitoma benigno'],
    keywords: [
      'carcinoma de células claras renal', 'cáncer renal', 'carcinoma renal',
      'nefrectomía radical', 'nefrectomía parcial', 'carcinoma papilar de riñón'
    ],
    intention:
      'Detección de recidiva en lecho quirúrgico, riñón contralateral o metástasis pulmonares/óseas; preservación de la función renal.',
    schedule:
      'Bajo riesgo post-nefrectomía: consulta clínica y labs cada 6–12 meses por 3 años, luego anual. Riesgo intermedio-alto: cada 3–6 meses por 3 años, luego cada 6 meses hasta el año 5, luego anual.',
    imaging:
      'TAC o RM de abdomen y TAC de tórax: a los 3–6 meses post-cirugía, luego cada 6–12 meses según estratificación de riesgo. Ecografía renal en bajo riesgo seleccionado.',
    labs:
      'Creatinina sérica, filtrado glomerular estimado (eGFR), sedimento urinario y hemograma en cada visita.',
    alarmSigns:
      'Hematuria, dolor lumbar persistente, tos o hemoptisis, pérdida ponderal inexplicable, hipertensión de novo o hipercalcemia.',
    specialConsiderations:
      'Seguimiento nefrológico estricto si monorreno o enfermedad renal crónica previa. Vigilancia de eventos adversos si recibió inmunoterapia adyuvante.',
    source: 'NCCN Kidney Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 19. ENFERMEDAD TROFOBLÁSTICA GESTACIONAL (GTN) — NCCN Gestational Trophoblastic Neoplasia v2.2026
  // ─────────────────────────────────────────────
  {
    id: 'gestational-trophoblastic-neoplasia',
    pathology: 'Enfermedad trofoblástica gestacional / Neoplasia trofoblástica gestacional (GTN)',
    organ: 'Trofoblasto gestacional (Útero)',
    histologies: [
      'mola hidatiforme completa',
      'mola hidatiforme parcial',
      'mola hidatiforme',
      'mola invasora',
      'coriocarcinoma gestacional',
      'tumor trofoblastico del sitio placentario',
      'tumor trofoblastico epitelioide'
    ],
    excludedHistologies: [
      'endometrioide',
      'seroso',
      'celulas claras',
      'sarcoma uterino'
    ],
    keywords: [
      'mola hidatiforme', 'mola completa', 'mola parcial', 'mola invasora',
      'coriocarcinoma gestacional', 'coriocarcinoma', 'tumor trofoblastico del sitio placentario',
      'tumor trofoblastico epitelioide', 'enfermedad trofoblastica gestacional',
      'neoplasia trofoblastica gestacional', 'gtn', 'beta-hcg', 'subunidad beta hcg',
      'evacuacion uterina', 'legrado uterino', 'embarazo molar'
    ],
    intention:
      'Monitorización cuantitativa seriada de hCG para confirmar remisión completa tras evacuación molar o detectar oportunamente neoplasia trofoblástica gestacional (GTN) persistente o metastásica; control de consolidación y remisión post-quimioterapia.',
    schedule:
      'Post-evacuación molar: hCG cada 1–2 semanas hasta 3 valores normales consecutivos; luego según mola completa (hCG mensual por 3–6 meses) o mola parcial (1 valor normal mensual adicional). GTN activa: hCG cada 1–2 semanas al inicio de cada ciclo durante quimioterapia y mensual tras remisión durante 12–24 meses.',
    imaging:
      'El eje de seguimiento es hCG cuantitativa seriada, NO imágenes de rutina. Radiografía de tórax basal. Imágenes dirigidas (TAC o RM) solo si hay metástasis documentadas al diagnóstico (pulmón, hígado, SNC) o meseta/re-elevación de hCG.',
    labs:
      'Determinación cuantitativa seriada de subunidad beta-hCG sérica con técnica estandarizada de alta sensibilidad. Hemograma y función hepática/renal durante quimioterapia sistémica.',
    alarmSigns:
      'Meseta o re-elevación de hCG en determinaciones seriadas, sangrado vaginal anormal, síntomas respiratorios o neurológicos nuevos.',
    specialConsiderations:
      'Anticoncepción efectiva obligatoria (ACO preferido) durante todo el seguimiento para no confundir un embarazo nuevo con recaída. En GTN de alto riesgo/estadio IV, monitoreo extendido hasta 24 meses post-remisión.',
    source: 'NCCN Gestational Trophoblastic Neoplasia v2.2026',
    version: 'v2.2026',
    organization: 'NCCN',
    scenarios: {
      localizedSurveillance: {
        scenarioTitle: 'Vigilancia post-evacuación de mola (sin GTN)',
        intention: 'Monitorización seriada de hCG para confirmar remisión espontánea y detectar precozmente persistencia o progresión a GTN.',
        schedule: 'hCG cada 1-2 semanas hasta 3 valores normales consecutivos; luego, si fue mola completa, hCG mensual por 3-6 meses adicionales (o 2 determinaciones en intervalos de 3 meses); si fue mola parcial, alcanza con 1 valor normal adicional al mes. Anticoncepción efectiva obligatoria (ACO preferido) durante todo el seguimiento para no confundir un embarazo nuevo con recaída.',
        imaging: 'El eje de seguimiento es hCG cuantitativa seriada, NO imágenes de rutina.',
        labs: 'Determinación cuantitativa seriada de subunidad beta-hCG sérica hasta completar el período de vigilancia protocolizado.',
        specialRules: 'Anticoncepción efectiva obligatoria (ACO preferido) durante todo el seguimiento para no confundir un embarazo nuevo con recaída.'
      },
      activeMetastatic: {
        scenarioTitle: 'Neoplasia trofoblástica gestacional (GTN de bajo o alto riesgo en quimioterapia)',
        intention: 'Control estricto de respuesta tumoral a quimioterapia, consolidación y vigilancia prolongada de recaída.',
        schedule: 'hCG cada 1-2 semanas al inicio de cada ciclo durante tratamiento; continuar quimioterapia 2-3 ciclos adicionales tras normalización de hCG; luego hCG mensual durante 12 meses. En estadio IV/alto riesgo, monitoreo mensual extendido hasta 24 meses tras la remisión. Imágenes dirigidas solo si hay metástasis documentadas al diagnóstico (pulmón, hígado, SNC).',
        imaging: 'Imágenes dirigidas solo si hay metástasis documentadas al diagnóstico (pulmón, hígado, SNC).',
        labs: 'hCG cuantitativa sérica cada 1-2 semanas al inicio de cada ciclo durante tratamiento y mensual post-remisión.',
        specialRules: 'Continuar quimioterapia 2-3 ciclos adicionales tras normalización de hCG; luego hCG mensual durante 12 meses (24 meses en estadio IV / alto riesgo).'
      }
    }
  }
];



/**
 * Normaliza cadenas para comparación clínica segura
 */
function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-.,/#!$%^&*;:{}=_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface OrganDefinition {
  organ: string;
  regex?: RegExp;
  check?: (str: string) => boolean;
  terms: string[];
}

const ORGAN_DEFINITIONS: OrganDefinition[] = [
  {
    organ: 'Páncreas',
    regex: /\b(pancrea\w*|wirsung|duodenopancreatectom\w*|pancreatectom\w*)\b/,
    terms: ['pancreas', 'pancreatico', 'pancreatica', 'pancreaticos', 'pancreaticas', 'wirsung']
  },
  {
    organ: 'Cuello uterino (Cérvix)',
    regex: /\b(cervic\w*|cervix|cuello uterino|cuello de utero)\b/,
    terms: ['cervix', 'cervical', 'cervicouterino', 'cervicouterina', 'cuello uterino', 'cuello de utero']
  },
  {
    organ: 'Trofoblasto gestacional (Útero)',
    check: (str: string) =>
      /\b(mola\s+hidat(?:id)?iforme|mola\s+completa|mola\s+parcial|mola\s+invasora|mola|embarazo\s+molar|trofoblast\w*|coriocarcinoma\s+gestacional)\b/.test(str) ||
      (/\bcoriocarcinoma\b/.test(str) && !/\b(testic\w*|orquiectom\w*)\b/.test(str)),
    terms: ['mola', 'trofoblasto', 'trofoblastica', 'trofoblastico', 'coriocarcinoma']
  },
  {
    organ: 'Endometrio / Útero',
    check: (str: string) => {
      // Excluir patología trofoblástica gestacional para que evacuación/legrado uterino en mola no active Endometrio
      if (
        /\b(?:mola\s+hidat(?:id)?iforme|mola\s+completa|mola\s+parcial|mola\s+invasora|mola|embarazo\s+molar|trofoblast\w*|coriocarcinoma\s+gestacional)\b/.test(str) ||
        (/\bcoriocarcinoma\b/.test(str) && !/\b(?:testic\w*|orquiectom\w*)\b/.test(str))
      ) {
        return false;
      }
      const withoutCuello = str
        .replace(/\b(?:cervic\w*|cervix|cuello)\s+(?:uterin\w*|de\s+utero)\b/g, ' ')
        .replace(/\bcuello\s+(?:uterin\w*|de\s+utero)\b/g, ' ')
        .replace(/\bcervicouterin\w*\b/g, ' ');
      return /\b(endometri\w*)\b/.test(str) || /\b(uterin\w*|utero)\b/.test(withoutCuello);
    },
    terms: ['endometrio', 'endometrial', 'endometrioide', 'utero', 'uterino', 'uterina']
  },
  {
    organ: 'Mama',
    regex: /\b(mama|mamas|mamari\w*|breast|mastectom\w*)\b/,
    terms: ['mama', 'mamas', 'mamario', 'mamaria', 'mamarios', 'mamarias', 'breast']
  },
  {
    organ: 'Colon',
    regex: /\b(colon|ciego|sigmoide\w*|colectom\w*|hemicolectom\w*|colorrectal\w*|colorectal\w*)\b/,
    terms: ['colon', 'ciego', 'sigmoide', 'sigmoides', 'colorrectal', 'colorectal']
  },
  {
    organ: 'Recto',
    check: (str: string) => {
      const withoutColorrectal = str.replace(/colo[r]?rectal\w*/g, ' ');
      return /\b(recto|rectal\w*|proctectom\w*|proctosigmoid\w*)\b/.test(withoutColorrectal);
    },
    terms: ['recto', 'rectal', 'rectales']
  },
  {
    organ: 'Próstata',
    regex: /\b(prostata|prostatic\w*|prostatectom\w*)\b/,
    terms: ['prostata', 'prostatico', 'prostatica', 'prostaticos', 'prostaticas']
  },
  {
    organ: 'Ovario',
    regex: /\b(ovari\w*|trompa\w*|peritoneal primario)\b/,
    terms: ['ovario', 'ovarios', 'ovarico', 'ovarica', 'trompa', 'trompas', 'peritoneal primario']
  },
  {
    organ: 'Pulmón',
    regex: /\b(pulmon\w*|bronqu\w*|lobectom\w* pulmonar)\b/,
    terms: ['pulmon', 'pulmones', 'pulmonar', 'pulmonares', 'bronquio', 'bronquial']
  },
  {
    organ: 'Estómago',
    regex: /\b(estomago|gastric\w*|gastrectom\w*|gastroesofagic\w*)\b/,
    terms: ['estomago', 'gastrico', 'gastrica', 'gastricos', 'gastricas', 'gastroesofagico', 'gastroesofagica']
  },
  {
    organ: 'Testículo',
    regex: /\b(testiculo\w*|testicular\w*|orquiectom\w*)\b/,
    terms: ['testiculo', 'testiculos', 'testicular', 'testiculares']
  },
  {
    organ: 'Vejiga',
    regex: /\b(vejiga|urotelial\w*|vesical\w*|cistectom\w*)\b/,
    terms: ['vejiga', 'urotelio', 'urotelial', 'uroteliales', 'vesical']
  },
  {
    organ: 'Piel',
    check: (str: string) => /\bmelanoma\b/.test(str) || (/\b(piel|cutane\w*)\b/.test(str) && /\b(basocelular|espinocelular|escam\w*|epidermoide)\b/.test(str)),
    terms: ['melanoma', 'piel', 'cutaneo', 'cutanea']
  },
  {
    organ: 'Vías biliares / Vesícula',
    regex: /\b(vias? biliar\w*|vesicula biliar|colangiocarcinoma|coledoco)\b/,
    terms: ['vias biliares', 'via biliar', 'vesicula biliar', 'colangiocarcinoma', 'coledoco']
  },
  {
    organ: 'Riñón',
    regex: /\b(ri[nñ]on\w*|renal\w*|nefrectom\w*)\b/,
    terms: ['rinon', 'riñon', 'rinones', 'riñones', 'renal', 'renales']
  }
];

/**
 * Verifica si una mención de un órgano está en contexto incidental, de normalidad, de exclusión o antecedente.
 */
function isOrganMentionIncidental(text: string, organTermRegex: RegExp): boolean {
  const norm = normalizeStr(text);

  // 1. Órgano seguido de normalidad / sin alteraciones (hasta 6 palabras intermedias)
  // Ej: "páncreas sin alteraciones", "páncreas normal", "páncreas de morfología y tamaño normal", "páncreas conservado"
  const postPattern = new RegExp(
    organTermRegex.source +
    '(?:\\s+[a-z]+){0,6}\\s+' +
    '(sin\\s+alteracion\\w*|sin\\s+lesion\\w*|libre\\s+de\\s+lesion\\w*|sin\\s+hallazgos|sin\\s+particularidades|s\\s+p|sin\\s+compromiso|normal\\w*|conservad\\w*|no\\s+muestra\\w*|no\\s+presenta\\w*|no\\s+visible|no\\s+evidencia\\w*)',
    'i'
  );
  if (postPattern.test(norm)) return true;

  // 2. Normalidad / sin alteraciones antes del órgano (hasta 6 palabras intermedias)
  // Ej: "sin alteraciones en páncreas", "no se observan lesiones en páncreas", "aspecto normal del páncreas"
  const prePattern = new RegExp(
    '(sin\\s+alteracion\\w*|sin\\s+lesion\\w*|sin\\s+hallazgos|sin\\s+particularidades|aspecto\\s+normal|normalidad|conservad\\w*|no\\s+se\\s+observa\\w*|no\\s+se\\s+evidencia\\w*|no\\s+se\\s+aprecia\\w*)' +
    '(?:\\s+[a-z]+){0,6}\\s+' +
    organTermRegex.source,
    'i'
  );
  if (prePattern.test(norm)) return true;

  // 3. Exclusiones clínicas, descarte o antecedentes familiares
  // Ej: "se descarta tumor de páncreas", "descarta colon", "legrado uterino", "antecedente familiar de cáncer de páncreas"
  const exclPattern = new RegExp(
    '(se\\s+descarta|descartar|descartad\\w*|descarta|descartan|diagnostico\\s+diferencial|ddx|antecedente\\w*\\s+(?:familiar\\w*|gineco\\w*|de)|guia\\w*\\s+(?:nccn|esmo|ascol)?|legrado\\w*)' +
    '(?:\\s+[a-z]+){0,6}\\s+' +
    organTermRegex.source,
    'i'
  );
  if (exclPattern.test(norm)) return true;

  // 4. Mención exclusiva como sitio secundario metastásico (no primario)
  // Ej: "metástasis pulmonares", "secundarismo pulmonar", "implantes pulmonares", "metástasis en pulmón"
  const metPattern = new RegExp(
    '(?:metastasis|secundarismo\\w*|implante\\w*|nodulo\\w*\\s+metastasico\\w*|compromiso\\s+metastasico)' +
    '(?:\\s+[a-z]+){0,4}\\s+' +
    organTermRegex.source,
    'i'
  );
  if (metPattern.test(norm)) return true;

  const postMetPattern = new RegExp(
    organTermRegex.source + '(?:\\s+[a-z]+){0,3}\\s+(?:metastasico\\w*|secundari\\w*)',
    'i'
  );
  if (postMetPattern.test(norm)) return true;

  return false;
}

/**
 * Extrae todos los órganos candidatos presentes en una cadena, descartando menciones secundarias o descartadas.
 */
function detectCandidateOrgans(rawOrNormStr: string, isExplicitContext: boolean = false): string[] {
  const str = normalizeStr(rawOrNormStr);
  let found: string[] = [];

  for (const def of ORGAN_DEFINITIONS) {
    let matches = false;
    if (def.check) {
      matches = def.check(str);
    } else if (def.regex) {
      matches = def.regex.test(str);
    }

    if (matches) {
      if (def.regex && isOrganMentionIncidental(str, def.regex)) {
        continue;
      }
      found.push(def.organ);
    }
  }

  // Si coexisten Trofoblasto gestacional y Endometrio / Útero, prevalece Trofoblasto
  if (found.includes('Trofoblasto gestacional (Útero)') && found.includes('Endometrio / Útero')) {
    found = found.filter(o => o !== 'Endometrio / Útero');
  }

  // Si coexisten Cuello uterino (Cérvix) y Endometrio / Útero:
  // Si no hay mención explícita de endometrio/endometrial/cuerpo uterino, el término "uterino" proviene de cérvix uterino o útero en contexto cervical.
  if (found.includes('Cuello uterino (Cérvix)') && found.includes('Endometrio / Útero')) {
    const hasExplicitEndometrium = /\b(endometri\w*|cuerpo\s+uterin\w*|cuerpo\s+de\s+utero)\b/.test(str);
    if (!hasExplicitEndometrium) {
      found = found.filter(o => o !== 'Endometrio / Útero');
    }
  }

  return found;
}

/**
 * Detecta diagnósticos oncológicos que se encuentran fuera de la cobertura de guías clínicas del sistema:
 * - Cáncer / Carcinoma de Sitio Primario Desconocido (CSPD / CUP / Origen desconocido)
 */
export function detectUnsupportedDiagnosis(clinicalText: string, explicitDiagnosis: string = ''): {
  isUnsupported: boolean;
  organLabel: string;
  histologyLabel: string;
} | null {
  const normDx = normalizeStr(explicitDiagnosis || '');
  const normText = normalizeStr(clinicalText || '');
  const combined = `${normDx} ${normText}`;

  // Sitio Primario Desconocido / CUP / CSPD / Origen Desconocido
  const isUnknownPrimary =
    /\b(?:sitio\s+primario\s+desconocido|primario\s+desconocido|origen\s+desconocido)\b/.test(combined) ||
    /\b(?:cspd|cup)\b/.test(combined) ||
    /\b(?:cancer|carcinoma|neoplasia|tumor|adenocarcinoma)\s+de\s+(?:sitio\s+)?(?:primario|origen)\s+desconocido\b/.test(combined) ||
    /\bcancer\s+of\s+unknown\s+primary\b/.test(combined) ||
    /\bunknown\s+primary\b/.test(combined);

  if (isUnknownPrimary) {
    return {
      isUnsupported: true,
      organLabel: 'No cubierto (Sitio primario desconocido / CUP)',
      histologyLabel: 'Carcinoma de sitio primario desconocido (CSPD / CUP)',
    };
  }

  return null;
}

/**
 * Neutraliza menciones de recidiva/progresión/recaída que corresponden a:
 * - Descarte explícito ("se descarta recidiva", "para descartar recaída")
 * - Solicitudes de estudio ("se solicita TAC para descartar recidiva")
 * - Sospechas no confirmadas ("sospecha de recidiva a confirmar/descartar/evaluar")
 * - Control por/de sospecha ("control por sospecha de recidiva")
 * - Screening/pesquisa/tamizaje con hallazgos negativos o sin hallazgos
 * - Negaciones clínicas tradicionales ("sin signos tomográficos de recidiva", "no se observa recidiva")
 */
export function cleanTextForProgression(text: string): string {
  return text
    // 1. Descarte explícito y motivos de estudio para descartar
    .replace(/(?:se\s+solicita|solicita|pedido\s+de|solicitud\s+de|control\s+con|estudio\s+para|tac\s+para|tc\s+para|pet\s+para|rm\s+para|eco\s+para)?\s*(?:para|a\s+fin\s+de|con\s+el\s+fin\s+de|con\s+el\s+objeto\s+de)?\s*(?:se\s+)?descart[aoó]\w*\s+(?:de\s+)?(?:posible\s+)?(?:recidiva|progresion|recaida|recurrencia|recurrente)\b/gi, ' ')
    .replace(/\b(?:recidiva|progresion|recaida|recurrencia|recurrente)\s+(?:descartad[ao]s?|se\s+descarta|qued[aoó]\s+descartad[ao]s?)\b/gi, ' ')
    // 2. Sospecha a confirmar, descartar, evaluar o en estudio
    .replace(/\bsospecha\s+de\s+(?:posible\s+)?(?:recidiva|progresion|recaida|recurrencia|recurrente)\s+(?:a\s+(?:confirmar|descartar|evaluar|estudiar)|pendiente\s+de\s+confirmaci[oó]n|en\s+estudio|no\s+confirmada?|a\s+determinar)\b/gi, ' ')
    .replace(/\b(?:a\s+(?:confirmar|descartar|evaluar)|pendiente\s+de\s+confirmaci[oó]n|en\s+estudio)\s+(?:de\s+)?(?:sospecha\s+de\s+)?(?:recidiva|progresion|recaida|recurrencia|recurrente)\b/gi, ' ')
    // 3. Control por / de sospecha de recidiva/progresión/recurrencia
    .replace(/\b(?:control|seguimiento|vigilancia|evaluaci[oó]n)\s+(?:por|de|ante)\s+(?:sospecha\s+de\s+)?(?:recidiva|progresion|recaida|recurrencia|recurrente)\b/gi, ' ')
    .replace(/\b(?:control|seguimiento|vigilancia|detecci[oó]n|prevenci[oó]n|profilaxis)\s+(?:de|para|por)\s+(?:recidiva|progresion|recaida|recurrencia|recurrente)\b/gi, ' ')
    // 4. Screening / tamizaje / vigilancia combinada con sin hallazgos / normal / negativo
    .replace(/\b(?:screening|tamizaje|pesquisa)\s+(?:de|para)?\s*(?:recidiva|progresion|recaida|recurrencia|recurrente)(?:[^\n.;]*)(?:sin\s+hallazgos|negativ[ao]|normal|sin\s+particularidades)\b/gi, ' ')
    // 5. Negaciones estándar y con modificadores intermedios
    .replace(/\bsin\s+(?:evidencia\s+de|signos\s+de|datos\s+de|imagenes\s+de|signos\s+tomogr[aá]ficos\s+de|hallazgos\s+de)?\s*(?:recidiva|progresion|recaida|recurrencia|recurrente|lesiones)\b/gi, ' ')
    .replace(/\bno\s+(?:presenta|se\s+observan?|se\s+evidencian?|se\s+aprecian?|se\s+identifican?|hay|muestra|constata)\s+(?:signos\s+de|evidencia\s+de)?\s*(?:recidiva|progresion|recaida|recurrencia|recurrente|lesiones)\b/gi, ' ')
    .replace(/\b(?:libre\s+de|ausencia\s+de)\s+(?:recidiva|progresion|recaida|recurrencia|recurrente|enfermedad)\b/gi, ' ')
    .replace(/\bnegativ[ao]s?\s+(?:para|de)\s+(?:recidiva|progresion|recaida|recurrencia|recurrente)\b/gi, ' ')
    .replace(/\b(?:score|riesgo)\s+de\s+(?:recidiva|recaida|progresion|recurrencia)\b/gi, ' ')
    // 6. Negación de elevación de marcador / CA-125
    .replace(/\bsin\s+(?:elevaci[oó]n|ascenso|aumento)\s+de\s+(?:ca\s*125|marcador\w*)\b/gi, ' ')
    .replace(/\bno\s+(?:presenta|muestra|hay|se observa)\s+(?:elevaci[oó]n|ascenso|aumento)\s+de\s+(?:ca\s*125|marcador\w*)\b/gi, ' ')
    .replace(/\b(?:ca\s*125|marcador\w*)\s+(?:normal|en\s+rango\s+normal|estable|sin\s+variaciones|sin\s+ascenso|sin\s+elevacion)\b/gi, ' ');
}

/**
 * Comprueba si una mención de progresión o recidiva está negada o en contexto de vigilancia/control/evaluación de riesgo.
 */
function isProgressionMentionNegatedOrSurveillance(clause: string): boolean {
  const norm = normalizeStr(clause);

  // 1. Negaciones clínicas amplias (soporta modificadores intermediarios como "signos tomográficos de", etc.)
  const negPatterns = [
    /\bsin\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente|lesion\w*|metastasis)\b/,
    /\bno\b(?:[\s\w]*)\b(se observa\w*|se evidencia\w*|se aprecia\w*|se identifica\w*|presenta|hay|muestra|constata)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente|lesion\w*|metastasis)\b/,
    /\b(?:libre\s+de|ausencia\s+de)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente|enfermedad)\b/,
    /\bnegativ[ao]s?\s+(?:para|de)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/,
    /\b(?:se\s+descarta|descartar|descartando|descartad[ao]s?|qued[aoó]\s+descartad[ao]s?)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/,
    /\b(recidiva|progresion|recaida|recurrencia|recurrente)\b(?:[\s\w]*)\b(?:descartad[ao]s?|se\s+descarta|qued[aoó]\s+descartad[ao]s?)\b/,
    /\bsin\s+(?:elevacion|ascenso|aumento)\b(?:[\s\w]*)\bca\s*125\b/,
    /\bca\s*125\b(?:[\s\w]*)\b(?:normal|estable|sin\s+cambios|sin\s+ascenso|sin\s+elevacion)\b/
  ];

  for (const p of negPatterns) {
    if (p.test(norm)) return true;
  }

  // 2. Solicitudes de estudio / motivos de control para descartar ("se solicita TAC para descartar recidiva/recurrencia")
  const studyMotivePatterns = [
    /\b(?:para|a\s+fin\s+de|con\s+el\s+fin\s+de|con\s+el\s+objeto\s+de)?\s*descartar\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/,
    /\b(?:se\s+solicita|solicito|solicita|pedido\s+de|solicitud\s+de|control\s+con|estudio\s+para|tac\s+para|tc\s+para|pet\s+para|rm\s+para|eco\s+para|ecografia\s+para|laboratorio\s+para)\b(?:[\s\w]*)\b(?:descartar|evaluar|controlar)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/
  ];

  for (const p of studyMotivePatterns) {
    if (p.test(norm)) return true;
  }

  // 3. Sospecha a confirmar / descartar / evaluar / no confirmada
  const unconfirmedSuspicionPatterns = [
    /\bsospecha\s+de\s+(?:posible\s+)?(recidiva|progresion|recaida|recurrencia|recurrente)\b(?:[\s\w]*)\b(?:a\s+(?:confirmar|descartar|evaluar|estudiar)|pendiente\s+de\s+confirmaci[oó]n|en\s+estudio|no\s+confirmada?|a\s+determinar)\b/,
    /\b(?:a\s+(?:confirmar|descartar|evaluar)|pendiente\s+de\s+confirmaci[oó]n|en\s+estudio)\b(?:[\s\w]*)\b(?:sospecha\s+de\s+)?(recidiva|progresion|recaida|recurrencia|recurrente)\b/
  ];

  for (const p of unconfirmedSuspicionPatterns) {
    if (p.test(norm)) return true;
  }

  // 4. Contextos de control por / de sospecha, seguimiento, vigilancia o evaluación de riesgo
  const surveillancePatterns = [
    /\b(?:control|seguimiento|vigilancia|evaluacion)\b(?:[\s\w]*)\b(?:por|de|ante)\b(?:[\s\w]*)\b(?:sospecha\s+de\s+)?(recidiva|progresion|recaida|recurrencia|recurrente)\b/,
    /\b(?:control|seguimiento|vigilancia|deteccion|prevencion|profilaxis)\b(?:[\s\w]*)\b(?:de|para|por)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/,
    /\briesgo\b(?:[\s\w]*)\b(?:de)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/,
    /\bscore\s+de\s+(?:recidiva|recaida|progresion|recurrencia)\b/,
    /\bevaluar\b(?:[\s\w]*)\b(?:posible|sospecha\s+de)?\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/
  ];

  for (const p of surveillancePatterns) {
    if (p.test(norm)) return true;
  }

  // 5. Screening / pesquisa / tamizaje combinado con normalidad o sin hallazgos
  const isScreening = /\b(?:screening|tamizaje|pesquisa)\b(?:[\s\w]*)\b(?:de|para)?\b(?:[\s\w]*)\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/.test(norm);
  const hasNegativeFindings = /\b(?:sin\s+hallazgos|sin\s+particularidades|sin\s+lesion\w*|negativ[ao]|normal\w*|conservad\w*|s\s+p)\b/.test(norm);
  if (isScreening && hasNegativeFindings) {
    return true;
  }

  // Cláusula donde se menciona recidiva/recurrencia pero concluye sin hallazgos patológicos o negativos
  if (/\b(recidiva|progresion|recaida|recurrencia|recurrente)\b/.test(norm) && hasNegativeFindings) {
    return true;
  }

  return false;
}

/**
 * Detecta si el texto documenta una progresión o recidiva real confirmada (excluyendo negaciones y controles de rutina)
 */
export function detectConfirmedProgression(text: string): boolean {
  const norm = normalizeStr(text);
  const keywords = [
    'recidiva',
    'progresion',
    'recaida',
    'recurrencia',
    'recurrente',
    'enfermedad progresiva',
    'crecimiento tumoral',
    'progresion bioquimica',
    'recidiva bioquimica',
    'recurrencia bioquimica',
    'ca 125 en ascenso',
    'ascenso de ca 125',
    'elevacion de ca 125',
    'aumento de ca 125',
    'ca 125 elevado',
    'ca 125 en aumento',
    'platino sensible',
    'platino resistente',
    'platino refractario',
    'sensible al platino',
    'resistente al platino',
    'refractario al platino'
  ];

  const hasAnyKeyword = keywords.some(k => norm.includes(k));
  if (!hasAnyKeyword) return false;

  const clauses = text.split(/[\n.;]+/).map(c => c.trim()).filter(Boolean);
  let confirmedCount = 0;

  for (const clause of clauses) {
    const normClause = normalizeStr(clause);
    const mentionsProgression = keywords.some(k => normClause.includes(k));
    if (!mentionsProgression) continue;

    if (isProgressionMentionNegatedOrSurveillance(clause)) {
      continue;
    }

    const affirmativePatterns = [
      /\b(?:recidiva|progresion|recaida|recurrencia)\s+(?:confirmada|documentada|evidente|tumoral|locorregional|local|a\s+distancia|ganglionar|hepatica|peritoneal|anastomotica|en\s+lecho|clinica|radiologica|bioquimica|pelvica|platino\s+sensible|platino\s+resistente|platino\s+refractaria?)\b/,
      /\b(?:se\s+constata|se\s+confirma|se\s+documenta|se\s+aprecia|presenta|evidencia|muestra)\s+(?:franca\s+|nueva\s+)?(?:recidiva|progresion|recaida|recurrencia)\b/,
      /\benfermedad\s+(?:en\s+progresion|progresiva|recurrente)\b/,
      /\b(?:progresion|recidiva|recurrencia)\s+(?:de\s+enfermedad|por\s+recist|segun\s+recist|objetiva|bioquimica|radiologica|tomografica)\b/,
      /\b(?:aparicion\s+de|nuevas?)\s+(?:lesion\w*|metastasis|implantes?)\b/,
      /\b(?:platino\s+sensible|platino\s+resistente|platino\s+refractari[ao]|sensible\s+al\s+platino|resistente\s+al\s+platino|refractari[ao]\s+al\s+platino)\b/,
      /\b(?:ca\s*125\s+(?:en\s+ascenso|en\s+aumento|elevado)|ascenso\s+de\s+ca\s*125|elevaci[oó]n\s+de\s+ca\s*125|aumento\s+de\s+ca\s*125)\b/,
      /\b(?:recurrencia\s+tumoral|tumor\s+recurrente)\b/
    ];

    const isExplicitlyAffirmative = affirmativePatterns.some(p => p.test(normClause));
    if (isExplicitlyAffirmative) {
      confirmedCount++;
    } else if (/\b(recidiva|progresion|recaida|recurrencia|recurrente|platino\s+sensible|platino\s+resistente|platino\s+refractari[ao]|ca\s*125\s+en\s+ascenso|elevacion\s+de\s+ca\s*125|ascenso\s+de\s+ca\s*125)\b/.test(normClause)) {
      confirmedCount++;
    }
  }

  return confirmedCount > 0;
}

/**
 * Análisis robusto de Tratamiento Sistémico Activo vs Pasado / Adyuvancia Completada / En Seguimiento
 */
export function detectTreatmentStatus(text: string): {
  detectedRegimen: string;
  isTreatmentCompletedOrPast: boolean;
  hasActiveOngoingTreatment: boolean;
  hasActiveSystemicTreatment: boolean;
  activeTreatment: string;
} {
  const norm = normalizeStr(text);

  const activeRegimens = [
    'folfirinox', 'nab paclitaxel', 'panitumumab', 'pembrolizumab', 'ipilimumab',
    'folfox', 'folfiri', 'capox', 'xelox', 'bevacizumab', 'cetuximab',
    'nivolumab', 'gemcitabina', 'cisplatino', 'carboplatino', 'paclitaxel',
    'pemetrexed', 'osimertinib', 'alectinib', 'trastuzumab', 'pertuzumab', 't dxd', 't dm1', 'tamoxifeno',
    'anastrozol', 'letrozol', 'fulvestrant', 'ribociclib', 'palbociclib', 'abemaciclib', 'enzalutamida',
    'abiraterona', 'docetaxel', 'cabazitaxel', 'irinotecan', 'oxaliplatino', 'capecitabina', '5 fu'
  ];

  let detectedRegimen = '';
  for (const reg of activeRegimens) {
    if (norm.includes(reg)) {
      detectedRegimen = reg.toUpperCase();
      break;
    }
  }

  const hasActiveOngoingTreatment = [
    /en\s+tratamiento\s+(?:activo|actual|con|paliativo|sistemico)/,
    /recibe\s+actualmente/,
    /actualmente\s+recibe/,
    /actualmente\s+(?:en\s+tratamiento|bajo\s+tratamiento)/,
    /esquema\s+actual/,
    /quimioterapia\s+activa/,
    /(?:tratamiento|quimioterapia|esquema|ciclo|infusi[oó]n|terapia)\s+en\s+curso/,
    /inicia\s+(?:primera\s+|segunda\s+|linea|ciclo|tratamiento)/,
    /mantenimiento\s+con/
  ].some(p => p.test(norm));

  const isTreatmentCompletedOrPast = !hasActiveOngoingTreatment && [
    /adyuvancia\s+(?:finalizada|completada|cumplida|realizada)/,
    /quimioterapia\s+(?:adyuvante\s+)?(?:finalizada|completada|cumplida|realizada)/,
    /tratamiento\s+(?:adyuvante\s+)?(?:finalizado|completado|cumplido|realizado)/,
    /completo\s+(?:adyuvancia|quimioterapia|tratamiento|esquema|ciclos?)/,
    /cumplio\s+(?:adyuvancia|quimioterapia|tratamiento|esquema|ciclos?)/,
    /finalizo\s+(?:adyuvancia|quimioterapia|tratamiento|esquema|ciclos?)/,
    /realizo\s+(?:adyuvancia|quimioterapia|tratamiento|esquema|ciclos?)/,
    /recibio\s+(?:adyuvancia|quimioterapia|tratamiento|esquema|ciclos?)/,
    /hizo\s+(?:adyuvancia|quimioterapia|tratamiento|esquema|ciclos?)/,
    /post\s+(?:adyuvancia|quimioterapia|folfox|folfirinox|tratamiento)/,
    /antecedente\s+de\s+(?:quimioterapia|adyuvancia|folfox|folfirinox|tratamiento)/,
    /en\s+seguimiento(?:\s+oncol[oó]gico|\s+postoperatorio|\s+postquir[uú]rgico|\s+post)?/,
    /en\s+vigilancia(?:\s+oncol[oó]gico)?/,
    /en\s+controles?(?:\s+oncol[oó]gicos?)?/,
    /actualmente\s+en\s+seguimiento/,
    /sin\s+tratamiento(?:\s+activo|\s+oncologico\s+activo|\s+actual)?/,
    /no\s+recibe\s+tratamiento/
  ].some(p => p.test(norm));

  const hasActiveSystemicTreatment = hasActiveOngoingTreatment || (!isTreatmentCompletedOrPast && (detectedRegimen !== ''));

  let activeTreatment = 'Sin tratamiento sistémico activo';
  if (hasActiveSystemicTreatment) {
    activeTreatment = detectedRegimen ? `Tratamiento sistémico activo (${detectedRegimen})` : 'Tratamiento sistémico activo';
  } else if (isTreatmentCompletedOrPast) {
    activeTreatment = detectedRegimen
      ? `Tratamiento adyuvante completado (${detectedRegimen}) — En seguimiento`
      : 'Tratamiento completado / Sin tratamiento activo (En seguimiento)';
  }

  return {
    detectedRegimen,
    isTreatmentCompletedOrPast,
    hasActiveOngoingTreatment,
    hasActiveSystemicTreatment,
    activeTreatment
  };
}

/**
 * Detección robusta de Estadio IV / Enfermedad Metastásica
 * Protege contra negaciones habituales en informes de seguimiento (ej: "sin metástasis hepáticas", "M0").
 */
export function detectStageIV(clinicalText: string, explicitDiagnosis: string = ''): boolean {
  const normDx = normalizeStr(explicitDiagnosis || '');

  // 1. Diagnóstico explícito de Estadio IV
  const isDxStageIV =
    /\b(?:estadio\s+(?:iv|4)|stage\s+(?:iv|4)|m1[a-c]?)\b/.test(normDx) ||
    normDx.includes('metastasico') || normDx.includes('metastasis');
  if (isDxStageIV) return true;

  // 2. Si el diagnóstico explícitamente es M0 o estadios localizados (I, II, III)
  const isExplicitNonMetastaticDx =
    /\b(?:m0|estadio\s+(?:i|ii|iii|1|2|3)|stage\s+(?:i|ii|iii|1|2|3))\b/.test(normDx);

  // 3. Revisión en el texto clínico evaluando cláusulas y negaciones
  const clauses = clinicalText.split(/[\n.;]+/).map(c => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    const normClause = normalizeStr(clause);

    // Si la cláusula es de negación de metástasis, descartarla
    const isNegated =
      /\bsin\b(?:[\s\w]*)\b(?:metastasis|diseminacion|implantes?|carcinomatosis)\b/.test(normClause) ||
      /\bno\b(?:[\s\w]*)\b(?:se observa\w*|se evidencia\w*|se aprecia\w*|se identifica\w*|presenta|hay)\b(?:[\s\w]*)\b(?:metastasis|diseminacion|implantes?|carcinomatosis)\b/.test(normClause) ||
      /\b(?:ausencia\s+de|libre\s+de|descartar|descartando|se\s+descarta|negativ[ao]s?\s+para)\b(?:[\s\w]*)\b(?:metastasis|diseminacion|implantes?|carcinomatosis)\b/.test(normClause);
    if (isNegated) continue;

    // Patrones de estadio IV en la cláusula afirmativa
    const matchesMetastaticClause =
      /\b(?:estadio\s+(?:iv|4)|stage\s+(?:iv|4)|m1[a-c]?)\b/.test(normClause) ||
      normClause.includes('carcinomatosis') ||
      normClause.includes('implantes peritoneales') ||
      normClause.includes('diseminacion a distancia') ||
      normClause.includes('enfermedad metastasica') ||
      normClause.includes('metastasis hepaticas') ||
      normClause.includes('metastasis pulmonares') ||
      normClause.includes('metastasico');

    if (matchesMetastaticClause) {
      if (!isExplicitNonMetastaticDx || normClause.includes('carcinomatosis') || normClause.includes('enfermedad metastasica') || /\bm1[a-c]?\b/.test(normClause)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detecta la estirpe histológica a partir de un texto respetando límites de palabra y contexto clínico.
 */
export function detectHistologyFromText(text: string, organ: string): string | null {
  const norm = normalizeStr(text);
  if (!norm) return null;

  // 1. Tumores Neuroendocrinos
  if (/\b(?:neuroendocrin\w*|tne|pnet|carcinoide|net\s+g[1-3])\b/.test(norm)) {
    return 'Tumor neuroendocrino (TNE / NET)';
  }

  // 2. Patología Trofoblástica Gestacional (GTN / Mola)
  if (/\bcoriocarcinoma\s+gestacional\b/.test(norm) || (/\bcoriocarcinoma\b/.test(norm) && organ !== 'Testículo')) {
    return 'Coriocarcinoma gestacional';
  }
  if (/\b(?:mola\s+hidat(?:id)?iforme\s+completa|mola\s+completa)\b/.test(norm)) {
    return 'Mola hidatiforme completa';
  }
  if (/\b(?:mola\s+hidat(?:id)?iforme\s+parcial|mola\s+parcial)\b/.test(norm)) {
    return 'Mola hidatiforme parcial';
  }
  if (/\bmola\s+invasora\b/.test(norm)) {
    return 'Mola invasora';
  }
  if (/\bmola\s+hidat(?:id)?iforme\b/.test(norm) || (/\bmola\b/.test(norm) && (organ === 'Trofoblasto gestacional (Útero)' || /\b(?:embarazo|gestacion\w*|trofoblast\w*|vesicul\w*|evacuacion)\b/.test(norm)))) {
    return 'Mola hidatiforme';
  }
  if (/\btumor\s+trofoblastico\s+del\s+sitio\s+placentario\b/.test(norm) || /\bpstt\b/.test(norm)) {
    return 'Tumor trofoblástico del sitio placentario';
  }
  if (/\btumor\s+trofoblastico\s+epitelioide\b/.test(norm) || /\bett\b/.test(norm)) {
    return 'Tumor trofoblástico epitelioide';
  }
  if (/\b(?:neoplasia\s+trofoblastica\s+gestacional|enfermedad\s+trofoblastica\s+gestacional|gtn)\b/.test(norm)) {
    return 'Neoplasia trofoblástica gestacional';
  }

  // 3. Carcinoma Epidermoide / Escamoso / Escamocelular
  if (/\b(?:carcinoma\s+epidermoide|carcinoma\s+escamoso|carcinoma\s+espinocelular|carcinoma\s+escamocelular|escamocelular)\b/.test(norm)) {
    if (organ === 'Cuello uterino (Cérvix)') return 'Carcinoma epidermoide de cérvix';
    if (organ === 'Piel') return 'Carcinoma espinocelular cutáneo';
    if (organ === 'Pulmón') return 'Carcinoma epidermoide de pulmón (NSCLC)';
    return 'Carcinoma epidermoide / escamoso';
  }

  // 4. Adenocarcinoma Ductal
  if (/\badenocarcinoma\s+ductal\b/.test(norm) || (/\badenocarcinoma\b/.test(norm) && /\bductal\b/.test(norm))) {
    return organ === 'Páncreas' ? 'Adenocarcinoma ductal de páncreas' : 'Adenocarcinoma ductal';
  }

  // 5. Adenocarcinoma por órgano
  if (/\badenocarcinoma\b/.test(norm)) {
    if (organ === 'Colon') {
      if (norm.includes('mucinoso')) return 'Adenocarcinoma mucinoso de colon';
      if (norm.includes('colorrectal') || norm.includes('colorectal')) return 'Adenocarcinoma colorrectal';
      return 'Adenocarcinoma de colon';
    }
    if (organ === 'Páncreas') return 'Adenocarcinoma de páncreas';
    if (organ === 'Recto') return 'Adenocarcinoma de recto';
    if (organ === 'Próstata') return 'Adenocarcinoma de próstata';
    if (organ === 'Estómago') return 'Adenocarcinoma gástrico';
    if (organ === 'Endometrio / Útero') return 'Adenocarcinoma endometrioide';
    if (organ === 'Cuello uterino (Cérvix)') return 'Adenocarcinoma de cérvix';
    if (organ === 'Ovario') return 'Adenocarcinoma de ovario';
    if (organ === 'Pulmón') return 'Adenocarcinoma de pulmón';
    return 'Adenocarcinoma';
  }

  // 6. Otras estirpes específicas
  if (/\b(?:microcitico|celulas\s+pequenas|sclc)\b/.test(norm)) {
    return 'Carcinoma microcítico (SCLC)';
  }
  if (/\b(?:celulas\s+no\s+pequenas|nsclc)\b/.test(norm)) {
    return 'Carcinoma de células no pequeñas (NSCLC)';
  }
  if (/\b(?:basocelular|bcc)\b/.test(norm)) {
    return 'Carcinoma basocelular';
  }
  if (/\bmelanoma\b/.test(norm)) {
    return 'Melanoma';
  }
  if (/\bseminoma\b/.test(norm)) {
    return 'Seminoma';
  }
  if (/\b(?:urotelial|transicional)\b/.test(norm)) {
    return 'Carcinoma urotelial';
  }
  if (/\bcelulas\s+claras\b/.test(norm)) {
    return organ === 'Riñón' ? 'Carcinoma de células claras de riñon' : 'Carcinoma de células claras';
  }
  if (/\bseroso\b/.test(norm)) {
    return organ === 'Ovario' ? 'Carcinoma seroso de alto grado' : 'Carcinoma seroso';
  }

  return null;
}

/**
 * Detecta de forma estructurada síntomas de alarma o sospecha relevantes para el seguimiento oncológico,
 * respetando estrictamente las negaciones clínicas (ej. "niega genitorragia", "sin dolor lumbar").
 */
export function detectRelevantSymptoms(text: string): { symptomFlag: boolean; relevantSymptoms: string[] } {
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clauses = norm.split(/[\n.;]+/).map(c => c.trim()).filter(Boolean);
  const detected = new Set<string>();

  const symptomDefinitions = [
    {
      name: 'Dolor pélvico',
      regex: /\b(?:dolor|molestia)\b[\s\w]*?\b(?:pelvis|pelvic\w*|pelvian\w*)\b|\bpelvalgia\b/,
    },
    {
      name: 'Dolor lumbar',
      regex: /\b(?:dolor|molestia)\b[\s\w]*?\b(?:lumbar\w*|lumbarg\w*)\b|\blumbalgia\b/,
    },
    {
      name: 'Dolor en miembros inferiores',
      regex: /\b(?:dolor|molestia)\b[\s\w]*?\b(?:miembros\s+inferiores|mmii|piernas|ciatic\w*)\b/,
    },
    {
      name: 'Edema de miembros inferiores',
      regex: /\bedema\b[\s\w]*?\b(?:miembros\s+inferiores|mmii|piernas|unilateral)\b/,
    },
    {
      name: 'Genitorragia / Sangrado vaginal',
      regex: /\b(?:genitorragia|metrorragia|sangrado\s+vaginal|sangrado\s+uterino|ginecrorragia)\b/,
    },
    {
      name: 'Síntomas urinarios',
      regex: /\b(?:hematuria|disuria|polaquiuria|sintomas\s+urinarios|alteraciones\s+urinarias|fistula\s+vesic\w*)\b/,
    },
    {
      name: 'Síntomas intestinales / rectales',
      regex: /\b(?:rectorragia|tenesmo|alteraciones\s+intestinales|sintomas\s+intestinales|fistula\s+recto\w*)\b/,
    },
  ];

  for (const clause of clauses) {
    for (const s of symptomDefinitions) {
      if (s.regex.test(clause)) {
        const isNegated =
          /\b(?:niega|sin|no\s+presenta|no\s+refiere|no\s+se\s+observa|ausencia\s+de|libre\s+de|descartad[ao]s?)\b/i.test(clause) &&
          new RegExp(`(?:niega|sin|no\\s+presenta|no\\s+refiere|no\\s+se\\s+observa|ausencia\\s+de|libre\\s+de|descartad[ao]s?)[\\s\\w]*?(?:${s.regex.source})`, 'i').test(clause);

        if (!isNegated) {
          detected.add(s.name);
        }
      }
    }
  }

  return {
    symptomFlag: detected.size > 0,
    relevantSymptoms: Array.from(detected),
  };
}

/**
 * Detecta estudios solicitados o pendientes de realización documentados en la historia clínica.
 */
export function detectPendingStudies(text: string): PendingStudy[] {
  const clauses = text.split(/[\n.;]+/).map(c => c.trim()).filter(Boolean);
  const studies: PendingStudy[] = [];
  const seen = new Set<string>();

  for (const clause of clauses) {
    const cNorm = clause.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // PET-CT
    if (/\b(?:pet|pet-ct|pet-tc)\b/.test(cNorm)) {
      const isPending = /\b(?:pendiente|programad[ao]|a\s+realizar)\b/.test(cNorm);
      const isRequested = /\b(?:solicitad[ao]|se\s+solicita|solicitar|pedido\s+de)\b/.test(cNorm);
      if (isPending || isRequested) {
        const key = 'PET-CT';
        if (!seen.has(key)) {
          seen.add(key);
          studies.push({
            type: 'imaging',
            study: 'PET-CT',
            status: isPending ? 'pending' : 'requested',
            reason: 'Control post-tratamiento',
          });
        }
      }
    }

    // RMN de pelvis / RM
    if (/\b(?:rmn|rm|resonancia)\b/.test(cNorm)) {
      const isPelvis = /\b(?:pelvis|pelvic\w*)\b/.test(cNorm);
      const isPending = /\b(?:pendiente|programad[ao]|a\s+realizar)\b/.test(cNorm);
      const isRequested = /\b(?:solicitad[ao]|se\s+solicita|solicitar|pedido\s+de)\b/.test(cNorm);
      if (isPending || isRequested) {
        const studyName = isPelvis ? 'RMN de pelvis' : 'RMN';
        const key = studyName;
        if (!seen.has(key)) {
          seen.add(key);
          studies.push({
            type: 'imaging',
            study: studyName,
            status: isRequested ? 'requested' : 'pending',
            reason: 'Evaluación post-tratamiento',
          });
        }
      }
    }

    // TAC
    if (/\b(?:tac|tc|tomografia)\b/.test(cNorm) && !/\b(?:pet-ct|pet-tc)\b/.test(cNorm)) {
      const isPending = /\b(?:pendiente|programad[ao]|a\s+realizar)\b/.test(cNorm);
      const isRequested = /\b(?:solicitad[ao]|se\s+solicita|solicitar|pedido\s+de)\b/.test(cNorm);
      if (isPending || isRequested) {
        const key = 'TAC';
        if (!seen.has(key)) {
          seen.add(key);
          studies.push({
            type: 'imaging',
            study: 'TAC',
            status: isRequested ? 'requested' : 'pending',
            reason: 'Control post-tratamiento',
          });
        }
      }
    }

    // Laboratorio de control
    if (/\b(?:laboratorio|analisis|hemograma)\b/.test(cNorm)) {
      const isPending = /\b(?:pendiente|programad[ao]|a\s+realizar)\b/.test(cNorm);
      const isRequested = /\b(?:solicitad[ao]|se\s+solicita|solicitar|pedido\s+de)\b/.test(cNorm);
      if (isPending || isRequested) {
        const key = 'Laboratorio';
        if (!seen.has(key)) {
          seen.add(key);
          studies.push({
            type: 'laboratory',
            study: 'Laboratorio de control',
            status: isRequested ? 'requested' : 'pending',
            reason: 'Control post-tratamiento',
          });
        }
      }
    }
  }

  return studies;
}

/**
 * Extrae la fecha de finalización del tratamiento oncológico definitivo completo
 * (ej. quimioterapia, radioterapia externa, braquiterapia), seleccionando la fecha cronológicamente más reciente.
 */
export function extractLastTreatmentDate(clinicalText: string): string {
  const lines = clinicalText.split('\n');
  const foundDates: { dateStr: string; timestamp: number }[] = [];

  const parseDate = (dStr: string): number | null => {
    const m = dStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day).getTime();
  };

  for (const line of lines) {
    const lNorm = line.toLowerCase();
    const isTxLine =
      lNorm.includes('tratamiento') ||
      lNorm.includes('quimioterapia') ||
      lNorm.includes('radioterapia') ||
      lNorm.includes('braquiterapia') ||
      lNorm.includes('cirugia') ||
      lNorm.includes('vmat') ||
      lNorm.includes('hdr') ||
      lNorm.includes('finalizad') ||
      lNorm.includes('completad') ||
      lNorm.includes('ciclo') ||
      lNorm.includes('adyuvancia');

    if (isTxLine) {
      const dateMatches = Array.from(line.matchAll(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g));
      for (const dm of dateMatches) {
        const dStr = dm[1];
        const ts = parseDate(dStr);
        if (ts) {
          foundDates.push({ dateStr: dStr, timestamp: ts });
        }
      }
    }
  }

  if (foundDates.length > 0) {
    foundDates.sort((a, b) => b.timestamp - a.timestamp);
    return foundDates[0].dateStr;
  }

  return 'No documentada';
}

/**
 * Extrae la fecha del último estudio de imagen efectivamente REALIZADO (excluyendo estudios pendientes o solicitados).
 */
export function extractLastImagingDate(clinicalText: string): string {
  const lines = clinicalText.split('\n');
  const foundDates: { dateStr: string; timestamp: number }[] = [];

  const parseDate = (dStr: string): number | null => {
    const m = dStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day).getTime();
  };

  for (const line of lines) {
    const lNorm = line.toLowerCase();
    if (
      lNorm.includes('pendiente') ||
      lNorm.includes('solicitar') ||
      lNorm.includes('se solicita') ||
      lNorm.includes('solicitada') ||
      lNorm.includes('solicitado') ||
      lNorm.includes('pedido')
    ) {
      continue;
    }

    const isImagingLine =
      lNorm.includes('tac') ||
      lNorm.includes('tc') ||
      lNorm.includes('tomografia') ||
      lNorm.includes('rm') ||
      lNorm.includes('rmn') ||
      lNorm.includes('resonancia') ||
      lNorm.includes('pet') ||
      lNorm.includes('pet-ct') ||
      lNorm.includes('pet-tc') ||
      lNorm.includes('ecografia');

    if (isImagingLine) {
      const dateMatches = Array.from(line.matchAll(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g));
      for (const dm of dateMatches) {
        const dStr = dm[1];
        const ts = parseDate(dStr);
        if (ts) {
          foundDates.push({ dateStr: dStr, timestamp: ts });
        }
      }
    }
  }

  if (foundDates.length > 0) {
    foundDates.sort((a, b) => b.timestamp - a.timestamp);
    return foundDates[0].dateStr;
  }

  return 'No documentada';
}

/**
 * Extrae el estadio tumoral a partir del texto clínico y del diagnóstico explícito,
 * exigiendo contexto clínico riguroso (FIGO, Estadio/Stage, TNM) y evitando
 * falsas capturas de letras dentro de palabras (ej. "cérvix" -> "vix").
 */
export function extractStageFromClinicalText(clinicalText: string, explicitDiagnosis: string = ''): string {
  const combined = `${explicitDiagnosis} ${clinicalText}`;

  // 1. Patrones explícitos de FIGO (ej: FIGO IIIC2, FIGO IIIC, FIGO II, FIGO IB1, FIGO IA, FIGO IVB)
  const figoRegex = /\bFIGO\s+(?:(?:I[VX]|V?I{1,3}|[1-4])[A-C]?[1-3]?)\b/gi;
  const figoMatches = Array.from(combined.matchAll(figoRegex));
  if (figoMatches.length > 0) {
    const sorted = figoMatches.map(m => m[0].trim()).sort((a, b) => b.length - a.length);
    return sorted[0];
  }

  // 2. Patrones explícitos de Estadio / Stage / Etapa (ej: Estadio IIIC, Estadio II, Estadio IA, Stage IV, Stage IIIC, Estadio 3, Stage 4B)
  const explicitStageRegex = /\b(?:estadio|stage|etapa)\s+(?:(?:I[VX]|V?I{1,3}|IV|III|II|I|0|[0-4])[A-C]?[1-3]?)\b/gi;
  const explicitMatches = Array.from(combined.matchAll(explicitStageRegex));
  if (explicitMatches.length > 0) {
    const sorted = explicitMatches.map(m => m[0].trim()).sort((a, b) => b.length - a.length);
    return sorted[0];
  }

  // 3. Patrones estructurados de TNM (ej: pT2 pN1 M0, pT2N1M0, cT3N2M0, ypT2N1M0, T1bN0M0, T3 N1 M0)
  const tnmFullRegex = /\b(?:(?:[pcy]|yp|yc)T[0-4][a-d]?(?:is)?(?:\s*[pcy]?N[0-3][a-c]?)?(?:\s*[pcy]?M[0-1][a-c]?)?|T[0-4][a-d]?(?:is)?\s*[pcy]?N[0-3][a-c]?(?:\s*[pcy]?M[0-1][a-c]?)?)\b/i;
  const tnmMatch = combined.match(tnmFullRegex);
  if (tnmMatch) {
    return tnmMatch[0].trim();
  }

  return 'No documentado';
}

/**
 * Extrae el perfil tumoral ancla del paciente a partir de su diagnóstico explícito
 * y/o de la historia clínica patológica, anclando al diagnóstico principal y
 * filtrando menciones incidentales o hallazgos normales de otros órganos.
 */
export function extractPatientTumorProfile(clinicalText: string, explicitDiagnosis: string = ''): PatientTumorProfile {
  const normDx = normalizeStr(explicitDiagnosis || '');
  const normText = normalizeStr(clinicalText || '');

  // 0. PRIORIDAD ABSOLUTA: Diagnósticos fuera de la cobertura del sistema (CSPD/CUP)
  const unsupported = detectUnsupportedDiagnosis(clinicalText, explicitDiagnosis);
  if (unsupported) {
    const organ = unsupported.organLabel;
    const histology = unsupported.histologyLabel;
    return {
      organ,
      histology,
      subtype: histology,
      stage: 'No documentado',
      margin: 'No especificado',
      clinicalStatus: 'En evaluación',
      treatment: 'No documentado',
      surgeryDate: 'No documentada',
      isHistologyIncomplete: false,
      summary: `${organ} — ${histology}`,
      isStageIV: false,
      diseaseStatus: 'INDETERMINATE',
      diseaseStatusDescription: 'Diagnóstico fuera de la cobertura de guías NCCN cargadas en el sistema.',
      followUpMode: 'INDETERMINATE_STATUS',
      modeLabel: 'Sin escenario aplicable / Diagnóstico no soportado',
      activeTreatment: 'No documentado',
      hasActiveSystemicTreatment: false,
      treatmentIntent: 'No determinado',
      lastImagingDate: 'No documentada',
      lastTreatmentDate: 'No documentada'
    };
  }

  // 1. Detección prioritaria de órgano anclada al diagnóstico principal
  let organ = 'Desconocido / No identificado';
  let isHistologyIncomplete = false;

  // Helper de compatibilidad interna
  const detectOrganFromStr = (str: string): string => {
    const unsup = detectUnsupportedDiagnosis(str);
    if (unsup) return unsup.organLabel;
    const detected = detectCandidateOrgans(str);
    if (detected.length === 1) return detected[0];
    if (detected.length > 1) return `Órgano ambiguo / No concluyente (${detected.join(', ')})`;
    return '';
  };

  // Nivel 1: Diagnóstico estructurado explícito (prioridad absoluta)
  if (normDx) {
    const dxOrgans = detectCandidateOrgans(normDx, true);
    if (dxOrgans.length === 1) {
      organ = dxOrgans[0];
    } else if (dxOrgans.length > 1) {
      organ = `Órgano ambiguo / No concluyente (${dxOrgans.join(', ')})`;
      isHistologyIncomplete = true;
    }
  }

  // Nivel 2: Encabezados diagnósticos explícitos en el texto clínico
  if (organ === 'Desconocido / No identificado') {
    const dxHeaderRegex = /(?:diagn[oó]stico(?:[\s\w]*)|anatom[ií]a\s+patol[oó]gica|informe\s+anatomopatol[oó]gico|biopsia(?:[\s\w]*)|ap|tumor\s+primario|juicio\s+cl[ií]nico|impresi[oó]n\s+diagn[oó]stica)[\s:]+([^\n.;]+)/gi;
    const headerOrgans = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = dxHeaderRegex.exec(clinicalText)) !== null) {
      const snippet = match[1];
      const detected = detectCandidateOrgans(snippet, true);
      detected.forEach(o => headerOrgans.add(o));
    }

    if (headerOrgans.has('Trofoblasto gestacional (Útero)') && headerOrgans.has('Endometrio / Útero')) {
      headerOrgans.delete('Endometrio / Útero');
    }

    const headerOrgansArr = Array.from(headerOrgans);
    if (headerOrgansArr.length === 1) {
      organ = headerOrgansArr[0];
    } else if (headerOrgansArr.length > 1) {
      organ = `Órgano ambiguo / No concluyente (${headerOrgansArr.join(', ')})`;
      isHistologyIncomplete = true;
    }
  }

  // Nivel 3: Filtrado en texto completo (omitiendo menciones de normalidad, incidentales o exclusiones)
  if (organ === 'Desconocido / No identificado') {
    const clauses = clinicalText.split(/[\n.;]+/).map(c => c.trim()).filter(Boolean);
    const activeOrgans = new Set<string>();

    for (const def of ORGAN_DEFINITIONS) {
      for (const clause of clauses) {
        const normClause = normalizeStr(clause);
        let clauseMatches = false;
        if (def.check) {
          clauseMatches = def.check(normClause);
        } else if (def.regex) {
          clauseMatches = def.regex.test(normClause);
        }

        if (clauseMatches) {
          if (def.regex && isOrganMentionIncidental(clause, def.regex)) {
            continue;
          }
          activeOrgans.add(def.organ);
        }
      }
    }

    if (activeOrgans.has('Trofoblasto gestacional (Útero)') && activeOrgans.has('Endometrio / Útero')) {
      activeOrgans.delete('Endometrio / Útero');
    }

    const activeArr = Array.from(activeOrgans);
    if (activeArr.length === 1) {
      organ = activeArr[0];
    } else if (activeArr.length > 1) {
      organ = `Órgano ambiguo / No concluyente (${activeArr.join(', ')})`;
      isHistologyIncomplete = true;
    }
  }

  // 2. Detección de estirpe histológica con jerarquía estricta
  let histology = 'No especificada / Pendiente de confirmación';

  // Nivel 1: Diagnóstico estructurado explícito (prioridad absoluta)
  if (explicitDiagnosis) {
    const detected = detectHistologyFromText(explicitDiagnosis, organ);
    if (detected) {
      histology = detected;
    }
  }

  // Nivel 2: Encabezados diagnósticos explícitos en el texto clínico
  if (histology === 'No especificada / Pendiente de confirmación') {
    const dxHeaderRegex = /(?:diagn[oó]stico(?:[\s\w]*)|anatom[ií]a\s+patol[oó]gica|informe\s+anatomopatol[oó]gico|biopsia(?:[\s\w]*)|ap|tumor\s+primario|juicio\s+cl[ií]nico|impresi[oó]n\s+diagn[oó]stica)[\s:]+([^\n.;]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = dxHeaderRegex.exec(clinicalText)) !== null) {
      const snippet = match[1];
      const detected = detectHistologyFromText(snippet, organ);
      if (detected) {
        histology = detected;
        break;
      }
    }
  }

  // Nivel 3: Filtrado en texto clínico completo
  if (histology === 'No especificada / Pendiente de confirmación') {
    const detected = detectHistologyFromText(clinicalText, organ);
    if (detected) {
      // Si se detectó mola o trofoblasto gestacional pero el órgano primario identificado no es trofoblasto,
      // no permitir que menciones incidentales desplacen el órgano primario
      if (detected.includes('Mola') || detected.includes('trofoblástic') || detected.includes('Coriocarcinoma')) {
        if (organ === 'Trofoblasto gestacional (Útero)' || organ === 'Desconocido / No identificado') {
          histology = detected;
        }
      } else {
        histology = detected;
      }
    }
  }

  // Nivel 4: Si el órgano es conocido y no ambiguo, asignar la estirpe estándar predominante según NCCN
  if (histology === 'No especificada / Pendiente de confirmación' && organ !== 'Desconocido / No identificado' && !organ.toLowerCase().includes('ambiguo')) {
    if (organ === 'Páncreas') histology = 'Adenocarcinoma de páncreas';
    else if (organ === 'Mama') histology = 'Carcinoma invasor de mama';
    else if (organ === 'Colon') histology = 'Adenocarcinoma de colon';
    else if (organ === 'Recto') histology = 'Adenocarcinoma de recto';
    else if (organ === 'Próstata') histology = 'Adenocarcinoma de próstata';
    else if (organ === 'Cuello uterino (Cérvix)') histology = 'Carcinoma epidermoide de cérvix';
    else if (organ === 'Endometrio / Útero') histology = 'Adenocarcinoma endometrioide';
    else if (organ === 'Ovario') histology = 'Carcinoma seroso de alto grado';
    else if (organ === 'Estómago') histology = 'Adenocarcinoma gástrico';
    else if (organ === 'Vejiga') histology = 'Carcinoma urotelial';
    else if (organ === 'Riñón') histology = 'Carcinoma de células claras de riñon';
    else if (organ === 'Testículo') histology = 'Seminoma';
    else if (organ === 'Pulmón') histology = 'Carcinoma de células no pequeñas (NSCLC)';
    else if (organ === 'Vías biliares / Vesícula') histology = 'Colangiocarcinoma / Adenocarcinoma biliar';
    else if (organ === 'Piel') histology = 'Carcinoma basocelular';
    else if (organ === 'Trofoblasto gestacional (Útero)') histology = 'Mola hidatiforme / Neoplasia trofoblástica gestacional';
  }

  // Detección de diagnóstico incompleto o ambiguo
  const combinedNorm = `${normDx} ${normText}`;
  if (
    organ.toLowerCase().includes('ambiguo') ||
    (organ === 'Desconocido / No identificado' &&
      (combinedNorm.includes('neoplasia') || combinedNorm.includes('tumor') || combinedNorm.includes('lesion') || combinedNorm.includes('masa')) &&
      histology === 'No especificada / Pendiente de confirmación')
  ) {
    isHistologyIncomplete = true;
  }

  // 3. Extracción de estadio
  const stage = extractStageFromClinicalText(clinicalText, explicitDiagnosis);

  // 4. Extracción de márgenes
  let margin = 'No especificado';
  if (normText.includes('r0') || normDx.includes('r0')) margin = 'R0 (Márgenes libres)';
  else if (normText.includes('r1') || normDx.includes('r1')) margin = 'R1 (Margen microscópico comprometido)';
  else if (normText.includes('r2') || normDx.includes('r2')) margin = 'R2 (Margen macroscópico comprometido)';

  // 5. Situación clínica
  let clinicalStatus = 'En evaluación';
  const hasConfirmedProg = detectConfirmedProgression(clinicalText);
  if (
    normText.includes('libre de enfermedad') ||
    normText.includes('ned') ||
    normText.includes('sin evidencia de enfermedad') ||
    normText.includes('remision completa') ||
    normText.includes('sin signos tomograficos de recidiva') ||
    normText.includes('sin signos de recidiva') ||
    normText.includes('sin recidiva')
  ) {
    clinicalStatus = 'Sin evidencia de enfermedad (NED / Remisión Completa)';
  } else if (hasConfirmedProg) {
    clinicalStatus = 'Progresión / Recidiva';
  } else if (normText.includes('respuesta parcial')) {
    clinicalStatus = 'Respuesta Parcial';
  } else if (normText.includes('enfermedad estable')) {
    clinicalStatus = 'Enfermedad Estable';
  } else if (
    normText.includes('postquirurgico') ||
    normText.includes('postoperatorio') ||
    normText.includes('resecado') ||
    normText.includes('postquirurgica') ||
    normText.includes('operada') ||
    normText.includes('operado') ||
    normText.includes('whipple') ||
    normText.includes('duodenopancreatectomia') ||
    normText.includes('colectomia')
  ) {
    clinicalStatus = 'Postquirúrgico / Postoperatorio';
  }

  // 6. Tratamiento
  let treatment = 'No documentado';
  const txProfile = detectTreatmentStatus(normText);
  if (txProfile.isTreatmentCompletedOrPast) {
    treatment = txProfile.detectedRegimen ? `Quimioterapia adyuvante finalizada (${txProfile.detectedRegimen})` : 'Quimioterapia adyuvante finalizada';
  } else if (txProfile.hasActiveOngoingTreatment || (normText.includes('adyuvancia') && !txProfile.isTreatmentCompletedOrPast)) {
    treatment = 'En tratamiento adyuvante';
  } else if (normText.includes('neoadyuvancia')) {
    treatment = 'Neoadyuvancia';
  }

  // 7. Fecha de cirugía
  let surgeryDate = 'No documentada';
  const surgeryMatch = clinicalText.match(/(?:cirug[ií]a|whipple|duodenopancreatectom[ií]a|colectom[ií]a|mastectom[ií]a|prostatectom[ií]a|histerectom[ií]a|lobectom[ií]a)[^\d]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (surgeryMatch && surgeryMatch[1]) {
    surgeryDate = surgeryMatch[1];
  }

  return {
    organ,
    histology,
    subtype: histology,
    stage,
    margin,
    clinicalStatus,
    treatment,
    surgeryDate,
    isHistologyIncomplete,
    summary: `${organ} — ${histology} (${stage})`,
    isStageIV: false,
    diseaseStatus: 'NED',
    diseaseStatusDescription: '',
    followUpMode: 'CURATIVE_SURVEILLANCE',
    followUpState: 'ROUTINE_SURVEILLANCE',
    modeLabel: '',
    activeTreatment: '',
    hasActiveSystemicTreatment: false,
    treatmentIntent: '',
    lastImagingDate: 'No documentada',
    lastTreatmentDate: 'No documentada',
    symptomFlag: false,
    relevantSymptoms: [],
    pendingStudies: [],
    confirmedRecurrence: false,
    confirmedProgression: false,
  };
}

/**
 * Extrae el perfil de escenario clínico profundo del paciente:
 * - Diagnóstico e Histología
 * - Estadio (Estadio IV vs Estadios I–III)
 * - Estado de Enfermedad Actual (NED vs Evaluación Post-Tratamiento vs Metastásico Activo vs Progresión)
 * - Estado de Seguimiento (followUpState: ROUTINE_SURVEILLANCE vs POST_TREATMENT_EVALUATION vs SYMPTOMATIC_REEVALUATION)
 * - Modo de Seguimiento (Modo A: Curativo Localizado vs Modo B: Metastásico Activo vs Modo C: Post-Metastasectomía)
 * - Síntomas de Alarma y Estudios Pendientes
 * - Tratamiento Activo y Respuesta
 * - Fechas Clave
 */
export function extractClinicalScenarioProfile(clinicalText: string, explicitDiagnosis: string = ''): ClinicalScenarioProfile {
  const normDx = normalizeStr(explicitDiagnosis || '');
  const normText = normalizeStr(clinicalText || '');
  const combined = `${normDx} ${normText}`;

  // 1. Perfil tumoral base
  const baseProfile = extractPatientTumorProfile(clinicalText, explicitDiagnosis);

  // Síntomas estructurados y estudios pendientes
  const { symptomFlag, relevantSymptoms } = detectRelevantSymptoms(clinicalText);
  const pendingStudies = detectPendingStudies(clinicalText);

  // Si el tumor está fuera de la cobertura de guías o no identificado, devolver perfil base bloqueado
  if (baseProfile.organ.includes('No cubierto') || baseProfile.organ === 'Desconocido / No identificado') {
    return {
      ...baseProfile,
      followUpMode: 'INDETERMINATE_STATUS',
      followUpState: 'UNDETERMINED',
      symptomFlag,
      relevantSymptoms,
      pendingStudies,
      confirmedRecurrence: false,
      confirmedProgression: false,
      modeLabel: 'Sin guía disponible para este diagnóstico',
      summary: `${baseProfile.organ} — ${baseProfile.histology} | Sin guía en el sistema`,
    };
  }

  // 2. Detección de Estadio IV / Enfermedad Metastásica
  const isStageIV = detectStageIV(clinicalText, explicitDiagnosis);

  // 3. Análisis de Tratamiento Sistémico Activo vs Finalizado
  const tx = detectTreatmentStatus(combined);
  const detectedRegimen = tx.detectedRegimen;
  const isTreatmentCompletedOrNone = tx.isTreatmentCompletedOrPast;
  const hasActiveSystemicTreatment = tx.hasActiveSystemicTreatment;
  const activeTreatment = tx.activeTreatment;

  // 4. Estado de Enfermedad, Metástasis y Negaciones Clínicas
  const hasProgression = detectConfirmedProgression(combined);
  const confirmedProgression = hasProgression;
  const confirmedRecurrence = hasProgression;

  const cleanedForActive = combined
    .replace(/sin (?:evidencia de |signos de )?(?:lesiones|metastasis|enfermedad activa)/g, ' ')
    .replace(/no presenta (?:lesiones|metastasis|enfermedad activa)/g, ' ')
    .replace(/sin lesiones activas/g, ' ');

  const hasActiveLesions = 
    cleanedForActive.includes('metastasis activas') || cleanedForActive.includes('enfermedad activa') ||
    cleanedForActive.includes('enfermedad medible') || cleanedForActive.includes('lesiones diana') ||
    cleanedForActive.includes('lesiones hepaticas activas') || cleanedForActive.includes('lesion residual') ||
    cleanedForActive.includes('metastasis hepaticas multiples') || cleanedForActive.includes('implantes peritoneales');

  const hasResectedMetastases = 
    (combined.includes('metastasectomia') || combined.includes('hepatectomia') || combined.includes('reseccion hepatica') || 
     combined.includes('metastasis resecada') || combined.includes('ablacion') || combined.includes('postmetastasectomia') ||
     combined.includes('metastasectomia r0') || combined.includes('reseccion de metastasis')) &&
    (combined.includes('r0') || combined.includes('completa') || combined.includes('resecadas') || combined.includes('ned'));

  const hasNED = 
    combined.includes('ned') || combined.includes('libre de enfermedad') || combined.includes('sin evidencia de enfermedad') ||
    combined.includes('remision completa') || combined.includes('sin lesiones activas') || combined.includes('sin recidiva') ||
    combined.includes('sin signos de recidiva') || combined.includes('sin signos tomograficos de recidiva') ||
    combined.includes('se descarta recidiva') || combined.includes('sin hallazgos patologicos') || combined.includes('sin hallazgos') ||
    combined.includes('sin recurrencia') || combined.includes('sin signos de recurrencia') || combined.includes('se descarta recurrencia') ||
    combined.includes('asintomatica') || combined.includes('asintomatico') ||
    (!hasProgression && (tx.isTreatmentCompletedOrPast || combined.includes('en seguimiento')));

  const hasPartialResponse = combined.includes('respuesta parcial') || combined.includes('reduccion tumoral');
  const hasStableDisease = combined.includes('enfermedad estable') || combined.includes('estabilidad lesional');

  // Distinción entre tratamiento quirúrgico vs tratamiento definitivo no quirúrgico
  const isSurgical = /\b(?:resecad[ao]|postquirurgic[ao]|postoperatori[ao]|operad[ao]|mastectom\w*|colectom\w*|histerectom\w*|duodenopancreatectom\w*|whipple|lobectom\w*|gastrectom\w*|nefrectom\w*|prostatectom\w*|citorreducci[oó]n|metastasectom\w*|resecci[oó]n)\b/i.test(combined);
  const isDefinitiveNonSurgical = !isSurgical && /\b(?:quimiorradioterapia|radioterapia|braquiterapia|rt\s+concurrente|vmat|imrt|hdr|quimiort)\b/i.test(combined);

  // Evaluación post-tratamiento pendiente o reevaluación sintomática
  const isAsymptomaticWithNormalFindings =
    !symptomFlag &&
    (combined.includes('asintomatic') || combined.includes('sin hallazgos') || combined.includes('sin alteraciones') || combined.includes('normal'));

  const isPostTreatmentEvaluation =
    symptomFlag ||
    /\b(?:evaluaci[oó]n|control)\s+(?:basal\s+)?post[\s-]?tratamiento\b/i.test(clinicalText) ||
    /\bpost[\s-]?tratamiento\s+pendiente\b/i.test(clinicalText) ||
    (pendingStudies.length > 0 && !isAsymptomaticWithNormalFindings);

  let diseaseStatus: DiseaseStatus = 'INDETERMINATE';
  let diseaseStatusDescription = '';
  let followUpMode: FollowUpMode = 'INDETERMINATE_STATUS';
  let followUpState: FollowUpState = 'UNDETERMINED';
  let modeLabel = '';
  let treatmentIntent = '';

  if (isStageIV) {
    if ((hasResectedMetastases || combined.includes('metastasectomia')) && hasNED && !hasProgression && !hasActiveLesions) {
      diseaseStatus = 'RESECTED_OLIGOMETASTATIC_NED';
      diseaseStatusDescription = 'Estadio IV con resección completa de metástasis (metastasectomía R0), actualmente sin evidencia de enfermedad activa (NED).';
      followUpMode = 'RESECTED_METASTATIC_SURVEILLANCE';
      followUpState = 'ROUTINE_SURVEILLANCE';
      modeLabel = 'Modo C — Vigilancia intensiva post-tratamiento potencialmente curativo de metástasis (NED)';
      treatmentIntent = 'Vigilancia post-tratamiento con intención curativa / consolidativa';
    } else if (hasProgression) {
      diseaseStatus = 'PROGRESSION';
      diseaseStatusDescription = 'Enfermedad metastásica activa en progresión.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'CONFIRMED_PROGRESSIVE_DISEASE';
      modeLabel = 'Modo B — Enfermedad metastásica activa en progresión / Reevaluación';
      treatmentIntent = 'Evaluación de progresión y cambio de línea sistémica';
    } else if (hasPartialResponse) {
      diseaseStatus = 'PARTIAL_RESPONSE';
      diseaseStatusDescription = 'Enfermedad metastásica activa con respuesta parcial objetiva a tratamiento sistémico.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Evaluación seriada de respuesta';
      treatmentIntent = 'Control de enfermedad y monitoreo de respuesta (RECIST 1.1)';
    } else if (hasStableDisease) {
      diseaseStatus = 'STABLE_DISEASE';
      diseaseStatusDescription = 'Enfermedad metastásica activa con enfermedad estable bajo tratamiento sistémico.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Monitoreo de estabilidad';
      treatmentIntent = 'Control de enfermedad y monitoreo de respuesta';
    } else if (hasActiveSystemicTreatment || hasActiveLesions || combined.includes('metastasis activas') || combined.includes('metastasico activo')) {
      diseaseStatus = 'ACTIVE_METASTATIC';
      diseaseStatusDescription = 'Enfermedad metastásica activa bajo tratamiento sistémico / control de respuesta tumoral.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Evaluación de respuesta a tratamiento sistémico';
      treatmentIntent = 'Control tumoral y evaluación de respuesta a tratamiento sistémico';
    } else if (hasNED) {
      diseaseStatus = 'RESECTED_OLIGOMETASTATIC_NED';
      diseaseStatusDescription = 'Estadio IV sin evidencia de enfermedad activa documentada (NED).';
      followUpMode = 'RESECTED_METASTATIC_SURVEILLANCE';
      followUpState = 'ROUTINE_SURVEILLANCE';
      modeLabel = 'Modo C — Vigilancia intensiva post-tratamiento de metástasis (NED)';
      treatmentIntent = 'Vigilancia post-tratamiento curativo';
    } else {
      diseaseStatus = 'ACTIVE_METASTATIC';
      diseaseStatusDescription = 'Enfermedad metastásica / Estadio IV (Control y monitoreo de respuesta).';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Evaluación de respuesta a tratamiento sistémico';
      treatmentIntent = 'Control tumoral y evaluación de respuesta a tratamiento sistémico';
    }
  } else {
    // Estadios I, II, III o enfermedad localizada / no clasificada como estadio IV
    if (hasProgression) {
      diseaseStatus = 'PROGRESSION';
      diseaseStatusDescription = hasActiveSystemicTreatment
        ? `Recidiva o progresión de enfermedad en tratamiento sistémico activo${detectedRegimen ? ` (${detectedRegimen})` : ''}.`
        : 'Recidiva o progresión de enfermedad documentada.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'CONFIRMED_PROGRESSIVE_DISEASE';
      modeLabel = hasActiveSystemicTreatment
        ? `Modo B — Recidiva activa / En tratamiento sistémico${detectedRegimen ? ` (${detectedRegimen})` : ''}`
        : 'Modo B — Recidiva activa / Re-estadificación y evaluación terapéutica';
      treatmentIntent = hasActiveSystemicTreatment
        ? 'Control de enfermedad y monitoreo de respuesta terapéutica a línea de recaída'
        : 'Reevaluación diagnóstica y terapéutica';
    } else if (hasPartialResponse) {
      diseaseStatus = 'PARTIAL_RESPONSE';
      diseaseStatusDescription = 'Enfermedad activa con respuesta parcial objetiva a tratamiento sistémico.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = 'Modo B — Enfermedad activa / Evaluación seriada de respuesta';
      treatmentIntent = 'Control de enfermedad y monitoreo de respuesta (RECIST 1.1)';
    } else if (hasStableDisease) {
      diseaseStatus = 'STABLE_DISEASE';
      diseaseStatusDescription = 'Enfermedad activa con enfermedad estable bajo tratamiento sistémico.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = 'Modo B — Enfermedad activa / Monitoreo de estabilidad';
      treatmentIntent = 'Control de enfermedad y monitoreo de respuesta';
    } else if (hasActiveSystemicTreatment || (detectedRegimen !== '' && !isTreatmentCompletedOrNone) || hasActiveLesions) {
      diseaseStatus = 'ACTIVE_METASTATIC';
      diseaseStatusDescription = detectedRegimen
        ? `Enfermedad activa bajo tratamiento sistémico (${detectedRegimen}) / Control de respuesta tumoral.`
        : 'Enfermedad activa bajo tratamiento sistémico / Control de respuesta tumoral.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      followUpState = 'ACTIVE_TREATMENT_MONITORING';
      modeLabel = detectedRegimen
        ? `Modo B — Enfermedad activa / En tratamiento sistémico (${detectedRegimen})`
        : 'Modo B — Enfermedad activa / Evaluación de respuesta a tratamiento sistémico';
      treatmentIntent = 'Control tumoral y evaluación de respuesta a tratamiento sistémico';
    } else if (isPostTreatmentEvaluation) {
      // Paciente con tratamiento completado en período de evaluación post-tratamiento o con síntomas en reevaluación
      followUpState = symptomFlag ? 'SYMPTOMATIC_REEVALUATION' : 'POST_TREATMENT_EVALUATION';
      diseaseStatus = 'POST_TREATMENT_EVALUATION';
      
      if (isDefinitiveNonSurgical) {
        diseaseStatusDescription = 'Tratamiento definitivo con intención curativa completado; sin progresión/recidiva confirmada documentada; actualmente en evaluación post-tratamiento.';
      } else if (isSurgical) {
        diseaseStatusDescription = 'Tratamiento quirúrgico completado; sin progresión/recidiva confirmada documentada; actualmente en evaluación post-tratamiento.';
      } else {
        diseaseStatusDescription = 'Tratamiento completado; sin progresión/recidiva confirmada documentada; actualmente en evaluación post-tratamiento.';
      }
      
      followUpMode = 'CURATIVE_SURVEILLANCE';
      modeLabel = symptomFlag
        ? 'Modo A — Vigilancia post-tratamiento curativo / Reevaluación por síntomas'
        : 'Modo A — Vigilancia post-tratamiento curativo (Evaluación post-tratamiento)';
      treatmentIntent = 'Evaluación de respuesta post-tratamiento y detección precoz de recidiva';
    } else {
      // Paciente asintomático en seguimiento rutinario prolongado (NED)
      followUpState = 'ROUTINE_SURVEILLANCE';
      diseaseStatus = 'NED';
      
      if (isDefinitiveNonSurgical) {
        diseaseStatusDescription = 'Tratamiento definitivo completado, actualmente sin evidencia clínica de progresión (Vigilancia post-tratamiento curativo).';
      } else if (isSurgical) {
        diseaseStatusDescription = 'Enfermedad localizada resecada con intención curativa, actualmente sin evidencia de enfermedad (NED).';
      } else {
        diseaseStatusDescription = 'Enfermedad localizada / en seguimiento, sin evidencia de progresión documentada (Vigilancia oncológica).';
      }

      followUpMode = 'CURATIVE_SURVEILLANCE';
      modeLabel = 'Modo A — Vigilancia post-tratamiento curativo (Enfermedad localizada)';
      treatmentIntent = 'Detección precoz de recidiva locorregional o sistémica curable';
    }
  }

  // 5. Extracción robusta de fechas clave
  const lastImagingDate = extractLastImagingDate(clinicalText);
  const lastTreatmentDate = extractLastTreatmentDate(clinicalText);

  return {
    ...baseProfile,
    isStageIV,
    diseaseStatus,
    diseaseStatusDescription,
    followUpMode,
    followUpState,
    modeLabel,
    activeTreatment,
    hasActiveSystemicTreatment,
    treatmentIntent,
    lastImagingDate,
    lastTreatmentDate,
    symptomFlag,
    relevantSymptoms,
    pendingStudies,
    confirmedRecurrence,
    confirmedProgression,
    summary: `${baseProfile.organ} — ${baseProfile.histology} (${baseProfile.stage}) | ${modeLabel}`,
  };
}

/**
 * Clasifica a qué patología u órgano apunta un archivo de guía clínica
 */
export function classifyGuidelineSource(sourceName: string): { organ: string; pathology: string; isKnown: boolean } {
  const norm = normalizeStr(sourceName || '');
  
  if (norm.includes('trophoblast') || norm.includes('trofoblast') || norm.includes('gestational') || norm.includes('mola') || (norm.includes('coriocarcinoma') && !norm.includes('testic'))) {
    return { organ: 'Trofoblasto gestacional (Útero)', pathology: 'Enfermedad trofoblástica gestacional / GTN (NCCN Gestational Trophoblastic Neoplasia)', isKnown: true };
  }
  if (norm.includes('uterine') || norm.includes('endometri') || norm.includes('uterus') || norm.includes('utero')) {
    return { organ: 'Endometrio / Útero', pathology: 'Cáncer de endometrio / Neoplasias uterinas (NCCN Uterine Neoplasms)', isKnown: true };
  }
  if (norm.includes('pancrea')) {
    if (norm.includes('neuroendocrin') || norm.includes('net') || norm.includes('tne')) {
      return { organ: 'Páncreas', pathology: 'Tumores neuroendocrinos pancreáticos (NCCN Neuroendocrine Tumors)', isKnown: true };
    }
    return { organ: 'Páncreas', pathology: 'Adenocarcinoma de páncreas (NCCN Pancreatic Adenocarcinoma)', isKnown: true };
  }
  if (norm.includes('breast') || norm.includes('mama')) {
    return { organ: 'Mama', pathology: 'Cáncer de mama (NCCN Breast Cancer)', isKnown: true };
  }
  if (norm.includes('colon')) {
    return { organ: 'Colon', pathology: 'Cáncer de colon (NCCN Colon Cancer)', isKnown: true };
  }
  if (norm.includes('rectal') || norm.includes('recto')) {
    return { organ: 'Recto', pathology: 'Cáncer de recto (NCCN Rectal Cancer)', isKnown: true };
  }
  if (norm.includes('cervic') || norm.includes('cervix') || norm.includes('cuello')) {
    return { organ: 'Cuello uterino (Cérvix)', pathology: 'Cáncer de cérvix (NCCN Cervical Cancer)', isKnown: true };
  }
  if (norm.includes('prostat')) {
    return { organ: 'Próstata', pathology: 'Cáncer de próstata (NCCN Prostate Cancer)', isKnown: true };
  }
  if (norm.includes('ovarian') || norm.includes('ovario')) {
    return { organ: 'Ovario', pathology: 'Cáncer de ovario (NCCN Ovarian Cancer)', isKnown: true };
  }
  if (norm.includes('lung') || norm.includes('pulmon')) {
    return { organ: 'Pulmón', pathology: 'Cáncer de pulmón (NCCN Lung Cancer)', isKnown: true };
  }
  if (norm.includes('gastric') || norm.includes('estomago')) {
    return { organ: 'Estómago', pathology: 'Cáncer gástrico (NCCN Gastric Cancer)', isKnown: true };
  }
  if (norm.includes('melanoma')) {
    return { organ: 'Piel', pathology: 'Melanoma cutáneo (NCCN Melanoma)', isKnown: true };
  }
  if (norm.includes('bladder') || norm.includes('vejiga')) {
    return { organ: 'Vejiga', pathology: 'Cáncer de vejiga (NCCN Bladder Cancer)', isKnown: true };
  }
  if (norm.includes('testicular') || norm.includes('testiculo')) {
    return { organ: 'Testículo', pathology: 'Cáncer de testículo (NCCN Testicular Cancer)', isKnown: true };
  }
  if (norm.includes('kidney') || norm.includes('renal') || norm.includes('rinon')) {
    return { organ: 'Riñón', pathology: 'Cáncer renal (NCCN Kidney Cancer)', isKnown: true };
  }
  if (norm.includes('hepatobiliary') || norm.includes('biliary') || norm.includes('vias biliares')) {
    return { organ: 'Vías biliares / Vesícula', pathology: 'Cáncer hepatobiliar (NCCN Hepatobiliary Cancers)', isKnown: true };
  }

  return { organ: 'Desconocido', pathology: 'Guía no clasificada automáticamente', isKnown: false };
}

/**
 * Validador integral de fuentes candidatas con Bloqueo Clínico de Seguridad y Perfil de Escenario
 */
export function validateCandidateSources(
  clinicalText: string,
  attachedFiles: { name: string; type: string; data: string }[] = [],
  explicitDiagnosis: string = ''
): CandidateValidationResult {
  const profile = extractClinicalScenarioProfile(clinicalText, explicitDiagnosis);

  // 0. Si el diagnóstico está fuera de la cobertura de guías del sistema o no identificado
  if (profile.organ.includes('No cubierto') || profile.organ === 'Desconocido / No identificado') {
    return {
      canProceed: false,
      profile,
      sourceMode: 'NONE',
      validAttachedGuidelines: [],
      validSystemGuideline: null,
      excludedSources: [],
      stopReason: 'NO_MATCHING_SYSTEM_GUIDELINE',
      stopTitle: 'Sin guía disponible en el sistema',
      stopMessage: `No se encontró una guía clínica de seguimiento en el sistema para este diagnóstico (${profile.organ} / ${profile.histology}). Para garantizar la seguridad del paciente, el sistema tiene prohibido asumir una localización anatómica por inferencia de palabras sueltas o generar recomendaciones sin una guía de práctica clínica específica de referencia.`,
    };
  }

  // 1. Si el diagnóstico histológico es incompleto o ambiguo
  if (profile.isHistologyIncomplete) {
    const isAmbiguous = profile.organ.toLowerCase().includes('ambiguo');
    return {
      canProceed: false,
      profile,
      sourceMode: 'NONE',
      validAttachedGuidelines: [],
      validSystemGuideline: null,
      excludedSources: [],
      stopReason: 'HISTOLOGY_INCOMPLETE',
      stopTitle: isAmbiguous ? 'Ambigüedad Diagnóstica / Órgano No Concluyente' : 'Diagnóstico Histológico Incompleto',
      stopMessage: isAmbiguous
        ? `El texto clínico documenta múltiples órganos candidatos sin un diagnóstico primario definido (${profile.organ}). Por seguridad oncológica, el sistema tiene prohibido asumir un órgano primario por defecto o emitir un plan sin certeza del tumor primario.`
        : 'El texto clínico documenta una lesión o neoplasia sin confirmación de estirpe histológica. El sistema tiene prohibido asumir una estirpe por defecto o emitir un plan de seguimiento específico sin histología demostrada.',
    };
  }

  // 2. Si el estado actual de enfermedad es indeterminado
  if (profile.followUpMode === 'INDETERMINATE_STATUS') {
    return {
      canProceed: false,
      profile,
      sourceMode: 'NONE',
      validAttachedGuidelines: [],
      validSystemGuideline: null,
      excludedSources: [],
      stopReason: 'INDETERMINATE_STATUS',
      stopTitle: 'Estado de Enfermedad Indeterminado',
      stopMessage: 'El estado actual de la enfermedad (enfermedad activa vs libre de enfermedad / NED) no puede determinarse con suficiente certeza a partir de la información disponible. No se genera un cronograma fijo para evitar aplicar pautas de vigilancia a pacientes con enfermedad activa o viceversa. Se requiere documentar la situación actual.',
    };
  }

  const hasAttached = attachedFiles && attachedFiles.length > 0;
  const excludedSources: { name: string; detectedTarget: string; reason: string }[] = [];
  const validAttachedGuidelines: { name: string; type: string; data: string }[] = [];

  // 3. Evaluación estricta de guías adjuntadas manualmente (Aisladas del texto del paciente)
  if (hasAttached) {
    for (const f of attachedFiles) {
      const classification = classifyGuidelineSource(f.name || '');
      const normPatientOrgan = normalizeStr(profile.organ);
      const normGuideOrgan = normalizeStr(classification.organ);

      // Verificación de compatibilidad de órgano
      const isOrganMatch =
        classification.isKnown &&
        (normPatientOrgan.includes(normGuideOrgan) || normGuideOrgan.includes(normPatientOrgan));

      // Verificación especial para tumores neuroendocrinos vs adenocarcinoma
      let isHistologyMatch = true;
      if (profile.histology.toLowerCase().includes('neuroendocrin') && !classification.pathology.toLowerCase().includes('neuroendocrin')) {
        isHistologyMatch = false;
      }
      if (profile.histology.toLowerCase().includes('adenocarcinoma') && classification.pathology.toLowerCase().includes('neuroendocrin')) {
        isHistologyMatch = false;
      }

      if (isOrganMatch && isHistologyMatch) {
        validAttachedGuidelines.push(f);
      } else {
        excludedSources.push({
          name: f.name || 'Guía adjunta',
          detectedTarget: classification.pathology,
          reason: `No coincide con el tumor del paciente (${profile.organ} / ${profile.histology} ≠ ${classification.organ} / ${classification.pathology})`,
        });
      }
    }

    // Si se adjuntaron guías pero NINGUNA es válida para este paciente: BLOQUEO TOTAL
    if (validAttachedGuidelines.length === 0) {
      const excludedNames = excludedSources.map(e => `"${e.name}" (${e.detectedTarget})`).join(', ');
      return {
        canProceed: false,
        profile,
        sourceMode: 'NONE',
        validAttachedGuidelines: [],
        validSystemGuideline: null,
        excludedSources,
        stopReason: 'EXCLUDED_ATTACHED_NO_VALID',
        stopTitle: 'Fuente no válida para este paciente',
        stopMessage: `Se detectó la guía ${excludedNames}, pero el diagnóstico del paciente es ${profile.organ} (${profile.histology}). Esta fuente fue excluida y no se utilizará para generar recomendaciones. No se encontró una fuente específica válida entre las fuentes disponibles.`,
      };
    }

    // Hay al menos una guía adjunta válida: Proceder en Modo Fuente Cerrada
    return {
      canProceed: true,
      profile,
      sourceMode: 'CLOSED_SOURCE_MANUAL',
      validAttachedGuidelines,
      validSystemGuideline: null,
      excludedSources,
    };
  }

  // 4. Evaluación de guías del sistema basada en el perfil estructurado del paciente
  const systemMatch = matchGuidelineByProfile(profile);

  if (systemMatch.status === 'EXACT_MATCH' && systemMatch.guideline) {
    const g = systemMatch.guideline;
    let activeScenarioRecommendations: ScenarioRecommendations | null = null;

    if (profile.followUpMode === 'ACTIVE_METASTATIC_MONITORING') {
      activeScenarioRecommendations = g.scenarios?.activeMetastatic || null;
    } else if (profile.followUpMode === 'RESECTED_METASTATIC_SURVEILLANCE') {
      activeScenarioRecommendations = g.scenarios?.resectedMetastatic || g.scenarios?.localizedSurveillance || null;
    } else if (profile.followUpMode === 'CURATIVE_SURVEILLANCE') {
      if (profile.followUpState === 'SYMPTOMATIC_REEVALUATION' && g.scenarios?.symptomaticReevaluation) {
        activeScenarioRecommendations = g.scenarios.symptomaticReevaluation;
      } else if (profile.followUpState === 'POST_TREATMENT_EVALUATION' && g.scenarios?.postTreatmentEvaluation) {
        activeScenarioRecommendations = g.scenarios.postTreatmentEvaluation;
      } else {
        activeScenarioRecommendations = g.scenarios?.localizedSurveillance || null;
      }
    }

    return {
      canProceed: true,
      profile,
      sourceMode: 'SYSTEM_NCCN',
      validAttachedGuidelines: [],
      validSystemGuideline: g,
      activeScenarioRecommendations,
      excludedSources: [],
    };
  }

  if (systemMatch.status === 'HISTOLOGY_INCOMPLETE') {
    return {
      canProceed: false,
      profile,
      sourceMode: 'NONE',
      validAttachedGuidelines: [],
      validSystemGuideline: null,
      excludedSources: [],
      stopReason: 'HISTOLOGY_INCOMPLETE',
      stopTitle: 'Diagnóstico Histológico Incompleto',
      stopMessage: 'El diagnóstico histológico no está suficientemente definido para seleccionar con seguridad la guía específica de seguimiento.',
    };
  }

  // Sin guía del sistema coincidente: BLOQUEO TOTAL
  return {
    canProceed: false,
    profile,
    sourceMode: 'NONE',
    validAttachedGuidelines: [],
    validSystemGuideline: null,
    excludedSources: [],
    stopReason: 'NO_MATCHING_SYSTEM_GUIDELINE',
    stopTitle: 'Sin guía específica disponible en el sistema',
    stopMessage: 'No se encontró una guía válida y suficientemente específica para este diagnóstico entre las fuentes actualmente disponibles. No se genera un plan específico para evitar utilizar una guía correspondiente a otra estirpe o localización tumoral.',
  };
}

/**
 * Selecciona una guía del sistema a partir del perfil diagnóstico estructurado del paciente.
 * NUNCA busca palabras arbitrarias en toda la historia clínica.
 */
export function matchGuidelineByProfile(profile: PatientTumorProfile): GuidelineMatchResult {
  if (!profile.organ || profile.organ === 'Desconocido / No identificado' || profile.organ.includes('No cubierto')) {
    return {
      status: 'NO_MATCHING_GUIDELINE',
      guideline: null,
      message: 'No se dispone de una guía clínica en el sistema para este diagnóstico.',
    };
  }

  if (profile.organ.toLowerCase().includes('ambiguo')) {
    return {
      status: 'HISTOLOGY_INCOMPLETE',
      guideline: null,
      message: `El diagnóstico presenta ambigüedad clínica (${profile.organ}). Se requiere definir el tumor primario con certeza antes de seleccionar una guía de seguimiento.`,
    };
  }

  if (profile.isHistologyIncomplete) {
    return {
      status: 'HISTOLOGY_INCOMPLETE',
      guideline: null,
      message: 'El diagnóstico histológico no está suficientemente definido para seleccionar con seguridad la guía específica de seguimiento.',
    };
  }

  const normPatientOrgan = normalizeStr(profile.organ);
  const normPatientHist = normalizeStr(profile.histology);

  // Filtrar candidatos estrictamente por coincidencia de órgano
  const organCandidates = nccnGuidelines.filter(g => {
    const normGuideOrgan = normalizeStr(g.organ);
    return normPatientOrgan.includes(normGuideOrgan) || normGuideOrgan.includes(normPatientOrgan);
  });

  if (organCandidates.length === 0) {
    return {
      status: 'NO_MATCHING_GUIDELINE',
      guideline: null,
      message: `No se encontró una guía NCCN disponible para el órgano ${profile.organ}.`,
    };
  }

  // Entre los candidatos del mismo órgano, verificar compatibilidad histológica y exclusiones
  for (const g of organCandidates) {
    // 1. Verificar si la histología del paciente está excluida por esta guía
    const isExcluded = g.excludedHistologies.some(excl => normPatientHist.includes(normalizeStr(excl)));
    if (isExcluded) continue;

    // 2. Verificar si la histología del paciente coincide con las histologías de la guía
    const isHistMatch = g.histologies.some(h => {
      const normH = normalizeStr(h);

      // Coincidencia exacta
      if (normPatientHist === normH) return true;

      // La histología del paciente contiene la de la guía
      // Ej: paciente = "adenocarcinoma ductal pancreatico invasor", guía = "adenocarcinoma ductal pancreatico"
      if (normPatientHist.includes(normH)) return true;

      // La histología de la guía contiene la del paciente (normH.includes(normPatientHist)):
      // RED DE SEGURIDAD ESTRICTA:
      if (normH.includes(normPatientHist)) {
        // ¿Es un término histológico genérico sin órgano calificado?
        const isGenericHist = /^(adenocarcinoma|carcinoma|carcinoma epidermoide|carcinoma escamoso|neoplasia|tumor maligno)$/.test(normPatientHist.trim());

        if (isGenericHist) {
          // Si el término es genérico (ej. "adenocarcinoma"), NO debe validar contra guías
          // cuya entrada de histología especifica un órgano distinto al ya detectado en el perfil.
          const isOrganValid = profile.organ !== 'Desconocido / No identificado' && !profile.organ.toLowerCase().includes('ambiguo');
          if (!isOrganValid) return false;

          const normGuideOrgan = normalizeStr(g.organ);
          const organMatches = normPatientOrgan.includes(normGuideOrgan) || normGuideOrgan.includes(normPatientOrgan);
          if (!organMatches) return false;

          // Si normH menciona un órgano, debe coincidir con el órgano del paciente
          const organsInH = detectCandidateOrgans(normH);
          if (organsInH.length > 0 && !organsInH.some(o => {
            const no = normalizeStr(o);
            return normPatientOrgan.includes(no) || no.includes(normPatientOrgan);
          })) {
            return false;
          }

          return true;
        }

        // Si no es un término genérico, verificar que no mencione un órgano contradictorio con la guía
        const organsInPatientHist = detectCandidateOrgans(normPatientHist);
        const normGuideOrgan = normalizeStr(g.organ);
        if (organsInPatientHist.length > 0 && !organsInPatientHist.some(o => {
          const no = normalizeStr(o);
          return normGuideOrgan.includes(no) || no.includes(normGuideOrgan);
        })) {
          return false;
        }

        return true;
      }

      return false;
    });

    if (isHistMatch) {
      return {
        status: 'EXACT_MATCH',
        guideline: g,
      };
    }
  }

  return {
    status: 'NO_MATCHING_GUIDELINE',
    guideline: null,
    message: `No se encontró una guía correspondiente a la estirpe ${profile.histology} para el órgano ${profile.organ}.`,
  };
}

/**
 * Valida de forma estricta la correspondencia entre la historia clínica del paciente
 * y la guía NCCN disponible utilizando el perfil estructurado.
 */
export function matchGuidelineForPatient(clinicalText: string, explicitDiagnosis: string = ''): GuidelineMatchResult {
  if ((!clinicalText || clinicalText.trim().length === 0) && (!explicitDiagnosis || explicitDiagnosis.trim().length === 0)) {
    return {
      status: 'HISTOLOGY_INCOMPLETE',
      guideline: null,
      message: 'No se suministró texto clínico ni diagnóstico para identificar el caso.',
    };
  }

  const profile = extractPatientTumorProfile(clinicalText, explicitDiagnosis);
  return matchGuidelineByProfile(profile);
}

/**
 * Función de compatibilidad previa que invoca la validación estricta
 */
export function findNCCNGuideline(clinicalText: string, explicitDiagnosis: string = ''): NCCNGuideline | null {
  const result = matchGuidelineForPatient(clinicalText, explicitDiagnosis);
  return result.status === 'EXACT_MATCH' ? result.guideline : null;
}



