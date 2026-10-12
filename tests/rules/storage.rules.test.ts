import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'demo-oncoguide-rules';

describe('Storage Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
      ? process.env.FIRESTORE_EMULATOR_HOST.split(':')[0]
      : '127.0.0.1';
    const firestorePort = process.env.FIRESTORE_EMULATOR_HOST
      ? parseInt(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1], 10)
      : 8080;

    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST
      ? process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')[0]
      : '127.0.0.1';
    const storagePort = process.env.FIREBASE_STORAGE_EMULATOR_HOST
      ? parseInt(process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')[1], 10)
      : 9199;

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host: firestoreHost,
        port: firestorePort,
      },
      storage: {
        rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
        host: storageHost,
        port: storagePort,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  });

  const seedFirestore = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'authorized_users', 'medicoA'), { active: true });
      await setDoc(doc(db, 'authorized_users', 'medicoB'), { active: true });
      await setDoc(doc(db, 'authorized_users', 'inactivo'), { active: false });
      await setDoc(doc(db, 'patients', 'pacienteA'), { doctorId: 'medicoA' });
      await setDoc(doc(db, 'patients', 'pacienteB'), { doctorId: 'medicoB' });
    });
  };

  const sampleFileContent = new Uint8Array([79, 110, 99, 111, 71, 117, 105, 100, 101]); // "OncoGuide"

  describe('1. Ruta clinica: patients/{patientId}/{allPaths=**}', () => {
    beforeEach(async () => {
      await seedFirestore();
    });

    it('permite escritura y lectura al medico autorizado dueno del paciente', async () => {
      const storageA = testEnv.authenticatedContext('medicoA').storage();
      const fileRef = ref(storageA, 'patients/pacienteA/estudios/tac_torax.pdf');

      // Escritura permitida
      await assertSucceeds(uploadBytes(fileRef, sampleFileContent));

      // Lectura permitida
      await assertSucceeds(getBytes(fileRef));
    });

    it('deniega escritura y lectura a otro medico autorizado que no es dueno del paciente', async () => {
      // 1. Sembrar el archivo de prueba con reglas deshabilitadas
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminStorage = context.storage();
        const fileRef = ref(adminStorage, 'patients/pacienteA/estudios/tac_torax.pdf');
        await uploadBytes(fileRef, sampleFileContent);
      });

      // 2. medicoB intenta acceder al archivo de pacienteA
      const storageB = testEnv.authenticatedContext('medicoB').storage();
      const fileRefB = ref(storageB, 'patients/pacienteA/estudios/tac_torax.pdf');
      const newFileRefB = ref(storageB, 'patients/pacienteA/estudios/intento_subida.pdf');

      await assertFails(getBytes(fileRefB));
      await assertFails(uploadBytes(newFileRefB, sampleFileContent));
    });

    it('deniega escritura y lectura a usuario autenticado con active: false', async () => {
      const storageInactive = testEnv.authenticatedContext('inactivo').storage();
      const fileRef = ref(storageInactive, 'patients/pacienteA/estudios/test.pdf');

      await assertFails(uploadBytes(fileRef, sampleFileContent));
      await assertFails(getBytes(fileRef));
    });

    it('deniega escritura y lectura a usuario autenticado sin registro en authorized_users', async () => {
      const storageUnauthorized = testEnv.authenticatedContext('no_autorizado').storage();
      const fileRef = ref(storageUnauthorized, 'patients/pacienteA/estudios/test.pdf');

      await assertFails(uploadBytes(fileRef, sampleFileContent));
      await assertFails(getBytes(fileRef));
    });

    it('deniega escritura y lectura a usuario no autenticado', async () => {
      const storageUnauth = testEnv.unauthenticatedContext().storage();
      const fileRef = ref(storageUnauth, 'patients/pacienteA/estudios/test.pdf');

      await assertFails(uploadBytes(fileRef, sampleFileContent));
      await assertFails(getBytes(fileRef));
    });

    it('deniega escritura y lectura si el paciente no existe en Firestore', async () => {
      const storageA = testEnv.authenticatedContext('medicoA').storage();
      const fileRef = ref(storageA, 'patients/pacienteInexistente/estudios/test.pdf');

      await assertFails(uploadBytes(fileRef, sampleFileContent));
      await assertFails(getBytes(fileRef));
    });
  });

  describe('2. Rutas no declaradas o raiz', () => {
    beforeEach(async () => {
      await seedFirestore();
    });

    it('deniega escritura y lectura a cualquier usuario en rutas arbitrarias', async () => {
      const storageA = testEnv.authenticatedContext('medicoA').storage();
      const storageUnauth = testEnv.unauthenticatedContext().storage();

      const generalFileRefA = ref(storageA, 'reportes/general.pdf');
      const rootFileRefA = ref(storageA, 'root_file.txt');
      const unauthFileRef = ref(storageUnauth, 'public/data.pdf');

      await assertFails(uploadBytes(generalFileRefA, sampleFileContent));
      await assertFails(getBytes(generalFileRefA));

      await assertFails(uploadBytes(rootFileRefA, sampleFileContent));
      await assertFails(getBytes(rootFileRefA));

      await assertFails(uploadBytes(unauthFileRef, sampleFileContent));
      await assertFails(getBytes(unauthFileRef));
    });
  });
});
