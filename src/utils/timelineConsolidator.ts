/**
 * timelineConsolidator.ts
 *
 * Motor de consolidación, fusión, deduplicación y ordenamiento cronológico
 * de eventos clínicos extraídos progresivamente a lo largo de bloques múltiples.
 *
 * Mantiene intactas las categorías, formato de fechas y estructura clínica requerida.
 */

export interface ClinicalEvent {
  date: string;
  professional: string;
  category: string;
  note: string;
  isKey: boolean;
  detail?: string;
  sourceChunk?: string;
}

// Mapeo de categorías clínicas canónicas del sistema
const CANONICAL_CATEGORIES: Record<string, string> = {
  consulta: 'Consulta',
  consultas: 'Consulta',
  interconsulta: 'Consulta',
  clinica: 'Consulta',
  imagen: 'Imagen',
  imagenes: 'Imagen',
  radiologia: 'Imagen',
  tac: 'Imagen',
  rmn: 'Imagen',
  pet: 'Imagen',
  ecografia: 'Imagen',
  lab: 'Lab',
  laboratorio: 'Lab',
  laboratorios: 'Lab',
  bioquimica: 'Lab',
  cirugia: 'Cirugía',
  cirugias: 'Cirugía',
  quirurgico: 'Cirugía',
  procedimiento: 'Cirugía',
  quimio: 'Quimio',
  quimioterapia: 'Quimio',
  inmunoterapia: 'Quimio',
  terapia: 'Quimio',
  sistemico: 'Quimio',
  radio: 'Radio',
  radioterapia: 'Radio',
  radioterapico: 'Radio',
  evolucion: 'Evolución',
  evoluciones: 'Evolución',
  control: 'Evolución',
  seguimiento: 'Evolución',
  diagnostico: 'Diagnóstico',
  'anatomia patologica': 'Anatomía Patológica',
  biopsia: 'Anatomía Patológica',
  patologia: 'Anatomía Patológica',
};

/**
 * Normaliza la categoría manteniendo la denominación clínica esperada por la interfaz.
 */
export function normalizeEventCategory(category: string | undefined): string {
  if (!category || typeof category !== 'string') return 'General';
  const clean = category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  for (const [key, canonical] of Object.entries(CANONICAL_CATEGORIES)) {
    if (clean === key || clean.startsWith(key) || clean.includes(key)) {
      return canonical;
    }
  }

  // Si ya tiene mayúscula inicial razonable, conservarla
  return category.trim() || 'General';
}

/**
 * Normaliza cualquier formato de fecha a DD/MM/YYYY o "S/F" si no hay fecha exacta.
 */
