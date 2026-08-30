import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import AuthScreen from './AuthScreen';
import { Loader2 } from 'lucide-react';

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
 *   - La app completa si hay sesión activa
 * 
 * USO en index.tsx:
 *   <AuthWrapper>
 *     {(user, demoContext) => <RootOrchestrator DoctorApp={App} user={user} isDemoMode={demoContext?.isDemoMode} onExitDemo={demoContext?.onExitDemo} />}
 *   </AuthWrapper>
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Si se activó Modo Demo explícitamente, saltar autenticación Firebase
  if (isDemoMode) {
    const demoUser = createDemoUser();
    return <>{children(demoUser, { isDemoMode: true, onExitDemo: () => setIsDemoMode(false) })}</>;
  }

  // Firebase verificando sesión guardada
  if (loading) {
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

  // Autenticado normal → app completa
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
