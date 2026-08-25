import React, { useState, useMemo } from 'react';
import { ClipboardCheck, X, AlertTriangle, FileSearch, CheckCircle2, ChevronDown } from 'lucide-react';

export interface AuditAlert {
  category: string;
  summary: string;
  detail: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string | null;
  isLoading: boolean;
  mode?: 'resident' | 'professional';
}

/**
 * Procesa el contenido recibido (JSON estructurado o fallback HTML/texto)
 * y extrae el estado general y la lista de alertas clínicas.
 */
function parseAuditResult(rawContent: string | null): { hasIssues: boolean; alerts: AuditAlert[]; rawFallback?: string } {
  if (!rawContent) return { hasIssues: false, alerts: [] };

  const trimmed = rawContent.trim();

  // 1. Intentar parsear como JSON directo o dentro de bloques markdown ```json ... ```
  try {
    let jsonStr = trimmed;
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = trimmed.substring(firstBrace, lastBrace + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      const rawAlerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
      const alerts: AuditAlert[] = rawAlerts.map((a: any) => ({
        category: a.category || 'General',
        summary: a.summary || a.title || a.message || '',
        detail: a.detail || a.description || a.context || ''
      })).filter((a: AuditAlert) => Boolean(a.summary || a.detail));

      const hasIssues = parsed.hasIssues !== undefined 
        ? Boolean(parsed.hasIssues && alerts.length > 0)
        : alerts.length > 0;

      return { hasIssues: alerts.length > 0 && hasIssues, alerts };
    }
  } catch {
    // Si no es JSON, continuar al fallback
  }

  // 2. Fallback: Análisis de texto / HTML para compatibilidad
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('sin inconsistencias') ||
    lower.includes('no se detectan inconsistencias') ||
    lower.includes('registro completo')
  ) {
    if (!lower.includes('⚠️') && !lower.includes('se detecta ausencia') && !lower.includes('datos faltantes')) {
      return { hasIssues: false, alerts: [] };
    }
  }

  // Extraer ítems de listas <li> o líneas con ⚠️ si existen en HTML
  const liMatches = Array.from(trimmed.matchAll(/<li[^>]*>(.*?)<\/li>/gi));
  if (liMatches.length > 0) {
    const alerts: AuditAlert[] = liMatches
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 0 && !text.toLowerCase().includes('reporte generado'))
      .map(text => {
        const parts = text.split(':');
        if (parts.length > 1) {
          return {
            category: parts[0].replace(/^[-•⚠️\s]+/, '').trim(),
            summary: parts.slice(1).join(':').trim(),
            detail: text
          };
        }
        return {
          category: 'Documentación',
          summary: text.replace(/^[-•⚠️\s]+/, '').trim(),
          detail: text
        };
      });

    if (alerts.length > 0) {
      return { hasIssues: true, alerts };
    }
  }

  // Si no se pudo estructurar, devolver fallback con contenido limpio
  return {
    hasIssues: true,
    alerts: [],
    rawFallback: trimmed
  };
}

const ClinicalAuditModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  content, 
  isLoading, 
  mode = 'resident'
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<number>>(new Set());

  // Limpiar desplegados al abrir o cambiar de contenido
  React.useEffect(() => {
    setExpandedAlerts(new Set());
  }, [content, isOpen]);

  const toggleAlert = (idx: number) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const parsedData = useMemo(() => parseAuditResult(content), [content]);

  if (!isOpen) return null;

  const isProfessional = mode === 'professional';

  const headerTitle = isProfessional 
    ? "Control de Calidad de Historia Clínica" 
    : "Auditoría de Registro Clínico";

  const headerSubtitle = isProfessional 
    ? "Revisión documental asistencial y alertas clínicas" 
    : "Revisión automática de variables y datos faltantes";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-white w-full max-w-xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* HEADER */}
        <div className={`p-4 sm:p-5 border-b flex justify-between items-center ${isProfessional ? 'bg-slate-50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 p-2 rounded-xl text-blue-600 shadow-2xs">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">{headerTitle}</h3>
              <p className="text-[10px] text-gray-500 font-medium">{headerSubtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full p-2 transition-all active:scale-95"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 bg-slate-50/30 scrollbar-hide min-w-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-5">
              <div className="relative">
                <div className="w-14 h-14 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                  <FileSearch size={22}/>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-gray-800 uppercase tracking-widest">
                  {isProfessional ? "Verificando consistencia clínica..." : "Auditando documentación..."}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">Evaluando completitud, estadios e indicaciones</p>
              </div>
            </div>
          ) : content ? (
            <div className="space-y-4">
              
              {/* CASO 1: SIN INCONSISTENCIAS RELEVANTES */}
              {!parsedData.hasIssues || parsedData.alerts.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4 text-emerald-900 shadow-xs animate-in fade-in duration-200">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <h4 className="font-black text-emerald-950 text-sm sm:text-base tracking-tight">
                        Sin inconsistencias relevantes
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium mt-1 leading-relaxed">
                      No se detectaron discrepancias clínicas ni vacíos documentales críticos en los registros evaluados.
                    </p>
                  </div>
                </div>
              ) : (
                /* CASO 2: CON INCONSISTENCIAS / PUNTOS PARA REVISAR */
                <div className="space-y-3">
                  {/* Banner superior de estado */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3.5 text-amber-950 shadow-xs">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                        <h4 className="font-black text-amber-950 text-sm tracking-tight">
                          {parsedData.alerts.length} {parsedData.alerts.length === 1 ? 'punto para revisar' : 'puntos para revisar'}
                        </h4>
                      </div>
                      <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                        Alertas detectadas en la documentación para verificar durante la consulta:
                      </p>
                    </div>
                  </div>

                  {/* Lista concisa de alertas */}
                  <div className="space-y-2 pt-1">
                    {parsedData.alerts.map((alert, idx) => {
                      const isExpanded = expandedAlerts.has(idx);
                      return (
                        <div 
                          key={idx}
                          className="bg-white border border-gray-200 hover:border-amber-300 rounded-xl transition-all shadow-xs overflow-hidden"
                        >
                          <div 
                            onClick={() => toggleAlert(idx)}
                            className="p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="text-amber-500 font-bold shrink-0 mt-0.5 text-sm">⚠️</span>
                              <div className="text-xs sm:text-sm leading-relaxed text-gray-800">
                                <strong className="font-black text-gray-900 uppercase tracking-wide text-xs mr-1.5">{alert.category}:</strong>
                                <span className="text-gray-700 font-medium">{alert.summary}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAlert(idx);
                              }}
                              className="shrink-0 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 flex items-center gap-1 transition-all shadow-2xs active:scale-95"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Ver'}</span>
                              <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-amber-600' : 'text-gray-400'}`} />
                            </button>
                          </div>

                          {/* Detalle contextual desplegable bajo demanda */}
                          {isExpanded && (
                            <div className="px-4 pb-3.5 pt-1 bg-amber-50/30 border-t border-amber-100/60 animate-in fade-in duration-150">
                              <div className="bg-white p-3 rounded-lg border border-amber-200/50 text-xs text-gray-700 leading-relaxed space-y-1">
                                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Contexto documental:</span>
                                <p className="font-normal text-gray-600">{alert.detail || 'Sin contexto adicional documentado.'}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fallback de visualización para texto/HTML no estructurado */}
              {parsedData.rawFallback && (
                <div 
                  className="bg-white p-4 rounded-xl border border-gray-200 text-xs text-gray-700 leading-relaxed space-y-2"
                  dangerouslySetInnerHTML={{ __html: parsedData.rawFallback }}
                />
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <AlertTriangle size={40} className="mb-2 text-gray-300"/>
              <p className="text-xs font-bold uppercase tracking-wide">Sin datos para procesar</p>
            </div>
          )}
        </div>

        {/* FOOTER: Advertencia de Seguridad */}
        <div className="p-3.5 bg-amber-50/80 border-t border-amber-100 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-900 font-medium leading-tight">
            <strong>AVISO:</strong> Soporte para la organización y control documental. 
            No reemplaza la evaluación clínica profesional ni la historia clínica original.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClinicalAuditModal;
