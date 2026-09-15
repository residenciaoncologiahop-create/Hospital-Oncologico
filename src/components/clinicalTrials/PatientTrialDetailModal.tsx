import React, { useState } from 'react';
import { X, ExternalLink, MapPin, CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert, Eye, User, FileText } from 'lucide-react';
import { PatientMatchingEvaluation, TrialMatchResult, ClinicalTrial } from '../../types/clinicalTrials';
import { TrialDetailModal } from './TrialDetailModal';

interface Props {
  evaluation: PatientMatchingEvaluation;
  onClose: () => void;
}

export const PatientTrialDetailModal: React.FC<Props> = ({ evaluation, onClose }) => {
  const [selectedTrial, setSelectedTrial] = useState<ClinicalTrial | null>(null);

  return (
    <>
      <div className="fixed inset-0 z-[115] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
          
          {/* HEADER */}
          <div className="p-6 border-b bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-white flex items-start justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                  Candidatos para Paciente
                </span>
                <span className="text-xs font-mono font-bold text-gray-500">
                  HC: {evaluation.hcNumber}
                </span>
                {evaluation.stageDocumented ? (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                    {evaluation.stageDocumented}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                    Estadio no documentado
                  </span>
                )}
              </div>
              <h2 className="text-base font-black text-gray-900">
                {evaluation.patientName} — <span className="font-bold text-gray-600">{evaluation.diagnosis}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-600 font-medium">
                <span>Edad: {evaluation.profile.age ? `${evaluation.profile.age} años` : 'No documentada'}</span>
                <span>Sexo: {evaluation.profile.sex === 'MALE' ? 'Masculino' : evaluation.profile.sex === 'FEMALE' ? 'Femenino' : 'No documentado'}</span>
                {evaluation.profile.biomarkersDocumented.length > 0 && (
                  <span className="flex items-center gap-1">
                    Biomarcadores HC: {evaluation.profile.biomarkersDocumented.map(b => `${b.name} (${b.status})`).join(', ')}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* OBLIGATORY LEGAL & MEDICAL NOTICE */}
          <div className="bg-amber-50/80 border-b border-amber-200/80 px-6 py-3 flex items-center gap-3 shrink-0">
            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
            <div className="text-xs font-bold text-amber-900 leading-tight">
              Paciente potencialmente elegible. Requiere verificación de criterios por el equipo investigador.
            </div>
          </div>

          {/* MATCHING LIST */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-gray-50/40">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1">
              <span>Ensayos evaluados con compatibilidad clínica ({evaluation.matches.length}):</span>
              <span className="text-[11px] text-gray-400">Ordenados por: Recruiting, Centro en Córdoba y Coincidencia</span>
            </div>

            {evaluation.matches.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center text-gray-500">
                <p className="font-bold">No se encontraron ensayos compatibles con los criterios documentados.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Esto indica que no se identificó coincidencia con la información actualmente disponible en la historia clínica.
                </p>
              </div>
            ) : (
              evaluation.matches.map((m, idx) => (
                <div 
                  key={m.trial.id} 
                  className="bg-white border border-gray-200/80 hover:border-indigo-200 rounded-2xl p-5 shadow-sm space-y-4 transition-all"
                >
                  {/* TRIAL HEADER IN CARD */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* BADGE CATEGORIA */}
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                          m.category === 'potential_candidate'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {m.categoryBadge}
                        </span>

                        {/* BADGE CORDOBA */}
                        {m.trial.hasCordobaCenter && (
                          <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                            <MapPin size={10} /> Córdoba · Recruiting
                          </span>
                        )}

                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                          {m.trial.phaseNormalized}
                        </span>

                        <span className="text-[10px] font-mono font-bold text-gray-500">
                          {m.trial.nctId}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-gray-900 leading-snug pt-1">
                        {m.trial.title}
                      </h3>

                      <div className="text-xs text-gray-500 font-medium">
                        Patrocinador: <span className="text-gray-700 font-semibold">{m.trial.sponsor}</span> · 
                        Actualizado: {m.trial.lastUpdated}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedTrial(m.trial)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                      >
                        <Eye size={13} />
                        <span>Ver ensayo</span>
                      </button>

                      <a
                        href={m.trial.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors"
                        title="Abrir en ClinicalTrials.gov"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>

                  {/* THREE STRUCTURED SECTIONS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* COINCIDENCIAS ENCONTRADAS */}
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Coincidencias encontradas ({m.matches.length})
                      </div>
                      <div className="space-y-1">
                        {m.matches.map((item, i) => (
                          <div key={i} className="text-emerald-950 font-medium leading-tight pl-2 border-l-2 border-emerald-400">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* DATOS FALTANTES */}
                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-amber-600" />
                        Datos faltantes ({m.missingData.length})
                      </div>
                      <div className="space-y-1">
                        {m.missingData.length > 0 ? (
                          m.missingData.map((item, i) => (
                            <div key={i} className="text-amber-950 font-medium leading-tight pl-2 border-l-2 border-amber-400">
                              {item}
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 italic">No se detectaron faltantes clínicos críticos preliminares.</div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* POSIBLES INCOMPATIBILIDADES O ADVERTENCIAS */}
                  {m.incompatibilities.length > 0 && (
                    <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-1 text-xs">
                      <div className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                        <AlertCircle size={13} className="text-rose-600" />
                        Posibles incompatibilidades / advertencias
                      </div>
                      {m.incompatibilities.map((item, i) => (
                        <div key={i} className="text-rose-950 font-medium leading-tight pl-2 border-l-2 border-rose-400">
                          {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CENTROS PARTICIPANTES */}
                  {m.trial.hasCordobaCenter && (
                    <div className="text-[11px] text-indigo-900 bg-indigo-50/60 rounded-xl px-3 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <MapPin size={13} className="text-indigo-600" />
                        Centros Córdoba: {m.trial.cordobaCenters.join(', ') || 'Centro médico en Córdoba'}
                      </span>
                      <span className="font-semibold text-indigo-700">Reclutando activamente</span>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>Análisis determinístico de solo lectura. No modifica la HC del paciente.</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>

      {/* MODAL DE ENSAYO COMPLETO SI SE SELECCIONA */}
      {selectedTrial && (
        <TrialDetailModal trial={selectedTrial} onClose={() => setSelectedTrial(null)} />
      )}
    </>
  );
};
