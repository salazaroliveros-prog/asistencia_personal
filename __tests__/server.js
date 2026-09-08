/**
 * Servidor HTTP simple para pruebas E2E.
 * Escucha en http://localhost:3800 y sirve el directorio raíz del proyecto.
 *
 * Uso:
 *   npm start
 *   npm run dev
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');

const PORT = 3800;
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Sirve index.html para rutas SPA
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Fallback a index.html para rutas SPA
      const indexPath = path.join(ROOT, 'index.html');
      fs.stat(indexPath, (err2, stat2) => {
        if (err2 || !stat2.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 - Not Found');
          return;
        }
        const stream = fs.createReadStream(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        stream.pipe(res);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor de pruebas corriendo en http://localhost:${PORT}`);
  console.log(`   Sirviendo: ${ROOT}`);
  console.log('   Presiona Ctrl+C para detener.');
});
