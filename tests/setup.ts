import fs from 'fs';
import path from 'path';

// Polyfill window.location si no existe en entorno Node
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    location: {
      origin: 'http://localhost:3000',
    },
  };
} else if (!(globalThis as any).window.location) {
  (globalThis as any).window.location = {
    origin: 'http://localhost:3000',
  };
}

// Polyfill localStorage si no existe
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

// Interceptar fetch para servir archivos PDF estáticos desde public/forms/
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;

  if (urlStr.includes('/forms/') && urlStr.endsWith('.pdf')) {
    const filename = path.basename(urlStr);
    const filePath = path.resolve(process.cwd(), 'public/forms', filename);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return new Response(buffer, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/pdf' },
      });
    }
  }

  if (originalFetch) {
    return originalFetch(input, init);
  }

  throw new Error(`Unhandled fetch request in test environment: ${urlStr}`);
};
