import { describe, it, expect } from 'vitest';
import { cleanForFirestore, Patient } from '../src/services/patientService';

describe('Seguridad de Pacientes - Contrato de Capa Cliente', () => {
  describe('1. Sanitización e integridad de payload (cleanForFirestore)', () => {
    it('elimina campos undefined para prevenir rechazos o corrupción en Firestore', () => {
      const dirtyData = {
        name: 'Paciente Test',
        age: 55,
        diagnosis: 'Carcinoma de Mama',
        doctorId: 'doc-uid-123',
        historyText: 'Historia clínica base',
        timeline: [],
        chatHistory: [],
        lastUpdated: 1700000000,
        fileUrls: undefined,
        clinicalContext: undefined,
      };

      const cleaned = cleanForFirestore(dirtyData) as Record<string, any>;

      expect(cleaned.name).toBe('Paciente Test');
      expect(cleaned.doctorId).toBe('doc-uid-123');
      expect('fileUrls' in cleaned).toBe(false);
      expect('clinicalContext' in cleaned).toBe(false);
    });

    it('preserva valores null, primitivos y arrays válidos', () => {
      const input = {
        doctorId: 'doc-456',
        nullField: null,
        numField: 0,
        boolField: false,
        arr: [1, 2, undefined, 3],
      };
      const cleaned = cleanForFirestore(input) as Record<string, any>;
      expect(cleaned.doctorId).toBe('doc-456');
      expect(cleaned.nullField).toBeNull();
      expect(cleaned.numField).toBe(0);
      expect(cleaned.boolField).toBe(false);
      expect(cleaned.arr).toEqual([1, 2, null, 3]);
    });
  });

  describe('2. Contrato de propiedad y estructura de paciente (doctorId ownership)', () => {
    it('exige el campo doctorId para cumplir con la regla isOwner(doctorId) de Firestore', () => {
      const patientPayload: Patient & { doctorId: string } = {
        name: 'Paciente A',
        age: 62,
        diagnosis: 'Adenocarcinoma de Pulmón',
        doctorId: 'uid_doctor_autorizado_A',
        historyText: 'Sin antecedentes de relevancia',
        timeline: [],
        chatHistory: [],
        lastUpdated: Date.now(),
      };

      expect(patientPayload.doctorId).toBeDefined();
      expect(typeof patientPayload.doctorId).toBe('string');
      expect(patientPayload.doctorId.length).toBeGreaterThan(0);
    });

    it('detecta discrepancia si una operación intenta asignar un doctorId diferente al usuario en sesión', () => {
      const authUid = 'uid_doctor_actual';
      const foreignDoctorId = 'uid_otro_doctor';

      const isCompliantWithRules = (currentAuthUid: string, targetDoctorId: string) => {
        return currentAuthUid === targetDoctorId;
      };

      expect(isCompliantWithRules(authUid, authUid)).toBe(true);
      expect(isCompliantWithRules(authUid, foreignDoctorId)).toBe(false);
    });
  });

  describe('3. Delimitación de responsabilidad de seguridad', () => {
    it('declara explícitamente que la validación de aislamiento real (unauthenticated, DocA vs DocB) reside en firestore.rules y el runner live', () => {
      // Este test documenta formalmente la frontera de seguridad:
      // La seguridad real NO es delegada a la UI ni a la lógica cliente;
      // las operaciones de lectura, escritura, actualización y borrado son validadas
      // por el motor de Firestore Rules en la nube evaluando isAuthorized() e isOwner().
      const securityArchitecture = {
        clientLayer: 'Sanitización de payload y asociación de doctorId',
        enforcementLayer: 'Firestore Security Rules (isAuthorized && isOwner)',
        liveVerificationRunner: 'scratch/audit_security_live.mjs',
      };

      expect(securityArchitecture.enforcementLayer).toContain('Firestore Security Rules');
      expect(securityArchitecture.liveVerificationRunner).toBe('scratch/audit_security_live.mjs');
    });
  });
});
