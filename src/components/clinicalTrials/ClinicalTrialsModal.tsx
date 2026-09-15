import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, RefreshCw, Filter, MapPin, ExternalLink, Eye, 
  ShieldAlert, Users, Microscope, CheckCircle2, AlertTriangle, 
  Building, Calendar, Clock, ChevronRight, Dna, FileSpreadsheet
} from 'lucide-react';
import { ClinicalTrial, DoctorMatchingSummary, PatientMatchingEvaluation } from '../../types/clinicalTrials';
import { getStoredClinicalTrials, syncAndStoreTrials } from '../../services/clinicalTrials/clinicalTrialStorage';
import { analyzeDoctorPatients } from '../../services/clinicalTrials/trialMatcher';
import { TrialDetailModal } from './TrialDetailModal';
import { PatientTrialDetailModal } from './PatientTrialDetailModal';

interface Props {
  patients: any[];
  onClose: () => void;
}

type ActiveTab = 'search' | 'matching';
type LocationFilter = 'cordoba' | 'argentina' | 'all';

export const ClinicalTrialsModal: React.FC<Props> = ({ patients, onClose }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [trials, setTrials] = useState<ClinicalTrial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Filtros del Buscador
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('cordoba'); // Por defecto Córdoba
  const [tumorFilter, setTumorFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [biomarkerFilter, setBiomarkerFilter] = useState<string>('all');

  // Modales de detalle
  const [detailTrial, setDetailTrial] = useState<ClinicalTrial | null>(null);
  const [detailEvaluation, setDetailEvaluation] = useState<PatientMatchingEvaluation | null>(null);

  // Estado del Matching con pacientes
  const [matchingSummary, setMatchingSummary] = useState<DoctorMatchingSummary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 1. Carga inicial de ensayos almacenados o sincronizados
  useEffect(() => {
    let mounted = true;

    async function loadTrials() {
      setIsLoading(true);
      try {
        const { trials: loaded, lastSync } = await getStoredClinicalTrials();
        if (!mounted) return;

        if (loaded && loaded.length > 0) {
          setTrials(loaded);
          setLastSyncTime(lastSync);
          setIsLoading(false);
        } else {
          // Si no hay ensayos almacenados, realizar primera sincronización automática
          setSyncMessage('Cargando ensayos clínicos de Argentina...');
          const res = await syncAndStoreTrials((msg) => {
            if (mounted) setSyncMessage(msg);
          });
          if (mounted) {
            setTrials(res.trials);
            setLastSyncTime(res.timestamp);
            setIsLoading(false);
            setSyncMessage(null);
          }
        }
      } catch (err) {
        console.error('Error cargando ensayos:', err);
        if (mounted) {
          setIsLoading(false);
          setSyncMessage('Error de conexión con fuentes de ensayos.');
        }
      }
    }

    loadTrials();

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Sincronización manual bajo demanda
  const handleSyncTrials = async () => {
    setIsSyncing(true);
    setSyncMessage('Iniciando sincronización...');
    try {
      const res = await syncAndStoreTrials((msg) => setSyncMessage(msg));
      setTrials(res.trials);
      setLastSyncTime(res.timestamp);
      // Si ya existía un análisis de pacientes, resetearlo o re-analizar
      if (matchingSummary) {
        const newSummary = analyzeDoctorPatients(patients, res.trials);
        setMatchingSummary(newSummary);
      }
    } catch (err) {
      console.error('Error sincronizando ensayos:', err);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // 3. Ejecutar análisis de matching de pacientes bajo demanda
  const handleAnalyzePatients = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const summary = analyzeDoctorPatients(patients, trials);
      setMatchingSummary(summary);
      setIsAnalyzing(false);
    }, 200);
  };

  // 4. Filtrado y ordenamiento de ensayos en el buscador
  const filteredTrials = useMemo(() => {
    let list = [...trials];

    // Filtro de ubicación
    if (locationFilter === 'cordoba') {
      // Priorizar Córdoba: los que tienen centro en Córdoba primero, luego el resto de Argentina
      // O si se filtra estrictamente Córdoba:
      // El requerimiento dice: "Por defecto: ARGENTINA + priorizar CÓRDOBA. Mostrar primero estudios con centros activos/reclutando en Córdoba. Luego otros estudios potencialmente relevantes en Argentina."
      // Ordenaremos poniendo Córdoba arriba
    } else if (locationFilter === 'argentina') {
      list = list.filter(t => t.hasArgentinaCenter);
    }

    // Filtro de tumor
    if (tumorFilter !== 'all') {
      list = list.filter(t => t.tumorTypes.includes(tumorFilter));
    }

    // Filtro de fase
    if (phaseFilter !== 'all') {
      list = list.filter(t => t.phaseNormalized.toLowerCase().includes(phaseFilter.toLowerCase()));
    }

    // Filtro de estado
    if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter);
    }

    // Filtro de biomarcador
    if (biomarkerFilter !== 'all') {
      list = list.filter(t => t.biomarkers.some(b => b.toUpperCase() === biomarkerFilter.toUpperCase()));
    }

    // Búsqueda de texto libre
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.nctId?.toLowerCase().includes(q) ||
        t.sponsor.toLowerCase().includes(q) ||
        t.conditions.some(c => c.toLowerCase().includes(q)) ||
        t.interventions.some(i => i.toLowerCase().includes(q)) ||
        t.locations.some(l => l.facility?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q))
      );
    }

    // Ordenamiento por defecto:
    // 1. Centros activos en Córdoba primero
    // 2. Recruiting
    // 3. Fecha de actualización reciente
    list.sort((a, b) => {
      if (locationFilter === 'cordoba') {
        if (a.hasCordobaCenter && !b.hasCordobaCenter) return -1;
        if (!a.hasCordobaCenter && b.hasCordobaCenter) return 1;
      }
      const aRec = a.status === 'RECRUITING' ? 1 : 0;
      const bRec = b.status === 'RECRUITING' ? 1 : 0;
      if (aRec !== bRec) return bRec - aRec;

      return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
    });

    return list;
  }, [trials, locationFilter, tumorFilter, phaseFilter, statusFilter, biomarkerFilter, searchTerm]);

  // Lista de biomarcadores disponibles para el selector
  const availableBiomarkers = useMemo(() => {
    const set = new Set<string>();
    for (const t of trials) {
      for (const b of t.biomarkers) set.add(b);
    }
    return Array.from(set).sort();
  }, [trials]);

  // Conteo de centros en Córdoba
  const cordobaCount = useMemo(() => {
    return trials.filter(t => t.hasCordobaCenter).length;
  }, [trials]);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-100">
          
          {/* HEADER PRINCIPAL */}
          <div className="p-5 border-b bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                <Microscope size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded text-indigo-100">
                    Herramienta Clínica Independiente
                  </span>
                  {lastSyncTime && (
                    <span className="text-[10px] text-indigo-200 flex items-center gap-1">
                      <Clock size={11} /> Sincronizado: {new Date(lastSyncTime).toLocaleDateString()} {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <h1 className="text-lg font-black tracking-tight">
                  🔬 Ensayos Clínicos Oncológicos
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncTrials}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/20 disabled:opacity-50"
                title="Sincronizar base de datos de ClinicalTrials.gov y fuentes oficiales"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Actualizando...' : 'Actualizar ensayos'}</span>
              </button>

              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors ml-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* MENSAJE DE ESTADO DE SINCRONIZACIÓN */}
          {syncMessage && (
            <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-2 text-xs font-semibold text-indigo-900 flex items-center gap-2 animate-in fade-in">
              <RefreshCw size={12} className="animate-spin text-indigo-600" />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* AVISO LEGAL Y MÉDICO OBLIGATORIO */}
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-2.5 flex items-center gap-3 shrink-0">
            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
            <p className="text-[11px] font-bold text-amber-950 leading-tight">
              Los resultados indican candidatos potenciales y NO confirman elegibilidad para un ensayo. La elegibilidad definitiva debe ser verificada según el protocolo vigente por el equipo investigador.
            </p>
          </div>

          {/* SELECTOR DE PESTAÑAS */}
          <div className="flex border-b bg-gray-50/70 px-6 shrink-0 gap-2 pt-2">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider rounded-t-2xl border-t-2 transition-all ${
                activeTab === 'search'
                  ? 'bg-white border-indigo-600 text-indigo-700 shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Search size={14} />
              <span>Buscador de Ensayos ({trials.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('matching')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider rounded-t-2xl border-t-2 transition-all ${
                activeTab === 'matching'
                  ? 'bg-white border-indigo-600 text-indigo-700 shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Users size={14} />
              <span>Buscar ensayos para mis pacientes</span>
              {matchingSummary && matchingSummary.patientsWithMatchesCount > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {matchingSummary.patientsWithMatchesCount}
                </span>
              )}
            </button>
          </div>

          {/* CONTENIDO DE LA PESTAÑA SELECCIONADA */}
          <div className="flex-1 overflow-hidden flex flex-col">
            
            {/* ========================================================================= */}
            {/* PESTAÑA 1: BUSCADOR DE ENSAYOS                                            */}
            {/* ========================================================================= */}
            {activeTab === 'search' && (
              <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 bg-gray-50/40">
                
                {/* BARRA DE FILTROS */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm space-y-3 shrink-0">
                  
                  {/* FILA 1: BUSCADOR DE TEXTO Y UBICACIÓN */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    
                    {/* Búsqueda por texto */}
                    <div className="md:col-span-6 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                      <input
                        type="text"
                        placeholder="Buscar por tumor, fármaco, centro, sponsor, NCT ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Filtro de Ubicación (Prioridad Córdoba por defecto) */}
                    <div className="md:col-span-6 flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
                      <button
                        onClick={() => setLocationFilter('cordoba')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          locationFilter === 'cordoba'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-indigo-600'
                        }`}
                      >
                        <MapPin size={12} />
                        <span>Córdoba (Priorizado)</span>
                        <span className="text-[10px] bg-white/20 px-1 rounded ml-0.5">{cordobaCount}</span>
                      </button>

                      <button
                        onClick={() => setLocationFilter('argentina')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                          locationFilter === 'argentina'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-indigo-600'
                        }`}
                      >
                        Toda Argentina
                      </button>

                      <button
                        onClick={() => setLocationFilter('all')}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                          locationFilter === 'all'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-indigo-600'
                        }`}
                      >
                        Todos
                      </button>
                    </div>

                  </div>

                  {/* FILA 2: SELECTORES CLÍNICOS */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    
                    {/* Tumor / Sitio */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Tumor / Sitio</label>
                      <select
                        value={tumorFilter}
                        onChange={(e) => setTumorFilter(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="all">Todos los tumores</option>
                        <option value="colorrectal">Colorrectal / Colon / Recto</option>
                        <option value="pulmon">Pulmón (NSCLC / SCLC)</option>
                        <option value="mama">Mama</option>
                        <option value="melanoma">Melanoma</option>
                        <option value="prostata">Próstata</option>
                        <option value="pancreas">Páncreas</option>
                        <option value="ovario">Ovario</option>
                        <option value="gastrico">Gástrico / Esofágico</option>
                        <option value="rinon">Riñón</option>
                        <option value="vejiga">Vejiga / Urotelio</option>
                        <option value="cervicouterino">Cérvix / Endometrio</option>
                        <option value="cabeza_cuello">Cabeza y Cuello</option>
                        <option value="hematologia">Hematología (Leucemia/Linfoma)</option>
                        <option value="snc">SNC / Glioblastoma</option>
                        <option value="biliar">Vía Biliar</option>
                      </select>
                    </div>

                    {/* Fase */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Fase</label>
                      <select
                        value={phaseFilter}
                        onChange={(e) => setPhaseFilter(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="all">Todas las fases</option>
                        <option value="Fase 3">Fase 3</option>
                        <option value="Fase 2">Fase 2</option>
                        <option value="Fase 1">Fase 1</option>
                        <option value="Fase 4">Fase 4</option>
                      </select>
                    </div>

                    {/* Estado de reclutamiento */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Estado</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="all">Todos los activos</option>
                        <option value="RECRUITING">Reclutando (Recruiting)</option>
                        <option value="NOT_YET_RECRUITING">Aún no recluta</option>
                        <option value="ENROLLING_BY_INVITATION">Por invitación</option>
                      </select>
                    </div>

                    {/* Biomarcador */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Biomarcador</label>
                      <select
                        value={biomarkerFilter}
                        onChange={(e) => setBiomarkerFilter(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="all">Cualquier biomarcador</option>
                        {availableBiomarkers.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                </div>

                {/* CONTADOR DE RESULTADOS */}
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1 shrink-0">
                  <span>
                    Mostrando <strong className="text-gray-800">{filteredTrials.length}</strong> ensayos 
                    {locationFilter === 'cordoba' && (
                      <span className="text-indigo-600 font-bold ml-1">
                        ({filteredTrials.filter(t => t.hasCordobaCenter).length} con centro activo en Córdoba)
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Fuente: ClinicalTrials.gov API v2 (Oficial)
                  </span>
                </div>

                {/* LISTADO DE RESULTADOS */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {isLoading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-indigo-600" />
                      <span className="font-bold">Cargando base de ensayos oncológicos...</span>
                    </div>
                  ) : filteredTrials.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center text-gray-500 space-y-2">
                      <p className="font-bold text-base text-gray-700">No se encontraron ensayos con los filtros seleccionados.</p>
                      <p className="text-xs text-gray-400">Prueba cambiando el tipo de tumor, eliminando el filtro de biomarcador o buscando por otros términos.</p>
                    </div>
                  ) : (
                    filteredTrials.map(trial => (
                      <div
                        key={trial.id}
                        className={`bg-white border rounded-2xl p-4 transition-all hover:shadow-md flex flex-col gap-3 ${
                          trial.hasCordobaCenter 
                            ? 'border-indigo-200/90 shadow-sm bg-gradient-to-r from-indigo-50/20 via-white to-white' 
                            : 'border-gray-200/80 hover:border-gray-300'
                        }`}
                      >
                        {/* CABECERA DE LA TARJETA */}
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1 flex-1 min-w-[280px]">
                            <div className="flex flex-wrap items-center gap-2">
                              
                              {/* BADGE CÓRDOBA */}
                              {trial.hasCordobaCenter && (
                                <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                  <MapPin size={10} /> Centro en Córdoba
                                </span>
                              )}

                              {/* ESTADO */}
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${
                                trial.status === 'RECRUITING' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {trial.statusLabel}
                              </span>

                              {/* FASE */}
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-md">
                                {trial.phaseNormalized}
                              </span>

                              {/* NCT ID */}
                              <span className="text-[10px] font-mono font-bold text-gray-400">
                                {trial.nctId}
                              </span>
                            </div>

                            <h3 className="text-sm font-black text-gray-900 leading-snug pt-1">
                              {trial.title}
                            </h3>
                          </div>

                          {/* ACCIONES */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setDetailTrial(trial)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                            >
                              <Eye size={13} />
                              <span>Ver ficha</span>
                            </button>

                            <a
                              href={trial.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors"
                              title="Abrir fuente original oficial"
                            >
                              <span>Ver ensayo</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>

                        {/* CUERPO INFORMACIÓN DEL ENSAYO */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 pt-1 border-t border-gray-100">
                          <div>
                            <span className="text-[10px] font-black uppercase text-gray-400 block">Sponsor</span>
                            <span className="font-semibold text-gray-800 truncate block">{trial.sponsor}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase text-gray-400 block">Patología / Tumor</span>
                            <span className="font-medium text-gray-700 truncate block">
                              {trial.conditions.slice(0, 2).join(', ') || 'No especificada'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase text-gray-400 block">Centros / Localidad</span>
                            <span className="font-medium text-gray-700 truncate block">
                              {trial.hasCordobaCenter ? 'Córdoba y otros centros' : 'Argentina'}
                            </span>
                          </div>
                        </div>

                        {/* BIOMARCADORES Y DETALLES EXTRA */}
                        {trial.biomarkers.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Biomarcadores:</span>
                            {trial.biomarkers.map((b, i) => (
                              <span key={i} className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                                {b}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                          <span>Actualizado por la fuente: <strong>{trial.lastUpdated}</strong></span>
                          <span>Fuente: <strong>ClinicalTrials.gov (API v2)</strong></span>
                        </div>

                      </div>
                    ))
                  )}
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* PESTAÑA 2: BUSCAR ENSAYOS PARA MIS PACIENTES                             */}
            {/* ========================================================================= */}
            {activeTab === 'matching' && (
              <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 bg-gray-50/40">
                
                {/* BANNER DE ACCIÓN DEL MÉDICO */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4 shrink-0">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-md">
                        Base de Pacientes del Profesional
                      </span>
                      {matchingSummary && (
                        <span className="text-[10px] text-gray-400">
                          Último análisis: {new Date(matchingSummary.analyzedAt).toLocaleDateString()} {new Date(matchingSummary.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-black text-gray-900">
                      Identificación Determinística de Candidatos Potenciales
                    </h2>
                    <p className="text-xs text-gray-500">
                      Analiza la base completa de pacientes pertenecientes al médico autenticado ({patients.length} pacientes registrados).
                      El análisis es 100% local, de solo lectura, sin enviar datos a servicios externos.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAnalyzePatients}
                      disabled={isAnalyzing || trials.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
                    >
                      <Search size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                      <span>{isAnalyzing ? 'Analizando...' : matchingSummary ? '↻ Volver a analizar' : '🔍 Analizar mis pacientes'}</span>
                    </button>
                  </div>
                </div>

                {/* MÉTRICAS DEL ANÁLISIS */}
                {matchingSummary && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                    <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
                      <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Pacientes Analizados</span>
                      <div className="text-2xl font-black text-gray-900">{matchingSummary.totalPatientsAnalyzed}</div>
                      <span className="text-xs text-gray-500">Total en la base del profesional</span>
                    </div>

                    <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
                      <span className="text-[10px] font-black uppercase text-emerald-700 block mb-1">Con Ensayos Potenciales</span>
                      <div className="text-2xl font-black text-emerald-800">{matchingSummary.patientsWithMatchesCount}</div>
                      <span className="text-xs text-emerald-600 font-medium">Pacientes con al menos 1 coincidencia clínica</span>
                    </div>

                    <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-blue-50/40 to-white">
                      <span className="text-[10px] font-black uppercase text-blue-700 block mb-1">Coincidencias Totales</span>
                      <div className="text-2xl font-black text-blue-800">{matchingSummary.totalMatchesCount}</div>
                      <span className="text-xs text-blue-600 font-medium">Estudios clínicos preliminarmente compatibles</span>
                    </div>
                  </div>
                )}

                {/* LISTA DE PACIENTES CON COINCIDENCIAS */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {!matchingSummary ? (
                    <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center text-gray-500 space-y-3">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                        <Users size={24} />
                      </div>
                      <div className="max-w-md mx-auto">
                        <p className="font-black text-base text-gray-800">
                          Listo para analizar tus pacientes
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Haz clic en <strong>"🔍 Analizar mis pacientes"</strong> para evaluar los perfiles tumorales,
                          biomarcadores y estadios frente a los {trials.length} ensayos activos en Argentina y Córdoba.
                        </p>
                      </div>
                    </div>
                  ) : matchingSummary.patientsWithMatchesCount === 0 ? (
                    <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center text-gray-600 space-y-2">
                      <p className="font-black text-base">
                        Se analizaron {matchingSummary.totalPatientsAnalyzed} pacientes. No se encontraron ensayos potencialmente compatibles con los criterios y datos actualmente documentados.
                      </p>
                      <p className="text-xs text-gray-400">
                        Esto significa únicamente que no se hallaron coincidencias con la información estructurada disponible en este momento.
                      </p>
                    </div>
                  ) : (
                    matchingSummary.evaluations
                      .filter(ev => ev.matches.length > 0)
                      .map(ev => {
                        const hasCordobaCandidate = ev.matches.some(m => m.trial.hasCordobaCenter);

                        return (
                          <div
                            key={ev.patientId}
                            className="bg-white border border-gray-200/80 hover:border-indigo-300 rounded-2xl p-4 shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                  HC: {ev.hcNumber}
                                </span>

                                {/* BADGE MEJOR NIVEL */}
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                  ev.bestCategory === 'potential_candidate'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {ev.bestCategory === 'potential_candidate' 
                                    ? '🟢 Candidato potencial' 
                                    : '🟡 Potencialmente compatible — faltan datos'}
                                </span>

                                {hasCordobaCandidate && (
                                  <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                    <MapPin size={9} /> Centro en Córdoba
                                  </span>
                                )}

                                {ev.stageDocumented && (
                                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                                    {ev.stageDocumented}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-black text-gray-900 pt-0.5">
                                {ev.patientName} — <span className="font-semibold text-gray-600">{ev.diagnosis}</span>
                              </h3>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                <span>Edad: {ev.profile.age ? `${ev.profile.age} años` : 'N/D'}</span>
                                <span>{ev.matches.length} ensayos compatibles ({ev.potentialCandidateCount} alta compatibilidad)</span>
                              </div>
                            </div>

                            <button
                              onClick={() => setDetailEvaluation(ev)}
                              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                            >
                              <span>Ver ensayos ({ev.matches.length})</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>

              </div>
            )}

          </div>

          {/* FOOTER GENERAL */}
          <div className="p-3.5 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500 shrink-0">
            <span className="text-[11px]">
              🔬 Buscador independiente de Oncología · Prioridad Córdoba y Argentina · Cumplimiento de Buenas Prácticas Clínicas
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>

      {/* MODAL DETALLE DE ENSAYO */}
      {detailTrial && (
        <TrialDetailModal trial={detailTrial} onClose={() => setDetailTrial(null)} />
      )}

      {/* MODAL DETALLE DE MATCHING DEL PACIENTE */}
      {detailEvaluation && (
        <PatientTrialDetailModal evaluation={detailEvaluation} onClose={() => setDetailEvaluation(null)} />
      )}
    </>
  );
};
