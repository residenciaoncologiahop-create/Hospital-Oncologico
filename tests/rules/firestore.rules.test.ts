import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'demo-oncoguide-rules';

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const host = process.env.FIRESTORE_EMULATOR_HOST
      ? process.env.FIRESTORE_EMULATOR_HOST.split(':')[0]
      : '127.0.0.1';
    const port = process.env.FIRESTORE_EMULATOR_HOST
      ? parseInt(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1], 10)
      : 8080;

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host,
        port,
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
  });

  const seedAuthorizedUsers = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'authorized_users', 'medicoA'), { active: true });
      await setDoc(doc(db, 'authorized_users', 'medicoB'), { active: true });
      await setDoc(doc(db, 'authorized_users', 'inactivo'), { active: false });
      await setDoc(doc(db, 'clinical_trials', 'trial1'), { title: 'Ensayo Fase III' });
    });
  };

  describe('1. Usuarios no autenticados', () => {
    it('deniega lectura y escritura en todas las colecciones declaradas y no declaradas', async () => {
      await seedAuthorizedUsers();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'patients', 'p1'), { doctorId: 'medicoA' });
        await setDoc(doc(db, 'pendientes', 't1'), { doctorId: 'medicoA' });
        await setDoc(doc(db, 'audit_logs', 'log1'), { doctorId: 'medicoA' });
        await setDoc(doc(db, 'otra_coleccion', 'doc1'), { data: 'test' });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();

      // patients
      await assertFails(getDoc(doc(unauthDb, 'patients', 'p1')));
      await assertFails(setDoc(doc(unauthDb, 'patients', 'p2'), { doctorId: 'medicoA' }));
      await assertFails(updateDoc(doc(unauthDb, 'patients', 'p1'), { name: 'Modificado' }));
      await assertFails(deleteDoc(doc(unauthDb, 'patients', 'p1')));

      // pendientes
      await assertFails(getDoc(doc(unauthDb, 'pendientes', 't1')));
      await assertFails(setDoc(doc(unauthDb, 'pendientes', 't2'), { doctorId: 'medicoA' }));
      await assertFails(updateDoc(doc(unauthDb, 'pendientes', 't1'), { task: 'Modificado' }));
      await assertFails(deleteDoc(doc(unauthDb, 'pendientes', 't1')));

      // audit_logs
      await assertFails(getDoc(doc(unauthDb, 'audit_logs', 'log1')));
      await assertFails(setDoc(doc(unauthDb, 'audit_logs', 'log2'), { doctorId: 'medicoA' }));
      await assertFails(updateDoc(doc(unauthDb, 'audit_logs', 'log1'), { action: 'EDIT' }));
      await assertFails(deleteDoc(doc(unauthDb, 'audit_logs', 'log1')));

      // clinical_trials
      await assertFails(getDoc(doc(unauthDb, 'clinical_trials', 'trial1')));
      await assertFails(setDoc(doc(unauthDb, 'clinical_trials', 'trial2'), { title: 'Nuevo' }));

      // authorized_users
      await assertFails(getDoc(doc(unauthDb, 'authorized_users', 'medicoA')));
      await assertFails(setDoc(doc(unauthDb, 'authorized_users', 'medicoA'), { active: true }));

      // coleccion no declarada
      await assertFails(getDoc(doc(unauthDb, 'otra_coleccion', 'doc1')));
      await assertFails(setDoc(doc(unauthDb, 'otra_coleccion', 'doc2'), { data: 'nuevo' }));
    });

    it('deniega leer y escribir clinical_trials para usuario no autenticado', async () => {
      await seedAuthorizedUsers();
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(getDoc(doc(unauthDb, 'clinical_trials', 'trial1')));
      await assertFails(setDoc(doc(unauthDb, 'clinical_trials', 'trial2'), { title: 'Nuevo' }));
    });
  });

  describe('2. Usuarios autenticados pero NO autorizados', () => {
    describe('2.1. Usuario sin documento en authorized_users', () => {
      it('deniega create, read, update, delete en patients, pendientes y audit_logs', async () => {
        await seedAuthorizedUsers();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, 'patients', 'p1'), { doctorId: 'medicoA' });
          await setDoc(doc(db, 'pendientes', 't1'), { doctorId: 'medicoA' });
          await setDoc(doc(db, 'audit_logs', 'log1'), { doctorId: 'medicoA' });
        });

        const userDb = testEnv.authenticatedContext('sin_documento').firestore();

        // patients
        await assertFails(setDoc(doc(userDb, 'patients', 'p_nuevo'), { doctorId: 'sin_documento' }));
        await assertFails(getDoc(doc(userDb, 'patients', 'p1')));
        await assertFails(updateDoc(doc(userDb, 'patients', 'p1'), { diagnosis: 'Mod' }));
        await assertFails(deleteDoc(doc(userDb, 'patients', 'p1')));

        // pendientes
        await assertFails(setDoc(doc(userDb, 'pendientes', 't_nuevo'), { doctorId: 'sin_documento' }));
        await assertFails(getDoc(doc(userDb, 'pendientes', 't1')));
        await assertFails(updateDoc(doc(userDb, 'pendientes', 't1'), { task: 'Mod' }));
        await assertFails(deleteDoc(doc(userDb, 'pendientes', 't1')));

        // audit_logs
        await assertFails(setDoc(doc(userDb, 'audit_logs', 'log_nuevo'), { doctorId: 'sin_documento' }));
      });

      it('deniega leer y escribir clinical_trials para usuario no autorizado', async () => {
        await seedAuthorizedUsers();
        const userDb = testEnv.authenticatedContext('sin_documento').firestore();

        await assertFails(getDoc(doc(userDb, 'clinical_trials', 'trial1')));
        await assertFails(setDoc(doc(userDb, 'clinical_trials', 'trial2'), { title: 'Nuevo' }));
      });

      it('permite consultar su propio doc en authorized_users pero no el ajeno ni escribir', async () => {
        await seedAuthorizedUsers();
        const userDb = testEnv.authenticatedContext('sin_documento').firestore();

        // get propio retorna doc vacio/inexistente pero la operacion esta permitida
        await assertSucceeds(getDoc(doc(userDb, 'authorized_users', 'sin_documento')));
        await assertFails(getDoc(doc(userDb, 'authorized_users', 'medicoA')));
        await assertFails(setDoc(doc(userDb, 'authorized_users', 'sin_documento'), { active: true }));
      });
    });

    describe('2.2. Usuario con active: false en authorized_users', () => {
      it('deniega create, read, update, delete en patients, pendientes y audit_logs', async () => {
        await seedAuthorizedUsers();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, 'patients', 'p_inactivo'), { doctorId: 'inactivo' });
          await setDoc(doc(db, 'pendientes', 't_inactivo'), { doctorId: 'inactivo' });
          await setDoc(doc(db, 'audit_logs', 'log_inactivo'), { doctorId: 'inactivo' });
        });

        const inactiveDb = testEnv.authenticatedContext('inactivo').firestore();

        // patients
        await assertFails(setDoc(doc(inactiveDb, 'patients', 'p_nuevo'), { doctorId: 'inactivo' }));
        await assertFails(getDoc(doc(inactiveDb, 'patients', 'p_inactivo')));
        await assertFails(updateDoc(doc(inactiveDb, 'patients', 'p_inactivo'), { diagnosis: 'Mod' }));
        await assertFails(deleteDoc(doc(inactiveDb, 'patients', 'p_inactivo')));

        // pendientes
        await assertFails(setDoc(doc(inactiveDb, 'pendientes', 't_nuevo'), { doctorId: 'inactivo' }));
        await assertFails(getDoc(doc(inactiveDb, 'pendientes', 't_inactivo')));
        await assertFails(updateDoc(doc(inactiveDb, 'pendientes', 't_inactivo'), { task: 'Mod' }));
        await assertFails(deleteDoc(doc(inactiveDb, 'pendientes', 't_inactivo')));

        // audit_logs
        await assertFails(setDoc(doc(inactiveDb, 'audit_logs', 'log_nuevo'), { doctorId: 'inactivo' }));
      });

      it('deniega leer y escribir clinical_trials para usuario inactivo (active: false)', async () => {
        await seedAuthorizedUsers();
        const inactiveDb = testEnv.authenticatedContext('inactivo').firestore();

        await assertFails(getDoc(doc(inactiveDb, 'clinical_trials', 'trial1')));
        await assertFails(setDoc(doc(inactiveDb, 'clinical_trials', 'trial2'), { title: 'Nuevo' }));
      });

      it('permite leer su propio registro en authorized_users pero deniega de otro y escritura', async () => {
        await seedAuthorizedUsers();
        const inactiveDb = testEnv.authenticatedContext('inactivo').firestore();

        await assertSucceeds(getDoc(doc(inactiveDb, 'authorized_users', 'inactivo')));
        await assertFails(getDoc(doc(inactiveDb, 'authorized_users', 'medicoA')));
        await assertFails(setDoc(doc(inactiveDb, 'authorized_users', 'inactivo'), { active: true }));
      });
    });
  });

  describe('3. Medico Autorizado A (medicoA)', () => {
    describe('3.1. Coleccion patients', () => {
      beforeEach(async () => {
        await seedAuthorizedUsers();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, 'patients', 'pacienteA'), { doctorId: 'medicoA', hcNumber: '1001' });
          await setDoc(doc(db, 'patients', 'pacienteB'), { doctorId: 'medicoB', hcNumber: '2002' });
        });
      });

      it('crear con doctorId propio: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(
          setDoc(doc(dbA, 'patients', 'nuevoPacienteA'), {
            doctorId: 'medicoA',
            hcNumber: '1002',
          })
        );
      });

      it('crear con doctorId de otro medico: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'patients', 'suplantado'), {
            doctorId: 'medicoB',
            hcNumber: '3003',
          })
        );
      });

      it('crear sin doctorId: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'patients', 'sinDoctor'), {
            hcNumber: '4004',
          })
        );
      });

      it('leer paciente propio: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(getDoc(doc(dbA, 'patients', 'pacienteA')));
      });

      it('leer paciente de medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(getDoc(doc(dbA, 'patients', 'pacienteB')));
      });

      it('actualizar paciente propio manteniendo doctorId: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(
          updateDoc(doc(dbA, 'patients', 'pacienteA'), {
            clinicalContext: 'Notas actualizadas',
            doctorId: 'medicoA',
          })
        );
      });

      it('actualizar paciente propio cambiando doctorId a medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          updateDoc(doc(dbA, 'patients', 'pacienteA'), {
            doctorId: 'medicoB',
          })
        );
      });

      it('actualizar paciente de medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          updateDoc(doc(dbA, 'patients', 'pacienteB'), {
            clinicalContext: 'Intento de edicion no autorizada',
          })
        );
      });

      it('borrar paciente propio: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(deleteDoc(doc(dbA, 'patients', 'pacienteA')));
      });

      it('borrar paciente de medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(deleteDoc(doc(dbA, 'patients', 'pacienteB')));
      });
    });

    describe('3.2. Coleccion pendientes', () => {
      beforeEach(async () => {
        await seedAuthorizedUsers();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, 'pendientes', 'tareaA'), { doctorId: 'medicoA', task: 'Pedir TAC' });
          await setDoc(doc(db, 'pendientes', 'tareaB'), { doctorId: 'medicoB', task: 'Pedir RMN' });
        });
      });

      it('crear con doctorId propio: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(
          setDoc(doc(dbA, 'pendientes', 'nuevaTareaA'), {
            doctorId: 'medicoA',
            task: 'Control de laboratorio',
          })
        );
      });

      it('crear con doctorId de otro medico: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'pendientes', 'tareaAjena'), {
            doctorId: 'medicoB',
            task: 'Control ajeno',
          })
        );
      });

      it('crear sin doctorId: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'pendientes', 'tareaSinDoctor'), {
            task: 'Sin doctor',
          })
        );
      });

      it('leer tarea propia: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(getDoc(doc(dbA, 'pendientes', 'tareaA')));
      });

      it('leer tarea de medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(getDoc(doc(dbA, 'pendientes', 'tareaB')));
      });

      it('actualizar tarea propia manteniendo doctorId: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(
          updateDoc(doc(dbA, 'pendientes', 'tareaA'), {
            task: 'Pedir TAC y laboratorio',
            doctorId: 'medicoA',
          })
        );
      });

      it('actualizar tarea propia cambiando doctorId a medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          updateDoc(doc(dbA, 'pendientes', 'tareaA'), {
            doctorId: 'medicoB',
          })
        );
      });

      it('actualizar tarea de medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          updateDoc(doc(dbA, 'pendientes', 'tareaB'), {
            task: 'Modificacion no permitida',
          })
        );
      });

      it('borrar tarea propia: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(deleteDoc(doc(dbA, 'pendientes', 'tareaA')));
      });

      it('borrar tarea de medico B: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(deleteDoc(doc(dbA, 'pendientes', 'tareaB')));
      });
    });

    describe('3.3. Coleccion audit_logs', () => {
      beforeEach(async () => {
        await seedAuthorizedUsers();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, 'audit_logs', 'logExistenteA'), {
            doctorId: 'medicoA',
            action: 'CREATE_PATIENT',
          });
        });
      });

      it('crear con doctorId propio: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(
          setDoc(doc(dbA, 'audit_logs', 'nuevoLog'), {
            doctorId: 'medicoA',
            action: 'UPDATE_PATIENT',
          })
        );
      });

      it('crear con doctorId de otro medico: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'audit_logs', 'logFalso'), {
            doctorId: 'medicoB',
            action: 'DELETE_PATIENT',
          })
        );
      });

      it('crear sin doctorId: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'audit_logs', 'logSinDoctor'), {
            action: 'DELETE_PATIENT',
          })
        );
      });

      it('leer logs: DENEGADO para todos (incluso medicoA)', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(getDoc(doc(dbA, 'audit_logs', 'logExistenteA')));
      });

      it('actualizar logs: DENEGADO para todos', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          updateDoc(doc(dbA, 'audit_logs', 'logExistenteA'), {
            action: 'ALTERADO',
          })
        );
      });

      it('borrar logs: DENEGADO para todos', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(deleteDoc(doc(dbA, 'audit_logs', 'logExistenteA')));
      });
    });

    describe('3.4. Coleccion clinical_trials', () => {
      beforeEach(async () => {
        await seedAuthorizedUsers();
      });

      it('leer clinical_trials: PERMITIDO para medico autorizado', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(getDoc(doc(dbA, 'clinical_trials', 'trial1')));
      });

      it('escribir clinical_trials: DENEGADO para todos (incluso medicoA)', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'clinical_trials', 'trialNuevo'), {
            title: 'Intento de escritura',
          })
        );
        await assertFails(
          updateDoc(doc(dbA, 'clinical_trials', 'trial1'), {
            title: 'Intento de edicion',
          })
        );
        await assertFails(deleteDoc(doc(dbA, 'clinical_trials', 'trial1')));
      });
    });

    describe('3.5. Coleccion authorized_users', () => {
      beforeEach(async () => {
        await seedAuthorizedUsers();
      });

      it('leer solo el propio documento: PERMITIDO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertSucceeds(getDoc(doc(dbA, 'authorized_users', 'medicoA')));
      });

      it('leer documento de otro medico: DENEGADO', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(getDoc(doc(dbA, 'authorized_users', 'medicoB')));
      });

      it('escribir authorized_users: DENEGADO para todos', async () => {
        const dbA = testEnv.authenticatedContext('medicoA').firestore();
        await assertFails(
          setDoc(doc(dbA, 'authorized_users', 'medicoA'), { active: true })
        );
        await assertFails(
          updateDoc(doc(dbA, 'authorized_users', 'medicoA'), { active: false })
        );
        await assertFails(deleteDoc(doc(dbA, 'authorized_users', 'medicoA')));
      });
    });
  });

  describe('4. Coleccion no declarada', () => {
    it('deniega lectura y escritura a cualquier usuario en colecciones no declaradas', async () => {
      await seedAuthorizedUsers();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'otra_coleccion', 'doc1'), { field: 'value' });
      });

      const dbA = testEnv.authenticatedContext('medicoA').firestore();
      await assertFails(getDoc(doc(dbA, 'otra_coleccion', 'doc1')));
      await assertFails(setDoc(doc(dbA, 'otra_coleccion', 'doc2'), { field: 'value' }));
      await assertFails(updateDoc(doc(dbA, 'otra_coleccion', 'doc1'), { field: 'new' }));
      await assertFails(deleteDoc(doc(dbA, 'otra_coleccion', 'doc1')));
    });
  });
});
