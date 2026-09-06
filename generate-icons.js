/**
 * Genera los íconos PWA (192x192 y 512x512) usando Playwright.
 * Ejecutar con: node generate-icons.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const dir     = 'assets/icons';

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const size of [192, 512]) {
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
  .bg {
    width:${size}px; height:${size}px;
    background: linear-gradient(135deg, #003459 0%, #007EA7 100%);
    border-radius: ${Math.round(size * 0.22)}px;
    display:flex; align-items:center; justify-content:center;
  }
  svg { display:block; }
</style></head>
<body><div class="bg">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <polygon points="${hexPoints}" fill="none" stroke="#00A8E8" stroke-width="${strokeW}" stroke-linejoin="round" opacity="0.9"/>
  <text x="${size/2}" y="${size*0.52}" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">CP</text>
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${Math.round(barH/2)}" fill="#00A8E8" opacity="0.75"/>
</svg>
</div></body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
    fs.writeFileSync(`${dir}/icon-${size}.png`, buf);
    console.log(`Creado: ${dir}/icon-${size}.png (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('Iconos PWA generados correctamente.');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
