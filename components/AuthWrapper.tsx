import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import AuthScreen from './AuthScreen';
import { Loader2 } from 'lucide-react';

interface AuthWrapperProps {
  children: (user: User) => React.ReactNode;
}

/**
 * AuthWrapper
 * 
 * Envuelve toda la aplicación. Muestra:
 *   - Spinner mientras Firebase verifica la sesión
 *   - Pantalla de login si no hay sesión
 *   - La app completa si hay sesión activa
 * 
 * USO en index.tsx:
 *   <AuthWrapper>
 *     {(user) => <RootOrchestrator DoctorApp={App} user={user} />}
 *   </AuthWrapper>
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firebase verificando sesión guardada
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-black text-gray-300 uppercase tracking-widest">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  // No autenticado → pantalla de login
  if (!user) {
    return <AuthScreen />;
  }

  // Autenticado → app completa
  return <>{children(user)}</>;
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
