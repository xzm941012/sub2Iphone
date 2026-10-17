import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localBridge } from './scripts/local-bridge.mjs';
export default defineConfig({ plugins: [react(), localBridge()], server: { host: '127.0.0.1', port: 4173, strictPort: true } });
