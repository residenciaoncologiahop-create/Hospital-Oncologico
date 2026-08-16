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
}

export interface GuidelineMatchResult {
  status: 'EXACT_MATCH' | 'HISTOLOGY_INCOMPLETE' | 'NO_MATCHING_GUIDELINE';
  guideline: NCCNGuideline | null;
  message?: string;
}

export const nccnGuidelines: NCCNGuideline[] = [
  // ─────────────────────────────────────────────
  // 1. CÁNCER DE MAMA — NCCN Breast Cancer v4.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección precoz de recaída locorregional o a distancia, manejo de secuelas del tratamiento (linfedema, cardiotoxicidad, menopausia inducida), y promoción de adherencia a terapia endocrina o anti-HER2 adyuvante.',
    schedule:
      'Años 1–3: consulta oncológica cada 3–6 meses. Años 4–5: cada 6–12 meses. A partir del año 6: anual de por vida. En pacientes con terapia endocrina activa, control por ginecología/endocrinología al menos anual.',
    imaging:
      'Mamografía bilateral (o de mama restante en mastectomía unilateral) anual, iniciando 6–12 meses post-radioterapia. RM mamaria solo si riesgo alto residual (mutación BRCA, densidad muy elevada, tejido residual post-conservadora). TAC, PET-TC y gammagrafía ósea NO se recomiendan de rutina en estadios I–III asintomáticos.',
    labs:
      'No se recomiendan marcadores tumorales rutinarios (CA 15-3, CA 27.29, CEA) en seguimiento asintomático (categoría 2A). Hemograma y función hepática si hay síntomas o hallazgos clínicos. En terapia con tamoxifeno: ecografía pélvica solo ante sangrado uterino. En inhibidores de aromatasa: densitometría ósea basal y periódica (cada 1–2 años).',
    alarmSigns:
      'Nuevo nódulo mamario o adenopatía axilar/supraclavicular; dolor óseo persistente o fractura patológica; disnea inexplicada; cefalea o déficit neurológico; sangrado uterino anormal (tamoxifeno); edema de miembro superior (linfedema).',
    specialConsiderations:
      'Portadoras de BRCA1/2: considerar salpingo-ooforectomía y vigilancia específica. Terapia endocrina: optimizar adherencia (5–10 años). Cardioprotección si recibió antraciclinas/trastuzumab (ecocardiograma periódico). Evaluar salud ósea y calidad de vida.',
    source: 'NCCN Breast Cancer v4.2024',
    version: 'v4.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 2. CÁNCER DE CÉRVIX — NCCN Cervical Cancer v1.2024
  // ─────────────────────────────────────────────
  {
    id: 'cervical-cancer',
    pathology: 'Cáncer de cérvix (Cuello uterino)',
    organ: 'Cuello uterino',
    histologies: ['carcinoma epidermoide de cervix', 'carcinoma escamoso cervical', 'adenocarcinoma de cervix', 'adenocarcinoma cervical'],
    excludedHistologies: ['sarcoma cervical', 'neuroendocrino de cervix'],
    keywords: [
      'cérvix', 'cervix', 'cervical', 'cuello uterino', 'carcinoma escamoso de cuello',
      'carcinoma epidermoide de cervix', 'adenocarcinoma de cuello uterino'
    ],
    intention:
      'Detección precoz de recaída pélvica o a distancia, manejo de toxicidad por radioterapia pélvica (estenosis vaginal, fístulas, disfunción vesical/rectal), y seguimiento de secuelas quirúrgicas.',
    schedule:
      'Años 1–2: consulta cada 3–6 meses. Años 3–5: cada 6–12 meses. Después del año 5: anual. Examen pélvico con espéculo y tacto vaginal/rectal en cada visita.',
    imaging:
      'TAC tórax-abdomen-pelvis o PET-TC con contraste: cada 6 meses en los primeros 2 años post-tratamiento en estadios IB2–IVA de alto riesgo, o ante hallazgos sospechosos. No se recomienda imagen de rutina en estadios tempranos asintomáticos. Citología vaginal/Papanicolaou anual.',
    labs:
      'SCC (carcinoma escamoso) o CA-125 (adenocarcinoma) según indicación específica ante sospecha. Función renal periódica en pacientes con antecedentes obstructivos.',
    alarmSigns:
      'Sangrado vaginal anormal; dolor pélvico o lumbar persistente; edema unilateral de miembro inferior; hematuria o fístulas; rectorragia o tenesmo; adenopatías inguinales o supraclaviculares.',
    specialConsiderations:
      'Radioterapia pélvica previa: dilatadores vaginales y rehabilitación pélvica. Asesoría en salud sexual y función renal.',
    source: 'NCCN Cervical Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 3. CÁNCER DE COLON — NCCN Colon Cancer v2.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección precoz de recaída hepática, pulmonar o locorregional potencialmente resecable; vigilancia endoscópica de neoplasias metacrónicas; manejo de secuelas quirúrgicas.',
    schedule:
      'Años 1–3: consulta oncológica cada 3–6 meses. Años 4–5: cada 6 meses. A partir del año 6: anual. Colonoscopía al año de la resección (si normal, a los 3 años y luego cada 5 años).',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste IV: cada 6–12 meses durante los primeros 3–5 años en estadios II–III de alto riesgo. PET-TC: no de rutina, indicado ante sospecha de recaída con CEA en ascenso y TAC negativo.',
    labs:
      'CEA (antígeno carcinoembrionario): cada 3–6 meses durante los primeros 5 años (estadios II–III). Hemograma y función hepática en controles programados.',
    alarmSigns:
      'Cambios en el hábito intestinal, sangrado rectal, dolor abdominal cólico persistente; pérdida de peso involuntaria; ascitis; ictericia; disnea o hemoptisis.',
    specialConsiderations:
      'Evaluar síndrome de Lynch (MMR/MSI). Vigilancia de toxicidad por oxaliplatino (neuropatía periférica). Cuidado de ostomías si aplica.',
    source: 'NCCN Colon Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 4. CÁNCER DE RECTO — NCCN Rectal Cancer v2.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección precoz de recaída local (anastomótica, pélvica) o a distancia (hígado, pulmón); vigilancia endoscópica; manejo de disfunción anorrectal, sexual y urinaria post-tratamiento.',
    schedule:
      'Años 1–3: consulta cada 3–6 meses (clínica + CEA). Años 4–5: cada 6 meses. Después del año 5: anual. Proctosigmoidoscopía flexible cada 6 meses por 2–3 años en casos de resección anterior sin RT o según abordaje.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste IV: cada 6–12 meses por 3–5 años (estadios II–III). RM de pelvis ante sospecha de recidiva locorregional.',
    labs:
      'CEA cada 3–6 meses por 5 años. Hemograma y perfil metabólico en controles.',
    alarmSigns:
      'Rectorragia, dolor pélvico o perianal, tenesmo, cambio en el hábito evacuatorio, masa pélvica palpable, dolor ciático o lumbar.',
    specialConsiderations:
      'Manejo del síndrome de resección anterior baja (LARS). Cuidados de colostomía definitiva si AAP. Secuelas de RT pélvica (proctitis actínica).',
    source: 'NCCN Rectal Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 5. CÁNCER DE PRÓSTATA — NCCN Prostate Cancer v4.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección precoz de recaída bioquímica (elevación de PSA), monitoreo de respuesta a TDA, y manejo de secuelas (disfunción eréctil, incontinencia, osteoporosis, salud cardiovascular).',
    schedule:
      'Años 1–5: PSA y evaluación clínica cada 6–12 meses (cada 3–6 meses si alto riesgo o en TDA). Después del año 5: anual.',
    imaging:
      'Gammagrafía ósea y TAC/RM de pelvis: indicados ante sospecha de recaída clínica o bioquímica rápida. PET-TC con PSMA indicado en recaída bioquímica post-prostatectomía o post-RT. No se recomiendan imágenes rutinarias en pacientes asintomáticos con PSA indetectable.',
    labs:
      'PSA total en cada consulta. Testosterona sérica en pacientes en bloqueo androgénico (objetivo <50 ng/dL). Densitometría ósea y perfil lipídico/glucémico en TDA prolongada.',
    alarmSigns:
      'Elevación de PSA >0.2 ng/mL post-prostatectomía; elevación sobre nadir + 2 ng/mL post-radioterapia; dolor óseo nuevo; síntomas urinarios obstructivos agudos; debilidad de miembros inferiores.',
    specialConsiderations:
      'Prevención de osteoporosis y riesgo metabólico en TDA. Manejo de continencia y salud sexual.',
    source: 'NCCN Prostate Cancer v4.2024',
    version: 'v4.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 6. CÁNCER DE OVARIO — NCCN Ovarian Cancer v1.2024
  // ─────────────────────────────────────────────
  {
    id: 'ovarian-cancer',
    pathology: 'Cáncer de ovario / Trompas / Peritoneal primario',
    organ: 'Ovario',
    histologies: ['seroso de alto grado', 'seroso de bajo grado', 'endometrioide de ovario', 'celulas claras de ovario', 'carcinoma epitelial de ovario'],
    excludedHistologies: ['tumor de celulas germinales de ovario', 'estroma gonadal', 'granulosa', 'krukenberg'],
    keywords: [
      'carcinoma seroso de ovario', 'cáncer de ovario', 'adenocarcinoma de ovario',
      'carcinoma de trompa de falopio', 'carcinoma peritoneal primario', 'ca-125 ovario'
    ],
    intention:
      'Detección precoz de recaída peritoneal/ganglionar, monitoreo de respuesta a terapia de mantenimiento (PARP inhibidores, bevacizumab), y manejo de toxicidades.',
    schedule:
      'Años 1–2: consulta cada 2–4 meses. Años 3–5: cada 3–6 meses. Después del año 5: cada 6–12 meses. Examen físico y pélvico en cada visita.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste: ante sospecha clínica o ascenso de CA-125. No se recomienda TAC rutinario en respuesta completa asintomática sin elevación de marcadores.',
    labs:
      'CA-125 en cada visita de seguimiento. Hemograma y función renal periódica en pacientes con inhibidores de PARP.',
    alarmSigns:
      'Aumento sostenido de CA-125; distensión abdominal o ascitis; dolor abdominal/pélvico persistente; alteraciones del tránsito intestinal; disnea inexplicada.',
    specialConsiderations:
      'Test de mutación BRCA1/2 y HRD. Consejo genético oncológico familiar. Vigilancia de anemia y plaquetopenia con PARP inhibidores.',
    source: 'NCCN Ovarian Cancer/Fallopian Tube Cancer/Primary Peritoneal Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 7. CÁNCER DE ENDOMETRIO — NCCN Uterine Neoplasms v1.2024
  // ─────────────────────────────────────────────
  {
    id: 'endometrial-cancer',
    pathology: 'Cáncer de endometrio',
    organ: 'Endometrio',
    histologies: ['endometrioide', 'seroso de endometrio', 'celulas claras de endometrio', 'carcinosarcoma endometrial', 'adenocarcinoma de endometrio'],
    excludedHistologies: ['leiomiosarcoma uterino', 'sarcoma del estroma endometrial', 'sarcoma uterino'],
    keywords: [
      'adenocarcinoma de endometrio', 'carcinoma endometrioide', 'cáncer de endometrio',
      'neoplasia de endometrio', 'carcinoma uterino'
    ],
    intention:
      'Detección precoz de recaída en cúpula vaginal o a distancia; manejo de secuelas de radioterapia y cirugía.',
    schedule:
      'Años 1–3: consulta cada 3–6 meses. Años 4–5: cada 6 meses. Después del año 5: anual. Examen con espéculo de cúpula vaginal en cada visita.',
    imaging:
      'TAC de tórax-abdomen-pelvis: ante síntomas, hallazgos en examen pélvico o estadios avanzados de alto riesgo. No de rutina en estadio I asintomático.',
    labs:
      'CA-125 opcional en estadios avanzados o seroso si estuvo elevado basalmente.',
    alarmSigns:
      'Sangrado o flujo vaginal post-tratamiento; dolor pélvico o lumbar; disnea, tos; edema unilateral de miembro inferior.',
    specialConsiderations:
      'Determinación de subtipo molecular (POLE, MMRd/MSI, p53abn). Síndrome de Lynch screening. Dilatadores vaginales post-braquiterapia.',
    source: 'NCCN Uterine Neoplasms v1.2024',
    version: 'v1.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 8. MELANOMA CUTÁNEO — NCCN Melanoma: Cutaneous v3.2024
  // ─────────────────────────────────────────────
  {
    id: 'cutaneous-melanoma',
    pathology: 'Melanoma cutáneo',
    organ: 'Piel',
    histologies: ['melanoma de extension superficial', 'melanoma nodular', 'melanoma lentigo maligno', 'melanoma acral lentiginoso', 'melanoma cutaneo'],
    excludedHistologies: ['melanoma uveal', 'melanoma mucoso', 'carcinoma basocelular', 'carcinoma espinocelular'],
    keywords: [
      'melanoma cutáneo', 'melanoma maligno cutáneo', 'melanoma de piel',
      'breslow', 'ganglio centinela melanoma', 'braf v600'
    ],
    intention:
      'Detección de recaída cutánea, ganglionar regional o a distancia; pesquisa de nuevos primarios cutáneos; vigilancia de toxicidad por inmunoterapia o terapia dirigida.',
    schedule:
      'Estadio IA: examen clínico y dermatoscópico anual. Estadios IB–II: cada 3–6 meses por 3 años, luego anual. Estadios III–IV resecados: cada 3–6 meses por 5 años, luego anual.',
    imaging:
      'Estadios IB–II de alto riesgo y estadio III: TAC tórax-abdomen-pelvis ± cerebro cada 6–12 meses por 3–5 años. PET-TC o RM cerebral ante sospecha de recaída.',
    labs:
      'LDH en enfermedad avanzada. En inmunoterapia activa: función tiroidea (TSH), hepática, renal y hemograma por irAEs.',
    alarmSigns:
      'Nuevas lesiones pigmentadas o cambios en lunares previos; adenopatías palpables; cefalea persistente o signos neurológicos; dolor abdominal o tos persistente.',
    specialConsiderations:
      'Educación estricta en autoexamen y fotoprotección. Mutación BRAF V600 para indicación de adyuvancia/tratamiento sistémico.',
    source: 'NCCN Melanoma: Cutaneous v3.2024',
    version: 'v3.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 9. CÁNCER DE PIEL NO MELANOMA — NCCN SCC v1.2024 / BCC v2.2024
  // ─────────────────────────────────────────────
  {
    id: 'non-melanoma-skin-cancer',
    pathology: 'Cáncer de piel no melanoma (Carcinoma Basocelular / Espinocelular)',
    organ: 'Piel',
    histologies: ['carcinoma basocelular', 'basocelular', 'bcc', 'carcinoma espinocelular cutaneo', 'carcinoma escamoso cutaneo', 'scc cutaneo'],
    excludedHistologies: ['melanoma', 'merkel', 'sarcoma cutaneo', 'dermatofibrosarcoma'],
    keywords: [
      'carcinoma basocelular', 'carcinoma espinocelular de piel', 'carcinoma escamocelular cutáneo',
      'cáncer de piel no melanoma', 'bcc cutáneo', 'scc piel'
    ],
    intention:
      'Detección precoz de recaída local, metástasis ganglionares en SCC de alto riesgo, y pesquisa de nuevos tumores cutáneos.',
    schedule:
      'BCC: examen de piel completa cada 6–12 meses por 2 años, luego anual. SCC de bajo riesgo: cada 6–12 meses por 2 años. SCC de alto riesgo (invasión perineural, ganglios +): cada 1–3 meses año 1, cada 3–6 meses años 2–5.',
    imaging:
      'SCC de alto riesgo con sospecha ganglionar o perineural: TAC o RM de cuenca linfática afectada. No de rutina en BCC simple.',
    labs:
      'No se requieren de rutina en seguimiento estándar.',
    alarmSigns:
      'Nódulos, úlceras o placas en sitio cicatrizal previo; adenopatías regionales; parestesias faciales o déficit motor en tumores de cabeza/cuello.',
    specialConsiderations:
      'Pacientes inmunosuprimidos (trasplantados): seguimiento intensivo. Fotoprotección estricta FPS ≥50.',
    source: 'NCCN Squamous Cell Skin Cancer v1.2024 / Basal Cell Skin Cancer v2.2024',
    version: 'v1.2024 / v2.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 10. CÁNCER DE ESTÓMAGO — NCCN Gastric Cancer v2.2024
  // ─────────────────────────────────────────────
  {
    id: 'gastric-cancer',
    pathology: 'Cáncer de estómago (Adenocarcinoma Gástrico)',
    organ: 'Estómago',
    histologies: ['adenocarcinoma gastrico', 'adenocarcinoma de estomago', 'adenocarcinoma de la union esofagogastrica'],
    excludedHistologies: ['gist', 'tumor del estroma gastrointestinal', 'linfoma gastrico', 'neuroendocrino gastrico', 'tne gastrico'],
    keywords: [
      'adenocarcinoma gástrico', 'adenocarcinoma de estómago', 'cáncer gástrico',
      'gastrectomía', 'carcinoma gástrico difuso', 'carcinoma gástrico intestinal'
    ],
    intention:
      'Detección precoz de recaída local, peritoneal o a distancia; soporte nutricional y monitoreo de secuelas post-gastrectomía.',
    schedule:
      'Años 1–3: consulta cada 3–6 meses. Años 4–5: cada 6–12 meses. Después del año 5: anual. Evaluación nutricional estricta en cada visita.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste oral e IV: cada 6–12 meses por los primeros 3 años (estadios II–III). Endoscopía alta de control a los 6–12 meses si gastrectomía parcial.',
    labs:
      'Hemograma, ferritina, vitamina B12 (obligatoria suplementación IM de por vida en gastrectomía total). Marcadores CEA y CA 19-9 ante sospecha clínica.',
    alarmSigns:
      'Disfagia, vómitos persistentes, pérdida de peso, dolor epigástrico, melena, ascitis, ictericia.',
    specialConsiderations:
      'Soporte nutricional especializado. Evaluación de HER2 y MMR/MSI en enfermedad avanzada.',
    source: 'NCCN Gastric Cancer v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 11. ADENOCARCINOMA DE PÁNCREAS — NCCN Pancreatic Adenocarcinoma v2.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección de recaída locorregional o a distancia (hepática/peritoneal), manejo de insuficiencia pancreática exocrina/endocrina y soporte nutricional.',
    schedule:
      'Post-resección: consulta cada 3–6 meses por 2 años, luego cada 6 meses hasta el año 5, luego anual. En enfermedad avanzada: evaluación cada 2–3 ciclos de quimioterapia.',
    imaging:
      'TAC multicorte de abdomen y pelvis con contraste trifásico (o RM abdominal): cada 3–6 meses durante los primeros 2 años post-resección, luego cada 6–12 meses. TAC de tórax periódico.',
    labs:
      'CA 19-9 sérico en cada control (interpretar junto con función biliar/bilirrubina). Glucemia/HbA1c para control de diabetes post-resección. Elastasa fecal si síntomas de esteatorrea.',
    alarmSigns:
      'Ictericia, coluria, dolor epigástrico irradiado a dorso, pérdida de peso rápida, esteatorrea, descontrol glucémico agudo.',
    specialConsiderations:
      'Terapia de reemplazo con enzimas pancreáticas (PERT). Consejo genético para test germinal (BRCA1/2, PALB2). Manejo analgésico precoz.',
    source: 'NCCN Pancreatic Adenocarcinoma v2.2024',
    version: 'v2.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 12. TUMORES NEUROENDOCRINOS — NCCN Neuroendocrine and Adrenal Tumors v1.2024
  // ─────────────────────────────────────────────
  {
    id: 'neuroendocrine-tumors',
    pathology: 'Tumores neuroendocrinos pancreáticos y gastrointestinales (TNE / NET)',
    organ: 'Páncreas / Tracto Gastroenteropancreático',
    histologies: ['tumor neuroendocrino', 'carcinoma neuroendocrino', 'pnet', 'tne pancreatico', 'tne gastrointestinal', 'carcinoide'],
    excludedHistologies: ['adenocarcinoma ductal', 'adenocarcinoma de colon', 'adenocarcinoma gastrico'],
    keywords: [
      'tumor neuroendocrino', 'neuroendocrino de páncreas', 'tne pancreático', 'pnet',
      'tumor neuroendocrino gastrointestinal', 'net g1', 'net g2', 'net g3', 'cromogranina a'
    ],
    intention:
      'Detección precoz de progresión locorregional o hepática, control del síndrome carcinoide / hipersecreción hormonal y vigilancia tras análogos de somatostatina o PRRT.',
    schedule:
      'TNE resecado de bajo grado: consulta clínica cada 3–6 meses los primeros 2–3 años, luego cada 6–12 meses. TNE avanzado/metastásico: cada 3 meses.',
    imaging:
      'TAC o RM multiparamétrica con contraste trifásico de abdomen y pelvis cada 3–6 meses por 2 años, luego cada 6–12 meses. PET-TC con 68Ga-DOTATATE (o 64Cu-DOTATATE) ante sospecha de progresión o re-estadificación. No usar protocolos rutinarios de adenocarcinoma.',
    labs:
      'Cromogranina A (CgA) sérica basal y periódica (si estaba elevada y sin interferencia por IBP). 5-HIAA en orina de 24h en síndrome carcinoide. Péptidos hormonales específicos según funcionalidad (insulina, gastrina, glucagón).',
    alarmSigns:
      'Flushing, diarrea secretoria profusa, dolor abdominal, ictericia, disnea (cardiopatía carcinoide), hipoglucemias inexplicadas.',
    specialConsiderations:
      'Evaluación de receptores de somatostatina por PET DOTATATE. En pacientes con análogos de somatostatina (octreotida/lanreotida): monitoreo de respuesta y función biliar/glucemia.',
    source: 'NCCN Neuroendocrine and Adrenal Tumors v1.2024',
    version: 'v1.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 13. CÁNCER DE TESTÍCULO — NCCN Testicular Cancer v1.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección precoz de recaída retroperitoneal o pulmonar; monitoreo estricto de marcadores tumorales; vigilancia de fertilidad y secuelas de toxicidad a largo plazo.',
    schedule:
      'Seminoma estadio I (vigilancia): consulta + marcadores cada 3–4 meses año 1, cada 6 meses años 2–3, luego anual. No seminoma estadio I (vigilancia): cada 2 meses año 1, cada 3 meses año 2, cada 4–6 meses años 3–4, luego anual.',
    imaging:
      'TAC de abdomen y pelvis: frecuencia según estadio e histología (cada 4–6 meses en vigilancia activa de seminoma año 1, luego espaciado). RM abdominal en jóvenes para reducir radiación. Ecografía del testículo contralateral anual.',
    labs:
      'AFP, β-HCG y LDH séricas en CADA visita de seguimiento. Perfil hormonal (testosterona, LH, FSH) ante síntomas de hipogonadismo.',
    alarmSigns:
      'Aumento de marcadores tumorales; masa palpable en retroperitoneo o cuello; disnea o tos; masa en testículo contralateral.',
    specialConsiderations:
      'Criopreservación de semen previa a tratamientos. Monitoreo cardiovascular, metabólico y auditivo tras quimioterapia con cisplatino/bleomicina.',
    source: 'NCCN Testicular Cancer v1.2024',
    version: 'v1.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 14. CÁNCER DE VEJIGA — NCCN Bladder Cancer v3.2024
  // ─────────────────────────────────────────────
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
    intention:
      'Detección de recaída intravesical en tumores no músculo-invasores, o recaída a distancia/vías superiores post-cistectomía.',
    schedule:
      'No músculo-invasor (alto riesgo): cistoscopía + citología urinaria cada 3 meses por 2 años, luego cada 6 meses por 2 años, luego anual. Post-cistectomía: consulta cada 3–6 meses por 2 años, luego cada 6 meses.',
    imaging:
      'Post-cistectomía: TAC tórax-abdomen-pelvis con contraste cada 6–12 meses por 3 años. Uro-TAC periódico para evaluar tracto urinario superior (uréteres y pelvis renal).',
    labs:
      'Citología urinaria en cada cistoscopía. Función renal (urea, creatinina, electrolitos) y vitamina B12 en derivaciones urinarias ileales.',
    alarmSigns:
      'Hematuria macroscópica o microscópica nueva, disuria, dolor en flanco o fosa lumbar, fiebre urinaria.',
    specialConsiderations:
      'Cumplimiento del esquema de BCG mantenimiento en CVNMI. Cuidado de estomas o neovejiga.',
    source: 'NCCN Bladder Cancer v3.2024',
    version: 'v3.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 15. CÁNCER DE PULMÓN NSCLC — NCCN NSCLC v5.2024
  // ─────────────────────────────────────────────
  {
    id: 'lung-nsclc',
    pathology: 'Cáncer de pulmón de células no pequeñas (NSCLC)',
    organ: 'Pulmón',
    histologies: ['adenocarcinoma de pulmon', 'carcinoma escamoso de pulmon', 'carcinoma epidermoide de pulmon', 'carcinoma de celulas grandes de pulmon', 'nsclc'],
    excludedHistologies: ['carcinoma microcitico', 'sclc', 'carcinoide bronquial', 'mesotelioma'],
    keywords: [
      'adenocarcinoma pulmonar', 'carcinoma escamoso de pulmón', 'nsclc', 'cáncer de pulmón no microcítico',
      'lobectomía pulmonar', 'egfr', 'alk', 'pdl1 pulmon'
    ],
    intention:
      'Detección de recidiva local, mediastinal o metastásica (cerebro, hueso, glándulas suprarrenales); monitoreo de toxicidades de TKIs e inmunoterapia.',
    schedule:
      'Post-resección curativa (estadios I–II): consulta y TAC cada 6 meses por 2–3 años, luego anual. Estadio III post-tratamiento definitivo: cada 3–6 meses por 3 años, luego anual.',
    imaging:
      'TAC de tórax con contraste (seguimiento estándar). TAC abdomen superior si hallazgos previos. RM de encéfalo con contraste en portadores de alteraciones moleculares (EGFR, ALK) o estadios avanzados resecados.',
    labs:
      'Perfil hepático, renal y tiroideo (TSH) en inmunoterapia/TKIs.',
    alarmSigns:
      'Tos nueva o persistente, hemoptisis, disnea, dolor torácico u óseo, cefalea, alteraciones neurológicas focales.',
    specialConsiderations:
      'Cese tabáquico absoluto. Evaluación de resistencia molecular (biopsia líquida) ante sospecha de progresión con terapias dirigidas.',
    source: 'NCCN Non-Small Cell Lung Cancer v5.2024',
    version: 'v5.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 16. CÁNCER DE PULMÓN SCLC — NCCN SCLC v3.2024
  // ─────────────────────────────────────────────
  {
    id: 'lung-sclc',
    pathology: 'Cáncer de pulmón de células pequeñas (SCLC / Microcítico)',
    organ: 'Pulmón',
    histologies: ['carcinoma microcitico de pulmon', 'carcinoma de celulas pequeñas de pulmon', 'sclc', 'oat cell'],
    excludedHistologies: ['adenocarcinoma', 'carcinoma escamoso', 'nsclc', 'carcinoide atipico'],
    keywords: [
      'carcinoma microcítico de pulmón', 'carcinoma de células pequeñas de pulmón', 'sclc',
      'cáncer microcítico', 'irradiación craneal profiláctica'
    ],
    intention:
      'Detección temprana de recaída sistémica o en SNC; manejo de toxicidades y secuelas post-quimiorradioterapia.',
    schedule:
      'Respuesta completa post-tratamiento: consulta cada 3 meses durante el año 1, cada 3–4 meses el año 2, cada 6 meses los años 3–5, luego anual.',
    imaging:
      'TAC de tórax/abdomen con contraste cada 3–4 meses los primeros 2 años. RM cerebral con contraste cada 3–4 meses el año 1 y cada 6 meses el año 2 si no recibió PCI (o vigilancia tras PCI).',
    labs:
      'Hemograma, función renal y perfil electrolítico (vigilancia de SIADH).',
    alarmSigns:
      'Cefalea matutina, náuseas, déficit focal, disnea súbita, síndrome de vena cava superior, dolor óseo.',
    specialConsiderations:
      'Evaluación de irradiación craneal profiláctica (PCI) vs resonancia seriada de vigilancia cerebral.',
    source: 'NCCN Small Cell Lung Cancer v3.2024',
    version: 'v3.2024',
    organization: 'NCCN',
  },

  // ─────────────────────────────────────────────
  // 17. CÁNCER DE VÍAS BILIARES — NCCN Hepatobiliary Cancers v3.2024
  // ─────────────────────────────────────────────
  {
    id: 'biliary-tract-cancer',
    pathology: 'Cáncer de vías biliares y vesícula biliar',
    organ: 'Vías biliares / Vesícula biliar',
    histologies: ['colangiocarcinoma intrahepatico', 'colangiocarcinoma extrahepatico', 'carcinoma de vesicula biliar', 'adenocarcinoma de vias biliares', 'ampuloma'],
    excludedHistologies: ['hepatocarcinoma puro', 'sarcoma hepatico', 'neuroendocrino biliar'],
    keywords: [
      'colangiocarcinoma', 'carcinoma de vesícula biliar', 'cáncer de vías biliares',
      'colangiocarcinoma intrahepático', 'colangiocarcinoma hiliar', 'klatskin', 'ampuloma'
    ],
    intention:
      'Detección precoz de recaída hepática/peritoneal, monitoreo de la vía biliar y prevención de colangitis recurrente.',
    schedule:
      'Post-resección: consulta cada 3–6 meses durante los primeros 2 años, luego cada 6 meses por 3 años. En enfermedad avanzada: cada 2–3 ciclos.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste trifásico o RM hepática con colangiorresonancia cada 3–6 meses post-resección por 2 años, luego cada 6–12 meses.',
    labs:
      'CA 19-9 y CEA séricos en cada control. Bilirrubina total y fraccionada, fosfatasa alcalina, GGT y transaminasas en cada visita.',
    alarmSigns:
      'Ictericia nueva o en aumento, coluria, acolia, fiebre con escalofríos (colangitis), dolor en hipocondrio derecho, ascitis.',
    specialConsiderations:
      'Perfil genómico en colangiocarcinoma (fusiones FGFR2, mutaciones IDH1, MSI-H). Monitoreo de permeabilidad de stents biliares.',
    source: 'NCCN Hepatobiliary Cancers v3.2024',
    version: 'v3.2024',
    organization: 'NCCN',
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

/**
 * Extrae el perfil tumoral ancla del paciente a partir de su diagnóstico explícito
 * y/o de la historia clínica patológica, filtrando menciones secundarias.
 */
export function extractPatientTumorProfile(clinicalText: string, explicitDiagnosis: string = ''): PatientTumorProfile {
  const normDx = normalizeStr(explicitDiagnosis || '');
  const normText = normalizeStr(clinicalText || '');

  // 1. Detección prioritaria de órgano a partir del diagnóstico explícito
  let organ = 'Desconocido / No identificado';

  const detectOrganFromStr = (str: string): string => {
    if (str.includes('pancrea')) return 'Páncreas';
    if (str.includes('endometri') || str.includes('uterin') || str.includes('utero')) return 'Endometrio / Útero';
    if (str.includes('cervic') || str.includes('cervix') || str.includes('cuello uterino')) return 'Cuello uterino (Cérvix)';
    if (str.includes('mama') || str.includes('breast')) return 'Mama';
    if (str.includes('colon') || str.includes('ciego') || str.includes('sigmoide')) return 'Colon';
    if (str.includes('recto') || str.includes('rectal')) return 'Recto';
    if (str.includes('prostata') || str.includes('prostatic')) return 'Próstata';
    if (str.includes('ovario') || str.includes('trompa') || str.includes('peritoneal primario')) return 'Ovario';
    if (str.includes('pulmon') || str.includes('bronqu')) return 'Pulmón';
    if (str.includes('estomago') || str.includes('gastric')) return 'Estómago';
    if (str.includes('testiculo') || str.includes('testicular')) return 'Testículo';
    if (str.includes('vejiga') || str.includes('urotelial')) return 'Vejiga';
    if (str.includes('melanoma') || (str.includes('piel') && (str.includes('basocelular') || str.includes('espinocelular')))) return 'Piel';
    if (str.includes('vias biliares') || str.includes('vesicula biliar') || str.includes('colangiocarcinoma')) return 'Vías biliares / Vesícula';
    if (str.includes('renal') || str.includes('riñon') || str.includes('rinon')) return 'Riñón';
    return '';
  };

  // Intentar primero con el campo de diagnóstico estructurado
  if (normDx) {
    const detected = detectOrganFromStr(normDx);
    if (detected) organ = detected;
  }

  // Si no se encontró en el diagnóstico estructurado, buscar en la historia omitiendo frases secundarias
  if (organ === 'Desconocido / No identificado') {
    // Filtrar frases secundarias que puedan confundir el órgano primario
    const cleanedText = normText
      .replace(/guia (?:nccn|esmo|ascol)? (?:de|para)? [a-z\s]+/g, ' ')
      .replace(/antecedente[s]? (?:gineco|familiar|de) [a-z\s]+/g, ' ')
      .replace(/diagnostico diferencial [a-z\s]+/g, ' ')
      .replace(/se descarta [a-z\s]+/g, ' ');

    // Buscar encabezados de diagnóstico directo
    const dxMatch = clinicalText.match(/(?:diagn[oó]stico|anatom[ií]a patol[oó]gica|biopsia|ap|tumor primario)[\s:]+([^\n.;]+)/i);
    if (dxMatch && dxMatch[1]) {
      const detected = detectOrganFromStr(normalizeStr(dxMatch[1]));
      if (detected) organ = detected;
    }

    if (organ === 'Desconocido / No identificado') {
      const detected = detectOrganFromStr(cleanedText);
      if (detected) organ = detected;
    }
  }

  // 2. Detección de estirpe histológica
  let histology = 'No especificada / Pendiente de confirmación';
  let isHistologyIncomplete = false;

  const targetSearchStr = `${normDx} ${normText}`;
  const hasNeuroendocrine =
    targetSearchStr.includes('neuroendocrin') || targetSearchStr.includes('tne') || targetSearchStr.includes('pnet') || targetSearchStr.includes('carcinoide') || targetSearchStr.includes('net g');

  if (hasNeuroendocrine) {
    histology = 'Tumor neuroendocrino (TNE / NET)';
  } else if (targetSearchStr.includes('adenocarcinoma ductal') || (targetSearchStr.includes('adenocarcinoma') && targetSearchStr.includes('ductal'))) {
    histology = 'Adenocarcinoma ductal';
  } else if (targetSearchStr.includes('adenocarcinoma')) {
    histology = 'Adenocarcinoma';
  } else if (targetSearchStr.includes('carcinoma epidermoide') || targetSearchStr.includes('carcinoma escamoso') || targetSearchStr.includes('escamocelular')) {
    histology = 'Carcinoma epidermoide / escamoso';
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
    histology = 'Carcinoma de células claras';
  } else if (targetSearchStr.includes('seroso')) {
    histology = 'Carcinoma seroso';
  }

  // Detección de diagnóstico incompleto (neoplasia sin histología)
  if (
    (targetSearchStr.includes('neoplasia') || targetSearchStr.includes('tumor') || targetSearchStr.includes('lesion') || targetSearchStr.includes('masa')) &&
    histology === 'No especificada / Pendiente de confirmación'
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
  if (normText.includes('libre de enfermedad') || normText.includes('ned') || normText.includes('sin evidencia de enfermedad') || normText.includes('remision completa')) {
    clinicalStatus = 'Sin evidencia de enfermedad (NED / Remisión Completa)';
  } else if (normText.includes('progresion') || normText.includes('recidiva') || normText.includes('recaida')) {
    clinicalStatus = 'Progresión / Recidiva';
  } else if (normText.includes('respuesta parcial')) {
    clinicalStatus = 'Respuesta Parcial';
  } else if (normText.includes('enfermedad estable')) {
    clinicalStatus = 'Enfermedad Estable';
  } else if (normText.includes('postquirurgico') || normText.includes('postoperatorio') || normText.includes('resecado') || normText.includes('postquirurgica')) {
    clinicalStatus = 'Postquirúrgico / Postoperatorio';
  }

  // 6. Tratamiento
  let treatment = 'No documentado';
  if (normText.includes('adyuvancia finalizada') || normText.includes('quimioterapia adyuvante finalizada') || normText.includes('completo adyuvancia')) {
    treatment = 'Quimioterapia adyuvante finalizada';
  } else if (normText.includes('adyuvancia') || normText.includes('quimioterapia adyuvante')) {
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
 * Validador integral de fuentes candidatas con Bloqueo Clínico de Seguridad (Diagnóstico -> Guía)
 */
export function validateCandidateSources(
  clinicalText: string,
  attachedFiles: { name: string; type: string; data: string }[] = [],
  explicitDiagnosis: string = ''
): CandidateValidationResult {
  const profile = extractPatientTumorProfile(clinicalText, explicitDiagnosis);

  // 1. Si el diagnóstico histológico es incompleto
  if (profile.isHistologyIncomplete) {
    return {
      canProceed: false,
      profile,
      sourceMode: 'NONE',
      validAttachedGuidelines: [],
      validSystemGuideline: null,
      excludedSources: [],
      stopReason: 'HISTOLOGY_INCOMPLETE',
      stopTitle: 'Diagnóstico Histológico Incompleto',
      stopMessage: 'El texto clínico documenta una lesión o neoplasia sin confirmación de estirpe histológica. El sistema tiene prohibido asumir una estirpe por defecto o emitir un plan de seguimiento específico sin histología demostrada.',
    };
  }

  const hasAttached = attachedFiles && attachedFiles.length > 0;
  const excludedSources: { name: string; detectedTarget: string; reason: string }[] = [];
  const validAttachedGuidelines: { name: string; type: string; data: string }[] = [];

  // 2. Evaluación estricta de guías adjuntadas manualmente (Aisladas del texto del paciente)
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

  // 3. Evaluación de guías del sistema basada EXCLUSIVAMENTE en el perfil estructurado del paciente
  const systemMatch = matchGuidelineByProfile(profile);

  if (systemMatch.status === 'EXACT_MATCH' && systemMatch.guideline) {
    return {
      canProceed: true,
      profile,
      sourceMode: 'SYSTEM_NCCN',
      validAttachedGuidelines: [],
      validSystemGuideline: systemMatch.guideline,
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
    // Verificar si la histología del paciente está excluida por esta guía
    const isExcluded = g.excludedHistologies.some(excl => normPatientHist.includes(normalizeStr(excl)));
    if (isExcluded) continue;

    // Verificar si la histología del paciente coincide con las histologías de la guía
    const isHistMatch = g.histologies.some(h => {
      const normH = normalizeStr(h);
      return normPatientHist.includes(normH) || normH.includes(normPatientHist);
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


