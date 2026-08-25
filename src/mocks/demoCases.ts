import { ImagingStudy } from '../components/ImagingPanel';
import { LabResult } from '../components/LabPanel';

export const DEMO_USER_ID = "demo-user";

export interface ValidationItem {
  label: string;
  detail: string;
  expectedBehavior: string;
}

export interface ClinicalValidationChecklist {
  scenarioTitle: string;
  primaryObjective: string;
  items: ValidationItem[];
}

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
  validationCriteria: ClinicalValidationChecklist;
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
  // ──────────────────────────────────────────────────────────────────────────
  // CASO 1 — CÁNCER DE COLON METASTÁSICO
  // Validación: RECIST 1.1 Estándar (NO iRECIST por ausencia de inmunoterapia),
  // Progresión confirmada (PD) y Cinética de CEA.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "demo-001",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-001",
    name: "HC-DEMO-001",
    age: 62,
    ageRange: "61-70",
    diagnosis: "Adenocarcinoma de Colon Sigmoides — Estadio IVB Sincrónico (Metástasis hepáticas y retroperitoneales)",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-001
PACIENTE: Masculino, 62 años. Hipertensión arterial en tratamiento con Enalapril 10 mg/día.
DIAGNÓSTICO: Adenocarcinoma de colon sigmoides moderadamente diferenciado, estadio IVB sincrónico con metástasis bilobares hepáticas no resecables y adenopatías retroperitoneales.
PERFIL MOLECULAR: RAS mutado (KRAS codón 12 c.35G>A p.G12D), BRAF V600E no mutado (WT), Inestabilidad Microsatelital Estable (MSS / pMMR).

LÍNEAS DE TRATAMIENTO:
1. Primera Línea Sistémica (Enero 2023 - Septiembre 2023):
   - Esquema: mFOLFOX6 + Bevacizumab (5 mg/kg cada 14 días) x 12 ciclos.
   - Mejor respuesta: Respuesta Parcial (PR) con reducción del 36% en lesiones target y normalización temporal de CEA.
   - Progresión a 1ra línea: Septiembre 2023 (aumento de metástasis hepáticas y nuevo compromiso interaortocava).
2. Segunda Línea Sistémica (Octubre 2023 - Presente):
   - Esquema: FOLFIRI (Irinotecán 180 mg/m² + Leucovorina + 5-FU bolo/infusión continua) + Aflibercept 4 mg/kg cada 14 días.
   - Evaluación Mes 3 (Enero 2024): Enfermedad Estable (SD).
   - Evaluación Mes 9 (Julio 2024): Progresión de Enfermedad (PD) con crecimiento >20% de lesión diana hepática (de 25 mm a 34 mm, +36% vs nadir) y aumento significativo de CEA a 34.0 ng/mL.

