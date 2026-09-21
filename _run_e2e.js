const { spawn } = require('child_process');
const http = require('http');

const PORT = 3801;
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT)], {
  stdio: 'pipe',
  cwd: process.cwd(),
  shell: true,
});

let output = '';
server.stdout.on('data', (d) => { output += d.toString(); if (output.length > 5000) output = output.slice(-2000); });
server.stderr.on('data', (d) => { output += d.toString(); if (output.length > 5000) output = output.slice(-2000); });

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/index.html`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    }).on('error', () => resolve(false));
    setTimeout(() => { req.destroy(); resolve(false); }, 2000);
  });
}

(async () => {
  console.log('Starting Vite on port', PORT);
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const ok = await checkServer();
    if (ok) {
      console.log('Vite ready on port', PORT);
      const args = process.argv.slice(2);
      const result = spawn('npx', ['playwright', 'test', '--config=playwright.qr-camera.config.ts'].concat(args), {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, HEADLESS: '1' },
        shell: true,
      });
      result.on('close', (code) => {
        server.kill();
        process.exit(code || 0);
      });
      return;
    }
  }
  console.error('Vite not ready after 30s');
  console.error(output.slice(-2000));
  server.kill();
  process.exit(1);
})();

