import { AdminFormDefinition } from './types';
import { form03PracticasDefinition } from './form03Practicas';
import { solicitudMedicamentosDefinition } from './solicitudMedicamentos';
import { derivacionProfeDefinition } from './derivacionProfe';

export const ADMIN_FORMS_REGISTRY: AdminFormDefinition[] = [
  form03PracticasDefinition,
  solicitudMedicamentosDefinition,
  derivacionProfeDefinition,
];

export const getAdminFormById = (id: string): AdminFormDefinition | undefined => {
  return ADMIN_FORMS_REGISTRY.find(f => f.id === id);
};

export const getAdminFormsByCategory = (category: string): AdminFormDefinition[] => {
  return ADMIN_FORMS_REGISTRY.filter(f => f.category === category);
};