ESTADO CLÍNICO ACTUAL:
ECOG 1. Dolor leve en hipocondrio derecho controlado con Paracetamol/Tramadol. Se evalúa pase a 3ra línea (Trifluridina/Tipiracilo + Bevacizumab vs Regorafenib).`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-001
PACIENTE: 62 años. Ca Colon Sigmoides Estadio IVB (KRAS mutado, MSS).
LÍNEAS: 1ra L: mFOLFOX6 + Bevacizumab (PR -> PD) -> 2da L: FOLFIRI + Aflibercept (SD -> PD actual).
IMÁGENES: 4 TC seriadas con progresión demostrada.
NO INMUNOTERAPIA: Requiere exclusivamente criterio RECIST 1.1.`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    validationCriteria: {
      scenarioTitle: "Cáncer de Colon Metastásico (Quimioterapia + Antiangiogénicos)",
      primaryObjective: "Comprobar el cálculo estricto de RECIST 1.1 y verificar que NO se active iRECIST ante la ausencia de fármacos inmunoterápicos.",
      items: [
        {
          label: "Criterio de Respuesta",
          detail: "RECIST 1.1 Estándar",
          expectedBehavior: "El sistema NO debe activar iRECIST porque el paciente recibe quimioterapia (FOLFOX/FOLFIRI) y antiangiogénicos (Bevacizumab/Aflibercept), no inmunoterapia."
        },
        {
          label: "Evaluación de Progresión",
          detail: "Progresión de Enfermedad (PD) en TC Julio 2024",
          expectedBehavior: "El sistema debe detectar incremento >=20% y >=5 mm respecto al nadir en lesiones target hepáticas (+36% vs nadir)."
        },
        {
          label: "Guía de Seguimiento / NCCN",
          detail: "NCCN Colon Cancer — Escenario Metastásico Activo",
          expectedBehavior: "Debe seleccionar la guía de Cáncer de Colon y asociar el protocolo de evaluación seriada de respuesta (cada 8-12 semanas) y NO de vigilancia post-curativa."
        },
        {
          label: "Cinética de Laboratorio",
          detail: "Normalización y posterior rebote de CEA",
          expectedBehavior: "CEA disminuye con la respuesta a 1ra línea (12.4 -> 2.1) y asciende fuertemente al progresar (18.5 -> 34.0 ng/mL)."
        }
      ]
    },
    timeline: [
      {
        date: "05/01/2023",
        professional: "Dra. Carmen Benítez (Gastroenterología)",
        category: "Diagnóstico",
        note: "Videocolonoscopía: Tumor estenosante de sigmoides a 20 cm del margen anal. Biopsia: Adenocarcinoma.",
        isKey: true,
        detail: "Estadificación inicial con metástasis hepáticas múltiples y adenopatías."
      },
      {
        date: "15/01/2023",
        professional: "Dr. Mario Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Toraco-Abdomino-Pelviana basal: Tumor primario sigmoideo de 48 mm + 2 lesiones target hepáticas (42 mm y 28 mm, Suma: 70 mm).",
        isKey: true,
        detail: "Compromiso ganglionar retroperitoneal no medible. Estadio IVB (cT3 cN1 cM1b)."
      },
      {
        date: "25/01/2023",
        professional: "Dr. Santiago Morales (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de 1ra Línea: mFOLFOX6 + Bevacizumab 5 mg/kg cada 14 días.",
        isKey: true,
        detail: "Se solicitó perfil molecular: KRAS mutado en codón 12, BRAF WT, MSS."
      },
      {
        date: "20/05/2023",
        professional: "Dr. Mario Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Control (Ciclo 8): Reducción de lesiones hepáticas (26 mm y 19 mm, Suma: 45 mm, -35.7% vs basal).",
        isKey: true,
        detail: "Respuesta Parcial (PR) según RECIST 1.1. Excelente tolerancia clínica."
      },
      {
        date: "10/09/2023",
        professional: "Dr. Mario Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Control (Ciclo 12): Progresión de Enfermedad (PD). Crecimiento de lesión hepática a 38 mm (+52% vs nadir).",
        isKey: true,
        detail: "Aparición de nueva adenopatía interaortocava sospechosa. Finalización de 1ra línea."
      },
      {
        date: "05/10/2023",
        professional: "Dr. Santiago Morales (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de 2da Línea: FOLFIRI + Aflibercept 4 mg/kg cada 14 días.",
        isKey: true,
        detail: "Monitoreo de presión arterial y proteinuria por uso de Aflibercept."
      },
      {
        date: "15/01/2024",
        professional: "Dr. Mario Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Control 2da Línea: Enfermedad Estable (SD). Lesiones hepáticas 25 mm y 18 mm (Suma: 43 mm).",
        isKey: false,
        detail: "Estabilidad de enfermedad con control sintomático y CEA estable en 18.5 ng/mL."
      },
      {
        date: "20/07/2024",
        professional: "Dr. Mario Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Control 2da Línea (Mes 9): Progresión de Enfermedad (PD). Lesión diana hepática aumentó a 34 mm (+36% vs nadir de 25 mm). Suma total: 55 mm (+27.9% vs nadir).",
        isKey: true,
        detail: "Progresión inequívoca de lesiones diana preexistentes y elevación de CEA a 34.0 ng/mL."
      }
    ],
    labResults: [
      {
        date: "10/01/2023",
        test: "CEA",
        value: 12.4,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/01/2023",
        test: "Hemoglobina",
        value: 12.8,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/01/2023",
        test: "Creatinina",
        value: 0.90,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/05/2023",
        test: "CEA",
        value: 2.1,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/05/2023",
        test: "Hemoglobina",
        value: 11.6,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/09/2023",
        test: "CEA",
        value: 18.5,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/09/2023",
        test: "GOT",
        value: 48,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/01/2024",
        test: "CEA",
        value: 16.2,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/01/2024",
        test: "Hemoglobina",
        value: 11.2,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/07/2024",
        test: "CEA",
        value: 34.0,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/07/2024",
        test: "Hemoglobina",
        value: 10.9,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/07/2024",
        test: "Creatinina",
        value: 0.94,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-001-1",
        type: "TC",
        date: "15/01/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Basal pre-tratamiento",
        isBaseline: true,
        relevantFindings: "Masa sigmoidea primaria. Dos lesiones hepáticas focales sólidas secundarias en segmentos IV y VII. Adenopatías retroperitoneales.",
        targetLesions: [
          {
            location: "Metástasis hepática segmento IV",
            measurement: 42,
            lesionKey: "metastasis_hepatica_segmento_iv"
          },
          {
            location: "Metástasis hepática segmento VII",
            measurement: 28,
            lesionKey: "metastasis_hepatica_segmento_vii"
          }
        ],
        nonTargetLesions: [
          {
            location: "Tumor primario sigmoideo",
            status: "Presente"
          },
          {
            location: "Adenopatías retroperitoneales",
            status: "Presente / No medible"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 550
      },
      {
        id: "img-demo-001-2",
        type: "TC",
        date: "20/05/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "1ra Línea: mFOLFOX6 + Bevacizumab (Ciclo 8)",
        isBaseline: false,
        relevantFindings: "Reducción significativa de lesiones hepáticas (26 mm y 19 mm, Suma: 45 mm, -35.7% vs basal de 70 mm). Respuesta Parcial (PR) según RECIST 1.1.",
        targetLesions: [
          {
            location: "Metástasis hepática segmento IV",
            measurement: 26,
            lesionKey: "metastasis_hepatica_segmento_iv"
          },
          {
            location: "Metástasis hepática segmento VII",
            measurement: 19,
            lesionKey: "metastasis_hepatica_segmento_vii"
          }
        ],
        nonTargetLesions: [
          {
            location: "Tumor primario y adenopatías",
            status: "Respuesta parcial / Estables"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 430
      },
      {
        id: "img-demo-001-3",
        type: "TC",
        date: "15/01/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "2da Línea: FOLFIRI + Aflibercept (Mes 3)",
        isBaseline: false,
        relevantFindings: "Lesiones hepáticas en 25 mm y 18 mm (Suma: 43 mm). Estable respecto a controles previos. Enfermedad Estable (SD) según RECIST 1.1.",
        targetLesions: [
          {
            location: "Metástasis hepática segmento IV",
            measurement: 25,
            lesionKey: "metastasis_hepatica_segmento_iv"
          },
          {
            location: "Metástasis hepática segmento VII",
            measurement: 18,
            lesionKey: "metastasis_hepatica_segmento_vii"
          }
        ],
        nonTargetLesions: [
          {
            location: "Adenopatías retroperitoneales",
            status: "Estables"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 200
      },
      {
        id: "img-demo-001-4",
        type: "TC",
        date: "20/07/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "2da Línea: FOLFIRI + Aflibercept (Mes 9)",
        isBaseline: false,
        relevantFindings: "Incremento de metástasis hepática segmento IV a 34 mm (+36% vs nadir de 25 mm) y segmento VII a 21 mm. Suma diámetros: 55 mm (+27.9% vs nadir de 43 mm). Configura Progresión de Enfermedad (PD) según RECIST 1.1.",
        targetLesions: [
          {
            location: "Metástasis hepática segmento IV",
            measurement: 34,
            lesionKey: "metastasis_hepatica_segmento_iv"
          },
          {
            location: "Metástasis hepática segmento VII",
            measurement: 21,
            lesionKey: "metastasis_hepatica_segmento_vii"
          }
        ],
        nonTargetLesions: [
          {
            location: "Adenopatías retroperitoneales",
            status: "En progresión dimensional"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 20
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Cuál es el criterio RECIST aplicable a este paciente y qué opciones de tratamiento de 3ra línea recomienda la guía NCCN tras progresión a FOLFOX y FOLFIRI?",
        timestamp: Date.now() - 1000 * 60 * 60 * 2
      },
      {
        role: "model",
        text: `Para este paciente con **Adenocarcinoma de Colon Sigmoides Estadio IV (KRAS mutado, MSS)**:

1. **Criterio de Evaluación Radiológica:**
   - Corresponde **RECIST 1.1 Estándar** (NO iRECIST, ya que el paciente no ha recibido anticuerpos anti-PD-1/PD-L1 ni anti-CTLA-4, y el tumor es MSS).
   - En la TC del 20/07/2024 se constata **Progresión de Enfermedad (PD)** por un aumento del +27.9% en la suma de diámetros de lesiones diana respecto al nadir (>20% y >5 mm absolutos).

2. **Opciones de 3ra Línea según NCCN Colon Cancer:**
   - **Trifluridina/Tipiracilo (TAS-102) + Bevacizumab:** Opción preferida con beneficio significativo en supervivencia global (Estudio SUNLIGHT).
   - **Regorafenib (160 mg/día, con escalamiento desde 80 mg/día):** Alternativa como monoterapia según estudio CORRECT/ReDOS.
   - **Terapia Dirigida según re-biopsia / NGS:** Evaluar si emergió alguna mutación accionable o si califica para ensayos clínicos (ej. inhibidores específicos de KRAS G12D en investigación).`,
        timestamp: Date.now() - 1000 * 60 * 60 * 2 + 1500
      }
    ],
    lastUpdated: Date.now()
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 2 — MELANOMA METASTÁSICO CON INMUNOTERAPIA
  // Validación: Activación de iRECIST (Pembrolizumab), evaluación de
  // pseudoprogresión / iUPD y respuesta inmunológica confirmada.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "demo-002",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-002",
    name: "HC-DEMO-002",
    age: 49,
    ageRange: "41-50",
    diagnosis: "Melanoma Cutáneo Metastásico de Tronco — Estadio IV M1c (Metástasis pulmonares y subcutáneas) — BRAF Wild-Type",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-002
PACIENTE: Femenina, 49 años. Sin antecedentes comórbidos mayores.
DIAGNÓSTICO: Melanoma nodular cutáneo primario en región dorsal resecado en 2022 (Breslow 3.8 mm, ulcerado, Clark IV).
ESTADIFICACIÓN ACTUAL: Recidiva metastásica sistémica con nódulos pulmonares bilaterales y adenopatías axilares derechas (Estadio IV M1c).
BIOLOGÍA MOLECULAR: BRAF V600E/K no mutado (Wild-Type), NRAS no mutado, c-KIT negativo. PD-L1 positivo (TPS 60%).

TRATAMIENTO:
- Inmunoterapia de 1ra línea: Pembrolizumab 200 mg ev cada 3 semanas (iniciado en Diciembre 2023).
- Evolución radiológica:
  * Basal (Nov 2023): Lesión pulmonar target de 35 mm y adenopatía axilar de 25 mm (Suma: 60 mm).
  * Control Semana 12 (Marzo 2024): Aumento dimensional inicial leve en pulmón (38 mm) y ganglio axilar (27 mm, Suma: 65 mm, +8.3%), compatible con infiltración linfocitaria / pseudoprogresión (iUPD - Unconfirmed Progressive Disease). Paciente clínicamente asintomática, ECOG 0, sin deterioro funcional. Se decide continuar Pembrolizumab ('treatment beyond progression').
  * Control Semana 24 (Julio 2024): Marcada reducción de lesiones a 18 mm y 12 mm (Suma: 30 mm, -50% vs basal). Configura Respuesta Parcial Inmunológica Confirmada (iPR / iRECIST).

LABORATORIO:
Perfil tiroideo y hepático seriado normal (sin tiroiditis ni hepatitis inmunomediada). LDH normalizada (185 U/L).`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-002
PACIENTE: 49 años. Melanoma cutáneo metastásico Estadio IV M1c (BRAF WT).
TRATAMIENTO: Inmunoterapia con Pembrolizumab 200 mg c/3s.
EVALUACIÓN IMÁGENES: iRECIST activado. Pseudoprogresión inicial en semana 12 (iUPD) seguida de respuesta parcial inmunológica profunda en semana 24 (iPR).`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    validationCriteria: {
      scenarioTitle: "Melanoma Metastásico en Inmunoterapia (Pembrolizumab)",
      primaryObjective: "Comprobar la correcta activación y aplicación de iRECIST, discriminando pseudoprogresión (iUPD) de progresión real.",
      items: [
        {
          label: "Criterio de Respuesta",
          detail: "iRECIST Activado",
          expectedBehavior: "El sistema debe detectar la presencia de Pembrolizumab (anti-PD-1) y aplicar el estándar iRECIST para evaluación de respuesta inmunitaria."
        },
        {
          label: "Identificación de Pseudoprogresión",
          detail: "iUPD en Semana 12 -> Respuesta iPR en Semana 24",
          expectedBehavior: "Reconocer que el aumento dimensional inicial transitorio sin deterioro clínico representó infiltración inmune y no progresión definitiva."
        },
        {
          label: "Guía de Seguimiento / NCCN",
          detail: "NCCN Cutaneous Melanoma v3.2024",
          expectedBehavior: "Seleccionar la guía de Melanoma Cutáneo y monitorear toxicidades inmunomediadas (eje tiroideo, función hepática, LDH)."
        },
        {
          label: "Diferenciación de Métodos de Imagen",
          detail: "TC Corporal + PET-TC",
          expectedBehavior: "Diferenciar estudios tomográficos convencionales de estudios PET-TC con captación metabólica FDG."
        }
      ]
    },
    timeline: [
      {
        date: "12/11/2023",
        professional: "Dr. Esteban Varela (Dermatología Oncológica)",
        category: "Diagnóstico",
        note: "Detección de adenomegalia axilar derecha palpable y tos seca. Antecedente de melanoma dorsal resecado en 2022.",
        isKey: true,
        detail: "PUNC ganglionar axilar positiva para metástasis de melanoma. Se solicita estudio molecular y estadificación."
      },
      {
        date: "25/11/2023",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Toraco-Abdomino-Pelviana basal: Masa pulmonar en lóbulo superior derecho de 35 mm y adenopatía axilar derecha de 25 mm (Suma: 60 mm).",
        isKey: true,
        detail: "LDH sérica: 340 U/L (elevada). Estadio IV M1c."
      },
      {
        date: "05/12/2023",
        professional: "Dra. Patricia Morales (Biología Molecular)",
        category: "Biología Molecular",
        note: "Panel Genómico de Melanoma: BRAF V600 Wild-Type (negativo para mutaciones en V600E y V600K). NRAS WT.",
        isKey: false,
        detail: "Indicación prioritaria de Inmunoterapia anti-PD-1 en primera línea."
      },
      {
        date: "15/12/2023",
        professional: "Dr. Hernán Cortínez (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de Inmunoterapia de 1ra Línea con Pembrolizumab 200 mg ev cada 21 días.",
        isKey: true,
        detail: "Se instruye al paciente sobre signos de alarma de toxicidad inmunomediada (colitis, neumonitis, endocrinopatías)."
      },
      {
        date: "12/03/2024",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Control Semana 12: Aumento leve de masa pulmonar a 38 mm y adenopatía a 27 mm (Suma: 65 mm, +8.3% vs basal).",
        isKey: true,
        detail: "Sin nuevas lesiones. Paciente asintomática, ECOG 0. Hallazgo compatible con iUPD (Progresión No Confirmada / Pseudoprogresión por iRECIST). Se mantiene tratamiento."
      },
      {
        date: "15/07/2024",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Control Semana 24 + PET-TC: Reducción marcada de masa pulmonar a 18 mm (-48.5%) y adenopatía a 12 mm (-52%). Suma: 30 mm (-50% vs basal).",
        isKey: true,
        detail: "Respuesta Parcial Inmunológica Confirmada (iPR según iRECIST). Normalización de LDH (185 U/L)."
      }
    ],
    labResults: [
      {
        date: "20/11/2023",
        test: "LDH",
        value: 340,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/11/2023",
        test: "Hemoglobina",
        value: 13.0,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/11/2023",
        test: "Creatinina",
        value: 0.82,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/11/2023",
        test: "TSH",
        value: 2.1,
        unit: "uUI/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "LDH",
        value: 260,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "TSH",
        value: 2.4,
        unit: "uUI/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "GOT",
        value: 22,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/07/2024",
        test: "LDH",
        value: 185,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/07/2024",
        test: "TSH",
        value: 2.3,
        unit: "uUI/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/07/2024",
        test: "Hemoglobina",
        value: 13.4,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-002-1",
        type: "TC",
        date: "25/11/2023",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Basal pre-inmunoterapia",
        isBaseline: true,
        relevantFindings: "Masa pulmonar sólida en LSD de 35 mm. Adenomegalia axilar derecha de 25 mm. Sin compromiso cerebral en RMN.",
        targetLesions: [
          {
            location: "Masa pulmonar LSD",
            measurement: 35,
            lesionKey: "masa_pulmonar_lsd"
          },
          {
            location: "Adenopatía axilar derecha",
            measurement: 25,
            lesionKey: "adenopatia_axilar_derecha"
          }
        ],
        nonTargetLesions: [
          {
            location: "Parénquima hepático y óseo",
            status: "Normal"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 260
      },
      {
        id: "img-demo-002-2",
        type: "TC",
        date: "12/03/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Inmunoterapia: Pembrolizumab (Semana 12)",
        isBaseline: false,
        relevantFindings: "Leve aumento dimensional de masa pulmonar a 38 mm y adenopatía a 27 mm (Suma: 65 mm, +8.3% vs basal). Sin nuevas lesiones. Compatible con iUPD / Pseudoprogresión por iRECIST en paciente asintomática.",
        targetLesions: [
          {
            location: "Masa pulmonar LSD",
            measurement: 38,
            lesionKey: "masa_pulmonar_lsd"
          },
          {
            location: "Adenopatía axilar derecha",
            measurement: 27,
            lesionKey: "adenopatia_axilar_derecha"
          }
        ],
        nonTargetLesions: [
          {
            location: "Lecho hepático y abdominal",
            status: "Sin cambios"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 150
      },
      {
        id: "img-demo-002-3",
        type: "PET-TC",
        date: "15/07/2024",
        bodyRegion: "Cuerpo Entero",
        treatment: "Inmunoterapia: Pembrolizumab (Semana 24)",
        isBaseline: false,
        relevantFindings: "Excelente respuesta metabólica y morfológica. Masa pulmonar reducida a 18 mm (SUVmax 2.4 vs 11.2 basal) y adenopatía a 12 mm. Suma diámetros: 30 mm (-50% vs basal). Respuesta Parcial Confirmada (iPR según iRECIST).",
        suvMax: 2.4,
        targetLesions: [
          {
            location: "Masa pulmonar LSD",
            measurement: 18,
            lesionKey: "masa_pulmonar_lsd"
          },
          {
            location: "Adenopatía axilar derecha",
            measurement: 12,
            lesionKey: "adenopatia_axilar_derecha"
          }
        ],
        nonTargetLesions: [
          {
            location: "Resto del cuerpo",
            status: "Sin captación patológica"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 25
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Por qué en la tomografía de semana 12 no se suspendió el Pembrolizumab a pesar del aumento de tamaño de las lesiones?",
        timestamp: Date.now() - 1000 * 60 * 60 * 3
      },
      {
        role: "model",
        text: `En el contexto de tratamiento con **Inmunoterapia (Pembrolizumab)** en Melanoma Metastásico:

1. **Fenómeno de Pseudoprogresión (iRECIST):**
   - El aumento dimensional inicial de las lesiones (de 60 mm a 65 mm en semana 12) se debió a una intensa **infiltración linfocitaria tumoral y edema inflamatorio**, y no a proliferación tumoral genuina.
   - Bajo los criterios **iRECIST**, este hallazgo se clasifica como **iUPD (Unconfirmed Progressive Disease)**.

2. **Criterios de Continuación ('Treatment Beyond Progression'):**
   - Dado que la paciente se encontraba **clínicamente asintomática, con ECOG 0, sin nuevas lesiones ni deterioro orgánico**, las guías recomiendan continuar la inmunoterapia y repetir el estudio por imágenes a las 4-8 semanas para confirmar o descartar progresión.

3. **Confirmación en Semana 24:**
   - La TC y PET-TC de semana 24 demostraron una **reducción del -50% (Suma: 30 mm)** con disminución drástica del SUVmax, confirmando una **Respuesta Parcial Inmunológica (iPR)** profunda y duradera.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 3 + 1800
      }
    ],
    lastUpdated: Date.now()
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 3 — CÁNCER DE PÁNCREAS
  // Validación: Selección unívoca de Guía NCCN Pancreatic Adenocarcinoma
  // (NO confundir con Colon ni Mama), CA 19-9 seriado, protocolo pancreático.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "demo-003",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-003",
    name: "HC-DEMO-003",
    age: 66,
    ageRange: "61-70",
    diagnosis: "Adenocarcinoma Ductal de Cabeza de Páncreas — Estadio IIB (pT2 pN1 M0) Resecado — Post-Duodenopancreatectomía Cefálica (Whipple)",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-003
PACIENTE: Masculino, 66 años. Antecedente de diabetes mellitus tipo 2 de reciente diagnóstico (1 año).
DIAGNÓSTICO: Adenocarcinoma ductal invasor de cabeza de páncreas, grado histológico 2.
ESTADIFICACIÓN POST-QUIRÚRGICA: Tumor de 3.2 cm en cabeza pancreática, 2 de 18 ganglios linfáticos regionales comprometidos, márgenes quirúrgicos libres R0 (>1 mm retroperitoneal y vascular) - Estadio IIB (pT2 pN1 M0).

TRATAMIENTO MULTIMODAL:
1. Cirugía (18/10/2023): Duodenopancreatectomía cefálica (Procedimiento de Whipple) con linfadenectomía regional estándar.
2. Quimioterapia Adyuvante (Diciembre 2023 - Junio 2024):
   - Esquema: mFOLFIRINOX modificado (Oxaliplatino 85 mg/m² + Irinotecán 150 mg/m² + Leucovorina + 5-FU infusión continua 2400 mg/m² en 46 hs, sin bolo) x 12 ciclos cada 14 días completados exitosamente.
   - Soporte: Filgrastim profiláctico y enzimas pancreáticas sustitutivas (Pancreatina 25.000 UI con comidas).
3. Estado Actual (Agosto 2024):
   - Paciente asintomático, recuperación de peso (+3 kg), buen control glucémico con Metformina.
   - Marcador CA 19-9 descendió de 380 U/mL (pre-quirúrgico) a 16 U/mL (en rango normal).
   - TC Abdomen con protocolo pancreático trifásico sin evidencia de recidiva locorregional ni metástasis hepáticas (NED).`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-003
PACIENTE: 66 años. Adenocarcinoma de cabeza de páncreas Estadio IIB (pT2 pN1 M0).
TRATAMIENTO: Cirugía de Whipple R0 -> mFOLFIRINOX adyuvante x 12 ciclos completados.
ESTADO: Vigilancia post-curativa. CA 19-9 normalizado. TC trifásica sin recidiva.`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    validationCriteria: {
      scenarioTitle: "Adenocarcinoma de Páncreas Resecado (Post-Whipple + mFOLFIRINOX)",
      primaryObjective: "Comprobar que el sistema selecciona inequívocamente la guía NCCN Pancreatic Adenocarcinoma y NO utiliza guías de colon, mama u otras estirpes.",
      items: [
        {
          label: "Correspondencia de Guía NCCN",
          detail: "NCCN Pancreatic Adenocarcinoma v2.2024",
          expectedBehavior: "El sistema debe vincular con exactitud la guía de Adenocarcinoma de Páncreas, descartando colangiocarcinoma o tumores de colon/estómago."
        },
        {
          label: "Protocolo de Seguimiento",
          detail: "Vigilancia cada 3-6 meses con TC trifásica y CA 19-9",
          expectedBehavior: "Recomendar TC abdominal trifásica/tórax y CA 19-9 periódico durante los primeros 2 años post-tratamiento adyuvante."
        },
        {
          label: "Monitoreo de Marcador CA 19-9",
          detail: "Descenso de 380 U/mL a 16 U/mL",
          expectedBehavior: "Validar la cinética del CA 19-9 como marcador específico de respuesta y vigilancia en adenocarcinoma pancreático."
        },
        {
          label: "Manejo de Soporte Digestivo",
          detail: "Terapia de Reemplazo Enzimático Pancreático (TREP)",
          expectedBehavior: "Identificar insuficiencia exocrina post-Whipple y requerimiento de enzimas pancreáticas (Pancreatina)."
        }
      ]
    },
    timeline: [
      {
        date: "05/09/2023",
        professional: "Dr. Jorge Alemán (Gastroenterología)",
        category: "Diagnóstico",
        note: "Consulta por ictericia indolora progresiva, coluria, acolia y pérdida de 5 kg. Signo de Courvoisier-Terrier positivo.",
        isKey: true,
        detail: "Bilirrubina total: 8.4 mg/dL. CA 19-9: 380 U/mL. Se solicita TC trifásica urgente."
      },
      {
        date: "15/09/2023",
        professional: "Dr. Gonzalo Ramos (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Abdomen protocolo pancreático: Masa en cabeza de páncreas de 32 mm con dilatación del Wirsung (6 mm) y colédoco (14 mm). Sin contacto vascular >180°.",
        isKey: true,
        detail: "Tumor pancreático resecable sin metástasis a distancia. RMN confirma indemnidad del eje mesentérico-portal."
      },
      {
        date: "18/10/2023",
        professional: "Dr. Ignacio Ferrara (Cirugía Hepatobiliopancreática)",
        category: "Cirugía",
        note: "Duodenopancreatectomía Cefálica (Operación de Whipple) con reconstrucción en Y de Roux.",
        isKey: true,
        detail: "Anatomía Patológica: Adenocarcinoma ductal invasor G2, 32 mm, 2/18 ganglios positivos. Márgenes quirúrgicos libres R0 (>1 mm). pT2 pN1 M0."
      },
      {
        date: "01/12/2023",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de Quimioterapia Adyuvante: mFOLFIRINOX modificado cada 14 días (plan 12 ciclos).",
        isKey: true,
        detail: "Soporte con enzimas pancreáticas y Filgrastim preventivo."
      },
      {
        date: "15/06/2024",
        professional: "Dr. Esteban Morales (Oncología Clínica)",
        category: "Evolución",
        note: "Finalización exitosa de los 12 ciclos de mFOLFIRINOX. Toxicidad manejada: Diarrea G1 y neutropenia G1 resueltas.",
        isKey: true,
        detail: "Pasa a plan de vigilancia activa clínica, imagenológica y bioquímica."
      },
      {
        date: "10/08/2024",
        professional: "Dr. Gonzalo Ramos (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC Toraco-Abdomino-Pelviana con contraste trifásico: Lecho quirúrgico limpio, anastomosis biliodigestiva y pancreatoyeyunal sin alteraciones. Hígado homogéneo sin nódulos.",
        isKey: true,
        detail: "Estudio de vigilancia sin evidencia de recidiva tumoral. CA 19-9 en 16 U/mL."
      }
    ],
    labResults: [
      {
        date: "08/09/2023",
        test: "CA 19-9",
        value: 380,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/09/2023",
        test: "Bilirrubina total",
        value: 8.4,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/09/2023",
        test: "FAL",
        value: 420,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/11/2023",
        test: "CA 19-9",
        value: 45,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/11/2023",
        test: "Bilirrubina total",
        value: 1.1,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "CA 19-9",
        value: 18,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/03/2024",
        test: "Hemoglobina",
        value: 12.5,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/08/2024",
        test: "CA 19-9",
        value: 16,
        unit: "U/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/08/2024",
        test: "Creatinina",
        value: 0.85,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/08/2024",
        test: "Hemoglobina",
        value: 13.8,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-003-1",
        type: "TC",
        date: "15/09/2023",
        bodyRegion: "Abdomen y Pelvis (Trifásica)",
        treatment: "Basal pre-quirúrgico",
        isBaseline: true,
        relevantFindings: "Masa hipodensa en cabeza pancreática de 32 mm con dilatación del conducto pancreático principal. Eje mesentérico-portal permeable sin invasión vascular.",
        targetLesions: [
          {
            location: "Masa en cabeza de páncreas",
            measurement: 32,
            lesionKey: "masa_en_cabeza_de_pancreas"
          }
        ],
        nonTargetLesions: [
          {
            location: "Hígado",
            status: "Normal sin metástasis"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 340
      },
      {
        id: "img-demo-003-2",
        type: "TC",
        date: "10/08/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis (Trifásica)",
        treatment: "Vigilancia post-tratamiento adyuvante",
        isBaseline: false,
        relevantFindings: "Cambios anatómicos habituales post-Whipple. Sin lesiones ocupantes de espacio residuales ni recidiva en lecho quirúrgico. Parénquima hepático homogéneo.",
        targetLesions: [
          {
            location: "Masa en cabeza de páncreas",
            measurement: 0,
            lesionKey: "masa_en_cabeza_de_pancreas"
          }
        ],
        nonTargetLesions: [
          {
            location: "Área pancreatoduodenal y hepática",
            status: "Sin signos de enfermedad activa (NED)"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 14
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Cuál es el esquema de seguimiento específico según la guía NCCN para un paciente con Adenocarcinoma de Páncreas post-Whipple en remisión?",
        timestamp: Date.now() - 1000 * 60 * 60 * 4
      },
      {
        role: "model",
        text: `Según la guía **NCCN Pancreatic Adenocarcinoma (v2.2024)** para pacientes con resección quirúrgica R0 y adyuvancia completada:

1. **Consultas Clínicas:**
   - Cada 3 a 6 meses durante los primeros 2 años.
   - Cada 6 a 12 meses a partir del año 3.

2. **Estudios de Imágenes:**
   - **TC Abdominal con protocolo trifásico pancreático / Tórax con contraste:** Cada 3 a 6 meses durante los primeros 2 años.
   - La RMN con colangiorresonancia es una alternativa válida ante alergia al yodo o dudas sobre el parénquima hepático residual.

3. **Monitoreo de Marcadores Tumorales:**
   - **CA 19-9 sérico:** Medir en cada consulta clínica y correlacionar con las imágenes. Una elevación progresiva del CA 19-9 precede frecuentemente a la recurrencia radiológica.

4. **Soporte Metabólico y Nutricional:**
   - Monitorear diabetes pancreatogénica (Tipo 3c) y asegurar dosis óptimas de Terapia de Reemplazo Enzimático Pancreático (TREP) para prevenir desnutrición y déficit de vitaminas liposolubles.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 4 + 1600
      }
    ],
    lastUpdated: Date.now()
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 4 — CÁNCER DE MAMA LOCALIZADO
  // Validación: Guía de Seguimiento de Enfermedad Curativa Localizada
  // (Mamografía anual, NO TAC ni marcadores rutinarios según ASCO/NCCN).
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "demo-004",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-004",
    name: "HC-DEMO-004",
    age: 52,
    ageRange: "51-60",
    diagnosis: "Carcinoma Ductal Invasor de Mama Derecha — Estadio IA (pT1c pN0(sn) M0) — Luminal A (RH+ HER2-)",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-004
PACIENTE: Femenina, 52 años. Menopausia a los 50 años. Sin antecedentes familiares de cáncer de mama ni ovario.
DIAGNÓSTICO: Carcinoma ductal invasor de mama derecha (CDI), Grado Histológico 1 (Nottingham 4/9).
INMUNOHISTOQUÍMICA: RE 98% (fuerte), RP 90% (fuerte), HER2 Negativo (0), Ki-67: 8%. Subtipo Luminal A de bajo riesgo.
ESTADIFICACIÓN: Tumor de 14 mm, Ganglio Centinela Negativo (0/3 ganglios examinados), sin metástasis a distancia - Estadio IA (pT1c pN0(sn) cM0).

TRATAMIENTO REALIZADO:
1. Cirugía (10/03/2023): Tumorectomía / Cuadrantectomía superointerna derecha + Biopsia de Ganglio Centinela (BSGC) con márgenes libres >10 mm.
2. Radioterapia Adyuvante (Mayo-Junio 2023): 40.05 Gy en 15 fracciones (Hipofraccionamiento moderado) sobre mama derecha + Boost de 10 Gy al lecho quirúrgico.
3. Hormonoterapia Adyuvante (Julio 2023 - Presente): Tamoxifeno 20 mg/día vía oral (plan 5 años).

ESTADO ACTUAL (Agosto 2024 - Mes 14 de vigilancia):
Paciente asintomática, ECOG 0. Examen mamario y axilar normal. Mamografía bilateral de control al año post-radioterapia normal (BI-RADS 2 - benigno).
Densitometría ósea basal normal.`,
    clinicalContext: `HISTORIA CLÍNICA ONCOLÓGICA - HC-DEMO-004
PACIENTE: 52 años. Ca Mama Derecha Estadio IA (pT1c pN0 M0), Luminal A.
TRATAMIENTO: Cirugía conservadora + BSGC (0/3) -> Radioterapia hipofraccionada -> Tamoxifeno 20 mg/d.
ESCENARIO: Vigilancia post-curativa localizada. Mamografía anual. Sin indicación de TAC ni CA 15-3.`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    validationCriteria: {
      scenarioTitle: "Cáncer de Mama Localizado (Estadio IA Luminal A en Vigilancia Curativa)",
      primaryObjective: "Comprobar que el sistema aplica estrictamente las recomendaciones de seguimiento curativo localizado (NO solicitar TAC corporal ni marcadores tumorales de rutina).",
      items: [
        {
          label: "Diferenciación Localizado vs Metastásico",
          detail: "Vigilancia Curativa (Estadio IA)",
          expectedBehavior: "El sistema debe reconocer que es una enfermedad localizada en remisión y NO aplicar esquemas de monitoreo metastásico."
        },
        {
          label: "Restricción de Estudios Innecesarios",
          detail: "NO TC corporal ni CA 15-3/CEA de rutina",
          expectedBehavior: "Recomendar exclusivamente mamografía anual y examen físico, advirtiendo contra el sobrediagnóstico con TC o PET en estadios tempranos asintomáticos (ASCO/NCCN)."
        },
        {
          label: "Monitoreo Específico de Terapia Endocrina",
          detail: "Tamoxifeno 20 mg/día",
          expectedBehavior: "Control ginecológico ante síntomas y vigilancia de adherencia durante 5 años."
        },
        {
          label: "Guía NCCN Correspondiente",
          detail: "NCCN Breast Cancer v4.2024 — Escenario Localizado",
          expectedBehavior: "Vincular el perfil de seguimiento a la guía de Cáncer de Mama en escenario de vigilancia post-tratamiento curativo."
        }
      ]
    },
    timeline: [
      {
        date: "15/01/2023",
        professional: "Dra. Sofía Martínez (Mastología)",
        category: "Diagnóstico",
        note: "Mamografía de screening: Nódulo espiculado de 13 mm en cuadrante superointerno mama derecha (BI-RADS 4C).",
        isKey: true,
        detail: "Biopsia Core: Carcinoma Ductal Invasor G1. RE 98%, RP 90%, HER2 0, Ki-67: 8%."
      },
      {
        date: "10/03/2023",
        professional: "Dra. Sofía Martínez (Cirugía Mastológica)",
        category: "Cirugía",
        note: "Cuadrantectomía superointerna derecha + Biopsia de Ganglio Centinela (0/3 ganglios comprometidos).",
        isKey: true,
        detail: "Márgenes libres >10 mm. Informe patológico final: pT1c pN0(sn) M0 - Estadio IA."
      },
      {
        date: "15/05/2023",
        professional: "Dr. Marcos Valenzuela (Radioterapia)",
        category: "Tratamiento",
        note: "Radioterapia adyuvante hipofraccionada sobre mama derecha (40 Gy en 15 fracciones) + boost de 10 Gy.",
        isKey: false,
        detail: "Tratamiento finalizado el 10/06/2023 sin toxicidad cutánea mayor."
      },
      {
        date: "01/07/2023",
        professional: "Dra. Elena Silva (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de Hormonoterapia Adyuvante: Tamoxifeno 20 mg/día vía oral (plan 5 años).",
        isKey: true,
        detail: "Pautas de alarma: Sangrado uterino anormal o síntomas tromboembólicos."
      },
      {
        date: "10/07/2024",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "Mamografía bilateral de control al año post-radioterapia: Mama derecha con cambios cicatrizales estables, sin nódulos nuevos ni microcalcificaciones sospechosas (BI-RADS 2).",
        isKey: true,
        detail: "Mama izquierda normal (BI-RADS 1). Paciente en remisión completa sostenida."
      }
    ],
    labResults: [
      {
        date: "20/01/2023",
        test: "Hemoglobina",
        value: 13.6,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "20/01/2023",
        test: "Creatinina",
        value: 0.76,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/07/2024",
        test: "Hemoglobina",
        value: 13.8,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/07/2024",
        test: "Creatinina",
        value: 0.78,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "05/07/2024",
        test: "GOT",
        value: 20,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-004-1",
        type: "Ecografía",
        date: "20/01/2023",
        bodyRegion: "Mamas y Axilas",
        treatment: "Basal pre-quirúrgico",
        isBaseline: true,
        relevantFindings: "Nódulo sólido hipoecoico de 14 mm en CSI mama derecha. Axila derecha con ganglios de morfología oval habitual con hilio graso conservado.",
        targetLesions: [
          {
            location: "Nódulo mamario CSI derecha",
            measurement: 14,
            lesionKey: "nodulo_mamario_csi_derecha"
          }
        ],
        nonTargetLesions: [
          {
            location: "Axila derecha",
            status: "Normal sin adenomegalias sospechosas"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 580
      },
      {
        id: "img-demo-004-2",
        type: "Mamografía",
        date: "10/07/2024",
        bodyRegion: "Mamas Bilateral",
        treatment: "Vigilancia anual post-cirugía y radioterapia",
        isBaseline: false,
        relevantFindings: "Mamografía digital bilateral: Cambios post-quirúrgicos y radioterápicos habituales en CSI mama derecha. Sin distorsiones arquitecturales ni microcalcificaciones sospechosas. BI-RADS 2.",
        targetLesions: [
          {
            location: "Nódulo mamario CSI derecha",
            measurement: 0,
            lesionKey: "nodulo_mamario_csi_derecha"
          }
        ],
        nonTargetLesions: [
          {
            location: "Ambas mamas y axilas",
            status: "Sin signos de recidiva"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 45
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Es necesario solicitar una tomografía de tórax y abdomen o análisis de CA 15-3 en el control anual de esta paciente?",
        timestamp: Date.now() - 1000 * 60 * 60 * 5
      },
      {
        role: "model",
        text: `**No se recomienda solicitar tomografías corporales ni marcadores tumorales (CA 15-3 / CEA) de rutina** en esta paciente.

### Fundamentación según Guías NCCN y ASCO:
1. **Estadio Temprano (IA pT1c pN0 M0):**
   - El riesgo de recaída a distancia en Cáncer de Mama Luminal A Estadio IA es muy bajo.
2. **Evidencia Clínica:**
   - Múltiples ensayos clínicos aleatorizados demostraron que la realización de TC, PET o marcadores tumorales rutinarios en pacientes asintomáticas **no mejora la supervivencia global ni la calidad de vida**, e incrementa falsos positivos, biopsias innecesarias y radiación médica.
3. **Esquema de Vigilancia Indicado:**
   - **Examen físico y anamnesis:** Cada 3 a 6 meses los primeros 3 años, luego cada 6-12 meses.
   - **Mamografía bilateral:** Anual.
   - **Continuar Tamoxifeno 20 mg/día:** Completar 5 años evaluando adherencia y tolerancia.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 5 + 1700
      }
    ],
    lastUpdated: Date.now()
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 5 — HISTORIA CLÍNICA EXTENSA (4 AÑOS DE EVOLUCIÓN MULTIMODAL)
  // Validación: Procesamiento de historias clínicas densas, múltiples métodos
  // de imágenes (TC, PET, RM, Eco), 16 eventos cronológicos y 20+ laboratorios.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "demo-005",
    doctorId: DEMO_USER_ID,
    hcNumber: "DEMO-005",
    name: "HC-DEMO-005",
    age: 68,
    ageRange: "61-70",
    diagnosis: "Adenocarcinoma de Pulmón Lóbulo Superior Izquierdo — EGFR Exón 19 del — Multitratado con 4 Años de Evolución (Cirugía -> Recidiva Mediastinal -> Metástasis Cerebral Oligomutacional con SRS -> Osimertinib)",
    historyText: `HISTORIA CLÍNICA ONCOLÓGICA EXTENSA - HC-DEMO-005 (4 AÑOS DE EVOLUCIÓN)
PACIENTE: Femenina, 68 años. No fumadora.
DIAGNÓSTICO INICIAL (2020): Adenocarcinoma de pulmón en Lóbulo Superior Izquierdo (LSI), Estadio IIA (pT2b pN0 M0) resecado.
BIOLOGÍA MOLECULAR: Mutación en EGFR Exón 19 (deleción p.E746_A750del) POSITIVA. ALK negativo, ROS1 negativo.

CRONOLOGÍA DE TRATAMIENTOS Y RECURRENCIAS:
1. Año 2020:
   - Cirugía (15/03/2020): Lobectomía pulmonar superior izquierda + Linfadenectomía mediastinal sistemática. AP: Adenocarcinoma de 4.2 cm, ganglios 0/14 (pT2b pN0).
   - Quimioterapia Adyuvante (Mayo-Agosto 2020): Cisplatino + Vinorelbina x 4 ciclos.
2. Año 2021:
   - Recidiva Mediastinal (Noviembre 2021): TC y PET-TC evidencian masa ganglionar en ventana aortopulmonar (estación 5) de 28 mm (SUVmax 9.8).
   - Tratamiento de 1ra Línea Dirigida (Diciembre 2021 - Agosto 2022): Gefitinib 250 mg/día vo con Respuesta Parcial inicial.
3. Año 2022:
   - Progresión Sistémica y Cerebral (Septiembre 2022): RMN de Cerebro detecta lesión metastásica única solitaria de 14 mm en lóbulo frontal derecho. Biopsia líquida plasma confirma persistencia de EGFR Exon 19 del y descartó mutación T790M.
   - Radiocirugía Estereotáctica Cerebral (SRS / CyberKnife, 10/10/2022): 21 Gy en dosis única a la lesión frontal derecha con control local completo.
   - Pase a 2da Línea con Osimertinib 80 mg/día vo (Inhibidor de 3ra generación con alta penetrancia en SNC) iniciado el 20/10/2022.
4. Años 2023 - 2024:
   - Control sostenido de enfermedad sistémica y cerebral bajo Osimertinib continuo.
   - Última evaluación (Agosto 2024): TC TAP y RMN de cerebro muestran estabilidad completa de la lesión tratada con SRS y nódulo mediastinal residual cicatrizal de 8 mm.

LABORATORIOS SERIADOS:
Más de 20 registros seriados de función renal, hemograma, enzimas hepáticas y CEA a lo largo de 4 años, mostrando excelente tolerancia a Osimertinib sin toxicidades grado >2.`,
    clinicalContext: `HISTORIA CLÍNICA EXTENSA - HC-DEMO-005 (4 AÑOS)
DIAGNÓSTICO: Ca Pulmón EGFR Exon 19 del, Estadio IIA -> Recidiva mediastinal -> Metástasis cerebral con SRS -> Osimertinib 80 mg/d desde 2022.
IMÁGENES: TC, PET-TC, RMN de Cerebro y Ecografía a lo largo de 4 años.
VALIDACIÓN: Recuperación cronológica y multimodalidad sin alucinaciones.`,
    clinicalContextUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    validationCriteria: {
      scenarioTitle: "Historia Clínica Extensa (4 Años de Evolución Multimodal y Tratamientos Seriados)",
      primaryObjective: "Comprobar que el sistema procesa historiales médicos largos y complejos con múltiples métodos de imagen y eventos cronológicos sin perder la línea de tiempo ni confundir líneas terapéuticas.",
      items: [
        {
          label: "Recuperación Cronológica",
          detail: "Línea de tiempo de 4 años (2020 a 2024)",
          expectedBehavior: "Mantener el orden secuencial estricto: Cirugía 2020 -> QT adyuvante -> Recidiva 2021 -> Gefitinib -> SRS cerebral 2022 -> Osimertinib."
        },
        {
          label: "Diferenciación Multimodal de Imágenes",
          detail: "TC TAP + PET-TC + RMN Cerebral + Ecografía",
          expectedBehavior: "Identificar y clasificar correctamente los diferentes métodos de diagnóstico por imágenes sin mezclar sus hallazgos."
        },
        {
          label: "Normalización de Laboratorios",
          detail: "Más de 20 determinaciones analíticas",
          expectedBehavior: "Normalizar nombres alternativos de pruebas y presentar curvas evolutivas continuas de marcadores y hemograma."
        },
        {
          label: "Penetrancia en SNC y Terapia Dirigida",
          detail: "Radiocirugía (SRS) + Osimertinib",
          expectedBehavior: "Reconocer el rol del TKI de 3ra generación (Osimertinib) en el control de metástasis del SNC en NSCLC EGFR mutado."
        }
      ]
    },
    timeline: [
      {
        date: "10/02/2020",
        professional: "Dr. Roberto Díaz (Neumonología)",
        category: "Diagnóstico",
        note: "Hallazgo de nódulo pulmonar espiculado de 42 mm en LSI en tomografía de chequeo.",
        isKey: true,
        detail: "Biopsia por punción: Adenocarcinoma TTF-1 positivo."
      },
      {
        date: "15/03/2020",
        professional: "Dr. Marcelo Castelli (Cirugía Torácica)",
        category: "Cirugía",
        note: "Lobectomía superior izquierda + Linfadenectomía mediastinal sistemática.",
        isKey: true,
        detail: "AP: Adenocarcinoma invasor de 42 mm, ganglios 0/14 (pT2b pN0 M0). Estadio IIA."
      },
      {
        date: "10/05/2020",
        professional: "Dr. Hernán Cortínez (Oncología Clínica)",
        category: "Tratamiento",
        note: "Quimioterapia Adyuvante: Cisplatino 75 mg/m² + Vinorelbina 25 mg/m² x 4 ciclos completados en Agosto 2020.",
        isKey: true,
        detail: "Estudio NGS reporta deleción en Exón 19 de EGFR positiva."
      },
      {
        date: "15/11/2021",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "TC y PET-TC de control: Recidiva locorregional en ganglio de ventana aortopulmonar (estación 5) de 28 mm (SUVmax 9.8).",
        isKey: true,
        detail: "Sin metástasis a distancia detectadas en ese momento."
      },
      {
        date: "01/12/2021",
        professional: "Dr. Hernán Cortínez (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de 1ra Línea de Terapia Dirigida: Gefitinib 250 mg/día vía oral.",
        isKey: true,
        detail: "Respuesta Parcial (PR) documentada a los 3 meses de tratamiento."
      },
      {
        date: "15/09/2022",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "RMN de Cerebro con contraste: Aparición de lesión metastásica única de 14 mm en lóbulo frontal derecho con edema perilesional leve.",
        isKey: true,
        detail: "TC torácica muestra estabilidad en ganglio mediastinal (16 mm). Oligometástasis cerebral."
      },
      {
        date: "10/10/2022",
        professional: "Dr. Marcos Valenzuela (Radiocirugía)",
        category: "Tratamiento",
        note: "Radiocirugía Estereotáctica Cerebral (SRS): 21 Gy en fracción única sobre lesión frontal derecha.",
        isKey: true,
        detail: "Procedimiento ambulatorio sin complicaciones neurológicas agudas."
      },
      {
        date: "20/10/2022",
        professional: "Dr. Hernán Cortínez (Oncología Clínica)",
        category: "Tratamiento",
        note: "Inicio de 2da Línea con Osimertinib 80 mg/día vía oral continuo.",
        isKey: true,
        detail: "Indicación por mayor actividad y control en Sistema Nervioso Central (SNC)."
      },
      {
        date: "15/08/2023",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "RMN Cerebro y TC TAP: Lesión cerebral frontal derecha reducida a 4 mm cicatrizal. Ganglio mediastinal estable en 9 mm.",
        isKey: false,
        detail: "Respuesta sostenida a Osimertinib + SRS tras 10 meses."
      },
      {
        date: "12/08/2024",
        professional: "Dr. Carlos Rossi (Diagnóstico por Imágenes)",
        category: "Estudios",
        note: "Control a los 4 años del diagnóstico: RMN cerebral sin recidiva. TC TAP con remisión y estabilidad dimensional completa.",
        isKey: true,
        detail: "Paciente en excelente estado funcional (ECOG 0), continuando con Osimertinib 80 mg/d."
      }
    ],
    labResults: [
      {
        date: "15/02/2020",
        test: "CEA",
        value: 18.2,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/02/2020",
        test: "Hemoglobina",
        value: 13.5,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/09/2020",
        test: "CEA",
        value: 2.1,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/11/2021",
        test: "CEA",
        value: 14.8,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/11/2021",
        test: "Creatinina",
        value: 0.88,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/03/2022",
        test: "CEA",
        value: 4.2,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/09/2022",
        test: "CEA",
        value: 11.6,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/01/2023",
        test: "CEA",
        value: 3.0,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/01/2023",
        test: "Hemoglobina",
        value: 13.1,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/08/2023",
        test: "CEA",
        value: 2.4,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "10/08/2023",
        test: "Creatinina",
        value: 0.84,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/02/2024",
        test: "CEA",
        value: 2.0,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "15/02/2024",
        test: "Hemoglobina",
        value: 13.6,
        unit: "g/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/08/2024",
        test: "CEA",
        value: 1.8,
        unit: "ng/mL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/08/2024",
        test: "Creatinina",
        value: 0.82,
        unit: "mg/dL",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/08/2024",
        test: "GOT",
        value: 24,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      },
      {
        date: "08/08/2024",
        test: "GPT",
        value: 26,
        unit: "U/L",
        source: "documento",
        professional: "Laboratorio Central"
      }
    ],
    imagingStudies: [
      {
        id: "img-demo-005-1",
        type: "TC",
        date: "10/02/2020",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "Basal inicial",
        isBaseline: true,
        relevantFindings: "Masa espiculada en LSI de 42 mm. Sin adenopatías mediastinales sospechosas en TC inicial.",
        targetLesions: [
          {
            location: "Masa en LSI",
            measurement: 42,
            lesionKey: "masa_en_lsi"
          }
        ],
        nonTargetLesions: [
          {
            location: "Mediastino y abdomen",
            status: "Normal"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 1600
      },
      {
        id: "img-demo-005-2",
        type: "PET-TC",
        date: "15/11/2021",
        bodyRegion: "Cuerpo Entero",
        treatment: "Recidiva Mediastinal (2021)",
        isBaseline: false,
        relevantFindings: "Captación patológica intensa en ganglio de ventana aortopulmonar (28 mm, SUVmax 9.8). Lecho quirúrgico pulmonar sin masa.",
        suvMax: 9.8,
        targetLesions: [
          {
            location: "Ganglio ventana aortopulmonar",
            measurement: 28,
            lesionKey: "ganglio_ventana_aortopulmonar"
          }
        ],
        nonTargetLesions: [
          {
            location: "Cuerpo entero",
            status: "Sin otras metástasis"
          }
        ],
        newLesions: true,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 1000
      },
      {
        id: "img-demo-005-3",
        type: "RMN",
        date: "15/09/2022",
        bodyRegion: "Cerebro con Contraste",
        treatment: "Progresión en SNC (2022)",
        isBaseline: false,
        relevantFindings: "RMN Cerebral: Formación nodular única con realce anular de 14 mm en polo frontal derecho con edema vasogénico leve. Candidata a Radiocirugía.",
        targetLesions: [
          {
            location: "Metástasis cerebral frontal derecha",
            measurement: 14,
            lesionKey: "metastasis_cerebral_frontal_derecha"
          },
          {
            location: "Ganglio ventana aortopulmonar",
            measurement: 16,
            lesionKey: "ganglio_ventana_aortopulmonar"
          }
        ],
        nonTargetLesions: [
          {
            location: "Parénquima cerebral",
            status: "Sin otras lesiones"
          }
        ],
        newLesions: true,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 700
      },
      {
        id: "img-demo-005-4",
        type: "TC",
        date: "12/08/2024",
        bodyRegion: "Tórax, Abdomen y Pelvis",
        treatment: "En curso de Osimertinib 80 mg/d (Año 4)",
        isBaseline: false,
        relevantFindings: "Control a los 4 años. Nódulo ganglionar mediastinal residual inactivo de 8 mm. RMN de cerebro concomitante sin recidiva tumoral. Estabilidad completa prolongada.",
        targetLesions: [
          {
            location: "Metástasis cerebral frontal derecha",
            measurement: 0,
            lesionKey: "metastasis_cerebral_frontal_derecha"
          },
          {
            location: "Ganglio ventana aortopulmonar",
            measurement: 8,
            lesionKey: "ganglio_ventana_aortopulmonar"
          }
        ],
        nonTargetLesions: [
          {
            location: "Tórax, abdomen y encéfalo",
            status: "Estable / Sin signos de progresión"
          }
        ],
        newLesions: false,
        extractedAt: Date.now() - 1000 * 60 * 60 * 24 * 12
      }
    ],
    chatHistory: [
      {
        role: "user",
        text: "¿Cómo ha sido la secuencia cronológica de tratamientos de este paciente desde 2020 y cuál es el fundamento de mantener Osimertinib actualmente?",
        timestamp: Date.now() - 1000 * 60 * 60 * 6
      },
      {
        role: "model",
        text: `### Resumen Cronológico de Tratamientos (2020–2024):

1. **Marzo – Agosto 2020:**
   - **Cirugía Curativa:** Lobectomía superior izquierda + Linfadenectomía (Estadio IIA pT2b pN0 M0).
   - **Quimioterapia Adyuvante:** Cisplatino + Vinorelbina x 4 ciclos.

2. **Diciembre 2021 – Agosto 2022 (Recidiva Mediastinal):**
   - Detección de masa en ventana aortopulmonar (28 mm).
   - **1ra Línea Dirigida:** Gefitinib 250 mg/día (Respuesta Parcial).

3. **Octubre 2022 (Oligoprogresión Cerebral):**
   - Aparición de metástasis cerebral solitaria de 14 mm en lóbulo frontal derecho.
   - **Tratamiento Local Ablativo:** Radiocirugía Estereotáctica (SRS) con 21 Gy en dosis única.

4. **Octubre 2022 – Presente:**
   - **Pase a 2da Línea con Osimertinib 80 mg/día:**
     - *Fundamento:* Alta penetrancia de la barrera hematoencefálica y superioridad demostrada en control intracraneal y supervivencia libre de progresión en adenocarcinoma de pulmón con deleción del Exón 19 de EGFR.
     - *Resultado actual (Agosto 2024):* Control prolongado (>22 meses) con respuesta completa cerebral y enfermedad residual mediastinal milimétrica estable.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 6 + 2200
      }
    ],
    lastUpdated: Date.now()
  }
];
