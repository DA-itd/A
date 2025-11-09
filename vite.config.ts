import path from 'path';
import { defineConfig, loadEnv } from 'vite';
// Fix: Import `process` to provide correct type definitions for `process.cwd()`.
import * as process from 'process';


export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        rollupOptions: {
          input: {
            inscripciones: path.resolve(process.cwd(), 'inscripciones.tsx'),
            constancias: path.resolve(process.cwd(), 'constancias.tsx'),
          },
          output: {
            entryFileNames: `[name].js`,
            chunkFileNames: `[name].js`,
            assetFileNames: `[name].[ext]`
          }
        }
      },
      plugins: [],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Fix for "Cannot find name '__dirname'". __dirname is not available in ES modules.
          // Using process.cwd() provides the project root directory, which is the intended alias target.
          '@': path.resolve(process.cwd()),
        }
      }
    };
});