export function normalizeEventDate(dateStr: string | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return 'S/F';
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.toUpperCase() === 'S/F' || trimmed.toLowerCase() === 'sin fecha') {
    return 'S/F';
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${day}/${month}/${year}`;
  }

  // YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

/**
 * Convierte una fecha a timestamp numérico para ordenamiento cronológico.
 * Las fechas S/F se ordenan con timestamp 0 (al inicio o final según contexto).
 */
export function parseEventDateToTimestamp(dateStr: string): number {
  if (!dateStr || dateStr === 'S/F') return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day).getTime();
    }
  }
  return 0;
}

const CLINICAL_STOPWORDS = new Set([
  'paciente', 'presenta', 'refiere', 'consulta', 'informe', 'estudio', 'control',
  'realiza', 'servicio', 'medico', 'oncologia', 'clinica', 'general', 'evaluacion',
  'con', 'sin', 'por', 'para', 'del', 'los', 'las', 'una', 'uno', 'que', 'sobre'
]);

/**
 * Limpia y tokeniza texto para comparar similitud semántica entre eventos.
 */
function tokenizeText(text: string): Set<string> {
  const clean = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean
    .split(/\s+/)
    .filter(t => t.length > 2 && !CLINICAL_STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Calcula la similitud de Jaccard y conteo de palabras clave compartidas.
 */
function compareEventTokens(setA: Set<string>, setB: Set<string>): { jaccard: number; sharedCount: number } {
  if (setA.size === 0 || setB.size === 0) return { jaccard: 0, sharedCount: 0 };
  let sharedCount = 0;
  for (const token of setA) {
    if (setB.has(token)) sharedCount++;
  }
  const union = setA.size + setB.size - sharedCount;
  const jaccard = union === 0 ? 0 : sharedCount / union;
  return { jaccard, sharedCount };
}

/**
 * Calcula un puntaje de completitud clínica del evento para desempatar
 * o fusionar el más informativo.
 */
function getClinicalRichnessScore(ev: ClinicalEvent): number {
  let score = 0;
  if (ev.isKey) score += 100;
  if (ev.detail && ev.detail.trim().length > 0) score += ev.detail.length * 2;
  if (ev.note) score += ev.note.length;
  if (ev.professional && ev.professional !== 'N/A' && ev.professional !== 'General') score += 25;
  if (ev.date && ev.date !== 'S/F') score += 50;
  return score;
}

/**
 * Fusiona dos eventos que representan el mismo acontecimiento clínico,
 * preservando los detalles más exhaustivos.
 */
function mergeTwoEvents(existing: ClinicalEvent, incoming: ClinicalEvent): ClinicalEvent {
  const existingScore = getClinicalRichnessScore(existing);
  const incomingScore = getClinicalRichnessScore(incoming);
  const base = incomingScore > existingScore ? incoming : existing;
  const other = incomingScore > existingScore ? existing : incoming;

  // Unir detalles si uno tiene información que el otro no
  let mergedDetail = base.detail || '';
  if (other.detail && other.detail !== base.detail) {
    if (!mergedDetail) {
      mergedDetail = other.detail;
    } else if (!mergedDetail.toLowerCase().includes(other.detail.substring(0, 25).toLowerCase())) {
      mergedDetail = `${mergedDetail} | ${other.detail}`;
    }
  }

  return {
    date: base.date !== 'S/F' ? base.date : other.date,
    professional: base.professional !== 'N/A' ? base.professional : other.professional,
    category: base.category,
    note: base.note.length >= other.note.length ? base.note : other.note,
    isKey: base.isKey || other.isKey,
    ...(mergedDetail ? { detail: mergedDetail } : {}),
  };
}

/**
 * Normaliza un evento crudo de Gemini al formato ClinicalEvent.
 */
export function normalizeRawEvent(raw: any): ClinicalEvent | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawNote = raw.note || raw.nota || raw.descripcion || raw.description || raw.resumen || '';
  if (!rawNote || typeof rawNote !== 'string' || !rawNote.trim()) {
    return null;
  }

  const date = normalizeEventDate(raw.date || raw.fecha);
  const professional = (raw.professional || raw.profesional || raw.medico || 'N/A').trim();
  const category = normalizeEventCategory(raw.category || raw.categoria || raw.tipo);
  const isKey = !!raw.isKey || !!raw.clave || !!raw.importante || !!raw.key;
  const detail = typeof raw.detail === 'string' && raw.detail.trim() ? raw.detail.trim() : (typeof raw.detalle === 'string' && raw.detalle.trim() ? raw.detalle.trim() : undefined);

  return {
    date,
    professional: professional || 'N/A',
    category,
    note: rawNote.trim(),
    isKey,
    ...(detail ? { detail: detail } : {}),
  };
}

/**
 * Consolidación y deduplicación avanzada de eventos provenientes de múltiples bloques.
 *
 * Reglas de consolidación:
 * 1. Mismo día y misma categoría: se compara similitud semántica. Si describen el mismo
 *    suceso, se fusionan quedándose con la versión más detallada. Si son sucesos distintos
 *    (ej. dos drogas de quimio o dos cirugías distintas), se conservan ambos.
 * 2. Eventos con S/F: si existe una versión con fecha exacta del mismo acontecimiento,
 *    se prioriza la versión con fecha y se descarta el S/F duplicado.
 * 3. Ordenamiento cronológico estricto de más antiguo a más reciente.
 */
export function consolidateTimelineEvents(
  existingEvents: ClinicalEvent[],
  incomingEvents: (ClinicalEvent | any)[]
): ClinicalEvent[] {
  // Normalizar todos los eventos entrantes
  const normalizedIncoming: ClinicalEvent[] = [];
  for (const item of incomingEvents) {
    const norm = (item.note && item.category) ? (item as ClinicalEvent) : normalizeRawEvent(item);
    if (norm) normalizedIncoming.push(norm);
  }

  const allEvents = [...existingEvents, ...normalizedIncoming];
  if (allEvents.length === 0) return [];

  const consolidated: ClinicalEvent[] = [];

  for (const event of allEvents) {
    const eventFullText = `${event.note} ${event.detail || ''}`;
    const eventTokens = tokenizeText(eventFullText);
    let matchedIndex = -1;

    for (let i = 0; i < consolidated.length; i++) {
      const existing = consolidated[i];

      // 1. Mismo día exacto y misma categoría
      if (event.date !== 'S/F' && existing.date === event.date && existing.category === event.category) {
        const existingFullText = `${existing.note} ${existing.detail || ''}`;
        const existingTokens = tokenizeText(existingFullText);
        const { jaccard, sharedCount } = compareEventTokens(eventTokens, existingTokens);

        const normA = event.note.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normB = existing.note.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Si comparten 2 o más palabras clave clínicas, o jaccard >= 0.22, o prefijo directo
        if (
          jaccard >= 0.22 ||
          sharedCount >= 2 ||
          normA.includes(normB.substring(0, 30)) ||
          normB.includes(normA.substring(0, 30))
        ) {
          matchedIndex = i;
          break;
        }
      }

      // 2. Un evento tiene S/F y el otro tiene fecha pero describen exactamente el mismo hito clave
      if (
        (event.date === 'S/F' || existing.date === 'S/F') &&
        existing.category === event.category &&
        (event.isKey || existing.isKey)
      ) {
        const existingFullText = `${existing.note} ${existing.detail || ''}`;
        const existingTokens = tokenizeText(existingFullText);
        const { jaccard, sharedCount } = compareEventTokens(eventTokens, existingTokens);
        if (jaccard >= 0.4 || sharedCount >= 3) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex >= 0) {
      // Fusionar con el evento existente
      consolidated[matchedIndex] = mergeTwoEvents(consolidated[matchedIndex], event);
    } else {
      consolidated.push(event);
    }
  }

  // Ordenamiento cronológico: S/F primero (o al inicio como antecedentes), luego orden ascendente de fecha
  return consolidated.sort((a, b) => {
    const timeA = parseEventDateToTimestamp(a.date);
    const timeB = parseEventDateToTimestamp(b.date);
    if (timeA === timeB) return 0;
    if (timeA === 0) return -1;
    if (timeB === 0) return 1;
    return timeA - timeB;
  });
}
