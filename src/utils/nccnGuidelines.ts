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
  };
}

export type FollowUpMode = 
  | 'CURATIVE_SURVEILLANCE'           
  | 'ACTIVE_METASTATIC_MONITORING'    
  | 'RESECTED_METASTATIC_SURVEILLANCE'
  | 'INDETERMINATE_STATUS';           

export type DiseaseStatus = 
  | 'NED'                              
  | 'ACTIVE_METASTATIC'                
  | 'PARTIAL_RESPONSE'                 
  | 'STABLE_DISEASE'                   
  | 'PROGRESSION'                      
  | 'RESECTED_OLIGOMETASTATIC_NED'     
  | 'INDETERMINATE';                   

export interface ClinicalScenarioProfile {
  organ: string;
  histology: string;
  subtype: string;
  stage: string;
  isStageIV: boolean;
  diseaseStatus: DiseaseStatus;
  diseaseStatusDescription: string;
  followUpMode: FollowUpMode;
  modeLabel: string;
  activeTreatment: string;
  hasActiveSystemicTreatment: boolean;
  treatmentIntent: string;
  lastImagingDate: string;
  lastTreatmentDate: string;
  surgeryDate: string;
  isHistologyIncomplete: boolean;
  summary: string;
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
    intention: 'Detección precoz de recaída pélvica o a distancia, manejo de toxicidad por radioterapia pélvica (estenosis vaginal, fístulas, disfunción vesical/rectal), y seguimiento de secuelas quirúrgicas.',
    schedule: 'Años 1–2: consulta cada 3–6 meses. Años 3–5: cada 6–12 meses. Después del año 5: anual. Examen pélvico con espéculo y tacto vaginal/rectal en cada visita.',
    imaging: 'TAC tórax-abdomen-pelvis o PET-TC con contraste: cada 6 meses en los primeros 2 años post-tratamiento en estadios IB2–IVA de alto riesgo, o ante hallazgos sospechosos. No se recomienda imagen de rutina en estadios tempranos asintomáticos. Citología vaginal/Papanicolaou anual.',
    labs: 'SCC (carcinoma escamoso) o CA-125 (adenocarcinoma) según indicación específica ante sospecha. Función renal periódica en pacientes con antecedentes obstructivos.',
    alarmSigns: 'Sangrado vaginal anormal; dolor pélvico o lumbar persistente; edema unilateral de miembro inferior; hematuria o fístulas; rectorragia o tenesmo; adenopatías inguinales o supraclaviculares.',
    specialConsiderations: 'Radioterapia pélvica previa: dilatadores vaginales y rehabilitación pélvica. Asesoría en salud sexual y función renal.',
    source: 'NCCN Cervical Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN'
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
  }
];

/**
 * Normaliza cadenas para comparación clínica segura
 */
export interface PatientTumorProfile {
  organ: string;
  histology: string;
  subtype: string;
  stage: string;
  margin: string;
  clinicalStatus: string;
  treatment: string;
  surgeryDate: string;
  isHistologyIncomplete: boolean;
  summary: string;
}

