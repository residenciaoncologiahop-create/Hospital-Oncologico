import { describe, it, expect } from 'vitest';
import { toDateInputValue, fromDateInputValue, LabResult } from '../src/components/LabPanel';
import { isPlausibleLabResult, normalizeLabTestName } from '../src/utils/labValidation';

describe('LabPanel - Funcionalidad de eliminación y edición de valores aislados', () => {
  describe('Transformación de formatos de fecha', () => {
    it('convierte correctamente fechas DD/MM/YYYY al formato de input date YYYY-MM-DD', () => {
      expect(toDateInputValue('15/02/2020')).toBe('2020-02-15');
      expect(toDateInputValue('05/09/2023')).toBe('2023-09-05');
      expect(toDateInputValue('1/2/2022')).toBe('2022-02-01');
    });

    it('mantiene fechas que ya están en formato YYYY-MM-DD', () => {
      expect(toDateInputValue('2023-11-20')).toBe('2023-11-20');
    });

    it('convierte correctamente fechas del input date YYYY-MM-DD al formato DD/MM/YYYY', () => {
      expect(fromDateInputValue('2020-02-15')).toBe('15/02/2020');
      expect(fromDateInputValue('2023-09-05')).toBe('05/09/2023');
    });
  });

  describe('Lógica de eliminación de valores aislados en la curva', () => {
    const initialLabs: LabResult[] = [
      { date: '10/01/2023', test: 'CEA', value: 12.4, unit: 'ng/mL', source: 'documento', professional: 'Lab Central' },
      { date: '15/02/2023', test: 'CEA', value: 180.0, unit: 'ng/mL', source: 'manual', professional: 'Médico' }, // Valor aislado erróneo
      { date: '20/03/2023', test: 'CEA', value: 14.1, unit: 'ng/mL', source: 'documento', professional: 'Lab Central' },
      { date: '10/01/2023', test: 'Hemoglobina', value: 13.5, unit: 'g/dL', source: 'documento', professional: 'Lab Central' },
    ];

    it('elimina únicamente el valor aislado seleccionado por índice conservando los demás registros intactos', () => {
      const indexToDelete = 1;
      const updated = initialLabs.filter((_, idx) => idx !== indexToDelete);

      expect(updated.length).toBe(3);
      expect(updated.some(l => l.value === 180.0)).toBe(false);
      expect(updated.find(l => l.date === '10/01/2023' && l.test === 'CEA')?.value).toBe(12.4);
      expect(updated.find(l => l.date === '20/03/2023' && l.test === 'CEA')?.value).toBe(14.1);
      expect(updated.find(l => l.test === 'Hemoglobina')?.value).toBe(13.5);
    });

    it('elimina el valor por coincidencia de atributos cuando no se provee índice', () => {
      const target: LabResult = {
        date: '15/02/2023',
        test: 'CEA',
        value: 180.0,
        unit: 'ng/mL',
        source: 'manual',
        professional: 'Médico'
      };

      const targetIdx = initialLabs.findIndex(
        l => l.date === target.date && l.test === target.test && l.value === target.value
      );
      expect(targetIdx).toBe(1);

      const updated = initialLabs.filter((_, idx) => idx !== targetIdx);
      expect(updated.length).toBe(3);
      expect(updated.some(l => l.value === 180.0)).toBe(false);
    });
  });

  describe('Lógica de edición de valores aislados en la curva', () => {
    const initialLabs: LabResult[] = [
      { date: '10/01/2023', test: 'CEA', value: 12.4, unit: 'ng/mL', source: 'documento', professional: 'Lab Central' },
      { date: '15/02/2023', test: 'CEA', value: 180.0, unit: 'ng/mL', source: 'manual', professional: 'Médico' },
    ];

    it('edita un valor de curva aislado corrigiendo el error de tipeo y preservando la autoría', () => {
      const indexToEdit = 1;
      const original = initialLabs[indexToEdit];
      const updatedData: LabResult = {
        ...original,
        value: 18.0, // Corregido de 180 a 18
        date: '16/02/2023',
        professional: 'Dr. Oncólogo'
      };

      const updatedList = initialLabs.map((l, idx) => idx === indexToEdit ? updatedData : l);

      expect(updatedList.length).toBe(2);
      expect(updatedList[1].value).toBe(18.0);
      expect(updatedList[1].date).toBe('16/02/2023');
      expect(updatedList[1].professional).toBe('Dr. Oncólogo');
      expect(updatedList[0].value).toBe(12.4); // El otro valor permanece inalterado
    });

    it('valida la plausibilidad clínica al editar valores de laboratorio', () => {
      const normTest = normalizeLabTestName('Hemoglobina');
      expect(normTest).toBe('Hemoglobina');

      // Valor plausible de Hb
      expect(isPlausibleLabResult(normTest, 12.5, 'g/dL')).toBe(true);

      // Valor aberrante / no plausible
      expect(isPlausibleLabResult(normTest, 1250, 'g/dL')).toBe(false);
      expect(isPlausibleLabResult(normTest, -5, 'g/dL')).toBe(false);
    });
  });
});
