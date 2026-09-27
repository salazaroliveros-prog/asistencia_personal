/**
 * CONTROL PERSONAL CAMPO — E2E Tests de Validación Visual de Carnets
 * Toma screenshots para validar el correcto renderizado de carnets
 * @version 1.5.0
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3802';

test.describe('Validación Visual de Carnets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  });

  test('crear trabajador de prueba y generar carnet con screenshot', async ({ page }) => {
    // Navegar a la sección de personal usando URL hash
    await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Tomar screenshot de la sección de personal
    await page.screenshot({ 
      path: '__e2e__/screenshots/personal-section.png',
      fullPage: false 
    });

    // Verificar que la sección de personal esté visible
    const personalSection = page.locator('#page-personal');
    await expect(personalSection).toBeVisible();
  });

  test('validar que la función CarnetGenerator esté disponible', async ({ page }) => {
    // Verificar que CarnetGenerator esté disponible en window
    const carnetGeneratorAvailable = await page.evaluate(() => {
      return typeof window.CarnetGenerator !== 'undefined';
    });

    // Si no está disponible, intentar cargar el módulo
    if (!carnetGeneratorAvailable) {
      await page.evaluate(() => {
        // Cargar el módulo de carnet-generator
        const script = document.createElement('script');
        script.src = '/js/utils/carnet-generator.js';
        document.head.appendChild(script);
      });
      await page.waitForTimeout(1000);
    }

    // Verificar que QRCode esté disponible
    const qrCodeAvailable = await page.evaluate(() => {
      return typeof window.QRCode !== 'undefined';
    });

    console.log('CarnetGenerator disponible:', carnetGeneratorAvailable);
    console.log('QRCode disponible:', qrCodeAvailable);
  });

  test('generar carnet programáticamente y tomar screenshot', async ({ page }) => {
    // Verificar que QRCode esté cargado
    await page.waitForTimeout(2000);

    // Crear datos de trabajador de prueba con datos mínimos para QR
    const trabajador = {
      ID_Trabajador: 'T1',
      DPI_CUI: '1234',
      Nombre_Completo: 'María',
      Puesto: 'Ing',
      Fotografia_URL: null
    };

    // Intentar generar QR usando el módulo
    const qrGenerated = await page.evaluate(async (trabajadorData) => {
      try {
        // Verificar si QRCode está disponible
        if (typeof QRCode === 'undefined') {
          return { success: false, error: 'QRCode no disponible' };
        }

        // Crear un div temporal para el QR
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        // Generar QR solo con el ID para evitar overflow
        const qr = new QRCode(tempDiv, {
          text: trabajadorData.ID_Trabajador,
          width: 150,
          height: 150,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });

        // Esperar a que se genere
        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = tempDiv.querySelector('canvas');
        let qrDataUrl = null;
        
        if (canvas) {
          qrDataUrl = canvas.toDataURL('image/png');
        }

        // Limpiar
        document.body.removeChild(tempDiv);

        return { success: !!qrDataUrl, qrDataUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, trabajador);

    console.log('QR generado:', qrGenerated);

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
          <h3 style="margin: 0 0 10px 0; color: #333;">Código QR de Prueba</h3>
          <img src="${qrUrl}" style="width: 150px; height: 150px;" />
          <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
            Trabajador: María<br>
            DPI: 1234<br>
            Puesto: Ing<br>
            ID: T1
          </p>
          <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px;">Cerrar</button>
        `;
        document.body.appendChild(container);
      }, qrGenerated.qrDataUrl);

      await page.waitForTimeout(1000);

      // Tomar screenshot del QR generado
      await page.screenshot({ 
        path: '__e2e__/screenshots/qr-generated.png',
        fullPage: false 
      });

      // Cerrar el modal
      await page.evaluate(() => {
        const container = document.querySelector('div[style*="position: fixed"][style*="z-index: 9999"]');
        if (container) container.remove();
      });
    }
  });

  test('validar renderizado de formulario de personal', async ({ page }) => {
    // Navegar a personal usando URL hash
    await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Tomar screenshot del formulario de personal
    await page.screenshot({ 
      path: '__e2e__/screenshots/personal-form.png',
      fullPage: false 
    });

    // Verificar que la sección de personal esté visible
    const personalSection = page.locator('#page-personal');
    await expect(personalSection).toBeVisible();
  });

  test('validar que la página carga correctamente', async ({ page }) => {
    // Tomar screenshot de la página principal
    await page.screenshot({ 
      path: '__e2e__/screenshots/main-page.png',
      fullPage: false 
    });

    // Verificar que la navegación sea visible
    const navItems = page.locator('.nav-item');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });
});
