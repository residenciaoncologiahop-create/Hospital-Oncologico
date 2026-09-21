/**
 * migratePatientProfiles.ts
 *
 * Migración única: recorre todos los pacientes del médico en Firestore
 * y les agrega los campos de perfil oncológico estructurado
 * (stage, stageConfidence, organOrSite, isMetastatic, biomarkersStructured)
 * si aún no los tienen o si stageConfidence no es 'confirmed'.
 *
 * Se dispara desde el botón "Actualizar estadios" en PracticeStatsModal.
 * Es idempotente: si se ejecuta varias veces no pisa los datos confirmados manualmente.
 */

import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { computePatientOncologicalProfile } from './computePatientProfile';
import { cleanForFirestore } from '../services/patientService';

export interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;    // ya tenían stageConfidence === 'confirmed'
  pending: number;    // stage resultó 'No consignado' (necesitan revisión manual)
  errors: number;
}

/**
 * Migra los perfiles de todos los pacientes del médico (doctorId).
 * @param doctorId   UID del médico autenticado
 * @param onProgress Callback opcional llamado con el progreso (paciente actual, total)
 */
export async function migratePatientProfiles(
  doctorId: string,
  onProgress?: (current: number, total: number) => void
): Promise<MigrationResult> {
  const result: MigrationResult = { total: 0, updated: 0, skipped: 0, pending: 0, errors: 0 };

  // Firestore write batches tienen límite de 500 ops; usamos múltiples si es necesario.
  const BATCH_SIZE = 450;

  try {
    const q = query(collection(db, 'patients'), where('doctorId', '==', doctorId));
    const snapshot = await getDocs(q);
    result.total = snapshot.docs.length;

    let batch = writeBatch(db);
    let batchCount = 0;

    for (let i = 0; i < snapshot.docs.length; i++) {
      const docSnap = snapshot.docs[i];
      const data = docSnap.data();

      onProgress?.(i + 1, result.total);

      // No tocar pacientes con estadio confirmado manualmente
      if (data.stageConfidence === 'confirmed') {
        result.skipped++;
        continue;
      }

      try {
        const computed = computePatientOncologicalProfile(
          data.diagnosis || '',
          data.historyText || '',
          data.clinicalContext || ''
        );

        const updatePayload = cleanForFirestore({
          stage: computed.stage,
          stageConfidence: computed.stageConfidence,
          organOrSite: computed.organOrSite,
          isMetastatic: computed.isMetastatic,
          biomarkersStructured: computed.biomarkersStructured,
        });

        batch.update(doc(db, 'patients', docSnap.id), updatePayload);
        batchCount++;

        if (computed.stage === 'No consignado') {
          result.pending++;
        } else {
          result.updated++;
        }

        // Commit batch cuando alcanza el límite
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      } catch (err) {
        console.error(`Error procesando paciente ${docSnap.id}:`, err);
        result.errors++;
      }
    }

    // Commit del último batch parcial
    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error('Error en migratePatientProfiles:', err);
    throw err;
  }

  return result;
}
