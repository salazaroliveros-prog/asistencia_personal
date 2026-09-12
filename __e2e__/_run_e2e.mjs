import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3800', '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (d) => {
  const out = d.toString().trim();
  console.log('[server] ' + out);
});
child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

// Wait for server to be ready
await new Promise((res) => setTimeout(res, 4000));
console.log('[runner] Server should be ready, launching Playwright tests...');

try {
  execSync('npx playwright test __e2e__/e2e.spec.js --config playwright.config.ts --reporter line' + (process.argv[2] ? ' --grep "' + process.argv[2] + '"' : ''), {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('[runner] Tests finished');
} catch {
  console.log('[runner] Tests completed (some may have failed - check output)');
}

child.kill();
console.log('[runner] Server stopped.');