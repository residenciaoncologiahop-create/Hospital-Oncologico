import React, { useState, useEffect } from 'react';
import {
  FileText, Loader2, Wand2, UserCog, Save, X, Download, FilePlus, ExternalLink, CheckCircle2, RefreshCcw, Pill, AlertCircle, Check
} from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callGemini } from '../utils/aiProxy';
import { ADMIN_FORMS_REGISTRY } from '../services/adminForms/registry';
import { AdminFormDefinition, AdminFormContext } from '../services/adminForms/types';
import AdminFormReviewModal from './adminForms/AdminFormReviewModal';
import FormPreviewModal from './FormPreviewModal';

interface FormManagerProps {
  patient: any;
  historyText: string;
  files: any[];
  timeline?: any[];
}

// Lista de campos estrictamente requeridos para el trámite oficial de PAMI
const PAMI_MANDATORY_FIELDS: Array<{ key: string; label: string; id: string }> = [
  { key: 'paciente_nombre_real', label: 'Apellido y Nombre', id: 'pami-paciente_nombre_real' },
  { key: 'paciente_fnac', label: 'Fecha de Nacimiento', id: 'pami-paciente_fnac' },
  { key: 'diagnostico_cie10', label: 'Diagnóstico (CIE-10)', id: 'pami-diagnostico_cie10' },
  { key: 'peso', label: 'Peso', id: 'pami-peso' },
  { key: 'talla', label: 'Talla', id: 'pami-talla' },
  { key: 'ecog', label: 'ECOG', id: 'pami-ecog' },
  { key: 'droga_1', label: 'Droga #1 (Principal)', id: 'pami-droga_1' },
  { key: 'informe_clinico_detallado', label: 'Informe Clínico', id: 'pami-informe_clinico_detallado' },
];

const BANCO_MANDATORY_FIELDS: Array<{ key: string; label: string; id: string }> = [
  { key: 'nombre_apellido', label: 'Apellido y Nombre', id: 'banco-nombre_apellido' },
  { key: 'dni', label: 'DNI', id: 'banco-dni' },
  { key: 'fnac', label: 'Fecha de Nacimiento', id: 'banco-fnac' },
  { key: 'diagnostico', label: 'Diagnóstico', id: 'banco-diagnostico' },
  { key: 'peso', label: 'Peso', id: 'banco-peso' },
  { key: 'talla', label: 'Talla', id: 'banco-talla' },
  { key: 'ecog', label: 'ECOG', id: 'banco-ecog' },
  { key: 'droga_1', label: 'Droga #1 (Principal)', id: 'banco-droga_1' },
];

