/**
 * Sincronizador de Ensayos Clínicos para Cloud Functions
 * Conecta con ClinicalTrials.gov API v2 y persiste en Firestore usando Firebase Admin SDK.
 */

const { FieldValue } = require("firebase-admin/firestore");

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
 * Normaliza texto a minúsculas y elimina diacríticos/acentos.
 */
function normalizeOncologyText(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Neutraliza menciones de "tumor necrosis factor" / "factor de necrosis tumoral"
 * para evitar falsos positivos en patologías no oncológicas (artritis, Crohn, etc.).
 */
function sanitizeTnf(text) {
  if (!text) return "";
  return text
    .replace(/anti[-\s]?tumou?r\s+necrosis\s+factor/g, " ")
    .replace(/factor\s+de\s+necrosis\s+tumoral/g, " ")
    .replace(/tumou?r\s+necrosis\s+factor/g, " ")
    .replace(/anti[-\s]?tnf/g, " ")
    .replace(/\btnf\b/g, " ");
}

const STRONG_ONCOLOGY_TERMS = [
  "cancer", "cancerous", "carcinoma", "adenocarcinoma", "neoplasm", "neoplasia", "neoplasma",
  "neoplasic", "neoplastic", "tumor", "tumour", "tumoral", "tumores", "malignan", "maligno",
  "maligna", "malignidad", "metasta", "metastatic", "metastasis", "metastasico", "metastasica",
  "leukemia", "leucemia", "lymphoma", "linfoma", "myeloma", "mieloma", "sarcoma", "melanoma",
  "glioma", "glioblastoma", "astrocytoma", "astrocitoma", "oligodendroglioma", "ependymoma",
  "ependimoma", "blastoma", "myelodysplastic", "mielodisplasic", "myelodysplasia", "mielodisplasia",
  "oncolog", "oncologia", "oncologico", "oncology", "mesothelioma", "mesotelioma", "seminoma",
  "teratoma", "choriocarcinoma", "coriocarcinoma", "thymoma", "timoma", "carcinoid", "carcinoide",
  "hodgkin", "wilms", "ewing", "kaposi", "waldenstrom", "myelofibrosis", "mielofibrosis",
  "polycythemia vera", "policitemia vera"
];

const SUPPORTIVE_ONCOLOGY_TERMS = [
  "quimioterap", "chemotherap", "chemo-", "radioterap", "radiotherap", "radiation therapy",
  "antineoplas", "antineoplastic", "neutropenia febril", "febrile neutropenia",
  "trasplante de medula", "bone marrow transplant", "marrow transplantation",
  "trasplante hematopoyetico", "hematopoietic stem cell", "hematopoietic cell transplant",
  "inmunooncolog", "immuno-oncology"
];

function findMatchedTerm(text, termList) {
  if (!text) return null;
  for (const term of termList) {
    if (text.includes(term)) return term;
  }
  return null;
}

/**
 * Clasifica si un ensayo clínico es de índole oncológica o no.
 * Criterio conservador: ante la duda, clasifica como oncológico.
 * NO utiliza briefSummary ni eligibilityCriteria para evitar falsos positivos.
 * @param {{ conditions?: string[], title?: string, officialTitle?: string, keywords?: string[] }} input
 * @returns {{ isOncology: boolean, matchType?: 'strong' | 'supportive' | 'keywords' | 'default', isWeakMatch: boolean, matchedTerm?: string }}
 */
function classifyOncologyTrial(input = {}) {
  const { conditions, title, officialTitle, keywords } = input || {};

  const condArray = Array.isArray(conditions)
    ? conditions.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  const kwArray = Array.isArray(keywords)
    ? keywords.map((k) => String(k || "").trim()).filter(Boolean)
    : [];

  const mainTexts = [
    ...condArray,
    title || "",
    officialTitle || "",
  ]
    .map((t) => sanitizeTnf(normalizeOncologyText(t)))
    .filter(Boolean);

  // 1. Coincidencia fuerte en condiciones o títulos
  for (const text of mainTexts) {
    const term = findMatchedTerm(text, STRONG_ONCOLOGY_TERMS);
    if (term) {
      return {
        isOncology: true,
        matchType: "strong",
        isWeakMatch: false,
        matchedTerm: term,
      };
    }
  }

  // 2. Coincidencia de soporte / terapia oncológica en condiciones o títulos
  for (const text of mainTexts) {
    const term = findMatchedTerm(text, SUPPORTIVE_ONCOLOGY_TERMS);
    if (term) {
      return {
        isOncology: true,
        matchType: "supportive",
        isWeakMatch: true,
        matchedTerm: term,
      };
    }
  }

  // 3. Coincidencia en keywords (Tier 1 o Tier 2)
  const kwTexts = kwArray
    .map((k) => sanitizeTnf(normalizeOncologyText(k)))
    .filter(Boolean);

  for (const text of kwTexts) {
    const strongTerm = findMatchedTerm(text, STRONG_ONCOLOGY_TERMS);
    if (strongTerm) {
      return {
        isOncology: true,
        matchType: "keywords",
        isWeakMatch: true,
        matchedTerm: strongTerm,
      };
    }
    const suppTerm = findMatchedTerm(text, SUPPORTIVE_ONCOLOGY_TERMS);
    if (suppTerm) {
      return {
        isOncology: true,
        matchType: "keywords",
        isWeakMatch: true,
        matchedTerm: suppTerm,
      };
    }
  }

  // 4. Criterio conservador: si no hay condiciones especificadas, se asume oncológico por defecto
  if (condArray.length === 0) {
    return {
      isOncology: true,
      matchType: "default",
      isWeakMatch: false,
      matchedTerm: "default_empty_conditions",
    };
  }

  // 5. No oncológico
  return {
    isOncology: false,
    matchType: undefined,
    isWeakMatch: false,
    matchedTerm: undefined,
  };
}

/**
 * Función pública pura requerida: devuelve exclusivamente boolean
 * @param {{ conditions?: string[], title?: string, officialTitle?: string, keywords?: string[] }} input
 * @returns {boolean}
 */
function isOncologyTrial(input) {
  return classifyOncologyTrial(input).isOncology;
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
  const keywords = condMod.keywords || [];
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

  const oncologyClassification = classifyOncologyTrial({
    conditions,
    title,
    officialTitle,
    keywords,
  });
  const isOncology = oncologyClassification.isOncology;

  const record = {
    id: `ctgov_${nctId}`,
    source: "clinicaltrials.gov",
    sourceId: nctId,
    nctId,
    title,
    officialTitle: officialTitle || null,
    isOncology,
    _oncologyClassification: oncologyClassification,
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
      pageToken = undefined;
      break;
    }
  }

  const truncated = Boolean(pageToken);
  if (truncated) {
    console.warn(`[fetchClinicalTrialsGov] Se alcanzó maxPages (${maxPages}) y la API aún devuelve más estudios (nextPageToken). Sincronización truncada.`);
  }

  return {
    trials: Array.from(trialsMap.values()),
    truncated,
  };
}

