# OncoGuide AI — Asistente Clínico para Oncología

Herramienta de apoyo a la discusión clínica, la gestión de trámites y la docencia en oncología.  
Desarrollada en el contexto de la residencia médica del **Hospital Oncológico Provincial de Córdoba**.

> **Versión activa:** [hospital-oncologico.vercel.app](https://hospital-oncologico.vercel.app)

---

## ¿Qué es OncoGuide?

OncoGuide es una aplicación web que permite a los profesionales de oncología:

- Organizar casos clínicos de forma estructurada
- Procesar documentación médica (PDFs e imágenes) con inteligencia artificial
- Extraer y editar mediciones radiológicas con criterios **RECIST 1.1 e iRECIST**
- Generar formularios administrativos y evoluciones listas para la historia clínica digital
- Discutir casos y preparar presentaciones para ateneos o comités de tumores

**No reemplaza la historia clínica oficial ni el juicio clínico del equipo tratante.**  
Es una herramienta de apoyo, organización y docencia.

---

## Funcionalidades principales

### 1. Gestión de casos clínicos
- Registro por **número de historia clínica** (sin nombre, apellido ni DNI)
- Documentación adjunta, línea de tiempo clínica, laboratorios e imágenes
- Buscador y filtro por categoría de eventos

### 2. Procesamiento de documentos con IA
- Análisis de PDFs e imágenes de historia clínica
- Extracción automática de eventos clínicos ordenados cronológicamente
- Extracción de resultados de laboratorio relevantes
- Deduplicación y normalización de datos

### 3. Módulo de Imágenes (RECIST / iRECIST)
- Extracción individual de estudios de TC, RMN, PET-TC y ecografía
- **Paso de revisión y editor completo** de lesiones target y non-target
- Cálculo de suma de diámetros, nadir y porcentaje de cambio
- Evaluación automática según **RECIST 1.1 e iRECIST**
- Curva temporal de evolución de lesiones
- Posibilidad de override manual

### 4. Generación de informes y evoluciones
- Resumen de Historia Clínica (formato institucional / DINADIC)
- Plan de seguimiento basado en guías (con diferenciación de escenarios: Vigilancia Curativa, Metastásico Activo, Post-Metastasectomía)
- **Generación de Evolución** lista para Historia Clínica Digital
- Auditoría de completitud de la historia clínica

### 5. Gestión de trámites administrativos
- Formulario **PAMI oncológico** (con inferencia de drogas y completado interactivo)
- Admisión y Renovación de Banco de Drogas
- Formulario DINADIC
- **Nuevos formularios modulares:**
  - Form 03 Prácticas
  - Ficha de Medicamentos Onco
  - Form 133 PROFE

### 6. Asistente de discusión clínica
- Chat contextualizado por paciente
- Consulta de criterios de tratamiento e interpretación de estudios
- Preparación de presentaciones para ateneo / comité de tumores

### 7. Módulo educativo para residentes
- Casos clínicos de aprendizaje
- Generación de preguntas de razonamiento clínico
- Análisis guiado de evidencia

### 8. Herramientas adicionales
- Calculadora de superficie corporal (fórmula de Mosteller)
- Listado de fármacos de uso frecuente

---

## Tecnologías

| Tecnología              | Rol                          |
|-------------------------|------------------------------|
| React 19 + TypeScript   | Frontend                     |
| Firebase Firestore      | Base de datos                |
| Firebase Auth           | Autenticación                |
| Firebase Cloud Functions| Proxy seguro para IA         |
| Gemini 2.5 Flash        | Motor de IA                  |
| Vite 6                  | Build tool                   |
| Tailwind CSS            | Estilos                      |
| Recharts                | Gráficos de evolución        |
| pdf-lib                 | Generación de PDFs           |

---

## Privacidad y protección de datos

Diseñado con **privacidad por defecto** en cumplimiento de la **Ley 25.326 de Protección de Datos Personales (Argentina)**.

- Los casos se identifican únicamente por **número de historia clínica**
- No se almacenan nombre, apellido, DNI ni datos de contacto
- Los archivos PDF e imágenes se procesan de forma **temporal** y no se guardan
- La IA solo recibe datos anonimizados (rango etario, diagnóstico y notas clínicas)
- Acceso restringido mediante autenticación institucional

---

## Seguridad

- La API key de Gemini **nunca** se expone al cliente (reside en Firebase Secret Manager)
- Todas las llamadas a IA pasan por Cloud Functions autenticadas con rate limiting
- Reglas de Firestore: cada profesional solo accede a sus propios casos
- Sin envío de datos identificatorios a servidores externos

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
# Completar .env.local con las credenciales de Firebase

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

## Roadmap

- [ ] Modo Demo con casos ficticios precargados
- [ ] Tests unitarios e integración
- [ ] Soporte multi-hospital
- [ ] Exportación a Google Drive / OneDrive
- [ ] Módulo de seguimiento de toxicidades
- [ ] Integración automática de guías NCCN/ESMO actualizadas
- [ ] App móvil (React Native)

---

## Contribuir

Este proyecto es de uso interno de la residencia del Hospital Oncológico Provincial de Córdoba.  
Si sos residente o profesional del HOP y querés reportar un bug o sugerir una mejora:

1. Abrí un Issue en GitHub describiendo el problema o la idea.
2. Para cambios de código, creá una rama `feature/nombre-de-la-mejora` desde `main`.
3. Nunca commitear archivos `.env` ni `.env.local`.
4. Asegurate de que `npm run build` pase antes de hacer un Pull Request.

---

## Aviso legal

Esta herramienta es un soporte para la organización de información y la discusión educativa.  
Los informes, extracciones RECIST, formularios y sugerencias generados por inteligencia artificial son orientativos y no constituyen diagnóstico, prescripción ni recomendación clínica formal.  
Toda decisión clínica es responsabilidad exclusiva del profesional médico tratante.

El uso de esta herramienta con datos de pacientes reales es responsabilidad del profesional que la utiliza, quien debe garantizar el cumplimiento de la normativa vigente en materia de privacidad y ética médica.

---

## Contacto y desarrollo

Desarrollado por la residencia de Oncología Clínica — Hospital Oncológico Provincial, Córdoba, Argentina.