export interface CandidateValidationResult {
  canProceed: boolean;
  profile: PatientTumorProfile;
  sourceMode: 'CLOSED_SOURCE_MANUAL' | 'SYSTEM_NCCN' | 'NONE';
  validAttachedGuidelines: { name: string; type: string; data: string }[];
  validSystemGuideline: NCCNGuideline | null;
  excludedSources: { name: string; detectedTarget: string; reason: string }[];
  stopReason?: 'HISTOLOGY_INCOMPLETE' | 'EXCLUDED_ATTACHED_NO_VALID' | 'NO_MATCHING_SYSTEM_GUIDELINE';
  stopTitle?: string;
  stopMessage?: string;
}

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
    organ: 'Endometrio / Útero',
    check: (str: string) => {
      const withoutCuello = str.replace(/cuello (?:uterino|de utero)/g, ' ');
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
  // Ej: "se descarta tumor de páncreas", "antecedente familiar de cáncer de páncreas", "guía nccn de páncreas"
  const exclPattern = new RegExp(
    '(se\\s+descarta|descartar|descartad\\w*|diagnostico\\s+diferencial|ddx|antecedente\\w*\\s+(?:familiar\\w*|gineco\\w*|de)|guia\\w*\\s+(?:nccn|esmo|ascol)?)' +
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
  const found: string[] = [];

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
  return found;
}

/**
 * Comprueba si una mención de progresión o recidiva está negada o en contexto de vigilancia/control/evaluación de riesgo.
 */
function isProgressionMentionNegatedOrSurveillance(clause: string): boolean {
  const norm = normalizeStr(clause);

  // 1. Negaciones clínicas amplias (soporta modificadores intermediarios como "signos tomográficos de", etc.)
  const negPatterns = [
    /\bsin\b(?:[\s\w]*)\b(recidiva|progresion|recaida|lesion\w*|metastasis)\b/,
    /\bno\b(?:[\s\w]*)\b(se observa\w*|se evidencia\w*|se aprecia\w*|se identifica\w*|presenta|hay)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|lesion\w*|metastasis)\b/,
    /\b(?:libre\s+de|ausencia\s+de)\b(?:[\s\w]*)\b(recidiva|progresion|recaida|enfermedad)\b/,
    /\bnegativ[ao]s?\s+(?:para|de)\b(?:[\s\w]*)\b(recidiva|progresion|recaida)\b/,
    /\b(?:se\s+descarta|descartar|descartando|descartad[ao]s?)\b(?:[\s\w]*)\b(recidiva|progresion|recaida)\b/
  ];

  for (const p of negPatterns) {
    if (p.test(norm)) return true;
  }

  // 2. Contextos de control, seguimiento, vigilancia o evaluación de riesgo (NO progresión confirmada)
  const surveillancePatterns = [
    /\b(?:control|seguimiento|vigilancia|deteccion|prevencion|profilaxis)\b(?:[\s\w]*)\b(?:de|para)\b(?:[\s\w]*)\b(recidiva|progresion|recaida)\b/,
    /\b(?:para|a\s+fin\s+de)\s+descartar\b(?:[\s\w]*)\b(recidiva|progresion|recaida)\b/,
    /\briesgo\b(?:[\s\w]*)\b(?:de)\b(?:[\s\w]*)\b(recidiva|progresion|recaida)\b/,
    /\bscore\s+de\s+(?:recidiva|recaida)\b/,
    /\bevaluar\b(?:[\s\w]*)\b(?:posible|sospecha\s+de)?\b(?:[\s\w]*)\b(recidiva|progresion|recaida)\b/
  ];

  for (const p of surveillancePatterns) {
    if (p.test(norm)) return true;
  }

  return false;
}

/**
 * Detecta si el texto documenta una progresión o recidiva real confirmada (excluyendo negaciones y controles de rutina)
 */
