/**
 * BACKEND PROXY PARA GEMINI API
 * 
 * Este archivo va en la carpeta /functions de tu proyecto Firebase.
 * Reemplaza las llamadas directas al SDK de Gemini desde el frontend,
 * manteniendo la API key segura en el servidor.
 * 
 * SETUP:
 *   1. cd functions && npm install
 *   2. firebase deploy --only functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineSecret } = require("firebase-functions/params");

// La API key se guarda como Secret en Firebase (nunca en código)
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const MODEL_NAME = "gemini-2.5-flash";

// ──────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: Proxy genérico para Gemini
// ──────────────────────────────────────────────
exports.callGemini = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {

    // 1. VERIFICAR QUE EL USUARIO ESTÁ AUTENTICADO
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión para usar esta función."
      );
    }

    const { prompt, parts, systemInstruction, responseMimeType } = request.data;

    if (!prompt && (!parts || parts.length === 0)) {
      throw new HttpsError("invalid-argument", "Se requiere prompt o parts.");
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemInstruction || undefined,
      });

      // Construir contenido: si viene 'parts' es multimodal, si no, texto simple
      const contents = parts
        ? [{ role: "user", parts }]
        : [{ role: "user", parts: [{ text: prompt }] }];

      const generationConfig = responseMimeType
        ? { responseMimeType }
        : undefined;

      const result = await model.generateContent({
        contents,
        generationConfig,
      });

      const response = result.response;
      return { text: response.text() };

    } catch (error) {
      console.error("Error llamando a Gemini:", error);
      throw new HttpsError("internal", "Error al procesar la solicitud de IA.");
    }
  }
);
