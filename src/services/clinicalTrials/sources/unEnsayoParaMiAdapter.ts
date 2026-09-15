import { ClinicalTrial } from '../../../types/clinicalTrials';

/**
 * Adaptador para "Un Ensayo para Mí" (Trialtech SL)
 * 
 * Estado de la investigación:
 * "Un Ensayo para Mí" es una plataforma privada que conecta pacientes con centros de investigación.
 * No dispone de una API pública abierta para desarrolladores, y sus Términos y Condiciones
 * de Servicio restringen expresamente el scraping automatizado sin autorización previa.
 * 
 * Directiva cumplida:
 * Siguiendo las directivas del proyecto ("NO hacer scraping sin verificar previamente condiciones de uso",
 * "dejar preparada una capa de fuente independiente para incorporarla posteriormente"), este adaptador
 * define la interfaz desacoplada para vincularse mediante API Partner, Webhook institucional o convenio
 * de datos sin comprometer la legalidad ni la estabilidad del sistema.
 */

export interface UnEnsayoParaMiConfig {
  partnerId?: string;
  authToken?: string;
  feedUrl?: string;
}

export class UnEnsayoParaMiAdapter {
  readonly sourceName = 'unensayoparami';
  readonly isLiveApiAvailable = false;

  async fetchTrials(_config?: UnEnsayoParaMiConfig): Promise<ClinicalTrial[]> {
    console.info('[Un Ensayo para Mí Adapter] Requiere integración oficial autorizada o API Partner. Arquitectura desacoplada lista.');
    return [];
  }

  getStatusInfo() {
    return {
      name: 'Un Ensayo para Mí',
      status: 'PREPARADA_PARA_CONVENIO',
      description: 'Plataforma privada de Trialtech SL. Requiere acuerdo de integración institucional conforme a sus Términos de Servicio.'
    };
  }
}

export const unEnsayoParaMiAdapter = new UnEnsayoParaMiAdapter();