export function detectConfirmedProgression(text: string): boolean {
  const norm = normalizeStr(text);
  const keywords = ['recidiva', 'progresion', 'recaida', 'enfermedad progresiva', 'crecimiento tumoral'];

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
      /\b(?:recidiva|progresion|recaida)\s+(?:confirmada|documentada|evidente|tumoral|locorregional|local|a\s+distancia|ganglionar|hepatica|peritoneal|anastomotica|en\s+lecho|clinica|radiologica|bioquimica)\b/,
      /\b(?:se\s+constata|se\s+confirma|se\s+documenta|se\s+aprecia|presenta|evidencia|muestra)\s+(?:franca\s+|nueva\s+)?(?:recidiva|progresion|recaida)\b/,
      /\benfermedad\s+(?:en\s+progresion|progresiva)\b/,
      /\bprogresion\s+(?:de\s+enfermedad|por\s+recist|segun\s+recist|objetiva)\b/,
      /\b(?:aparicion\s+de|nuevas?)\s+(?:lesion\w*|metastasis|implantes?)\b/
    ];

    const isExplicitlyAffirmative = affirmativePatterns.some(p => p.test(normClause));
    if (isExplicitlyAffirmative) {
      confirmedCount++;
    } else if (/\b(recidiva|progresion|recaida)\b/.test(normClause)) {
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
    'nivolumab', 'gemcitabina', 'cisplatino', 'carboplatino',
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

  const isTreatmentCompletedOrPast = [
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

  const hasActiveOngoingTreatment = [
    /en\s+tratamiento\s+(?:activo|actual|con)/,
    /recibe\s+actualmente/,
    /actualmente\s+recibe/,
    /esquema\s+actual/,
    /quimioterapia\s+activa/,
    /en\s+curso/,
    /inicia\s+(?:primera\s+|segunda\s+|linea|ciclo|tratamiento)/,
    /mantenimiento\s+con/
  ].some(p => p.test(norm));

  const hasActiveSystemicTreatment = !isTreatmentCompletedOrPast && (hasActiveOngoingTreatment || (detectedRegimen !== ''));

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
 * Extrae el perfil tumoral ancla del paciente a partir de su diagnóstico explícito
 * y/o de la historia clínica patológica, anclando al diagnóstico principal y
 * filtrando menciones incidentales o hallazgos normales de otros órganos.
 */
export function extractPatientTumorProfile(clinicalText: string, explicitDiagnosis: string = ''): PatientTumorProfile {
  const normDx = normalizeStr(explicitDiagnosis || '');
  const normText = normalizeStr(clinicalText || '');

  // 1. Detección prioritaria de órgano anclada al diagnóstico principal
  let organ = 'Desconocido / No identificado';
  let isHistologyIncomplete = false;

  // Helper de compatibilidad interna
  const detectOrganFromStr = (str: string): string => {
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
    const dxHeaderRegex = /(?:diagn[oó]stico(?:[\s\w]*)|anatom[ií]a patol[oó]gica|informe anatomopatol[oó]gico|biopsia(?:[\s\w]*)|ap|tumor primario|juicio cl[ií]nico|impresi[oó]n diagn[oó]stica)[\s:]+([^\n.;]+)/gi;
    const headerOrgans = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = dxHeaderRegex.exec(clinicalText)) !== null) {
      const snippet = match[1];
      const detected = detectCandidateOrgans(snippet, true);
      detected.forEach(o => headerOrgans.add(o));
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

    const activeArr = Array.from(activeOrgans);
    if (activeArr.length === 1) {
      organ = activeArr[0];
    } else if (activeArr.length > 1) {
      organ = `Órgano ambiguo / No concluyente (${activeArr.join(', ')})`;
      isHistologyIncomplete = true;
    }
  }

  // 2. Detección de estirpe histológica
  let histology = 'No especificada / Pendiente de confirmación';

  const targetSearchStr = `${normDx} ${normText}`;
  const hasNeuroendocrine =
    targetSearchStr.includes('neuroendocrin') || targetSearchStr.includes('tne') || targetSearchStr.includes('pnet') || targetSearchStr.includes('carcinoide') || targetSearchStr.includes('net g');

  if (hasNeuroendocrine) {
    histology = 'Tumor neuroendocrino (TNE / NET)';
  } else if (targetSearchStr.includes('adenocarcinoma ductal') || (targetSearchStr.includes('adenocarcinoma') && targetSearchStr.includes('ductal'))) {
    histology = organ === 'Páncreas' ? 'Adenocarcinoma ductal de páncreas' : 'Adenocarcinoma ductal';
  } else if (targetSearchStr.includes('adenocarcinoma')) {
    if (organ === 'Colon') {
      if (targetSearchStr.includes('mucinoso')) histology = 'Adenocarcinoma mucinoso de colon';
      else if (targetSearchStr.includes('colorrectal') || targetSearchStr.includes('colorectal')) histology = 'Adenocarcinoma colorrectal';
      else histology = 'Adenocarcinoma de colon';
    } else if (organ === 'Páncreas') {
      histology = 'Adenocarcinoma de páncreas';
    } else if (organ === 'Recto') {
      histology = 'Adenocarcinoma de recto';
    } else if (organ === 'Próstata') {
      histology = 'Adenocarcinoma de próstata';
    } else if (organ === 'Estómago') {
      histology = 'Adenocarcinoma gástrico';
    } else if (organ === 'Endometrio / Útero') {
      histology = 'Adenocarcinoma endometrioide';
    } else if (organ === 'Cuello uterino (Cérvix)') {
      histology = 'Adenocarcinoma de cérvix';
    } else if (organ === 'Ovario') {
      histology = 'Adenocarcinoma de ovario';
    } else if (organ === 'Pulmón') {
      histology = 'Adenocarcinoma de pulmón';
    } else {
      histology = 'Adenocarcinoma';
    }
  } else if (targetSearchStr.includes('carcinoma epidermoide') || targetSearchStr.includes('carcinoma escamoso') || targetSearchStr.includes('escamocelular')) {
    if (organ === 'Cuello uterino (Cérvix)') histology = 'Carcinoma epidermoide de cérvix';
    else if (organ === 'Piel') histology = 'Carcinoma espinocelular cutáneo';
    else if (organ === 'Pulmón') histology = 'Carcinoma epidermoide de pulmón (NSCLC)';
    else histology = 'Carcinoma epidermoide / escamoso';
  } else if (targetSearchStr.includes('microcitico') || targetSearchStr.includes('celulas pequenas') || targetSearchStr.includes('sclc')) {
    histology = 'Carcinoma microcítico (SCLC)';
  } else if (targetSearchStr.includes('celulas no pequenas') || targetSearchStr.includes('nsclc')) {
    histology = 'Carcinoma de células no pequeñas (NSCLC)';
  } else if (targetSearchStr.includes('basocelular') || targetSearchStr.includes('bcc')) {
    histology = 'Carcinoma basocelular';
  } else if (targetSearchStr.includes('melanoma')) {
    histology = 'Melanoma';
  } else if (targetSearchStr.includes('seminoma')) {
    histology = 'Seminoma';
  } else if (targetSearchStr.includes('urotelial') || targetSearchStr.includes('transicional')) {
    histology = 'Carcinoma urotelial';
  } else if (targetSearchStr.includes('celulas claras')) {
    histology = organ === 'Riñón' ? 'Carcinoma de células claras de riñon' : 'Carcinoma de células claras';
  } else if (targetSearchStr.includes('seroso')) {
    histology = organ === 'Ovario' ? 'Carcinoma seroso de alto grado' : 'Carcinoma seroso';
  } else if (organ !== 'Desconocido / No identificado' && !organ.toLowerCase().includes('ambiguo')) {
    // Si el órgano es conocido, asignar la estirpe estándar predominante según NCCN
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
  }

  // Detección de diagnóstico incompleto o ambiguo
  if (
    organ.toLowerCase().includes('ambiguo') ||
    (organ === 'Desconocido / No identificado' &&
      (targetSearchStr.includes('neoplasia') || targetSearchStr.includes('tumor') || targetSearchStr.includes('lesion') || targetSearchStr.includes('masa')) &&
      histology === 'No especificada / Pendiente de confirmación')
  ) {
    isHistologyIncomplete = true;
  }

  // 3. Extracción de estadio
  let stage = 'No documentado';
  const stageMatch = (explicitDiagnosis + ' ' + clinicalText).match(/(?:estadio|stage|pt\d[a-c]?n\d[a-c]?m\d[a-c]?|pt\d[a-c]?n\d[a-c]?|t\d[a-c]?n\d[a-c]?m\d[a-c]?|[I|V|X]+[A-C]?)/i);
  if (stageMatch) stage = stageMatch[0].trim();

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
  };
}