const FormManager: React.FC<FormManagerProps> = ({ patient, historyText, files, timeline }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [formGenerated, setFormGenerated] = useState<Record<string, boolean>>({});
  const [formCorrections, setFormCorrections] = useState<Record<string, string>>({});
  const [lastRegenParams, setLastRegenParams] = useState<Record<string, {
    drugName?: string;
    context?: string;
    servicioDestino?: string;
    motivoSolicitud?: string;
    accumulatedCorrections: string;
  }>>({});
  const [showEsquemaModal, setShowEsquemaModal] = useState(false);
  const [esquemaData, setEsquemaData] = useState({
    numero_ciclos: '', frecuencia_ciclos: '', tiempo_tratamiento: '',
    fecha_inicio: '', medicamentos: '', dosis_m2: '',
    dosis_total_ciclo: '', dias_admin: '', intervalo: ''
  });
  const [pendingDinadicDrug, setPendingDinadicDrug] = useState('');
  const [pendingDinadicCorrection, setPendingDinadicCorrection] = useState('');

  // Estados para Vista Previa interactiva de Formularios PDF antes de su descarga definitiva
  const [activePreview, setActivePreview] = useState<{
    formType: 'pami' | 'admision' | 'renovacion' | 'dinadic' | 'summary';
    title: string;
    code: string;
    subtitle?: string;
    blob: Blob | null;
    filename: string;
  } | null>(null);
  const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);
  const [dinadicData, setDinadicData] = useState<any>(null);
  const [summaryTextContent, setSummaryTextContent] = useState<string>('');

  // Estados y flujo para Nuevos Formularios Administrativos Modulares
  const [selectedAdminForm, setSelectedAdminForm] = useState<AdminFormDefinition | null>(null);
  const [adminFormData, setAdminFormData] = useState<Record<string, any>>({});
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminProcessingId, setAdminProcessingId] = useState<string | null>(null);

  // Modal para seleccionar/escribir el estudio del Formulario 03
  const [showForm03StudyModal, setShowForm03StudyModal] = useState(false);
  const [form03StudyInput, setForm03StudyInput] = useState('');

  // Modal para seleccionar/escribir la medicación de la Planilla PROFE 133
  const [showProfeMedModal, setShowProfeMedModal] = useState(false);
  const [profeMedInput, setProfeMedInput] = useState('');

  // Modal para seleccionar/escribir la medicación de la Ficha de Solicitud de Medicamentos Oncológicos
  const [showSolicitudMedsModal, setShowSolicitudMedsModal] = useState(false);
  const [solicitudMedsInput, setSolicitudMedsInput] = useState('');

  const handleStartAdminFormFlow = async (formDef: AdminFormDefinition, initialValues?: Record<string, any>) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }

    // Si es Formulario 03 y no viene estudio previo, abrir modal para que el médico lo especifique
    if (formDef.id === 'form03_practicas' && !initialValues?.solicitud_estudio) {
      setForm03StudyInput('');
      setShowForm03StudyModal(true);
      return;
    }

    // Si es Planilla PROFE 133 y no viene medicación previa, abrir modal para que el médico la especifique
    if (formDef.id === 'derivacion_profe_133' && !initialValues?.medicacion_solicitada) {
      setProfeMedInput('');
      setShowProfeMedModal(true);
      return;
    }

    // Si es Ficha de Solicitud de Medicamentos Oncológicos y no viene droga previa, abrir modal para que el médico la especifique
    if (formDef.id === 'solicitud_medicamentos_onco' && !initialValues?.droga_principal) {
      setSolicitudMedsInput('');
      setShowSolicitudMedsModal(true);
      return;
    }

    setAdminProcessingId(formDef.id);
    setStatus(`Analizando historia clínica para ${formDef.shortName}...`);
    try {
      const adminContext: AdminFormContext = {
        patient,
        historyText: getEffectiveClinicalContext(),
        timeline: timeline || patient?.timeline || [],
        files,
        doctorData
      };

      const extracted = await formDef.extractData(adminContext, initialValues);
      setAdminFormData(extracted);
      setSelectedAdminForm(formDef);
      setAdminModalOpen(true);
    } catch (e: any) {
      alert(`Error al preparar el formulario ${formDef.shortName}: ${e.message}`);
    } finally {
      setAdminProcessingId(null);
      setStatus('');
    }
  };

  // PAMI State
  const [showPamiReviewModal, setShowPamiReviewModal] = useState(false);
  const [showPamiMissingConfirm, setShowPamiMissingConfirm] = useState(false);
  const [pamiFormData, setPamiFormData] = useState({
    paciente_nombre_real: '',
    paciente_fnac: '',
    paciente_celular: '',
    diagnostico_cie10: '',
    histopatologico: '',
    peso: '',
    talla: '',
    ecog: '',
    estadio_inicial: '',
    estadio_actual: '',
    fecha_diagnostico_inicial: '',
    linea_tratamiento: '',
    antecedentes_qx: '',
    antecedentes_radio: '',
    laboratorio_formateado: '',
    informe_clinico_detallado: '',
    motivo_solicitud: 'Inicio',
    tipo_tratamiento: 'Avanzado',
    ciclos_planeados: '',
    frecuencia_dias: '',
    esquema_tratamiento_solicitado: '',
    droga_1: '',
    droga_2: '',
    droga_3: '',
    droga_4: '',
  });

  // Banco de Drogas Modal State (Admisión y Renovación Completa)
  const [showBancoModal, setShowBancoModal] = useState<'admision' | 'renovacion' | null>(null);
  const [showBancoMissingConfirm, setShowBancoMissingConfirm] = useState(false);
  const [bancoFormData, setBancoFormData] = useState({
    context: 'admision' as 'admision' | 'renovacion',
    // Filiación
    nombre_apellido: '',
    dni: '',
    fnac: '',
    edad: '',
    sexo: 'M' as 'M' | 'F',
    domicilio: '',
    localidad: '',
    provincia: 'Córdoba',
    pais: 'Argentina',
    institucion: 'Hospital Oncológico Provincial - Córdoba',
    telefono: '',
    profesion: '',
    // Diagnóstico & Estadificación
    diagnostico: '',
    cie10: '',
    fecha_diagnostico: '',
    tnm_t: '',
    tnm_n: '',
    tnm_m: '',
    estadio: '',
    receptor_RE: '',
    receptor_RP: '',
    receptor_HER2: '',
    receptor_KRAS: '',
    receptor_EGER: '',
    receptor_otros: '',
    anatomia_patologica: '',
    // Antropometría
    peso: '',
    talla: '',
    ecog: '0',
    // Tratamientos Previos
    cx_primario_si: false,
    cx_especificar: '',
    cx_ganglios_resecados: '',
    cx_ganglios_comprometidos: '',
    cx_fecha: '',
    cx_metastasis_si: false,
    cx_metastasis_especificar: '',
    cx_metastasis_fecha: '',
    rt_primario_si: false,
    rt_metastasis_si: false,
    rt_localizacion: '',
    tratamientos_sistemicos_si: false,
    hormonoterapia_tipo: '', // 'adyuvante' | 'avanzada' | ''
    hormonoterapia_droga: '',
    quimioterapia_tipo: '', // 'neoadyuvante' | 'adyuvante' | 'avanzada' | ''
    quimioterapia_droga: '',
    terapia_blanco_droga: '',
    terapia_blanco_fecha: '',
    inmunoterapia_droga: '',
    inmunoterapia_fecha: '',
    // Tratamiento a Realizar
    tipo_tratamiento: 'avanzado' as 'adyuvante' | 'neoadyuvante' | 'avanzado',
    linea: '1',
    intervalo_ciclo: '21',
    ciclos_programados: '6',
    droga_1: '',
    dosis_1: '',
    dias_1: '',
    total_dia_1: '',
    droga_2: '',
    dosis_2: '',
    dias_2: '',
    total_dia_2: '',
    droga_3: '',
    dosis_3: '',
    dias_3: '',
    total_dia_3: '',
    // Renovación
    motivo_renovacion: 'continua' as 'continua' | 'cambio',
    ciclos_realizados: '',
    respuesta: 'estable' as 'estable' | 'parcial' | 'completa',
    sitio_progresion: '',
    lugar_fecha: '',
  });
  
  const [showDocConfig, setShowDocConfig] = useState(false);
  const [doctorData, setDoctorData] = useState({
    nombre: '', matricula: '', especialidad: 'Oncología Clínica',
    email: '', provincia: '', cuil_prefix: '', cuil_dni: '', cuil_suffix: '',
    cel_area: '', cel_num: ''
  });

  useEffect(() => {
    try {
      const savedDoc = localStorage.getItem('doctor_data_profile_v3');
      if (savedDoc) setDoctorData(JSON.parse(savedDoc));
    } catch (e) { console.error(e); }
  }, []);

  const saveDoctorData = () => {
    localStorage.setItem('doctor_data_profile_v3', JSON.stringify(doctorData));
    setShowDocConfig(false);
    alert("Datos guardados.");
  };

  const forms = [
    { id: 'pami', name: 'Formulario PAMI Oncológico', file: '/forms/pami.pdf', type: 'auto' },
    { id: 'admision', name: 'ADMISIÓN BANCO DE DROGAS', file: '/forms/admision.pdf', type: 'auto_banco', context: 'ADMISIÓN' },
    { id: 'renovacion', name: 'RENOVACIÓN BANCO DE DROGAS', file: '/forms/renovacion.pdf', type: 'auto_banco', context: 'RENOVACIÓN' },
    { id: 'banco', name: 'DINADIC (ex-DADSE)', file: '/forms/nuevo_dinadic.pdf', type: 'auto_dinadic', context: 'SOLICITUD' },
  ];

  const calculateBSA = (weight: string | number, height: string | number) => {
    const w = parseFloat(weight?.toString().replace(',', '.'));
    let h = parseFloat(height?.toString().replace(',', '.'));
    if (!isNaN(h) && h > 0 && h < 3) h = Math.round(h * 100);
    if (!isNaN(w) && !isNaN(h) && w > 0 && w <= 350 && h >= 40 && h <= 250) {
      return Math.sqrt((w * h) / 3600).toFixed(2);
    }
    return '';
  };

  const cleanDate = (val: string) => {
    if (!val) return "";
    const match = val.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
    return "";
  };

  const downloadTemplate = async (formDef: any) => {
    try {
        const response = await fetch(formDef.file, { method: 'HEAD' });
        if (!response.ok) throw new Error("Archivo no encontrado");
        const link = document.createElement('a');
        link.href = formDef.file;
        link.download = `${formDef.name}_Plantilla.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch { alert(`No se encontró el archivo "${formDef.file}". Verifique la carpeta public/forms/`); }
  };

  // --- INTEGRACIÓN DE LÍNEA DE TIEMPO Y HISTORIA CLÍNICA ---
  const getEffectiveClinicalContext = () => {
    let combined = historyText ? historyText.trim() : '';
    const effectiveTimeline = timeline || patient?.timeline || [];
    if (effectiveTimeline && effectiveTimeline.length > 0) {
      const timelineStr = effectiveTimeline
        .map((e: any) => {
          const date = e.date || e.fecha || 'Sin fecha';
          const category = e.category || e.categoria || e.type || 'Evento';
          const prof = e.professional || e.profesional || e.doctor || '';
          const note = e.note || e.nota || e.description || e.descripcion || '';
          const detail = e.detail || e.details || e.detalle || '';
          const keyMarker = e.isKey ? ' [CLAVE]' : '';

          let line = `• [${date}] ${category}${keyMarker}: ${note}`;
          if (prof && prof !== 'N/A' && prof !== '') line += ` (Prof: ${prof})`;
          if (detail) line += `\n  Detalles: ${detail}`;
          return line;
        })
        .join('\n');

      if (combined) {
        combined += `\n\n--- LÍNEA DE TIEMPO / HISTORIAL DE EVENTOS ---\n${timelineStr}`;
      } else {
        combined = `LÍNEA DE TIEMPO / HISTORIAL DE EVENTOS:\n${timelineStr}`;
      }
    }
    return combined;
  };

  const effectiveTimeline = timeline || patient?.timeline || [];
  const hasClinicalData = !!(historyText?.trim() || (files && files.length > 0) || (effectiveTimeline && effectiveTimeline.length > 0));

  // Extracción rápida y confiable de datos del paciente preexistentes (priorizando datos más recientes)
  const extractFallbackPatientData = () => {
    const context = getEffectiveClinicalContext();

    let name = patient?.name || '';
    if (!name || name.toLowerCase() === 'paciente' || name.toLowerCase().includes('derivad') || name.toLowerCase().includes('consulta') || name.toLowerCase().includes('historia') || name.toLowerCase().includes('caso') || name.toLowerCase().includes('melanoma') || name.toLowerCase().includes('cancer') || name.toLowerCase().includes('tumor')) {
      name = '';
    }

    let fnac = patient?.birthDate || '';
    if (!fnac) {
      const fnacMatch = context.match(/(?:fecha\s*(?:de)?\s*nac(?:imiento)?\.?|f\.?\s*nac\.?)\s*[:=]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
      if (fnacMatch) fnac = cleanDate(fnacMatch[1]);
    }

    let dni = patient?.dni || '';
    if (!dni) {
      const dniMatch = context.match(/(?:dni|documento|c\.?i\.?)\s*[:=]?\s*([\d.\s]{7,11})/i);
      if (dniMatch) dni = dniMatch[1].replace(/[^\d]/g, '');
    }

    let phone = patient?.phone || patient?.celular || '';
    if (!phone) {
      const phoneMatch = context.match(/(?:tel(?:[eé]fono)?|cel(?:ular)?|m[oó]vil)\s*[:=]?\s*([-+\d\s()]{7,20})/i);
      if (phoneMatch) phone = phoneMatch[1].trim();
    }

    let weight = patient?.weight ? String(patient.weight) : '';
    if (!weight) {
      const weightMatches = [...context.matchAll(/(?:peso|weight)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?/gi)];
      if (weightMatches.length > 0) {
        weight = weightMatches[weightMatches.length - 1][1].replace(',', '.');
      }
    }

    let height = patient?.height ? String(patient.height) : (patient?.talla ? String(patient.talla) : '');
    if (!height) {
      const heightMatches = [...context.matchAll(/(?:talla|estatura|altura|height)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:cm|m|mts)?/gi)];
      if (heightMatches.length > 0) {
        height = heightMatches[heightMatches.length - 1][1].replace(',', '.');
      }
    }

    let ecog = patient?.ecog !== undefined && patient?.ecog !== null ? String(patient.ecog) : '';
    if (!ecog) {
      const ecogMatches = [...context.matchAll(/ecog\s*[:=]?\s*([0-4])/gi)];
      if (ecogMatches.length > 0) {
        ecog = ecogMatches[ecogMatches.length - 1][1];
      }
    }

    const diagnosis = patient?.primaryDiagnosis || patient?.diagnosis || '';
    const stage = patient?.stage || '';

    return { name, fnac, dni, phone, weight, height, ecog, diagnosis, stage };
  };

  // BANCO DE DROGAS: Extracción con IA profunda para pre-completar todas las celdas
  const extractBancoDrogasData = async (context: string, correction?: string) => {
    const today = new Date().toLocaleDateString('es-AR');
    const isRenovacion = context === 'RENOVACIÓN';

    const prompt = `
      Actúa como MÉDICO ONCÓLOGO EXPERTO. Hoy es ${today}.
      Analizá la historia clínica y extraé TODOS los datos posibles para el formulario Banco de Drogas ${context}.
      IDIOMA: Todo en español. Devolvé ÚNICAMENTE JSON sin markdown.

      REGLAS DE EXTRACCIÓN Y DEDUCCIÓN CLÍNICA (MUY ESTRICTAS):
      1. nombre_apellido: Dejar SIEMPRE en blanco ("") para que el médico lo ingrese manualmente en la celda correspondiente. ❌ NUNCA inventar nombres ni extraer frases clínicas (como "derivado por melanoma", "paciente", etc.).
      2. fecha_diagnostico: Deducir fecha del primer estudio patológico, biopsia o consulta diagnóstica inicial (DD/MM/AAAA).
      3. cx_primario_si: true SOLAMENTE SI el paciente tuvo una CIRUGÍA/RESECCIÓN QUIRÚRGICA de su tumor primario (ej: Mastectomía, Biopsia escisional, Resección). Si solo tuvo tratamientos farmacológicos sistémicos o no fue operado, DEBE SER false.
      4. cx_especificar: EXCLUSIVAMENTE el nombre del PROCEDIMIENTO QUIRÚRGICO. ❌ PROHIBIDO TERMINANTEMENTE colocar nombres de fármacos, quimioterapias o tratamientos sistémicos en campos de cirugía.
      5. cx_metastasis_si: true SOLAMENTE si se realizó metastectomía quirúrgica.
      6. rt_primario_si, rt_metastasis_si: true si recibió radioterapia.
      7. tratamientos_sistemicos_si: true si recibió quimioterapia, hormonoterapia, biológicos o inmunoterapia previa.
      8. drogas_solicitadas: Extraer el fármaco principal y secundarios indicados en el plan actual con dosis, días y total/día si figuran.
      9. IHQ / RECEPTORES (RE, RP, HER2, KRAS, EGFR, Otros/BRAF):
         - Completar ÚNICAMENTE si el marcador es POSITIVO o MUTADO (ej: "Positivo", "BRAF V600E mutado (+)").
         - En marcadores negativos, no evaluados o no aplicables, DEJAR OBLIGATORIAMENTE EN BLANCO ("").
         - ❌ PROHIBIDO TERMINANTEMENTE escribir "no aplica", "no aplicable", "negativo" o "no evaluado".

      ${isRenovacion ? `
      CONTEXTO RENOVACIÓN:
      - motivo_renovacion: "continua" si sigue igual, "cambio" si hubo toxicidad o progresión
      - ciclos_realizados: número de ciclos ya completados
      - ciclos_programados: número total planificado
      - respuesta: "estable", "parcial" o "completa"
      - sitio_progresion: si hubo progresión, dónde
      ` : `
      CONTEXTO ADMISIÓN:
      - anatomia_patologica: Resumen MUY CONCISO Y SINTÉTICO de la patología e IHQ (tipo tumoral, grado, RE, RP, HER2, Ki67). MÁXIMO 180 caracteres.
      - tnm_t, tnm_n, tnm_m: clasificación TNM si existe
      `}

      Devolver este objeto JSON:
      {
        "nombre_apellido": "",
        "dni": "",
        "fnac": "DD/MM/AAAA",
        "edad": "",
        "sexo": "M" o "F",
        "domicilio": "",
        "telefono": "",
        "localidad": "",
        "provincia": "Córdoba",
        "pais": "Argentina",
        "institucion": "Hospital Oncológico Provincial - Córdoba",
        "profesion": "",
        "diagnostico": "",
        "fecha_diagnostico": "DD/MM/AAAA",
        "cie10": "",
        "estadio": "",
        "tnm_t": "", "tnm_n": "", "tnm_m": "",
        "receptor_RE": "", "receptor_RP": "", "receptor_HER2": "", "receptor_KRAS": "", "receptor_EGER": "", "receptor_otros": "",
        "anatomia_patologica": "",
        "peso": "",
        "talla": "",
        "ecog": "0",
        "cx_primario_si": false,
        "cx_especificar": "",
        "cx_ganglios_resecados": "",
        "cx_ganglios_comprometidos": "",
        "cx_fecha": "",
        "cx_metastasis_si": false,
        "cx_metastasis_especificar": "",
        "cx_metastasis_fecha": "",
        "rt_primario_si": false,
        "rt_metastasis_si": false,
        "rt_localizacion": "",
        "tratamientos_sistemicos_si": false,
        "hormonoterapia_tipo": "",
        "hormonoterapia_droga": "",
        "quimioterapia_tipo": "",
        "quimioterapia_droga": "",
        "terapia_blanco_droga": "",
        "terapia_blanco_fecha": "",
        "inmunoterapia_droga": "",
        "inmunoterapia_fecha": "",
        "tipo_tratamiento": "avanzado",
        "linea": "1",
        "intervalo_ciclo": "21",
        "ciclos_programados": "6",
        "droga_1": "", "dosis_1": "", "dias_1": "", "total_dia_1": "",
        "droga_2": "", "dosis_2": "", "dias_2": "", "total_dia_2": "",
        "droga_3": "", "dosis_3": "", "dias_3": "", "total_dia_3": "",
        ${isRenovacion ? `
        "motivo_renovacion": "continua",
        "ciclos_realizados": "",
        "respuesta": "estable",
        "sitio_progresion": ""
        ` : `
        "motivo_renovacion": "continua",
        "ciclos_realizados": "",
        "respuesta": "estable",
        "sitio_progresion": ""
        `}
      }

      CONTEXTO CLÍNICO: ${getEffectiveClinicalContext()}${correction ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${correction}. Incorporar en los campos correspondientes.` : ''}
    `;

    const parts: any[] = [{ text: prompt }];
    if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

    const res = await callGemini({ parts, responseMimeType: "application/json" });
    let clean = res.text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1) clean = clean.substring(s, e + 1);
    return JSON.parse(clean);
  };

  // Inicio de flujo para Banco de Drogas (abre modal completo de celdas)
  const handleStartBancoFlow = async (formType: 'admision' | 'renovacion', correction?: string) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }
    setProcessingId(formType);
    setStatus(`Analizando historia clínica y preparando formulario Banco de Drogas ${formType.toUpperCase()}...`);

    try {
      const aiData = await extractBancoDrogasData(formType === 'admision' ? 'ADMISIÓN' : 'RENOVACIÓN', correction);
      const fallback = extractFallbackPatientData();
      
      const cleanIhqVal = (val: any) => {
        if (!val) return '';
        const str = String(val).trim();
        const lower = str.toLowerCase();
        if (
          lower.includes('no aplic') ||
          lower.includes('negativ') ||
          lower.includes('no eval') ||
          lower.includes('no mutad') ||
          lower === 's/d' ||
          lower === 'n/a' ||
          lower === '-' ||
          lower === 'no'
        ) {
          return '';
        }
        return str;
      };

      const safeName = (fallback.name && !fallback.name.toLowerCase().includes('paciente') && !fallback.name.toLowerCase().includes('derivad') && !fallback.name.toLowerCase().includes('historia')) ? fallback.name : '';

      setBancoFormData({
        context: formType,
        nombre_apellido: safeName,
        dni: aiData.dni || fallback.dni || '',
        fnac: cleanDate(aiData.fnac) || fallback.fnac || '',
        edad: aiData.edad || (patient?.age ? String(patient.age) : ''),
        sexo: aiData.sexo === 'F' ? 'F' : 'M',
        domicilio: aiData.domicilio || '',
        localidad: aiData.localidad || '',
        provincia: aiData.provincia || 'Córdoba',
        pais: aiData.pais || 'Argentina',
        institucion: aiData.institucion || 'Hospital Oncológico Provincial - Córdoba',
        telefono: aiData.telefono || fallback.phone || '',
        profesion: aiData.profesion || '',
        diagnostico: aiData.diagnostico || fallback.diagnosis || '',
        cie10: aiData.cie10 || '',
        fecha_diagnostico: cleanDate(aiData.fecha_diagnostico) || '',
        tnm_t: aiData.tnm_t || '',
        tnm_n: aiData.tnm_n || '',
        tnm_m: aiData.tnm_m || '',
        estadio: aiData.estadio || fallback.stage || '',
        receptor_RE: cleanIhqVal(aiData.receptor_RE),
        receptor_RP: cleanIhqVal(aiData.receptor_RP),
        receptor_HER2: cleanIhqVal(aiData.receptor_HER2),
        receptor_KRAS: cleanIhqVal(aiData.receptor_KRAS),
        receptor_EGER: cleanIhqVal(aiData.receptor_EGER),
        receptor_otros: cleanIhqVal(aiData.receptor_otros),
        anatomia_patologica: aiData.anatomia_patologica || '',
        peso: aiData.peso || fallback.weight || '',
        talla: aiData.talla || fallback.height || '',
        ecog: aiData.ecog || fallback.ecog || '0',
        cx_primario_si: !!aiData.cx_primario_si,
        cx_especificar: aiData.cx_especificar || '',
        cx_ganglios_resecados: aiData.cx_ganglios_resecados || '',
        cx_ganglios_comprometidos: aiData.cx_ganglios_comprometidos || '',
        cx_fecha: cleanDate(aiData.cx_fecha) || '',
        cx_metastasis_si: !!aiData.cx_metastasis_si,
        cx_metastasis_especificar: aiData.cx_metastasis_especificar || '',
        cx_metastasis_fecha: cleanDate(aiData.cx_metastasis_fecha) || '',
        rt_primario_si: !!aiData.rt_primario_si,
        rt_metastasis_si: !!aiData.rt_metastasis_si,
        rt_localizacion: aiData.rt_localizacion || '',
        tratamientos_sistemicos_si: !!aiData.tratamientos_sistemicos_si,
        hormonoterapia_tipo: aiData.hormonoterapia_tipo || '',
        hormonoterapia_droga: aiData.hormonoterapia_droga || '',
        quimioterapia_tipo: aiData.quimioterapia_tipo || '',
        quimioterapia_droga: aiData.quimioterapia_droga || '',
        terapia_blanco_droga: aiData.terapia_blanco_droga || '',
        terapia_blanco_fecha: cleanDate(aiData.terapia_blanco_fecha) || '',
        inmunoterapia_droga: aiData.inmunoterapia_droga || '',
        inmunoterapia_fecha: cleanDate(aiData.inmunoterapia_fecha) || '',
        tipo_tratamiento: (aiData.tipo_tratamiento || 'avanzado').toLowerCase() as any,
        linea: aiData.linea || '1',
        intervalo_ciclo: aiData.intervalo_ciclo || '21',
        ciclos_programados: aiData.ciclos_programados || '6',
        droga_1: aiData.droga_1 || lastRegenParams[formType]?.drugName || '',
        dosis_1: aiData.dosis_1 || '',
        dias_1: aiData.dias_1 || '',
        total_dia_1: aiData.total_dia_1 || '',
        droga_2: aiData.droga_2 || '',
        dosis_2: aiData.dosis_2 || '',
        dias_2: aiData.dias_2 || '',
        total_dia_2: aiData.total_dia_2 || '',
        droga_3: aiData.droga_3 || '',
        dosis_3: aiData.dosis_3 || '',
        dias_3: aiData.dias_3 || '',
        total_dia_3: aiData.total_dia_3 || '',
        motivo_renovacion: (aiData.motivo_renovacion || 'continua').toLowerCase() as any,
        ciclos_realizados: aiData.ciclos_realizados || '',
        respuesta: (aiData.respuesta || 'estable').toLowerCase() as any,
        sitio_progresion: aiData.sitio_progresion || '',
        lugar_fecha: `Córdoba, ${new Date().toLocaleDateString('es-AR')}`,
      });

      setShowBancoModal(formType);
      setShowBancoMissingConfirm(false);
    } catch (e: any) {
      alert("Error al preparar formulario Banco de Drogas: " + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  // Resumen Clínico State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState({
    context: 'SOLICITUD',
    drugName: '',
    nombre: '',
    fnac: '',
    edad: '',
    sexo: 'Masculino',
    dni: '',
    hc: '',
  });

  const openSummaryModal = (context: string) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }
    setSummaryData({
      context,
      drugName: '',
      nombre: patient?.name || '',
      fnac: patient?.birthDate || '',
      edad: patient?.age ? String(patient.age) : '',
      sexo: patient?.gender || 'Masculino',
      dni: patient?.dni || '',
      hc: patient?.hcNumber || patient?.id || '',
    });
    setShowSummaryModal(true);
  };

  // --- DIBUJADOR DEL PDF DE RESUMEN CLÍNICO (FORMATO Y LÓGICA DE 854001a) ---
  const drawClinicalSummaryPdf = async (
    data: typeof summaryData,
    summaryText: string
  ): Promise<{ blob: Blob; filename: string }> => {
    const today = new Date().toLocaleDateString('es-AR');
    const entityLabel = data.context === 'SOLICITUD'
        ? "DINADIC - Dir. de Asistencia Directa por Situaciones Especiales"
        : data.context === 'ADMISIÓN' || data.context === 'BANCO DE DROGAS'
        ? "ADMISIÓN BANCO DE DROGAS"
        : `${data.context} - BANCO DE DROGAS`;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const marginX = 54; 
    const marginTop = 36;
    const marginBottom = 54; 
    let y = height - marginTop;

    let logoLoaded = false;
    try {
        const logoUrl = window.location.origin + '/img/header_logo.png';
        const logoRes = await fetch(logoUrl);
        if (logoRes.ok) {
            const logoBytes = await logoRes.arrayBuffer();
            const pngImage = await pdfDoc.embedPng(logoBytes);
            const pngDims = pngImage.scale(0.38);
            page.drawImage(pngImage, {
                x: (width - pngDims.width) / 2,
                y: y - pngDims.height,
                width: pngDims.width,
                height: pngDims.height,
            });
            y -= (pngDims.height + 24); 
            logoLoaded = true;
        }
    } catch { /* logo load failed */ }

    if (!logoLoaded) {
        const headerText = "HOSPITAL ONCOLÓGICO PROVINCIAL";
        const headerWidth = fontBold.widthOfTextAtSize(headerText, 13);
        page.drawText(headerText, { x: (width - headerWidth) / 2, y, size: 13, font: fontBold });
        y -= 24;
    }

    // Título del documento
    const docTitle = "RESUMEN DE HISTORIA CLÍNICA";
    const titleWidth = fontBold.widthOfTextAtSize(docTitle, 13);
    page.drawText(docTitle, { x: (width - titleWidth) / 2, y, size: 13, font: fontBold });
    y -= 16;

    // Subtítulo
    const subTitleWidth = fontBold.widthOfTextAtSize(entityLabel, 10.5);
    page.drawText(entityLabel, { x: (width - subTitleWidth) / 2, y, size: 10.5, font: fontBold });
    y -= 18;

    // Lugar y Fecha
    const dateText = `Córdoba Capital, ${today}`;
    const dateWidth = font.widthOfTextAtSize(dateText, 9.5);
    page.drawText(dateText, { x: width - marginX - dateWidth, y, size: 9.5, font });
    y -= 10;

    // Línea divisoria superior
    page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.8,
        color: rgb(0, 0, 0)
    });
    y -= 22;

    // 1. IDENTIFICACIÓN
    page.drawText("IDENTIFICACION", { x: marginX, y, size: 10.5, font: fontBold });
    y -= 4;
    page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.8,
        color: rgb(0, 0, 0)
    });
    y -= 16;

    const drawIdentLine = (label: string, value: string) => {
        const labelText = `${label}: `;
        page.drawText(labelText, { x: marginX, y, size: 9.5, font });
        const lw = font.widthOfTextAtSize(labelText, 9.5);
        page.drawText(value || '---', { x: marginX + lw, y, size: 9.5, font });
        y -= 14;
    };

    drawIdentLine("Nombre", (data.nombre || patient?.name || '').toUpperCase());
    drawIdentLine("Fecha de nacimiento", data.fnac || patient?.birthDate || '');
    drawIdentLine("Edad", data.edad ? `${data.edad} años` : (patient?.age ? `${patient.age} años` : ''));
    drawIdentLine("Sexo", data.sexo || patient?.gender || 'Masculino');
    drawIdentLine("DNI", data.dni || patient?.dni || '');
    drawIdentLine("Historia Clínica", data.hc || patient?.hcNumber || patient?.id || '');

    y -= 10;

    // Limpieza y partición del texto generado
    const cleanSummary = summaryText
        .replace(/(\r\n|\n|\r)/gm, "\n")
        .replace(/\*\*/g, "")
        .replace(/###/g, "")
        .replace(/##/g, "")
        .replace(/#/g, "");

    const rawParagraphs = cleanSummary.split('\n');
    const contentWidth = width - (marginX * 2);
    const fontSizeBody = 9.5;
    const fontSizeHeader = 10.5;
    const lineHeight = 13.5;

    for (const p of rawParagraphs) {
        const trimmed = p.trim();
        if (!trimmed) {
            y -= 6;
            continue;
        }

        const upper = trimmed.toUpperCase();
        
        // Omitir si la IA repite el bloque de IDENTIFICACIÓN
        if (upper.includes("IDENTIFICACION") || upper.includes("IDENTIFICACIÓN")) {
            continue;
        }
        if (upper.startsWith("NOMBRE:") || upper.startsWith("FECHA DE NACIMIENTO:") || upper.startsWith("EDAD:") || upper.startsWith("SEXO:") || upper.startsWith("DNI:") || upper.startsWith("HISTORIA CLÍNICA:") || upper.startsWith("HISTORIA CLINICA:")) {
            continue;
        }

        const isSectionHeader = (
            upper === 'RESUMEN CLINICO' || upper === 'RESUMEN CLÍNICO' ||
            upper.startsWith('RESUMEN CLINICO') || upper.startsWith('RESUMEN CLÍNICO') ||
            upper === 'JUSTIFICACION' || upper === 'JUSTIFICACIÓN' ||
            upper.startsWith('JUSTIFICACION') || upper.startsWith('JUSTIFICACIÓN')
        ) && trimmed.length < 40;

        if (isSectionHeader) {
            const headerText = upper.includes('JUSTIFICAC') ? 'JUSTIFICACION' : 'RESUMEN CLINICO';
            y -= 14;
            if (y < marginBottom + 60) {
                page = pdfDoc.addPage();
                y = height - marginTop - 20;
            }
            page.drawText(headerText, { x: marginX, y, size: fontSizeHeader, font: fontBold });
            y -= 4;
            page.drawLine({
                start: { x: marginX, y },
                end: { x: width - marginX, y },
                thickness: 0.8,
                color: rgb(0, 0, 0)
            });
            y -= 16;
            continue;
        }

        const words = trimmed.split(' ');
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSizeBody);

            if (testWidth > contentWidth) {
                if (y < marginBottom + 30) {
                    page = pdfDoc.addPage();
                    y = height - marginTop - 20;
                }
                page.drawText(currentLine, { x: marginX, y, size: fontSizeBody, font });
                y -= lineHeight;
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            if (y < marginBottom + 30) {
                page = pdfDoc.addPage();
                y = height - marginTop - 20;
            }
            page.drawText(currentLine, { x: marginX, y, size: fontSizeBody, font });
            y -= (lineHeight + 3);
        }
    }

    const footerY = 65;
    if (y < footerY + 30) {
        page = pdfDoc.addPage();
    }
    
    const docName = doctorData.nombre ? `Dr/a. ${doctorData.nombre}` : 'Médico Tratante';
    const docMat = doctorData.matricula ? `M.P. ${doctorData.matricula}` : '';
    const docEsp = doctorData.especialidad || 'Oncología Clínica';

    page.drawText(docName, { x: width - marginX - 220, y: footerY, size: 9.5, font: fontBold });
    if (docMat) page.drawText(docMat, { x: width - marginX - 220, y: footerY - 12, size: 8.5, font });
    page.drawText(docEsp, { x: width - marginX - 220, y: footerY - 24, size: 8.5, font });
    page.drawText('Servicio de Oncología Clínica', { x: width - marginX - 220, y: footerY - 36, size: 8.5, font });
    page.drawText('Hospital Oncológico Provincial - Córdoba', { x: width - marginX - 220, y: footerY - 48, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `Resumen_Clinico_${data.context}_${data.nombre || patient?.name || 'Paciente'}.pdf`;
    return { blob, filename };
  };

  // --- GENERADOR DE RESUMEN CLÍNICO ---
  const generateClinicalSummary = async (
    data: typeof summaryData,
    regenParams?: { drugName: string; formId: string; accumulatedCorrections: string }
  ) => {
    if (!hasClinicalData) {
        alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
        return;
    }

    const drugName = data.drugName?.trim() || regenParams?.drugName?.trim();
    if (!drugName) {
      alert("Por favor indique el nombre del fármaco o esquema a solicitar.");
      return;
    }

    setProcessingId('summary');
    setStatus('Analizando historia clínica y línea de tiempo...');

    try {
        const today = new Date().toLocaleDateString('es-AR');

        let strategyPrompt = "";
        if (data.context === 'RENOVACIÓN') {
            strategyPrompt = `ESTRATEGIA: RENOVACIÓN DE ${drugName.toUpperCase()}. Objetivo: Demostrar beneficio clínico y tolerancia.`;
        } else {
            strategyPrompt = `ESTRATEGIA: ADMISIÓN / SOLICITUD DE ${drugName.toUpperCase()}. Objetivo: Justificar indicación inicial (ignorar continuidad si ya la tomó).`;
        }

        const entityLabel = data.context === 'SOLICITUD'
          ? 'DINADIC - Dir. de Asistencia Directa por Situaciones Especiales'
          : data.context === 'ADMISIÓN' || data.context === 'BANCO DE DROGAS'
          ? 'ADMISIÓN BANCO DE DROGAS'
          : `${data.context} - BANCO DE DROGAS`;

        const prompt = `
        Actúa como un Oncólogo Experto del Hospital Oncológico Provincial de Córdoba.
        Hoy es ${today}.
        Redacta el texto para el documento institucional "RESUMEN DE HISTORIA CLÍNICA" correspondiente a: ${entityLabel}.
        
        ${strategyPrompt}
        
        FÁRMACO SOLICITADO POR EL MÉDICO: ${drugName}
        
        DATOS DE IDENTIFICACIÓN DEL PACIENTE:
        - Nombre: ${data.nombre || patient?.name || ''}
        - Fecha de Nacimiento: ${data.fnac || patient?.birthDate || ''}
        - Edad: ${data.edad || patient?.age || ''}
        - Sexo: ${data.sexo || patient?.gender || ''}
        - DNI: ${data.dni || patient?.dni || ''}
        - Historia Clínica: ${data.hc || patient?.hcNumber || patient?.id || ''}
        
        ESTRUCTURA DE RESPUESTA REQUERIDA (TEXTO PLANO, SIN MARKDOWN NI ASTERISCOS):
        
        RESUMEN CLINICO
        Redacta una narrativa cronológica exhaustiva y detallada:
        1. Motivo de consulta inicial, fecha de primera consulta, antecedentes patológicos y quirúrgicos relevantes.
        2. Biopsias y confirmación diagnóstica con fechas exactas, informe anatomopatológico, inmunohistoquímica (receptores, HER2, BRAF, Ki-67, etc.).
        3. Estudios de estadificación por imágenes cronológicos (RMN, PET-TC, TAC, centellograma) con fechas exactas, medidas milimétricas, SUV max y órganos comprometidos.
        4. Tratamientos oncológicos previos recibidos con fechas de inicio/fin, ciclos administrados, toxicidades o causas de cambio/suspensión.
        5. Estado clínico actual del paciente, síntomas, laboratorio reciente y ECOG.
        
        JUSTIFICACION
        Redacta una justificación oncológica sólida y fundamentada para la solicitud de ${drugName}:
        - Justificación de la terapia en base a la histología, mutaciones (ej. BRAF V600E), estadio de la enfermedad y líneas previas.
        - Beneficio esperado (tasas de respuesta, sobrevida libre de progresión).
        - Detalle de la dosis y posología prescripta para el tratamiento específico.
        
        REGLAS OBLIGATORIAS:
        - ❌ SIN ASTERISCOS ni MARKDOWN. Texto limpio.
        - Todas las fechas en formato DD/MM/AAAA.
        - NO incluyas encabezados institucionales ni firmas finales (se colocan automáticamente).
        
        CONTEXTO CLÍNICO: ${getEffectiveClinicalContext()}${regenParams?.accumulatedCorrections ? `\n\nCORRECCIONES SOLICITADAS POR EL MÉDICO:\n${regenParams.accumulatedCorrections}` : ''}
        `;

        const parts: any[] = [{ text: prompt }];
        if (files && files.length > 0) {
            files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));
        }

        const res = await callGemini({ parts });
        const summaryText = res.text || "No se pudo generar el texto.";

        setStatus('Preparando vista previa del Resumen Clínico...');
        setSummaryTextContent(summaryText);
        const { blob, filename } = await drawClinicalSummaryPdf(data, summaryText);
        const previewTitle = data.context === 'ADMISIÓN' || data.context === 'BANCO DE DROGAS'
          ? 'ADMISIÓN BANCO DE DROGAS'
          : data.context === 'RENOVACIÓN'
          ? 'RENOVACIÓN BANCO DE DROGAS'
          : `Resumen de Historia Clínica (${data.context === 'SOLICITUD' ? 'DINADIC' : data.context})`;

        setActivePreview({
          formType: 'summary',
          title: previewTitle,
          code: 'RESUMEN',
          subtitle: `Fármaco solicitado: ${drugName}`,
          blob,
          filename,
        });
        setShowSummaryModal(false);
    } catch (e: any) {
        alert("Error al generar resumen clínico: " + e.message);
    } finally {
        setProcessingId(null);
        setStatus('');
    }
  };

  // --- AUTO-RESOLUCIÓN DE PARÁMETROS DE DROGAS AL DESCARGAR PDF PAMI ---
  const resolveDrugDetails = async (
    drugs: string[],
    patientWeight: string,
    patientHeight: string,
    diagnosis: string
  ): Promise<Array<{ droga: string; presentacion: string; dosis: string; duracion_dias: string }>> => {
    const activeDrugs = drugs.filter(d => d && d.trim().length > 0);
    if (activeDrugs.length === 0) return [];

    const prompt = `
      Actúa como un MÉDICO ONCÓLOGO EXPERTO.
      Paciente: Diagnóstico: "${diagnosis}", Peso: "${patientWeight} kg", Talla: "${patientHeight} cm".
      Lista de drogas solicitadas: ${JSON.stringify(activeDrugs)}.
      
      Para cada droga de la lista, completa sus parámetros para el formulario oficial PAMI:
      - droga: Nombre genérico oficial (ej: "Leuprolide", "Darolutamida", "Pembrolizumab", "Carboplatino", "Paclitaxel", "Osimertinib", "Docetaxel", "Capecitabina").
      - presentacion: Presentación farmacéutica habitual en Argentina (ej: "Fco amp 22.5 mg", "Comp 300 mg", "Fco amp 100 mg / 4 ml", "Comp 80 mg", "Fco amp 150 mg / 15 ml", "Fco amp 300 mg / 50 ml").
      - dosis: Dosis posológica estándar recomendada calculada según peso/BSA si corresponde o dosis habitual de ficha técnica (ej: "22.5 mg IM", "600 mg VO cada 12 hs", "200 mg EV", "AUC 5 (750 mg) EV", "175 mg/m² (295 mg) EV", "80 mg VO diario").
      - duracion_dias: Frecuencia y duración habitual (ej: "Cada 84 días / Hasta prog/tox", "Continuo / Hasta prog/tox", "Cada 21 días / 6 ciclos", "Cada 28 días / Hasta prog/tox").

      Devolver ÚNICAMENTE un array JSON válido sin formato markdown:
      [
        { "droga": "", "presentacion": "", "dosis": "", "duracion_dias": "" }
      ]
    `;

    try {
      const res = await callGemini({ parts: [{ text: prompt }], responseMimeType: "application/json" });
      const text = res.text || "[]";
      let cleanText = text.replace(/```json|```/g, '').trim();
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }
      return JSON.parse(cleanText);
    } catch (e) {
      console.error("Error completando detalles de drogas:", e);
      return activeDrugs.map(d => ({ droga: d, presentacion: '', dosis: '', duracion_dias: '' }));
    }
  };

  const extractPamiData = async (correction?: string) => {
    const today = new Date().toLocaleDateString('es-AR');
    
    const promptText = `
        Actúa como un MÉDICO ONCÓLOGO EXPERTO. Hoy es ${today}.
        OBJETIVO: Extraer y deducir de forma experta todos los datos requeridos para completar el formulario PAMI Oncológico oficial de provisión de medicamentos.
        IDIOMA: Todo en español.
        
        REGLAS DE EXTRACCIÓN Y DEDUCCIÓN CLÍNICA:
        1. fecha_diagnostico_inicial: DEDUCE OBLIGATORIAMENTE la fecha de diagnóstico analizando la fecha del primer estudio patológico, biopsia o consulta inicial en los eventos de la Línea de Tiempo o Historia Clínica (Formato DD/MM/AAAA).
        2. histopatologico: Resumen MUY CONCISO Y SINTÉTICO de la anatomía patológica e inmunohistoquímica (tipo tumoral, grado, RE, RP, HER2, Ki67, mutaciones si aplican). MÁXIMO 180-200 caracteres. ❌ NO explayarse en párrafos extensos.
        3. antecedentes_qx: EXCLUSIVAMENTE procedimientos QUIRÚRGICOS con fecha aproximada (ej: "Mastectomía radical mod. (02/2024)", "Nefrectomía (05/2023)"). ❌ NUNCA colocar tratamientos sistémicos (quimioterapia o drogas) en antecedentes quirúrgicos.
        4. antecedentes_radio: Resumen CONCISO usando abreviaturas médicas estándar (RT=radioterapia, QRT=quimiorradioterapia, BT=braquiterapia, IMRT, SBRT). Incluir dosis y fecha si están disponibles. Máximo 120 caracteres. Ej: "RT adyuvante 50 Gy + boost (09-10/2023)".
        5. fecha_nacimiento (paciente_fnac): Buscar "Fecha nac.:", "Fecha de nacimiento:", "F. Nac" o deducir si está disponible. Formato DD/MM/AAAA.
        6. estadio_inicial: Estadio FIGO o TNM al momento del diagnóstico inicial (ej: "FIGO IVB", "T2N1M0 Estadio IIB", "miT3b N1 M0"). NO el actual.
        7. estadio_actual: Estado de la enfermedad actual (ej: "Enfermedad localmente avanzada (miT3b N1 M0)", "Progresión", "Respuesta parcial", "Remisión completa").
        8. linea_tratamiento: Línea de tratamiento actual (ej: "1ra línea", "2da línea", "Adyuvancia", "Mantenimiento").
        9. laboratorio_formateado: SOLO parámetros oncológicamente relevantes o positivos (hemograma, función renal/hepática, marcadores tumorales como PSA, CEA, CA125). Formato conciso: "Hb 12g/dl, Cr 0.8, PSA 2.27 ng/ml". Máximo 110 caracteres.
        10. INFORME CLÍNICO ACTUAL Y JUSTIFICACIÓN ONCOLÓGICA DETALLADA (informe_clinico_detallado):
            - Redactar un informe clínico oncológico EXHAUSTIVO, PRECISO Y CRONOLÓGICO estructurado en párrafos claros que detalle todos los hitos diagnósticos, imagenológicos y terapéuticos del paciente para fundamentar de manera irrefutable la indicación del esquema de tratamiento oncológico.
            - ESTRUCTURA Y HITOS OBLIGATORIOS:
              * Párrafo 1 (Diagnóstico inicial, histología y presentación): Edad del paciente, diagnóstico oncológico exacto con histopatología completa (tipo histológico, grado, Gleason, biomarcadores RE/RP/HER2/Ki67/BRCA/mutaciones), fecha exacta de biopsia y forma de presentación/marcadores iniciales con fechas.
              * Párrafo 2 (Evolución por imágenes y estadificación cronológica): Detallar cronológicamente los estudios complementarios con fechas y hallazgos clave (RMN, Centellograma, TAC, PET/CT, PET-PSMA, etc.), valores cuantitativos relevantes (SUV máx, medidas en mm/cm), estadificación TNM o FIGO inicial y reestadificación si hubo cambios de estadio o descarte/confirmación de secundarismo.
              * Párrafo 3 (Estrategia terapéutica y justificación del esquema): Objetivo terapéutico (intención curativa, control sistémico avanzado, adyuvancia, rescate), tratamientos previos realizados o suspendidos con sus motivos, y justificación oncológica detallada del esquema propuesto en el plan médico actual con fechas.
            - EXTENSIÓN: Entre 850 y 1400 caracteres. Texto corrido en español con saltos de línea entre párrafos, sin asteriscos ni markdown.
        11. DROGAS / FÁRMACOS RELEVANTES DEL PLAN ACTUAL (droga_1, droga_2, droga_3, droga_4):
            - Si en la historia clínica figuran drogas indicadas, colocarlas en droga_1, droga_2, droga_3, droga_4.
        12. motivo_solicitud: Elegir EXACTAMENTE uno: "Inicio", "Renovación", "Cambio de Toxicidad", "Cambio por Progresión".
        13. tipo_tratamiento: Elegir EXACTAMENTE uno: "Adyuvante", "Neoadyuvante", "Avanzado".
        14. esquema_tratamiento_solicitado: Nombre del esquema o combinación solicitada si figura en el plan.
        
        Devolver ÚNICAMENTE este objeto JSON sin markdown:
        {
          "paciente_nombre_real": "",
          "paciente_fnac": "DD/MM/AAAA",
          "paciente_celular": "",
          "diagnostico_cie10": "",
          "histopatologico": "",
          "peso": "",
          "talla": "",
          "ecog": "",
          "estadio_inicial": "",
          "estadio_actual": "",
          "fecha_diagnostico_inicial": "DD/MM/AAAA",
          "linea_tratamiento": "",
          "antecedentes_qx": "",
          "antecedentes_radio": "",
          "laboratorio_formateado": "",
          "informe_clinico_detallado": "",
          "motivo_solicitud": "Inicio",
          "tipo_tratamiento": "Avanzado",
          "ciclos_planeados": "",
          "frecuencia_dias": "",
          "esquema_tratamiento_solicitado": "",
          "droga_1": "",
          "droga_2": "",
          "droga_3": "",
          "droga_4": ""
        }
    `;

    const correctionNote = correction ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${correction}. Incorporar en los campos correspondientes.` : '';
    const parts: any[] = [{ text: promptText + `\nCONTEXTO CLÍNICO:\n${getEffectiveClinicalContext()}${correctionNote}` }];
    if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

    const res = await callGemini({ parts, responseMimeType: "application/json" });
    const text = res.text || "{}";
    let cleanText = text.replace(/```json|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    return JSON.parse(cleanText);
  };

  const handleStartPamiFlow = async (correction?: string) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }
    setProcessingId('pami');
    setStatus('Analizando historia clínica y preparando formulario PAMI...');

    try {
      const aiData = await extractPamiData(correction);
      const fallback = extractFallbackPatientData();
      
      const mergedData = {
        paciente_nombre_real: aiData.paciente_nombre_real || fallback.name || patient?.name || '',
        paciente_fnac: cleanDate(aiData.paciente_fnac) || aiData.paciente_fnac || fallback.fnac || '',
        paciente_celular: aiData.paciente_celular || fallback.phone || '',
        diagnostico_cie10: aiData.diagnostico_cie10 || fallback.diagnosis || '',
        histopatologico: aiData.histopatologico || '',
        peso: aiData.peso || fallback.weight || '',
        talla: aiData.talla || fallback.height || '',
        ecog: aiData.ecog || fallback.ecog || '',
        estadio_inicial: aiData.estadio_inicial || fallback.stage || '',
        estadio_actual: aiData.estadio_actual || '',
        fecha_diagnostico_inicial: cleanDate(aiData.fecha_diagnostico_inicial) || aiData.fecha_diagnostico_inicial || '',
        linea_tratamiento: aiData.linea_tratamiento || '',
        antecedentes_qx: aiData.antecedentes_qx || '',
        antecedentes_radio: aiData.antecedentes_radio || '',
        laboratorio_formateado: aiData.laboratorio_formateado || '',
        informe_clinico_detallado: aiData.informe_clinico_detallado || '',
        motivo_solicitud: aiData.motivo_solicitud || 'Inicio',
        tipo_tratamiento: aiData.tipo_tratamiento || 'Avanzado',
        ciclos_planeados: aiData.ciclos_planeados || '',
        frecuencia_dias: aiData.frecuencia_dias || '',
        esquema_tratamiento_solicitado: aiData.esquema_tratamiento_solicitado || '',
        droga_1: aiData.droga_1 || '',
        droga_2: aiData.droga_2 || '',
        droga_3: aiData.droga_3 || '',
        droga_4: aiData.droga_4 || '',
      };

      setPamiFormData(mergedData);
      setStatus('Generando vista previa del Formulario PAMI...');
      await fillPamiPDFFromData(mergedData);
      setShowPamiMissingConfirm(false);
    } catch (e: any) {
      alert("Error al preparar formulario PAMI: " + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  const fillPamiPDFFromData = async (data: typeof pamiFormData) => {
    setProcessingId('pami');
    setStatus('Completando datos de medicación y generando PDF PAMI...');

    try {
      const bsa = calculateBSA(data.peso, data.talla);
      const finalName = data.paciente_nombre_real || patient?.name || 'Paciente';

      const activeDrugs = [data.droga_1, data.droga_2, data.droga_3, data.droga_4].map(d => (d || '').trim()).filter(Boolean);
      let drugDetails: Array<{ droga: string; presentacion: string; dosis: string; duracion_dias: string }> = [];
      if (activeDrugs.length > 0) {
        drugDetails = await resolveDrugDetails(activeDrugs, data.peso, data.talla, data.diagnostico_cie10);
      }

      const formUrl = window.location.origin + '/forms/pami.pdf';
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró /forms/pami.pdf`);
      const formBytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();

      const setText = (name: string, val: string, maxFontSize: number = 10, minFontSize: number = 6) => {
        try {
          const f = form.getTextField(name);
          if (!val || !String(val).trim()) return;
          const text = String(val).trim();
          let fieldWidth = 350;
          try {
            const widgets = (f as any).acroField.getWidgets();
            if (widgets && widgets.length > 0) {
              const rect = widgets[0].getRectangle();
              fieldWidth = Math.max(rect.width - 6, 50);
            }
          } catch { /* field rect unavailable */ }
          let fontSize = maxFontSize;
          const AVG_CHAR_RATIO = 0.52;
          while (fontSize > minFontSize) {
            const estimatedWidth = text.length * AVG_CHAR_RATIO * fontSize;
            if (estimatedWidth <= fieldWidth) break;
            fontSize = Math.round((fontSize - 0.5) * 10) / 10;
          }
          f.setText(text);
          f.setFontSize(fontSize);
        } catch { /* field not found in form */ }
      };

      const setCheck = (name: string, shouldCheck: boolean) => {
        try {
          if (shouldCheck) form.getCheckBox(name).check();
          else form.getCheckBox(name).uncheck();
        } catch { /* field not found */ }
      };

      // Patient info
      setText('Apellido y Nombre', finalName);
      setText('fill_21', cleanDate(data.paciente_fnac) || data.paciente_fnac);
      setText('Fecha de nacimiento', cleanDate(data.paciente_fnac) || data.paciente_fnac);
      setText('NUMERO CELULAR', data.paciente_celular);
      setText('NUMERO CELULAR 1', data.paciente_celular);

      // Clinical & staging
      setText('Diagnóstico (CIE 10)', data.diagnostico_cie10);
      setText('Diagnóstico CIE 10', data.diagnostico_cie10);
      setText('Histopatológico', data.histopatologico, 9, 6.5);
      setText('ECOG Performance Status (0-4)', data.ecog);
      setText('ECOG', data.ecog);
      setText('Estadío actual', data.estadio_actual);
      setText('Estadio actual', data.estadio_actual);
      setText('Estadio Inicial', data.estadio_inicial);
      setText('Fecha de Diagnóstico Inicial', data.fecha_diagnostico_inicial);
      setText('Fecha diagnostico inicial', data.fecha_diagnostico_inicial);
      setText('Fecha de Diagnóstico Inicial Estadio Inicial', data.estadio_inicial);
      setText('Línea de tratamiento', data.linea_tratamiento);
      setText('Línea tratamiento', data.linea_tratamiento);
      setText('Ciclos', data.ciclos_planeados);
      setText('Días', data.frecuencia_dias);
      setText('Ciclos Días', data.frecuencia_dias);

      // Antecedents & labs
      setText('Antecedentes Quirúrgicos', data.antecedentes_qx, 9, 7);
      setText('Antecedentes Terapia Radiante', data.antecedentes_radio, 9, 7);
      
      try {
        const fTitleStrip = form.getTextField('Informe clínico actual');
        fTitleStrip.setText('');
      } catch { /* skip */ }

      try {
        const fLargeBox = form.getTextField('Informe Clínico ActualRow1');
        if (data.informe_clinico_detallado && data.informe_clinico_detallado.trim()) {
          const reportText = data.informe_clinico_detallado.trim();
          fLargeBox.enableMultiline();
          const fontSize = reportText.length > 1300 ? 7.8 : reportText.length > 1000 ? 8.2 : 8.5;
          fLargeBox.setFontSize(fontSize);
          fLargeBox.setText(reportText);
        }
      } catch { /* skip */ }

      setText('Datos positivos Laboratorio', data.laboratorio_formateado, 8.5, 7);
      setText('Peso', data.peso);
      setText('Talla', data.talla);
      setText('Sup. Corporal', bsa);
      setText('Sup Corpora', bsa);
      setText('Esquema de tratamiento solicitado', data.esquema_tratamiento_solicitado || activeDrugs.join(' + '));

      // Checkboxes Motivo
      const motivo = (data.motivo_solicitud || '').toLowerCase();
      setCheck('Inicio', motivo.includes('inicio'));
      setCheck('Renovación', motivo.includes('renovac'));
      setCheck('Cambio de Toxicidad', motivo.includes('toxicidad'));
      setCheck('Cambio por Progresión', motivo.includes('progresi'));

      // Checkboxes Tipo de Tratamiento
      const tipo = (data.tipo_tratamiento || '').toLowerCase();
      setCheck('Adyuvante', tipo.includes('adyuvante') && !tipo.includes('neo'));
      setCheck('Neoadyuvante', tipo.includes('neoadyuvante'));
      setCheck('Avanzado', tipo.includes('avanzado'));

      // Drugs Table (Rows 1 to 4)
      for (let i = 1; i <= 4; i++) {
        const d = drugDetails[i - 1];
        if (d && d.droga) {
          setText(`DrogaGenéricoRow${i}`, d.droga, 9, 7);
          setText(`PresentaciónRow${i}`, d.presentacion, 8.5, 6.5);
          setText(`DosisRow${i}`, d.dosis, 8.5, 6.5);
          setText(`N CiclosDuración díasRow${i}`, d.duracion_dias || data.frecuencia_dias, 8.5, 6.5);
        } else {
          setText(`DrogaGenéricoRow${i}`, '');
          setText(`PresentaciónRow${i}`, '');
          setText(`DosisRow${i}`, '');
          setText(`N CiclosDuración díasRow${i}`, '');
        }
      }

      // Doctor information
      setText('Apellido y Nombre_2', doctorData.nombre);
      setText('Matricula', doctorData.matricula);
      setText('Especialidad', doctorData.especialidad);
      setText('Email_2', doctorData.email);
      setText('Provincia', doctorData.provincia);
      setText('CUIL', doctorData.cuil_prefix);
      setText('CUIL1', doctorData.cuil_dni);
      setText('CUIL2', doctorData.cuil_suffix);
      setText('CUIT', doctorData.cuil_prefix);
      setText('CUIT1', doctorData.cuil_dni);
      setText('CUIT2', doctorData.cuil_suffix);
      setText('Celular', doctorData.cel_area);
      setText('Celular_2', doctorData.cel_area);
      setText('Celular1', doctorData.cel_num);
      setText('Lugar y fecha', `Córdoba, ${new Date().toLocaleDateString('es-AR')}`);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PAMI_${finalName.replace(/\s+/g, '_')}.pdf`;
      link.click();
      setStatus('¡Listo!');
      const drugDesc = [data.droga_1, data.droga_2].filter(Boolean).join(' + ') || data.esquema_tratamiento_solicitado;
      setLastRegenParams(prev => ({ ...prev, pami: { drugName: drugDesc, accumulatedCorrections: '' } }));
      setFormGenerated(prev => ({ ...prev, pami: true }));
      setFormCorrections(prev => ({ ...prev, pami: '' }));
      setShowPamiReviewModal(false);
      setShowPamiMissingConfirm(false);
    } catch (e: any) {
      alert('Error al generar PDF de PAMI: ' + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  const handlePamiDownloadClick = () => {
    const missing = PAMI_MANDATORY_FIELDS.filter(f => !String((pamiFormData as any)[f.key] || '').trim());
    if (missing.length > 0) {
      setShowPamiMissingConfirm(true);
    } else {
      fillPamiPDFFromData(pamiFormData);
    }
  };

  const fillPamiPDF = async (formDef: any, regenParams?: { drugName?: string; correction?: string }) => {
    handleStartPamiFlow(regenParams?.correction);
  };

  // BANCO DE DROGAS: Generación final de PDF ADMISIÓN desde los datos confirmados del modal
  const fillAdmisionPDFFromData = async (d: typeof bancoFormData) => {
    setProcessingId('admision');
    setStatus('Generando PDF Admisión Banco de Drogas...');
    try {
      const bsa = calculateBSA(d.peso, d.talla);
      const [fnd, fnm, fna] = (cleanDate(d.fnac) || '').split('/');
      const [dxd, dxm, dxa] = (cleanDate(d.fecha_diagnostico) || '').split('/');

      const formUrl = window.location.origin + '/forms/admision.pdf';
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró /forms/admision.pdf`);
      const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
      const form = pdfDoc.getForm();

      const setT = (name: string, val: string, max = 10, min = 7) => {
        try {
          const f = form.getTextField(name);
          if (!val?.trim()) return;
          const text = String(val).trim();
          let fs = max, w = 350;
          try { const r = (f as any).acroField.getWidgets()[0].getRectangle(); w = Math.max(r.width - 4, 30); } catch { /* widget rect unavailable */ }
          while (fs > min && text.length * 0.52 * fs > w) fs = Math.round((fs - 0.5) * 10) / 10;
          f.setText(text); f.setFontSize(fs);
        } catch { /* field not found in form, skip */ }
      };
      const setBtn = (name: string, checked = true) => {
        try {
          if (checked) form.getCheckBox(name).check();
          else form.getCheckBox(name).uncheck();
        } catch { /* field not found */ }
      };

      const finalPatientName = d.nombre_apellido || patient?.name || 'Paciente';

      // 1. Filiación
      setT('Text1', finalPatientName);
      setT('Text2', d.nacionalidad || 'Argentina');
      setT('Text3', fnd); setT('Text4', fnm); setT('Text5', fna);
      setT('Text6', d.dni);
      setT('Text7', d.profesion);
      setT('Text11', d.edad);
      setT('Text12', d.domicilio);
      setT('Text13', d.telefono);
      setT('Text14', d.localidad);
      setT('Text15', d.provincia || 'Córdoba');
      setT('Text16', d.pais || 'Argentina');
      setT('Text17', d.institucion || 'Hospital Oncológico Provincial - Córdoba');

      if (d.sexo === 'F') { setBtn('Button9', true); setBtn('Button8', false); }
      else { setBtn('Button8', true); setBtn('Button9', false); }

      // 2. Diagnóstico & Estadificación
      setT('Text18', d.diagnostico);
      setT('Text19', d.cie10);
      setT('Text20', d.receptor_RE || '');
      setT('Text21', d.receptor_RP || '');
      setT('Text22', d.receptor_HER2 || '');
      setT('Text23', d.receptor_KRAS || '');
      setT('Text24', d.receptor_EGER || '');
      if (d.receptor_otros && d.receptor_otros.trim()) {
        setT('Text25', 'SI');
        setT('Text26', d.receptor_otros.trim());
      } else {
        setT('Text25', '');
        setT('Text26', '');
      }

      setT('Text27', dxd); setT('Text28', dxm); setT('Text29', dxa);
      setT('Text30', d.tnm_t); setT('Text31', d.tnm_n); setT('Text32', d.tnm_m);
      setT('Text33', d.estadio);

      const ap = d.anatomia_patologica || '';
      setT('Text34', ap.substring(0, 220), 9, 6.5);
      if (ap.length > 220) setT('Text35', ap.substring(220, 440), 9, 6.5);

      // 3. Antropometría
      setT('Text36', bsa);
      setT('Text37', d.peso);
      setT('Text38', d.talla);

      const ecogBtn = ['Button39','Button40','Button41','Button42'];
      const ecogIdx = parseInt(d.ecog || '0');
      ecogBtn.forEach((b, i) => setBtn(b, i === ecogIdx));

      // 4. Tratamientos Previos
      // Cirugía Tumor Primario
      if (d.cx_primario_si) {
        setBtn('Button44', true); setBtn('Button45', false);
        setT('Text46', d.cx_especificar, 9, 6.5);
        setT('Text47', d.cx_ganglios_resecados);
        setT('Text48', d.cx_ganglios_comprometidos);
        const [cxd, cxm, cxa] = (cleanDate(d.cx_fecha) || '').split('/');
        setT('Text49', cxd); setT('Text50', cxm); setT('Text51', cxa);
      } else {
        setBtn('Button44', false); setBtn('Button45', true);
      }

      // Cirugía Metástasis
      if (d.cx_metastasis_si) {
        setBtn('Button52', true); setBtn('Button53', false);
        setT('Text54', d.cx_metastasis_especificar, 9, 7);
        const [mxd, mxm, mxa] = (cleanDate(d.cx_metastasis_fecha) || '').split('/');
        setT('Text55', mxd); setT('Text56', mxm); setT('Text57', mxa);
      } else {
        setBtn('Button52', false); setBtn('Button53', true);
      }

      // Radioterapia
      if (d.rt_primario_si) { setBtn('Button58', true); setBtn('Button59', false); }
      else { setBtn('Button58', false); setBtn('Button59', true); }

      if (d.rt_metastasis_si) { setBtn('Button60', true); setBtn('Button61', false); }
      else { setBtn('Button60', false); setBtn('Button61', true); }

      if (d.rt_localizacion) setT('Text62', d.rt_localizacion, 9, 7);

      // Tratamientos Sistémicos
      if (d.tratamientos_sistemicos_si) {
        setBtn('Button63', true); setBtn('Button64', false);
        if (d.hormonoterapia_tipo === 'adyuvante') setBtn('Button65', true);
        if (d.hormonoterapia_tipo === 'avanzada') setBtn('Button66', true);
        if (d.hormonoterapia_droga) setT('Text67', d.hormonoterapia_droga, 9, 6.5);

        if (d.quimioterapia_tipo === 'neoadyuvante') setBtn('Button68', true);
        if (d.quimioterapia_tipo === 'adyuvante') setBtn('Button69', true);
        if (d.quimioterapia_tipo === 'avanzada') setBtn('Button70', true);
        if (d.quimioterapia_droga) setT('Text71', d.quimioterapia_droga, 9, 6.5);

        if (d.terapia_blanco_droga) {
          setT('Text74', d.terapia_blanco_droga, 9, 6.5);
          const [tbd, tbm, tba] = (cleanDate(d.terapia_blanco_fecha) || '').split('/');
          setT('Text75', tbd); setT('Text76', tbm); setT('Text77', tba);
        }
        if (d.inmunoterapia_droga) {
          setT('Text79', d.inmunoterapia_droga, 9, 6.5);
          const [itd, itm, ita] = (cleanDate(d.inmunoterapia_fecha) || '').split('/');
          setT('Text80', itd); setT('Text81', itm); setT('Text82', ita);
        }
      } else {
        setBtn('Button63', false); setBtn('Button64', true);
      }

      // 5. Tratamiento a Realizar
      const tipo = d.tipo_tratamiento || 'avanzado';
      setBtn('Button83', tipo === 'adyuvante');
      setBtn('Button84', tipo !== 'adyuvante');
      setBtn('Button85', tipo === 'neoadyuvante');
      setBtn('Button86', tipo !== 'neoadyuvante');
      setBtn('Button87', tipo === 'avanzado');
      setBtn('Button88', tipo !== 'avanzado');

      const lineaBtns: Record<string, string> = {'1':'Button89','2':'Button90','3':'Button91'};
      ['1','2','3'].forEach(l => {
        if (lineaBtns[l]) setBtn(lineaBtns[l], d.linea === l);
      });

      setT('Text92', d.intervalo_ciclo);
      setT('Text94', d.ciclos_programados);

      // Drogas
      const drugRows = [
        [d.droga_1, d.dosis_1, d.dias_1, d.total_dia_1, 'Text95','Text96','Text97','Text98'],
        [d.droga_2, d.dosis_2, d.dias_2, d.total_dia_2, 'Text99','Text100','Text101','Text102'],
        [d.droga_3, d.dosis_3, d.dias_3, d.total_dia_3, 'Text103','Text104','Text105','Text106'],
      ];
      drugRows.forEach(([drg, dos, dias, tot, td, tds, tdi, tto]) => {
        if (drg) { setT(td, String(drg).toUpperCase(), 9, 7); setT(tds, String(dos)); setT(tdi, String(dias)); setT(tto, String(tot)); }
      });

      setT('Text141', d.lugar_fecha || `Córdoba, ${new Date().toLocaleDateString('es-AR')}`);
      setT('Text142', `Hospital Oncológico Prov. Cba - ${doctorData.nombre} Mat.${doctorData.matricula}`);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `Admision_BancoDrogas_${finalPatientName.replace(/\s+/g, '_')}.pdf`; link.click();
      setStatus('¡Listo!');
      setLastRegenParams(prev => ({ ...prev, admision: { drugName: d.droga_1.trim(), accumulatedCorrections: '' } }));
      setFormGenerated(prev => ({ ...prev, admision: true }));
      setFormCorrections(prev => ({ ...prev, admision: '' }));
      setShowBancoModal(null);
      setShowBancoMissingConfirm(false);
    } catch (e: any) { alert('Error al generar Admisión: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  // BANCO DE DROGAS: Generación final de PDF RENOVACIÓN desde los datos confirmados del modal
  const fillRenovacionPDFFromData = async (d: typeof bancoFormData) => {
    setProcessingId('renovacion');
    setStatus('Generando PDF Renovación Banco de Drogas...');
    try {
      const bsa = calculateBSA(d.peso, d.talla);
      const [fnd, fnm, fna] = (cleanDate(d.fnac) || '').split('/');

      const formUrl = window.location.origin + '/forms/renovacion.pdf';
      const res = await fetch(formUrl);
      if (!res.ok) throw new Error(`No se encontró /forms/renovacion.pdf`);
      const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
      const form = pdfDoc.getForm();

      const setT = (name: string, val: string, max = 10, min = 7) => {
        try {
          const f = form.getTextField(name);
          if (!val?.trim()) return;
          const text = String(val).trim();
          let fs = max, w = 350;
          try { const r = (f as any).acroField.getWidgets()[0].getRectangle(); w = Math.max(r.width - 4, 30); } catch { /* widget rect unavailable */ }
          while (fs > min && text.length * 0.52 * fs > w) fs = Math.round((fs - 0.5) * 10) / 10;
          f.setText(text); f.setFontSize(fs);
        } catch { /* field not found in form, skip */ }
      };
      const setBtn = (name: string, checked = true) => {
        try {
          if (checked) form.getCheckBox(name).check();
          else form.getCheckBox(name).uncheck();
        } catch { /* field not found */ }
      };

      const finalPatientName = d.nombre_apellido || patient?.name || 'Paciente';

      // 1. Filiación
      setT('Text2', finalPatientName);
      setT('Text3', d.nacionalidad || 'Argentina');
      setT('Text4', fnd); setT('Text5', fnm); setT('Text6', fna);
      setT('Text7', d.dni);
      setT('Text12', d.edad);
      setT('Text13', d.domicilio);
      setT('Text14', d.telefono);
      setT('Text15', d.localidad);
      setT('Text16', d.provincia || 'Córdoba');
      setT('Text17', d.pais || 'Argentina');
      setT('Text19', d.institucion || 'Hospital Oncológico Provincial - Córdoba');

      if (d.sexo === 'F') { setBtn('Button10', true); setBtn('Button9', false); }
      else { setBtn('Button9', true); setBtn('Button10', false); }

      // 2. Motivo Renovación
      if (d.motivo_renovacion === 'continua') {
        setBtn('Button23', true); setBtn('Button24', false);
      } else {
        setBtn('Button23', false); setBtn('Button24', true);
      }
      if (d.sitio_progresion) setT('Text31', d.sitio_progresion, 9, 6.5);

      // 3. Diagnóstico & Receptores
      setT('Text20', d.diagnostico);
      setT('Text21', d.cie10);
      setT('Text32', d.receptor_RE || '');
      setT('Text33', d.receptor_RP || '');
      setT('Text34', d.receptor_HER2 || '');
      setT('Text35', d.receptor_KRAS || '');
      setT('Text36', d.receptor_EGER || '');

      // 4. Antropometría
      setT('Text51', bsa);
      setT('Text52', d.peso);
      setT('Text53', d.talla);

      const ecogBtn = ['Button57','Button58','Button59','Button60'];
      const ecogIdx = parseInt(d.ecog || '0');
      ecogBtn.forEach((b, i) => setBtn(b, i === ecogIdx));

      // 5. Tratamiento a Realizar
      const tipo = d.tipo_tratamiento || 'avanzado';
      setBtn('Button62', tipo === 'adyuvante');
      setBtn('Button63', tipo !== 'adyuvante');
      setBtn('Button64', tipo === 'neoadyuvante');
      setBtn('Button65', tipo !== 'neoadyuvante');
      setBtn('Button66', tipo === 'avanzado');
      setBtn('Button67', tipo !== 'avanzado');

      const lineaBtns: Record<string, string> = {'1':'Button68','2':'Button69','3':'Button70'};
      ['1','2','3'].forEach(l => {
        if (lineaBtns[l]) setBtn(lineaBtns[l], d.linea === l);
      });

      setT('Text71', d.intervalo_ciclo);
      setT('Text72', d.ciclos_realizados);
      setT('Text73', d.ciclos_programados);

      // Respuesta
      setBtn('Button137', d.respuesta === 'estable');
      setBtn('Button138', d.respuesta === 'parcial');
      setBtn('Button139', d.respuesta === 'completa');

      // Drogas
      const drugRows = [
        [d.droga_1, d.dosis_1, d.dias_1, d.total_dia_1, 'Text76','Text79','Text80','Text81'],
        [d.droga_2, d.dosis_2, d.dias_2, d.total_dia_2, 'Text82','Text83','Text84','Text85'],
        [d.droga_3, d.dosis_3, d.dias_3, d.total_dia_3, 'Text86','Text87','Text88','Text89'],
      ];
      drugRows.forEach(([drg, dos, dias, tot, td, tds, tdi, tto]) => {
        if (drg) { setT(td, String(drg).toUpperCase(), 9, 7); setT(tds, String(dos)); setT(tdi, String(dias)); setT(tto, String(tot)); }
      });

      setT('Text140', d.lugar_fecha || `Córdoba, ${new Date().toLocaleDateString('es-AR')}`);
      setT('Text141', `Hospital Oncológico Prov. Cba - ${doctorData.nombre} Mat.${doctorData.matricula}`);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `Renovacion_BancoDrogas_${finalPatientName.replace(/\s+/g, '_')}.pdf`; link.click();
      setStatus('¡Listo!');
      setLastRegenParams(prev => ({ ...prev, renovacion: { drugName: d.droga_1.trim(), accumulatedCorrections: '' } }));
      setFormGenerated(prev => ({ ...prev, renovacion: true }));
      setFormCorrections(prev => ({ ...prev, renovacion: '' }));
      setShowBancoModal(null);
      setShowBancoMissingConfirm(false);
    } catch (e: any) { alert('Error al generar Renovación: ' + e.message); }
    finally { setProcessingId(null); setStatus(''); }
  };

  const handleBancoDownloadClick = () => {
    const missing = BANCO_MANDATORY_FIELDS.filter(f => !String((bancoFormData as any)[f.key] || '').trim());
    if (missing.length > 0) {
      setShowBancoMissingConfirm(true);
    } else {
      if (bancoFormData.context === 'admision') fillAdmisionPDFFromData(bancoFormData);
      else fillRenovacionPDFFromData(bancoFormData);
    }
  };

  // --- DIBUJADOR DEL PDF DE DINADIC (EXACTA LÓGICA Y COORDENADAS) ---
  const drawDinadicPdf = async (
    d: any,
    esquema: typeof esquemaData
  ): Promise<{ blob: Blob; filename: string }> => {
    const today = new Date().toLocaleDateString('es-AR');
    let alturaCorregida = d.altura ? String(d.altura).replace(',', '.') : '';
    if (alturaCorregida && parseFloat(alturaCorregida) < 3) alturaCorregida = String(Math.round(parseFloat(alturaCorregida) * 100));
    const bsa = calculateBSA(d.peso, alturaCorregida);

    const formUrl = window.location.origin + '/forms/nuevo_dinadic.pdf';
    const pdfRes = await fetch(formUrl);
    if (!pdfRes.ok) throw new Error('No se encontró el formulario DINADIC.');
    const pdfDoc = await PDFDocument.load(await pdfRes.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const p1 = pages[0];
    const p2 = pages[1];
    const pH = 841.9;
    const FS = 8;
    const maxW = 480;
    const lineSpacing = 12;

    // offset corregido a +3 (encima de la línea de puntos)
    const draw = (page: any, x: number, top: number, text: string, fs = FS, f = font) => {
      if (!text?.trim()) return;
      const str = String(text).trim();
      page.drawText(str, { x, y: pH - top + 3, size: fs, font: f });
    };

    const drawLines = (page: any, x: number, firstTop: number, text: string, maxLines: number, fs = FS) => {
      if (!text?.trim()) return;
      const charPerLine = Math.floor(maxW / (0.52 * fs));
      const words = String(text).trim().split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        if (lines.length >= maxLines) break;
        const test = cur ? cur + ' ' + w : w;
        if (test.length > charPerLine && cur) { lines.push(cur); cur = w; }
        else { cur = test; }
      }
      if (cur && lines.length < maxLines) lines.push(cur);
      lines.forEach((line, i) => {
        page.drawText(line, { x, y: pH - firstTop + 3 - i * lineSpacing, size: fs, font });
      });
    };

    // ─── PÁGINA 1 ───
    draw(p1, 153, 285.5, d.nombre_apellido);
    draw(p1, 276, 297.5, `${d.tipo_documento || 'DNI'} ${d.numero_documento}`);
    draw(p1, 87,  309.5, d.edad);
    draw(p1, 229, 309.5, d.sexo);
    draw(p1, 115, 321.5, d.domicilio);
    draw(p1, 110, 333.5, d.localidad);
    draw(p1, 347, 333.5, d.provincia || 'Córdoba');
    draw(p1, 103, 345.5, d.telefono);
    draw(p1, 318, 345.5, d.celular);
    draw(p1, 152, 357.5, d.email);
    draw(p1, 121, 369.5, d.diagnostico);
    draw(p1, 114, 381.5, d.n_ciclo || '1');
    draw(p1, 91,  393.5, alturaCorregida ? `${alturaCorregida} cm` : '');
    draw(p1, 191, 393.5, d.peso ? `${d.peso} kg` : '');
    draw(p1, 362, 393.5, bsa ? `${bsa} m²` : '');

    draw(p1, 253, 435.1, doctorData.nombre);
    draw(p1, 124, 446.6, doctorData.especialidad || 'Oncología Clínica');
    draw(p1, 100, 459.6, 'Oncología');
    draw(p1, 226, 483.1, doctorData.cel_area && doctorData.cel_num ? `${doctorData.cel_area} ${doctorData.cel_num}` : '');
    draw(p1, 96,  495.1, doctorData.cel_area && doctorData.cel_num ? `${doctorData.cel_area} ${doctorData.cel_num}` : '');
    draw(p1, 358, 495.6, doctorData.email);

    draw(p1, 121, 539.1, d.diagnostico);
    const [fdd, fdm, fda] = (cleanDate(d.fecha_diagnostico) || '').split('/');
    draw(p1, 490, 539.1, fdd || '');
    draw(p1, 512, 539.1, fdm || '');
    draw(p1, 530, 539.1, fda || '');

    drawLines(p1, 57, 589.0, d.resumen_hc, 6);
    drawLines(p1, 57, 697.0, d.metodos_complementarios, 5);

    // ─── PÁGINA 2 ───
    drawLines(p2, 57, 89.6, d.estado_general, 3);  
    drawLines(p2, 57, 220.1, d.tratamientos_previos, 3);
    drawLines(p2, 57, 293.3, d.tipo_terapia_previa, 4);
    draw(p2, 173, 449.2, esquema.numero_ciclos);
    draw(p2, 178, 461.2, esquema.frecuencia_ciclos);
    draw(p2, 176, 475.2, esquema.tiempo_tratamiento);
    
    const [fid, fim, fia] = (cleanDate(esquema.fecha_inicio) || esquema.fecha_inicio || '').split('/');
    draw(p2, 277, 487.2, fid || '');
    draw(p2, 340, 487.2, fim || '');
    draw(p2, 385, 487.2, fia || '');

    drawLines(p2, 57, 510.5, esquema.medicamentos, 3);
    draw(p2, 230, 534.2, esquema.dosis_total_ciclo);
    draw(p2, 344, 534.2, esquema.dias_admin);
    draw(p2, 447, 534.2, esquema.intervalo);

    const fundTrunc = d.fundamentacion
      ? d.fundamentacion.length > 220
        ? d.fundamentacion.substring(0, d.fundamentacion.lastIndexOf(' ', 220)) + '.'
        : d.fundamentacion
      : '';
    drawLines(p2, 57, 570.6, fundTrunc, 3);

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `DINADIC_${d.nombre_apellido || patient.name}_${today.replace(/\//g, '-')}.pdf`;
    return { blob, filename };
  };

  const generateDinadicPDF = async (esquema?: typeof esquemaData) => {
    if (!hasClinicalData) {
      alert("⚠️ Cargue la Historia Clínica o agregue eventos en la Línea de Tiempo primero.");
      return;
    }

    // Si no viene esquema, es el primer llamado: pedir droga y abrir modal
    if (!esquema) {
      const drugName = window.prompt('Ingrese el/los fármaco/s a solicitar en el formulario DINADIC:');
      if (!drugName || !drugName.trim()) return;
      setPendingDinadicDrug(drugName);
      setEsquemaData(prev => ({ ...prev, medicamentos: drugName }));
      setShowEsquemaModal(true);
      return;
    }

    const drugName = pendingDinadicDrug;
    setProcessingId('dinadic');
    setStatus('Analizando historia clínica y línea de tiempo...');
    try {
      const today = new Date().toLocaleDateString('es-AR');

      const extractPrompt = `
Actúa como oncólogo experto. Hoy es ${today}.
Analizá la historia clínica y extraé datos para el formulario DINADIC (Solicitud de Medicamentos - DADSE).
FÁRMACO SOLICITADO POR EL MÉDICO: ${drugName}. Usar EXACTAMENTE este valor en el campo "medicamentos".
IDIOMA: Todo en español. Devolvé ÚNICAMENTE JSON sin markdown ni bloques de código.

{
  "nombre_apellido": "",
  "tipo_documento": "DNI",
  "numero_documento": "",
  "edad": "",
  "sexo": "Femenino o Masculino",
  "domicilio": "",
  "localidad": "",
  "provincia": "Córdoba",
  "telefono": "",
  "celular": "",
  "email": "",
  "diagnostico": "",
  "altura": "",
  "peso": "",
  "n_ciclo": "1",
  "fecha_diagnostico": "DD/MM/AAAA",
  "resumen_hc": "Resumen clínico con estadio e inmunohistoquímica. Narrativa cronológica. Máx 690 chars (6 líneas × 115).",
  "metodos_complementarios": "Estudios de imagen y laboratorio con fechas y resultados clave. Máx 575 chars (5 líneas).",
  "estado_general": "ECOG y comorbilidades relevantes. Máx 345 chars (3 líneas).",
  "tratamientos_previos": "Tratamientos oncológicos previos con fechas. Máx 345 chars (3 líneas).",
  "tipo_terapia_previa": "Cx, QT, RT, etc con fechas. Abreviaturas médicas. Máx 460 chars (4 líneas).",
  "fundamentacion": "Justificación oncológica MUY CONCISA. Máximo 2 oraciones. No más de 200 caracteres. Sin cortes abruptos, terminar siempre con punto final y con coherencia."
}

CONTEXTO CLÍNICO: ${getEffectiveClinicalContext()}${pendingDinadicCorrection ? `\n\nCORRECCIÓN SOLICITADA POR EL MÉDICO: ${pendingDinadicCorrection}. Incorporar en los campos correspondientes.` : ''}
      `;

      const parts: any[] = [{ text: extractPrompt }];
      if (files && files.length > 0) files.forEach(f => parts.push({ inlineData: { mimeType: f.type, data: f.data } }));

      const res = await callGemini({ parts, responseMimeType: "application/json" });
      let clean = (res.text || '{}').replace(/```json|```/g, '').trim();
      const si = clean.indexOf('{'), ei = clean.lastIndexOf('}');
      if (si !== -1 && ei !== -1) clean = clean.substring(si, ei + 1);
      const d = JSON.parse(clean);

      setStatus('Generando PDF...');
      const { blob, filename } = await drawDinadicPdf(d, esquema);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setStatus('¡Listo!');
      const prevDinadicCorrections = lastRegenParams['dinadic']?.accumulatedCorrections ?? '';
      const newDinadicAccumulated = pendingDinadicCorrection
        ? (prevDinadicCorrections ? `${prevDinadicCorrections}\n- ${pendingDinadicCorrection}` : `- ${pendingDinadicCorrection}`)
        : prevDinadicCorrections;
      setLastRegenParams(prev => ({ ...prev, dinadic: { drugName: drugName, accumulatedCorrections: newDinadicAccumulated } }));
      setPendingDinadicCorrection('');
      setFormGenerated(prev => ({ ...prev, dinadic: true }));
      setFormCorrections(prev => ({ ...prev, dinadic: '' }));
      setShowEsquemaModal(false);
    } catch (e: any) {
      alert("Error al generar DINADIC: " + e.message);
    } finally {
      setProcessingId(null);
      setStatus('');
    }
  };

  const liveBSA = calculateBSA(pamiFormData.peso, pamiFormData.talla);
  const missingMandatoryList = PAMI_MANDATORY_FIELDS.filter(f => !String((pamiFormData as any)[f.key] || '').trim());
  const missingMandatoryCount = missingMandatoryList.length;

  const bancoLiveBSA = calculateBSA(bancoFormData.peso, bancoFormData.talla);
  const missingBancoList = BANCO_MANDATORY_FIELDS.filter(f => !String((bancoFormData as any)[f.key] || '').trim());
  const missingBancoCount = missingBancoList.length;

  const handleFocusField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // --- MANEJADORES DE VISTA PREVIA INTERACTIVA Y DESCARGA DEFINITIVA (EXCLUSIVO RESUMEN CLÍNICO) ---
  const handleConfirmPreviewDownload = () => {
    if (!activePreview || !activePreview.blob) return;

    // Descarga definitiva del PDF únicamente tras confirmación del médico
    const link = document.createElement('a');
    link.href = URL.createObjectURL(activePreview.blob);
    link.download = activePreview.filename;
    link.click();

    setLastRegenParams(prev => ({ ...prev, summary: { drugName: summaryData.drugName, accumulatedCorrections: '' } }));
    setFormGenerated(prev => ({ ...prev, summary: true }));
    setFormCorrections(prev => ({ ...prev, summary: '' }));

    setActivePreview(null);
  };

  const handleUpdateActivePreview = async () => {
    if (!activePreview) return;
    setIsPreviewUpdating(true);
    try {
      const { blob, filename } = await drawClinicalSummaryPdf(summaryData, summaryTextContent);
      setActivePreview(prev => prev ? { ...prev, blob, filename } : null);
    } catch (err: any) {
      alert('Error al actualizar la vista previa: ' + err.message);
    } finally {
      setIsPreviewUpdating(false);
    }
  };

  const renderSummaryFieldsContent = () => (
    <div className="space-y-3">
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1">
          Edición de Contenido del Resumen de Historia Clínica
        </label>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-2">
          Revise y edite el texto de las secciones (Identificación, Resumen Clínico y Justificación). Al presionar <strong>"Actualizar vista previa"</strong>, el PDF se rediagramará con el formato institucional oficial.
        </p>
        <textarea
          rows={20}
          value={summaryTextContent}
          onChange={e => setSummaryTextContent(e.target.value)}
          className="w-full p-3.5 border border-slate-300 rounded-xl bg-white text-sm font-sans text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
          placeholder="Texto del Resumen de Historia Clínica..."
        />
      </div>
    </div>
  );


  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600" size={20} />
            <span>Gestor de Formularios y Trámites Médicos</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatización y asistencia para PAMI Oncológico, Banco de Drogas y DINADIC.
          </p>
        </div>
        
        <button
          onClick={() => setShowDocConfig(!showDocConfig)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 transition-all self-start sm:self-auto shrink-0"
        >
          <UserCog size={14} className="text-gray-500"/>
          <span>{doctorData.nombre ? `Dr/a. ${doctorData.nombre}` : 'Configurar Médico'}</span>
        </button>
      </div>

      {/* Configuración de Médico */}
      {showDocConfig && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Datos Profesionales para Formularios Oficiales
            </h4>
            <button onClick={() => setShowDocConfig(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Nombre y Apellido</label>
              <input type="text" value={doctorData.nombre} onChange={e => setDoctorData(prev => ({ ...prev, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Matrícula Profesional</label>
              <input type="text" value={doctorData.matricula} onChange={e => setDoctorData(prev => ({ ...prev, matricula: e.target.value }))} placeholder="Ej: 34567" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Especialidad</label>
              <input type="text" value={doctorData.especialidad} onChange={e => setDoctorData(prev => ({ ...prev, especialidad: e.target.value }))} placeholder="Oncología Clínica" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Email de Contacto</label>
              <input type="text" value={doctorData.email} onChange={e => setDoctorData(prev => ({ ...prev, email: e.target.value }))} placeholder="medico@hospital.com" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Provincia</label>
              <input type="text" value={doctorData.provincia} onChange={e => setDoctorData(prev => ({ ...prev, provincia: e.target.value }))} placeholder="Córdoba" className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CUIL / CUIT (Prefijo - DNI - Dígito)</label>
              <div className="grid grid-cols-3 gap-1">
                <input type="text" value={doctorData.cuil_prefix} onChange={e => setDoctorData(prev => ({ ...prev, cuil_prefix: e.target.value }))} placeholder="20" className="p-2 text-xs border border-slate-300 rounded-lg bg-white text-center"/>
                <input type="text" value={doctorData.cuil_dni} onChange={e => setDoctorData(prev => ({ ...prev, cuil_dni: e.target.value }))} placeholder="12345678" className="p-2 text-xs border border-slate-300 rounded-lg bg-white text-center"/>
                <input type="text" value={doctorData.cuil_suffix} onChange={e => setDoctorData(prev => ({ ...prev, cuil_suffix: e.target.value }))} placeholder="9" className="p-2 text-xs border border-slate-300 rounded-lg bg-white text-center"/>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={saveDoctorData} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5">
              <Save size={14} /> Guardar Perfil
            </button>
          </div>
        </div>
      )}

      {/* Estado del paciente / Contexto */}
      {!hasClinicalData && (
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="text-slate-400 shrink-0" size={16} />
          <p className="text-xs text-slate-600">
            Cargue la Historia Clínica en "Documentación" o agregue eventos en la Línea de Tiempo para habilitar la generación automática de trámites.
          </p>
        </div>
      )}

      {/* Status Bar */}
      {status && (
        <div className="mb-4 p-2.5 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2 text-xs text-blue-800 font-medium">
          <Loader2 size={14} className="animate-spin text-blue-600 shrink-0" />
          <span>{status}</span>
        </div>
      )}

      {/* Grilla de Formularios */}
      <div className="grid gap-4">
        {forms.map(form => {
          const isProcessing = processingId === form.id;

          return (
            <div key={form.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-200 transition-all shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wide">{form.name}</h4>
                    {form.id === 'pami' && (
                      <span className="text-[10px] text-gray-500">Revisión unificada con deducción automática de esquema</span>
                    )}
                    {form.type === 'auto_banco' && (
                      <span className="text-[10px] text-gray-500">Revisión guiada y completa de celdas antes de emitir PDF</span>
                    )}
                  </div>
                </div>
                {isProcessing ? (
                  <Loader2 className="animate-spin text-blue-600" size={18}/>
                ) : (
                  <CheckCircle2 className="text-gray-200" size={18}/>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {form.type === 'auto' ? (
                  <div className="flex-1 flex gap-2">
                    <button 
                      onClick={() => fillPamiPDF(form)}
                      disabled={processingId !== null}
                      className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50
                        ${isProcessing ? 'bg-blue-600' : 'bg-gray-900 hover:bg-black'}`}
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar Formulario PAMI</span>
                    </button>
                    <a
                      href="https://cup.pami.org.ar/controllers/loginController.php"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200 text-xs font-bold"
                      title="Ir a PAMI Web"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                ) : form.type === 'auto_dinadic' ? (
                  <div className="flex-1 flex flex-wrap gap-2">
                    <button
                      onClick={() => generateDinadicPDF()}
                      disabled={processingId !== null}
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-1.5 text-white py-2 px-3 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 transition-all disabled:opacity-50"
                    >
                      {processingId === 'dinadic' ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar</span>
                    </button>
                    <button
                      onClick={() => downloadTemplate(form)}
                      className="flex items-center justify-center space-x-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    >
                      <Download size={14}/><span>Plantilla</span>
                    </button>
                    <button
                      onClick={() => openSummaryModal('SOLICITUD')}
                      disabled={processingId !== null}
                      className="flex items-center justify-center space-x-1.5 bg-purple-700 text-white hover:bg-purple-800 py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                      <span>Resumen Clínico</span>
                    </button>
                  </div>
                ) : form.type === 'auto_banco' ? (
                  <div className="flex-1 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleStartBancoFlow(form.id as 'admision' | 'renovacion')}
                      disabled={processingId !== null}
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-1.5 text-white py-2 px-3 rounded-lg text-xs font-bold bg-green-700 hover:bg-green-800 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                      <span>Generar</span>
                    </button>
                    <button
                      onClick={() => downloadTemplate(form)}
                      className="flex items-center justify-center space-x-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    >
                      <Download size={14}/><span>Plantilla</span>
                    </button>
                    <button
                      onClick={() => openSummaryModal(form.context || 'ADMISIÓN')}
                      disabled={processingId !== null}
                      className="flex items-center justify-center space-x-1.5 bg-purple-700 text-white hover:bg-purple-800 py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {processingId === 'summary' ? <Loader2 className="animate-spin" size={14}/> : <FilePlus size={14}/>}
                      <span>Resumen Clínico</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Panel de Corrección posterior */}
              {(() => {
                const MAX_C = 300;
                const isRegen = processingId !== null;

                if ((form.type === 'auto' || form.type === 'auto_banco') && formGenerated[form.id]) {
                  const correction = formCorrections[form.id] || '';
                  const params = lastRegenParams[form.id];
                  const handleRegen = () => {
                    if (!correction.trim() || !params?.drugName) return;
                    if (form.type === 'auto') fillPamiPDF(form, { drugName: params.drugName, correction });
                    else handleStartBancoFlow(form.id as any, correction);
                  };
                  return (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">¿Desea corregir algún dato del formulario?</p>
                      <div className="relative">
                        <textarea
                          value={correction}
                          onChange={e => setFormCorrections(prev => ({ ...prev, [form.id]: e.target.value.slice(0, MAX_C) }))}
                          placeholder="Ej: Modificar estadio a T3N1M0, ajustar dosis..."
                          rows={2}
                          disabled={isRegen}
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white resize-none outline-none focus:border-blue-400"
                        />
                        <span className="absolute bottom-1.5 right-2 text-[9px] text-slate-400">{MAX_C - correction.length}</span>
                      </div>
                      <button
                        onClick={handleRegen}
                        disabled={!correction.trim() || isRegen}
                        className="w-full flex items-center justify-center gap-1.5 bg-slate-800 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 disabled:opacity-40"
                      >
                        {isRegen ? <Loader2 size={12} className="animate-spin"/> : <RefreshCcw size={12}/>}
                        Regenerar con corrección
                      </button>
                    </div>
                  );
                }

                return null;
              })()}

            </div>
          );
        })}
      </div>

      {/* SECCIÓN INDEPENDIENTE: FORMULARIOS ADMINISTRATIVOS Y DERIVACIONES */}
      <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
        <div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} className="text-blue-600"/>
            <span>Formularios Administrativos y Derivaciones</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Solicitudes de prácticas extrahospitalarias de alta complejidad, pedidos de medicación y programas especiales.
          </p>
        </div>

        <div className="grid gap-4">
          {ADMIN_FORMS_REGISTRY.map(formDef => {
            const isProcessing = adminProcessingId === formDef.id;

            return (
              <div key={formDef.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-200 transition-all shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wide">{formDef.name}</h4>
                        <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded uppercase">
                          {formDef.code}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">{formDef.description}</span>
                    </div>
                  </div>
                  {isProcessing ? (
                    <Loader2 className="animate-spin text-blue-600" size={18}/>
                  ) : (
                    <CheckCircle2 className="text-gray-200" size={18}/>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStartAdminFormFlow(formDef)}
                    disabled={adminProcessingId !== null || processingId !== null}
                    className="flex-1 min-w-[140px] flex items-center justify-center space-x-1.5 text-white py-2 px-3 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                    <span>Completar y Generar PDF</span>
                  </button>
                  {formDef.templateFile && (
                    <button
                      onClick={() => downloadTemplate({ file: formDef.templateFile, name: formDef.name })}
                      className="flex items-center justify-center space-x-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    >
                      <Download size={14}/><span>Plantilla</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DE REVISIÓN SIMPLIFICADO: FORMULARIO PAMI ONCOLÓGICO */}
      {showPamiReviewModal && (() => {
        const justificationLength = (pamiFormData.informe_clinico_detallado || '').length;

        const renderField = (
          label: string,
          fieldKey: keyof typeof pamiFormData,
          isMandatory: boolean,
          placeholder = '',
          isSpan2 = false
        ) => {
          const val = pamiFormData[fieldKey] || '';
          const isMissing = !String(val).trim();
          const inputId = `pami-${fieldKey}`;

          return (
            <div className={isSpan2 ? 'col-span-2' : ''}>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={inputId} className="block text-[11px] font-semibold text-gray-700">
                  {label} {isMandatory && <span className="text-blue-600 font-bold">*</span>}
                </label>
              </div>
              <input
                id={inputId}
                type="text"
                placeholder={placeholder}
                value={val}
                onChange={e => setPamiFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                className={`w-full px-3 py-2 text-xs rounded-lg border transition-all outline-none ${
                  isMandatory && isMissing
                    ? 'border-slate-300 bg-slate-50/50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-100'
                    : 'border-gray-200 bg-white text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                }`}
              />
            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-3 sm:p-5">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
              
              {/* Header Minimalista */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-sm text-gray-900">
                        Formulario PAMI Oncológico
                      </h3>
                      {missingMandatoryCount > 0 ? (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-medium">
                          {missingMandatoryCount} {missingMandatoryCount === 1 ? 'dato obligatorio pendiente' : 'datos obligatorios pendientes'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium flex items-center gap-1">
                          <Check size={12} /> Datos completos
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Revise la información clínica. Los campos obligatorios están identificados con asterisco (*).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPamiReviewModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Resumen Único de Datos Faltantes (Discreto y Funcional) */}
              {missingMandatoryCount > 0 && (
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Faltan {missingMandatoryCount} datos obligatorios:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {missingMandatoryList.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleFocusField(item.id)}
                          className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded border border-slate-200 transition-all"
                        >
                          • {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-gray-50/20">
                
                {/* 1. Datos del Paciente */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    1. Datos del Paciente
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField('Apellido y Nombre', 'paciente_nombre_real', true, 'Nombre completo')}
                    {renderField('Fecha de Nacimiento', 'paciente_fnac', true, 'DD/MM/AAAA')}
                    {renderField('Teléfono / Celular', 'paciente_celular', false, 'Ej: 3511234567')}
                  </div>
                </div>

                {/* 2. Datos Clínicos & Antropometría */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    2. Datos Clínicos & Antropometría
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      {renderField('Diagnóstico (CIE-10)', 'diagnostico_cie10', true, 'Ej: C50.9 Cáncer de mama')}
                    </div>
                    {renderField('Peso (kg)', 'peso', true, 'Ej: 70')}
                    {renderField('Talla (cm)', 'talla', true, 'Ej: 165')}
                    {renderField('ECOG (0 - 4)', 'ecog', true, 'Ej: 0, 1')}
                  </div>

                  {/* Superficie Corporal */}
                  <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-gray-700">
                      Superficie Corporal: {liveBSA ? `${liveBSA} m²` : 'Pendiente de peso y talla'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {liveBSA ? 'Calculada automáticamente' : 'Se calcula al ingresar peso y talla'}
                    </span>
                  </div>
                </div>

                {/* 3. Tratamiento & Cronología */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    3. Tratamiento & Cronología
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField('Línea de Tratamiento', 'linea_tratamiento', false, 'Ej: 1ra línea / Adyuvancia')}
                    {renderField('N° Ciclos Planeados', 'ciclos_planeados', false, 'Ej: 6')}
                    {renderField('Frecuencia (Días)', 'frecuencia_dias', false, 'Ej: 21')}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">
                        Motivo de la Solicitud
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['Inicio', 'Renovación', 'Cambio de Toxicidad', 'Cambio por Progresión'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPamiFormData(prev => ({ ...prev, motivo_solicitud: opt }))}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-all ${
                              pamiFormData.motivo_solicitud === opt
                                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">
                        Tipo de Tratamiento
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['Adyuvante', 'Neoadyuvante', 'Avanzado'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPamiFormData(prev => ({ ...prev, tipo_tratamiento: opt }))}
                            className={`px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                              pamiFormData.tipo_tratamiento === opt
                                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Estadificación & Antecedentes */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    4. Estadificación & Antecedentes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField('Estadio Inicial', 'estadio_inicial', false, 'Ej: Estadio IV')}
                    {renderField('Fecha Diagnóstico Inicial', 'fecha_diagnostico_inicial', false, 'DD/MM/AAAA')}
                    {renderField('Estadio Actual', 'estadio_actual', false, 'Ej: Progresión / Estable')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    {renderField('Histopatológico / Inmunohistoquímica', 'histopatologico', false, 'Resumen patológico e IHQ')}
                    {renderField('Laboratorio Relevante', 'laboratorio_formateado', false, 'Hb 12g/dl, Cr 0.8, marcadores')}
                    {renderField('Antecedentes Quirúrgicos', 'antecedentes_qx', false, 'Cirugías y fechas')}
                    {renderField('Antecedentes Terapia Radiante', 'antecedentes_radio', false, 'RT, dosis y fechas')}
                  </div>
                </div>

                {/* 5. Informe Clínico Actual (Cuadro Grande) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      5. Informe Clínico & Justificación Médica <span className="text-blue-600">*</span>
                    </h4>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {justificationLength} / ~1400 caracteres
                    </span>
                  </div>
                  
                  <textarea
                    id="pami-informe_clinico_detallado"
                    rows={7}
                    placeholder="Redacte la justificación médica del tratamiento solicitado: hitos diagnósticos cronológicos, imágenes con fechas y hallazgos, estadio/reestadificación, biopsias, respuesta o suspensión de esquemas previos y fundamentación médica..."
                    value={pamiFormData.informe_clinico_detallado}
                    onChange={e => setPamiFormData(prev => ({ ...prev, informe_clinico_detallado: e.target.value }))}
                    className="w-full p-3 text-xs rounded-xl border border-gray-200 bg-white text-gray-800 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-100 leading-relaxed"
                  />
                  <p className="text-[11px] text-gray-400">
                    El cuadro grande de PAMI admite un informe de 800 a 1400 caracteres con la fundamentación del esquema.
                  </p>
                </div>

                {/* 6. Tabla de Drogas Oncológicas Solicitadas */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Pill size={14} className="text-blue-600"/>
                      <span>6. Drogas Oncológicas Solicitadas</span>
                    </h4>
                    <span className="text-[11px] text-gray-400">
                      Presentación, dosis y ciclos se completan al emitir el PDF
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {renderField('Droga #1 (Principal)', 'droga_1', true, 'Ej: Leuprolide')}
                    {renderField('Droga #2', 'droga_2', false, 'Ej: Darolutamida')}
                    {renderField('Droga #3', 'droga_3', false, 'Opcional')}
                    {renderField('Droga #4', 'droga_4', false, 'Opcional')}
                  </div>

                  {/* Sugerencias Rápidas */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Sugerencias frecuentes:
                      </span>
                      {(pamiFormData.droga_1 || pamiFormData.droga_2 || pamiFormData.droga_3 || pamiFormData.droga_4) && (
                        <button
                          type="button"
                          onClick={() => setPamiFormData(prev => ({
                            ...prev,
                            droga_1: '',
                            droga_2: '',
                            droga_3: '',
                            droga_4: '',
                          }))}
                          className="text-[11px] text-gray-500 hover:text-red-600 transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Leuprolide + Darolutamida',
                        'Pembrolizumab',
                        'Trastuzumab + Pertuzumab',
                        'Carboplatino + Paclitaxel',
                        'Osimertinib 80mg',
                        'Abemaciclib + Fulvestrant',
                        'Docetaxel',
                        'Capecitabina'
                      ].map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            const parts = sug.split('+').map(s => s.trim());
                            setPamiFormData(prev => ({
                              ...prev,
                              droga_1: parts[0] || '',
                              droga_2: parts[1] || '',
                              droga_3: parts[2] || '',
                              droga_4: parts[3] || '',
                              esquema_tratamiento_solicitado: sug,
                            }));
                          }}
                          className="px-2.5 py-1 text-xs font-medium bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-md border border-gray-200 transition-all"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-gray-600">
                  {missingMandatoryCount > 0 ? (
                    <span className="text-slate-600">
                      Faltan {missingMandatoryCount} datos obligatorios marcados con asterisco (*).
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Todos los datos obligatorios están listos.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPamiReviewModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all w-full sm:w-auto"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    disabled={processingId === 'pami'}
                    onClick={handlePamiDownloadClick}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all w-full sm:w-auto disabled:opacity-50"
                  >
                    {processingId === 'pami' ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
                    <span>Descargar Formulario PAMI (PDF)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL DE CONFIRMACIÓN ANTES DE GENERAR PDF PAMI */}
      {showPamiMissingConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">Datos pendientes</h4>
                <p className="text-xs text-gray-500">
                  Faltan {missingMandatoryCount} datos obligatorios para completar el formulario.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
              <span className="font-semibold block">Campos pendientes:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {missingMandatoryList.map(m => (
                  <li key={m.key}>{m.label}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPamiMissingConfirm(false);
                  if (missingMandatoryList.length > 0) {
                    handleFocusField(missingMandatoryList[0].id);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-all"
              >
                Completar datos
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPamiMissingConfirm(false);
                  fillPamiPDFFromData(pamiFormData);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Generar igualmente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REVISIÓN COMPLETA: BANCO DE DROGAS (ADMISIÓN Y RENOVACIÓN) */}
      {showBancoModal && (() => {
        const isAdmision = showBancoModal === 'admision';

        const renderBField = (
          label: string,
          fieldKey: keyof typeof bancoFormData,
          isMandatory: boolean,
          placeholder = '',
          isSpan2 = false
        ) => {
          const val = String(bancoFormData[fieldKey] || '');
          const isMissing = !val.trim();
          const inputId = `banco-${fieldKey}`;

          return (
            <div className={isSpan2 ? 'sm:col-span-2' : ''}>
              <label htmlFor={inputId} className="block text-[11px] font-semibold text-gray-700 mb-1">
                {label} {isMandatory && <span className="text-green-700 font-bold">*</span>}
              </label>
              <input
                id={inputId}
                type="text"
                placeholder={placeholder}
                value={val}
                onChange={e => setBancoFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                className={`w-full px-3 py-2 text-xs rounded-lg border transition-all outline-none ${
                  isMandatory && isMissing
                    ? 'border-slate-300 bg-slate-50 text-gray-900 focus:border-green-600 focus:bg-white'
                    : 'border-gray-200 bg-white text-gray-800 focus:border-green-600'
                }`}
              />
            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-3 sm:p-5">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 text-green-700 rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-sm text-gray-900">
                        {isAdmision ? 'Solicitud de Medicamentos Oncológicos — ADMISIÓN' : 'Solicitud de Medicamentos Oncológicos — RENOVACIÓN'}
                      </h3>
                      {missingBancoCount > 0 ? (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-medium">
                          {missingBancoCount} pendientes
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium flex items-center gap-1">
                          <Check size={12} /> Celdas completas
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Revise todas las celdas y casillas antes de generar el PDF oficial sin campos vacíos.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowBancoModal(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>

              {/* Resumen Superior de Faltantes */}
              {missingBancoCount > 0 && (
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Faltan {missingBancoCount} datos requeridos:</span>
                    <div className="flex flex-wrap gap-1">
                      {missingBancoList.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleFocusField(item.id)}
                          className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-green-50 text-slate-700 hover:text-green-800 rounded border border-slate-200 transition-all"
                        >
                          • {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-gray-50/20 text-xs">
                
                {/* 1. Filiación del Paciente */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    1. Datos de Filiación del Paciente
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      {renderBField('Apellido y Nombre', 'nombre_apellido', true, 'Nombre completo del paciente')}
                    </div>
                    {renderBField('DNI N°', 'dni', true, 'Ej: 12345678')}
                    {renderBField('Fecha de Nacimiento', 'fnac', true, 'DD/MM/AAAA')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-gray-50">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Sexo</label>
                      <div className="flex gap-2">
                        {['M', 'F'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, sexo: s as any }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border text-center transition-all ${
                              bancoFormData.sexo === s ? 'bg-green-50 text-green-800 border-green-300' : 'bg-white text-gray-600 border-gray-200'
                            }`}
                          >
                            {s === 'M' ? 'Masc' : 'Fem'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {renderBField('Edad', 'edad', false, 'Años')}
                    {renderBField('Teléfono', 'telefono', false, 'Ej: 3511234567')}
                    {renderBField('Domicilio', 'domicilio', false, 'Calle y número')}
                    {renderBField('Localidad', 'localidad', false, 'Ciudad')}
                  </div>
                </div>

                {/* 2. Diagnóstico, Biomarcadores & Estadificación */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    2. Diagnóstico, Biomarcadores & Estadificación
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      {renderBField('Diagnóstico', 'diagnostico', true, 'Ej: Melanoma Maligno / Cáncer de Pulmón')}
                    </div>
                    {renderBField('Código CIE-10', 'cie10', false, 'Ej: C43.9')}
                    {renderBField('Fecha Diagnóstico', 'fecha_diagnostico', true, 'DD/MM/AAAA')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-50">
                    {renderBField('TNM T', 'tnm_t', false, 'Ej: T4b')}
                    {renderBField('TNM N', 'tnm_n', false, 'Ej: N3')}
                    {renderBField('TNM M', 'tnm_m', false, 'Ej: M1d')}
                    {renderBField('Estadio', 'estadio', false, 'Ej: IV')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2 border-t border-gray-50">
                    {renderBField('RE', 'receptor_RE', false, 'Ej: Positivo 80%')}
                    {renderBField('RP', 'receptor_RP', false, 'Ej: Positivo 60%')}
                    {renderBField('HER2/neu', 'receptor_HER2', false, 'Ej: Positivo (3+)')}
                    {renderBField('KRAS', 'receptor_KRAS', false, 'Ej: Mutado')}
                    {renderBField('EGFR', 'receptor_EGER', false, 'Ej: Mutado')}
                    {renderBField('Otros / BRAF', 'receptor_otros', false, 'Ej: BRAF V600E mutado (+)')}
                  </div>
                  {isAdmision && (
                    <div className="pt-2 border-t border-gray-50">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Anatomía Patológica (Resumen sintético)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Tipo tumoral, grado, biopsia, IHQ..."
                        value={bancoFormData.anatomia_patologica}
                        onChange={e => setBancoFormData(prev => ({ ...prev, anatomia_patologica: e.target.value }))}
                        className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-green-600"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Antropometría & Estado Clínico */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                    3. Antropometría & Estado Clínico
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {renderBField('Peso (kg)', 'peso', true, 'Ej: 70')}
                    {renderBField('Talla (cm)', 'talla', true, 'Ej: 174')}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Sup. Corporal (m²)</label>
                      <input
                        type="text"
                        disabled
                        value={bancoLiveBSA ? `${bancoLiveBSA} m² (Calculada auto)` : 'Pendiente de peso y talla'}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-gray-100 font-bold text-gray-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        ECOG Performance (0 - 3) <span className="text-green-700 font-bold">*</span>
                      </label>
                      <div className="flex gap-1">
                        {['0', '1', '2', '3'].map(ec => (
                          <button
                            key={ec}
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, ecog: ec }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                              bancoFormData.ecog === ec ? 'bg-green-50 text-green-800 border-green-300' : 'bg-white text-gray-600 border-gray-200'
                            }`}
                          >
                            {ec}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Tratamientos Previos (Cirugía, Radioterapia, Tratamientos Sistémicos) */}
                {isAdmision && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                    <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                      4. Tratamientos Previos (Cirugías, Radioterapia y Tratamientos Sistémicos)
                    </h4>

                    {/* Cirugía Tumor Primario */}
                    <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">¿Cirugía de Tumor Primario?</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, cx_primario_si: true }))}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                              bancoFormData.cx_primario_si ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            SÍ
                          </button>
                          <button
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, cx_primario_si: false, cx_especificar: '', cx_ganglios_resecados: '', cx_ganglios_comprometidos: '', cx_fecha: '' }))}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                              !bancoFormData.cx_primario_si ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            NO
                          </button>
                        </div>
                      </div>
                      {bancoFormData.cx_primario_si && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-200">
                          <div className="sm:col-span-2">
                            {renderBField('Procedimiento Quirúrgico (Sin drogas)', 'cx_especificar', false, 'Ej: Mastectomía, Biopsia escisional')}
                          </div>
                          {renderBField('Ganglios resecados', 'cx_ganglios_resecados', false, 'N°')}
                          {renderBField('Fecha Cirugía', 'cx_fecha', false, 'DD/MM/AAAA')}
                        </div>
                      )}
                    </div>

                    {/* Cirugía Metástasis */}
                    <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">¿Cirugía de Metástasis?</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, cx_metastasis_si: true }))}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                              bancoFormData.cx_metastasis_si ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            SÍ
                          </button>
                          <button
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, cx_metastasis_si: false, cx_metastasis_especificar: '', cx_metastasis_fecha: '' }))}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                              !bancoFormData.cx_metastasis_si ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            NO
                          </button>
                        </div>
                      </div>
                      {bancoFormData.cx_metastasis_si && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-gray-200">
                          <div className="sm:col-span-2">
                            {renderBField('Especificar Procedimiento Metastectomía', 'cx_metastasis_especificar', false, 'Ej: Resección lesión cerebral')}
                          </div>
                          {renderBField('Fecha Cirugía Metástasis', 'cx_metastasis_fecha', false, 'DD/MM/AAAA')}
                        </div>
                      )}
                    </div>

                    {/* Radioterapia */}
                    <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                        <div className="flex items-center justify-between sm:justify-start gap-3">
                          <span className="font-bold text-gray-800">RT Primario:</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBancoFormData(prev => ({ ...prev, rt_primario_si: true }))}
                              className={`px-2.5 py-1 text-xs font-bold rounded border ${bancoFormData.rt_primario_si ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
                            >
                              SÍ
                            </button>
                            <button
                              type="button"
                              onClick={() => setBancoFormData(prev => ({ ...prev, rt_primario_si: false }))}
                              className={`px-2.5 py-1 text-xs font-bold rounded border ${!bancoFormData.rt_primario_si ? 'bg-slate-700 text-white' : 'bg-white text-gray-600'}`}
                            >
                              NO
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-start gap-3">
                          <span className="font-bold text-gray-800">RT Metástasis:</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBancoFormData(prev => ({ ...prev, rt_metastasis_si: true }))}
                              className={`px-2.5 py-1 text-xs font-bold rounded border ${bancoFormData.rt_metastasis_si ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
                            >
                              SÍ
                            </button>
                            <button
                              type="button"
                              onClick={() => setBancoFormData(prev => ({ ...prev, rt_metastasis_si: false }))}
                              className={`px-2.5 py-1 text-xs font-bold rounded border ${!bancoFormData.rt_metastasis_si ? 'bg-slate-700 text-white' : 'bg-white text-gray-600'}`}
                            >
                              NO
                            </button>
                          </div>
                        </div>

                        <div>
                          {renderBField('Localización RT', 'rt_localizacion', false, 'Ej: Holocraneana, Mama')}
                        </div>
                      </div>
                    </div>

                    {/* Tratamientos Sistémicos Previos */}
                    <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">¿Tratamientos Sistémicos Previos (Quimio/Inmuno/Biológicos)?</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setBancoFormData(prev => ({ ...prev, tratamientos_sistemicos_si: true }))}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                              bancoFormData.tratamientos_sistemicos_si ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            SÍ
                          </button>
                          <button
                            type="button"
                            onClick={() => setBancoFormData(prev => ({
                              ...prev,
                              tratamientos_sistemicos_si: false,
                              quimioterapia_droga: '', quimioterapia_tipo: '',
                              hormonoterapia_droga: '', hormonoterapia_tipo: '',
                              terapia_blanco_droga: '', inmunoterapia_droga: ''
                            }))}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                              !bancoFormData.tratamientos_sistemicos_si ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            NO
                          </button>
                        </div>
                      </div>

                      {bancoFormData.tratamientos_sistemicos_si && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                          <div>
                            {renderBField('Quimioterapia previa (Droga/s)', 'quimioterapia_droga', false, 'Ej: Carboplatino + Paclitaxel')}
                          </div>
                          <div>
                            {renderBField('Terapias Blanco previas', 'terapia_blanco_droga', false, 'Ej: Dabrafenib + Trametinib')}
                          </div>
                          <div>
                            {renderBField('Inmunoterapia previa', 'inmunoterapia_droga', false, 'Ej: Pembrolizumab')}
                          </div>
                          <div>
                            {renderBField('Hormonoterapia previa', 'hormonoterapia_droga', false, 'Ej: Tamoxifeno')}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* 5. Tratamiento a Realizar (Esquema Solicitado) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100 flex items-center gap-1.5">
                    <Pill size={14} className="text-green-700"/>
                    <span>5. Tratamiento a Realizar (Esquema Solicitado)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Tipo de Tratamiento</label>
                      <select
                        value={bancoFormData.tipo_tratamiento}
                        onChange={e => setBancoFormData(prev => ({ ...prev, tipo_tratamiento: e.target.value as any }))}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-green-600"
                      >
                        <option value="avanzado">Avanzado / Metástasis</option>
                        <option value="adyuvante">Adyuvante</option>
                        <option value="neoadyuvante">Neoadyuvante</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Línea de Tratamiento</label>
                      <select
                        value={bancoFormData.linea}
                        onChange={e => setBancoFormData(prev => ({ ...prev, linea: e.target.value }))}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-green-600"
                      >
                        <option value="1">1ra Línea</option>
                        <option value="2">2da Línea</option>
                        <option value="3">3ra Línea o posterior</option>
                      </select>
                    </div>
                    {renderBField('Intervalo de Ciclo (Días)', 'intervalo_ciclo', false, 'Ej: 21')}
                    {renderBField('Ciclos Programados', 'ciclos_programados', false, 'Ej: 6')}
                  </div>

                  {/* Fila Droga 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-100">
                    <div className="sm:col-span-1">
                      {renderBField('Droga #1 (Principal)', 'droga_1', true, 'Ej: Nivolumab')}
                    </div>
                    {renderBField('Dosis (mg/m² o mg)', 'dosis_1', false, 'Ej: 3 mg/kg')}
                    {renderBField('Días de Admin.', 'dias_1', false, 'Ej: Día 1')}
                    {renderBField('Dosis Total / Día', 'total_dia_1', false, 'Ej: 240 mg')}
                  </div>

                  {/* Fila Droga 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-50">
                    <div className="sm:col-span-1">
                      {renderBField('Droga #2 (Opcional)', 'droga_2', false, 'Ej: Ipilimumab')}
                    </div>
                    {renderBField('Dosis', 'dosis_2', false, 'Ej: 1 mg/kg')}
                    {renderBField('Días', 'dias_2', false, 'Ej: Día 1')}
                    {renderBField('Dosis Total / Día', 'total_dia_2', false, 'Ej: 80 mg')}
                  </div>

                  {/* Fila Droga 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-50">
                    <div className="sm:col-span-1">
                      {renderBField('Droga #3 (Opcional)', 'droga_3', false, 'Opcional')}
                    </div>
                    {renderBField('Dosis', 'dosis_3', false, '')}
                    {renderBField('Días', 'dias_3', false, '')}
                    {renderBField('Dosis Total / Día', 'total_dia_3', false, '')}
                  </div>

                  {/* Sugerencias Rápidas */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
                      Sugerencias frecuentes:
                    </span>
                    {[
                      { label: 'Nivolumab + Ipilimumab', d1: 'Nivolumab', dos1: '3 mg/kg', dias1: 'Día 1', tot1: '240 mg', d2: 'Ipilimumab', dos2: '1 mg/kg', dias2: 'Día 1', tot2: '80 mg' },
                      { label: 'Trastuzumab + Pertuzumab', d1: 'Trastuzumab', dos1: '6 mg/kg (8 mg/kg carga)', dias1: 'Día 1', tot1: '420 mg', d2: 'Pertuzumab', dos2: '420 mg (840 mg carga)', dias2: 'Día 1', tot2: '420 mg' },
                      { label: 'Pembrolizumab 200mg', d1: 'Pembrolizumab', dos1: '200 mg EV', dias1: 'Día 1', tot1: '200 mg', d2: '', dos2: '', dias2: '', tot2: '' },
                      { label: 'Carboplatino + Paclitaxel', d1: 'Carboplatino', dos1: 'AUC 5', dias1: 'Día 1', tot1: 'AUC 5', d2: 'Paclitaxel', dos2: '175 mg/m²', dias2: 'Día 1', tot2: '300 mg' },
                      { label: 'Dabrafenib + Trametinib', d1: 'Dabrafenib', dos1: '150 mg VO cada 12 hs', dias1: '1 - 28', tot1: '300 mg', d2: 'Trametinib', dos2: '2 mg VO diario', dias2: '1 - 28', tot2: '2 mg' },
                    ].map(sug => (
                      <button
                        key={sug.label}
                        type="button"
                        onClick={() => setBancoFormData(prev => ({
                          ...prev,
                          droga_1: sug.d1, dosis_1: sug.dos1, dias_1: sug.dias1, total_dia_1: sug.tot1,
                          droga_2: sug.d2, dosis_2: sug.dos2, dias_2: sug.dias2, total_dia_2: sug.tot2,
                        }))}
                        className="px-2 py-0.5 text-[11px] font-medium bg-gray-50 hover:bg-green-50 hover:text-green-800 text-gray-700 rounded border border-gray-200 transition-all"
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Parámetros de Renovación (Solo para Renovación) */}
                {!isAdmision && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                    <h4 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-gray-100">
                      6. Parámetros de Renovación
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Motivo Renovación</label>
                        <select
                          value={bancoFormData.motivo_renovacion}
                          onChange={e => setBancoFormData(prev => ({ ...prev, motivo_renovacion: e.target.value as any }))}
                          className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-green-600"
                        >
                          <option value="continua">Continúa mismo esquema</option>
                          <option value="cambio">Cambio por Progresión / Toxicidad</option>
                        </select>
                      </div>
                      {renderBField('Ciclos Realizados', 'ciclos_realizados', false, 'Ej: 3')}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Respuesta Clínica</label>
                        <select
                          value={bancoFormData.respuesta}
                          onChange={e => setBancoFormData(prev => ({ ...prev, respuesta: e.target.value as any }))}
                          className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-green-600"
                        >
                          <option value="estable">Enfermedad Estable</option>
                          <option value="parcial">Respuesta Parcial</option>
                          <option value="completa">Respuesta Completa</option>
                        </select>
                      </div>
                      {renderBField('Sitio Progresión (si hubo)', 'sitio_progresion', false, 'Ej: Hepático')}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-gray-600">
                  {missingBancoCount > 0 ? (
                    <span className="text-slate-600">
                      Faltan {missingBancoCount} datos obligatorios marcados con asterisco (*).
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Todos los datos obligatorios están listos para el PDF oficial.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowBancoModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all w-full sm:w-auto"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    disabled={processingId !== null}
                    onClick={handleBancoDownloadClick}
                    className="px-5 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {processingId !== null ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>Descargar Formulario Banco de Drogas (PDF)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL DE CONFIRMACIÓN BANCO DE DROGAS SI FALTAN OBLIGATORIOS */}
      {showBancoMissingConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 text-green-700 rounded-xl">
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">Datos pendientes</h4>
                <p className="text-xs text-gray-500">
                  Faltan {missingBancoCount} datos obligatorios para completar el formulario.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
              <span className="font-semibold block">Campos pendientes:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {missingBancoList.map(m => (
                  <li key={m.key}>{m.label}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBancoMissingConfirm(false);
                  if (missingBancoList.length > 0) {
                    handleFocusField(missingBancoList[0].id);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-green-800 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-all"
              >
                Completar datos
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBancoMissingConfirm(false);
                  if (bancoFormData.context === 'admision') fillAdmisionPDFFromData(bancoFormData);
                  else fillRenovacionPDFFromData(bancoFormData);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Generar igualmente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IDENTIFICACIÓN Y DATOS PARA RESUMEN DE HISTORIA CLÍNICA */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FilePlus className="text-purple-600" size={20} />
                <h4 className="font-bold text-sm text-gray-900">
                  Resumen de Historia Clínica — {summaryData.context === 'SOLICITUD' ? 'DINADIC' : summaryData.context}
                </h4>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Confirme o complete los datos identificatorios del paciente y el esquema a solicitar para el documento institucional.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  Fármaco / Medicación Solicitada (*)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Dabrafenib + Trametinib"
                  value={summaryData.drugName}
                  onChange={e => setSummaryData(prev => ({ ...prev, drugName: e.target.value }))}
                  className="w-full p-2.5 border border-purple-200 bg-purple-50/40 rounded-xl font-medium focus:bg-white focus:border-purple-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  Nombre y Apellido del Paciente
                </label>
                <input
                  type="text"
                  placeholder="Ej: GOMEZ, PEDRO OSCAR"
                  value={summaryData.nombre}
                  onChange={e => setSummaryData(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-xl focus:border-blue-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  Fecha de Nacimiento (DD/MM/AAAA)
                </label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={summaryData.fnac}
                  onChange={e => setSummaryData(prev => ({ ...prev, fnac: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  Edad
                </label>
                <input
                  type="text"
                  placeholder="Ej: 61 años"
                  value={summaryData.edad}
                  onChange={e => setSummaryData(prev => ({ ...prev, edad: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  Sexo
                </label>
                <div className="flex gap-2">
                  {['Masculino', 'Femenino'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSummaryData(prev => ({ ...prev, sexo: s }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        summaryData.sexo === s ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  DNI / Documento
                </label>
                <input
                  type="text"
                  placeholder="Ej: 16907275"
                  value={summaryData.dni}
                  onChange={e => setSummaryData(prev => ({ ...prev, dni: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 uppercase text-[10px] mb-1">
                  N° de Historia Clínica
                </label>
                <input
                  type="text"
                  placeholder="Ej: 9217053"
                  value={summaryData.hc}
                  onChange={e => setSummaryData(prev => ({ ...prev, hc: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!summaryData.drugName.trim() || processingId === 'summary'}
                onClick={() => {
                  setShowSummaryModal(false);
                  generateClinicalSummary(summaryData);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {processingId === 'summary' ? <Loader2 size={14} className="animate-spin" /> : <FilePlus size={14} />}
                <span>Generar Resumen de HC (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESQUEMA DINADIC */}
      {showEsquemaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">
                Esquema Terapéutico
              </h3>
              <button onClick={() => setShowEsquemaModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18}/>
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-wide">
              Complete los datos del esquema antes de generar el formulario DINADIC
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Medicamento/s', key: 'medicamentos', span: true },
                { label: 'Dosis/m² o kg', key: 'dosis_m2' },
                { label: 'Dosis total por ciclo', key: 'dosis_total_ciclo' },
                { label: 'Días de administración', key: 'dias_admin' },
                { label: 'Intervalo', key: 'intervalo' },
                { label: 'N° total de ciclos', key: 'numero_ciclos' },
                { label: 'Frecuencia de ciclos', key: 'frecuencia_ciclos' },
                { label: 'Tiempo de tratamiento', key: 'tiempo_tratamiento' },
                { label: 'Fecha inicio (DD/MM/AAAA)', key: 'fecha_inicio', span: true },
              ].map(({ label, key, span }) => (
                <div key={key} className={span ? 'col-span-2' : ''}>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">{label}</label>
                  <input
                    className="w-full p-2 border rounded-lg text-xs"
                    value={(esquemaData as any)[key]}
                    onChange={e => setEsquemaData(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowEsquemaModal(false);
                generateDinadicPDF(esquemaData);
              }}
              className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Wand2 size={14}/> Generar DINADIC
            </button>
          </div>
        </div>
      )}

      {/* MODAL: PREGUNTAR ESTUDIO PARA FORMULARIO 03 */}
      {showForm03StudyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                    Form. 03
                  </span>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mt-1">
                    Solicitud de Prácticas Extrahospitalarias
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowForm03StudyModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                  ¿Qué estudio desea solicitar?
                </label>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Seleccione una opción o escriba la práctica requerida. El sistema fundamentará y redactará la epicrisis específicamente para este estudio.
                </p>
              </div>

              {/* Sugerencias rápidas habituales */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'PET/TC corporal total con 18F-FDG',
                  'RMN de Cerebro con y sin contraste',
                  'Centellograma óseo de cuerpo entero',
                  'RMN de Pelvis con contraste',
                  'Panel NGS / Biología Molecular en Tejido Tumoral',
                  'Biopsia guiada por Tomografía'
                ].map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setForm03StudyInput(sug)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all text-left
                      ${form03StudyInput === sug
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="text"
                  autoFocus
                  value={form03StudyInput}
                  onChange={e => setForm03StudyInput(e.target.value)}
                  placeholder="Escriba o ajuste el estudio a solicitar..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm03StudyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!form03StudyInput.trim()}
                onClick={() => {
                  const form03Def = ADMIN_FORMS_REGISTRY.find(f => f.id === 'form03_practicas');
                  if (form03Def && form03StudyInput.trim()) {
                    setShowForm03StudyModal(false);
                    handleStartAdminFormFlow(form03Def, { solicitud_estudio: form03StudyInput.trim() });
                  }
                }}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50"
              >
                <Wand2 size={14} />
                <span>Continuar y Redactar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREGUNTAR MEDICACIÓN PARA PLANILLA PROFE 133 */}
      {showProfeMedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                  <Pill size={20} />
                </div>
                <div>
                  <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                    Form. 133.0 PROFE
                  </span>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mt-1">
                    Medicación Oncológica de Alto Costo
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowProfeMedModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                  ¿Qué medicación desea solicitar?
                </label>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Seleccione una opción o escriba el fármaco/esquema. El sistema redactará la justificación técnica, evolución mensual y dosis orientadas a esta medicación.
                </p>
              </div>

              {/* Sugerencias rápidas habituales */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Pembrolizumab 200 mg EV c/21 días',
                  'Trastuzumab emtansina (T-DM1) 160 mg EV',
                  'Letrozol 2.5 mg/día VO',
                  'Palbociclib 125 mg/día VO + Fulvestrant',
                  'Osimertinib 80 mg/día VO',
                  'Nivolumab 240 mg EV c/14 días',
                  'Ribociclib 600 mg/día VO + Letrozol',
                  'Bevacizumab 7.5 mg/kg EV c/21 días'
                ].map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setProfeMedInput(sug)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all text-left
                      ${profeMedInput === sug
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="text"
                  autoFocus
                  value={profeMedInput}
                  onChange={e => setProfeMedInput(e.target.value)}
                  placeholder="Escriba o ajuste el fármaco y dosis a solicitar..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProfeMedModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!profeMedInput.trim()}
                onClick={() => {
                  const profeDef = ADMIN_FORMS_REGISTRY.find(f => f.id === 'derivacion_profe_133');
                  if (profeDef && profeMedInput.trim()) {
                    setShowProfeMedModal(false);
                    handleStartAdminFormFlow(profeDef, { medicacion_solicitada: profeMedInput.trim() });
                  }
                }}
                className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
              >
                <Wand2 size={14} />
                <span>Continuar y Redactar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREGUNTAR MEDICACIÓN PARA FICHA DE SOLICITUD DE MEDICAMENTOS ONCOLÓGICOS */}
      {showSolicitudMedsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <Pill size={20} />
                </div>
                <div>
                  <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                    Hospital Oncológico Provincial
                  </span>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mt-1">
                    Ficha de Solicitud de Medicamentos
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowSolicitudMedsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                  ¿Qué medicación desea solicitar?
                </label>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Seleccione una opción o escriba el fármaco o esquema oncológico (monoterapia o combinación). El sistema completará la tabla de drogas, dosis/m², posología y antecedentes en base a esta solicitud.
                </p>
              </div>

              {/* Sugerencias rápidas habituales */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Letrozol 2.5 mg/día VO',
                  'Pembrolizumab 200 mg EV c/21 días',
                  'Carboplatino AUC 5 + Paclitaxel 175 mg/m²',
                  'Trastuzumab 6 mg/kg + Pertuzumab 420 mg',
                  'FOLFIRINOX modificado',
                  'Palbociclib 125 mg/día + Fulvestrant 500 mg',
                  'FOLFOX-6 (Oxaliplatino + LV + 5-FU)',
                  'Osimertinib 80 mg/día VO'
                ].map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setSolicitudMedsInput(sug)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all text-left
                      ${solicitudMedsInput === sug
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="text"
                  autoFocus
                  value={solicitudMedsInput}
                  onChange={e => setSolicitudMedsInput(e.target.value)}
                  placeholder="Escriba o ajuste el fármaco / esquema a solicitar..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 transition-all"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSolicitudMedsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!solicitudMedsInput.trim()}
                onClick={() => {
                  const medsDef = ADMIN_FORMS_REGISTRY.find(f => f.id === 'solicitud_medicamentos_onco');
                  if (medsDef && solicitudMedsInput.trim()) {
                    setShowSolicitudMedsModal(false);
                    handleStartAdminFormFlow(medsDef, { droga_principal: solicitudMedsInput.trim() });
                  }
                }}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
              >
                <Wand2 size={14} />
                <span>Continuar y Redactar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REVISIÓN Y EMISIÓN PARA FORMULARIOS ADMINISTRATIVOS */}
      {selectedAdminForm && (
        <AdminFormReviewModal
          formDef={selectedAdminForm}
          isOpen={adminModalOpen}
          onClose={() => {
            setAdminModalOpen(false);
            setSelectedAdminForm(null);
          }}
          initialData={adminFormData}
          context={{
            patient,
            historyText: getEffectiveClinicalContext(),
            timeline: timeline || patient?.timeline || [],
            files,
            doctorData
          }}
        />
      )}

      {/* MODAL DE VISTA PREVIA INTERACTIVA Y REVISIÓN PREVIA A LA DESCARGA DEFINITIVA */}
      {activePreview && (
        <FormPreviewModal
          isOpen={activePreview !== null}
          onClose={() => setActivePreview(null)}
          title={activePreview.title}
          code={activePreview.code}
          subtitle={activePreview.subtitle}
          pdfBlob={activePreview.blob}
          filename={activePreview.filename}
          onConfirmDownload={handleConfirmPreviewDownload}
          onUpdatePreview={handleUpdateActivePreview}
          isUpdating={isPreviewUpdating}
        >
          {renderSummaryFieldsContent()}
        </FormPreviewModal>
      )}

    </div>
  );
};

export default FormManager;
