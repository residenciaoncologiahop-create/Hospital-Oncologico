# OncoGuide AI — Asistente Clínico para Oncología

![Deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Firebase](https://img.shields.io/badge/Firebase-10-FFCA28?logo=firebase)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/estado-MVP_en_uso_interno-yellow)

Herramienta de apoyo a la discusión clínica y la docencia en oncología, desarrollada en el contexto de la residencia médica del Hospital Oncológico Provincial de Córdoba.

> **Versión activa:** [hospital-oncologico.vercel.app](https://hospital-oncologico.vercel.app)

---

## ¿Qué es OncoGuide?

OncoGuide es una aplicación web que permite a los profesionales de oncología organizar casos clínicos, procesar documentación médica con inteligencia artificial y generar informes estructurados. Está diseñada para facilitar la discusión en ateneos, la preparación de trámites administrativos y el seguimiento educativo de residentes.

**No reemplaza la historia clínica oficial ni el juicio clínico del equipo tratante.** Es una herramienta de apoyo y organización.

---

## Funcionalidades principales

**Gestión de casos clínicos**
Los casos se registran mediante el número de historia clínica del hospital, sin nombre ni DNI del paciente. Cada caso incluye documentación adjunta, línea de tiempo clínica, laboratorios y un asistente de discusión.

**Procesamiento de documentos con IA**
La aplicación analiza archivos PDF e imágenes de historia clínica para extraer automáticamente eventos clínicos ordenados cronológicamente y resultados de laboratorio relevantes.

**Asistente de discusión clínica**
Chat integrado que permite plantear dudas sobre el caso, consultar criterios de tratamiento, discutir interpretación de estudios y preparar presentaciones para ateneo o comité de tumores.

**Generación de informes**
- Resumen de historia clínica institucional
- Plan de seguimiento basado en guías NCCN/ESMO
- Presentación para comité de tumores
- Auditoría de completitud de la historia clínica

**Gestión de trámites**
Generación automática del formulario PAMI oncológico y resúmenes clínicos para trámites de banco de drogas (admisión, renovación, DINADIC).

**Módulo educativo para residentes**
Modo de aprendizaje con casos clínicos educativos, generación de preguntas de razonamiento clínico y análisis guiado de la evidencia.

---

## Tecnologías

| Tecnología | Rol |
|---|---|
| ⚛️ React 19 + TypeScript | Frontend |
| 🔥 Firebase Firestore | Base de datos |
| 🔐 Firebase Auth | Autenticación |
| ☁️ Firebase Cloud Functions | Proxy seguro para IA |
| 🤖 Gemini 2.5 Flash | Motor de IA |
| ⚡ Vite 6 | Build tool |
| 🎨 Tailwind CSS | Estilos |
| 📄 pdf-lib | Generación de PDFs |

---

## Desarrollo local

```bash
# 1. Clonar el repositorio
git clone https://github.com/residenciaoncologiahop-create/Hospital-Oncologico.git
cd Hospital-Oncologico

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Completar .env.local con los valores de Firebase

# 4. Iniciar en desarrollo
npm run dev
```

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | Verificar código con ESLint |
| `npm run lint:fix` | Corregir errores automáticamente |
| `npm run format` | Formatear con Prettier |

---

## Privacidad y protección de datos

OncoGuide fue diseñado con privacidad por defecto en cumplimiento con la **Ley 25.326 de Protección de Datos Personales (Argentina)**.

- Los casos se almacenan usando el **número de historia clínica** como identificador, sin nombre, apellido ni DNI del paciente.
- Los archivos PDF adjuntados se procesan temporalmente para su análisis y **no se almacenan** en ningún servidor.
- La inteligencia artificial no recibe datos identificatorios — solo rango etario, diagnóstico y notas clínicas anonimizadas.
- El acceso requiere autenticación con cuenta institucional.

---

## Seguridad

- La API key de Gemini nunca está expuesta al cliente — reside en Firebase Secret Manager.
- Todas las llamadas a IA pasan por una Cloud Function autenticada con rate limiting.
- Las reglas de Firestore garantizan que cada profesional solo accede a sus propios casos.
- Sin datos identificatorios de pacientes en ningún servidor externo.

---

## Roadmap

- [ ] Soporte multi-hospital
- [ ] Export a Google Drive / OneDrive
- [ ] Módulo de seguimiento de toxicidades
- [ ] Integración con guías NCCN actualizadas automáticamente
- [ ] App móvil (React Native)
- [ ] Tests unitarios e integración

---

## Contribuir

Este proyecto es de uso interno de la residencia. Si sos residente o profesional del HOP y querés reportar un bug o sugerir una mejora:

1. Abrí un **Issue** en GitHub describiendo el problema o la idea.
2. Para cambios de código, creá una rama `feature/nombre-de-la-mejora` desde `main`.
3. **Nunca commitear `.env` ni `.env.local`** — usar `.env.example` como referencia.
4. Asegurate de que `npm run build` pase antes de hacer un PR.

---

## Aviso legal

Esta herramienta es un **soporte para la organización de información y la discusión educativa**. Los informes y sugerencias generados por inteligencia artificial son orientativos y no constituyen diagnóstico, prescripción ni recomendación clínica formal.

Toda decisión clínica es responsabilidad exclusiva del profesional médico tratante. El uso de esta herramienta con datos de pacientes reales es responsabilidad del profesional que la utiliza, quien debe garantizar el cumplimiento de la normativa vigente en materia de privacidad y ética médica.

---

## Contacto y desarrollo

Desarrollado por la residencia de Oncología Clínica — Hospital Oncológico Provincial, Córdoba, Argentina.
