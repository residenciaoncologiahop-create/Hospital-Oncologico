import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import AuthScreen from './AuthScreen';
import { Loader2, ShieldAlert, LogOut, Sparkles } from 'lucide-react';

interface DemoContext {
  isDemoMode: boolean;
  onExitDemo: () => void;
}

interface AuthWrapperProps {
  children: (user: User, demoContext?: DemoContext) => React.ReactNode;
}

const createDemoUser = (): User => ({
  uid: 'demo-user',
  email: 'demo@oncoguide.app',
  displayName: 'Modo Demo',
  emailVerified: true,
  isAnonymous: true,
  metadata: {} as any,
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => '',
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  photoURL: null,
  providerId: 'demo'
});

/**
 * AuthWrapper
 * 
 * Envuelve toda la aplicación. Muestra:
 *   - Spinner mientras Firebase verifica la sesión
 *   - Pantalla de login si no hay sesión
 *   - Modo Demo si el usuario eligió probar casos ficticios sin cuenta
 *   - Pantalla institucional de bloqueo si el usuario está autenticado pero NO autorizado
 *   - La app completa si el usuario está autenticado y AUTORIZADO
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoadingAuth(false);
      if (!firebaseUser) {
        setIsAuthorized(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Escuchar estado de autorización en authorized_users/{uid} cuando hay usuario autenticado
  useEffect(() => {
    if (!user || isDemoMode) {
      return;
    }

    setIsAuthorized(null); // Verificando
    const userDocRef = doc(db, 'authorized_users', user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.active === true) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      },
      (error) => {
        console.warn('Error verificando autorización en Firestore:', error);
        setIsAuthorized(false);
      }
    );

    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Si se activó Modo Demo explícitamente, saltar autenticación y autorización
  if (isDemoMode) {
    const demoUser = createDemoUser();
    return <>{children(demoUser, { isDemoMode: true, onExitDemo: () => setIsDemoMode(false) })}</>;
  }

  // Firebase verificando sesión guardada
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-black text-gray-300 uppercase tracking-widest">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  // No autenticado → pantalla de login con opción de probar demo
  if (!user) {
    return <AuthScreen onEnterDemo={() => setIsDemoMode(true)} />;
  }

  // Autenticado pero verificando autorización en Firestore
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-black text-gray-300 uppercase tracking-widest">
            Verificando autorización...
          </p>
        </div>
      </div>
    );
  }

  // Autenticado pero NO autorizado → Pantalla institucional de bloqueo
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-gray-100 text-center">
          <div className="inline-block bg-amber-500/10 p-5 rounded-3xl mb-5">
            <ShieldAlert className="text-amber-600 w-12 h-12" />
          </div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight mb-2">
            Acceso no habilitado
          </h1>
          <p className="text-gray-500 text-xs font-medium leading-relaxed mb-4">
            La cuenta <span className="font-bold text-gray-700">{user.email || user.uid}</span> está autenticada, pero aún no cuenta con autorización activa para acceder a los datos clínicos de Hospital Oncológico.
          </p>
          <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-left mb-6">
            <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
              <span className="font-black">Atención:</span> El acceso al sistema requiere habilitación previa por parte de la Dirección Médica o administración del servicio.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => logout()}
              className="w-full bg-gray-900 hover:bg-black text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDemoMode(true)}
              className="w-full bg-gradient-to-r from-slate-800 to-indigo-950 text-white py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={16} className="text-amber-400" />
              <span>Probar Modo Demo</span>
            </button>
          </div>

          <p className="text-[9px] text-gray-400 font-medium mt-6 leading-relaxed">
            Hospital Oncológico — Sistema de Apoyo Clínico y Docencia.
          </p>
        </div>
      </div>
    );
  }

  // Autenticado y AUTORIZADO → app completa
  return <>{children(user, { isDemoMode: false, onExitDemo: logout })}</>;
};

export default AuthWrapper;

// ──────────────────────────────────────────────
// Hook de conveniencia para obtener el usuario en cualquier componente
// ──────────────────────────────────────────────
export const useCurrentUser = () => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
};

// ──────────────────────────────────────────────
// Función de logout reutilizable
// ──────────────────────────────────────────────
export const logout = () => signOut(auth);
