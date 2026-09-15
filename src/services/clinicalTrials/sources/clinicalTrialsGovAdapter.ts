import { ClinicalTrial, TrialLocation, TrialStatusType } from '../../../types/clinicalTrials';

const CT_GOV_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';

/**
 * Normaliza y extrae tipos de tumores principales para búsqueda rápida
 */
function extractTumorTypes(conditions: string[], title: string, summary: string): string[] {
  const combined = `${conditions.join(' ')} ${title} ${summary}`.toLowerCase();
  const found = new Set<string>();

  const mapping: Record<string, string[]> = {
    colorrectal: ['colon', 'rectal', 'colorectal', 'colorrectal', 'rectum'],
    pulmon: ['lung', 'pulmon', 'nsclc', 'sclc', 'bronchial'],
    mama: ['breast', 'mama', 'mamario'],
    melanoma: ['melanoma', 'cutaneous melanoma'],
    prostata: ['prostate', 'prostata'],
    pancreas: ['pancrea', 'pancreatic', 'ductal adenocarcinoma of the pancreas'],
    ovario: ['ovarian', 'ovario', 'fallopian'],
    gastrico: ['gastric', 'gástrico', 'estómago', 'stomach', 'esophag', 'gastroesophageal'],
    rinon: ['renal', 'kidney', 'riñón', 'rcc'],
    vejiga: ['bladder', 'urothelial', 'vejiga'],
    cervicouterino: ['cervix', 'cervical', 'uter', 'endometrial'],
    cabeza_cuello: ['head and neck', 'cabeza y cuello', 'laryngeal', 'oral cavity', 'pharynx'],
    hematologia: ['leukemia', 'leucemia', 'lymphoma', 'linfoma', 'myeloma', 'mieloma'],
    snc: ['glioma', 'glioblastoma', 'brain', 'cerebr', 'cns'],
    sarcoma: ['sarcoma', 'gastrointestinal stromal', 'gist'],
    biliar: ['biliary', 'cholangiocarcinoma', 'colangiocarcinoma', 'gallbladder', 'vesícula']
  };

  for (const [key, keywords] of Object.entries(mapping)) {
    if (keywords.some(k => combined.includes(k))) {
      found.add(key);
    }
  }

  return Array.from(found);
}

/**
 * Normaliza y detecta biomarcadores clave en el texto del estudio
 */
function extractBiomarkers(text: string): string[] {
  const upper = text.toUpperCase();
  const biomarkers: string[] = [];

  const markers = [
    'KRAS', 'NRAS', 'HRAS', 'BRAF', 'EGFR', 'HER2', 'ERBB2', 'ALK', 'ROS1',
    'RET', 'MET', 'NTRK', 'BRCA1', 'BRCA2', 'BRCA', 'PALB2', 'ATM', 'PIK3CA',
    'PD-L1', 'PD1', 'CTLA-4', 'MSI-H', 'MSI', 'DMMR', 'PMMR', 'MSS',
    'TMB', 'ESR1', 'FGFR', 'IDH1', 'IDH2', 'CDK4', 'CDK6'
  ];

  for (const m of markers) {
    const regex = new RegExp(`\\b${m}\\b`, 'i');
    if (regex.test(upper)) {
      biomarkers.push(m);
    }
  }

  return Array.from(new Set(biomarkers));
}

/**
 * Parsea el bloque de texto de criterios de elegibilidad en listas separadas
 */
function parseEligibilityCriteria(rawCriteria: string): { inclusion: string[]; exclusion: string[] } {
  if (!rawCriteria) return { inclusion: [], exclusion: [] };

  const inclusion: string[] = [];
  const exclusion: string[] = [];

  const lower = rawCriteria.toLowerCase();
  const incIdx = lower.indexOf('inclusion criteria');
  const excIdx = lower.indexOf('exclusion criteria');

  let incText = '';
  let excText = '';

  if (incIdx !== -1 && excIdx !== -1) {
    if (incIdx < excIdx) {
      incText = rawCriteria.substring(incIdx + 'inclusion criteria'.length, excIdx);
      excText = rawCriteria.substring(excIdx + 'exclusion criteria'.length);
    } else {
      excText = rawCriteria.substring(excIdx + 'exclusion criteria'.length, incIdx);
      incText = rawCriteria.substring(incIdx + 'inclusion criteria'.length);
    }
  } else if (incIdx !== -1) {
    incText = rawCriteria.substring(incIdx + 'inclusion criteria'.length);
  } else if (excIdx !== -1) {
    excText = rawCriteria.substring(excIdx + 'exclusion criteria'.length);
  } else {
    incText = rawCriteria;
  }

  const cleanLines = (txt: string): string[] => {
    return txt
      .split(/\r?\n/)
      .map(line => line.trim().replace(/^[-*•\d+.)]\s*/, '').trim())
      .filter(line => line.length > 5 && !line.startsWith(':') && !line.startsWith('---'));
  };

  return {
    inclusion: cleanLines(incText),
    exclusion: cleanLines(excText)
  };
}

