const http = require('http');
http.get('http://localhost:3800/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const hasActiveDemo  = data.includes('src="js/demo-data.js"') && !data.includes('<!-- <script src="js/demo-data.js">');
    const hasCommented   = data.includes('<!-- <script src="js/demo-data.js">') || data.includes('<!--') && data.includes('demo-data.js');
    const demoLineRaw    = data.split('\n').find(l => l.includes('demo-data.js')) || '(not found)';
    console.log('Linea demo-data.js en index.html servido:');
    console.log(' ', demoLineRaw.trim());
    console.log('demo-data.js ACTIVO (sin comentar):', hasActiveDemo);
    console.log('demo-data.js comentado:', hasCommented);
  });
}).on('error', e => console.error('Error conectando al servidor:', e.message));
