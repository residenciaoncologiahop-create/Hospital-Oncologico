# 🔐 Guía de Implementación — Seguridad OncoGuide AI

## Qué resuelve este upgrade

| Problema anterior | Solución implementada |
|---|---|
| Sin autenticación → cualquiera accede | Firebase Auth con email/contraseña |
| API Key de Gemini visible en el browser | Cloud Function que la guarda en servidor |
| Reglas Firestore abiertas | Reglas que filtran por usuario autenticado |
| `doctorName` guardado solo en localStorage | Identidad real verificada por Firebase |

---

## Archivos entregados

```
security-upgrade/
├── firebase.ts                    → Agregar export de auth
├── components/
│   ├── AuthScreen.tsx             → Pantalla de login/registro  
│   └── AuthWrapper.tsx            → Envuelve toda la app
├── utils/
│   └── aiProxy.ts                 → Reemplaza llamadas directas a Gemini
├── functions/
│   ├── index.js                   → Cloud Function proxy de Gemini
│   └── package.json               → Dependencias del backend
└── INTEGRATION_GUIDE.js           → Instrucciones de cambios en index.tsx
```

---

## Paso a paso

### Paso 1: Copiar los archivos nuevos

Copiar cada archivo de esta carpeta a su ubicación en el proyecto:
- `firebase.ts` → reemplaza el existente
- `components/AuthScreen.tsx` → archivo nuevo
- `components/AuthWrapper.tsx` → archivo nuevo  
- `utils/aiProxy.ts` → archivo nuevo
- `functions/` → carpeta nueva en la raíz del proyecto

### Paso 2: Activar Firebase Authentication

En la [Firebase Console](https://console.firebase.google.com):
1. Ir a tu proyecto → **Authentication** → **Sign-in method**
2. Habilitar **Email/Password**
3. Listo

### Paso 3: Desplegar la Cloud Function

```bash
# Desde la raíz del proyecto:
npm install -g firebase-tools
firebase login
firebase init functions   # Seleccionar proyecto existente, Node 20

# Guardar la API key de Gemini como Secret (nunca en código):
firebase functions:secrets:set GEMINI_API_KEY
# (pega tu key cuando lo pida)

# Instalar dependencias del backend:
cd functions && npm install && cd ..

# Desplegar:
firebase deploy --only functions
```

### Paso 4: Aplicar cambios en index.tsx

Seguir el archivo `INTEGRATION_GUIDE.js` que detalla exactamente qué cambiar.

Los cambios principales son:
1. Envolver el render con `<AuthWrapper>`
2. Cambiar `doctorName` para que venga de `user.displayName`
3. Reemplazar cada función de Gemini por su versión `...Secure` del `aiProxy.ts`
4. Cambiar el botón de logout para llamar a la función `logout()`

### Paso 5: Actualizar reglas de Firestore

En Firebase Console → **Firestore** → **Reglas**, pegar:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /patients/{patientId} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == resource.data.doctorId;
      allow create: if request.auth != null;
    }
    match /audit_logs/{logId} {
      allow create: if request.auth != null;
      allow read: if false;
    }
  }
}
```

### Paso 6: Limpiar .env.local

Eliminar la variable `VITE_API_KEY` (la key de Gemini).
Ya no se necesita en el frontend.

El `.env.local` debería quedar solo con las variables de Firebase:
```
VITE_API_KEY_FIREBASE=...
VITE_AUTH_DOMAIN=...
VITE_PROJECT_ID=...
VITE_STORAGE_BUCKET=...
VITE_MESSAGING_SENDER_ID=...
VITE_APP_ID=...
```

---

## Cómo funciona el flujo seguro

```
Usuario           Frontend            Cloud Function      Gemini API
  │                   │                     │                  │
  │── Login ─────────►│                     │                  │
  │                   │── Firebase Auth ────►│                  │
  │◄── Token JWT ─────│                     │                  │
  │                   │                     │                  │
  │── Consulta ───────►│                     │                  │
  │                   │── callGemini() ─────►│                  │
  │                   │  (con token JWT)     │── Gemini SDK ───►│
  │                   │                     │◄── Respuesta ────│
  │◄── Respuesta ─────│◄── texto ───────────│                  │
```

La API key **nunca sale del servidor**.

---

## Estimación de costo (Cloud Functions)

Firebase tiene un **generoso free tier**:
- 2 millones de invocaciones/mes gratis
- Para un hospital pequeño/mediano con uso clínico diario, el costo extra es prácticamente cero en el plan gratuito (Spark), o mínimo en Blaze.

---

## Próximos pasos recomendados (post-implementación)

- [ ] Agregar recuperación de contraseña (`sendPasswordResetEmail`)
- [ ] Considerar autenticación con SSO institucional (Google Workspace, Microsoft Azure AD)
- [ ] Configurar alertas de acceso en Firebase Console
- [ ] Revisar política de datos con el departamento de Informática del hospital
