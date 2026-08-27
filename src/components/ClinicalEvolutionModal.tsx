import React, { useState, useEffect } from 'react';
import { 
  FileText, X, Copy, Check, Printer, Loader2, 
  Upload, AlertCircle, ArrowLeft, Sparkles, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { generateClinicalEvolution } from '../utils/evolutionAI';

interface FileData {
  name: string;
  type: string;
  data: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientData: {
    hcOrName: string;
    diagnosis: string;
    age?: string | number;
    baselineContext: string;
  };
  onSaveToTimeline?: (note: string) => Promise<void> | void;
  onAddAttachedStudiesToTimeline?: (files: FileData[]) => Promise<number>;
}

const ClinicalEvolutionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patientData,
  onSaveToTimeline,
  onAddAttachedStudiesToTimeline,
}) => {
  const [step, setStep] = useState<'input' | 'result'>('input');
  
  // Intake form state
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const [noNewStudies, setNoNewStudies] = useState(false);
  const [actualidad, setActualidad] = useState('');
  const [examenFisico, setExamenFisico] = useState('');
  const [plan, setPlan] = useState('');
  
  // Output state
  const [evolutionText, setEvolutionText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedToTimeline, setSavedToTimeline] = useState(false);
  const [isSavingToTimeline, setIsSavingToTimeline] = useState(false);
  const [studiesAddedCount, setStudiesAddedCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setAttachedFiles([]);
      setNoNewStudies(false);
      setActualidad('');
      setExamenFisico('');
      setPlan('');
      setEvolutionText('');
      setIsGenerating(false);
      setCopied(false);
      setSavedToTimeline(false);
      setIsSavingToTimeline(false);
      setStudiesAddedCount(0);
      setErrorMsg(null);
    }
  }, [isOpen, patientData.hcOrName]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: FileData[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = (evt) => {
            if (evt.target?.result) {
              const base64 = (evt.target.result as string).split(',')[1];
              newFiles.push({ name: file.name, type: file.type, data: base64 });
            }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setAttachedFiles(prev => [...prev, ...newFiles]);
      if (noNewStudies) setNoNewStudies(false);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setStudiesAddedCount(0);
    try {
      const evolutionPromise = generateClinicalEvolution({
        patientBaselineContext: patientData.baselineContext,
        attachedFiles: noNewStudies ? [] : attachedFiles,
        noNewStudies,
        actualidad,
        examenFisico,
        plan,
      });

      const studiesPromise = (!noNewStudies && attachedFiles.length > 0 && onAddAttachedStudiesToTimeline)
        ? onAddAttachedStudiesToTimeline(attachedFiles)
        : Promise.resolve(0);

      const [result, addedCount] = await Promise.all([evolutionPromise, studiesPromise]);

      setEvolutionText(result);
      if (typeof addedCount === 'number' && addedCount > 0) {
        setStudiesAddedCount(addedCount);
      }
      setStep('result');
    } catch (err: any) {
      console.error("Error al generar evolución:", err);
      setErrorMsg(err?.message || "Ocurrió un error al generar la evolución médica.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!evolutionText) return;
    try {
      await navigator.clipboard.writeText(evolutionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Error al copiar:", e);
    }
  };

  const handlePrint = () => {
    if (!evolutionText) return;
    const printWindow = window.open('', '', 'height=650,width=850');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Evolución Médica - ' + patientData.hcOrName + '</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('</head><body class="p-10 font-sans bg-white text-gray-900">');
      printWindow.document.write('<div class="border-b pb-3 mb-6">');
      printWindow.document.write('<h1 class="text-xl font-bold uppercase tracking-tight">Evolución Médica Ambulatoria</h1>');
      printWindow.document.write('<p class="text-xs text-gray-500">Paciente: ' + patientData.hcOrName + ' | Diagnóstico: ' + patientData.diagnosis + '</p>');
      printWindow.document.write('<p class="text-xs text-gray-400">Fecha: ' + new Date().toLocaleDateString('es-AR') + '</p>');
      printWindow.document.write('</div>');
      printWindow.document.write('<pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-800">' + evolutionText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>');
      printWindow.document.write('<div class="mt-8 pt-4 border-t text-[10px] text-gray-400 text-center">Documento generado para pase a Historia Clínica Digital.</div>');
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
    }
  };

  const handleSaveToTimelineClick = async () => {
    if (!onSaveToTimeline || !evolutionText || savedToTimeline) return;
    setIsSavingToTimeline(true);
    try {
      await onSaveToTimeline(evolutionText);
      setSavedToTimeline(true);
    } catch (err) {
      console.error("Error guardando evolución en la cronología:", err);
    } finally {
      setIsSavingToTimeline(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 font-sans">
        
        {/* HEADER */}
        <div className="p-5 px-6 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-md shadow-blue-100 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">
                  Generar Evolución Médica
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                  Para Historia Clínica Digital
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {patientData.hcOrName} · {patientData.diagnosis} {patientData.age ? `(${patientData.age})` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-700 transition-all"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white scrollbar-hide space-y-6">
          
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3 text-xs">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <span className="font-bold">Error: </span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-6">
              
              {/* Banner de datos recuperados automáticamente */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-blue-800">
                    Antecedentes del Paciente (Recuperados automáticamente)
                  </p>
                  <p className="text-gray-600 leading-relaxed text-[11px]">
                    El diagnóstico, antecedentes, cirugías y tratamientos documentados del paciente se integran de manera automática para contextualizar el párrafo inicial sin que debas volver a cargarlos.
                  </p>
                </div>
              </div>

              {/* Sección: Estudios que trae */}
              <div className="bg-gray-50/80 border border-gray-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Estudios que trae el paciente</span>
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Adjuntá los informes (PDF o imágenes). El contenido relevante se transcribirá literalmente sin alterar la redacción original.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={noNewStudies} 
                      onChange={e => {
                        setNoNewStudies(e.target.checked);
                        if (e.target.checked) setAttachedFiles([]);
                      }} 
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" 
                    />
                    <span className="text-xs font-bold text-gray-700">No presenta estudios nuevos</span>
                  </label>
                </div>

                {!noNewStudies && (
                  <div className="space-y-3 pt-1">
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachedFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white text-blue-800 px-3 py-1.5 rounded-xl text-[11px] border border-blue-200 shadow-sm font-semibold">
                            <FileText size={13} className="text-blue-500" />
                            <span className="truncate max-w-[200px]">{f.name}</span>
                            <button 
                              onClick={() => removeFile(i)} 
                              className="ml-1 text-gray-400 hover:text-red-500 p-0.5 rounded-full"
                              title="Quitar archivo"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-blue-50/40 hover:border-blue-300 transition-all group p-3 text-center">
                      <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mb-1 transition-colors" />
                      <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">
                        Cargar archivos de estudios (PDF, JPG, PNG)
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        Informes de imágenes, biopsias, laboratorios, etc.
                      </span>
                      <input 
                        type="file" 
                        className="hidden" 
                        multiple 
                        accept="application/pdf,image/*" 
                        onChange={handleFileChange} 
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Sección: Actualidad del paciente */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                  Actualidad del Paciente (Consulta del día)
                </label>
                <p className="text-[11px] text-gray-400 font-medium">
                  Situación clínica actual, síntomas, tolerancia a tratamientos, toxicidad o comentarios del paciente.
                </p>
                <textarea
                  className="w-full h-24 p-3.5 border border-gray-200 rounded-2xl text-xs font-medium bg-gray-50/50 focus:bg-white focus:border-blue-400 outline-none transition-all resize-none shadow-sm leading-relaxed"
                  placeholder="Ej: Paciente refiere buena tolerancia al tratamiento. Sin dolor ni disnea. Astenia leve G1. Apetito conservado..."
                  value={actualidad}
                  onChange={e => setActualidad(e.target.value)}
                />
              </div>

              {/* Sección: Examen Físico (EF) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                    EF (Examen Físico)
                  </label>
                  <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                    <ShieldAlert size={12} /> No inventar hallazgos
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-medium">
                  Hallazgos evaluados hoy (ECOG, signos vitales, peso, examen segmentario relevante).
                </p>
                <textarea
                  className="w-full h-24 p-3.5 border border-gray-200 rounded-2xl text-xs font-medium bg-gray-50/50 focus:bg-white focus:border-blue-400 outline-none transition-all resize-none shadow-sm leading-relaxed"
                  placeholder="Ej: Buen estado general. ECOG 1. TA 120/80 mmHg, Peso 68 kg. Auscultación pulmonar limpia. Abdomen blando, depresible e indoloro, sin visceromegalias ni adenopatías periféricas palpables..."
                  value={examenFisico}
                  onChange={e => setExamenFisico(e.target.value)}
                />
              </div>

              {/* Sección: Plan */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                  Plan Definido en la Consulta
                </label>
                <p className="text-[11px] text-gray-400 font-medium">
                  Conducta terapéutica, continuidad de esquema, estudios solicitados, pautas de alarma y próxima cita.
                </p>
                <textarea
                  className="w-full h-24 p-3.5 border border-gray-200 rounded-2xl text-xs font-medium bg-gray-50/50 focus:bg-white focus:border-blue-400 outline-none transition-all resize-none shadow-sm leading-relaxed"
                  placeholder="Ej: 1. Continuar esquema Pembrolizumab ciclo 6 según lo programado. 2. Se solicita laboratorio de control con hemograma, función renal y hepática previo a próxima infusión. 3. Pautas de alarma explicadas. 4. Control en 21 días..."
                  value={plan}
                  onChange={e => setPlan(e.target.value)}
                />
              </div>

            </div>
          ) : (
            /* Vista de resultado y edición */
            <div className="space-y-4">
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <div>
                    <p className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                      Evolución generada — Lista para revisar y editar
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Podés editar directamente cualquier texto en el cuadro inferior antes de copiar a la Historia Clínica Digital.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                    copied 
                      ? 'bg-emerald-700 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar para HCD'}</span>
                </button>
              </div>

              {studiesAddedCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                  <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0" />
                  <span>Se extrajeron y añadieron automáticamente {studiesAddedCount} estudio(s) nuevo(s) a la línea de tiempo de eventos.</span>
                </div>
              )}

              {/* Textarea Editable de la Evolución */}
              <div className="relative">
                <textarea
                  value={evolutionText}
                  onChange={e => setEvolutionText(e.target.value)}
                  className="w-full h-[460px] p-5 border-2 border-gray-200 rounded-2xl font-mono text-xs text-gray-800 bg-white focus:border-blue-400 outline-none leading-relaxed resize-none shadow-inner"
                  spellCheck={false}
                />
              </div>

              {/* Botón opcional para guardar en la cronología */}
              {onSaveToTimeline && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    <span className="font-bold text-gray-800">¿Guardar también en los eventos de la historia?</span>
                    <p className="text-[10px] text-gray-400">Agrega esta evolución a la línea de tiempo del paciente.</p>
                  </div>
                  <button
                    onClick={handleSaveToTimelineClick}
                    disabled={savedToTimeline || isSavingToTimeline}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      savedToTimeline
                        ? 'bg-green-100 text-green-800 cursor-default'
                        : 'bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 shadow-sm'
                    }`}
                  >
                    {isSavingToTimeline ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : savedToTimeline ? (
                      <><Check size={14} /> Guardado en Eventos</>
                    ) : (
                      'Guardar en Eventos'
                    )}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-4 px-6 border-t bg-gray-50 flex justify-between items-center">
          {step === 'input' ? (
            <>
              <button
                onClick={onClose}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {isGenerating ? (
                  <><Loader2 size={16} className="animate-spin" /> Generando Evolución...</>
                ) : (
                  <><Sparkles size={16} /> Generar Evolución</>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('input')}
                className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:bg-gray-100 transition-all"
              >
                <ArrowLeft size={14} /> Modificar datos de entrada
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={!evolutionText}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 px-4 py-2.5 rounded-xl shadow-sm transition-all"
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md ${
                    copied 
                      ? 'bg-emerald-700 text-white shadow-emerald-200' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar para HCD'}</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ClinicalEvolutionModal;
