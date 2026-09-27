import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  // Single source of truth for the displayed version — CI stamps package.json
  // with the release version before building.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
