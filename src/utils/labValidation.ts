/**
 * labValidation.ts
 *
 * Módulo de validación de plausibilidad clínica para resultados de laboratorio.
 *
 * REGLAS FUNDAMENTALES:
 * 1. Interpreta correctamente el valor junto con su unidad de medida.
 * 2. Descarta ÚNICAMENTE valores claramente imposibles o producto evidente de un error de extracción/OCR.
 * 3. NO descarta valores anormales pero clínicamente posibles (ej. patologías oncológicas críticas,
 *    toxicidades severas, pancitopenias, leucemias hiperleucocitarias, insuficiencia renal aguda).
 * 4. NO modifica ni altera el valor ni la unidad original.
 * 5. NO inventa valores.
 * 6. Los valores descartados no deben utilizarse en gráficos, tendencias ni cálculos.
 */

// ── Normalización de Parámetros de Laboratorio ─────────────────
export const normalizeLabTestName = (rawName: string): string => {
  if (!rawName) return '';
  const name = rawName.trim();
  const lower = name.toLowerCase();

  // Hemograma
  if (/^(hb|hgb|hemog|hemo|hg)$/i.test(lower) || lower.includes('hemoglobina')) return 'Hemoglobina';
  if (/^(hto|hct)$/i.test(lower) || lower.includes('hematocrito')) return 'Hematocrito';
  if (/^(gb|g\.b\.|wbc|blancos)$/i.test(lower) || lower.includes('leucocito') || lower.includes('glóbulos blancos') || lower.includes('globulos blancos')) return 'Leucocitos';
  if (/^(plaq|plt|platelets)$/i.test(lower) || lower.includes('plaqueta')) return 'Plaquetas';
  if (/^(neut|neu|anc|pmn|segmentados)$/i.test(lower) || lower.includes('neutrófilo') || lower.includes('neutrofilo')) return 'Neutrófilos';

  // Función renal
  if (/^(cr|crea|creat)$/i.test(lower) || lower.includes('creatinina')) return 'Creatinina';
  if (/^(bun|azoemia)$/i.test(lower) || lower.includes('urea')) return 'Urea';

  // Función hepática
  if (/^(bt|bil t|bil total)$/i.test(lower) || lower.includes('bilirrubina total')) return 'Bilirrubina total';
  if (lower.includes('bilirrubina directa')) return 'Bilirrubina directa';
  if (lower.includes('bilirrubina indirecta')) return 'Bilirrubina indirecta';
  if (/^(got|ast)$/i.test(lower)) return 'GOT';
  if (/^(gpt|alt)$/i.test(lower)) return 'GPT';
  if (/^(fal|alp)$/i.test(lower) || lower.includes('fosfatasa alcalina')) return 'FAL';
  if (/^(ggt)$/i.test(lower)) return 'GGT';
  if (lower.includes('albúmina') || lower.includes('albumina')) return 'Albúmina';

  // Electrolitos
  if (/^(na|sodio)$/i.test(lower)) return 'Sodio';
  if (/^(k|potasio)$/i.test(lower)) return 'Potasio';
  if (/^(ca|calcio)$/i.test(lower)) return 'Calcio';
  if (/^(mg|magnesio)$/i.test(lower)) return 'Magnesio';

  // Coagulación
  if (/^(inr)$/i.test(lower)) return 'INR';
  if (/^(ttpa|kptt)$/i.test(lower)) return 'TTPA';
  if (lower.includes('fibrinógeno') || lower.includes('fibrinogeno')) return 'Fibrinógeno';

  // Marcadores tumorales
  if (/^(cea)$/i.test(lower) || lower.includes('antígeno carcinoembrionario') || lower.includes('antigeno carcinoembrionario')) return 'CEA';
  if (/^(ca 19-9|ca19-9|ca 19.9|ca19.9)$/i.test(lower)) return 'CA 19-9';
  if (/^(ca 125|ca125)$/i.test(lower)) return 'CA 125';
  if (/^(ca 15-3|ca15-3|ca 15.3|ca15.3)$/i.test(lower)) return 'CA 15-3';
  if (/^(psa)$/i.test(lower)) return 'PSA';
  if (/^(afp)$/i.test(lower) || lower.includes('alfafetoproteína') || lower.includes('alfafetoproteina')) return 'AFP';
  if (/^(beta-hcg|b-hcg|bhcg|β-hcg|b-h.c.g.)$/i.test(lower)) return 'β-HCG';
  if (lower.includes('calcitonina')) return 'Calcitonina';
  if (lower.includes('tireoglobulina')) return 'Tireoglobulina';

  // Inflamatorios y otros
  if (/^(pcr|crp)$/i.test(lower) || lower.includes('proteína c reactiva') || lower.includes('proteina c reactiva')) return 'PCR';
  if (/^(vsg|esr)$/i.test(lower) || lower.includes('eritrosedimentación') || lower.includes('eritrosedimentacion')) return 'VSG';
  if (/^(ldh)$/i.test(lower) || lower.includes('lactato deshidrogenasa')) return 'LDH';
  if (/^(tsh)$/i.test(lower)) return 'TSH';
  if (/^(glucemia|glucosa)$/i.test(lower)) return 'Glucemia';
  if (lower.includes('ácido úrico') || lower.includes('acido urico')) return 'Ácido úrico';

  return name;
};