/**
 * Parsea edad a número de años
 */
function parseAgeToYears(ageStr?: string): number | undefined {
  if (!ageStr) return undefined;
  const match = ageStr.match(/(\d+)\s*(year|año|yr)/i);
  if (match) return parseInt(match[1], 10);
  const numOnly = parseInt(ageStr, 10);
  return isNaN(numOnly) ? undefined : numOnly;
}

/**
 * Normaliza el estado general de reclutamiento
 */
function normalizeStatus(status?: string): { status: TrialStatusType; label: string } {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'RECRUITING':
      return { status: 'RECRUITING', label: 'Reclutando' };
    case 'NOT_YET_RECRUITING':
      return { status: 'NOT_YET_RECRUITING', label: 'Aún no recluta' };
    case 'ENROLLING_BY_INVITATION':
      return { status: 'ENROLLING_BY_INVITATION', label: 'Por invitación' };
    case 'ACTIVE_NOT_RECRUITING':
      return { status: 'ACTIVE_NOT_RECRUITING', label: 'Activo (no recluta)' };
    case 'COMPLETED':
      return { status: 'COMPLETED', label: 'Completado' };
    case 'TERMINATED':
      return { status: 'TERMINATED', label: 'Terminado' };
    case 'SUSPENDED':
      return { status: 'SUSPENDED', label: 'Suspendido' };
    case 'WITHDRAWN':
      return { status: 'WITHDRAWN', label: 'Retirado' };
    default:
      return { status: 'UNKNOWN', label: status || 'Desconocido' };
  }
}

/**
 * Normaliza la fase
 */
function normalizePhase(phases?: string[]): { phase: string; phaseNormalized: string } {
  if (!phases || phases.length === 0) {
    return { phase: 'No especificada', phaseNormalized: 'NA' };
  }
  const joined = phases.join(', ');
  if (joined.includes('PHASE3')) return { phase: joined, phaseNormalized: 'Fase 3' };
  if (joined.includes('PHASE2')) return { phase: joined, phaseNormalized: 'Fase 2' };
  if (joined.includes('PHASE1')) return { phase: joined, phaseNormalized: 'Fase 1' };
  if (joined.includes('PHASE4')) return { phase: joined, phaseNormalized: 'Fase 4' };
  return { phase: joined, phaseNormalized: joined };
}

/**
 * Transforma un registro de estudio de la API v2 de ClinicalTrials.gov al modelo interno ClinicalTrial
 */
