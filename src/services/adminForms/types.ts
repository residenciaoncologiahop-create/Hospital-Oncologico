export type AdminFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'table';

export interface AdminFormFieldOption {
  label: string;
  value: string;
}

export interface AdminFormField {
  key: string;
  label: string;
  type: AdminFieldType;
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  options?: AdminFormFieldOption[];
  rows?: number; // Para textareas
  helperText?: string;
  gridSpan?: number; // 1 to 12 para layout en grid
  group?: string; // Grupo / Sección dentro del formulario
}

export interface DrugTableRow {
  droga: string;
  concentracion: string;
  envase: string;
  dosisDiaria: string;
  cantidadEnvases: string;
  duracionTto: string;
}

export interface AdminFormContext {
  patient: any;
  historyText: string;
  timeline?: any[];
  files?: any[];
  doctorData?: {
    nombre?: string;
    matricula?: string;
    especialidad?: string;
    cel_area?: string;
    cel_num?: string;
    email?: string;
  };
}

export interface AdminFormDefinition {
  id: string;
  code: string;
  name: string;
  shortName: string;
  institution: string;
  description: string;
  category: 'Prácticas y Estudios' | 'Medicación y Farmacia' | 'Programas Especiales';
  fields: AdminFormField[];
  extractData: (context: AdminFormContext, initialValues?: Record<string, any>) => Promise<Record<string, any>>;
  generatePDF: (data: Record<string, any>, context: AdminFormContext) => Promise<{ blob: Blob; filename: string }>;
}
