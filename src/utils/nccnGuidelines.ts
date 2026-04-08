/**
 * NCCN Clinical Practice Guidelines in Oncology — Versiones de referencia utilizadas:
 *
 * - Cáncer de mama:           NCCN Breast Cancer v4.2024
 * - Cáncer de cérvix:         NCCN Cervical Cancer v1.2024
 * - Cáncer de colon:          NCCN Colon Cancer v2.2024
 * - Cáncer de próstata:       NCCN Prostate Cancer v4.2024
 * - Cáncer de ovario:         NCCN Ovarian Cancer/Fallopian Tube Cancer/Primary Peritoneal Cancer v1.2024
 * - Cáncer de endometrio:     NCCN Uterine Neoplasms v1.2024
 * - Melanoma cutáneo:         NCCN Melanoma: Cutaneous v3.2024
 * - Cáncer de piel no melanoma: NCCN Squamous Cell Skin Cancer v1.2024 / Basal Cell Skin Cancer v2.2024
 * - Cáncer de estómago:       NCCN Gastric Cancer v2.2024
 * - Cáncer de páncreas:       NCCN Pancreatic Adenocarcinoma v2.2024
 * - Cáncer de testículo:      NCCN Testicular Cancer v1.2024
 * - Cáncer de vejiga:         NCCN Bladder Cancer v3.2024
 * - Cáncer de pulmón:         NCCN Non-Small Cell Lung Cancer v5.2024 / Small Cell Lung Cancer v3.2024
 * - Cáncer de recto:          NCCN Rectal Cancer v2.2024
 * - Cáncer de vías biliares:  NCCN Hepatobiliary Cancers v3.2024
 *
 * AVISO: Este contenido es una síntesis de referencia clínica basada en guías NCCN 2024.
 * No reemplaza el criterio médico individualizado ni la consulta de la guía completa actualizada.
 */

export interface NCCNGuideline {
  pathology: string;
  keywords: string[];
  intention: string;
  schedule: string;
  imaging: string;
  labs: string;
  alarmSigns: string;
  specialConsiderations: string;
  source: string;
}

