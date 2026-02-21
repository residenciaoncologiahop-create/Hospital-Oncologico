const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-2.5-flash";

exports.callGemini = onCall(async (request) => {

    // 1. Verificar autenticación
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debe iniciar sesión para usar esta función.");
    }

    const { prompt, parts, systemInstruction, responseMimeType } = request.data;

    if (!prompt && (!parts || parts.length === 0)) {
      throw new HttpsError("invalid-argument", "Se requiere prompt o parts.");
    }

    try {
      // 2. Leer la clave desde el archivo .env
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new HttpsError("internal", "API Key no configurada en el servidor.");
      }

      // 3. El .trim() es MAGIA: borra espacios en blanco accidentales
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemInstruction || undefined,
      });

      const contents = parts
        ? [{ role: "user", parts }]
        : [{ role: "user", parts: [{ text: prompt }] }];

      const generationConfig = responseMimeType ? { responseMimeType } : undefined;

      const result = await model.generateContent({
        contents,
        generationConfig,
      });

      return { text: result.response.text() };

    } catch (error) {
      console.error("Error llamando a Gemini:", error);
      throw new HttpsError("internal", "Error al procesar la solicitud de IA.");
    }
});
