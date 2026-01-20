import React, { useState } from 'react';
import { Stethoscope, GraduationCap, ChevronRight } from 'lucide-react';
import ResidentApp from './ResidentApp';

// --- COMPONENTES AUXILIARES DEL ORQUESTADOR ---

/**
 * PANTALLA DE SELECCIÓN DE MODO
 * Responsabilidad: Permitir al usuario elegir entre flujo Profesional o Residente.
 */
const ModeSelector = ({ onSelect }: { onSelect: (mode: 'doctor' | 'resident') => void }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* OPCIÓN 1: MODO PROFESIONAL */}
        <button 
          onClick={() => onSelect('doctor')}
          className="group relative bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-blue-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl text-left"
        >
          <div className="absolute top-8 right-8 bg-blue-50 text-blue-600 p-3 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Stethoscope size={32} />
          </div>
          <div className="mt-12">
            <h2 className="text-2xl font-black text-gray-800 mb-2 tracking-tight group-hover:text-blue-600 transition-colors">
              Ingreso Profesional
            </h2>
            <p className="text-sm text-gray-400 font-medium leading-relaxed max-w-xs">
              Acceso completo con persistencia de datos (Firebase), historial y auditoría. Requiere identificación.
            </p>
            <div className="mt-8 flex items-center text-blue-600 font-black text-xs uppercase tracking-widest">
              <span>Ingresar</span>
              <ChevronRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </button>

        {/* OPCIÓN 2: MODO RESIDENTE */}
        <button 
          onClick={() => onSelect('resident')}
          className="group relative bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-indigo-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl text-left"
        >
          <div className="absolute top-8 right-8 bg-indigo-50 text-indigo-600 p-3 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <GraduationCap size={32} />
          </div>
          <div className="mt-12">
            <h2 className="text-2xl font-black text-gray-800 mb-2 tracking-tight group-hover:text-indigo-600 transition-colors">
              Modo Residente
            </h2>
            <p className="text-sm text-gray-400 font-medium leading-relaxed max-w-xs">
              Espacio temporal y educativo. Sin persistencia de datos. Incluye herramientas de aprendizaje y ateneo.
            </p>
            <div className="mt-8 flex items-center text-indigo-600 font-black text-xs uppercase tracking-widest">
              <span>Acceder</span>
              <ChevronRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </button>

      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

interface RootOrchestratorProps {
  DoctorApp: React.ComponentType;
}

/**
 * ROOT ORCHESTRATOR
 * Responsabilidad: Gestionar el estado global del modo de aplicación e inyectar la dependencia.
 */
const RootOrchestrator: React.FC<RootOrchestratorProps> = ({ DoctorApp }) => {
  const [appMode, setAppMode] = useState<'selection' | 'doctor' | 'resident'>('selection');

  if (appMode === 'selection') {
    return <ModeSelector onSelect={setAppMode} />;
  }

  if (appMode === 'resident') {
    return <ResidentApp />;
  }

  // Renderiza la App original (inyectada) sin tocar su código interno
  return <DoctorApp />;
};

export default RootOrchestrator;
