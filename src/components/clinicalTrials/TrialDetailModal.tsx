import React from 'react';
import { X, ExternalLink, MapPin, Building, Calendar, ShieldAlert, CheckCircle2, User, Phone, Mail, FileText, AlertCircle } from 'lucide-react';
import { ClinicalTrial } from '../../types/clinicalTrials';

interface Props {
  trial: ClinicalTrial;
  onClose: () => void;
}

export const TrialDetailModal: React.FC<Props> = ({ trial, onClose }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* HEADER */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-md font-mono">
                {trial.nctId || trial.sourceId}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${
                trial.status === 'RECRUITING' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {trial.statusLabel}
              </span>
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-md">
                {trial.phaseNormalized}
              </span>
              {trial.hasCordobaCenter && (
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                  <MapPin size={10} /> Centro en Córdoba
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-gray-900 leading-snug">
              {trial.title}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1">
                <Building size={13} className="text-gray-400" /> {trial.sponsor}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-gray-400" /> Act.: {trial.lastUpdated}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={trial.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <span>Ver ensayo original</span>
              <ExternalLink size={13} />
            </a>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-gray-700">

          {/* CENTROS EN CÓRDOBA Y ARGENTINA */}
          {trial.hasCordobaCenter && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wider mb-2">
                <MapPin size={15} className="text-indigo-600" />
                Centros Activos en Córdoba, Argentina
              </div>
              <ul className="space-y-1.5 pl-2">
                {trial.cordobaCenters.length > 0 ? (
                  trial.cordobaCenters.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-indigo-950 font-bold">
                      <span className="text-indigo-500 mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-indigo-950 font-semibold">Centro en Córdoba identificado por ubicación geográfica.</li>
                )}
              </ul>
            </div>
          )}

          {/* OBJETIVO / RESUMEN */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              Objetivo del Estudio / Resumen
            </h3>
            <p className="bg-gray-50 border border-gray-100 rounded-2xl p-4 leading-relaxed text-gray-700 font-medium">
              {trial.briefSummary || 'Sin resumen registrado.'}
            </p>
          </div>

          {/* INTERVENCIONES Y FÁRMACOS */}
          {trial.interventions.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
                Intervenciones y Fármacos Evaluados
              </h3>
              <div className="flex flex-wrap gap-2">
                {trial.interventions.map((item, i) => (
                  <span key={i} className="bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* BIOMARCADORES DETECTADOS */}
          {trial.biomarkers.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
                Biomarcadores Clave Mencionados en Protocolo
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {trial.biomarkers.map((b, i) => (
                  <span key={i} className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CONDICIONES / TUMORES */}
          {trial.conditions.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
                Condiciones y Patologías
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {trial.conditions.map((c, i) => (
                  <span key={i} className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-md text-[11px] font-medium">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CRITERIOS DE INCLUSIÓN Y EXCLUSIÓN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* INCLUSIÓN */}
            <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 flex flex-col">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Criterios Principales de Inclusión
              </h4>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-80 pr-1">
                {trial.inclusionCriteria.length > 0 ? (
                  trial.inclusionCriteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-emerald-950 font-medium leading-tight">
                      <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                      <span>{c}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-emerald-800 italic">Consultar texto completo en fuente original.</p>
                )}
              </div>
            </div>

            {/* EXCLUSIÓN */}
            <div className="bg-rose-50/40 border border-rose-200/80 rounded-2xl p-4 flex flex-col">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 mb-3 flex items-center gap-1.5">
                <AlertCircle size={15} className="text-rose-600" />
                Criterios Principales de Exclusión
              </h4>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-80 pr-1">
                {trial.exclusionCriteria.length > 0 ? (
                  trial.exclusionCriteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-rose-950 font-medium leading-tight">
                      <span className="text-rose-500 font-bold shrink-0 mt-0.5">✗</span>
                      <span>{c}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-rose-800 italic">Consultar texto completo en fuente original.</p>
                )}
              </div>
            </div>
          </div>

          {/* DATOS DE POBLACIÓN Y CONTACTO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 border border-gray-200/70 rounded-2xl p-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Edad Admitida</span>
              <span className="font-bold text-gray-800">
                {trial.minimumAge || 'Sin mínimo'} — {trial.maximumAge || 'Sin máximo'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Sexo Elegible</span>
              <span className="font-bold text-gray-800">
                {trial.sex === 'ALL' ? 'Ambos sexos' : trial.sex === 'FEMALE' ? 'Solo Femenino' : 'Solo Masculino'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Contacto Principal</span>
              {trial.contact ? (
                <div className="text-[11px] text-gray-700">
                  {trial.contact.name && <div className="font-bold flex items-center gap-1"><User size={11}/>{trial.contact.name}</div>}
                  {trial.contact.email && <div className="flex items-center gap-1 text-blue-600"><Mail size={11}/>{trial.contact.email}</div>}
                  {trial.contact.phone && <div className="flex items-center gap-1"><Phone size={11}/>{trial.contact.phone}</div>}
                </div>
              ) : (
                <span className="text-gray-400 italic">Disponible en el centro participante</span>
              )}
            </div>
          </div>

          {/* LISTA COMPLETA DE CENTROS */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <MapPin size={14} className="text-gray-400" />
              Centros Participantes Registrados ({trial.locations.length})
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-100 rounded-xl p-2 bg-white">
              {trial.locations.map((loc, i) => (
                <div key={i} className={`p-2 rounded-lg text-[11px] flex items-center justify-between ${loc.isCordoba ? 'bg-indigo-50/70 border border-indigo-200' : 'bg-gray-50'}`}>
                  <div>
                    <span className="font-bold text-gray-800">{loc.facility || 'Centro médico'}</span>
                    <span className="text-gray-500 ml-2">({loc.city || 'Ciudad no especificada'}, {loc.state || ''} {loc.country})</span>
                  </div>
                  {loc.isCordoba && (
                    <span className="text-[9px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                      CÓRDOBA
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-gray-50/80 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-500 shrink-0" />
            <span className="text-[11px] leading-tight">
              Los criterios clínicos estructurados deben ser corroborados con el protocolo oficial del patrocinador.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors ml-auto"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
