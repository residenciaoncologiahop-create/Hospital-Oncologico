/**
 * Sincronizador de Ensayos Clínicos para Cloud Functions
 * Conecta con ClinicalTrials.gov API v2 y persiste en Firestore usando Firebase Admin SDK.
 */

const CT_GOV_API_BASE = "https://clinicaltrials.gov/api/v2/studies";

/**
 * Normaliza y extrae tipos de tumores principales para matching
 */
function extractTumorTypes(conditions, title, officialTitle) {
  const condStr = Array.isArray(conditions) ? conditions.join(" ") : "";
  const combined = `${condStr} | ${title || ""} | ${officialTitle || ""}`.toLowerCase();
  const found = new Set();

  const mapping = {
    colorrectal: [/\b(colorectal|colon|rectal|rectum)\b/i],
    pulmon: [/\b(lung|nsclc|sclc|bronchial|non-small cell|small cell lung|pulmonary)\b/i],
    mama: [/\b(breast|mama|mamari[ao]|triple-negative breast|her2-positive breast)\b/i],
    melanoma: [/\b(melanoma)\b/i],
    prostata: [/\b(prostate|prostatic)\b/i],
    pancreas: [/\b(pancrea|pancreatic)\b/i],
    ovario: [/\b(ovarian|fallopian|primary peritoneal|ovario)\b/i],
    gastrico: [/\b(gastric|gastroesophageal|esophageal|stomach cancer)\b/i],
    rinon: [/\b(renal cell|kidney cancer|renal carcinoma|clear cell renal)\b/i],
    vejiga: [/\b(urothelial|bladder cancer|bladder carcinoma|urothelium)\b/i],
    cervicouterino: [/\b(cervical cancer|cervix|endometrial|uterine cancer)\b/i],
    cabeza_cuello: [/\b(head and neck|laryngeal|pharyngeal|oral cavity|hypopharynx|oropharynx)\b/i],
    hematologia: [/\b(leukemia|lymphoma|myeloma|hematologic|hodgkin)\b/i],
    snc: [/\b(glioblastoma|glioma|astrocytoma|brain tumor|cns)\b/i],
    sarcoma: [/\b(sarcoma|gist|gastrointestinal stromal)\b/i],
    biliar: [/\b(biliary|cholangiocarcinoma|gallbladder)\b/i],
  };

  for (const [key, patterns] of Object.entries(mapping)) {
    if (patterns.some((p) => p.test(combined))) {
      found.add(key);
    }
  }

  if (found.size === 0) {
    if (/\b(solid tumor|solid tumors|tumores s[oó]lidos|advanced solid malignancies|advanced solid tumors)\b/i.test(combined)) {
      found.add("solido_agnostico");
    }
  }

  return Array.from(found);
}

/**
 * Normaliza y detecta biomarcadores clave en el texto del estudio
 */
function extractBiomarkers(text) {
  if (!text) return [];
  const upper = text.toUpperCase();
  const biomarkers = [];

  const markers = [
    "KRAS", "NRAS", "HRAS", "BRAF", "EGFR", "HER2", "ERBB2", "ALK", "ROS1",
    "RET", "MET", "NTRK", "BRCA1", "BRCA2", "BRCA", "PALB2", "ATM", "PIK3CA",
    "PD-L1", "PD1", "CTLA-4", "MSI-H", "MSI", "DMMR", "PMMR", "MSS",
    "TMB", "ESR1", "FGFR", "IDH1", "IDH2", "CDK4", "CDK6",
  ];

  for (const m of markers) {
    const regex = new RegExp(`\\b${m}\\b`, "i");
    if (regex.test(upper)) {
      biomarkers.push(m);
    }
  }

  return Array.from(new Set(biomarkers));
}

/**
 * Parsea el bloque de texto de criterios de elegibilidad en listas separadas
 */
function parseEligibilityCriteria(rawCriteria) {
  if (!rawCriteria) return { inclusion: [], exclusion: [] };

  const lower = rawCriteria.toLowerCase();
  const incIdx = lower.indexOf("inclusion criteria");
  const excIdx = lower.indexOf("exclusion criteria");

  let incText = "";
  let excText = "";

  if (incIdx !== -1 && excIdx !== -1) {
    if (incIdx < excIdx) {
      incText = rawCriteria.substring(incIdx + "inclusion criteria".length, excIdx);
      excText = rawCriteria.substring(excIdx + "exclusion criteria".length);
    } else {
      excText = rawCriteria.substring(excIdx + "exclusion criteria".length, incIdx);
      incText = rawCriteria.substring(incIdx + "inclusion criteria".length);
    }
  } else if (incIdx !== -1) {
    incText = rawCriteria.substring(incIdx + "inclusion criteria".length);
  } else if (excIdx !== -1) {
    excText = rawCriteria.substring(excIdx + "exclusion criteria".length);
  } else {
    incText = rawCriteria;
  }

  const cleanLines = (txt) => {
    return txt
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^[-*•\d+.)]\s*/, "").trim())
      .filter((line) => line.length > 5 && !line.startsWith(":") && !line.startsWith("---"));
  };

  return {
    inclusion: cleanLines(incText),
    exclusion: cleanLines(excText),
  };
}

