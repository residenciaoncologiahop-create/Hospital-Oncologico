import { ImagingStudy } from '../components/ImagingPanel';
import { LabResult } from '../components/LabPanel';

export const DEMO_USER_ID = "demo-user";

export interface DemoPatient {
  id: string;
  doctorId: string;
  hcNumber: string;
  name: string;
  age: number;
  ageRange: string;
  diagnosis: string;
  historyText: string;
  clinicalContext?: string;
  clinicalContextUpdatedAt?: number | null;
  timeline: Array<{
    date: string;
    professional: string;
    category: string;
    note: string;
    isKey: boolean;
    detail?: string;
  }>;
  labResults: LabResult[];
  labs?: LabResult[];
  imagingStudies: ImagingStudy[];
  chatHistory: Array<{
    role: 'user' | 'model';
    text: string;
    timestamp: number;
  }>;
  lastUpdated: number;
}

export const demoPatients: DemoPatient[] = [
  // ── CASO 1: CA DE MAMA — ESTADIO IIB ──────────────────────────────────
  {
    id: "demo-001",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-001",
    name: "HC-DEMO-001",
    age: 58,
    ageRange: "51-60",
    diagnosis: "Ca Mama Izq — Carcinoma Ductal Invasor RH+ HER2- Estadio IIB (cT2 cN1 M0)",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-001
PACIENTE: Femenina, 58 años. Sin antecedentes patológicos de relevancia.
DIAGNÓSTICO: Carcinoma ductal invasor de mama izquierda, Grado Histológico 2 (Nottingham 6/9).
INMUNOHISTOQUÍMICA: RE 95% (fuerte), RP 80% (fuerte), HER2 Negativo (1+), Ki-67 22%.
ESTADIFICACIÓN INICIAL: cT2 (3.2 cm) cN1 (ganglio axilar ipsilateral móvil) cM0 - Estadio IIB.

TRATAMIENTO REALIZADO:
1. Cirugía: Cuadrantectomía superoexterna izquierda + Linfadenectomía axilar nivel I-II (10/05/2023).
   Anatomía Patológica quirúrgica: Tumor de 2.8 cm, márgenes libres (>5 mm). 2/14 ganglios comprometidos con metástasis macrometastásica (ypT2 pN1a).
2. Quimioterapia adyuvante: Esquema AC-T finalizado en diciembre 2023 (4 ciclos AC: Doxorrubicina 60 mg/m² + Ciclofosfamida 600 mg/m² seguidos de Paclitaxel semanal 80 mg/m² x 12 semanas).
3. Radioterapia adyuvante: 50 Gy a mama izquierda y lecho quirúrgico con boost de 10 Gy + irradiación a fosa supraclavicular (Enero-Febrero 2024).
4. Hormonoterapia adyuvante actual: Letrozol 2.5 mg/día vo (iniciado Marzo 2024, plan 5 a 10 años) + Calcio 1200 mg/día + Vitamina D3 800 UI/día.

ESTADO ACTUAL (Agosto 2024):
Asintomática. Examen físico: Mamas simétricas, lecho quirúrgico sin nódulos ni retracciones. Axila y fosa supraclavicular libres. ECOG 0. Densitometría ósea con osteopenia leve en cuello femoral (T-score -1.4).`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-001
PACIENTE: Femenina, 58 años. Sin antecedentes patológicos de relevancia.
DIAGNÓSTICO: Carcinoma ductal invasor de mama izquierda, Grado Histológico 2 (Nottingham 6/9).
INMUNOHISTOQUÍMICA: RE 95% (fuerte), RP 80% (fuerte), HER2 Negativo (1+), Ki-67 22%.
ESTADIFICACIÓN INICIAL: cT2 (3.2 cm) cN1 cM0 - Estadio IIB.
TRATAMIENTO: Cirugía conservadora + VAX -> QT Adyuvante (AC-T) -> RT Adyuvante -> Letrozol 2.5 mg/día.`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    timeline: [
      {
        date: "15/03/2023",
        professional: "Dr. Juan Gómez (Mastología)",
        category: "Diagnóstico",
        note: "Consulta inicial por nódulo palpable indoloro en mama izquierda (CSE) de 3 cm. Mamografía y Ecografía mamaria: BI-RADS 5.",
        isKey: true,
        detail: "Nódulo espiculado de 32 mm en CSE mama izquierda con adenomegalia axilar ipsilateral sospechosa de 18 mm."
      },
      {
        date: "02/04/2023",
        professional: "Dra. Ana Pérez (Patología)",
        category: "Biopsia / IHQ",
        note: "Biopsia Core mamaria izquierda: Carcinoma Ductal Invasor G2. PUNC axilar: Positivo para metástasis de carcinoma.",
        isKey: true,
        detail: "IHQ: RE 95% (+), RP 80% (+), HER2 1+ (Negativo), Ki-67: 22%. Subtipo Luminal B - HER2 negativo."
      },
      {
        date: "18/04/2023",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "Estadificación inicial: TC Toraco-Abdomino-Pelviana + Centellograma Óseo.",
        isKey: true,
        detail: "Masa mamaria de 32 mm y ganglio axilar izquierdo de 18 mm. Sin secundarismo óseo, pulmonar ni hepático. Estadio IIB (cT2 cN1 M0)."
      },
      {
        date: "10/05/2023",
        professional: "Dr. Juan Gómez (Cirugía Oncológica)",
        category: "Cirugía",
        note: "Cuadrantectomía superoexterna mama izquierda + Linfadenectomía axilar nivel I-II.",
        isKey: true,
        detail: "Evolución postoperatoria favorable sin complicaciones. Informe AP: Tumor de 28 mm, márgenes >5 mm. 2/14 ganglios comprometidos (pT2 pN1a M0)."
      },
      {
        date: "12/06/2023",
        professional: "Dra. Elena Silva (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de Quimioterapia adyuvante: Esquema AC (Doxorrubicina 60 mg/m² + Ciclofosfamida 600 mg/m²) cada 21 días x 4 ciclos.",
        isKey: true,
        detail: "Adecuada tolerancia con soporte antiemético con Ondansetrón y Dexametasona."
      },
      {
        date: "04/09/2023",
        professional: "Dra. Elena Silva (Oncología Clínica)",
        category: "Tratamiento",
        note: "Continuación de QT adyuvante: Paclitaxel semanal 80 mg/m² x 12 semanas.",
        isKey: false,
        detail: "Hemograma y función hepática dentro de parámetros normales. Neuropatía periférica G1 transitoria."
      },
      {
        date: "05/12/2023",
        professional: "Dra. Elena Silva (Oncología Clínica)",
        category: "Evolución",
        note: "Finalización de Quimioterapia adyuvante (12 semanas de Paclitaxel completadas). Evaluación clínica sin signos de enfermedad.",
        isKey: true,
        detail: "Derivación a Radioterapia para tratamiento consolidatorio locorregional."
      },
      {
        date: "15/01/2024",
        professional: "Dr. Marcos Valenzuela (Radioterapia)",
        category: "Tratamiento",
        note: "Inicio de Radioterapia conformada 3D sobre mama izquierda (50 Gy) + Sobreimpresión en lecho tumoral (10 Gy).",
        isKey: false,
        detail: "Tratamiento completado el 25/02/2024 con radiodermitis Grado 1 resuelta con cremas emolientes."
      },
      {
        date: "01/03/2024",
        professional: "Dra. Elena Silva (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de Hormonoterapia adyuvante: Letrozol 2.5 mg/día vía oral (plan mínimo 5 años).",
        isKey: true,
        detail: "Se indica Densitometría Ósea basal y suplementación con Calcio 1200 mg + Vitamina D3."
      },
      {
        date: "15/08/2024",
        professional: "Dra. Elena Silva (Oncología Clínica)",
        category: "Control",
        note: "Control oncológico semestral en curso de hormonoterapia. Paciente asintomática, ECOG 0, examen físico normal.",
        isKey: true,
        detail: "TC de control sin evidencia de recidiva local ni a distancia. CA 15-3 normal (14.1 U/mL)."
      }
    ],
    labResults: [
      {
        date: "15/04/2023",
        test: "CA 15-3",
        value: 48.5,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/04/2023",
        test: "Hemoglobina",
        value: 13.2,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/04/2023",
        test: "Creatinina",
        value: 0.78,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/04/2023",
        test: "Leucocitos",
        value: 6800,
        unit: "/mm³",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/08/2023",
        test: "CA 15-3",
        value: 28.2,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/08/2023",
        test: "Hemoglobina",
        value: 11.4,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/08/2023",
        test: "Neutrófilos",
        value: 2200,
        unit: "/mm³",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/02/2024",
        test: "CA 15-3",
        value: 16.4,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/02/2024",
        test: "Hemoglobina",
        value: 12.8,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/02/2024",
        test: "Plaquetas",
        value: 220000,
        unit: "/mm³",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/08/2024",
        test: "CA 15-3",
        value: 14.1,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/08/2024",
        test: "Hemoglobina",
        value: 13.5,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/08/2024",
        test: "Creatinina",
        value: 0.80,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-001-1",
        type: "TC",
        date: "18/04/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Basal prequirúrgico",
        isBaseline: true,
        relevantFindings: "Formación nodular espiculada en cuadrante superoexterno de mama izquierda de 32 mm. Adenomegalia axilar izquierda ipsilateral de 18 mm. Sin evidencia de metástasis a distancia.",
        targetLesions: [
          {
            location: "Nódulo mamario izquierdo CSE",
            measurement: 32,
            lesionKey: "nodulo_mamario_izquierdo_cse"
          },
          {
            location: "Adenopatía axilar izquierda",
            measurement: 18,
            lesionKey: "adenopatia_axilar_izquierda"
          }
        ],
        nonTargetLesions: [
          {
            location: "Parénquima pulmonar bilateral",
            status: "Presente / No medible (sin nódulos sospechosos)"
          },
          {
            location: "Parénquima hepático",
            status: "Normal sin lesiones focales"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 400
      },
      {
        id: "img-demo-001-2",
        type: "TC",
        date: "28/08/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Post-cirugía / Durante Quimioterapia AC-T",
        isBaseline: false,
        relevantFindings: "Cambios postquirúrgicos en mama izquierda y hueco axilar. Lecho mamario sin nódulo residual. Ganglio axilar residual disminuido a 8 mm. Suma total de diámetros target: 8 mm (-84% vs basal). Respuesta Parcial (PR) según RECIST 1.1.",
        targetLesions: [
          {
            location: "Nódulo mamario izquierdo CSE",
            measurement: 0,
            lesionKey: "nodulo_mamario_izquierdo_cse"
          },
          {
            location: "Adenopatía axilar izquierda",
            measurement: 8,
            lesionKey: "adenopatia_axilar_izquierda"
          }
        ],
        nonTargetLesions: [
          {
            location: "Lecho quirúrgico mamario y axilar",
            status: "Sin signos de recidiva"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 280
      },
      {
        id: "img-demo-001-3",
        type: "TC",
        date: "10/02/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Post-finalización de Quimioterapia y Radioterapia",
        isBaseline: false,
        relevantFindings: "Control post-tratamiento adyuvante locorregional. Parénquima pulmonar y hepático sin lesiones secundarias. Ganglios axilares subcentimétricos (6 mm). Enfermedad Estable (SD) / Respuesta Completa en lecho mamario.",
        targetLesions: [
          {
            location: "Nódulo mamario izquierdo CSE",
            measurement: 0,
            lesionKey: "nodulo_mamario_izquierdo_cse"
          },
          {
            location: "Adenopatía axilar izquierda",
            measurement: 6,
            lesionKey: "adenopatia_axilar_izquierda"
          }
        ],
        nonTargetLesions: [
          {
            location: "Área torácica y abdominal",
            status: "Sin lesiones sospechosas"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 180
      },
      {
        id: "img-demo-001-4",
        type: "TC",
        date: "15/08/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "En curso de Hormonoterapia (Letrozol 2.5 mg/d)",
        isBaseline: false,
        relevantFindings: "Estudio de seguimiento oncológico. Sin evidencia de recidiva tumoral locorregional ni a distancia. Estabilidad completa sostenida.",
        targetLesions: [
          {
            location: "Nódulo mamario izquierdo CSE",
            measurement: 0,
            lesionKey: "nodulo_mamario_izquierdo_cse"
          },
          {
            location: "Adenopatía axilar izquierda",
            measurement: 5,
            lesionKey: "adenopatia_axilar_izquierda"
          }
        ],
        nonTargetLesions: [
          {
            location: "Lecho quirúrgico y axila izquierda",
            status: "Sin cambios respecto al estudio previo"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 10
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Cuál es el esquema de seguimiento y monitoreo de salud ósea recomendado para esta paciente tratada con Letrozol?",
        timestamp: Date.now() - 1000 * 60 * 60 * 2
      },
      {
        role: "model",
        text: `Para una paciente de 58 años con antecedentes de **Carcinoma de Mama Estadio IIB (ypT2 pN1a M0) RH+ HER2-**, en tratamiento adyuvante con **Letrozol 2.5 mg/día**:

1. **Monitoreo de Salud Ósea:**
   - Realizar Densitometría Ósea (DMO) de columna y cadera basal y cada 1-2 años por el riesgo de pérdida de masa ósea y fracturas asociado a Inhibidores de la Aromatasa.
   - Mantener suplementación con Calcio (1000-1200 mg/día) y Vitamina D3 (800-1000 UI/día).
   - Si el T-score cae a < -2.0 o presenta factores de riesgo adicionales, evaluar inicio de bisfosfonatos (Ácido Zoledrónico 4 mg ev semestral) o Denosumab.

2. **Seguimiento Clínico y Mamográfico:**
   - Examen físico y anamnesis cada 3 a 6 meses durante los primeros 3 años.
   - Mamografía bilateral anual (la primera a los 6-12 meses del fin de la radioterapia).
   - No se recomiendan estudios tomográficos ni centellogramas de rutina en ausencia de síntomas o sospecha clínica (Guías NCCN/ASCO).

3. **Control Ginecológico y Cardiovascular:**
   - Perfil lipídico anual y control cardiovascular periódico por riesgo aterogénico de los IA.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 2 + 1500
      }
    ],
    lastUpdated: Date.now()
  },

  // ── CASO 2: CA DE PULMÓN — ESTADIO IV (EGFR+) ─────────────────────────
  {
    id: "demo-002",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-002",
    name: "HC-DEMO-002",
    age: 64,
    ageRange: "61-70",
    diagnosis: "Adenocarcinoma de Pulmón LSD — EGFR Exón 19 del — Estadio IVB (Metástasis óseas y pleurales)",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-002
PACIENTE: Masculino, 64 años. Ex-fumador (15 paquetes/año, abandono hace 10 años).
DIAGNÓSTICO: Adenocarcinoma de pulmón en lóbulo superior derecho (LSD). TTF-1 positivo, p40 negativo.
BIOLOGÍA MOLECULAR (NGS): Mutación activadora en EGFR Exón 19 (deleción p.E746_A750del) POSITIVA. ALK negativo, ROS1 negativo. PD-L1 TPS: 15%.
ESTADIFICACIÓN: cT2b (4.2 cm) cN2 (adenopatía paratraqueal 4R 22 mm) cM1c (derrame pleural con citología positiva y metástasis óseas líticas en T6 y T8) - Estadio IVB.

TRATAMIENTO INSTAURADO:
1. Primera Línea Dirigida: Osimertinib 80 mg/día vía oral continuo (Inhibidor de Tirosina Quinasa EGFR de 3ra generación).
2. Protección Ósea: Ácido Zoledrónico 4 mg ev cada 4 semanas + Calcio y Vitamina D.
3. Trámite de Medicación de Alto Costo: Solicitud formal gestionada ante PAMI / Banco Nacional de Drogas Oncológicas.

EVOLUCIÓN CLÍNICA Y RADIOLÓGICA:
- Basal (Nov 2023): Masa LSD de 42 mm + adenopatía 4R de 22 mm (Suma 64 mm) + derrame pleural y lesiones óseas.
- Control Mes 3 (Mar 2024): Respuesta Parcial marcada (Masa LSD 24 mm, adenopatía 12 mm, Suma 36 mm, -43.7%). Resolución del derrame pleural.
- Control Mes 7 (Jul 2024): Lesiones target primarias estables (LSD 23 mm, 4R 12 mm), pero aparición de NUEVA lesión nodular subpleural de 14 mm en lóbulo inferior izquierdo (LII). Configura Progresión de Enfermedad (PD) por RECIST 1.1 / iUPD por iRECIST. Se discute conducta de oligoprogresión.`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-002
PACIENTE: 64 años, ex tabaquista.
DIAGNÓSTICO: Adenocarcinoma de pulmón LSD Estadio IVB (EGFR Exon 19 del).
TRATAMIENTO: Osimertinib 80 mg/día + Ácido Zoledrónico 4 mg ev c/28d.
ESTADO: Progresión por nueva lesión pulmonar contralateral (oligoprogresión vs resistencia molecular).`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    timeline: [
      {
        date: "10/11/2023",
        professional: "Dr. Roberto Díaz (Neumonología)",
        category: "Consulta",
        note: "Consulta por tos seca persistente de 2 meses, disnea CF II y dolor dorsal continuo. Pérdida de 4 kg de peso.",
        isKey: true,
        detail: "Examen respiratorio con hipoventilación en base pulmonar derecha. ECOG 1."
      },
      {
        date: "24/11/2023",
        professional: "Dra. Marcela Gómez (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Toraco-Abdomino-Pelviana con contraste: Masa pulmonar espiculada en LSD de 42 mm con compromiso mediastinal y óseo.",
        isKey: true,
        detail: "Adenopatía paratraqueal derecha baja (estación 4R) de 22 mm. Derrame pleural derecho leve. Lesiones líticas en cuerpos vertebrales T6 y T8."
      },
      {
        date: "05/12/2023",
        professional: "Dr. Roberto Díaz (Neumonología)",
        category: "Procedimiento",
        note: "Videobroncoscopía + PAAF transbronquial y toracocentesis diagnóstica.",
        isKey: false,
        detail: "Citología de líquido pleural positiva para células tumorales. Biopsia bronquial: Adenocarcinoma infiltrante TTF-1 positivo."
      },
      {
        date: "18/12/2023",
        professional: "Dra. Patricia Morales (Biología Molecular)",
        category: "Biología Molecular",
        note: "Panel Molecular NGS de Cáncer de Pulmón: Mutación en EGFR Exón 19 (deleción) POSITIVA.",
        isKey: true,
        detail: "EGFR del Exón 19 detectada. ALK por IHQ negativo, ROS1 negativo. Candidato de primera elección para TKI de 3ra generación (Osimertinib)."
      },
      {
        date: "28/12/2023",
        professional: "Dr. Hernán Cortínez (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de 1ra Línea: Osimertinib 80 mg/día vía oral + Ácido Zoledrónico 4 mg ev mensual. Confección de solicitud PAMI / Banco de Drogas.",
        isKey: true,
        detail: "Se informa al paciente sobre pautas de alarma y perfil de toxicidad (diarrea, rash cutáneo, neumonitis)."
      },
      {
        date: "15/03/2024",
        professional: "Dr. Hernán Cortínez (Oncología Clínica)",
        category: "Control",
        note: "Control clínico y tomográfico a los 3 meses de Osimertinib. Respuesta Parcial (PR) significativa (-43.7%).",
        isKey: true,
        detail: "Masa LSD reducida a 24 mm, adenopatía 4R a 12 mm. Desaparición del derrame pleural. Alivio completo del dolor dorsal. ECOG 0."
      },
      {
        date: "20/07/2024",
        professional: "Dra. Marcela Gómez (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Tórax, Abdomen y Pelvis: Progresión de Enfermedad (PD) por aparición de nueva lesión nodular en lóbulo inferior izquierdo de 14 mm.",
        isKey: true,
        detail: "Masa primaria LSD estable (23 mm) y adenopatía 4R estable (12 mm). Nueva lesión contralateral de 14 mm. Se programa ateneo multidisciplinario."
      }
    ],
    labResults: [
      {
        date: "20/11/2023",
        test: "CEA",
        value: 38.4,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/11/2023",
        test: "Hemoglobina",
        value: 12.1,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/11/2023",
        test: "Creatinina",
        value: 0.95,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/11/2023",
        test: "Calcio",
        value: 9.8,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "CEA",
        value: 8.2,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "Hemoglobina",
        value: 12.6,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "Creatinina",
        value: 0.90,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/07/2024",
        test: "CEA",
        value: 19.5,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/07/2024",
        test: "Hemoglobina",
        value: 12.0,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/07/2024",
        test: "Creatinina",
        value: 0.92,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-002-1",
        type: "TC",
        date: "24/11/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Basal pre-tratamiento",
        isBaseline: true,
        relevantFindings: "Masa pulmonar espiculada en LSD de 42 mm. Adenomegalia mediastinal paratraqueal derecha (4R) de 22 mm. Derrame pleural derecho moderado. Lesiones osteolíticas secundarias en T6 y T8.",
        targetLesions: [
          {
            location: "Masa pulmonar LSD",
            measurement: 42,
            lesionKey: "masa_pulmonar_lsd"
          },
          {
            location: "Adenopatía mediastinal 4R",
            measurement: 22,
            lesionKey: "adenopatia_mediastinal_4r"
          }
        ],
        nonTargetLesions: [
          {
            location: "Derrame pleural derecho",
            status: "Presente / No medible"
          },
          {
            location: "Lesión ósea lítica en T6",
            status: "Presente"
          },
          {
            location: "Lesión ósea lítica en T8",
            status: "Presente"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 260
      },
      {
        id: "img-demo-002-2",
        type: "TC",
        date: "15/03/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Osimertinib 80 mg/día (Mes 3)",
        isBaseline: false,
        relevantFindings: "Reducción significativa de masa LSD (-43%) y ganglio 4R (-45%). Suma diámetros pasó de 64 mm a 36 mm (-43.7%). Resolución completa del derrame pleural. Respuesta Parcial (PR) según RECIST 1.1.",
        targetLesions: [
          {
            location: "Masa pulmonar LSD",
            measurement: 24,
            lesionKey: "masa_pulmonar_lsd"
          },
          {
            location: "Adenopatía mediastinal 4R",
            measurement: 12,
            lesionKey: "adenopatia_mediastinal_4r"
          }
        ],
        nonTargetLesions: [
          {
            location: "Derrame pleural derecho",
            status: "Resuelto"
          },
          {
            location: "Lesiones óseas T6/T8",
            status: "Estables con signos de esclerosis reparativa"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 150
      },
      {
        id: "img-demo-002-3",
        type: "TC",
        date: "20/07/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Osimertinib 80 mg/día (Mes 7)",
        isBaseline: false,
        relevantFindings: "Lesiones target previas estables (LSD 23 mm, 4R 12 mm). Aparición de NUEVA lesión nodular subpleural de 14 mm en LII. Configura Progresión de Enfermedad (PD) según RECIST 1.1 / iUPD en iRECIST.",
        targetLesions: [
          {
            location: "Masa pulmonar LSD",
            measurement: 23,
            lesionKey: "masa_pulmonar_lsd"
          },
          {
            location: "Adenopatía mediastinal 4R",
            measurement: 12,
            lesionKey: "adenopatia_mediastinal_4r"
          }
        ],
        nonTargetLesions: [
          {
            location: "Lesiones óseas",
            status: "Estables"
          }
        ],
        newLesions: true,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 25
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Cuál es la conducta médica recomendada ante la aparición de esta nueva lesión en LII en un paciente con EGFR mutado en Osimertinib?",
        timestamp: Date.now() - 1000 * 60 * 60 * 4
      },
      {
        role: "model",
        text: `Ante la detección de una nueva lesión en un paciente con Adenocarcinoma de Pulmón EGFR Exón 19 del en tratamiento con Osimertinib de 1ra línea:

1. **Distinguir Oligoprogresión vs Progresión Sistémica:**
   - Dado que las lesiones preexistentes (LSD y mediastino) permanecen controladas y la progresión se limita a un único nódulo de 14 mm en LII, se clasifica como **Oligoprogresión**.

2. **Tratamiento Local Consolidativo ('Beyond Progression'):**
   - La recomendación actual (NCCN / ESMO) avala realizar tratamiento ablativo local sobre la nueva lesión mediante **Radiocirugía Estereotáctica Corporal (SBRT/SABR)** o resección quirúrgica, **manteniendo el Osimertinib 80 mg/día**, prolongando el beneficio clínico.

3. **Estudio de Mecanismos de Resistencia Molecular:**
   - Se sugiere solicitar Biopsia Líquida (ADN tumoral circulante en plasma por NGS) o re-biopsia tisular de la nueva lesión para investigar:
     - Mutaciones secundarias en EGFR (ej. C797S).
     - Mecanismos de bypass (amplificación de MET, mutaciones en HER2, BRAF, PIK3CA).
     - Transformación histológica a Cáncer de Pulmón de Células Pequeñas (SCLC).

4. **Siguiente Línea Sistémica (si hubiera progresión múltiple):**
   - Quimioterapia con doblete de Platino + Pemetrexed +/- Amivantamab según el mecanismo molecular identificado.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 4 + 2000
      }
    ],
    lastUpdated: Date.now()
  },

  // ── CASO 3: CA COLORRECTAL — POST-METASTASECTOMÍA ────────────────────
  {
    id: "demo-003",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-003",
    name: "HC-DEMO-003",
    age: 51,
    ageRange: "51-60",
    diagnosis: "Adenocarcinoma de Colon Sigmoides — Estadio IV Oligometastásico Resecado (Metastasectomía Hepática R0) — En Vigilancia Activa",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-003
PACIENTE: Masculino, 51 años. Sin comorbilidades.
DIAGNÓSTICO: Adenocarcinoma de colon sigmoides con metástasis hepática sincrónica solitaria resecable en segmento VI.
BIOLOGÍA MOLECULAR: RAS Wild-Type (KRAS y NRAS no mutados), BRAF V600E negativo, Inestabilidad Microsatelital Estable (MSS / pMMR).
ESTADIFICACIÓN: cT3 cN1a cM1a (Hígado) - Estadio IVA oligometastásico resecable.

TRATAMIENTO REALIZADO:
1. Cirugía simultánea R0 (22/08/2022): Colectomía sigmoidea oncológica + Resección hepática atípica segmento VI con márgenes libres >1 cm.
   Anatomía Patológica: Adenocarcinoma moderadamente diferenciado, invasión hasta subserosa (pT3), 2/18 ganglios positivos (pN1a), metástasis hepática de 3.2 cm con margen libre de 12 mm (ypT3 pN1a pM1a R0).
2. Quimioterapia Adyuvante Perioperatoria: mFOLFOX6 x 12 ciclos (Oxaliplatino 85 mg/m² + Leucovorina 400 mg/m² + 5-Fluorouracilo en bolo e infusión continua de 46 hs) finalizados en Marzo 2023.
3. Vigilancia Activa: Sin quimioterapia de mantenimiento. Controles trimestrales de CEA y semestrales de TC Toraco-Abdomino-Pelviana.

ESTADO ACTUAL (Agosto 2024):
Mes 17 post-finalización de quimioterapia. Paciente asintomático, reinserción laboral completa, ECOG 0. CEA en valores normales estables (1.6 ng/mL). TC TAP de control y videocolonoscopía sin evidencia de recidiva tumoral local ni a distancia (NED - No Evidence of Disease).`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-003
PACIENTE: Masculino, 51 años.
DIAGNÓSTICO: Ca Colon Sigmoides Estadio IV resecado (Metastasectomía R0). RAS WT, MSS.
TRATAMIENTO: Cirugía simultánea sigmoides + hígado R0 -> mFOLFOX6 x 12 ciclos completados.
ESTADO: Vigilancia activa en remisión completa (NED).`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    timeline: [
      {
        date: "14/06/2022",
        professional: "Dra. Clara Méndez (Gastroenterología)",
        category: "Consulta",
        note: "Consulta por rectorragia intermitente de 3 meses, alteración del ritmo evacuatorio y dolor en fosa ilíaca izquierda.",
        isKey: true,
        detail: "Tacto rectal negativo. Se indica videocolonoscopía total urgente."
      },
      {
        date: "28/06/2022",
        professional: "Dra. Clara Méndez (Gastroenterología)",
        category: "Procedimiento",
        note: "Videocolonoscopía: Lesión tumoral vegetante e infiltrante en sigmoides a 25 cm del margen anal. Biopsia: Adenocarcinoma.",
        isKey: true,
        detail: "Biopsia concluyente para adenocarcinoma moderadamente diferenciado de colon."
      },
      {
        date: "15/07/2022",
        professional: "Dr. Gonzalo Ramos (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC TAP + RMN Hepática con contraste: Masa sigmoidea de 45 mm y lesión focal hepática solitaria en segmento VI de 35 mm resecable.",
        isKey: true,
        detail: "Sin compromiso extrahepático ni carcinomatosis peritoneal. Discutido en ateneo quirúrgico hepatobiliar: Metástasis resecable."
      },
      {
        date: "08/08/2022",
        professional: "Dra. Viviana López (Patología Molecular)",
        category: "Biología Molecular",
        note: "Panel Molecular de Cáncer Colorrectal: RAS Wild-Type (KRAS/NRAS no mutados), BRAF V600E WT, Microsatélites Estables (MSS).",
        isKey: false,
        detail: "Perfil genómico favorable para opciones sistémicas con anti-EGFR si fuera requerido en el futuro."
      },
      {
        date: "22/08/2022",
        professional: "Dr. Ignacio Ferrara (Cirugía Oncológica)",
        category: "Cirugía",
        note: "Cirugía simultánea: Sigmoidectomía oncológica + Metastasectomía hepática de segmento VI con márgenes R0.",
        isKey: true,
        detail: "Recuperación postoperatoria sin complicaciones mayores. Alta hospitalaria al día 6."
      },
      {
        date: "05/10/2022",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de Quimioterapia Adyuvante: Esquema mFOLFOX6 cada 14 días (plan 12 ciclos).",
        isKey: true,
        detail: "Oxaliplatino 85 mg/m² + Leucovorina 400 mg/m² + 5-FU bolo 400 mg/m² e infusión continua 2400 mg/m² en 46 hs."
      },
      {
        date: "20/03/2023",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Evolución",
        note: "Finalización exitosa de los 12 ciclos de mFOLFOX6. Neurotoxicidad periférica leve G1. Estado de remisión completa (NED).",
        isKey: true,
        detail: "Pasa a programa estricto de vigilancia clínica, bioquímica e imagenológica."
      },
      {
        date: "15/09/2023",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Control",
        note: "Control semestral (Mes 6 post-QT): TC TAP sin lesiones recidivantes. CEA: 1.8 ng/mL.",
        isKey: false,
        detail: "Hígado remanente homogéneo sin nuevas lesiones. Fosas ilíacas y lecho de anastomosis sin alteraciones."
      },
      {
        date: "18/03/2024",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Control",
        note: "Control anual (Mes 12 post-QT): TC TAP de control y Videocolonoscopía de seguimiento.",
        isKey: true,
        detail: "Colonoscopía: Anastomosis ampliamente permeable sin signos de recidiva local. Sin pólipos sincrónicos. TC TAP sin evidencia tumoral."
      },
      {
        date: "10/08/2024",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Control",
        note: "Control clínico y de laboratorio (Mes 17 post-QT). Paciente asintomático con excelente calidad de vida, ECOG 0. CEA normal (1.6 ng/mL).",
        isKey: true,
        detail: "Se planifica próximo control tomográfico y laboratorio semestral para Marzo 2025."
      }
    ],
    labResults: [
      {
        date: "10/07/2022",
        test: "CEA",
        value: 42.1,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/07/2022",
        test: "Hemoglobina",
        value: 11.2,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/07/2022",
        test: "Creatinina",
        value: 0.88,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/09/2022",
        test: "CEA",
        value: 2.1,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/09/2022",
        test: "Hemoglobina",
        value: 12.0,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "22/03/2023",
        test: "CEA",
        value: 1.8,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "22/03/2023",
        test: "Hemoglobina",
        value: 13.5,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "22/03/2023",
        test: "GOT",
        value: 24,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "22/03/2023",
        test: "GPT",
        value: 28,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "12/03/2024",
        test: "CEA",
        value: 1.5,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "12/03/2024",
        test: "Hemoglobina",
        value: 14.1,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/08/2024",
        test: "CEA",
        value: 1.6,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/08/2024",
        test: "Hemoglobina",
        value: 14.3,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-003-1",
        type: "TC",
        date: "15/07/2022",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Basal preoperatorio",
        isBaseline: true,
        relevantFindings: "Masa estenosante en sigmoides de 45 mm. Lesión focal hipervascular única en segmento hepático VI de 35 mm. Sin adenomegalias a distancia ni metástasis pulmonares.",
        targetLesions: [
          {
            location: "Masa tumoral sigmoides",
            measurement: 45,
            lesionKey: "masa_tumoral_sigmoides"
          },
          {
            location: "Metástasis hepática segmento VI",
            measurement: 35,
            lesionKey: "metastasis_hepatica_segmento_vi"
          }
        ],
        nonTargetLesions: [
          {
            location: "Ganglios mesentéricos regionales",
            status: "Presente"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 760
      },
      {
        id: "img-demo-003-2",
        type: "TC",
        date: "28/02/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Post-cirugía / En curso de mFOLFOX6",
        isBaseline: false,
        relevantFindings: "Cambios anatómicos post-colectomía y metastasectomía hepática de segmento VI. Sin evidencia de lesiones residuales ni recidiva tumoral. Remisión Completa (CR) / Sin evidencia de enfermedad (NED).",
        targetLesions: [
          {
            location: "Masa tumoral sigmoides",
            measurement: 0,
            lesionKey: "masa_tumoral_sigmoides"
          },
          {
            location: "Metástasis hepática segmento VI",
            measurement: 0,
            lesionKey: "metastasis_hepatica_segmento_vi"
          }
        ],
        nonTargetLesions: [
          {
            location: "Lechos quirúrgicos",
            status: "Sin lesiones recidivantes"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 530
      },
      {
        id: "img-demo-003-3",
        type: "TC",
        date: "18/03/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Vigilancia activa (1 año post-tratamiento)",
        isBaseline: false,
        relevantFindings: "Estudio tomográfico de alta resolución. Parénquima hepático y pulmonar limpios, sin lesiones focales sospechosas. Sin recidiva locorregional en anastomosis cólica.",
        targetLesions: [
          {
            location: "Masa tumoral sigmoides",
            measurement: 0,
            lesionKey: "masa_tumoral_sigmoides"
          },
          {
            location: "Metástasis hepática segmento VI",
            measurement: 0,
            lesionKey: "metastasis_hepatica_segmento_vi"
          }
        ],
        nonTargetLesions: [
          {
            location: "Área toracoabdominal",
            status: "Sin evidencia tumoral (NED)"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 160
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Cuál es el protocolo de vigilancia estricto post-metastasectomía hepática R0 según guías internacionales?",
        timestamp: Date.now() - 1000 * 60 * 60 * 6
      },
      {
        role: "model",
        text: `En pacientes con Cáncer Colorrectal Estadio IV resecado con intención curativa (R0) y quimioterapia perioperatoria completada:

1. **Monitoreo de Antígeno Carcinoembrionario (CEA):**
   - Dosaje cada 3 meses durante los primeros 2 años.
   - Dosaje cada 6 meses entre los años 3 y 5.
   - *Nota:* Una elevación confirmada del CEA obliga a descartar recidiva hepática/pulmonar temprana mediante TC o RMN hepática con contraste hepatoespecífico.

2. **Estudios de Imágenes (TC Toraco-Abdomino-Pelviana):**
   - TC TAP con contraste endovenoso cada 3 a 6 meses durante los primeros 2 años.
   - Luego cada 6 a 12 meses hasta completar 5 años.

3. **Videocolonoscopía:**
   - Realizar al año de la cirugía resectiva.
   - Si no hay pólipos ni lesiones avanzadas, repetir a los 3 años y luego cada 5 años.

4. **Fundamento Clínico:**
   - Hasta un 50-60% de las recurrencias post-metastasectomía hepática ocurren en los primeros 2 años. La detección precoz permite re-resección o terapias ablativas (RFA/SBRT) con impacto positivo en sobrevida global.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 6 + 1800
      }
    ],
    lastUpdated: Date.now()
  }
];
