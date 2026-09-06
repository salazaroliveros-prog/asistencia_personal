const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: undefined,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.warn('[JS ERROR]', e.message));

  await page.goto('http://localhost:3800', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('app') && !document.getElementById('app').hidden, { timeout: 12000 });
  await page.waitForTimeout(2000);

  const diagnostico = await page.evaluate(() => {
    const lsKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      lsKeys.push({ k, v: localStorage.getItem(k)?.substring(0, 60) });
    }
    return {
      demoLoaded:   localStorage.getItem('cpc_demo_loaded'),
      gasUrl:       localStorage.getItem('cpc_gas_url') || '',
      personal:     (AppState.get('personal') || []).length,
      connected:    AppState.get('connected'),
      banner:       document.getElementById('demo-banner')?.hidden,
      bannerDisplay: getComputedStyle(document.getElementById('demo-banner')).display,
      connText:     document.getElementById('connection-text')?.textContent?.trim(),
      lsKeys,
      demoScriptLoaded: typeof window.__DEMO !== 'undefined',
    };
  });

  console.log('=== DIAGNÓSTICO ESTADO VACÍO ===');
  console.log('cpc_demo_loaded:', diagnostico.demoLoaded);
  console.log('gas_url:', diagnostico.gasUrl || '(vacío)');
  console.log('Personal en AppState:', diagnostico.personal);
  console.log('Conectado:', diagnostico.connected);
  console.log('Banner hidden attr:', diagnostico.banner);
  console.log('Banner computed display:', diagnostico.bannerDisplay);
  console.log('connection-text:', diagnostico.connText);
  console.log('window.__DEMO existe (demo-data.js cargó):', diagnostico.demoScriptLoaded);
  console.log('LocalStorage keys:', diagnostico.lsKeys);

  await page.screenshot({ path: '__tests__/screenshots/empty/diag-banner.png', clip: { x:0, y:0, width:1280, height:120 } });
  console.log('Screenshot del banner guardado');

  await browser.close();
})().catch(e => console.error('Error:', e.message));
