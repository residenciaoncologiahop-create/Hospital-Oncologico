import { describe, it, expect } from 'vitest';
import { extractPatientClinicalProfile, detectOrganAndConflict } from '../src/services/clinicalTrials/patientProfileExtractor';

describe('FASE 5.1 — Extractor Clínico de Pacientes (patientProfileExtractor)', () => {
  const cervixCaseText = `42 a, HC 9239854, OS monotributista (no tiene el alta)
MC: Ca de cervix
AEA: genitorragia desde 02/2026, biopsia Ca escamoso invasor de cervix. Realiza RMN de A/P (Conci), con compromiso de parametrios y adenomegalias pelvianas. Continuó con sangrado, llegando a tener Hb de 4, requirió internación. En la misma realizaron cauterizacion para detener el sangrado, recibio tranfusiones, 6 unidades de Fe EV y luego al alta Fe VO. Fue valorada por Dra. Suarez (Gineco del Htal Rawson). Actualmente molestia inguinal derecha, de caracter electrizante, no dolor. Continua con sangrado esporadico, hace 48hs cuando realizaron nuevamente el tacto, volvio a sangrar.
MH: hierro VO
AHF: abuelo materno Ca gastrico
Atx: ex TBQ 6 P/A (abandono hace 15 años)
AGO: menarca 12 a FUM 05/2026, 4G 4PN
P: 80 / A: 1,66 / PS: 1
MET. COMPLEMENTARIOS:
30/6/26 AP biopsia cervix: carcinoma escamoso invasor mod. diferenciado
7/7/26 RMN A/P c/c: adenopatia intercavoaortica a nivel de la bifurcacion, de 10 mm. Lesion solida infiltrativa de cervix, de 74 x 47 x 52 mm, compatible con neo. Compromete el endocervix en toda su longitud y el miocervix subyacente en todo su espesor, con borramiento de la interfase cervicoparametrial bilateral. En sentido cefalico se extiende hacia el cuerpo uterino, con compromiso de todo el espesor miometrial posterior, no descartandose compromiso de la serosa.
Adenopatias pelvianas, la mayor en cadena iliaca externa derecha de 34 x 15 mm y en cadena iliaca primitiva derecha de 24 x 13 mm. Imag. nodular en OD, de 14 mm, sugestiva de implante secundario. Imagenes ganglionares inguinales bilaterales, de peq. tamaño, inespecificas.
15/9/26 PET: adenopatias hipermetabolicas mediastinales compatibles con implantes secundarios. Multiples imagenes nodulares en ambos parenquimas pulmonares compatibles con implantes secundarios. Adenopatias hipermetabolicas retroperitoneales. Adenopatias hipermetabolicas en cadenas iliacas. Extensa lesion cervical con compromiso de vagina, endometrio, miometrio, colon sigmoides, pared posterior de vejiga y ambos parametrios. Nodulo peritoneal en flanco izquierdo.
CONCLUSION: extensa lesion cervical, multiples implantes secundarios ganglionares supra e infradiafragmaticos, nodulo peritoneal e implantes secundarios pulmonares bilaterales.
CONDUCTA: resolver obra social y servicio social.`;

  describe('1. Extracción de Edad', () => {
    it('extrae "42 a" correctamente en la filiación', () => {
      const patient = { diagnosis: 'Ca de cervix', historyText: '42 a, HC 9239854, consulta por sangrado' };
      const profile = extractPatientClinicalProfile(patient);
      expect(profile.age).toBe(42);
    });

    it('extrae "42a" sin espacio', () => {
      const patient = { diagnosis: 'Ca de mama', historyText: 'FERNANDEZ, Sandra , 52a, NHC 9235873' };
      const profile = extractPatientClinicalProfile(patient);
      expect(profile.age).toBe(52);
    });

    it('evita falso positivo de "abandono hace 15 años" y preserva edad real de 42', () => {
      const patient = { diagnosis: 'mama', historyText: cervixCaseText };
      const profile = extractPatientClinicalProfile(patient);
      expect(profile.age).toBe(42);
      expect(profile.age).not.toBe(15);
      expect(profile.age).not.toBe(12);
    });
  });

  describe('2. Performance Status / ECOG', () => {
    it('extrae "PS: 1" y "PS 1"', () => {
      const p1 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'Examen físico: P: 80 / A: 1,66 / PS: 1' });
      expect(p1.ecogDocumented).toBe(1);

      const p2 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'Paciente en regular estado. PS 1' });
      expect(p2.ecogDocumented).toBe(1);
    });

    it('extrae "PS: 2" y "PS0"', () => {
      const p1 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'PS: 2 paciente en silla de ruedas' });
      expect(p1.ecogDocumented).toBe(2);

      const p2 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'EXAMEN FISICO: PS0 Mamas conicas' });
      expect(p2.ecogDocumented).toBe(0);
    });

    it('extrae "ECOG 1"', () => {
      const p = extractPatientClinicalProfile({ diagnosis: '', historyText: 'Paciente ambulatorio con ECOG 1' });
      expect(p.ecogDocumented).toBe(1);
    });
  });

  describe('3. Enfermedad Metastásica y Sitios Secundarios', () => {
    it('detecta "implantes secundarios" como enfermedad metastásica', () => {
      const p = extractPatientClinicalProfile({ diagnosis: 'Ca de cervix', historyText: 'PET: multiples imagenes nodulares compatibles con implantes secundarios pulmonares' });
      expect(p.isMetastaticDocumented).toBe(true);
      expect(p.metastaticSites).toContain('pulmon');
    });

    it('detecta "secundarismo"', () => {
      const p = extractPatientClinicalProfile({ diagnosis: 'Ca de mama', historyText: 'Centellograma óseo con áreas compatibles con secundarismo óseo' });
      expect(p.isMetastaticDocumented).toBe(true);
      expect(p.metastaticSites).toContain('hueso');
    });

    it('detecta "carcinomatosis"', () => {
      const p = extractPatientClinicalProfile({ diagnosis: 'Ca de ovario', historyText: 'Laparotomia con abundante ascitis y carcinomatosis peritoneal' });
      expect(p.isMetastaticDocumented).toBe(true);
      expect(p.metastaticSites).toContain('peritoneo');
    });

    it('no marca metástasis ante negaciones explícitas ("sin metástasis")', () => {
      const p = extractPatientClinicalProfile({ diagnosis: 'Ca de mama', historyText: 'TAC de torax y abdomen: sin metastasis a distancia. Sin secundarismo oseo' });
      expect(p.isMetastaticDocumented).toBe(false);
    });
  });

  describe('4. Estadio, FIGO y TNM', () => {
    it('extrae estadio FIGO ("FIGO IVB", "FIGO IIIA")', () => {
      const p1 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'Estadificación FIGO IVB por implantes a distancia' });
      expect(p1.stageDocumented).toBe('FIGO IVB');

      const p2 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'RMN de pelvis: Estadificación FIGO IIIA' });
      expect(p2.stageDocumented).toBe('FIGO IIIA');
    });

    it('extrae TNM explícito ("pT2N0", "pT3 pN1c")', () => {
      const p1 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'AP Cuadrantectomía: pT2 pN0' });
      expect(p1.stageDocumented).toContain('pT2 pN0');

      const p2 = extractPatientClinicalProfile({ diagnosis: '', historyText: 'ESTADIFICACION PATOLOGICA: pT3, pN1c' });
      expect(p2.stageDocumented).toContain('pT3');
    });
  });

  describe('5. Resolución de Conflictos de Tumor Primario', () => {
    it('detecta CONFLICTO cuando diagnosis="mama" pero historia tiene evidencia clara de "cérvix"', () => {
      const res = detectOrganAndConflict('mama', cervixCaseText);
      expect(res.diagnosticConflict?.hasConflict).toBe(true);
      expect(res.diagnosticConflict?.diagnosisInput).toBe('mama');
      expect(res.diagnosticConflict?.historyPrimaryOrgan).toBe('cervicouterino');
      // Adopta el órgano real de la historia clínica para proteger al pre-screening
      expect(res.organOrSite).toBe('cervicouterino');
    });

    it('resuelve primario desde historia cuando diagnosis está vacío', () => {
      const res = detectOrganAndConflict('', cervixCaseText);
      expect(res.diagnosticConflict?.hasConflict).toBe(false);
      expect(res.organOrSite).toBe('cervicouterino');
    });

    it('mantiene concordancia cuando diagnosis="cervix" e historia="cervix"', () => {
      const res = detectOrganAndConflict('Ca de cervix', cervixCaseText);
      expect(res.diagnosticConflict?.hasConflict).toBe(false);
      expect(res.organOrSite).toBe('cervicouterino');
    });

    it('trata términos genéricos ("cancer", "neoplasia") sin generar conflicto falso', () => {
      const res = detectOrganAndConflict('cáncer', cervixCaseText);
      expect(res.diagnosticConflict?.hasConflict).toBe(false);
      expect(res.organOrSite).toBe('cervicouterino');
    });
  });

  describe('6. Tratamiento Previo vs Planes Futuros', () => {
    it('no cuenta fármacos del PLAN futuro como tratamiento previo recibido', () => {
      const text = `Paciente con Ca de cervix de novo.
Sin tratamientos previos.
PLAN: Se propone iniciar esquema con carboplatino y paclitaxel el 10/10.`;
      const p = extractPatientClinicalProfile({ diagnosis: 'cervix', historyText: text });
      expect(p.priorTreatments).not.toContain('carboplatino');
      expect(p.priorTreatments).not.toContain('paclitaxel');
    });

    it('extrae fármacos cuando se documentan como recibidos o en curso', () => {
      const text = `Paciente en 1ra línea que completó 6 ciclos de folfox.
Actualmente en mantenimiento con bevacizumab.`;
      const p = extractPatientClinicalProfile({ diagnosis: 'colon', historyText: text });
      expect(p.priorTreatments).toContain('folfox');
      expect(p.priorTreatments).toContain('bevacizumab');
    });
  });

  describe('7. Caso de Prueba Principal Obligatorio', () => {
    it('extrae el perfil clínico completo y fidedigno para el caso de cérvix con diagnosis="mama"', () => {
      const patient = {
        name: 'MANZANOS Carina',
        diagnosis: 'mama',
        historyText: cervixCaseText
      };

      const profile = extractPatientClinicalProfile(patient);

      // Verificaciones obligatorias
      expect(profile.age).toBe(42);
      expect(profile.organOrSite).toBe('cervicouterino');
      expect(profile.histology).toBe('Carcinoma Epidermoide');
      expect(profile.ecogDocumented).toBe(1);
      expect(profile.isMetastaticDocumented).toBe(true);
      expect(profile.metastaticSites).toContain('pulmon');
      expect(profile.metastaticSites).toContain('peritoneo');
      expect(profile.sex).toBe('FEMALE');
      expect(profile.labsDocumented.hemoglobin).toBe(4);
      expect(profile.diagnosticConflict?.hasConflict).toBe(true);
      expect(profile.diagnosticConflict?.historyPrimaryOrgan).toBe('cervicouterino');
      expect(profile.diagnosticConflict?.diagnosisInput).toBe('mama');
    });
  });
});
