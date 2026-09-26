import { describe, it, expect } from 'vitest';
import { evaluateRecistResponse, ImagingStudy, parseSafeMeasurement } from '../src/components/ImagingPanel';

describe('Evaluación RECIST 1.1 e iRECIST (evaluateRecistResponse)', () => {
  const createStudy = (overrides: Partial<ImagingStudy>): ImagingStudy => ({
    id: `study-${Math.random()}`,
    type: 'TC',
    date: '01/01/2024',
    bodyRegion: 'Tórax, abdomen y pelvis',
    treatment: 'Quimioterapia estándar',
    targetLesions: [],
    nonTargetLesions: [],
    newLesions: false,
    extractedAt: Date.now(),
    ...overrides,
  });

  describe('1. Datos insuficientes', () => {
    it('retorna información insuficiente si el array de estudios está vacío', () => {
      const result = evaluateRecistResponse([]);
      expect(result.criterion).toBe('RECIST 1.1');
      expect(result.status).toBe('Información insuficiente para evaluar RECIST');
      expect(result.insufficientData).toBe(true);
      expect(result.badgeColor).toBe('gray');
    });

    it('retorna información insuficiente si no hay lesiones diana, ni no diana, ni nuevas lesiones', () => {
      const study = createStudy({
        date: '01/01/2024',
        targetLesions: [],
        nonTargetLesions: [],
        newLesions: false,
      });
      const result = evaluateRecistResponse([study]);
      expect(result.status).toBe('Información insuficiente para cuantificar RECIST');
      expect(result.insufficientData).toBe(true);
    });
  });

  describe('2. Estudio basal único', () => {
    it('informa Estudio Basal Registrado cuando existe un solo estudio con lesiones diana', () => {
      const study = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        targetLesions: [{ location: 'Hígado segmento VII', measurement: 40 }],
      });
      const result = evaluateRecistResponse([study]);
      expect(result.status).toBe('Estudio Basal Registrado');
      expect(result.baselineSum).toBe(40);
      expect(result.latestSum).toBe(40);
      expect(result.nadirSum).toBe(40);
      expect(result.pctVsBaseline).toBe(0);
      expect(result.pctVsNadir).toBe(0);
      expect(result.badgeColor).toBe('gray');
    });
  });

  describe('3. Respuesta Completa (CR)', () => {
    it('clasifica como CR en RECIST 1.1 cuando la suma de lesiones diana es 0 mm', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        targetLesions: [{ location: 'Hígado', measurement: 50 }],
      });
      const followUp = createStudy({
        date: '01/04/2024',
        targetLesions: [],
        newLesions: false,
      });
      const result = evaluateRecistResponse([baseline, followUp]);
      expect(result.criterion).toBe('RECIST 1.1');
      expect(result.status).toBe('🟢 Respuesta Completa (CR)');
      expect(result.badgeColor).toBe('green');
      expect(result.latestSum).toBe(0);
      expect(result.pctVsBaseline).toBe(-100);
    });
  });

  describe('4. Respuesta Parcial (PR)', () => {
    it('clasifica como PR cuando hay reducción >= 30% respecto del basal', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        targetLesions: [
          { location: 'Hígado seg IV', measurement: 40 },
          { location: 'Hígado seg VII', measurement: 30 },
        ], // suma = 70 mm
      });
      const followUp = createStudy({
        date: '01/04/2024',
        targetLesions: [
          { location: 'Hígado seg IV', measurement: 26 },
          { location: 'Hígado seg VII', measurement: 19 },
        ], // suma = 45 mm (-35.7% vs 70 mm)
      });
      const result = evaluateRecistResponse([baseline, followUp]);
      expect(result.criterion).toBe('RECIST 1.1');
      expect(result.status).toBe('🟢 Respuesta Parcial (PR)');
      expect(result.badgeColor).toBe('green');
      expect(result.baselineSum).toBe(70);
      expect(result.latestSum).toBe(45);
      expect(result.pctVsBaseline).toBeCloseTo(-35.71, 1);
    });
  });

  describe('5. Enfermedad Estable (SD)', () => {
    it('clasifica como SD cuando la variación no alcanza ni PR (<= -30%) ni PD (>= +20% y >= 5mm)', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        targetLesions: [
          { location: 'Hígado seg IV', measurement: 40 },
          { location: 'Hígado seg VII', measurement: 30 },
        ], // suma = 70 mm
      });
      const followUp = createStudy({
        date: '01/04/2024',
        targetLesions: [
          { location: 'Hígado seg IV', measurement: 35 },
          { location: 'Hígado seg VII', measurement: 25 },
        ], // suma = 60 mm (-14.3% vs 70 mm)
      });
      const result = evaluateRecistResponse([baseline, followUp]);
      expect(result.criterion).toBe('RECIST 1.1');
      expect(result.status).toBe('🟡 Enfermedad Estable (SD)');
      expect(result.badgeColor).toBe('yellow');
      expect(result.baselineSum).toBe(70);
      expect(result.latestSum).toBe(60);
      expect(result.pctVsBaseline).toBeCloseTo(-14.28, 1);
    });
  });

  describe('6. Progresión de Enfermedad (PD)', () => {
    it('clasifica como PD por incremento >= 20% y >= 5 mm respecto del nadir', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        targetLesions: [{ location: 'Hígado', measurement: 70 }],
      });
      const nadirStudy = createStudy({
        date: '01/04/2024',
        targetLesions: [{ location: 'Hígado', measurement: 43 }], // Nadir = 43 mm
      });
      const progressionStudy = createStudy({
        date: '01/07/2024',
        targetLesions: [{ location: 'Hígado', measurement: 55 }], // +12 mm y +27.9% vs nadir
      });
      const result = evaluateRecistResponse([baseline, nadirStudy, progressionStudy]);
      expect(result.criterion).toBe('RECIST 1.1');
      expect(result.status).toBe('🔴 Progresión de enfermedad (PD)');
      expect(result.badgeColor).toBe('red');
      expect(result.nadirSum).toBe(43);
      expect(result.latestSum).toBe(55);
      expect(result.pctVsNadir).toBeCloseTo(27.9, 1);
    });

    it('clasifica como PD inmediatamente ante la aparición de nuevas lesiones', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        targetLesions: [{ location: 'Pulmón', measurement: 50 }],
      });
      const followUp = createStudy({
        date: '01/04/2024',
        targetLesions: [{ location: 'Pulmón', measurement: 35 }],
        newLesions: true, // Nueva lesión metastásica
      });
      const result = evaluateRecistResponse([baseline, followUp]);
      expect(result.criterion).toBe('RECIST 1.1');
      expect(result.status).toBe('🔴 Progresión de enfermedad (PD)');
      expect(result.badgeColor).toBe('red');
    });
  });

  describe('7. iRECIST (Inmunoterapia y Pseudoprogresión)', () => {
    it('detecta criterio iRECIST cuando el tratamiento o la historia contiene una palabra clave de inmunoterapia existente en código', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        treatment: 'Pembrolizumab (anti-PD1)',
        targetLesions: [{ location: 'Pulmón', measurement: 50 }],
      });
      const followUp = createStudy({
        date: '01/04/2024',
        treatment: 'Pembrolizumab',
        targetLesions: [{ location: 'Pulmón', measurement: 25 }],
      });
      const result = evaluateRecistResponse([baseline, followUp]);
      expect(result.criterion).toBe('iRECIST');
      expect(result.criterionNote).toBe('Inmunoterapia detectada');
      expect(result.status).toBe('🟢 Respuesta Parcial (iPR)');
    });

    it('clasifica como iUPD (Progresión No Confirmada) en el primer evento de progresión bajo inmunoterapia', () => {
      const baseline = createStudy({
        date: '01/01/2024',
        isBaseline: true,
        treatment: 'Nivolumab',
        targetLesions: [{ location: 'Pulmón', measurement: 50 }],
      });
      const followUp = createStudy({
        date: '01/04/2024',
        treatment: 'Nivolumab',
        targetLesions: [{ location: 'Pulmón', measurement: 65 }], // +15 mm (+30%)
      });
      const result = evaluateRecistResponse([baseline, followUp]);
      expect(result.criterion).toBe('iRECIST');
      expect(result.status).toBe('🔴 iUPD (Progresión No Confirmada por iRECIST)');
      expect(result.badgeColor).toBe('red');
    });

    it('clasifica como iCPD (Progresión Confirmada) si el estudio previo ya mostraba progresión bajo inmunoterapia', () => {
      const baseline = createStudy({
        id: 's1',
        date: '01/01/2024',
        isBaseline: true,
        treatment: 'Atezolizumab',
        targetLesions: [{ location: 'Pulmón', measurement: 50 }],
      });
      const firstPd = createStudy({
        id: 's2',
        date: '01/04/2024',
        treatment: 'Atezolizumab',
        targetLesions: [{ location: 'Pulmón', measurement: 62 }], // +12 mm (>5 mm y >20%)
      });
      const confirmedPd = createStudy({
        id: 's3',
        date: '01/06/2024',
        treatment: 'Atezolizumab',
        targetLesions: [{ location: 'Pulmón', measurement: 70 }], // progresión persistente
      });
      const result = evaluateRecistResponse([baseline, firstPd, confirmedPd]);
      expect(result.criterion).toBe('iRECIST');
      expect(result.status).toBe('🔴 iCPD (Progresión Confirmada por iRECIST)');
      expect(result.badgeColor).toBe('red');
    });
  });

  describe('8. Override Manual por el Especialista', () => {
    it('respeta prioritariamente el estado y nota asignados en responseOverride', () => {
      const study = createStudy({
        date: '01/01/2024',
        targetLesions: [{ location: 'Nódulo', measurement: 20 }],
        responseOverride: {
          status: 'Respuesta Metabólica Completa por PET-TC',
          note: 'Sin captación de FDG pese a persistencia de imagen morfológica residual.',
        },
      });
      const result = evaluateRecistResponse([study]);
      expect(result.isOverride).toBe(true);
      expect(result.status).toBe('Respuesta Metabólica Completa por PET-TC');
      expect(result.explanation).toContain('Sin captación de FDG');
      expect(result.overrideNote).toBe('Sin captación de FDG pese a persistencia de imagen morfológica residual.');
    });
  });

  describe('9. Protección contra mediciones inválidas (P0-1)', () => {
    describe('parseSafeMeasurement - Validación estricta', () => {
      it('acepta números válidos (enteros y decimales)', () => {
        expect(parseSafeMeasurement(25)).toBe(25);
        expect(parseSafeMeasurement(25.0)).toBe(25);
        expect(parseSafeMeasurement(12.5)).toBe(12.5);
      });

      it('acepta strings puramente numéricos y los convierte a number', () => {
        expect(parseSafeMeasurement('25')).toBe(25);
        expect(parseSafeMeasurement('25.0')).toBe(25);
        expect(parseSafeMeasurement('12.5')).toBe(12.5);
      });

      it('acepta el cero de forma legítima', () => {
        expect(parseSafeMeasurement(0)).toBe(0);
        expect(parseSafeMeasurement('0')).toBe(0);
        expect(parseSafeMeasurement('0.0')).toBe(0);
      });

      it('rechaza strings con unidades o texto', () => {
        expect(parseSafeMeasurement('25 mm')).toBeNull();
        expect(parseSafeMeasurement('2.5 cm')).toBeNull();
        expect(parseSafeMeasurement('30mm')).toBeNull();
        expect(parseSafeMeasurement('no medible')).toBeNull();
        expect(parseSafeMeasurement('lesion 1')).toBeNull();
      });

      it('rechaza null, undefined, vacíos, NaN y valores negativos', () => {
        expect(parseSafeMeasurement(null)).toBeNull();
        expect(parseSafeMeasurement(undefined)).toBeNull();
        expect(parseSafeMeasurement('')).toBeNull();
        expect(parseSafeMeasurement('   ')).toBeNull();
        expect(parseSafeMeasurement(NaN)).toBeNull();
        expect(parseSafeMeasurement(-5)).toBeNull();
        expect(parseSafeMeasurement('-10')).toBeNull();
      });
    });

    describe('Casos clínicos de seguridad (evaluateRecistResponse)', () => {
      it('Caso A: Basal 40 mm, evolutivo con diana "25 mm" -> NO CR/iCR, debe indicar insufficientData', () => {
        const baseline = createStudy({
          date: '01/01/2024',
          isBaseline: true,
          targetLesions: [{ location: 'Pulmón', measurement: 40 }],
        });
        const followUp = createStudy({
          date: '01/04/2024',
          targetLesions: [{ location: 'Pulmón', measurement: '25 mm' }],
        });
        const result = evaluateRecistResponse([baseline, followUp]);

        expect(result.insufficientData).toBe(true);
        expect(result.status).toBe('Información insuficiente para cuantificar RECIST');
        expect(result.badgeColor).toBe('gray');
        expect(result.status).not.toContain('CR');
        expect(result.status).not.toContain('Respuesta Completa');
      });

      it('Caso B: Basal 40 mm, evolutivo con diana "2.5 cm" -> NO CR/iCR, debe indicar insufficientData', () => {
        const baseline = createStudy({
          date: '01/01/2024',
          isBaseline: true,
          targetLesions: [{ location: 'Pulmón', measurement: 40 }],
        });
        const followUp = createStudy({
          date: '01/04/2024',
          targetLesions: [{ location: 'Pulmón', measurement: '2.5 cm' }],
        });
        const result = evaluateRecistResponse([baseline, followUp]);

        expect(result.insufficientData).toBe(true);
        expect(result.status).toBe('Información insuficiente para cuantificar RECIST');
        expect(result.badgeColor).toBe('gray');
        expect(result.status).not.toContain('CR');
        expect(result.status).not.toContain('Respuesta Completa');
      });

      it('Caso C: Basal 40 mm, evolutivo con diana null -> NO CR/iCR, debe indicar insufficientData', () => {
        const baseline = createStudy({
          date: '01/01/2024',
          isBaseline: true,
          targetLesions: [{ location: 'Pulmón', measurement: 40 }],
        });
        const followUp = createStudy({
          date: '01/04/2024',
          targetLesions: [{ location: 'Pulmón', measurement: null }],
        });
        const result = evaluateRecistResponse([baseline, followUp]);

        expect(result.insufficientData).toBe(true);
        expect(result.status).toBe('Información insuficiente para cuantificar RECIST');
        expect(result.badgeColor).toBe('gray');
        expect(result.status).not.toContain('CR');
        expect(result.status).not.toContain('Respuesta Completa');
      });

      it('Caso D: Basal 40 mm, evolutivo con diana 0 -> CR legítima preservada', () => {
        const baseline = createStudy({
          date: '01/01/2024',
          isBaseline: true,
          targetLesions: [{ location: 'Pulmón', measurement: 40 }],
        });
        const followUp = createStudy({
          date: '01/04/2024',
          targetLesions: [{ location: 'Pulmón', measurement: 0 }],
        });
        const result = evaluateRecistResponse([baseline, followUp]);

        expect(result.status).toBe('🟢 Respuesta Completa (CR)');
        expect(result.badgeColor).toBe('green');
        expect(result.latestSum).toBe(0);
        expect(result.pctVsBaseline).toBe(-100);
        expect(result.insufficientData).toBeFalsy();
      });

      it('Caso E: Basal 40 mm, evolutivo con diana 10 -> PR legítima (-75%) preservada', () => {
        const baseline = createStudy({
          date: '01/01/2024',
          isBaseline: true,
          targetLesions: [{ location: 'Pulmón', measurement: 40 }],
        });
        const followUp = createStudy({
          date: '01/04/2024',
          targetLesions: [{ location: 'Pulmón', measurement: 10 }],
        });
        const result = evaluateRecistResponse([baseline, followUp]);

        expect(result.status).toBe('🟢 Respuesta Parcial (PR)');
        expect(result.badgeColor).toBe('green');
        expect(result.baselineSum).toBe(40);
        expect(result.latestSum).toBe(10);
        expect(result.pctVsBaseline).toBe(-75);
      });

      it('Caso F: Flujo de iRECIST válido se mantiene intacto y mediciones inválidas impiden iCR', () => {
        const baseline = createStudy({
          date: '01/01/2024',
          isBaseline: true,
          treatment: 'Pembrolizumab (anti-PD1)',
          targetLesions: [{ location: 'Pulmón', measurement: 50 }],
        });
        const validFollowUp = createStudy({
          date: '01/04/2024',
          treatment: 'Pembrolizumab',
          targetLesions: [{ location: 'Pulmón', measurement: 25 }],
        });
        const validResult = evaluateRecistResponse([baseline, validFollowUp]);
        expect(validResult.criterion).toBe('iRECIST');
        expect(validResult.status).toBe('🟢 Respuesta Parcial (iPR)');

        // Evolutivo con medición inválida bajo inmunoterapia no debe dar iCR
        const invalidFollowUp = createStudy({
          date: '01/04/2024',
          treatment: 'Pembrolizumab',
          targetLesions: [{ location: 'Pulmón', measurement: '25 mm' }],
        });
        const invalidResult = evaluateRecistResponse([baseline, invalidFollowUp]);
        expect(invalidResult.insufficientData).toBe(true);
        expect(invalidResult.status).toBe('Información insuficiente para cuantificar RECIST');
        expect(invalidResult.badgeColor).toBe('gray');
        expect(invalidResult.status).not.toContain('iCR');
      });
    });
  });
});
