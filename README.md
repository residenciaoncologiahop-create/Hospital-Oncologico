# OncoGuide AI — Asistente Clínico para Oncología

Herramienta de apoyo a la discusión clínica y la docencia en oncología, desarrollada en el contexto de la residencia médica del Hospital Oncológico Provincial de Córdoba.

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

## Privacidad y protección de datos

OncoGuide fue diseñado con privacidad por defecto en cumplimiento con la **Ley 25.326 de Protección de Datos Personales (Argentina)**.

- Los casos se almacenan usando el **número de historia clínica** como identificador, sin nombre, apellido ni DNI del paciente.
- Los archivos PDF adjuntados se procesan temporalmente para su análisis y **no se almacenan** en ningún servidor.
- La inteligencia artificial no recibe datos identificatorios — solo rango etario, diagnóstico y notas clínicas anonimizadas.
- El acceso requiere autenticación con cuenta institucional.

---

## Tecnología

La aplicación utiliza el modelo **Gemini 2.5 Flash** de Google como motor de inteligencia artificial. Las llamadas a la IA se realizan exclusivamente a través de un servidor intermediario (Cloud Function de Firebase), nunca directamente desde el navegador. La clave de API nunca está expuesta al usuario final.

Los datos clínicos se almacenan en **Firebase Firestore** con reglas de acceso que garantizan que cada profesional solo puede ver sus propios casos.

---

## Aviso legal

Esta herramienta es un **soporte para la organización de información y la discusión educativa**. Los informes y sugerencias generados por inteligencia artificial son orientativos y no constituyen diagnóstico, prescripción ni recomendación clínica formal.

Toda decisión clínica es responsabilidad exclusiva del profesional médico tratante. El uso de esta herramienta con datos de pacientes reales es responsabilidad del profesional que la utiliza, quien debe garantizar el cumplimiento de la normativa vigente en materia de privacidad y ética médica.

---

## Contacto y desarrollo

Desarrollado por la residencia de Oncología Clínica — Hospital Oncológico Provincial, Córdoba, Argentina.

Versión activa: [hospital-oncologico.vercel.app](https://hospital-oncologico.vercel.app)
