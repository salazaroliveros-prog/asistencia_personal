/**
 * Auditoría UI/UX: desbordes reales, targets táctiles, consola limpia
 * y consistencia de layout en móvil / tablet / escritorio.
 *
 * Ignora:
 *  - sidebar off-canvas (drawer cerrado fuera del viewport)
 *  - scrollers horizontales intencionales (tablas)
 *  - .main-content que envuelve al topbar sticky (no es solape)
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

const PAGES = [
  'dashboard',
  'personal',
  'asistencia',
  'campo',
  'reportes',
  'ajustes',
] as const;

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

type OverflowHit = {
  page: string;
  viewport: string;
  reason: string;
  detail: string;
};

async function dismissSplash(page: Page) {
  // #app empieza con [hidden] hasta que termina el splash
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#app:not([hidden])', { state: 'visible', timeout: 20000 });
  await page.waitForSelector('#page-title', { state: 'visible', timeout: 15000 });
}

async function goHash(page: Page, hash: string) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page.waitForSelector(`#page-${hash}:not([hidden])`, { timeout: 10000 });
  await page.waitForTimeout(350);
}

async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const pageOverflow = {
      htmlScrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };

    const isOffCanvasNav = (el: HTMLElement) => {
      if (el.closest('#sidebar, .sidebar')) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return true;
        // Drawer cerrado: fuera de pantalla a la izquierda / translateX negativo
        const sr = sidebar.getBoundingClientRect();
        if (sr.right <= 0 || sidebar.classList.contains('closed') || !document.body.classList.contains('sidebar-open')) {
          // En desktop el sidebar está en flujo; solo filtrar si está fuera
          if (window.innerWidth < 1024 && sr.right <= 1) return true;
        }
      }
      return false;
    };

    const offenders: Array<{ tag: string; id: string; cls: string; left: number; right: number }> = [];
    const nodes = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    for (const el of nodes) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
      if (el.id === 'splash-screen' || el.closest('#splash-screen')) continue;
      if (el.id === 'toast-container' || el.closest('#toast-container, .toast')) continue;
      if (isOffCanvasNav(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      // Solo contenido que se sale por la DERECHA (desborde real).
      // left < 0 en un drawer cerrado ya se filtró arriba.
      if (rect.right > window.innerWidth + 2) {
        let parent: HTMLElement | null = el.parentElement;
        let inScrollTrap = false;
        while (parent) {
          const ps = getComputedStyle(parent);
          if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') {
            inScrollTrap = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (inScrollTrap) continue;

        offenders.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
        if (offenders.length >= 10) break;
      }
    }

    return { pageOverflow, offenders };
  });
}

test.describe('Auditoría UI/UX — layout y consistencia', () => {
  test('sin desbordes horizontales en móvil/tablet/escritorio (todas las secciones)', async ({ page }) => {
    test.setTimeout(180000);
    const failures: OverflowHit[] = [];
    const consoleErrors: string[] = [];

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (/favicon|net::ERR_|Download the React/i.test(text)) return;
        consoleErrors.push(text.slice(0, 240));
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dismissSplash(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      for (const hash of PAGES) {
        await goHash(page, hash);

        const overflow = await measureOverflow(page);
        if (overflow.pageOverflow.htmlScrollWidth > overflow.pageOverflow.clientWidth + 2) {
          failures.push({
            page: hash,
            viewport: vp.name,
            reason: 'document-scrollWidth',
            detail: `scrollWidth=${overflow.pageOverflow.htmlScrollWidth} clientWidth=${overflow.pageOverflow.clientWidth}`,
          });
        }
        if (overflow.offenders.length) {
          failures.push({
            page: hash,
            viewport: vp.name,
            reason: 'element-outside-viewport',
            detail: overflow.offenders
              .slice(0, 5)
              .map((o) => `${o.tag}#${o.id}.${o.cls}(right=${o.right})`)
              .join(' | '),
          });
        }
      }
    }

    expect(
      failures,
      `Hallazgos UI:\n${failures.map((f) => `[${f.viewport}/${f.page}] ${f.reason}: ${f.detail}`).join('\n')}`,
    ).toEqual([]);
    expect(consoleErrors, `Errores de consola:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('móvil: #menu-toggle abre el drawer y targets topbar ≥ 40px', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissSplash(page);

    const menu = page.locator('#menu-toggle');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);

    await menu.click();
    await page.waitForTimeout(400);
    await expect(page.locator('#sidebar')).toBeVisible();
    // El sidebar abierto debe entrar al viewport
    const sideBox = await page.locator('#sidebar').boundingBox();
    expect(sideBox).toBeTruthy();
    expect(sideBox!.x).toBeGreaterThanOrEqual(-2);

    // Cerrar
    const overlay = page.locator('#sidebar-overlay, .sidebar-overlay');
    if (await overlay.isVisible().catch(() => false)) {
      await overlay.click({ force: true });
    } else {
      await page.locator('#sidebar-toggle').click({ force: true });
    }
    await page.waitForTimeout(350);

    const theme = page.locator('#btn-theme-toggle-top, #theme-toggle-top, .topbar #theme-toggle').first();
    if (await theme.count()) {
      const tb = await theme.boundingBox();
      if (tb) {
        expect(tb.width).toBeGreaterThanOrEqual(40);
        expect(tb.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('field-scanner: sin desborde horizontal en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/field-scanner.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const metrics = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(metrics.sw).toBeLessThanOrEqual(metrics.cw + 2);
  });

  test('desktop: sin hamburguesa visible ni overlay espurio', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissSplash(page);

    const menu = page.locator('#menu-toggle');
    await expect(menu).toBeHidden();
    await expect(page.locator('.sidebar-overlay.open, #sidebar-overlay.active')).toHaveCount(0);
  });

  test('navegación SPA: cada sección activa su page-* y actualiza #page-title', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissSplash(page);

    const titles: Record<string, RegExp> = {
      dashboard: /dashboard/i,
      personal: /personal/i,
      asistencia: /asistencia|marcaci/i,
      campo: /campo/i,
      reportes: /reporte/i,
      ajustes: /ajuste|config/i,
    };

    for (const [hash, re] of Object.entries(titles)) {
      await goHash(page, hash);
      const section = page.locator(`#page-${hash}`);
      await expect(section).toBeVisible();
      await expect(section).not.toHaveAttribute('hidden', '');
      const title = page.locator('#page-title');
      await expect(title).toBeVisible();
      await expect(title).toHaveText(re);
    }
  });

  test('móvil: etiquetas KPI y fecha del topbar no quedan truncadas ilegibles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#dashboard', { waitUntil: 'domcontentloaded' });
    await dismissSplash(page);
    await goHash(page, 'dashboard');

    const dateText = (await page.locator('#current-date-display').textContent()) || '';
    expect(dateText.length).toBeGreaterThan(6);
    expect(dateText).not.toMatch(/\.\.\.$/);

    const labels = page.locator('.kpi-label');
    await expect(labels).toHaveCount(4);
    const texts = await labels.allTextContents();
    for (const t of texts) {
      expect(t.trim().length).toBeGreaterThan(3);
      expect(t).not.toMatch(/\.\.\.$/);
    }

    // Ningún label debe estar visualmente ellipsizado (scrollWidth ≈ clientWidth)
    const truncated = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.kpi-label')).filter((el) => {
        const h = el as HTMLElement;
        return h.scrollWidth > h.clientWidth + 1;
      }).map((el) => el.textContent?.trim() || '');
    });
    expect(truncated, `KPI truncados: ${truncated.join(', ')}`).toEqual([]);
  });
});
