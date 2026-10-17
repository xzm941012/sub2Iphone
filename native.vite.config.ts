import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: './', build: { copyPublicDir: false, outDir: 'android/assets', emptyOutDir: true, rollupOptions: { input: 'native.html' } } });