export const nccnGuidelines: NCCNGuideline[] = [
  // ─────────────────────────────────────────────
  // 1. CÁNCER DE MAMA — NCCN Breast Cancer v4.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de mama',
    keywords: [
      'mama', 'breast', 'carcinoma ductal', 'carcinoma lobulillar',
      'her2', 'luminal', 'triple negativo', 'tnbc',
    ],
    intention:
      'Detección precoz de recaída locorregional o a distancia, manejo de secuelas del tratamiento (linfedema, cardiotoxicidad, menopausia inducida), y promoción de adherencia a terapia endocrina o anti-HER2 adyuvante.',
    schedule:
      'Años 1–3: consulta oncológica cada 3–6 meses. Años 4–5: cada 6–12 meses. A partir del año 6: anual de por vida. En pacientes con terapia endocrina activa, control por ginecología/endocrinología al menos anual.',
    imaging:
      'Mamografía bilateral (o de mama restante en mastectomía unilateral) anual, iniciando 6–12 meses post-radioterapia. RM mamaria solo si riesgo alto residual (mutación BRCA, densidad muy elevada, tejido residual post-conservadora). TAC, PET-TC y gammagrafía ósea NO se recomiendan de rutina en estadios I–III asintomáticos (sin evidencia de beneficio en sobrevida global).',
    labs:
      'No se recomiendan marcadores tumorales rutinarios (CA 15-3, CA 27.29, CEA) en seguimiento asintomático (categoría 2A). Hemograma y función hepática si hay síntomas o hallazgos clínicos. En terapia con tamoxifeno: ecografía pélvica solo ante sangrado uterino. En terapia con inhibidores de aromatasa: densitometría ósea basal y periódica (cada 1–2 años según T-score).',
    alarmSigns:
      'Nuevo nódulo mamario o adenopatía axilar/supraclavicular; dolor óseo persistente o fractura patológica; disnea inexplicada; cefalea, déficit neurológico o convulsiones; sangrado uterino anormal (tamoxifeno); ganancia rápida de peso o edema unilateral de miembro superior (linfedema).',
    specialConsiderations:
      'Portadoras de mutación BRCA1/2: considerar salpingo-ooforectomía profiláctica y vigilancia ginecológica específica. Pacientes con terapia endocrina: optimizar adherencia (duración 5–10 años según riesgo). Cardioprotección activa si recibió antraciclinas y/o trastuzumab (ecocardiograma periódico). Evaluar salud ósea, función sexual, calidad de vida y salud mental en cada consulta.',
    source: 'NCCN Breast Cancer v4.2024',
  },

  // ─────────────────────────────────────────────
  // 2. CÁNCER DE CÉRVIX — NCCN Cervical Cancer v1.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de cérvix',
    keywords: [
      'cérvix', 'cervix', 'cervical', 'cuello uterino', 'carcinoma escamoso cervical',
      'adenocarcinoma cervical', 'vph', 'hpv',
    ],
    intention:
      'Detección precoz de recaída pélvica o a distancia, manejo de toxicidad por radioterapia pélvica (estenosis vaginal, fístulas, disfunción vesical/rectal), y seguimiento de secuelas del tratamiento quirúrgico.',
    schedule:
      'Años 1–2: consulta cada 3–6 meses. Años 3–5: cada 6–12 meses. Después del año 5: anual. El examen pélvico con espéculo y tacto vaginal/rectal es mandatorio en cada visita.',
    imaging:
      'TAC tórax-abdomen-pelvis o PET-TC con contraste: cada 6 meses en los primeros 2 años post-tratamiento en estadios IB2–IVA de alto riesgo, o cuando haya hallazgos sospechosos. No se recomienda imagen de rutina anual en estadios tempranos sin síntomas. RM pélvica ante sospecha de recaída local. Citología vaginal/Papanicolaou: cada 3–6 meses en los primeros 2 años, luego anual.',
    labs:
      'SCC (carcinoma escamoso) o CA-125 (adenocarcinoma): pueden usarse como complemento, no como herramienta diagnóstica aislada. Función renal (urocultivo, creatinina, urea) en pacientes con obstrucción ureteral previa o post-RT.',
    alarmSigns:
      'Sangrado vaginal anormal; dolor pélvico o lumbar persistente; edema unilateral de miembro inferior (compresión linfática o trombosis); hematuria, polaquiuria, fístula vesicovaginal; rectorragia, tenesmo, fístula rectovaginal; linfadenopatía inguinal o supraclavicular nueva.',
    specialConsiderations:
      'En pacientes que recibieron radioterapia pélvica: iniciar dilatadores vaginales (dilatación progresiva) para prevenir estenosis. Asesoría en salud sexual. Evaluar función renal periódicamente (nefropatía obstructiva crónica). Considerar derivación a rehabilitación pélvica. Consejería sobre signos de fístula. En estadios IA1-IB1 tratados con cirugía conservadora: posibilidad de fertilidad futura debe discutirse.',
    source: 'NCCN Cervical Cancer v1.2024',
  },

  // ─────────────────────────────────────────────
  // 3. CÁNCER DE COLON — NCCN Colon Cancer v2.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de colon',
    keywords: [
      'colon', 'colorrectal', 'adenocarcinoma de colon', 'carcinoma de colon',
      'hemicolectomía', 'sigmoidectomía', 'colectomía',
    ],
    intention:
      'Detección precoz de recaída hepática, pulmonar o locorregional potencialmente resecable; vigilancia endoscópica de nuevas neoplasias colorrectales; manejo de secuelas quirúrgicas.',
    schedule:
      'Años 1–3: consulta oncológica cada 3–6 meses. Años 4–5: cada 6 meses. A partir del año 6: anual. Colonoscopía al año de la resección quirúrgica (o al año del diagnóstico si no se realizó preoperatoria completa). Si normal: repetir a los 3 años, luego cada 5 años.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste IV: cada 6–12 meses durante los primeros 3–5 años (estadios II-III de alto riesgo). PET-TC: no de rutina; indicado ante sospecha de recaída y CEA en ascenso sin hallazgo en TAC. Ecografía hepática como alternativa si contraindicación a contraste.',
    labs:
      'CEA (antígeno carcinoembrionario): cada 3–6 meses durante los primeros 5 años (categoría 2A). Si CEA en ascenso, realizar imagen. Hemograma y función hepática en cada control.',
    alarmSigns:
      'Cambios en el hábito intestinal, sangrado rectal, dolor abdominal cólico persistente; pérdida de peso involuntaria >10%; ascitis o distensión abdominal; ictericia; tos persistente o hemoptisis; síntomas de obstrucción intestinal.',
    specialConsiderations:
      'Evaluación de síndrome de Lynch (MSI/MMR) para vigilancia de tumores sincrónicos. Derivar a genética si edad <50 años, múltiples pólipos o historia familiar. En pacientes con ostomía: soporte de enfermería especializada y control periódico. Considerar índice de masa muscular y estado nutricional. Vigilancia de toxicidad por oxaliplatino (neuropatía periférica).',
    source: 'NCCN Colon Cancer v2.2024',
  },

  // ─────────────────────────────────────────────
  // 4. CÁNCER DE PRÓSTATA — NCCN Prostate Cancer v4.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de próstata',
    keywords: [
      'próstata', 'prostata', 'prostate', 'adenocarcinoma de próstata',
      'psa', 'prostatectomía', 'gleason', 'isup',
    ],
    intention:
      'Detección precoz de recaída bioquímica (elevación de PSA), monitoreo de respuesta a terapia de deprivación androgénica (TDA), y manejo de secuelas del tratamiento (disfunción eréctil, incontinencia, osteoporosis, síndrome metabólico).',
    schedule:
      'Años 1–5: PSA y evaluación clínica cada 6–12 meses. En pacientes con TDA activa o post-prostatectomía con alto riesgo: cada 3–6 meses. Después del año 5: anual. Tacto rectal en cada control (post-radioterapia con próstata in situ).',
    imaging:
      'Gammagrafía ósea y TAC abdomen-pelvis: indicados ante sospecha clínica de recaída (PSA en ascenso rápido, síntomas). PET-TC con PSMA (68Ga-PSMA): indicado en recaída bioquímica con PSA ≥0.5–1 ng/mL post-prostatectomía o post-RT; altamente sensible para detección temprana. RM multiparamétrica de pelvis: ante sospecha de recaída local. NO se recomiendan imágenes de rutina en vigilancia activa o bajo riesgo asintomático.',
    labs:
      'PSA sérico total: en cada visita de seguimiento. Testosterona sérica: en pacientes con TDA (objetivo <50 ng/dL en castración quirúrgica/farmacológica). Perfil metabólico (glucemia, lípidos) y densitometría ósea anual en TDA prolongada. Hemograma en pacientes con tratamiento sistémico activo.',
    alarmSigns:
      'Elevación de PSA >0.2 ng/mL post-prostatectomía (recaída bioquímica); PSA nadir + 2 ng/mL post-radioterapia (criterios Phoenix); dolor óseo nuevo o fractura patológica; síntomas urinarios obstructivos agudos; edema de miembros inferiores; síntomas neurológicos (compresión medular).',
    specialConsiderations:
      'En TDA prolongada: manejo activo de osteoporosis (calcio, vitamina D, bisfosfonatos o denosumab). Vigilancia cardiovascular (síndrome metabólico inducido por TDA). Asesoría en función sexual y urinaria. En vigilancia activa: biopsia de repetición según protocolo institucional (típicamente 12–24 meses). Evaluar calidad de vida relacionada con tratamiento en cada visita.',
    source: 'NCCN Prostate Cancer v4.2024',
  },

  // ─────────────────────────────────────────────
  // 5. CÁNCER DE OVARIO — NCCN Ovarian Cancer v1.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de ovario',
    keywords: [
      'ovario', 'ovarian', 'carcinoma de ovario', 'carcinoma peritoneal',
      'trompa de falopio', 'fallopian', 'peritoneal primario', 'ca-125',
    ],
    intention:
      'Detección precoz de recaída (principalmente peritoneal y ganglionar), monitoreo de respuesta a terapia de mantenimiento (PARP inhibidores, bevacizumab), y manejo de toxicidades del tratamiento.',
    schedule:
      'Años 1–2: consulta cada 2–4 meses. Años 3–5: cada 3–6 meses. Después del año 5: cada 6–12 meses. Examen pélvico en cada visita.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste: ante sospecha de recaída clínica o bioquímica (CA-125 en ascenso). PET-TC: complementario en recaída a distancia. No se recomienda imagen de rutina en respuesta completa sin síntomas ni elevación de CA-125 (evidencia insuficiente de beneficio en supervivencia). Ecografía transvaginal en casos seleccionados.',
    labs:
      'CA-125: en cada visita (cada 2–4 meses). HE4: complementario, especialmente si CA-125 normal. Si BRCA mutado: vigilancia de toxicidad por PARP inhibidores (hemograma, función renal). Hemograma y función hepática/renal en pacientes en tratamiento activo.',
    alarmSigns:
      'Aumento sostenido de CA-125 (≥2 veces el nadir); distensión abdominal progresiva o ascitis; dolor abdominal o pélvico nuevo; pérdida de peso involuntaria; oclusión intestinal; disnea (derrame pleural); masa palpable nueva.',
    specialConsiderations:
      'Test de mutación BRCA1/2 obligatorio para todas las pacientes (implicaciones terapéuticas con PARP inhibidores y consejo genético familiar). En terapia de mantenimiento con olaparib/niraparib: hemograma mensual y función renal periódica. Impacto en fertilidad: derivar a oncofertilidad antes del tratamiento en pacientes jóvenes con estadio temprano. Seguimiento nutricional y de calidad de vida.',
    source: 'NCCN Ovarian Cancer/Fallopian Tube Cancer/Primary Peritoneal Cancer v1.2024',
  },

  // ─────────────────────────────────────────────
  // 6. CÁNCER DE ENDOMETRIO — NCCN Uterine Neoplasms v1.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de endometrio',
    keywords: [
      'endometrio', 'endometrial', 'uterino', 'uterine', 'carcinoma de endometrio',
      'carcinoma de útero', 'histerectomía',
    ],
    intention:
      'Detección precoz de recaída vaginal (la más frecuente y tratable), ganglionar o a distancia; manejo de secuelas del tratamiento (braquiterapia, radioterapia externa, cirugía).',
    schedule:
      'Años 1–3: consulta cada 3–6 meses. Años 4–5: cada 6 meses. Después del año 5: anual. Examen pélvico con especuloscopía y citología vaginal en cada visita.',
    imaging:
      'TAC de tórax-abdomen-pelvis o PET-TC: ante sospecha clínica de recaída (síntomas, elevación de CA-125). No se recomienda imagen rutinaria en estadios I–II asintomáticos post-tratamiento. RM pélvica ante sospecha de recaída local o vaginal.',
    labs:
      'CA-125: útil en estadios avanzados como marcador de seguimiento. No se recomienda en estadios tempranos de bajo riesgo. En estadios III–IV: CA-125 en cada consulta. Hemograma y función hepática si tratamiento sistémico activo.',
    alarmSigns:
      'Sangrado vaginal post-tratamiento (puede indicar recaída vaginal); dolor pélvico o lumbar; edema unilateral de miembro inferior; hematuria; pérdida de peso involuntaria; tos persistente o hemoptisis; linfadenopatía inguinal.',
    specialConsiderations:
      'Determinación de perfil molecular (POLE, MMR/MSI, p53) para pronóstico y selección de inmunoterapia (pembrolizumab en MSI-H/dMMR). Sindrome de Lynch: vigilar otros tumores asociados (colon, ovario). Consejería sobre salud sexual, uso de dilatadores vaginales post-braquiterapia. Valorar secuelas del tratamiento hormonal si se utilizó progestina.',
    source: 'NCCN Uterine Neoplasms v1.2024',
  },

  // ─────────────────────────────────────────────
  // 7. MELANOMA CUTÁNEO — NCCN Melanoma: Cutaneous v3.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Melanoma cutáneo',
    keywords: [
      'melanoma', 'melanoma cutáneo', 'melanoma maligno', 'lesión pigmentada',
      'braf', 'mek', 'pd-1', 'ipilimumab', 'nivolumab', 'pembrolizumab',
    ],
    intention:
      'Detección precoz de recaída cutánea, ganglionar o a distancia (pulmón, hígado, cerebro); vigilancia de nuevas lesiones cutáneas primarias; manejo de toxicidades por inmunoterapia.',
    schedule:
      'Estadio IA: examen cutáneo anual con dermoscopía. Estadios IB–II: cada 3–6 meses por 3 años, luego anual. Estadios III–IV: cada 3–6 meses por 5 años, luego anual. Incluir dermatoscopía completa del cuerpo y palpación de cuencas ganglionares en cada visita.',
    imaging:
      'Estadios IB–II de alto riesgo y estadio III: TAC de tórax-abdomen-pelvis ± cerebro con contraste, cada 6–12 meses por 3–5 años. PET-TC: para estadificación de recaída o ante hallazgos dudosos. RM cerebral: en estadio IV o síntomas neurológicos. Ecografía de cuencas ganglionares: en estadios I–II como alternativa o complemento. En terapia adyuvante activa: imagen de seguimiento según protocolo.',
    labs:
      'LDH sérica: marcador pronóstico en estadio IV. No se recomienda panel de marcadores tumorales de rutina. En inmunoterapia activa: TSH, función hepática, función renal, hemograma y cortisol basal en cada ciclo (detección de toxicidad inmuno-relacionada). En terapia BRAF/MEK: función hepática periódica, ECG (QT).',
    alarmSigns:
      'Nuevas lesiones cutáneas pigmentadas o cambios en lesiones existentes; adenopatía palpable nueva; cefalea, convulsiones o déficit neurológico focal; disnea, tos persistente; dolor abdominal o ictericia; fiebre, colitis, neumonitis, erupción cutánea severa (toxicidades inmunoterapia).',
    specialConsiderations:
      'Educación sobre autoexamen cutáneo mensual y fotoprotección estricta. Evaluación dermatológica completa del cuerpo. Prueba BRAF V600E/K: obligatoria en estadio III–IV (dirige terapia con BRAF/MEK inhibidores). En inmunoterapia adyuvante: vigilancia activa de eventos adversos inmuno-mediados (colitis, hepatitis, tiroiditis, neumonitis, hipofisitis). Consejo genético en melanomas familiares o múltiples melanomas primarios.',
    source: 'NCCN Melanoma: Cutaneous v3.2024',
  },

  // ─────────────────────────────────────────────
  // 8. CÁNCER DE PIEL NO MELANOMA — NCCN SCC v1.2024 / BCC v2.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de piel no melanoma',
    keywords: [
      'carcinoma basocelular', 'basal cell', 'carcinoma espinocelular',
      'carcinoma escamocelular', 'scc cutáneo', 'bcc', 'cáncer de piel no melanoma',
      'cáncer de piel', 'carcinoma cutáneo',
    ],
    intention:
      'Detección precoz de recaída local o regional, vigilancia de nuevas neoplasias cutáneas (alto riesgo de tumores múltiples), y manejo de toxicidades en casos tratados con terapia sistémica.',
    schedule:
      'Carcinoma basocelular (BCC) de bajo riesgo: examen dermatológico anual. BCC avanzado o localmente destructivo: cada 3–6 meses por 2 años, luego anual. Carcinoma escamoso (SCC) de bajo riesgo: examen dermatológico cada 6–12 meses por 2 años, luego anual. SCC de alto riesgo (invasión perineural, ganglios +): cada 1–3 meses el año 1, luego cada 6 meses por 5 años. Examen cutáneo completo con dermoscopía y palpación ganglionar en cada visita.',
    imaging:
      'SCC con invasión perineural o metástasis ganglionares: TAC o RM de región afectada para evaluar extensión. PET-TC: ante sospecha de enfermedad metastásica. No se recomienda imagen rutinaria en BCC o SCC de bajo riesgo. Ecografía ganglionar regional en SCC de alto riesgo.',
    labs:
      'No se requieren laboratorios de rutina en seguimiento estándar. En terapia con inhibidores de hedgehog (vismodegib, sonidegib para BCC): función hepática periódica. En inmunoterapia (cemiplimab/pembrolizumab para SCC avanzado): perfil de toxicidad inmuno-mediada (TSH, función hepática, hemograma).',
    alarmSigns:
      'Recurrencia local (nódulo, úlcera o placa nueva en sitio de tratamiento previo); adenopatía cervical, preauricular o inguinal nueva; parestesias o parálisis facial (invasión perineural); nueva lesión cutánea sospechosa.',
    specialConsiderations:
      'Educación en fotoprotección estricta (FPS ≥50, ropa protectora, evitar exposición solar entre 10–16 h). Autoexamen cutáneo mensual. Pacientes inmunosuprimidos (trasplantados, VIH, terapia inmunosupresora crónica): seguimiento cada 3–6 meses por riesgo muy elevado de SCC agresivo. Evaluar síndrome de nevo basocelular (Gorlin) en BCC múltiples o jóvenes.',
    source: 'NCCN Squamous Cell Skin Cancer v1.2024 / Basal Cell Skin Cancer v2.2024',
  },

  // ─────────────────────────────────────────────
  // 9. CÁNCER DE ESTÓMAGO — NCCN Gastric Cancer v2.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de estómago',
    keywords: [
      'estómago', 'gástrico', 'gastric', 'adenocarcinoma gástrico',
      'carcinoma gástrico', 'gastrectomía', 'her2 gástrico',
    ],
    intention:
      'Detección precoz de recaída local (anastomótica), peritoneal o a distancia (hígado, pulmón); vigilancia nutricional post-gastrectomía; y manejo de toxicidades del tratamiento.',
    schedule:
      'Años 1–3: consulta cada 3–6 meses. Años 4–5: cada 6–12 meses. Después del año 5: anual. Evaluación nutricional y del peso en cada visita.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste oral e IV: cada 6–12 meses durante los primeros 3 años (estadios II–III). Endoscopía digestiva alta: 6–12 meses post-cirugía si resección no curativa o en seguimiento de muñón gástrico (gastrectomía parcial). PET-TC: ante sospecha de recaída sin hallazgo claro en TAC.',
    labs:
      'Hemograma: vigilancia de anemia (ferropénica, megaloblástica). CEA y CA 19-9: no se recomiendan de rutina, pero pueden usarse como complemento ante sospecha clínica. Vitamina B12 (IM): obligatoria post-gastrectomía total (deficiencia por ausencia de factor intrínseco). Hierro sérico, ferritina, transferrina: periódicamente. Función hepática en pacientes en tratamiento sistémico.',
    alarmSigns:
      'Disfagia progresiva, náuseas persistentes, vómitos; pérdida de peso involuntaria >10%; dolor epigástrico o abdominal difuso; ascitis; ictericia; melena o hematemesis; masa abdominal palpable; síntomas de dumping severo.',
    specialConsiderations:
      'Soporte nutricional especializado post-gastrectomía (comidas fraccionadas, suplementos). Suplementación de vitamina B12 IM (1000 mcg/mes) de por vida en gastrectomía total. Monitoreo de densidad mineral ósea. Asesoría psico-oncológica. En HER2+ avanzado: trastuzumab como parte del tratamiento y seguimiento de cardiotoxicidad. Evaluar MSI/dMMR para selección de inmunoterapia.',
    source: 'NCCN Gastric Cancer v2.2024',
  },

  // ─────────────────────────────────────────────
  // 10. CÁNCER DE PÁNCREAS — NCCN Pancreatic Adenocarcinoma v2.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de páncreas',
    keywords: [
      'páncreas', 'pancreas', 'pancreático', 'pancreatic', 'adenocarcinoma pancreático',
      'carcinoma pancreático', 'whipple', 'pancreatectomía',
    ],
    intention:
      'Detección de recaída local o a distancia (principalmente hepática y peritoneal); manejo de insuficiencia pancreática exocrina y endocrina; soporte nutricional; y control de síntomas en enfermedad avanzada.',
    schedule:
      'Post-resección: consulta cada 3–6 meses durante los primeros 2 años. Años 3–5: cada 6 meses. Después del año 5: anual. En enfermedad avanzada: seguimiento según respuesta al tratamiento (cada 2–3 ciclos).',
    imaging:
      'TAC multicorte de abdomen y pelvis con contraste trifásico: cada 3–6 meses en los primeros 2 años post-resección. PET-TC: ante sospecha de recaída con CA 19-9 en ascenso sin hallazgo claro en TAC. Ecografía abdominal: complementaria para seguimiento hepático. No hay evidencia de que el seguimiento intensivo mejore la sobrevida global.',
    labs:
      'CA 19-9: basal post-operatorio y en cada control (marcador de recaída); resultado no interpretable si bilirrubina elevada. CEA: complementario. Glucemia en ayunas y HbA1c: vigilancia de diabetes post-pancreatectomía. Elastasa fecal y evaluación clínica de esteatorrea (insuficiencia exocrina). Función hepática y renal en tratamiento activo.',
    alarmSigns:
      'Ictericia o coluria nueva (recaída biliar o hepática); dolor epigástrico o dorsal de nueva aparición; pérdida de peso significativa; náuseas, vómitos, intolerancia alimentaria; esteatorrea severa; diabetes de difícil control.',
    specialConsiderations:
      'Enzimas pancreáticas de reemplazo (PERT) post-pancreatectomía para insuficiencia exocrina. Soporte nutricional especializado (suplementos de alta densidad calórica). Consejo genético: solicitar test de mutación BRCA1/2, ATM, PALB2 (implicaciones terapéuticas con PARP inhibidores y screening familiar). Manejo del dolor (puede requerir bloqueo del plexo celíaco). Soporte psicooncológico por alto impacto psicosocial.',
    source: 'NCCN Pancreatic Adenocarcinoma v2.2024',
  },

  // ─────────────────────────────────────────────
  // 11. CÁNCER DE TESTÍCULO — NCCN Testicular Cancer v1.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de testículo',
    keywords: [
      'testículo', 'testicular', 'testis', 'seminoma', 'no seminoma',
      'tumor germinal', 'germ cell', 'orquiectomía', 'orquidectomía',
      'afp testicular', 'bhcg',
    ],
    intention:
      'Detección precoz de recaída retroperitoneal, mediastinal o a distancia; monitoreo de marcadores tumorales; vigilancia del testículo contralateral; y manejo de secuelas a largo plazo del tratamiento.',
    schedule:
      'Seminoma estadio I (vigilancia activa): examen clínico + TAC + marcadores cada 4 meses el año 1, cada 6 meses el año 2–3, luego anual. No seminoma estadio I (vigilancia): examen clínico + marcadores cada 2 meses el año 1, cada 3 meses el año 2, cada 6 meses los años 3–5, luego anual. Estadios II–III post-quimioterapia: seguimiento intensivo según protocolo.',
    imaging:
      'TAC de abdomen y pelvis con contraste: frecuencia según estadio y modalidad de tratamiento (ver cronograma). TAC de tórax: si retroperitoneo positivo o quimioterapia previa. RM abdominal: como alternativa para reducir exposición a radiación (especialmente en pacientes jóvenes en vigilancia activa). Ecografía testicular: anual para vigilar testículo contralateral (microlitiasis, tumor metacrónico).',
    labs:
      'AFP (alfa-fetoproteína), β-HCG y LDH: en CADA visita de seguimiento. Normalización post-orquiectomía es el objetivo; la persistencia o reaparición indica tumor residual o recaída. Testosterona y FSH/LH: en pacientes con síntomas de hipogonadismo o en seguimiento reproductivo.',
    alarmSigns:
      'Elevación sostenida o reaparición de AFP, β-HCG o LDH; masa retroperitoneal; adenopatía supraclavicular; masa mediastinal (disnea, síndrome de vena cava superior); dolor lumbar; tos, hemoptisis; masa en testículo contralateral.',
    specialConsiderations:
      'Criopreservación de semen ANTES del tratamiento (obligatoria en todos los pacientes en edad fértil). Consejo sobre fertilidad post-tratamiento (quimioterapia con bleomicina, etopósido, cisplatino puede reducir fertilidad transitoria o permanentemente). Vigilancia cardiovascular a largo plazo (cisplatino: riesgo cardiovascular aumentado). Neuropatía periférica por cisplatino: seguimiento neurológico. Hipoacusia: audiometría post-cisplatino. Función endocrina del testículo contralateral.',
    source: 'NCCN Testicular Cancer v1.2024',
  },

  // ─────────────────────────────────────────────
  // 12. CÁNCER DE VEJIGA — NCCN Bladder Cancer v3.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de vejiga',
    keywords: [
      'vejiga', 'bladder', 'carcinoma urotelial', 'urothelial', 'transicional',
      'rtup', 'cistectomía', 'bcg intravesical',
    ],
    intention:
      'Detección precoz de recaída intravesical (enfermedad no músculo-invasora), recaída local o a distancia (músculo-invasora); monitoreo de función del tracto urinario superior; y manejo de secuelas de cistectomía.',
    schedule:
      'Cáncer de vejiga no músculo-invasor (CVNMI) de alto grado: cistoscopía + citología urinaria cada 3 meses por 2 años, luego cada 6 meses por 2 años, luego anual. CVNMI de bajo grado: cistoscopía a los 3 meses, luego cada 6–12 meses. Post-cistectomía radical: consulta y laboratorios cada 3–6 meses por 2 años, luego cada 6–12 meses.',
    imaging:
      'Post-cistectomía radical (estadios II–IV): TAC de tórax, abdomen y pelvis cada 6–12 meses por 3–5 años. Urografía por TAC o urografía resonancia: vigilancia del tracto urinario superior (pelvis renal y uréteres) anual en CVNMI de alto riesgo o post-cistectomía. PET-TC: ante sospecha de recaída a distancia.',
    labs:
      'Citología urinaria: en cada cistoscopía (CVNMI). Función renal (creatinina, clearance): periódica, especialmente post-cistectomía con derivación urinaria. Electrolitos (bicarbonato, cloro) en derivación urinaria (riesgo de acidosis hiperclorémica). Vitamina B12: vigilancia en derivación urinaria con íleon. Hemograma y función hepática en quimioterapia activa.',
    alarmSigns:
      'Hematuria macroscópica (recurrencia intravesical o de vías superiores); disuria, urgencia miccional severa; dolor lumbar o en flanco; masa pélvica; fiebre (pielonefritis en riñón funcionante); síntomas de derivación urinaria disfuncional.',
    specialConsiderations:
      'En CVNMI con BCG: completar inducción + mantenimiento (Lamm schedule: 6 semanas + 3 semanas a los 3, 6, 12, 18, 24, 30, 36 meses). En cistectomía con neovejiga: fisioterapia de piso pélvico y reentrenamiento miccional. Evaluación de función sexual post-cistectomía. En PD-L1+ o tumor con alta carga mutacional: considerar inmunoterapia en estadios avanzados. Evaluación de calidad de vida con cuestionarios específicos (FACT-BL).',
    source: 'NCCN Bladder Cancer v3.2024',
  },

  // ─────────────────────────────────────────────
  // 13. CÁNCER DE PULMÓN — NCCN NSCLC v5.2024 / SCLC v3.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de pulmón',
    keywords: [
      'pulmón', 'pulmon', 'lung', 'nsclc', 'sclc', 'adenocarcinoma pulmonar',
      'carcinoma escamoso pulmonar', 'carcinoma microcítico', 'egfr', 'alk', 'ros1',
      'pd-l1', 'kras', 'met exon 14', 'braf v600',
    ],
    intention:
      'Detección precoz de recaída local, mediastinal o a distancia (cerebro, hueso, glándulas suprarrenales); monitoreo de respuesta a terapia dirigida o inmunoterapia; manejo de toxicidades y secuelas del tratamiento.',
    schedule:
      'Post-resección NSCLC estadios I–II: TAC de tórax cada 6 meses por 2 años, luego TAC anual de baja dosis (LDCT). Estadio III tratado con curativa: consulta + imagen cada 3–6 meses por 3 años, luego cada 6–12 meses. SCLC respuesta completa: consulta + imagen cada 3 meses el año 1, cada 6 meses el año 2. En terapia sistémica activa (TKI, inmunoterapia): evaluación cada 2–3 ciclos.',
    imaging:
      'TAC de tórax con contraste: seguimiento estándar. TAC de abdomen-pelvis: si hallazgos previos o sospecha clínica. RM cerebral: en NSCLC con mutaciones oncogénicas (EGFR, ALK, ROS1) por alto riesgo de metástasis SNC; en SCLC con respuesta completa (irradiación craneal profiláctica o vigilancia). PET-TC: ante sospecha de recaída sistémica o re-estadificación. LDCT anual: para pacientes en seguimiento a largo plazo.',
    labs:
      'En TKI (EGFR, ALK, ROS1, KRAS G12C, MET, BRAF): función hepática (AST/ALT), función renal, electrolitos, ECG (osimertinib: QTc) en cada ciclo. En inmunoterapia (anti-PD-1/PD-L1): TSH, función hepática, hemograma, creatinina. En bevacizumab: presión arterial, proteinuria, hemostasia. CEA: puede usarse como marcador complementario (principalmente adenocarcinoma).',
    alarmSigns:
      'Disnea progresiva o de nueva aparición; hemoptisis; dolor torácico persistente; cefalea, convulsiones o déficit neurológico focal (metástasis SNC); dolor óseo; pérdida de peso severa; síndrome de vena cava superior; Horner, voz disfonía; colitis, neumonitis, hepatitis (toxicidades inmunoterapia); erupción cutánea, diarrea (TKI).',
    specialConsiderations:
      'Perfil molecular completo obligatorio (EGFR, ALK, ROS1, KRAS G12C, BRAF V600, MET exon 14, RET, NTRK, PD-L1 por IHQ, TMB): determina terapia de primera línea. En resistencia a TKI de primera/segunda generación: biopsia líquida (EGFR T790M) para selección de osimertinib. En inmunoterapia: manejo de irAE con algoritmos específicos (corticoides sistémicos). Cese tabáquico obligatorio y soporte para abandono. Rehabilitación respiratoria post-cirugía o post-RT. Cuidados paliativos integrados desde el diagnóstico en estadios avanzados.',
    source: 'NCCN Non-Small Cell Lung Cancer v5.2024 / Small Cell Lung Cancer v3.2024',
  },

  // ─────────────────────────────────────────────
  // 14. CÁNCER DE RECTO — NCCN Rectal Cancer v2.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de recto',
    keywords: [
      'recto', 'rectal', 'adenocarcinoma de recto', 'carcinoma de recto',
      'resección anterior', 'amputación abdominoperineal', 'aap', 'tmeo',
      'neoadyuvante rectal',
    ],
    intention:
      'Detección precoz de recaída local (anastomótica, pélvica) o a distancia (hígado, pulmón); vigilancia endoscópica de anastomosis y colon restante; manejo de disfunción intestinal, sexual y urinaria post-tratamiento.',
    schedule:
      'Años 1–3: consulta cada 3–6 meses (clínica + CEA). Años 4–5: cada 6 meses. Después del año 5: anual. Sigmoidoscopía flexible o rectoscopía: cada 6 meses por 2–3 años (seguimiento anastomosis). Colonoscopía completa: al año de la resección, a los 3 años, luego cada 5 años.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste IV: cada 6–12 meses por 3–5 años (estadios II–III). RM pélvica: ante sospecha de recaída local pélvica (síntomas pélvicos, CEA en ascenso). PET-TC: ante sospecha de recaída con CEA en ascenso y TAC no concluyente.',
    labs:
      'CEA: en cada visita (cada 3–6 meses). Si CEA en ascenso progresivo: solicitar imagen inmediatamente. Hemograma y función hepática periódica. En pacientes con síndrome de Lynch (MSI-H): vigilancia específica de otros tumores.',
    alarmSigns:
      'Cambio en calibre o frecuencia de las deposiciones; sangrado rectal; dolor pélvico o perianal; tenesmo rectal; incontinencia fecal nueva; hematuria o disuria (invasión vesical); dolor lumbar o ciático; pérdida de peso involuntaria.',
    specialConsiderations:
      'Síndrome de resección anterior baja (LARS): frecuente post-anastomosis baja; tratamiento con biofeedback, irrigación transanal, cambios dietéticos. Disfunción sexual y urinaria post-cirugía pélvica radical: derivar a urología y sexología. Ostomía definitiva (amputación abdominoperineal): soporte de enfermería especializada en estomaterapia. Vigilar toxicidades crónicas de la radioterapia pélvica (proctitis, estenosis anal, fístulas). Test MMR/MSI para selección de inmunoterapia y síndrome de Lynch.',
    source: 'NCCN Rectal Cancer v2.2024',
  },

  // ─────────────────────────────────────────────
  // 15. CÁNCER DE VÍAS BILIARES — NCCN Hepatobiliary Cancers v3.2024
  // ─────────────────────────────────────────────
  {
    pathology: 'Cáncer de vías biliares',
    keywords: [
      'vías biliares', 'vias biliares', 'colangiocarcinoma', 'colangiocarcinoma intrahepático',
      'colangiocarcinoma extrahepático', 'carcinoma de vesícula biliar', 'vesícula biliar',
      'ampuloma', 'carcinoma de ampolla de vater', 'klatskin',
    ],
    intention:
      'Detección precoz de recaída local, peritoneal o hepática; manejo de colestasis recurrente u obstrucción biliar; monitoreo de respuesta a terapia sistémica o terapia dirigida (FGFR, IDH1); y soporte sintomático.',
    schedule:
      'Post-resección: consulta cada 3–6 meses durante los primeros 2 años. Años 3–5: cada 6 meses. En enfermedad avanzada bajo tratamiento sistémico: evaluación cada 2–3 ciclos (8–12 semanas). Examen físico con evaluación de ictericia, dolor abdominal y estado general en cada visita.',
    imaging:
      'TAC de tórax, abdomen y pelvis con contraste trifásico o RM hepática con contraste: cada 3–6 meses post-resección. RM colangiopancreatografía (CPRM): ante sospecha de recaída biliar o estenosis anastomótica. PET-TC: en re-estadificación o sospecha de enfermedad metastásica no evidente en TAC.',
    labs:
      'CA 19-9 y CEA: en cada control (marcadores complementarios, no diagnósticos solos). Bilirrubina total y directa, AST, ALT, GGT, FA: función biliar y hepática en cada visita. En terapia con inhibidores de FGFR2 (pemigatinib, infigratinib): función hepática, fosfatemia (hiperfosfatemia), función renal, uñas y piel. En IDH1 inhibidores (ivosidenib): función hepática, ECG.',
    alarmSigns:
      'Ictericia o coluria de nueva aparición o en aumento (obstrucción biliar por recaída); colangitis febril (infección sobreagregada); dolor abdominal en hipocondrio derecho; pérdida de peso severa; ascitis; prurito refractario; fiebre sin foco claro.',
    specialConsiderations:
      'Perfil molecular completo obligatorio (FGFR2 fusiones/rearreglos en colangiocarcinoma intrahepático, IDH1 mutación, MSI/dMMR, BRAF V600E, HER2, NTRK): define terapia de segunda o posterior línea. Manejo de la colestasis: prótesis biliares (endoscópica o percutánea) o derivación quirúrgica ante recaída obstructiva. Soporte nutricional (síndrome de malabsorción por insuficiencia biliar). Cuidados paliativos integrados desde el diagnóstico en estadios avanzados (alta mortalidad). Consejo genético en colangiocarcinoma <50 años o bilateral.',
    source: 'NCCN Hepatobiliary Cancers v3.2024',
  },
];

/**
 * Busca la guía NCCN correspondiente al diagnóstico extraído de la historia clínica.
 * Devuelve null si no se encuentra correspondencia.
 */
export function findNCCNGuideline(clinicalText: string): NCCNGuideline | null {
  if (!clinicalText) return null;
  const lower = clinicalText.toLowerCase();

  // Score-based matching: cuenta cuántas keywords coinciden para cada guía
  let bestMatch: NCCNGuideline | null = null;
  let bestScore = 0;

  for (const guideline of nccnGuidelines) {
    let score = 0;
    for (const kw of guideline.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = guideline;
    }
  }

  // Requiere al menos 1 keyword coincidente para considerar la guía válida
  return bestScore >= 1 ? bestMatch : null;
}
