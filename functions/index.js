const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL_NAME = "gemini-2.5-flash"; // v2

exports.callGemini = onCall(
  { 
    cors: true,
    secrets: [GEMINI_API_KEY],
    memory: "1GiB",
    timeoutSeconds: 300
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debe iniciar sesión para usar esta función.");
    }
    const { prompt, parts, systemInstruction, responseMimeType } = request.data;
    try {
      const cleanApiKey = GEMINI_API_KEY.value().replace(/['"]/g, '').trim();
      if (!cleanApiKey) throw new HttpsError("internal", "API Key no configurada.");
      const genAI = new GoogleGenerativeAI(cleanApiKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemInstruction || undefined,
      });
      const contents = parts
        ? [{ role: "user", parts }]
        : [{ role: "user", parts: [{ text: prompt || "" }] }];
      const generationConfig = responseMimeType ? { responseMimeType } : undefined;
      const result = await model.generateContent({ contents, generationConfig });
      return { text: result.response.text() };
    } catch (error) {
      console.error("Error llamando a Gemini:", error);
      throw new HttpsError("internal", "Error IA: " + error.message);
    }
  }
);
