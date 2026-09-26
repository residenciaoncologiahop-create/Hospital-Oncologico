import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Activity, Mail, Lock, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthScreenProps {
  onEnterDemo?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onEnterDemo }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El listener onAuthStateChanged en App se encargará del resto
    } catch (err: any) {
      // Mensajes de error en español
      const errorMessages: Record<string, string> = {
        'auth/invalid-email': 'Email inválido.',
        'auth/user-not-found': 'No existe una cuenta con este email.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
        'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.',
      };
      setError(errorMessages[err.code] || 'Error de autenticación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-blue-600 p-5 rounded-3xl shadow-xl shadow-blue-100 mb-5">
            <Activity className="text-white w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tighter">OncoGuide AI</h1>
          <p className="text-gray-400 text-xs font-medium mt-1">Herramienta de apoyo clínico y docencia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input
              type="email"
              placeholder="Email institucional"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-sm focus:bg-white focus:border-blue-100 outline-none transition-all"
              required
            />
          </div>

          {/* Contraseña */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-sm focus:bg-white focus:border-blue-100 outline-none transition-all"
              required
            />
          </div>

          {/* Disclaimer legal */}
          <div className="flex items-start space-x-3 bg-blue-50 p-4 rounded-2xl">
            <input
              type="checkbox"
              id="legal"
              checked={legalAccepted}
              onChange={e => setLegalAccepted(e.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <label htmlFor="legal" className="text-[10px] text-blue-700 leading-relaxed font-medium cursor-pointer">
              <span className="font-black">Confirmo que:</span> Esta herramienta es de apoyo a la 
              discusión clínica y no reemplaza la historia clínica institucional ni el juicio médico del 
              equipo tratante.
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !legalAccepted}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Procesando...</>
            ) : (
              <><ShieldCheck size={16} /> Ingresar de forma segura</>
            )}
          </button>

        </form>

        {/* ── BOTÓN ACCESO MODO DEMO ── */}
        {onEnterDemo && (
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={onEnterDemo}
              className="w-full group bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-blue-900 hover:to-indigo-900 text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100/50 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-95 border border-indigo-700/40"
            >
              <Sparkles size={16} className="text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>Probar Demo</span>
            </button>
            <p className="text-[10px] text-gray-400 font-medium mt-2 leading-tight">
              Casos ficticios · No se requiere cuenta · Datos de demostración
            </p>
          </div>
        )}

        <p className="text-[8px] text-gray-300 text-center font-medium mt-6 leading-relaxed">
          Acceso restringido a profesionales habilitados del equipo de oncología.
          Los datos son confidenciales y están protegidos según Ley 25.326 y Ley 26.529.
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
