/**
 * Genera los íconos PWA (todos los tamaños) usando Playwright.
 * Iconos cuadrados sin fondo transparente, de alta calidad.
 * Ejecutar con: node generate-icons.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const dir     = 'public/pwa/icons';

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Todos los tamaños necesarios para PWA y diferentes plataformas
  const sizes = [72, 96, 128, 144, 192, 384, 512];

  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });

    const fontSize   = Math.round(size * 0.22);
    const barH       = Math.round(size * 0.04);
    const barY       = Math.round(size * 0.62);
    const barX       = Math.round(size * 0.28);
    const barW       = Math.round(size * 0.44);
    const strokeW    = Math.round(size * 0.035);
    const hexPoints  = [50,18, 78,32, 78,68, 50,82, 22,68, 22,32]
      .map((v, i) => v * size / 100).join(' ');

    const html = `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${size}px; height:${size}px; overflow:hidden; }
  svg { display:block; }
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#003459;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#007EA7;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>
  <polygon points="${hexPoints}" fill="none" stroke="#00A8E8" stroke-width="${strokeW}" stroke-linejoin="round" opacity="0.9"/>
  <text x="${size/2}" y="${size*0.52}" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">CP</text>
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${Math.round(barH/2)}" fill="#00A8E8" opacity="0.75"/>
</svg>
</body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
    fs.writeFileSync(`${dir}/icon-${size}.png`, buf);
    console.log(`Creado: ${dir}/icon-${size}.png (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('Iconos PWA generados correctamente (7 tamaños).');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
