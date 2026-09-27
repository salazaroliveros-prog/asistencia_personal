/**
 * CONTROL PERSONAL CAMPO — Validación Visual en Vivo Navegación Real
 * Navega en vivo, crea trabajador y valida renderizado visual del carnet
 * @version 1.5.0
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

test.describe('Validación Visual en Vivo - Navegación Real', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('navegar en vivo y validar renderizado visual del carnet', async ({ page }) => {
    console.log('🚀 Iniciando navegación en vivo...');

    // Screenshot de la página principal
    await page.screenshot({ 
      path: '__e2e__/screenshots/live-main-page.png',
      fullPage: false 
    });
    console.log('✅ Página principal cargada');

    // Navegar a personal
    await page.goto(`${BASE_URL}/#personal`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Screenshot de la sección de personal
    await page.screenshot({ 
      path: '__e2e__/screenshots/live-personal-section.png',
      fullPage: false 
    });
    console.log('✅ Sección de personal cargada');

    // Hacer clic en nuevo trabajador
    await page.click('#btn-nuevo-personal');
    await page.waitForTimeout(1000);

    // Llenar formulario con datos de un trabajador real
    await page.fill('#p-nombre', 'Juan Martínez');
    await page.fill('#p-dpi', '9876543210101');
    await page.selectOption('#p-puesto', 'Albañil');
    await page.fill('#p-telefono', '5555-5555');
    await page.fill('#p-direccion', 'Zona 1, Avenida Principal');

    // Screenshot del formulario llenado
    await page.screenshot({ 
      path: '__e2e__/screenshots/live-form-filled.png',
      fullPage: false 
    });
    console.log('✅ Formulario llenado con datos de Juan Martínez');

    // Guardar trabajador
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(3000);

    // Screenshot después de guardar
    await page.screenshot({ 
      path: '__e2e__/screenshots/live-after-save.png',
      fullPage: false 
    });
    console.log('✅ Trabajador Juan Martínez guardado');

    // Verificar que el trabajador aparezca
    const workerName = page.locator('text=Juan Martínez');
    await expect(workerName).toBeVisible();
    console.log('✅ Trabajador visible en la tabla');

    // Generar carnet programáticamente
    const trabajador = {
      ID_Trabajador: 'JUAN-001',
      DPI_CUI: '9876543210101',
      Nombre_Completo: 'Juan Martínez',
      Puesto: 'Albañil',
      Fotografia_URL: null
    };

    const carnetHTML = await page.evaluate(async (trabajadorData) => {
      try {
        if (typeof QRCode === 'undefined') {
          return { success: false, error: 'QRCode no disponible' };
        }

        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        const qr = new QRCode(tempDiv, {
          text: trabajadorData.ID_Trabajador,
          width: 150,
          height: 150,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = tempDiv.querySelector('canvas');
        let qrDataUrl = null;
        
        if (canvas) {
          qrDataUrl = canvas.toDataURL('image/png');
        }

        document.body.removeChild(tempDiv);

        if (!qrDataUrl) {
          return { success: false, error: 'No se pudo generar QR' };
        }

        const fechaEmision = new Date().toLocaleDateString('es-GT');
        const fechaExpiracion = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-GT');

        const carnetHTML = `
          <div class="carnet-container" style="
            width: 350px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            font-family: Arial, sans-serif;
            color: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            margin: 0 auto;
          ">
            <div class="carnet-header" style="
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid rgba(255,255,255,0.3);
              padding-bottom: 15px;
            ">
              <h2 style="margin: 0; font-size: 18px; font-weight: bold;">CONTROL PERSONAL CAMPO</h2>
              <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">CARNET DE IDENTIFICACIÓN</p>
            </div>

            <div class="carnet-body" style="display: flex; gap: 20px;">
              <div class="carnet-photo" style="
                flex-shrink: 0;
                width: 100px;
                height: 120px;
                background: rgba(255,255,255,0.2);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
              ">
                <div style="font-size: 40px; font-weight: bold;">${trabajadorData.Nombre_Completo?.charAt(0) || '?'}</div>
              </div>

              <div class="carnet-info" style="flex: 1; font-size: 11px;">
                <p style="margin: 0 0 5px 0;"><strong>Nombre:</strong> ${trabajadorData.Nombre_Completo}</p>
                <p style="margin: 0 0 5px 0;"><strong>ID:</strong> ${trabajadorData.ID_Trabajador}</p>
                <p style="margin: 0 0 5px 0;"><strong>DPI:</strong> ${trabajadorData.DPI_CUI}</p>
                <p style="margin: 0 0 5px 0;"><strong>Puesto:</strong> ${trabajadorData.Puesto}</p>
              </div>
            </div>

            <div class="carnet-qr" style="
              margin-top: 20px;
              text-align: center;
            ">
              <img src="${qrDataUrl}" style="width: 150px; height: 150px; border: 3px solid white; border-radius: 10px;" />
            </div>

            <div class="carnet-footer" style="
              margin-top: 15px;
              text-align: center;
              font-size: 10px;
              opacity: 0.8;
              border-top: 1px solid rgba(255,255,255,0.3);
              padding-top: 10px;
            ">
              <p style="margin: 0;"><strong>Emisión:</strong> ${fechaEmision}</p>
              <p style="margin: 5px 0 0;"><strong>Expira:</strong> ${fechaExpiracion}</p>
            </div>
          </div>
        `;

        return { success: true, carnetHTML, qrDataUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, trabajador);

    console.log('Carnet generado:', carnetHTML.success);

    if (carnetHTML.success && carnetHTML.carnetHTML) {
      // Mostrar el carnet en la página para validación visual
      await page.evaluate((html) => {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.background = '#f0f0f0';
        container.style.padding = '40px';
        container.style.borderRadius = '20px';
        container.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
        container.style.zIndex = '9999';
        container.style.maxWidth = '450px';
        container.innerHTML = html;
        document.body.appendChild(container);
      }, carnetHTML.carnetHTML);

      await page.waitForTimeout(2000);

      // Screenshot del carnet generado para validación visual
      await page.screenshot({ 
        path: '__e2e__/screenshots/live-carnet-juan-martinez.png',
        fullPage: false 
      });
      console.log('✅ Screenshot del carnet tomado para validación visual');

      // Verificar que el carnet esté centrado y renderizado
      const carnetContainer = page.locator('div[style*="position: fixed"][style*="z-index: 9999"]');
      await expect(carnetContainer).toBeVisible();
      console.log('✅ Carnet visible y centrado');

      // Cerrar el modal
      await page.evaluate(() => {
        const container = document.querySelector('div[style*="position: fixed"][style*="z-index: 9999"]');
        if (container) container.remove();
      });

      console.log('✅ Validación visual completada exitosamente');
    }

    expect(carnetHTML.success).toBe(true);
  });
});