export function mapStudyToClinicalTrial(study: any): ClinicalTrial {
  const p = study?.protocolSection || {};
  const idMod = p.identificationModule || {};
  const statusMod = p.statusModule || {};
  const sponsorMod = p.sponsorCollaboratorsModule || {};
  const designMod = p.designModule || {};
  const condMod = p.conditionsModule || {};
  const armsMod = p.armsInterventionsModule || {};
  const descMod = p.descriptionModule || {};
  const eligMod = p.eligibilityModule || {};
  const locMod = p.contactsLocationsModule || {};

  const nctId = idMod.nctId || '';
  const title = idMod.briefTitle || idMod.officialTitle || 'Estudio sin título registrado';
  const officialTitle = idMod.officialTitle;
  const sponsor = sponsorMod.leadSponsor?.name || 'Patrocinador no especificado';

  const { status, label: statusLabel } = normalizeStatus(statusMod.overallStatus);
  const { phase, phaseNormalized } = normalizePhase(designMod.phases);

  const conditions: string[] = condMod.conditions || [];
  const interventions: string[] = (armsMod.interventions || []).map((i: any) => {
    return i.type ? `${i.type}: ${i.name}` : i.name;
  });

  const briefSummary = descMod.briefSummary || '';
  const eligibilityCriteria = eligMod.eligibilityCriteria || '';
  const { inclusion, exclusion } = parseEligibilityCriteria(eligibilityCriteria);

  const minAge = eligMod.minimumAge;
  const maxAge = eligMod.maximumAge;
  const minAgeYears = parseAgeToYears(minAge);
  const maxAgeYears = parseAgeToYears(maxAge);

  let sex: 'ALL' | 'FEMALE' | 'MALE' = 'ALL';
  if (eligMod.sex === 'FEMALE') sex = 'FEMALE';
  else if (eligMod.sex === 'MALE') sex = 'MALE';

  // Procesamiento cuidadoso de ubicaciones: identificar Argentina y Córdoba
  const rawLocs = locMod.locations || [];
  const locations: TrialLocation[] = [];
  let hasCordobaCenter = false;
  let hasArgentinaCenter = false;
  const cordobaCenters: string[] = [];

  for (const l of rawLocs) {
    const country = (l.country || '').trim();
    const city = (l.city || '').trim();
    const state = (l.state || '').trim();
    const facility = (l.facility || '').trim();

    const isArg = country.toLowerCase() === 'argentina';
    if (isArg) hasArgentinaCenter = true;

    // Detectar si está en Córdoba, Argentina
    const cityNorm = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const stateNorm = state.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isCordoba = isArg && (cityNorm.includes('cordoba') || stateNorm.includes('cordoba'));

    if (isCordoba) {
      hasCordobaCenter = true;
      if (facility && !cordobaCenters.includes(facility)) {
        cordobaCenters.push(facility);
      }
    }

    locations.push({
      facility: facility || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: l.zip || undefined,
      country: country || 'No informada',
      status: l.status || undefined,
      isCordoba
    });
  }

  // Contacto
  let contact = undefined;
  const primaryContact = locMod.centralContacts?.[0];
  if (primaryContact) {
    contact = {
      name: primaryContact.name,
      role: primaryContact.role,
      phone: primaryContact.phone,
      email: primaryContact.email
    };
  }

  // Fecha de última actualización
  const lastUpdated = 
    statusMod.lastUpdatePostDateStruct?.date || 
    statusMod.lastUpdateSubmitDate || 
    new Date().toISOString().split('T')[0];

  // URL del estudio oficial
  const url = `https://clinicaltrials.gov/study/${nctId}`;

  // Normalizaciones clínicas
  const tumorTypes = extractTumorTypes(conditions, title, briefSummary);
  const biomarkers = extractBiomarkers(`${title} ${conditions.join(' ')} ${interventions.join(' ')} ${eligibilityCriteria}`);

  const combinedSearch = `${title} ${conditions.join(' ')} ${eligibilityCriteria}`.toLowerCase();
  const isMetastaticEligible = 
    combinedSearch.includes('metastatic') || 
    combinedSearch.includes('metástasis') || 
    combinedSearch.includes('stage iv') || 
    combinedSearch.includes('estadio iv') || 
    combinedSearch.includes('advanced') || 
    combinedSearch.includes('avanzado') ||
    combinedSearch.includes('unresectable') ||
    combinedSearch.includes('no resecable');

  return {
    id: `ctgov_${nctId}`,
    source: 'clinicaltrials.gov',
    sourceId: nctId,
    nctId,
    title,
    officialTitle,
    sponsor,
    status,
    statusLabel,
    phase,
    phaseNormalized,
    conditions,
    interventions,
    briefSummary,
    eligibilityCriteria,
    inclusionCriteria: inclusion,
    exclusionCriteria: exclusion,
    minimumAge: minAge,
    minimumAgeYears: minAgeYears,
    maximumAge: maxAge,
    maximumAgeYears: maxAgeYears,
    sex,
    locations,
    hasCordobaCenter,
    hasArgentinaCenter,
    cordobaCenters,
    contact,
    url,
    lastUpdated,
    importedAt: Date.now(),
    tumorTypes,
    biomarkers,
    isMetastaticEligible
  };
}

export interface FetchTrialsOptions {
  conditionQuery?: string;
  locationQuery?: string;
  recruitingOnly?: boolean;
  maxPages?: number;
  pageSize?: number;
}

/**
 * Consulta la API v2 de ClinicalTrials.gov y retorna la lista mapeada de ClinicalTrial
 */
export async function fetchClinicalTrialsGov(options: FetchTrialsOptions = {}): Promise<ClinicalTrial[]> {
  const {
    conditionQuery = 'cancer OR oncology OR neoplasm OR tumor OR carcinoma OR leukemia OR lymphoma',
    locationQuery = 'Argentina',
    recruitingOnly = true,
    maxPages = 4, // 4 páginas x 100 = hasta 400 estudios (cubre todo Argentina)
    pageSize = 100
  } = options;

  const trials: ClinicalTrial[] = [];
  let pageToken: string | undefined = undefined;
  let page = 0;

  while (page < maxPages) {
    page++;
    const params = new URLSearchParams({
      'query.cond': conditionQuery,
      'query.locn': locationQuery,
      'pageSize': pageSize.toString()
    });

    if (recruitingOnly) {
      params.set('filter.overallStatus', 'RECRUITING,NOT_YET_RECRUITING,ENROLLING_BY_INVITATION');
    }

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `${CT_GOV_API_BASE}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error al consultar ClinicalTrials.gov: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const studies = data.studies || [];

    for (const study of studies) {
      try {
        const mapped = mapStudyToClinicalTrial(study);
        trials.push(mapped);
      } catch (err) {
        console.warn('Error al parsear estudio de ClinicalTrials.gov:', err);
      }
    }

    if (data.nextPageToken && studies.length > 0) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return trials;
}