/**
 * Parsea edad a número de años
 */
function parseAgeToYears(ageStr) {
  if (!ageStr) return undefined;
  const match = ageStr.match(/(\d+)\s*(year|año|yr)/i);
  if (match) return parseInt(match[1], 10);
  const numOnly = parseInt(ageStr, 10);
  return isNaN(numOnly) ? undefined : numOnly;
}

/**
 * Normaliza el estado general de reclutamiento
 */
function normalizeStatus(status) {
  const s = (status || "").toUpperCase();
  switch (s) {
    case "RECRUITING":
      return { status: "RECRUITING", label: "Reclutando" };
    case "NOT_YET_RECRUITING":
      return { status: "NOT_YET_RECRUITING", label: "Aún no recluta" };
    case "ENROLLING_BY_INVITATION":
      return { status: "ENROLLING_BY_INVITATION", label: "Por invitación" };
    case "ACTIVE_NOT_RECRUITING":
      return { status: "ACTIVE_NOT_RECRUITING", label: "Activo (no recluta)" };
    case "COMPLETED":
      return { status: "COMPLETED", label: "Completado" };
    case "TERMINATED":
      return { status: "TERMINATED", label: "Terminado" };
    case "SUSPENDED":
      return { status: "SUSPENDED", label: "Suspendido" };
    case "WITHDRAWN":
      return { status: "WITHDRAWN", label: "Retirado" };
    default:
      return { status: "UNKNOWN", label: status || "Desconocido" };
  }
}

/**
 * Normaliza la fase
 */
function normalizePhase(phases) {
  if (!phases || phases.length === 0) {
    return { phase: "No especificada", phaseNormalized: "NA" };
  }
  const joined = phases.join(", ");
  if (joined.includes("PHASE3")) return { phase: joined, phaseNormalized: "Fase 3" };
  if (joined.includes("PHASE2")) return { phase: joined, phaseNormalized: "Fase 2" };
  if (joined.includes("PHASE1")) return { phase: joined, phaseNormalized: "Fase 1" };
  if (joined.includes("PHASE4")) return { phase: joined, phaseNormalized: "Fase 4" };
  return { phase: joined, phaseNormalized: joined };
}

/**
 * Transforma un registro de estudio de la API v2 al modelo de Firestore
 */
