const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3800', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('app') && !document.getElementById('app').hidden, { timeout: 6000 });
  await page.waitForTimeout(500);

  await page.click('[data-page="personal"]');
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const pages = document.querySelectorAll('.page');
    const result = { pages: {} };
    pages.forEach(p => {
      result.pages[p.dataset.page] = {
        hidden:  p.hidden,
        active:  p.classList.contains('active'),
        display: getComputedStyle(p).display,
      };
    });
    result.hash       = window.location.hash;
    result.appState   = AppState.get('currentPage');
    result.activeCount = document.querySelectorAll('.page.active').length;
    result.visibleCount = document.querySelectorAll('.page:not([hidden])').length;
    return result;
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => console.error(e.message));
