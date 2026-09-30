# OncoGuide AI — Asistente Clínico para Oncología

Herramienta web de soporte para la organización de casos, discusión clínica, gestión de trámites administrativos y docencia médica. Desarrollada en el ámbito de la residencia de Oncología Clínica del **Hospital Oncológico Provincial de Córdoba (Argentina)**.

> **Versión activa:** [hospital-oncologico.vercel.app](https://hospital-oncologico.vercel.app)

> **Aviso clínico y alcance:** Esta aplicación es un sistema de apoyo orientativo para profesionales y residentes de oncología. **No constituye un producto o dispositivo médico ni un sistema de diagnóstico formal, y no reemplaza la historia clínica institucional ni el juicio clínico del equipo médico tratante.** Toda decisión diagnóstica o terapéutica es responsabilidad exclusiva del profesional a cargo.

---

## 1. Descripción general

OncoGuide AI asiste en la sistematización de la información clínica y la confección de documentación médica en la práctica oncológica diaria:

- Organización de casos clínicos identificados por número de historia clínica (HC), rango etario y diagnóstico.
- Asistente de discusión clínica interactivo basado en inteligencia artificial (Google Gemini).
- Extracción estructurada de cronología clínica (línea de tiempo con hitos clave), resultados de laboratorio y mediciones radiológicas.
- Evaluación determinística de respuesta tumoral según criterios **RECIST 1.1** e **iRECIST** con graficación temporal.
- Estimación automática y confirmación supervisada del estadio tumoral (I a IV).
- Asistencia en la confección de formularios médicos de cobertura (PAMI, Banco de Drogas Provincial, DINADIC, Formulario 03 de Prácticas, Solicitud de Medicamentos Oncológicos y Planilla 133 PROFE) con revisión previa y generación en PDF.
- Pre-screening y matching determinístico de pacientes contra ensayos clínicos oficiales registrados en **ClinicalTrials.gov**.
- Módulo educativo para médicos residentes con sesión volátil en memoria y casos ficticios en **Modo Demo**.

---

## 2. Funcionalidades activas en el código

### 2.1. Gestión de casos clínicos y perfil oncológico
- Registro de pacientes asociado al identificador único del profesional tratante (`doctorId`).
- Datos de registro clínico: número de historia clínica (`hcNumber`), rango etario decenal (`ageRange`), diagnóstico oncológico (`diagnosis`), antecedentes y notas clínicas acumuladas (`clinicalContext`).
- **Perfil oncológico estructurado (`computePatientProfile.ts`):** Inferencia automática de estadio clínico (Estadio I, II, III, IV o no consignado) mediante análisis con soporte de negaciones ("sin metástasis", "libre de enfermedad"), detección del órgano o sitio tumoral primario y extracción de biomarcadores moleculares. Permite confirmación manual por el médico (`stageConfidence: 'confirmed'`), evitando sobreescrituras automáticas posteriores.

### 2.2. Procesamiento documental con IA (Gemini 2.5 Flash)
- **Extracción de cronología clínica (`extractTimelineSecure`):** Segmentación automática de documentos PDF en bloques manejables (`pdfChunker.ts`), cálculo de huellas digitales de contenido (`chunkHasher.ts`) para omitir bloques ya procesados, extracción de fechas, especialidad, categoría y clasificación de hitos determinantes (`isKey`). Deduplicación y ordenamiento cronológico (`timelineConsolidator.ts`).
- **Extracción y normalización de laboratorios (`extractLabsSecure`):** Reconocimiento y estandarización de nombres de pruebas bioquímicas, hematológicas y marcadores tumorales (`labValidation.ts`), con exclusión estricta de variables radiológicas/moleculares y filtro de plausibilidad biológica numérica.
- **Extracción radiológica individual y masiva (`extractImagingFromHistorySecure`, `extractSingleImagingReportSecure`):** Detección de estudios (TC, RMN, PET-TC, ecografía) con hallazgos oncológicos positivos o relevantes, registrando región anatómica, mediciones en milímetros (mm), SUVmáx, lesiones diana (target) y no diana (non-target).

### 2.3. Módulo de Imágenes y RECIST 1.1 / iRECIST
- **Cálculo determinístico en frontend (`ImagingPanel.tsx`):**
  - Validación numérica estricta de diámetros: las mediciones no numéricas o ambiguas no se convierten a 0; el estudio se marca como "información insuficiente" y no se evalúa respuesta.
  - Cálculo de suma de diámetros de lesiones diana, identificación del nadir y porcentaje de cambio relativo respecto al estudio basal (*baseline*) y al nadir.
  - Evaluación según **RECIST 1.1** (Respuesta Completa [RC], Respuesta Parcial [RP], Enfermedad Estable [EE], Progresión de Enfermedad [EP]) o **iRECIST** si se detecta tratamiento con inmunoterapia (iUPD, iCPD, iPR, iCR).
  - Admite *override* (anulación o corrección manual) justificado por el profesional.
  - Curva temporal evolutiva de suma de diámetros generada mediante Recharts.

### 2.4. Generación de informes y evoluciones
- **Evolución médica para Historia Clínica Digital (HCD):** Generador de texto estructurado listo para copiar a la ficha digital oficial, integrando la cronología reciente, laboratorios y estado clínico.
- **Resumen clínico institucional:** Informe narrativo para discusión en comités de tumores o ateneos médicos.
- **Plan de seguimiento oncológico guiado por escenarios:** Diferenciación entre Vigilancia Curativa post-tratamiento (Modo A), Enfermedad Metastásica Activa con evaluación de respuesta al tratamiento (Modo B) y Vigilancia Post-metastasectomía R0 (Modo C). Cuenta con un mecanismo de bloqueo de seguridad que detiene la generación si el estado clínico es indeterminado o las guías de referencia no coinciden con la patología.
- **Auditoría de completitud documental (`generateClinicalAuditSecure`):** Detección de vacíos documentales críticos (TNM faltante, ECOG no registrado, discrepancias entre informe patológico y estadio asignado).

### 2.5. Gestión de trámites y formularios médicos supervisados
Flujo con modales interactivos de revisión, validación de campos obligatorios y generación de PDF mediante `pdf-lib`:
- **Formulario PAMI Oncológico:** Detección asistida de esquemas y drogas, validación de variables requeridas (peso, talla, ECOG, CIE-10, informe detallado) y previsualización de PDF.
- **Banco de Drogas de la Provincia de Córdoba:** Solicitudes de Admisión y Renovación con verificación de datos filiatorios, antecedentes terapéuticos y dosificación.
- **DINADIC:** Informe médico y solicitud formal de medicación especial con esquema y dosificación.
- **Formulario 03 de Prácticas:** Solicitud de estudios complementarios (TC, PET, resonancias, biopsias) con selector interactivo del estudio requerido.
- **Ficha de Solicitud de Medicamentos Oncológicos:** Confección estructurada con selector interactivo de droga principal.
- **Planilla 133 PROFE / Derivación PROFE:** Formulario de derivación y medicación para beneficiarios del programa federal.

### 2.6. Asistente de discusión clínica (Chat contextual)
- Interfase de conversación con el modelo de lenguaje contextualizada con el diagnóstico, rango etario, últimos 10 intercambios del chat, cronología de eventos, laboratorios y estudios de imágenes del caso.
- Admite adjuntar hasta 3 archivos de consulta en la sesión.
- Simulación progresiva de recepción de respuesta (*streaming visual*) para lectura médica continuada.

### 2.7. Pre-screening de ensayos clínicos (Clinical Trials)
- Motor determinístico de matching que evalúa criterios estructurados del paciente frente a ensayos clínicos oficiales (detallado en la [Sección 6](#6-ensayos-clínicos-funcionamiento-y-limitaciones)).

### 2.8. Modo Demo interactivo
- Acceso sin credenciales desde la pantalla de autenticación para pruebas y evaluación formativa.
- Carga casos clínicos ficticios completos preconfigurados (`demoCases.ts`), abarcando diversos escenarios (cáncer de mama con discordancia histológica, adenocarcinoma de pulmón avanzado con mutación EGFR, cáncer colorrectal metastásico, etc.).
- Banner visual persistente que advierte sobre datos simulados. No realiza lecturas ni escrituras en Firestore; las modificaciones se mantienen únicamente en memoria local.
- Incluye panel de control de calidad (*QA / Pruebas del Caso*) con objetivos docentes y listas de verificación.

### 2.9. Módulo de Residentes (OncoResidente)
- Accesible mediante selector inicial (`RootOrchestrator.tsx`).
- Entorno de trabajo con **sesión volátil en memoria**: los casos creados en este modo no se persisten en Firestore ni en `localStorage`; se descartan al recargar o cerrar la sesión.
- Dispone de módulo pedagógico interactivo (`ResidentLearningModule.tsx`) para formular preguntas de razonamiento clínico y análisis guiado de casos.

### 2.10. Herramientas auxiliares activas
- **Calculadora oncológica:** Cálculo de Superficie Corporal (fórmula de Mosteller), Aclaramiento de Creatinina (Cockcroft-Gault) y dosificación de Carboplatino (fórmula de Calvert según AUC deseada).
- **Vademécum farmacológico:** Consulta de fichas técnicas orientativas de fármacos oncológicos generadas mediante la Cloud Function proxy.
- **Estadísticas de la práctica médica:** Visualización de métricas de casos del profesional (distribución por patología, proporción por estadio clínico, media de permanencia en seguimiento).
- **Panel de pendientes y agenda:** Registro de tareas asistenciales asociadas al médico autenticado (`pendientes`), con vista diaria, calendario mensual y notificaciones locales del navegador para vencimientos de hoy y mañana.

---

## 3. Stack técnico y arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                       Cliente Web                           │
│  React 19 + TypeScript + Vite 6 + Tailwind CSS (CDN)        │
│  Recharts (curvas RECIST) · pdf-lib (generación de PDFs)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
        HTTPS Callable                  Firestore SDK
      (Bearer ID Token)                 (Aislamiento UID)
               │                               │
               ▼                               ▼
┌──────────────────────────────┐    ┌─────────────────────────┐
│   Firebase Cloud Functions   │    │    Cloud Firestore      │
│   Node.js 20 (v2 API)        │    │  - patients             │
│  - callGemini (Proxy + rate) │    │  - pendientes           │
│  - syncClinicalTrials        │    │  - audit_logs           │
│  - syncClinicalTrialsSched.  │    │  - clinical_trials      │
└──────────────┬───────────────┘    │  - authorized_users     │
               │                    └─────────────────────────┘
      Secret Manager Key
               │
               ▼
┌──────────────────────────────┐
│      Google Generative AI    │
│      Gemini 2.5 Flash        │
└──────────────────────────────┘
```

| Capa / Componente | Tecnología | Versión en repo | Propósito |
|---|---|---|---|
| **Frontend Framework** | React / React DOM | `^19.2.3` | Interfaz de usuario reactiva |
| **Lenguaje (Frontend)** | TypeScript | `~5.8.2` | Tipado estático y modelos clínicos |
| **Build Tool** | Vite | `^6.4.3` | Compilación y servidor de desarrollo |
| **Estilos** | Tailwind CSS | Script CDN (`index.html`) | Clases de diseño y temas visuales |
| **Gráficos** | Recharts | `^2.12.0` | Curvas temporales de evolución tumoral |
| **Manipulación PDF** | pdf-lib | `^1.17.1` | Llenado programático de formularios |
| **Iconografía** | Lucide React | `^0.562.0` | Iconos de interfaz |
| **Pruebas unitarias** | Vitest | `^5.0.1` | Suite de tests automatizados |
| **BaaS Client** | Firebase JS SDK | `^10.7.1` | Auth, Firestore, Functions |
| **Backend Runtime** | Node.js (Cloud Functions) | `20` (engines) | Entorno de ejecución en la nube |
| **Backend Framework** | firebase-functions | `^6.0.0` (v2) | Endpoints HTTPS Callable y Cron |
| **Admin SDK** | firebase-admin | `^12.0.0` | Operaciones privilegiadas en Firestore |
| **Motor de IA** | @google/generative-ai | `^0.21.0` | SDK oficial para Gemini |
| **Modelo de IA** | Gemini 2.5 Flash | `"gemini-2.5-flash"` | Extracción documental y asistente |

---

## 4. Seguridad y control de acceso

1. **Autenticación obligatoria:** La aplicación requiere inicio de sesión con correo y contraseña vía Firebase Authentication. El alta pública de usuarios (*sign-up*) está deshabilitada tanto en la interfaz como a nivel de configuración del proyecto Firebase Auth; las cuentas deben ser provistas por el administrador institucional.
2. **Autorización institucional (`authorized_users`):** Estar autenticado en Firebase no basta para operar. Se verifica la existencia del documento `authorized_users/{uid}` con `active == true`. Si un usuario carece de esta bandera activa, la pantalla institucional de bloqueo deniega el acceso a la información clínica.
3. **Revocación en tiempo real:** `AuthWrapper.tsx` mantiene un escucha en tiempo real (`onSnapshot`) sobre `authorized_users/{uid}`. Si el acceso es revocado en Firestore, la interfaz expulsa al usuario y bloquea la sesión de forma inmediata sin requerir recarga.
4. **Autorización en Cloud Functions:** Las funciones de backend (`callGemini` y `syncClinicalTrials`) ejecutan la función interna `assertAuthorized(uid)`, verificando nuevamente la colección `authorized_users` en Firestore antes de procesar cualquier llamada o consumir cuota del modelo de lenguaje.
5. **Aislamiento por profesional tratante en Firestore:**
   - En la colección `patients`, las reglas de seguridad (`firestore.rules`) obligan a que `request.resource.data.doctorId == request.auth.uid` al crear, y exigen `request.auth.uid == resource.data.doctorId` para leer, actualizar o eliminar. Ningún médico puede leer o modificar casos registrados por otro usuario.
   - En la colección `pendientes`, se aplica el mismo esquema de aislamiento por `doctorId`.
6. **Rate limiting en Cloud Function:** La función `callGemini` implementa limitación de tasa en memoria por UID (máximo 15 llamadas por minuto y protección anti-ráfaga de máximo 4 solicitudes en 5 segundos) para mitigar abusos o sobreconsumo de cuota.
7. **Protección de secretos:** La API key de Gemini (`GEMINI_API_KEY`) nunca se transfiere al navegador cliente; se almacena y administra exclusivamente en Firebase Secret Manager en el entorno de Cloud Functions.

---

## 5. Privacidad y manejo de datos

Esta sección describe con precisión técnica cómo circulan y persisten los datos en la aplicación:

### 5.1. Flujo de archivos y uso de IA (Gemini)
- **Los archivos originales (PDFs e imágenes) no se almacenan:** La aplicación no guarda los archivos binarios subidos por el usuario en bases de datos locales ni en buckets de Firebase Storage.
- **Envío íntegro a Google Gemini en base64:** Los documentos seleccionados son convertidos a cadenas base64 en la memoria del navegador y enviados en su totalidad como partes `inlineData` a través de la Cloud Function `callGemini` hacia la API de Google Generative AI.
- **Riesgo de datos identificatorios en membretes:** Aunque las instrucciones de sistema (*system prompts*) indican al modelo no transcribir nombres de personas ni DNI en sus respuestas, **el archivo crudo recibido por el proveedor externo contiene cualquier dato identificatorio visible en el documento original** (nombres, DNI, números de afiliación, membretes institucionales, firmas o datos de contacto). **Es responsabilidad exclusiva del médico tratante redactar, tachar u omitir cualquier dato identificatorio sensible antes de cargar documentos en la herramienta.**
- **Ausencia de sanitización automática en texto libre:** Las notas clínicas, observaciones manuales y mensajes del chat no cuentan con rutinas de anonimización algorítmica ni filtros automáticos en el cliente antes de ser transmitidos a Gemini o guardados en la base de datos.

### 5.2. Persistencia en Cloud Firestore
- **Datos clínicos estructurados:** Los resultados de extracciones (cronología clínica, valores de laboratorio, mediciones radiológicas e interpretaciones RECIST), notas acumuladas y el **historial completo de mensajes del chat clínico** se guardan en el documento del paciente (`patients/{patientId}`) en Firestore de forma indefinida hasta que el médico decida eliminar el caso.
- **Metadatos de fragmentos procesados (`processedChunks`):** En cada paciente se persiste el registro de bloques analizados para evitar reprocesar documentos en análisis incrementales (`main.tsx` / `chunkHasher.ts`). Cada elemento contiene: `hash` (SHA-256 del contenido base64), `sourceFileName` (nombre original del archivo cargado o `'__clinical_text__'`), `startPage`, `endPage`, `totalPages` y `processedAt` (marca temporal). **Advertencia de privacidad:** Si el archivo original en el disco del usuario contenía datos identificatorios en su denominación (ej. `TAC_Perez_Juan_DNI.pdf`), dicho nombre quedará almacenado de forma persistente en Firestore como `sourceFileName`. **Se recomienda taxativamente renombrar los archivos en el equipo local con nombres genéricos (ej. `tac_torax_control.pdf`) antes de cargarlos en la herramienta.**
- **Inmutabilidad y permanencia de auditoría (`audit_logs`):** Los registros de auditoría se escriben desde el cliente ante cada acción relevante (creación, edición, eliminación de pacientes, procesamiento documental, mensajes de chat). De acuerdo con `firestore.rules`, estos documentos son de solo inserción (`create: if isAuthorized()`) y está terminantemente prohibida su lectura, modificación o borrado desde el cliente (`read, update, delete: if false`). **Al eliminar un paciente de la base de datos, los registros históricos asociados en `audit_logs` SOBREVIVEN de forma permanente en Firestore.** Dichos registros contienen: `doctorId`, `patientId` (identificador interno de Firestore), `doctorName`, `doctorFingerprint` (huella UUID local), `action` y `timestamp`.

### 5.3. Estado local en el navegador
- **IndexedDB:** Utilizado internamente por la librería de Firebase Auth para persistir tokens de autenticación de la sesión. Se elimina al invocar `signOut(auth)`.
- **LocalStorage:** Almacena variables técnicas que **persisten en el navegador incluso tras el cierre de sesión (`logout`)**:
  - `doctor_fingerprint`: Identificador UUID generado por el navegador para correlación de auditoría.
  - `doctor_data_profile_v3_${uid}`: Datos profesionales (nombre, matrícula, especialidad, institución, email) configurados para autocompletar formularios médicos. Si existe un perfil en la clave legada sin UID (`doctor_data_profile_v3`), el sistema verifica que el email coincida estrictamente con la cuenta autenticada, lo migra a la nueva clave por UID y elimina la clave legada de `localStorage`.
  - `onco_fontsize`: Preferencia visual de tamaño de tipografía.
  - `clinical_trials_cached_v2`, `clinical_trials_last_sync_v2`, `clinical_trials_manifest_v2`, `clinical_trials_chunk_v2_*`: Copia local comprimida de ensayos clínicos para funcionamiento sin conexión.
  - `oncoguide_notif_date`, `oncoguide_notif_tomorrow_date`: Marcas de fecha (`YYYY-MM-DD`) para limitar la frecuencia de notificaciones locales de agenda a un aviso diario por condición.

### 5.4. Marco normativo y compromisos de privacidad
El repositorio no cuenta con acuerdos de procesamiento de datos comerciales (BAA) adjuntos ni certificaciones formales de cumplimiento normativo respecto a la Ley 25.326 de Protección de Datos Personales (Argentina) o normativas internacionales (como HIPAA). El uso del sistema con pacientes reales queda condicionado a las políticas de seguridad de la institución y a la debida disociación previa de los datos por parte de los operadores médicos.

---

## 6. Ensayos clínicos: funcionamiento y limitaciones

El módulo de ensayos clínicos permite identificar protocolos de investigación potencialmente relevantes para la situación clínica del paciente:

### 6.1. Sincronización y clasificación de ensayos
- **Fuente oficial:** Consume la API v2 de **ClinicalTrials.gov** (`https://clinicaltrials.gov/api/v2/studies`), filtrando por estudios en Argentina y condiciones oncológicas.
- **Sincronización en backend:** Se ejecuta mediante Cloud Functions (`functions/clinicalTrialsSync.js`):
  - Programada automáticamente: Tarea diaria a las 03:00 (hora local `America/Argentina/Cordoba`) vía `syncClinicalTrialsScheduled`.
  - Manual bajo demanda: Invocación autorizada de `syncClinicalTrials` desde la interfaz.
- **Clasificación oncológica conservadora:** Algoritmo que analiza condiciones, títulos y palabras clave para filtrar ensayos no oncológicos (ej. reumatología o patologías inflamatorias que mencionan citoquinas o factores de necrosis tumoral), neutralizando falsos positivos comunes.
- **Estados de sincronización (ACTIVE / STALE):** Los ensayos se guardan con `syncStatus: 'ACTIVE'`. Si en sincronizaciones exitosas posteriores un estudio deja de reportarse como reclutando o desaparece de la consulta oficial, se actualiza a `syncStatus: 'STALE'` (con marca `staleSince`) y queda automáticamente excluido del pre-screening activo.
- **Identificación de sedes:** Detecta centros en Argentina y específicamente en la provincia de Córdoba, evaluando si la sede local se encuentra reclutando de manera diferenciada al estado global del protocolo.

### 6.2. Motor de matching determinístico (`trialMatcher.ts`)
Evalúa los criterios estructurados del paciente contra las condiciones del ensayo sin delegar la decisión lógica en la IA:
- Edad y sexo admitidos.
- Performance Status (ECOG máximo permitido).
- Estado de biomarcadores moleculares (ej. mutaciones específicas, estado de MSI, o expresión porcentual cuantitativa requerida de PD-L1).
- Parámetros de laboratorio clínico (ej. hemoglobina, plaquetas, neutrófilos, creatinina) y verificación estricta de múltiplos del Límite Superior Normal (ULN), marcando como no evaluable si el informe no consigna el valor de referencia.
- Escenario clínico y confirmación de enfermedad metastásica.
- Historial de líneas de tratamiento sistémico y exposición previa a fármacos específicos.
- Estado de metástasis activas en el Sistema Nervioso Central (SNC), diferenciando ausencia documentada explícita de falta de registro.

### 6.3. Categorías de pre-screening
1. 🟢 **Potencialmente elegible:** Cumple con todos los criterios de inclusión estructurados evaluables y no activa exclusiones.
2. 🟡 **Potencialmente elegible — Falta información:** Cumple con los criterios principales pero existen variables no documentadas en la historia clínica necesarias para definir elegibilidad.
3. 🔴 **No cumple criterio documentado:** Presenta incompatibilidad explícita con al menos un criterio estructurado de inclusión o activa un criterio de exclusión.
4. ⚪ **No evaluable:** Criterios complejos no estructurables automáticamente que requieren revisión médica manual.

### 6.4. Limitaciones del pre-screening
- **No garantiza elegibilidad:** Es un asistente de tamizaje preliminar de carácter exclusivamente orientativo.
- **No garantiza disponibilidad de cupos:** No verifica si el centro específico tiene vacantes activas asignadas ni si el protocolo ha pausado la incorporación en dicha sede.
- **No sustituye al Investigador Principal:** La confirmación formal de inclusión de un paciente en un ensayo clínico requiere evaluación protocolar exhaustiva por parte del equipo del centro de investigación.

---

## 7. Tests y verificación automatizada

La suite de pruebas automatizadas está implementada en **Vitest**:

```bash
# Ejecutar la suite completa de pruebas unitarias y de integración
npm run test

# Modo interactivo en desarrollo
npm run test:watch
```

### 7.1. Cobertura actual
El proyecto cuenta con **13 archivos de prueba** y **166 tests** que validan la lógica de negocio pura:
- `criteriaParser.test.ts`: Extracción y parseo de criterios clínicos desde texto no estructurado.
- `trialOncologyMatcher.test.ts` & `fase4PreScreening.test.ts`: Lógica de asignación de categorías de elegibilidad.
- `fase4_1Precision.test.ts`: Pruebas de alta precisión (evaluación de ULN en laboratorios, umbrales de PD-L1, ausencia vs falta de registro en SNC).
- `patientProfileExtractor.test.ts`: Extracción determinística del perfil oncológico a partir de historias clínicas.
- `trialOncologyClassification.test.ts`: Clasificación de ensayos oncológicos vs no oncológicos y neutralización de términos ambiguos.
- `trialSyncStatus.test.ts`: Asignación y actualización de estados ACTIVE y STALE en sincronización.
- `clinicalTrialCache.test.ts` & `clinicalTrials.test.ts`: Expiración de caché (24 h), fragmentación en chunks y fallback resiliente ante caídas de red o Firestore.
- `patientSecurity.test.ts`: Sanitización de modelos, control de integridad de datos y verificación de que `doctorId` se mantenga aislado.
- `forms.test.ts`: Generación programática de formularios, validación de campos obligatorios (PAMI, Banco de Drogas) y llenado con `pdf-lib`.
- `labPanel.test.ts`: Normalización de sinónimos de laboratorio y descarte de valores biológicamente no plausibles.
- `recist.test.ts`: Cálculo de suma de diámetros, determinación de nadir, cálculo porcentual de cambio y asignación de respuesta según RECIST 1.1 e iRECIST.

### 7.2. Qué NO cubren los tests actuales
- No evalúan las reglas de seguridad de Firestore (`firestore.rules`) ni de Storage (`storage.rules`) mediante emuladores automatizados (`@firebase/rules-unit-testing`).
- No realizan pruebas de integración de extremo a extremo (E2E) contra la API real de ClinicalTrials.gov v2 ni contra el entorno de Cloud Functions / Gemini en producción.
- No incluyen pruebas de interfaz de usuario de extremo a extremo en navegadores (como Playwright o Cypress).

---

## 8. Instalación y variables de entorno

### 8.1. Requisitos previos
- Node.js versión 20 o superior.
- Gestor de paquetes `npm`.
- Proyecto configurado en Firebase (Authentication y Cloud Firestore habilitados).
- Cuenta en Google Cloud o Firebase con acceso a Cloud Functions y Secret Manager.

### 8.2. Instalación local

```bash
# 1. Clonar el repositorio
git clone https://github.com/residenciaoncologiahop-create/Hospital-Oncologico.git
cd Hospital-Oncologico

# 2. Instalar dependencias del frontend
npm install

# 3. Instalar dependencias de Cloud Functions
cd functions
npm install
cd ..

# 4. Configurar variables de entorno locales (ver detalle abajo)
cp .env.example .env.local

# 5. Iniciar servidor de desarrollo
npm run dev
```

### 8.3. Variables de entorno del Frontend
El código de inicialización de Firebase (`src/lib/firebase.ts`) lee las siguientes variables desde `import.meta.env`:

```env
VITE_API_KEY_FIREBASE=
VITE_AUTH_DOMAIN=
VITE_PROJECT_ID=
VITE_STORAGE_BUCKET=
VITE_MESSAGING_SENDER_ID=
VITE_APP_ID=
```

> **Nota de alineación con `.env.example`:** En el archivo `.env.example` distribuido con el repositorio, las variables se listan con el prefijo alternativo `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc. Al configurar su archivo `.env.local`, asegúrese de definir los nombres exactos que consume `src/lib/firebase.ts` indicados en la tabla anterior, o duplicar ambas variantes para garantizar compatibilidad.

### 8.4. Secretos de Cloud Functions
La API key del motor de IA no se define en `.env.local` del frontend. Se configura directamente en Firebase Secret Manager para el runtime de Cloud Functions:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

---

## 9. Despliegue

### 9.1. Frontend (Vercel)
El frontend se compila como una aplicación de página única (SPA) estática:
- Comando de compilación: `npm run build` (genera la carpeta `dist/`).
- El archivo `vercel.json` define políticas de control de encabezados de caché: `no-cache, no-store, must-revalidate` para `index.html` (para garantizar actualizaciones inmediatas de versión) y caché inmutable de larga duración para los recursos en `/assets/*`.

### 9.2. Backend y Reglas (Firebase)
El archivo `.firebaserc` establece el proyecto por defecto (`hospitaloncologico-6117b`). Las directivas de despliegue según `firebase.json` son:

```bash
# Desplegar reglas de seguridad de Firestore y Storage
firebase deploy --only firestore:rules,storage

# Desplegar funciones serverless de backend
firebase deploy --only functions
```

### 9.3. Integración continua (CI)
El flujo `.github/workflows/lint.yml` ejecuta automáticamente el linter ESLint ante cada *push* o *pull request* dirigido a la rama `main`.

---

## 10. Código inactivo o no conectado

A fin de brindar un panorama fidedigno respecto al repositorio, se señalan componentes o utilidades que se encuentran presentes en el código base pero no están conectados en el flujo activo:
- **`patientService.ts` (`uploadFile`):** Contiene lógica para cargar archivos binarios a Firebase Storage (`patients/{patientId}/...`), pero esta función no es invocada por ningún componente de la aplicación activa (los archivos solo se manejan temporalmente en base64 en memoria).
- **`storage.rules`:** Existen reglas de acceso declaradas para buckets de Firebase Storage, aunque la aplicación activa no realiza almacenamiento de archivos allí.
- **`aiProxy.ts` (`compareRecistSecure`):** Función auxiliar con prompt para comparación radiológica mediante IA que no está importada en la interfaz; la evaluación RECIST 1.1 e iRECIST activa se realiza de manera determinística en TypeScript dentro de `ImagingPanel.tsx`.

---

## 11. Limitaciones conocidas y trabajo pendiente

- **Redacción previa obligatoria manual:** La aplicación no incluye módulo de visión computarizada local para desenfocar o enmascarar automáticamente membretes, firmas o datos filiatorios en los documentos adjuntos antes de su envío a Gemini.
- **Entorno formativo volátil:** El modo específico para médicos residentes no persiste registros, lo que obliga a reingresar datos si se recarga la pestaña del navegador.
- **Pruebas de seguridad en CI:** Las reglas de seguridad de Firestore se auditan manualmente o mediante pruebas lógicas, pero no cuentan con una suite en emulador ejecutándose en el pipeline de GitHub Actions.
- **Discrepancia en nomenclatura de variables de entorno:** Coexistencia de nomenclaturas en `.env.example` vs `src/lib/firebase.ts`.

---

## 12. Licencia y contribución

- **Licencia:** Distribuido bajo los términos de la Licencia MIT. Consulte el archivo [`LICENSE`](LICENSE) para más detalles. Copyright (c) 2025 Agustin Gallardo — Residencia de Oncología Clínica, Hospital Oncológico Provincial, Córdoba, Argentina.
- **Contribuciones:** De uso primario interno en el Hospital Oncológico Provincial. Para proponer cambios o reportar incidencias, consulte las directrices de contribución en [`CONTRIBUTING.md`](CONTRIBUTING.md). Todo Pull Request debe verificar la ejecución correcta de `npm run build`, `npm run lint` y `npm run test` antes de su integración a `main`.
