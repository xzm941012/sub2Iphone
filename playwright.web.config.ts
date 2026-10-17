import { defineConfig } from '@playwright/test';
const publicOrigin = process.env.SUBWATCH_TEST_ORIGIN;
export default defineConfig({ testDir: './tests', testMatch: 'web.spec.ts', timeout: 30000, workers: 1, use: { baseURL: publicOrigin || 'http://127.0.0.1:4185', viewport: { width: 1280, height: 900 } }, webServer: publicOrigin ? undefined : { command: 'node dist/server/index.mjs', url: 'http://127.0.0.1:4185/subwatch/', reuseExistingServer: true } });