function mapStudyToClinicalTrial(study) {
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

  const nctId = idMod.nctId || "";
  const title = idMod.briefTitle || idMod.officialTitle || "Estudio sin título registrado";
  const officialTitle = idMod.officialTitle;
  const sponsor = sponsorMod.leadSponsor?.name || "Patrocinador no especificado";

  const { status, label: statusLabel } = normalizeStatus(statusMod.overallStatus);
  const { phase, phaseNormalized } = normalizePhase(designMod.phases);

  const conditions = condMod.conditions || [];
  const interventions = (armsMod.interventions || []).map((i) => {
    return i.type ? `${i.type}: ${i.name}` : i.name;
  });

  const briefSummary = descMod.briefSummary || "";
  const eligibilityCriteria = eligMod.eligibilityCriteria || "";
  const { inclusion, exclusion } = parseEligibilityCriteria(eligibilityCriteria);

  const minAge = eligMod.minimumAge;
  const maxAge = eligMod.maximumAge;
  const minAgeYears = parseAgeToYears(minAge);
  const maxAgeYears = parseAgeToYears(maxAge);

  let sex = "ALL";
  if (eligMod.sex === "FEMALE") sex = "FEMALE";
  else if (eligMod.sex === "MALE") sex = "MALE";

  const rawLocs = locMod.locations || [];
  const locations = [];
  let hasCordobaCenter = false;
  let hasArgentinaCenter = false;
  const cordobaCenters = [];

  for (const l of rawLocs) {
    const country = (l.country || "").trim();
    const city = (l.city || "").trim();
    const state = (l.state || "").trim();
    const facility = (l.facility || "").trim();

    const isArg = country.toLowerCase() === "argentina";
    if (isArg) hasArgentinaCenter = true;

    const cityNorm = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const stateNorm = state.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isCordoba = isArg && (cityNorm.includes("cordoba") || stateNorm.includes("cordoba"));

    if (isCordoba) {
      hasCordobaCenter = true;
      if (facility && !cordobaCenters.includes(facility)) {
        cordobaCenters.push(facility);
      }
    }

    locations.push({
      facility: facility || null,
      city: city || null,
      state: state || null,
      zip: l.zip || null,
      country: country || "No informada",
      status: l.status || null,
      isCordoba,
    });
  }

  let contact = null;
  const primaryContact = locMod.centralContacts?.[0];
  if (primaryContact) {
    contact = {
      name: primaryContact.name || null,
      role: primaryContact.role || null,
      phone: primaryContact.phone || null,
      email: primaryContact.email || null,
    };
  }

  const lastUpdated =
    statusMod.lastUpdatePostDateStruct?.date ||
    statusMod.lastUpdateSubmitDate ||
    new Date().toISOString().split("T")[0];

  const url = `https://clinicaltrials.gov/study/${nctId}`;
  const tumorTypes = extractTumorTypes(conditions, title, officialTitle);
  const biomarkers = extractBiomarkers(`${title} ${conditions.join(" ")} ${interventions.join(" ")} ${eligibilityCriteria}`);

  const combinedSearch = `${title} ${conditions.join(" ")} ${eligibilityCriteria}`.toLowerCase();
  const isMetastaticEligible =
    combinedSearch.includes("metastatic") ||
    combinedSearch.includes("metástasis") ||
    combinedSearch.includes("stage iv") ||
    combinedSearch.includes("estadio iv") ||
    combinedSearch.includes("advanced") ||
    combinedSearch.includes("avanzado") ||
    combinedSearch.includes("unresectable") ||
    combinedSearch.includes("no resecable");

  const record = {
    id: `ctgov_${nctId}`,
    source: "clinicaltrials.gov",
    sourceId: nctId,
    nctId,
    title,
    officialTitle: officialTitle || null,
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
    minimumAge: minAge || null,
    minimumAgeYears: minAgeYears !== undefined ? minAgeYears : null,
    maximumAge: maxAge || null,
    maximumAgeYears: maxAgeYears !== undefined ? maxAgeYears : null,
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
    isMetastaticEligible,
  };

  return record;
}

/**
 * Consulta la API v2 de ClinicalTrials.gov paginando los resultados
 */
async function fetchClinicalTrialsGov(options = {}) {
  const {
    conditionQuery = "cancer OR oncology OR neoplasm OR tumor OR carcinoma OR leukemia OR lymphoma",
    locationQuery = "Argentina",
    recruitingOnly = true,
    maxPages = 4,
    pageSize = 100,
  } = options;

  const trialsMap = new Map();
  let pageToken = undefined;
  let page = 0;

  while (page < maxPages) {
    page++;
    const params = new URLSearchParams({
      "query.cond": conditionQuery,
      "query.locn": locationQuery,
      "pageSize": pageSize.toString(),
    });

    if (recruitingOnly) {
      params.set("filter.overallStatus", "RECRUITING,NOT_YET_RECRUITING,ENROLLING_BY_INVITATION");
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${CT_GOV_API_BASE}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar ClinicalTrials.gov: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const studies = data.studies || [];

    for (const study of studies) {
      try {
        const mapped = mapStudyToClinicalTrial(study);
        if (mapped.nctId) {
          trialsMap.set(mapped.id, mapped);
        }
      } catch (err) {
        console.warn("Error al mapear estudio individual:", err.message);
      }
    }

    if (data.nextPageToken && studies.length > 0) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return Array.from(trialsMap.values());
}

/**
 * Ejecuta la sincronización completa y persiste en Firestore usando Firebase Admin SDK
 */
async function syncAndSaveTrials(db) {
  const errors = [];
  let trials = [];

  try {
    trials = await fetchClinicalTrialsGov();
  } catch (err) {
    errors.push(`Fallo al consultar ClinicalTrials.gov: ${err.message}`);
    throw err;
  }

  let savedCount = 0;
  const BATCH_SIZE = 400; // Límite seguro por debajo del máximo de 500 de Firestore

  for (let i = 0; i < trials.length; i += BATCH_SIZE) {
    const chunk = trials.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const trial of chunk) {
      const docRef = db.collection("clinical_trials").doc(trial.id);
      batch.set(docRef, trial, { merge: true });
    }

    try {
      await batch.commit();
      savedCount += chunk.length;
    } catch (err) {
      errors.push(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`);
    }
  }

  const cordobaCount = trials.filter((t) => t.hasCordobaCenter).length;

  return {
    success: errors.length === 0,
    totalFetched: trials.length,
    totalSaved: savedCount,
    cordobaCount,
    timestamp: Date.now(),
    errors: errors.length > 0 ? errors : null,
  };
}

module.exports = {
  fetchClinicalTrialsGov,
  syncAndSaveTrials,
  mapStudyToClinicalTrial,
};
