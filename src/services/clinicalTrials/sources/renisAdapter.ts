import { ClinicalTrial } from '../../../types/clinicalTrials';

/**
 * Adaptador para RENIS (Registro Nacional de Investigaciones en Salud - ANMAT / Ministerio de Salud de la Nación)
 * 
 * Estado de la investigación:
 * El registro RENIS se gestiona a través de la plataforma SISA (Sistema Integrado de Información Sanitaria Argentino)
 * y el portal de ANMAT. Actualmente no dispone de una API REST pública y abierta sin autenticación institucional
 * para consumo masivo en tiempo real. Los datos son accesibles mediante consulta web o descarga de datasets periódicos
 * en el portal de Datos Abiertos de Salud.
 * 
 * Directiva cumplida:
 * Siguiendo las directivas del proyecto ("NO hacer scraping frágil si existe una fuente estructurada"),
 * esta capa queda preparada con su interfaz para conectarse a un feed estructurado o dataset oficial de ANMAT/RENIS
 * en una segunda etapa.
 */

export interface RenisSourceConfig {
  apiKey?: string;
  endpointUrl?: string;
  datasetDate?: string;
}

export class RenisAdapter {
  readonly sourceName = 'renis';
  readonly isLiveApiAvailable = false;

  async fetchTrials(_config?: RenisSourceConfig): Promise<ClinicalTrial[]> {
    // Arquitectura preparada: cuando se suministre un dataset oficial o endpoint habilitado
    // se parseará al modelo ClinicalTrial conservando source: 'renis', sourceId y lastUpdated.
    console.info('[RENIS Adapter] La fuente oficial requiere consulta vía SISA o carga de dataset estructurado ANMAT. Arquitectura preparada.');
    return [];
  }

  getStatusInfo() {
    return {
      name: 'RENIS / ANMAT',
      status: 'PREPARADA_PARA_FASE_2',
      description: 'Registro Nacional de Investigaciones en Salud de Argentina. Requiere conexión institucional SISA o dataset abierto formal.'
    };
  }
}

export const renisAdapter = new RenisAdapter();
