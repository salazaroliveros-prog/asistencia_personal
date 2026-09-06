const https = require('https');

const BASE_URL = 'https://control-asistencia-personal-proyectoswm.vercel.app';

https.get(BASE_URL, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== VERIFICACIÓN DEPLOYMENT VERCEL ===');
    console.log('URL:', BASE_URL);
    console.log('Status:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    
    const hasActiveDemo  = data.includes('src="js/demo-data.js"') && !data.includes('<!-- <script src="js/demo-data.js">');
    const hasCommented   = data.includes('<!-- <script src="js/demo-data.js">') || (data.includes('<!--') && data.includes('demo-data.js'));
    const demoLineRaw    = data.split('\n').find(l => l.includes('demo-data.js')) || '(not found)';
    
    console.log('\n=== ANÁLISIS demo-data.js ===');
    console.log('Linea demo-data.js en index.html servido:');
    console.log(' ', demoLineRaw.trim());
    console.log('demo-data.js ACTIVO (sin comentar):', hasActiveDemo);
    console.log('demo-data.js comentado:', hasCommented);
    
    // Verificar scripts GPS
    const hasGPS = data.includes('js/utils/gps.js');
    const hasMapViewer = data.includes('js/utils/map-viewer.js');
    const hasLeaflet = data.includes('leaflet');
    
    console.log('\n=== VERIFICACIÓN SISTEMA GPS ===');
    console.log('GPS utility (js/utils/gps.js):', hasGPS ? '✅ Presente' : '❌ Ausente');
    console.log('Map viewer (js/utils/map-viewer.js):', hasMapViewer ? '✅ Presente' : '❌ Ausente');
    console.log('Leaflet library:', hasLeaflet ? '✅ Presente' : '❌ Ausente');
    
    // Verificar IDs críticos
    const criticalIds = [
      '#app', '#splash-screen', '#sidebar', '#toast-container',
      '#kpi-total', '#kpi-asistencia', '#qr-reader', '#modal-personal',
      '#modal-map', '#map-container', '#cfg-gps-habilitado', '#btn-view-map'
    ];
    
    console.log('\n=== VERIFICACIÓN IDs CRÍTICOS ===');
    criticalIds.forEach(id => {
      const hasId = data.includes(id);
      console.log(`${id}: ${hasId ? '✅' : '❌'}`);
    });
    
    console.log('\n=== RESULTADO FINAL ===');
    const allGood = hasGPS && hasMapViewer && hasLeaflet && criticalIds.every(id => data.includes(id));
    console.log(allGood ? '✅ SISTEMA FUNCIONAL' : '❌ PROBLEMAS DETECTADOS');
  });
}).on('error', e => {
  console.error('Error conectando a Vercel:', e.message);
  process.exit(1);
});