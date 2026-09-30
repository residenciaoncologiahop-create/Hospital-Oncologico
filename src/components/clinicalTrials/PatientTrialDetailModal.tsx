import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Eye, 
  Microscope,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  HelpCircle,
  ClipboardList
} from 'lucide-react';
import { PatientMatchingEvaluation, ClinicalTrial, MatchCategory } from '../../types/clinicalTrials';
import { TrialDetailModal } from './TrialDetailModal';
import { isCordobaSiteRecruiting } from '../../services/clinicalTrials/trialMatcher';

interface Props {
  evaluation: PatientMatchingEvaluation;
  onClose: () => void;
  onOpenFullSearch?: () => void;
}

export const PatientTrialDetailModal: React.FC<Props> = ({ evaluation, onClose, onOpenFullSearch }) => {
  const [selectedTrial, setSelectedTrial] = useState<ClinicalTrial | null>(null);
  const [expandedCriteriaTrialId, setExpandedCriteriaTrialId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | MatchCategory>('all');

  const toggleExpand = (trialId: string) => {
    setExpandedCriteriaTrialId(prev => prev === trialId ? null : trialId);
  };

  const filteredMatches = evaluation.matches.filter(m => {
    if (activeFilter === 'all') return true;
    return m.category === activeFilter;
  });

  const candidateCount = evaluation.matches.filter(m => m.category === 'potential_candidate').length;
  const missingDataCount = evaluation.matches.filter(m => m.category === 'potential_missing_data').length;
  const notCompatibleCount = evaluation.matches.filter(m => m.category === 'not_compatible').length;
  const notEvaluableCount = evaluation.matches.filter(m => m.category === 'not_evaluable').length;

  return (
    <>
      <div className="fixed inset-0 z-[115] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
          
          {/* HEADER */}
          <div className="p-6 border-b bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white flex items-start justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <Microscope size={12} />
                  Pre-Screening de Ensayos Clínicos
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
                {evaluation.profile.biomarkersDocumented.length > 0 ? (
                  <span className="flex items-center gap-1">
                    Biomarcadores HC: {evaluation.profile.biomarkersDocumented.map(b => `${b.name} (${b.status})`).join(', ')}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">Sin biomarcadores registrados</span>
                )}
                {typeof evaluation.profile.ecogDocumented === 'number' && (
                  <span className="font-bold text-indigo-700">ECOG: {evaluation.profile.ecogDocumented}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenFullSearch && (
                <button
                  onClick={onOpenFullSearch}
                  className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-xs font-bold text-emerald-800 flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Abrir catálogo completo de ensayos clínicos"
                >
                  <Microscope size={14} className="text-emerald-600" />
                  <span className="hidden sm:inline">Todos los Ensayos</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>


          {/* ADVERTENCIA DE CONFLICTO DIAGNÓSTICO */}
          {evaluation.profile?.diagnosticConflict?.hasConflict && (
            <div className="bg-amber-100/90 border-b border-amber-200 px-6 py-2.5 flex items-start gap-2.5 shrink-0">
              <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 leading-relaxed">
                <span className="font-bold text-amber-900">Se detectó una discrepancia en el caso: </span>
                <span>El campo diagnóstico indica: <strong className="font-semibold">"{evaluation.profile.diagnosticConflict.diagnosisInput || 'No especificado'}"</strong>. </span>
                <span>La historia clínica documenta como primario: <strong className="font-semibold">"{evaluation.profile.diagnosticConflict.historyPrimaryOrgan || 'No especificado'}"</strong>. </span>
                <span className="text-amber-800 font-medium block sm:inline">El pre-screening se está evaluando según el primario documentado en la historia clínica.</span>
              </div>
            </div>
          )}

          {/* FILTER TABS */}
          <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200/70 flex items-center gap-2 overflow-x-auto shrink-0 text-xs font-bold">
            <span className="text-gray-400 uppercase text-[10px] tracking-wider mr-1">Filtrar:</span>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeFilter === 'all'
                  ? 'bg-gray-800 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Todos ({evaluation.matches.length})
            </button>
            {candidateCount > 0 && (
              <button
                onClick={() => setActiveFilter('potential_candidate')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeFilter === 'potential_candidate'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                🟢 Potencialmente elegibles ({candidateCount})
              </button>
            )}
            {missingDataCount > 0 && (
              <button
                onClick={() => setActiveFilter('potential_missing_data')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeFilter === 'potential_missing_data'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                🟡 Falta información ({missingDataCount})
              </button>
            )}
            {notCompatibleCount > 0 && (
              <button
                onClick={() => setActiveFilter('not_compatible')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeFilter === 'not_compatible'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                🔴 No cumple criterio ({notCompatibleCount})
              </button>
            )}
            {notEvaluableCount > 0 && (
              <button
                onClick={() => setActiveFilter('not_evaluable')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeFilter === 'not_evaluable'
                    ? 'bg-gray-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                ⚪ No evaluables ({notEvaluableCount})
              </button>
            )}
          </div>

          {/* MATCHING LIST */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-gray-50/40">
            {filteredMatches.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center text-gray-500 space-y-2">
                <Microscope size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="font-bold text-base text-gray-800">
                  No se encontraron ensayos compatibles con los criterios documentados.
                </p>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Esto indica que no se identificó coincidencia con la información actualmente disponible en la historia clínica.
                </p>
              </div>
            ) : (
              filteredMatches.map((m) => {
                const isExpanded = expandedCriteriaTrialId === m.trial.id;
                const criteria = m.criteriaEvaluations || [];
                const inclusions = criteria.filter(c => !c.isExclusion);
                const exclusions = criteria.filter(c => c.isExclusion);
                const nonEvaluable = criteria.filter(c => c.status === 'NO EVALUABLE');

                return (
                  <div 
                    key={m.trial.id} 
                    className="bg-white border border-gray-200/80 hover:border-indigo-200 rounded-2xl p-5 shadow-sm space-y-4 transition-all"
                  >
                    {/* TRIAL HEADER IN CARD */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-[280px]">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* BADGE CATEGORIA GLOBAL (4 ESTADOS) */}
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                            m.category === 'potential_candidate'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.category === 'potential_missing_data'
                              ? 'bg-amber-100 text-amber-800'
                              : m.category === 'not_compatible'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {m.categoryBadge}
                          </span>

                          {/* BADGE CORDOBA: Diferencia estricta entre Recruiting de sede vs no recruiting */}
                          {isCordobaSiteRecruiting(m.trial) ? (
                            <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                              <MapPin size={10} /> Córdoba · Recruiting
                            </span>
                          ) : m.trial.hasCordobaCenter ? (
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md flex items-center gap-1 border border-gray-200">
                              <MapPin size={10} /> Córdoba · {m.trial.cordobaRecruitingStatus === 'NOT_YET_RECRUITING' ? 'Aún no recluta' : m.trial.cordobaRecruitingStatus === 'SUSPENDED' ? 'Suspendido' : 'Estado no confirmado'}
                            </span>
                          ) : null}

                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                            {m.trial.phaseNormalized}
                          </span>

                          <span className="text-[10px] font-mono font-bold text-gray-500">
                            {m.trial.nctId}
                          </span>
                        </div>

                        <h3 className="text-sm font-black text-gray-900 leading-snug pt-0.5">
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
                          <span>Ver protocolo</span>
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

                    {/* SECCIÓN ACCIONABLE: QUÉ LE FALTA AL PACIENTE PARA COMPLETAR EL PRE-SCREENING */}
                    {m.missingItems && m.missingItems.length > 0 && (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                          <ClipboardList size={14} className="text-amber-600" />
                          ¿Qué falta para completar el pre-screening? ({m.missingItems.length})
                        </div>
                        <ul className="space-y-1 text-xs text-amber-950 font-medium pl-1">
                          {m.missingItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-amber-600 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* RESUMEN RÁPIDO DE COINCIDENCIAS / INCOMPATIBILIDADES */}
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

                      {/* INCOMPATIBILIDADES O ADVERTENCIAS */}
                      {m.incompatibilities.length > 0 ? (
                        <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                            <AlertCircle size={13} className="text-rose-600" />
                            Criterios no cumplidos / Exclusiones ({m.incompatibilities.length})
                          </div>
                          <div className="space-y-1">
                            {m.incompatibilities.map((item, i) => (
                              <div key={i} className="text-rose-950 font-medium leading-tight pl-2 border-l-2 border-rose-400">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-blue-600" />
                            Exclusiones
                          </div>
                          <p className="text-blue-950 font-medium text-xs">
                            No se detectaron criterios de exclusión activos en los datos disponibles.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* TOGGLE DESGLOSE DE CRITERIOS ESTRUCTURADOS CON SOURCE TEXT */}
                    {criteria.length > 0 && (
                      <div className="border-t border-gray-100 pt-3">
                        <button
                          onClick={() => toggleExpand(m.trial.id)}
                          className="flex items-center justify-between w-full py-1 text-xs font-bold text-gray-700 hover:text-indigo-600 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <FileQuestion size={14} className="text-indigo-500" />
                            <span>Desglose detallado criterio por criterio ({criteria.length} evaluados)</span>
                          </span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200/80">
                            
                            {/* CRITERIOS DE INCLUSIÓN */}
                            {inclusions.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                  Criterios de Inclusión ({inclusions.length})
                                </h4>
                                <div className="space-y-2">
                                  {inclusions.map((c) => (
                                    <div key={c.id} className="bg-white p-3 rounded-lg border border-gray-200 text-xs space-y-1 shadow-xs">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-gray-800">{c.name}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                          c.status === 'CUMPLE'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : c.status === 'NO CUMPLE'
                                            ? 'bg-rose-100 text-rose-800'
                                            : c.status === 'NO DOCUMENTADO'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}>
                                          {c.status}
                                        </span>
                                      </div>
                                      {c.patientValueDescription && (
                                        <div className="text-[11px] text-gray-600 font-medium">
                                          <span className="font-semibold text-gray-500">Dato paciente:</span> {c.patientValueDescription}
                                        </div>
                                      )}
                                      <div className="text-[10px] text-gray-400 italic bg-gray-50 p-1.5 rounded font-mono break-words">
                                        Texto original: &ldquo;{c.sourceText}&rdquo;
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* CRITERIOS DE EXCLUSIÓN */}
                            {exclusions.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-gray-200">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-900 flex items-center gap-1">
                                  <AlertCircle size={12} className="text-rose-600" />
                                  Criterios de Exclusión ({exclusions.length})
                                </h4>
                                <div className="space-y-2">
                                  {exclusions.map((c) => (
                                    <div key={c.id} className="bg-white p-3 rounded-lg border border-gray-200 text-xs space-y-1 shadow-xs">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-gray-800">{c.name}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                          c.status === 'CUMPLE'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : c.status === 'NO CUMPLE'
                                            ? 'bg-rose-100 text-rose-800'
                                            : c.status === 'NO DOCUMENTADO'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}>
                                          {c.status === 'NO CUMPLE' ? 'EXCLUSIÓN PRESENTE' : c.status === 'CUMPLE' ? 'SIN EXCLUSIÓN' : c.status}
                                        </span>
                                      </div>
                                      {c.patientValueDescription && (
                                        <div className="text-[11px] text-gray-600 font-medium">
                                          <span className="font-semibold text-gray-500">Dato paciente:</span> {c.patientValueDescription}
                                        </div>
                                      )}
                                      <div className="text-[10px] text-gray-400 italic bg-gray-50 p-1.5 rounded font-mono break-words">
                                        Texto original: &ldquo;{c.sourceText}&rdquo;
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* CRITERIOS NO EVALUABLES AUTOMÁTICAMENTE */}
                            {nonEvaluable.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-gray-200">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-700 flex items-center gap-1">
                                  <HelpCircle size={12} className="text-gray-500" />
                                  Criterios no evaluables automáticamente ({nonEvaluable.length})
                                </h4>
                                <div className="space-y-1.5">
                                  {nonEvaluable.map((c) => (
                                    <div key={c.id} className="bg-white p-2.5 rounded-lg border border-gray-200 text-[11px] text-gray-600 space-y-1">
                                      <div className="font-semibold text-gray-800">{c.name}</div>
                                      <div className="text-[10px] text-gray-400 italic bg-gray-50 p-1 rounded font-mono">
                                        &ldquo;{c.sourceText}&rdquo;
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    )}

                    {/* CENTROS EN CÓRDOBA */}
                    {m.trial.hasCordobaCenter && (
                      <div className="text-[11px] text-indigo-900 bg-indigo-50/60 rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <MapPin size={13} className="text-indigo-600" />
                          Centros Córdoba: {m.trial.cordobaCenters.join(', ') || 'Centro médico en Córdoba'}
                        </span>
                        <span className="font-semibold text-indigo-700">
                          {isCordobaSiteRecruiting(m.trial)
                            ? 'Sede reclutando activamente'
                            : m.trial.cordobaRecruitingStatus === 'NOT_YET_RECRUITING'
                            ? 'Sede: Aún no recluta'
                            : m.trial.cordobaRecruitingStatus === 'SUSPENDED'
                            ? 'Sede: Suspendida'
                            : 'Sede: Estado no confirmado'}
                        </span>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-3 text-xs text-gray-500">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors shrink-0"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>

      {/* MODAL DE PROTOCOLO COMPLETO */}
      {selectedTrial && (
        <TrialDetailModal trial={selectedTrial} onClose={() => setSelectedTrial(null)} />
      )}
    </>
  );
};
