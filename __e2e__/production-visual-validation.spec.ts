/**
 * CONTROL PERSONAL CAMPO — E2E Tests de Validación Visual en Producción
 * Validación visual de QR e informes en https://controlasistenciaapp.vercel.app
 * @version 1.5.0
 */

import { test, expect } from '@playwright/test';

const PROD_URL = 'https://controlasistenciaapp.vercel.app';

test.describe('Validación Visual en Producción', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('cargar página principal en producción', async ({ page }) => {
    // Tomar screenshot de la página principal
    await page.screenshot({ 
      path: '__e2e__/screenshots/production-main-page.png',
      fullPage: false 
    });

    // Verificar que la página cargue
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('navegar a sección de personal y verificar renderizado', async ({ page }) => {
    // Navegar a personal usando URL hash
    await page.goto(`${PROD_URL}/#personal`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Tomar screenshot de la sección de personal
    await page.screenshot({ 
      path: '__e2e__/screenshots/production-personal-section.png',
      fullPage: false 
    });

    // Verificar que la sección de personal esté visible
    const personalSection = page.locator('#page-personal');
    await expect(personalSection).toBeVisible();
  });

  test('verificar que QRCode esté disponible en producción', async ({ page }) => {
    // Verificar que QRCode esté cargado
    const qrCodeAvailable = await page.evaluate(() => {
      return typeof window.QRCode !== 'undefined';
    });

    console.log('QRCode disponible en producción:', qrCodeAvailable);
    expect(qrCodeAvailable).toBe(true);
  });

  test('generar QR de prueba en producción', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Generar QR con datos mínimos
    const qrGenerated = await page.evaluate(async () => {
      try {
        if (typeof QRCode === 'undefined') {
          return { success: false, error: 'QRCode no disponible' };
        }

        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        const qr = new QRCode(tempDiv, {
          text: 'T1',
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

        return { success: !!qrDataUrl, qrDataUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('QR generado en producción:', qrGenerated);

    if (qrGenerated.success && qrGenerated.qrDataUrl) {
      // Mostrar el QR en la página para screenshot
      await page.evaluate((qrUrl) => {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.background = 'white';
        container.style.padding = '20px';
        container.style.borderRadius = '10px';
        container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
        container.style.zIndex = '9999';
        container.innerHTML = `
          <h3 style="margin: 0 0 10px 0; color: #333;">QR en Producción</h3>
          <img src="${qrUrl}" style="width: 150px; height: 150px;" />
          <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
            Código QR generado exitosamente<br>
            en producción
          </p>
          <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px;">Cerrar</button>
        `;
        document.body.appendChild(container);
      }, qrGenerated.qrDataUrl);

      await page.waitForTimeout(1000);

      // Tomar screenshot del QR generado
      await page.screenshot({ 
        path: '__e2e__/screenshots/production-qr-generated.png',
        fullPage: false 
      });

      // Cerrar el modal
      await page.evaluate(() => {
        const container = document.querySelector('div[style*="position: fixed"][style*="z-index: 9999"]');
        if (container) container.remove();
      });
    }

    expect(qrGenerated.success).toBe(true);
  });

  test('navegar a sección de reportes', async ({ page }) => {
    // Navegar a reportes usando URL hash
    await page.goto(`${PROD_URL}/#reportes`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Tomar screenshot de la sección de reportes
    await page.screenshot({ 
      path: '__e2e__/screenshots/production-reportes-section.png',
      fullPage: false 
    });

    // Verificar que la sección de reportes esté visible
    const reportsSection = page.locator('#page-reportes');
    await expect(reportsSection).toBeVisible();
  });

  test('verificar que Firebase esté configurado en producción', async ({ page }) => {
    // Verificar que Firebase esté configurado
    const firebaseConfigured = await page.evaluate(() => {
      return typeof window.firebase !== 'undefined' && 
             typeof window.firebase.apps !== 'undefined' &&
             window.firebase.apps.length > 0;
    });

    console.log('Firebase configurado en producción:', firebaseConfigured);
    expect(firebaseConfigured).toBe(true);
  });
});
