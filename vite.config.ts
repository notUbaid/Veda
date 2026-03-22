import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const ollamaUrl = env.VITE_OLLAMA_URL || 'http://localhost:11434';

  return {
    plugins: [react(), tailwindcss()],

    define: {
      'process.env.GEMINI_API_KEY':               JSON.stringify(env.GEMINI_API_KEY),
      'process.env.FIREBASE_API_KEY':             JSON.stringify(env.FIREBASE_API_KEY),
      'process.env.FIREBASE_PROJECT_ID':          JSON.stringify(env.FIREBASE_PROJECT_ID),
      'process.env.FIREBASE_APP_ID':              JSON.stringify(env.FIREBASE_APP_ID),
      'process.env.FIREBASE_AUTH_DOMAIN':         JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
      'process.env.FIREBASE_STORAGE_BUCKET':      JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
      'process.env.FIREBASE_DATABASE_ID':         JSON.stringify(env.FIREBASE_DATABASE_ID),
      'process.env.EMAILJS_SERVICE_ID':           JSON.stringify(env.EMAILJS_SERVICE_ID),
      'process.env.EMAILJS_TEMPLATE_ID':          JSON.stringify(env.EMAILJS_TEMPLATE_ID),
      'process.env.EMAILJS_PUBLIC_KEY':           JSON.stringify(env.EMAILJS_PUBLIC_KEY),
    },

    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },

    server: {
      port: 5173,
      hmr: true,
      // Proxy /ollama/* → local Ollama, bypassing browser CORS restrictions
      proxy: {
        '/ollama': {
          target: ollamaUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ollama/, ''),
        },
      },
    },
  };
});
