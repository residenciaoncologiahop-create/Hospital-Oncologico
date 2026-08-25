import { callGemini } from './aiProxy';

interface FileData { name: string; type: string; data: string; }

export const generateClinicalAudit = async (text: string, files: FileData[]) => {
  try {
    const auditPrompt = `
ACTUÁ COMO:
Extractor y auditor de registros clínicos oncológicos.

OBJETIVO:
Detectar vacíos documentales críticos e inconsistencias en la historia clínica del paciente.
NO realizar interpretación clínica ni sugerir decisiones terapéuticas.

REGLAS DE SEGURIDAD (CERO TOLERANCIA):
1. NO emitas opiniones clínicas ni sugerencias terapéuticas.
2. NO infieras datos no escritos.
3. Si un dato no está explícito, señalar la falta en las alertas.

CRITERIOS CLÍNICOS Y DOCUMENTALES A AUDITAR:
1) COMPLETITUD DE VARIABLES CLAVE:
   - Estadio tumoral completo (TNM / FIGO)
   - Performance status (ECOG / WHO)
   - Informe de biopsia / confirmación histopatológica
   - Biomarcadores / perfil molecular requerido
   - Imágenes relevantes de estadificación/respuesta
   - Registro de tratamientos previos o activos
2) INCONSISTENCIAS Y DISCORDANCIAS DOCUMENTALES:
   - Discordancia cronológica de fechas
   - Discordancia entre estadio y hallazgos patológicos o radiológicos
   - Falta de criterios de respuesta documentados (ej. iRECIST en inmunoterapia) o discrepancias en la indicación

FORMATO DE SALIDA ESTRICTO (JSON):
- Si NO se detectan inconsistencias ni vacíos críticos relevantes:
  {
    "hasIssues": false,
    "alerts": []
  }

- Si se detectan inconsistencias o vacíos críticos:
  {
    "hasIssues": true,
    "alerts": [
      {
        "category": "Tratamiento" | "Estadificación" | "Biopsia" | "Biomarcadores" | "Imágenes" | "Performance Status" | "Cronología",
        "summary": "Frase breve y directa (ej: verificar correspondencia con inmunoterapia/iRECIST o falta información para confirmar el estadio).",
        "detail": "Explicación contextual y justificación documental precisa en 1-2 oraciones."
      }
    ]
  }

IMPORTANTE:
- NO incluyas en la lista de alertas los controles que fueron correctos.
- NO agregues texto fuera del JSON.

ENTRADA DE DATOS:
- Notas clínicas: "${text}"
    `;

    const parts: any[] = [{ text: auditPrompt }];

    // Inyección de archivos adjuntos (Solo si existen)
    if (files && Array.isArray(files)) {
      files.slice(0, 5).forEach(f => {
        if (f.data && f.type) {
          parts.push({ inlineData: { mimeType: f.type, data: f.data } });
        }
      });
    }

    // Llamada segura al backend usando callGemini
    const res = await callGemini({ parts, responseMimeType: "application/json" });

    const raw = res.text ? (typeof res.text === 'function' ? res.text() : res.text) : "";
    return raw.replace(/```json|```html|```/g, '').trim();

  } catch (e: any) {
    console.error("Audit Error:", e);
    return JSON.stringify({
      hasIssues: true,
      alerts: [{
        category: "Sistema",
        summary: "No se pudo realizar el control de calidad",
        detail: e.message
      }]
    });
  }
};