/**
 * Extrae el perfil de escenario clínico profundo del paciente:
 * - Diagnóstico e Histología
 * - Estadio (Estadio IV vs Estadios I–III)
 * - Estado de Enfermedad Actual (NED vs Metastásico Activo vs Progresión vs Metastasectomía R0 vs Indeterminado)
 * - Modo de Seguimiento (Modo A: Curativo Localizado vs Modo B: Metastásico Activo vs Modo C: Post-Metastasectomía)
 * - Tratamiento Activo y Respuesta
 * - Fechas Clave
 */
export function extractClinicalScenarioProfile(clinicalText: string, explicitDiagnosis: string = ''): ClinicalScenarioProfile {
  const normDx = normalizeStr(explicitDiagnosis || '');
  const normText = normalizeStr(clinicalText || '');
  const combined = `${normDx} ${normText}`;

  // 1. Perfil tumoral base
  const baseProfile = extractPatientTumorProfile(clinicalText, explicitDiagnosis);

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
    combined.includes('asintomatica') || combined.includes('asintomatico') ||
    (!hasProgression && (tx.isTreatmentCompletedOrPast || combined.includes('en seguimiento')));

  const hasPartialResponse = combined.includes('respuesta parcial') || combined.includes('reduccion tumoral');
  const hasStableDisease = combined.includes('enfermedad estable') || combined.includes('estabilidad lesional');

  let diseaseStatus: DiseaseStatus = 'INDETERMINATE';
  let diseaseStatusDescription = '';
  let followUpMode: FollowUpMode = 'INDETERMINATE_STATUS';
  let modeLabel = '';
  let treatmentIntent = '';

  if (isStageIV) {
    if ((hasResectedMetastases || combined.includes('metastasectomia')) && hasNED && !hasProgression && !hasActiveLesions) {
      diseaseStatus = 'RESECTED_OLIGOMETASTATIC_NED';
      diseaseStatusDescription = 'Estadio IV con resección completa de metástasis (metastasectomía R0), actualmente sin evidencia de enfermedad activa (NED).';
      followUpMode = 'RESECTED_METASTATIC_SURVEILLANCE';
      modeLabel = 'Modo C — Vigilancia intensiva post-tratamiento potencialmente curativo de metástasis (NED)';
      treatmentIntent = 'Vigilancia post-tratamiento con intención curativa / consolidativa';
    } else if (hasProgression) {
      diseaseStatus = 'PROGRESSION';
      diseaseStatusDescription = 'Enfermedad metastásica activa en progresión.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa en progresión / Reevaluación';
      treatmentIntent = 'Evaluación de progresión y cambio de línea sistémica';
    } else if (hasPartialResponse) {
      diseaseStatus = 'PARTIAL_RESPONSE';
      diseaseStatusDescription = 'Enfermedad metastásica activa con respuesta parcial objetiva a tratamiento sistémico.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Evaluación seriada de respuesta';
      treatmentIntent = 'Control de enfermedad y monitoreo de respuesta (RECIST 1.1)';
    } else if (hasStableDisease) {
      diseaseStatus = 'STABLE_DISEASE';
      diseaseStatusDescription = 'Enfermedad metastásica activa con enfermedad estable bajo tratamiento sistémico.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Monitoreo de estabilidad';
      treatmentIntent = 'Control de enfermedad y monitoreo de respuesta';
    } else if (hasActiveSystemicTreatment || hasActiveLesions || combined.includes('metastasis activas') || combined.includes('metastasico activo')) {
      diseaseStatus = 'ACTIVE_METASTATIC';
      diseaseStatusDescription = 'Enfermedad metastásica activa bajo tratamiento sistémico / control de respuesta tumoral.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Evaluación de respuesta a tratamiento sistémico';
      treatmentIntent = 'Control tumoral y evaluación de respuesta a tratamiento sistémico';
    } else if (hasNED) {
      diseaseStatus = 'RESECTED_OLIGOMETASTATIC_NED';
      diseaseStatusDescription = 'Estadio IV sin evidencia de enfermedad activa documentada (NED).';
      followUpMode = 'RESECTED_METASTATIC_SURVEILLANCE';
      modeLabel = 'Modo C — Vigilancia intensiva post-tratamiento de metástasis (NED)';
      treatmentIntent = 'Vigilancia post-tratamiento curativo';
    } else {
      diseaseStatus = 'ACTIVE_METASTATIC';
      diseaseStatusDescription = 'Enfermedad metastásica / Estadio IV (Control y monitoreo de respuesta).';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      modeLabel = 'Modo B — Enfermedad metastásica activa / Evaluación de respuesta a tratamiento sistémico';
      treatmentIntent = 'Control tumoral y evaluación de respuesta a tratamiento sistémico';
    }
  } else {
    // Estadios I, II, III o enfermedad localizada / no metastásica
    if (hasProgression) {
      diseaseStatus = 'PROGRESSION';
      diseaseStatusDescription = 'Recidiva o progresión de enfermedad documentada.';
      followUpMode = 'ACTIVE_METASTATIC_MONITORING';
      modeLabel = 'Modo B — Recidiva activa / Re-estadificación y evaluación terapéutica';
      treatmentIntent = 'Reevaluación diagnóstica y terapéutica';
    } else {
      const isResectedOrNED = hasNED || isTreatmentCompletedOrNone || combined.includes('postquirurgico') || combined.includes('resecado') || combined.includes('postoperatorio') || combined.includes('operada') || combined.includes('operado') || combined.includes('hemicolectomia') || combined.includes('colectomia') || combined.includes('duodenopancreatectomia') || combined.includes('dpc') || combined.includes('whipple');
      diseaseStatus = 'NED';
      diseaseStatusDescription = isResectedOrNED
        ? 'Enfermedad localizada resecada con intención curativa, actualmente sin evidencia de enfermedad (NED).'
        : 'Enfermedad localizada / en seguimiento, sin evidencia de progresión documentada (Vigilancia oncológica).';
      followUpMode = 'CURATIVE_SURVEILLANCE';
      modeLabel = 'Modo A — Vigilancia post-tratamiento curativo (Enfermedad localizada)';
      treatmentIntent = 'Detección precoz de recidiva locorregional o sistémica curable';
    }
  }

  // 5. Extracción de fechas clave
  let lastImagingDate = 'No documentada';
  const imgDateMatch = clinicalText.match(/(?:tac|tc|tomograf[ií]a|rm|rmn|pet|pet-tc|pet-ct)[^\d]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (imgDateMatch && imgDateMatch[1]) {
    lastImagingDate = imgDateMatch[1];
  }

  let lastTreatmentDate = 'No documentada';
  const txDateMatch = clinicalText.match(/(?:quimioterapia|ciclo|infusi[oó]n|folfox|folfiri|adyuvancia)[^\d]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (txDateMatch && txDateMatch[1]) {
    lastTreatmentDate = txDateMatch[1];
  }

  return {
    ...baseProfile,
    isStageIV,
    diseaseStatus,
    diseaseStatusDescription,
    followUpMode,
    modeLabel,
    activeTreatment,
    hasActiveSystemicTreatment,
    treatmentIntent,
    lastImagingDate,
    lastTreatmentDate,
    summary: `${baseProfile.organ} — ${baseProfile.histology} (${baseProfile.stage}) | ${modeLabel}`,
  };
}

/**
 * Clasifica a qué patología u órgano apunta un archivo de guía clínica
 */
export function classifyGuidelineSource(sourceName: string): { organ: string; pathology: string; isKnown: boolean } {
  const norm = normalizeStr(sourceName || '');
  
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
      activeScenarioRecommendations = g.scenarios?.localizedSurveillance || null;
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
  if (!profile.organ || profile.organ === 'Desconocido / No identificado') {
    return {
      status: 'NO_MATCHING_GUIDELINE',
      guideline: null,
      message: 'No se pudo identificar el órgano primario del paciente.',
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



