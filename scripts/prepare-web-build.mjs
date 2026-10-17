import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/scripts', { recursive: true });
cpSync('server', 'dist/server', { recursive: true });
cpSync('scripts/account-admin.mjs', 'dist/scripts/account-admin.mjs');
cpSync('public/branding', 'dist/client/branding', { recursive: true });
writeFileSync('dist/package.json', JSON.stringify({ name: 'subwatch-web', private: true, type: 'module', scripts: { start: 'node server/index.mjs' }, engines: { node: '>=22.18' } }, null, 2) + '\n');
console.log('Prepared standalone Web deployment in dist/ (Node.js 22+, no runtime dependencies)');
