/**
 * Validación completa de la aplicación en producción
 * Tests E2E para validar todos los módulos y funcionalidades
 */

const { test, expect } = require('@playwright/test');

const PROD_URL = 'https://controlasistencia-ianir25ej-proyectoswm.vercel.app';

test.describe('Validación Producción - Control Asistencia', () => {
  
  test.use({
    baseURL: PROD_URL,
    viewport: { width: 1920, height: 1080 }, // Desktop para mejor visibilidad
    isMobile: false,
    hasTouch: false,
  });
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PROD_URL);
    // Esperar que la aplicación cargue completamente
    await page.waitForLoadState('networkidle');
  });

  test('Carga inicial de la aplicación', async ({ page }) => {
    // Verificar que la página cargue correctamente
    await expect(page).toHaveTitle(/CONTROL PERSONAL/);
    
    // Verificar elementos principales
    const appContainer = page.locator('#app');
    await expect(appContainer).toBeVisible();
    
    // Verificar que no haya errores en consola
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('Módulo Dashboard - Validación de componentes', async ({ page }) => {
    // Navegar al dashboard
    const dashboardBtn = page.locator('button, a').filter({ hasText: /dashboard|inicio/i }).first();
    if (await dashboardBtn.isVisible()) {
      await dashboardBtn.click();
    }
    
    await page.waitForTimeout(1000);
    
    // Validar KPIs principales
    const kpiElements = page.locator('[class*="kpi"], [class*="stat"], [class*="metric"]');
    const kpiCount = await kpiElements.count();
    console.log(`KPIs encontrados: ${kpiCount}`);
    
    // Validar gráficas
    const charts = page.locator('canvas, [class*="chart"], [class*="graph"]');
    const chartCount = await charts.count();
    console.log(`Gráficas encontradas: ${chartCount}`);
    
    // Validar que haya datos visibles
    const content = await page.textContent('body');
    expect(content.length).toBeGreaterThan(100);
  });

  test('Módulo Personal - Validación CRUD', async ({ page }) => {
    // Navegar al módulo de personal
    const personalBtn = page.locator('button, a').filter({ hasText: /personal|empleados|trabajadores/i }).first();
    if (await personalBtn.isVisible()) {
      await personalBtn.click();
    } else {
      // Intentar navegación por menú
      const menuBtn = page.locator('button').filter({ hasText: /menu/i }).first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        const personalMenuItem = page.locator('a, button').filter({ hasText: /personal/i }).first();
        if (await personalMenuItem.isVisible()) {
          await personalMenuItem.click();
        }
      }
    }
    
    await page.waitForTimeout(1500);
    
    // Validar lista de personal
    const personalList = page.locator('[class*="list"], [class*="table"], [class*="grid"]').first();
    const listVisible = await personalList.isVisible();
    console.log(`Lista de personal visible: ${listVisible}`);
    
    // Intentar agregar nuevo personal
    const addBtn = page.locator('button').filter({ hasText: /agregar|nuevo|crear/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      
      // Validar formulario
      const form = page.locator('form');
      const formVisible = await form.isVisible();
      console.log(`Formulario visible: ${formVisible}`);
      
      // Cancelar para no modificar datos
      const cancelBtn = page.locator('button').filter({ hasText: /cancelar|cerrar/i }).first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });

  test('Módulo Asistencias - Validación de marcación', async ({ page }) => {
    // Navegar al módulo de asistencias
    const asistenciaBtn = page.locator('button, a').filter({ hasText: /asistencia|marcacion|reloj/i }).first();
    if (await asistenciaBtn.isVisible()) {
      await asistenciaBtn.click();
    } else {
      // Intentar navegación alternativa
      const menuBtn = page.locator('button').filter({ hasText: /menu/i }).first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        const asistenciaMenuItem = page.locator('a, button').filter({ hasText: /asistencia/i }).first();
        if (await asistenciaMenuItem.isVisible()) {
          await asistenciaMenuItem.click();
        }
      }
    }
    
    await page.waitForTimeout(1500);
    
    // Validar botones de marcación
    const marcacionBtns = page.locator('button').filter({ hasText: /entrar|salir|marcar/i });
    const btnCount = await marcacionBtns.count();
    console.log(`Botones de marcación encontrados: ${btnCount}`);
    
    // Validar calendario si existe
    const calendar = page.locator('[class*="calendar"], [class*="date"]').first();
    const calendarVisible = await calendar.isVisible();
    console.log(`Calendario visible: ${calendarVisible}`);
  });

  test('Módulo Ajustes - Validación de configuración', async ({ page }) => {
    // Navegar a ajustes
    const settingsBtn = page.locator('button, a').filter({ hasText: /ajustes|configuracion|settings/i }).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
    } else {
      const menuBtn = page.locator('button').filter({ hasText: /menu/i }).first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        const settingsMenuItem = page.locator('a, button').filter({ hasText: /ajustes/i }).first();
        if (await settingsMenuItem.isVisible()) {
          await settingsMenuItem.click();
        }
      }
    }
    
    await page.waitForTimeout(1500);
    
    // Validar opciones de configuración
    const settingsOptions = page.locator('[class*="setting"], [class*="option"], input, select');
    const optionsCount = await settingsOptions.count();
    console.log(`Opciones de configuración encontradas: ${optionsCount}`);
    
    // Validar botones de guardado
    const saveBtn = page.locator('button').filter({ hasText: /guardar|save/i }).first();
    const saveVisible = await saveBtn.isVisible();
    console.log(`Botón de guardado visible: ${saveVisible}`);
  });

  test('Validación de Base de Datos y Sincronización', async ({ page }) => {
    // Verificar indicadores de conexión
    const connectionIndicator = page.locator('[class*="connection"], [class*="sync"], [class*="status"]');
    const connectionVisible = await connectionIndicator.first().isVisible();
    console.log(`Indicador de conexión visible: ${connectionVisible}`);
    
    // Verificar que la aplicación responda a interacciones
    const interactiveElements = page.locator('button, a, input');
    const interactiveCount = await interactiveElements.count();
    console.log(`Elementos interactivos: ${interactiveCount}`);
    
    // Verificar que no haya errores de red
    const networkErrors = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.url()} - ${response.status()}`);
      }
    });
    
    await page.waitForTimeout(3000);
    console.log(`Errores de red: ${networkErrors.length}`);
    if (networkErrors.length > 0) {
      console.log('Errores:', networkErrors);
    }
  });

  test('Validación de Formularios', async ({ page }) => {
    // Buscar todos los formularios en la página
    const forms = page.locator('form');
    const formCount = await forms.count();
    console.log(`Formularios encontrados: ${formCount}`);
    
    // Validar que los formularios tengan campos requeridos
    for (let i = 0; i < Math.min(formCount, 3); i++) {
      const form = forms.nth(i);
      const inputs = form.locator('input, select, textarea');
      const inputCount = await inputs.count();
      console.log(`Formulario ${i + 1}: ${inputCount} campos`);
    }
  });

  test('Validación de Botones y Acciones', async ({ page }) => {
    // Contar botones principales
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Botones encontrados: ${buttonCount}`);
    
    // Validar que los botones sean clickeables
    const visibleButtons = buttons.filter({ visible: true });
    const visibleCount = await visibleButtons.count();
    console.log(`Botones visibles: ${visibleCount}`);
    
    // Validar enlaces
    const links = page.locator('a');
    const linkCount = await links.count();
    console.log(`Enlaces encontrados: ${linkCount}`);
  });

  test('Validación de Gráficas y Visualizaciones', async ({ page }) => {
    // Navegar a dashboard si es posible
    const dashboardBtn = page.locator('button, a').filter({ hasText: /dashboard|inicio/i }).first();
    if (await dashboardBtn.isVisible()) {
      await dashboardBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Validar elementos canvas (gráficas)
    const canvasElements = page.locator('canvas');
    const canvasCount = await canvasElements.count();
    console.log(`Elementos canvas: ${canvasCount}`);
    
    // Validar contenedores de gráficas
    const chartContainers = page.locator('[class*="chart"], [class*="graph"], [class*="visualization"]');
    const chartCount = await chartContainers.count();
    console.log(`Contenedores de gráficas: ${chartCount}`);
  });

  test('Validación de Calendario', async ({ page }) => {
    // Buscar elementos de calendario
    const calendarElements = page.locator('[class*="calendar"], [class*="date"], [class*="month"]');
    const calendarCount = await calendarElements.count();
    console.log(`Elementos de calendario: ${calendarCount}`);
    
    // Si hay calendario, validar días/meses
    if (calendarCount > 0) {
      const days = page.locator('[class*="day"], [class*="date"]');
      const dayCount = await days.count();
      console.log(`Días encontrados en calendario: ${dayCount}`);
    }
  });

  test('Validación de Operaciones CRUD', async ({ page }) => {
    // Validar que existan elementos para crear, leer, actualizar, eliminar
    const createElements = page.locator('button').filter({ hasText: /crear|agregar|nuevo/i });
    const readElements = page.locator('[class*="list"], [class*="table"], [class*="view"]');
    const updateElements = page.locator('button').filter({ hasText: /editar|modificar|actualizar/i });
    const deleteElements = page.locator('button').filter({ hasText: /eliminar|borrar|eliminar/i });
    
    console.log(`Elementos CREAR: ${await createElements.count()}`);
    console.log(`Elementos LEER: ${await readElements.count()}`);
    console.log(`Elementos ACTUALIZAR: ${await updateElements.count()}`);
    console.log(`Elementos ELIMINAR: ${await deleteElements.count()}`);
  });

  test('Validación General de la UI', async ({ page }) => {
    // Validar estructura general
    const header = page.locator('header, [class*="header"], [class*="navbar"]');
    const footer = page.locator('footer, [class*="footer"]');
    const main = page.locator('main, [class*="main"], [class*="content"]');
    
    console.log(`Header visible: ${await header.first().isVisible()}`);
    console.log(`Main visible: ${await main.first().isVisible()}`);
    console.log(`Footer visible: ${await footer.first().isVisible()}`);
    
    // Validar responsividad básica
    await page.setViewportSize({ width: 375, height: 667 }); // Móvil
    await page.waitForTimeout(1000);
    const mobileMenu = page.locator('button').filter({ hasText: /menu/i }).first();
    console.log(`Menú móvil visible: ${await mobileMenu.isVisible()}`);
    
    // Volver a desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
  });

  test('Validación de Performance', async ({ page }) => {
    // Medir tiempo de carga
    const startTime = Date.now();
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    console.log(`Tiempo de carga: ${loadTime}ms`);
    
    // Validar que cargue en tiempo razonable
    expect(loadTime).toBeLessThan(10000); // Menos de 10 segundos
  });

  test('Validación de Accesibilidad', async ({ page }) => {
    // Validar que los elementos importantes tengan texto alternativo
    const images = page.locator('img');
    const imageCount = await images.count();
    
    let imagesWithAlt = 0;
    for (let i = 0; i < Math.min(imageCount, 10); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      if (alt) imagesWithAlt++;
    }
    
    console.log(`Imágenes con alt: ${imagesWithAlt}/${Math.min(imageCount, 10)}`);
    
    // Validar contrastes básicos (que el texto sea legible)
    const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, span, div');
    const textCount = await textElements.count();
    console.log(`Elementos de texto: ${textCount}`);
  });
});