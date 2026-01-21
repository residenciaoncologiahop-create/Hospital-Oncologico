import React, { useState } from 'react';
import { Stethoscope, GraduationCap, ChevronRight, Calculator, Pill, X } from 'lucide-react';
import ResidentApp from './ResidentApp';
import OncoCalculator from './components/OncoCalculator';
import DrugReference from './components/DrugReference';

// --- COMPONENTES AUXILIARES ---

/**
 * PANTALLA DE SELECCIÓN DE MODO
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

<ClinicalAuditModal 
  isOpen={showQCModal} 
  onClose={() => setShowQCModal(false)} 
  content={qcContent} 
  isLoading={isQCProcessing}
  mode="professional"
/>

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

// --- ORQUESTADOR PRINCIPAL ---

interface RootOrchestratorProps {
  DoctorApp: React.ComponentType;
}

const RootOrchestrator: React.FC<RootOrchestratorProps> = ({ DoctorApp }) => {
  const [appMode, setAppMode] = useState<'selection' | 'doctor' | 'resident'>('selection');
  
  // Estados para herramientas globales (Modo Profesional)
  const [showDocCalc, setShowDocCalc] = useState(false);
  const [showDocDrugs, setShowDocDrugs] = useState(false);

  // --- RENDERIZADO ---

  if (appMode === 'selection') {
    return <ModeSelector onSelect={setAppMode} />;
  }

  if (appMode === 'resident') {
    return <ResidentApp />;
  }

  // MODO DOCTOR + OVERLAY DE HERRAMIENTAS
  return (
    <div className="relative">
      {/* 1. La App original (intacta) */}
      <DoctorApp />

      {/* 2. Botones Flotantes (REUBICADOS ARRIBA A LA DERECHA) */}
      {/* Cambiado de 'bottom-6' a 'top-24' para no tapar el chat */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 animate-in fade-in slide-in-from-right-8 duration-500">
        <button 
          onClick={() => setShowDocCalc(true)}
          className="flex items-center gap-2 bg-white text-gray-600 p-3 rounded-full shadow-lg border border-gray-100 hover:text-blue-600 hover:border-blue-200 transition-all group"
          title="Calculadora Oncológica"
        >
          <Calculator size={20} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:px-2 transition-all duration-300 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
            Calculadora
          </span>
        </button>
        
        <button 
          onClick={() => setShowDocDrugs(true)}
          className="flex items-center gap-2 bg-white text-gray-600 p-3 rounded-full shadow-lg border border-gray-100 hover:text-purple-600 hover:border-purple-200 transition-all group"
          title="Vademécum"
        >
          <Pill size={20} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:px-2 transition-all duration-300 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
            Fármacos
          </span>
        </button>
      </div>

      {/* 3. Modales Globales */}
      {showDocCalc && <OncoCalculator onClose={() => setShowDocCalc(false)} />}
      {showDocDrugs && <DrugReference onClose={() => setShowDocDrugs(false)} />}
    </div>
  );
};

export default RootOrchestrator;
