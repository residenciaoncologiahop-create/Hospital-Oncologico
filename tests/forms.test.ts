import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { ADMIN_FORMS_REGISTRY, getAdminFormById } from '../src/services/adminForms/registry';
import { form03PracticasDefinition } from '../src/services/adminForms/form03Practicas';
import { solicitudMedicamentosDefinition } from '../src/services/adminForms/solicitudMedicamentos';
import { derivacionProfeDefinition } from '../src/services/adminForms/derivacionProfe';
import { calculateBSA, cleanDate } from '../src/services/adminForms/pdfHelpers';
import * as pdfHelpers from '../src/services/adminForms/pdfHelpers';

describe('Formularios Administrativos y Generación PDF', () => {
  describe('1. Registro Oficial de Formularios (ADMIN_FORMS_REGISTRY)', () => {
    it('contiene los 3 formularios principales institucionales', () => {
      expect(ADMIN_FORMS_REGISTRY.length).toBe(3);
      const ids = ADMIN_FORMS_REGISTRY.map(f => f.id);
      expect(ids).toContain('form03_practicas');
      expect(ids).toContain('solicitud_medicamentos_onco');
      expect(ids).toContain('derivacion_profe_133');
    });

    it('permite recuperar un formulario por su identificador único', () => {
      const form = getAdminFormById('form03_practicas');
      expect(form).toBeDefined();
      expect(form?.code).toBe('Form. 03');
      expect(form?.name).toContain('Prácticas Especializadas');
      expect(form?.fields.length).toBeGreaterThan(0);
    });
  });

  describe('2. Integridad de Plantillas Oficiales en public/forms/', () => {
    const templates = [
      'form03_practicas.pdf',
      'solicitud_medicamentos.pdf',
      'derivacion_profe_133.pdf',
      'nuevo_dinadic.pdf',
      'pami.pdf',
    ];

    templates.forEach(templateName => {
      it(`la plantilla ${templateName} existe y es un PDF válido`, async () => {
        const filePath = path.resolve(process.cwd(), 'public/forms', templateName);
        expect(fs.existsSync(filePath), `Archivo no encontrado: ${filePath}`).toBe(true);

        const fileBytes = fs.readFileSync(filePath);
        expect(fileBytes.length).toBeGreaterThan(0);

        // Validar que pdf-lib puede parsear el documento sin error
        const pdfDoc = await PDFDocument.load(fileBytes);
        expect(pdfDoc.getPageCount()).toBeGreaterThan(0);
      });
    });
  });

  describe('3. Smoke Test de Generación PDF (Form 03 - Prácticas Extrahospitalarias)', () => {
    it('genera un documento PDF válido sin lanzar excepciones y con al menos una página', async () => {
      const mockData = {
        numero_derivacion: 'DERIV-2024-9988',
        fecha_emision: '24/09/2024',
        establecimiento: 'HOSPITAL ONCOLÓGICO PROVINCIAL',
        servicio: 'ONCOLOGÍA CLÍNICA',
        apellido_nombre: 'PÉREZ, JUAN CARLOS',
        tipo_nro_documento: 'DNI 28.123.456',
        condicion_obra_social: 'APROSS',
        caracter_atencion: 'Ambulatorio',
        diagnostico_presuntivo: 'Carcinoma de colon estadio IV con metástasis hepáticas.',
        solicitud_estudio: 'PET/TC corporal total con 18F-FDG para evaluación de respuesta terapéutica.',
        estudios_previos: 'TC abdomen y pelvis previa: lesiones focales en segmentos IV y VII.',
        fundamentos_pedido: 'Evaluación de viabilidad quirúrgica y respuesta a quimioterapia.',
      };

      const mockContext = {
        patient: { name: 'Juan Carlos Pérez', age: 52 },
        historyText: 'Paciente con diagnóstico de adenocarcinoma de colon...',
        doctorData: {
          nombre: 'Dr. Oncólogo Test',
          matricula: '12345/6',
          especialidad: 'Oncología Clínica',
        },
      };

      const result = await form03PracticasDefinition.generatePDF(mockData, mockContext);

      expect(result).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.filename.endsWith('.pdf')).toBe(true);
      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);

      // Comprobar que el blob generado es interpretable como PDF válido
      const arrayBuffer = await result.blob.arrayBuffer();
      const generatedPdfDoc = await PDFDocument.load(arrayBuffer);
      expect(generatedPdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('P1-2a: define el selector caracter_atencion con exactamente 4 opciones estructuradas {label, value}', () => {
      const field = form03PracticasDefinition.fields.find(f => f.key === 'caracter_atencion');
      expect(field).toBeDefined();
      expect(field?.type).toBe('select');
      expect(field?.options).toHaveLength(4);

      // 1 y 2. Opciones estructuradas con label y value
      expect(field?.options).toEqual([
        { label: 'Ambulatorio', value: 'Ambulatorio' },
        { label: 'Estabilizado', value: 'Estabilizado' },
        { label: 'Urgencia', value: 'Urgencia' },
        { label: 'Emergencia', value: 'Emergencia' },
      ]);

      // 3 y 4. Ninguna opción es un string simple y el orden se respeta
      field?.options?.forEach(opt => {
        expect(typeof opt).toBe('object');
        expect(typeof opt.label).toBe('string');
        expect(typeof opt.value).toBe('string');
        expect(opt.label).toBe(opt.value);
      });
    });
  });

  describe('4. Funciones Auxiliares Deterministas (pdfHelpers)', () => {
    it('calculateBSA: calcula correctamente el área de superficie corporal mediante fórmula de Mosteller', () => {
      // Peso: 70 kg, Altura: 175 cm -> sqrt((70 * 175)/3600) = sqrt(12250 / 3600) = sqrt(3.40277) = 1.84 m²
      const bsa = calculateBSA(70, 175);
      expect(bsa).toBe('1.84');
    });

    it('calculateBSA: maneja alturas ingresadas en metros convirtiéndolas a centímetros', () => {
      const bsaMetros = calculateBSA(70, 1.75);
      expect(bsaMetros).toBe('1.84');
    });

    it('calculateBSA: retorna string vacío si los valores son inválidos o faltantes', () => {
      expect(calculateBSA('', '')).toBe('');
      expect(calculateBSA(0, 175)).toBe('');
      expect(calculateBSA(70, 0)).toBe('');
    });

    it('cleanDate: normaliza fechas en formatos estándar con padding de dos dígitos', () => {
      expect(cleanDate('1/5/2024')).toBe('01/05/2024');
      expect(cleanDate('15-08-2024')).toBe('15/08/2024');
      expect(cleanDate('05/11/2024')).toBe('05/11/2024');
      expect(cleanDate('')).toBe('');
    });
  });

  describe('5. Solicitud de Medicamentos Oncológicos (P0-3: N.º de Historia Clínica)', () => {
    it('extrae correctamente el campo hcNumber hacia nro_hc (y no recordNumber)', async () => {
      const mockContext = {
        patient: {
          name: 'Juan Pérez',
          dni: '30.123.456',
          hcNumber: '123456',
          age: 58,
          sex: 'M',
        },
        historyText: '',
      };

      const data = await solicitudMedicamentosDefinition.extractData(mockContext);
      expect(data.nro_hc).toBe('123456');
      expect((data as any).recordNumber).toBeUndefined();
    });

    it('envía el N.º de HC "123456" a la posición correspondiente en la generación del PDF', async () => {
      const pageDrawTextSpy = vi.spyOn(PDFPage.prototype, 'drawText');
      const drawTextAtSpy = vi.spyOn(pdfHelpers, 'drawTextAt');

      const mockData = {
        nombre_apellido: 'PÉREZ, JUAN',
        dni: '30.123.456',
        nro_hc: '123456',
        fecha_pedido: '24/09/2024',
        droga_principal: 'Pembrolizumab',
      };

      const mockContext = {
        patient: {
          name: 'Juan Pérez',
          hcNumber: '123456',
        },
        historyText: '',
      };

      const result = await solicitudMedicamentosDefinition.generatePDF(mockData, mockContext);

      expect(result).toBeDefined();
      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);

      // 1. Confirmar invocación a drawTextAt con los parámetros exactos del formulario
      expect(drawTextAtSpy).toHaveBeenCalledWith(
        expect.anything(),
        '123456',
        300,
        564.19,
        expect.anything(),
        8.8,
        expect.anything()
      );

      // 2. Confirmar que el texto final "123456" fue impreso en la página del PDF en (x: 300, y: 564.19)
      expect(pageDrawTextSpy).toHaveBeenCalledWith(
        '123456',
        expect.objectContaining({
          x: 300,
          y: 564.19,
          size: 8.8,
        })
      );

      pageDrawTextSpy.mockRestore();
      drawTextAtSpy.mockRestore();
    });
  });

  describe('6. Normalización de Campos y Contratos de Formularios (P2-6b)', () => {
    it('Formulario 03: solicitud_estudio utiliza helperText con el texto original exacto y no description', () => {
      const field = form03PracticasDefinition.fields.find(f => f.key === 'solicitud_estudio');
      expect(field).toBeDefined();
      expect(field?.helperText).toBe('Estudio o práctica de alta complejidad a realizar fuera del establecimiento.');
      expect((field as any)?.description).toBeUndefined();
    });

    it('PROFE 133: medicacion_solicitada utiliza helperText con el texto original exacto y no description', () => {
      const field = derivacionProfeDefinition.fields.find(f => f.key === 'medicacion_solicitada');
      expect(field).toBeDefined();
      expect(field?.helperText).toBe('Nombre del esquema o droga de alto costo a autorizar por PROFE.');
      expect((field as any)?.description).toBeUndefined();
    });

    it('PROFE 133: la categoría es exactamente "Medicación y Farmacia" según el contrato de AdminFormDefinition', () => {
      expect(derivacionProfeDefinition.category).toBe('Medicación y Farmacia');
    });
  });
});
