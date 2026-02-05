import { defineConfig } from 'vite';

export default defineConfig({
  base: '/wfc-visualizer/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
