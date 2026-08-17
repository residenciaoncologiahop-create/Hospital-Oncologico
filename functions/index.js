const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL_NAME = "gemini-2.5-flash";

// ── Rate limiting en memoria ───────────────────────────────────────────
// { uid -> [timestamp, ...] } — se resetea si el proceso se recicla (aceptable para CF).
const rateLimitMap = new Map();

const RATE_LIMIT = {
  windowMs:        60 * 1000,  // ventana de 1 minuto
  maxRequests:     15,         // máx 15 llamadas/min por UID
  burstWindowMs:   5 * 1000,   // ventana anti-burst
  burstMaxRequests: 4,         // máx 4 llamadas en 5s
};

function checkRateLimit(uid) {
  const now = Date.now();
  const history = rateLimitMap.get(uid) || [];
  const windowStart = now - RATE_LIMIT.windowMs;
  const recent = history.filter(ts => ts > windowStart);

  // Anti-burst
  const burstStart = now - RATE_LIMIT.burstWindowMs;
  const burst = recent.filter(ts => ts > burstStart);
  if (burst.length >= RATE_LIMIT.burstMaxRequests) {
    throw new HttpsError("resource-exhausted",
      "Demasiadas solicitudes en poco tiempo. Esperá unos segundos.");
  }

  // Límite por minuto
  if (recent.length >= RATE_LIMIT.maxRequests) {
    throw new HttpsError("resource-exhausted",
      `Límite de ${RATE_LIMIT.maxRequests} solicitudes/min alcanzado. Intentá en un momento.`);
  }

  recent.push(now);
  rateLimitMap.set(uid, recent);

  // Limpieza periódica del mapa (evitar memory leak)
  if (rateLimitMap.size > 500) {
    for (const [key, timestamps] of rateLimitMap.entries()) {
      if (timestamps.every(ts => ts < windowStart)) rateLimitMap.delete(key);
    }
  }
}

// ── Validación de entrada ──────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/gif",
]);

const ALLOWED_RESPONSE_TYPES = new Set(["application/json", "text/plain"]);

const LIMITS = {
  promptMaxChars:           500_000,   // ~125k tokens de texto
  systemInstructionMaxChars: 10_000,
  maxParts:                     30,    // partes totales por request
  maxInlineDataParts:           15,    // archivos adjuntos
  inlineDataMaxBytes:   20_000_000,    // 20 MB por archivo
};

function validateInput({ prompt, parts, systemInstruction, responseMimeType }) {
  if (!prompt && (!parts || parts.length === 0)) {
    throw new HttpsError("invalid-argument", "Se requiere 'prompt' o 'parts'.");
  }

  if (prompt !== undefined) {
    if (typeof prompt !== "string")
      throw new HttpsError("invalid-argument", "'prompt' debe ser string.");
    if (prompt.length > LIMITS.promptMaxChars)
      throw new HttpsError("invalid-argument",
        `'prompt' supera el límite de ${LIMITS.promptMaxChars} caracteres.`);
  }

  if (parts !== undefined) {
    if (!Array.isArray(parts))
      throw new HttpsError("invalid-argument", "'parts' debe ser un array.");
    if (parts.length > LIMITS.maxParts)
      throw new HttpsError("invalid-argument",
        `'parts' supera el máximo de ${LIMITS.maxParts} elementos.`);

    let inlineCount = 0;
    for (const part of parts) {
      if (typeof part !== "object" || part === null)
        throw new HttpsError("invalid-argument", "Cada parte debe ser un objeto.");

      if (part.text !== undefined) {
        if (typeof part.text !== "string")
          throw new HttpsError("invalid-argument", "part.text debe ser string.");
        if (part.text.length > LIMITS.promptMaxChars)
          throw new HttpsError("invalid-argument",
            `Una parte de texto supera el límite de ${LIMITS.promptMaxChars} caracteres.`);
      }

      if (part.inlineData !== undefined) {
        inlineCount++;
        if (inlineCount > LIMITS.maxInlineDataParts)
          throw new HttpsError("invalid-argument",
            `Máximo ${LIMITS.maxInlineDataParts} archivos por solicitud.`);

        const { mimeType, data } = part.inlineData;
        if (!ALLOWED_MIME_TYPES.has(mimeType))
          throw new HttpsError("invalid-argument",
            `Tipo de archivo no permitido: '${mimeType}'.`);
        if (typeof data !== "string")
          throw new HttpsError("invalid-argument", "inlineData.data debe ser string base64.");
        if (data.length * 0.75 > LIMITS.inlineDataMaxBytes)
          throw new HttpsError("invalid-argument",
            `Archivo supera el límite de ${LIMITS.inlineDataMaxBytes / 1_000_000} MB.`);
      }
    }
  }

  if (systemInstruction !== undefined) {
    if (typeof systemInstruction !== "string")
      throw new HttpsError("invalid-argument", "'systemInstruction' debe ser string.");
    if (systemInstruction.length > LIMITS.systemInstructionMaxChars)
      throw new HttpsError("invalid-argument",
        `'systemInstruction' supera el límite de ${LIMITS.systemInstructionMaxChars} caracteres.`);
  }

  if (responseMimeType !== undefined && !ALLOWED_RESPONSE_TYPES.has(responseMimeType)) {
    throw new HttpsError("invalid-argument",
      `'responseMimeType' no permitido: '${responseMimeType}'.`);
  }
}

// ── Cloud Function ─────────────────────────────────────────────────────
exports.callGemini = onCall(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async (request) => {
    // 1. Autenticación
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debe iniciar sesión para usar esta función.");
    }
    const uid = request.auth.uid;

    // 2. Rate limiting
    checkRateLimit(uid);

    // 3. Validación de entrada
    const { prompt, parts, systemInstruction, responseMimeType } = request.data;
    validateInput({ prompt, parts, systemInstruction, responseMimeType });

    // 4. Llamada a Gemini
    try {
      const cleanApiKey = GEMINI_API_KEY.value().replace(/['"]/g, "").trim();
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
      if (error instanceof HttpsError) throw error;
      console.error(`[callGemini] UID=${uid}`, error.message);
      throw new HttpsError("internal", "Error al procesar la solicitud. Intentá nuevamente.");
    }
  }
);
