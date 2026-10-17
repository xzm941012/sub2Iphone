import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Separate from the Android/device-preview runtime and its integrity lock.
export default defineConfig({ base: '/subwatch/', plugins: [react()], build: { target: ['chrome111', 'edge111', 'firefox114', 'safari16.2', 'ios16.2'], cssTarget: 'safari16.2', outDir: 'dist/client', copyPublicDir: false }, server: { host: '127.0.0.1', port: 4185 } });