/**
 * Identifica los documentos que deben marcarse como STALE.
 * Regla: STALE si lastSyncedAt es undefined, null o menor que runTimestamp.
 * Si ya tiene syncStatus === 'STALE', no se reescribe (conservando su staleSince original).
 * @param {Array<{id: string, data?: Function, [key: string]: any}>} existingDocs
 * @param {number} runTimestamp
 * @returns {Array<{id: string, staleSince: number}>}
 */
function identifyStaleTrials(existingDocs, runTimestamp) {
  const staleList = [];
  if (!Array.isArray(existingDocs)) return staleList;

  for (const doc of existingDocs) {
    const data = typeof doc.data === "function" ? doc.data() : doc;
    const id = doc.id || data.id;
    const lastSynced = data.lastSyncedAt;
    const isStale = lastSynced === undefined || lastSynced === null || lastSynced < runTimestamp;

    if (isStale && id) {
      if (data.syncStatus !== "STALE") {
        staleList.push({
          id,
          staleSince: data.staleSince || runTimestamp,
        });
      }
    }
  }
  return staleList;
}

/**
 * Ejecuta la sincronización completa y persiste en Firestore usando Firebase Admin SDK
 */
async function syncAndSaveTrials(db) {
  const errors = [];
  let trials = [];
  let truncated = false;
  const runTimestamp = Date.now();

  try {
    const fetchResult = await fetchClinicalTrialsGov();
    if (Array.isArray(fetchResult)) {
      trials = fetchResult;
    } else {
      trials = fetchResult.trials || [];
      truncated = Boolean(fetchResult.truncated);
    }
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
      const { _oncologyClassification, ...restTrial } = trial;
      const trialData = {
        ...restTrial,
        lastSyncedAt: runTimestamp,
        syncStatus: "ACTIVE",
        staleSince: FieldValue.delete(),
      };
      batch.set(docRef, trialData, { merge: true });
    }

    try {
      await batch.commit();
      savedCount += chunk.length;
    } catch (err) {
      errors.push(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`);
    }
  }

  // Marcado de ensayos obsoletos (STALE):
  // Solo si la corrida fue exitosa (sin errores) y no truncada por maxPages.
  let staleCount = 0;
  const isRunSuccessful = errors.length === 0;
  const isNotTruncated = !truncated;

  if (isRunSuccessful && isNotTruncated) {
    try {
      const allDocsSnap = await db.collection("clinical_trials").get();
      const staleToUpdate = identifyStaleTrials(allDocsSnap.docs, runTimestamp);

      for (let i = 0; i < staleToUpdate.length; i += BATCH_SIZE) {
        const chunk = staleToUpdate.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const item of chunk) {
          const docRef = db.collection("clinical_trials").doc(item.id);
          batch.update(docRef, {
            syncStatus: "STALE",
            staleSince: item.staleSince,
          });
        }

        await batch.commit();
        staleCount += chunk.length;
      }

      if (staleCount > 0) {
        console.log(`[syncClinicalTrials] ${staleCount} ensayos marcados como obsoletos (STALE).`);
      }
    } catch (err) {
      console.error("Error al marcar ensayos obsoletos como STALE:", err.message);
      errors.push(`Error al marcar obsoletos: ${err.message}`);
    }
  } else if (truncated) {
    console.warn("[syncClinicalTrials] Marcado de STALE omitido: la corrida se cortó por el límite de páginas.");
  }

  // Análisis y log de clasificación oncológica
  const nonOncologyTrials = [];
  const weakOncologyTrials = [];

  for (const trial of trials) {
    const classification = trial._oncologyClassification || classifyOncologyTrial({
      conditions: trial.conditions,
      title: trial.title,
      officialTitle: trial.officialTitle,
      keywords: trial.keywords,
    });

    if (!classification.isOncology) {
      nonOncologyTrials.push(trial);
    } else if (classification.isWeakMatch) {
      weakOncologyTrials.push({
        trial,
        matchedTerm: classification.matchedTerm || "coincidencia débil",
      });
    }
  }

  if (nonOncologyTrials.length > 0) {
    console.log(`\n=== [syncClinicalTrials] ENSAYOS NO ONCOLÓGICOS DETECTADOS (${nonOncologyTrials.length} total) ===`);
    const sampleNonOncology = nonOncologyTrials.slice(0, 100);
    sampleNonOncology.forEach((t) => {
      const conds = (t.conditions || []).join(", ") || "Sin condiciones";
      console.log(`${t.nctId || t.id} | ${t.title} | ${conds}`);
    });
  }

  if (weakOncologyTrials.length > 0) {
    console.log(`\n=== [syncClinicalTrials] ENSAYOS ONCOLÓGICOS POR COINCIDENCIA DÉBIL (${weakOncologyTrials.length} total) ===`);
    const sampleWeak = weakOncologyTrials.slice(0, 50);
    sampleWeak.forEach(({ trial: t, matchedTerm }) => {
      const conds = (t.conditions || []).join(", ") || "Sin condiciones";
      console.log(`${t.nctId || t.id} | ${t.title} | ${conds} | ${matchedTerm}`);
    });
  }

  const cordobaCount = trials.filter((t) => t.hasCordobaCenter).length;

  return {
    success: errors.length === 0,
    totalFetched: trials.length,
    totalSaved: savedCount,
    staleCount,
    cordobaCount,
    nonOncologyCount: nonOncologyTrials.length,
    weakOncologyCount: weakOncologyTrials.length,
    truncated,
    timestamp: runTimestamp,
    errors: errors.length > 0 ? errors : null,
  };
}

module.exports = {
  fetchClinicalTrialsGov,
  syncAndSaveTrials,
  mapStudyToClinicalTrial,
  identifyStaleTrials,
  classifyOncologyTrial,
  isOncologyTrial,
};
