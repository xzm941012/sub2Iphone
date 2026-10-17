import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Separate from the Android/device-preview runtime and its integrity lock.
export default defineConfig({ base: '/subwatch/', plugins: [react()], build: { outDir: 'dist/client', copyPublicDir: false }, server: { host: '127.0.0.1', port: 4185 } });
