/**
 * VERIFICACIÓN DE CORRECCIONES — UI/UX móvil y consistencias visuales
 * Spec temporal para validar los cambios aplicados:
 *   · ausencia de desbordamiento horizontal en todas las páginas (390x844)
 *   · drawer lateral: abre/cierra y enlace externo
 *   · conmutador de tema claro/oscuro realmente aplicado
 *   · anchos de columna por tabla (personal 8 col. vs marcaciones 9 col.)
 *   · áreas táctiles mínimas y modales tipo hoja inferior
 *   · escritorio: sin overlay espurio ni botón hamburguesa
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';
const PAGES = ['dashboard', 'personal', 'asistencia', 'campo', 'reportes', 'ajustes'];

// Helper: timeout flexible para navegación bajo Vite dev
const NAV_TIMEOUT = 20000;

async function boot(page: Page, hash = 'dashboard') {
  // Usar BASE_URL explícito en lugar de ruta relativa para evitar ambigüedades
  await page.goto(`${BASE_URL}/#${hash}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  // El splash se oculta cuando la app termina de inicializar; si en un entorno
  // lento tarda más, no se hace fallar la prueba por su culpa.
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});
  // Espera determinista a que la sección esté montada (sin sleeps fijos).
  await page.waitForSelector(`#page-${hash}`, { timeout: 10000 }).catch(() => {});
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1;
  });
}

test.describe('Móvil 390x844', () => {
  test('ninguna página desborda horizontalmente', async ({ page }) => {
    // Se recorren 6 páginas: en entornos lentos cada carga puede tardar, por eso
    // la prueba pide un presupuesto de tiempo explícito.
    test.setTimeout(180000);
    for (const p of PAGES) {
      await boot(page, p);
      const overflow = await hasHorizontalOverflow(page);
      const offenders = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > window.innerWidth + 2 && el.offsetParent !== null) {
            out.push(`${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`);
          }
        });
        return out.slice(0, 5);
      });
      expect(overflow, `Overflow en #${p}: ${JSON.stringify(offenders)}`).toBe(false);
    }
  });

  test('el SDK compat de Firebase se sirve desde el propio origen', async ({ page }) => {
    // Guarda de regresión: Firebase se vendoriza en /vendor/firebase para no
    // depender de gstatic.com en el arranque (clave para el uso offline).
    const peticionesExternas: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.indexOf('gstatic.com/firebasejs') >= 0) peticionesExternas.push(u);
    });

    await boot(page);

    const sdk = await page.evaluate(() => ({
      firebase: typeof window.firebase,
      auth: typeof window.firebase?.auth,
      firestore: typeof window.firebase?.firestore,
      functions: typeof window.firebase?.functions,
      version: window.firebase?.SDK_VERSION || '',
    }));

    expect(sdk.firebase).toBe('object');
    expect(sdk.auth).toBe('function');
    expect(sdk.firestore).toBe('function');
    expect(sdk.functions).toBe('function');
    expect(sdk.version.startsWith('12.')).toBe(true);

    // Ninguna petición debe haber ido al CDN de Firebase
    expect(peticionesExternas).toEqual([]);
  });

  test('drawer lateral abre y el enlace externo lo cierra', async ({ page }) => {
    await boot(page);
    const menu = page.locator('#menu-toggle');
    await expect(menu).toBeVisible();

    await menu.click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await expect(menu).toHaveAttribute('aria-expanded', 'true');

    const width = await page.locator('#sidebar').evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(390);

    await page.locator('.nav-link-external').click();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
  });

  test('el conmutador de tema del topbar aplica el tema claro y sincroniza ambos botones', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);

    // En móvil el botón del sidebar queda tras el cajón lateral, así que el
    // acceso directo al tema debe estar en el topbar.
    const toggle = page.locator('#theme-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');

    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    expect(lightBg).not.toBe(darkBg);

    const textPrimary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim()
    );
    expect(textPrimary).toBe('#0f2b47');

    // Se comprueban los iconos del botón del topbar (en el DOM conviven dos
    // conmutadores: el del topbar y el del sidebar).
    const icons = await page.evaluate(() => {
      const sun = document.querySelector('#theme-toggle .theme-icon-sun') as HTMLElement;
      const moon = document.querySelector('#theme-toggle .theme-icon-moon') as HTMLElement;
      return {
        sun: sun ? getComputedStyle(sun).display : 'missing',
        moon: moon ? getComputedStyle(moon).display : 'missing',
      };
    });
    expect(icons.sun).toBe('none');
    expect(icons.moon).toBe('block');

    // Ambos conmutadores deben quedar sincronizados
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', 'Cambiar a tema oscuro');
    await expect(page.locator('#theme-toggle-sidebar')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-toggle-sidebar')).toHaveAttribute('aria-label', 'Cambiar a tema oscuro');

    const navColor = await page.locator('.nav-link').first().evaluate((el) => getComputedStyle(el).color);
    const g = Number((navColor.match(/\d+/g) || ['0', '0', '0'])[1]);
    expect(g, `color del nav-link en tema claro: ${navColor}`).toBeLessThan(150);

    await toggle.click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  });

  test('tabla de personal: 8 columnas visibles y consultables con scroll horizontal', async ({ page }) => {
    await boot(page, 'personal');
    const cols = await page.locator('#personal-table thead th').evaluateAll((els) =>
      els.map((el) => ({ text: el.textContent?.trim(), w: Math.round(el.getBoundingClientRect().width) }))
    );
    expect(cols).toHaveLength(8);
    cols.forEach((c, i) =>
      expect(c.w, `columna ${i + 1} (${c.text}) visible en móvil`).toBeGreaterThan(0)
    );
    expect(cols[2].w).toBeGreaterThan(140);

    // El ancho total excede el viewport → el contenedor permite desplazar en X
    // para consultar ID, DPI y Teléfono sin que se pierdan en pantalla.
    const wraps = await page.locator('#personal-table').evaluate((el) => {
      const wrap = el.closest('.table-responsive');
      return { scroll: wrap.scrollWidth, client: wrap.clientWidth, overflowX: getComputedStyle(wrap).overflowX };
    });
    expect(wraps.overflowX).toBe('auto');
    expect(wraps.scroll).toBeGreaterThan(wraps.client);
  });

  test('tabla de marcaciones: la columna Trabajador ya no queda en 44px', async ({ page }) => {
    await boot(page, 'asistencia');
    const cols = await page.locator('#asistencia-table thead th').evaluateAll((els) =>
      els.map((el) => ({ text: el.textContent?.trim(), w: Math.round(el.getBoundingClientRect().width) }))
    );
    expect(cols).toHaveLength(9);
    expect(cols[0].w).toBeGreaterThan(100);
    [1, 3, 5, 6, 7].forEach((i) =>
      expect(cols[i].w, `columna ${i + 1} (${cols[i].text})`).toBe(0)
    );
    expect(cols[2].w).toBeGreaterThan(40);
    expect(cols[4].w).toBeGreaterThan(40);
  });
});

test.describe('Móvil — targets y modales', () => {
  test('áreas táctiles de la barra superior ≥ 40px', async ({ page }) => {
    await boot(page);
    const small = await page.locator('.topbar-btn:visible, #menu-toggle:visible').evaluateAll((els) =>
      els
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { id: (el as HTMLElement).id, w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((x) => x.w < 40 || x.h < 40)
    );
    expect(small).toEqual([]);
  });

  test('los modales se comportan como hoja inferior', async ({ page }) => {
    await boot(page, 'personal');
    await page.locator('#btn-nuevo-personal').click();
    const modal = page.locator('#modal-personal .glass-modal');
    await expect(modal).toBeVisible();

    const box = await modal.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        bottom: Math.round(r.bottom),
        radius: getComputedStyle(el).borderTopLeftRadius,
      };
    });
    // Permitir 1px de margen para variaciones de renderizado
    expect(box.width).toBeGreaterThanOrEqual(379);
    expect(box.bottom).toBeGreaterThanOrEqual(800);
    expect(parseInt(box.radius, 10)).toBeGreaterThan(0);
  });
});

test.describe('Escritorio 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('sin overlay espurio ni botón hamburguesa', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#menu-toggle')).toBeHidden();
    const overlayDisplay = await page
      .locator('#sidebar-overlay')
      .evaluate((el) => getComputedStyle(el).display);
    expect(overlayDisplay).toBe('none');
    expect(await page.locator('#sidebar').isVisible()).toBe(true);
  });

  test('el banner PWA tiene elevación (--shadow-lg definido)', async ({ page }) => {
    await boot(page);
    const shadow = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--shadow-lg').trim()
    );
    expect(shadow.length).toBeGreaterThan(0);
    expect(shadow).toContain('rgba');
  });

  test('no hay desbordamiento horizontal', async ({ page }) => {
    await boot(page);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});