// ── Normalización de Unidades ──────────────────────────────────
export const normalizeLabUnit = (rawUnit?: string): string => {
  if (!rawUnit) return '';
  return rawUnit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[µμ]/g, 'u')
    .replace(/[\^·*]/g, '');
};

// ── Validación de Plausibilidad Clínica de Laboratorio ─────────
export const isPlausibleLabResult = (
  test: string,
  value: number | string,
  unit?: string
): boolean => {
  if (value === null || value === undefined || value === '') return false;

  const numVal = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(numVal) || !isFinite(numVal)) return false;

  const normTest = normalizeLabTestName(test || '');
  const normUnit = normalizeLabUnit(unit);

  switch (normTest) {
    // ─────────────────────────────────────────
    // 1. HEMOGRAMA
    // ─────────────────────────────────────────
    case 'Hemoglobina': {
      // g/dL: rango plausible 1.5 - 26.0 g/dL (ej: 111 g/dL es imposible)
      if (normUnit.includes('g/dl') || normUnit.includes('gr/dl') || normUnit === 'g%' || normUnit.includes('g/100ml')) {
        return numVal >= 1.5 && numVal <= 26.0;
      }
      // g/L: rango plausible 15 - 260 g/L (ej: 111 g/L = 11.1 g/dL, perfectamente válido)
      if (normUnit.includes('g/l') || normUnit.includes('gr/l')) {
        return numVal >= 15.0 && numVal <= 260.0;
      }
      // mmol/L: rango plausible 0.9 - 16.5 mmol/L
      if (normUnit.includes('mmol/l')) {
        return numVal >= 0.9 && numVal <= 16.5;
      }
      // Sin unidad o unidad no estándar
      return (numVal >= 1.5 && numVal <= 26.0) || (numVal >= 15.0 && numVal <= 260.0) || (numVal >= 0.9 && numVal <= 16.5);
    }

    case 'Hematocrito': {
      // Porcentaje: 5% a 80%
      if (normUnit.includes('%') || normUnit.includes('pct') || normUnit.includes('vol%')) {
        return numVal >= 5.0 && numVal <= 80.0;
      }
      // Fracción/decimal L/L: 0.05 a 0.80
      if (normUnit.includes('l/l') || normUnit.includes('ratio')) {
        return numVal >= 0.05 && numVal <= 0.80;
      }
      // Sin unidad
      return (numVal >= 5.0 && numVal <= 80.0) || (numVal >= 0.05 && numVal <= 0.80);
    }

    case 'Leucocitos': {
      // En miles (x10^3/uL, k/uL, G/L, x10^9/L, mil/mm3, /nL): 0.01 a 800.0 (aplasia extrema a leucemias)
      if (
        normUnit.includes('103') ||
        normUnit.includes('10e3') ||
        normUnit.includes('k/') ||
        normUnit.includes('mil') ||
        normUnit.includes('g/l') ||
        normUnit.includes('109') ||
        normUnit.includes('10e9') ||
        normUnit.includes('/nl')
      ) {
        return numVal >= 0.01 && numVal <= 800.0;
      }
      // En unidades absolutas (/mm3, /uL, cel/uL): 10 a 800,000
      if (normUnit.includes('/mm3') || normUnit.includes('/ul') || normUnit.includes('cel') || normUnit.includes('elem')) {
        return numVal >= 10 && numVal <= 800000;
      }
      // Sin unidad
      return (numVal >= 0.01 && numVal <= 800.0) || (numVal >= 800 && numVal <= 800000);
    }

    case 'Neutrófilos': {
      // Porcentaje: 0% a 100%
      if (normUnit.includes('%') || normUnit.includes('pct')) {
        return numVal >= 0 && numVal <= 100.0;
      }
      // En miles (x10^3/uL, k/uL, etc.): 0 a 700.0
      if (
        normUnit.includes('103') ||
        normUnit.includes('10e3') ||
        normUnit.includes('k/') ||
        normUnit.includes('mil') ||
        normUnit.includes('g/l') ||
        normUnit.includes('109') ||
        normUnit.includes('10e9') ||
        normUnit.includes('/nl')
      ) {
        return numVal >= 0 && numVal <= 700.0;
      }
      // En unidades absolutas: 0 a 700,000
      if (normUnit.includes('/mm3') || normUnit.includes('/ul') || normUnit.includes('cel')) {
        return numVal >= 0 && numVal <= 700000;
      }
      // Sin unidad
      return (numVal >= 0 && numVal <= 100.0) || (numVal >= 0 && numVal <= 700.0) || (numVal >= 700 && numVal <= 700000);
    }

    case 'Plaquetas': {
      // En miles (x10^3/uL, k/uL, mil/mm3, G/L): 0 a 4,000.0
      if (
        normUnit.includes('103') ||
        normUnit.includes('10e3') ||
        normUnit.includes('k/') ||
        normUnit.includes('mil') ||
        normUnit.includes('g/l') ||
        normUnit.includes('109') ||
        normUnit.includes('10e9') ||
        normUnit.includes('/nl')
      ) {
        return numVal >= 0 && numVal <= 4000.0;
      }
      // En unidades absolutas (/mm3, /uL): 0 a 4,000,000
      if (normUnit.includes('/mm3') || normUnit.includes('/ul') || normUnit.includes('cel')) {
        return numVal >= 0 && numVal <= 4000000;
      }
      // Sin unidad
      return (numVal >= 0 && numVal <= 4000.0) || (numVal >= 4000 && numVal <= 4000000);
    }

    // ─────────────────────────────────────────
    // 2. FUNCIÓN RENAL
    // ─────────────────────────────────────────
    case 'Creatinina': {
      // mg/dL: 0.1 a 35.0 mg/dL
      if (normUnit.includes('mg/dl') || normUnit.includes('mg%') || normUnit.includes('mg/100ml')) {
        return numVal >= 0.1 && numVal <= 35.0;
      }
      // umol/L o µmol/L: 8 a 3,500 umol/L
      if (normUnit.includes('umol/l') || normUnit.includes('mcmol/l')) {
        return numVal >= 8.0 && numVal <= 3500.0;
      }
      // mg/L: 1.0 a 350.0 mg/L
      if (normUnit.includes('mg/l')) {
        return numVal >= 1.0 && numVal <= 350.0;
      }
      // mmol/L: 0.008 a 3.5 mmol/L
      if (normUnit.includes('mmol/l')) {
        return numVal >= 0.008 && numVal <= 3.5;
      }
      // Sin unidad
      return (numVal >= 0.1 && numVal <= 35.0) || (numVal >= 35.0 && numVal <= 3500.0);
    }

    case 'Urea': {
      // mg/dL: 2.0 a 600.0 mg/dL
      if (normUnit.includes('mg/dl') || normUnit.includes('mg%')) {
        return numVal >= 2.0 && numVal <= 600.0;
      }
      // g/L: 0.02 a 6.0 g/L
      if (normUnit.includes('g/l') || normUnit.includes('gr/l')) {
        return numVal >= 0.02 && numVal <= 6.0;
      }
      // mmol/L: 0.3 a 100.0 mmol/L
      if (normUnit.includes('mmol/l')) {
        return numVal >= 0.3 && numVal <= 100.0;
      }
      // Sin unidad
      return (numVal >= 0.02 && numVal <= 6.0) || (numVal >= 2.0 && numVal <= 600.0);
    }

    // ─────────────────────────────────────────
    // 3. FUNCIÓN HEPÁTICA
    // ─────────────────────────────────────────
    case 'Bilirrubina total':
    case 'Bilirrubina directa':
    case 'Bilirrubina indirecta': {
      // mg/dL: 0.01 a 90.0 mg/dL
      if (normUnit.includes('mg/dl') || normUnit.includes('mg%')) {
        return numVal >= 0.01 && numVal <= 90.0;
      }
      // umol/L: 0.17 a 1,500.0 umol/L
      if (normUnit.includes('umol/l') || normUnit.includes('mcmol/l')) {
        return numVal >= 0.17 && numVal <= 1500.0;
      }
      // mg/L: 0.1 a 900.0 mg/L
      if (normUnit.includes('mg/l')) {
        return numVal >= 0.1 && numVal <= 900.0;
      }
      // Sin unidad
      return (numVal >= 0.01 && numVal <= 90.0) || (numVal > 90.0 && numVal <= 1500.0);
    }

    case 'GOT':
    case 'GPT': {
      // U/L o UI/L: 1 a 35,000 U/L (ej. hepatitis isquémica / tóxica severa)
      if (normUnit.includes('u/l') || normUnit.includes('ui/l') || normUnit.includes('iu/l')) {
        return numVal >= 1.0 && numVal <= 35000.0;
      }
      // ukat/L: 0.01 a 600.0
      if (normUnit.includes('ukat/l')) {
        return numVal >= 0.01 && numVal <= 600.0;
      }
      // Sin unidad
      return (numVal >= 1.0 && numVal <= 35000.0) || (numVal >= 0.01 && numVal <= 600.0);
    }

    case 'FAL': {
      // U/L: 5 a 15,000 U/L
      if (normUnit.includes('u/l') || normUnit.includes('ui/l') || normUnit.includes('iu/l')) {
        return numVal >= 5.0 && numVal <= 15000.0;
      }
      // ukat/L: 0.05 a 250.0
      if (normUnit.includes('ukat/l')) {
        return numVal >= 0.05 && numVal <= 250.0;
      }
      // Sin unidad
      return numVal >= 5.0 && numVal <= 15000.0;
    }

    case 'GGT': {
      // U/L: 1 a 8,000 U/L
      if (normUnit.includes('u/l') || normUnit.includes('ui/l') || normUnit.includes('iu/l')) {
        return numVal >= 1.0 && numVal <= 8000.0;
      }
      if (normUnit.includes('ukat/l')) {
        return numVal >= 0.01 && numVal <= 150.0;
      }
      return numVal >= 1.0 && numVal <= 8000.0;
    }

    case 'Albúmina': {
      // g/dL: 0.5 a 8.0 g/dL
      if (normUnit.includes('g/dl') || normUnit.includes('g%')) {
        return numVal >= 0.5 && numVal <= 8.0;
      }
      // g/L: 5.0 a 80.0 g/L
      if (normUnit.includes('g/l') || normUnit.includes('gr/l')) {
        return numVal >= 5.0 && numVal <= 80.0;
      }
      // umol/L: 70 a 1200 umol/L
      if (normUnit.includes('umol/l')) {
        return numVal >= 70 && numVal <= 1200;
      }
      // Sin unidad
      return (numVal >= 0.5 && numVal <= 8.0) || (numVal >= 8.0 && numVal <= 80.0);
    }

    // ─────────────────────────────────────────
    // 4. ELECTROLITOS
    // ─────────────────────────────────────────
    case 'Sodio': {
      // mEq/L o mmol/L: 85 a 200 mEq/L
      if (normUnit.includes('meq/l') || normUnit.includes('mmol/l') || !normUnit) {
        return numVal >= 85.0 && numVal <= 200.0;
      }
      return numVal >= 85.0 && numVal <= 200.0;
    }

    case 'Potasio': {
      // mEq/L o mmol/L: 0.8 a 14.0 mEq/L
      if (normUnit.includes('meq/l') || normUnit.includes('mmol/l') || !normUnit) {
        return numVal >= 0.8 && numVal <= 14.0;
      }
      return numVal >= 0.8 && numVal <= 14.0;
    }

    case 'Calcio': {
      // mg/dL (calcio total): 2.0 a 25.0 mg/dL
      if (normUnit.includes('mg/dl') || normUnit.includes('mg%')) {
        return numVal >= 2.0 && numVal <= 25.0;
      }
      // mmol/L (iónico o total): 0.2 a 6.5 mmol/L
      if (normUnit.includes('mmol/l')) {
        return numVal >= 0.2 && numVal <= 6.5;
      }
      // mEq/L: 0.5 a 13.0 mEq/L
      if (normUnit.includes('meq/l')) {
        return numVal >= 0.5 && numVal <= 13.0;
      }
      // Sin unidad
      return numVal >= 0.2 && numVal <= 25.0;
    }

    case 'Magnesio': {
      // mg/dL: 0.2 a 15.0 mg/dL
      if (normUnit.includes('mg/dl')) {
        return numVal >= 0.2 && numVal <= 15.0;
      }
      // mEq/L: 0.15 a 12.0 mEq/L
      if (normUnit.includes('meq/l')) {
        return numVal >= 0.15 && numVal <= 12.0;
      }
      // mmol/L: 0.08 a 6.0 mmol/L
      if (normUnit.includes('mmol/l')) {
        return numVal >= 0.08 && numVal <= 6.0;
      }
      // Sin unidad
      return numVal >= 0.08 && numVal <= 15.0;
    }

    // ─────────────────────────────────────────
    // 5. COAGULACIÓN
    // ─────────────────────────────────────────
    case 'INR': {
      // Ratio / unitless: 0.4 a 30.0
      if (normUnit.includes('%') || normUnit.includes('pct')) {
        return numVal >= 1.0 && numVal <= 150.0;
      }
      return numVal >= 0.4 && numVal <= 30.0;
    }

    case 'TTPA': {
      // Segundos: 8 a 300 segundos
      if (normUnit.includes('seg') || normUnit.includes('sec') || normUnit === 's') {
        return numVal >= 8.0 && numVal <= 300.0;
      }
      // Ratio: 0.3 a 10.0
      if (normUnit.includes('ratio')) {
        return numVal >= 0.3 && numVal <= 10.0;
      }
      // Sin unidad
      return (numVal >= 0.3 && numVal <= 10.0) || (numVal >= 8.0 && numVal <= 300.0);
    }

    case 'Fibrinógeno': {
      // mg/dL: 5 a 3,000 mg/dL
      if (normUnit.includes('mg/dl')) {
        return numVal >= 5.0 && numVal <= 3000.0;
      }
      // g/L: 0.05 a 30.0 g/L
      if (normUnit.includes('g/l') || normUnit.includes('gr/l')) {
        return numVal >= 0.05 && numVal <= 30.0;
      }
      // Sin unidad
      return (numVal >= 0.05 && numVal <= 30.0) || (numVal >= 30.0 && numVal <= 3000.0);
    }

    // ─────────────────────────────────────────
    // 6. MARCADORES TUMORALES
    // ─────────────────────────────────────────
    case 'CEA': {
      return numVal >= 0 && numVal <= 500000.0;
    }
    case 'CA 19-9': {
      return numVal >= 0 && numVal <= 2000000.0;
    }
    case 'CA 125': {
      return numVal >= 0 && numVal <= 2000000.0;
    }
    case 'CA 15-3': {
      return numVal >= 0 && numVal <= 500000.0;
    }
    case 'PSA': {
      return numVal >= 0 && numVal <= 200000.0;
    }
    case 'AFP': {
      return numVal >= 0 && numVal <= 5000000.0;
    }
    case 'β-HCG': {
      return numVal >= 0 && numVal <= 10000000.0;
    }
    case 'Calcitonina': {
      return numVal >= 0 && numVal <= 500000.0;
    }
    case 'Tireoglobulina': {
      return numVal >= 0 && numVal <= 500000.0;
    }

    // ─────────────────────────────────────────
    // 7. INFLAMATORIOS Y OTROS
    // ─────────────────────────────────────────
    case 'PCR': {
      // mg/dL: 0 a 200 mg/dL
      if (normUnit.includes('mg/dl')) {
        return numVal >= 0 && numVal <= 200.0;
      }
      // mg/L: 0 a 2,000 mg/L
      return numVal >= 0 && numVal <= 2000.0;
    }

    case 'VSG': {
      return numVal >= 0 && numVal <= 250.0;
    }

    case 'LDH': {
      if (normUnit.includes('ukat/l')) {
        return numVal >= 0.1 && numVal <= 1700.0;
      }
      return numVal >= 10.0 && numVal <= 100000.0;
    }

    case 'TSH': {
      return numVal >= 0 && numVal <= 1000.0;
    }

    case 'Glucemia': {
      if (normUnit.includes('mg/dl')) {
        return numVal >= 5.0 && numVal <= 3000.0;
      }
      if (normUnit.includes('mmol/l')) {
        return numVal >= 0.3 && numVal <= 170.0;
      }
      if (normUnit.includes('g/l') || normUnit.includes('gr/l')) {
        return numVal >= 0.05 && numVal <= 30.0;
      }
      return (numVal >= 0.05 && numVal <= 30.0) || (numVal >= 5.0 && numVal <= 3000.0);
    }

    case 'Ácido úrico': {
      if (normUnit.includes('mg/dl')) {
        return numVal >= 0.2 && numVal <= 50.0;
      }
      if (normUnit.includes('umol/l') || normUnit.includes('mcmol/l')) {
        return numVal >= 10.0 && numVal <= 3000.0;
      }
      if (normUnit.includes('mg/l')) {
        return numVal >= 2.0 && numVal <= 500.0;
      }
      return (numVal >= 0.2 && numVal <= 50.0) || (numVal >= 10.0 && numVal <= 3000.0);
    }

    // ─────────────────────────────────────────
    // FALLBACK GENERAL PARA OTROS ANALITOS
    // ─────────────────────────────────────────
    default: {
      // Rechazar números negativos y valores de desbordamiento imposibles (> 10,000,000)
      return numVal >= 0 && numVal <= 10000000.0;
    }
  }
};

// ── Validador de objeto LabResult completo ─────────────────────
export const validateLabResult = (result: {
  test?: string;
  value?: number | string;
  unit?: string;
}): boolean => {
  if (!result || !result.test || result.value === undefined || result.value === null) {
    return false;
  }
  return isPlausibleLabResult(result.test, result.value, result.unit);
};
