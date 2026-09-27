/**
 * CONTROL PERSONAL CAMPO — E2E Tests de Informes y Exportación
 * Verificación completa de renderizado e impresión de informes
 * @version 1.5.0
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

test.describe('Informes - Exportación de Datos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html#reportes`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Crear datos de prueba
    await page.evaluate(() => {
      const personal = [
        {
          ID_Trabajador: 'T001',
          Nombre_Completo: 'Juan Pérez',
          DPI_CUI: '1234567890101',
          Puesto: 'Albañil',
          Estado: 'Activo',
        },
        {
          ID_Trabajador: 'T002',
          Nombre_Completo: 'María García',
          DPI_CUI: '9876543210123',
          Puesto: 'Maestro de Obra',
          Estado: 'Activo',
        },
      ];
      const asistencias = [
        {
          ID_Marcacion: 'M001',
          ID_Trabajador: 'T001',
          Nombre_Trabajador: 'Juan Pérez',
          Tipo_Marcacion: 'Entrada',
          Fecha: new Date().toISOString().split('T')[0],
          Hora_Real: '07:30:00',
          Estado_Marcacion: 'A Tiempo',
          Metodo_Registro: 'Manual_Fisica',
          Horas_Extra: 0,
        },
        {
          ID_Marcacion: 'M002',
          ID_Trabajador: 'T002',
          Nombre_Trabajador: 'María García',
          Tipo_Marcacion: 'Entrada',
          Fecha: new Date().toISOString().split('T')[0],
          Hora_Real: '08:15:00',
          Estado_Marcacion: 'Atraso',
          Metodo_Registro: 'Escaneo_QR',
          Horas_Extra: 0,
        },
      ];
      window.AppState.set('personal', personal);
      window.AppState.set('asistencias', asistencias);
      localStorage.setItem('cpc_personal_cache', JSON.stringify(personal));
      localStorage.setItem('cpc_attendance_cache', JSON.stringify(asistencias));
    });
    await page.waitForTimeout(1000);
  });

  test('debe generar vista previa de reporte diario', async ({ page }) => {
    // Seleccionar fecha de hoy
    const hoy = new Date().toISOString().split('T')[0];
    await page.fill('#reporte-fecha-diario', hoy);

    // Hacer clic en vista previa
    await page.locator('#btn-preview-diario').click();
    await page.waitForTimeout(2000);

    // Verificar que el modal de vista previa se abra
    await expect(page.locator('#reporte-preview-card')).toBeVisible({ timeout: 10000 });

    // Verificar que el contenido del reporte esté presente
    await expect(page.locator('.print-preview-sheet')).toBeVisible();
  });

  test('el reporte debe mostrar toda la información de trabajadores', async ({ page }) => {
    // Generar vista previa
    const hoy = new Date().toISOString().split('T')[0];
    await page.fill('#reporte-fecha-diario', hoy);
    await page.locator('#btn-preview-diario').click();
    await page.waitForTimeout(2000);

    // Verificar que los nombres estén presentes
    await expect(page.locator('.print-preview-sheet')).toContainText('Juan Pérez');
    await expect(page.locator('.print-preview-sheet')).toContainText('María García');
  });

  test('debe exportar CSV con datos completos', async ({ page }) => {
    // Configurar listener para descarga
    const downloadPromise = page.waitForEvent('download');

    // Generar CSV
    const hoy = new Date().toISOString().split('T')[0];
    await page.fill('#reporte-fecha-diario', hoy);
    await page.locator('#btn-csv-diario').click();
    await page.waitForTimeout(2000);

    // Esperar descarga
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/control-campo-diario.*\.csv/i);
  });

  test('debe exportar PDF con diseño profesional', async ({ page }) => {
    // Configurar listener para descarga
    const downloadPromise = page.waitForEvent('download');

    // Generar PDF
    const hoy = new Date().toISOString().split('T')[0];
    await page.fill('#reporte-fecha-diario', hoy);
    await page.locator('#btn-pdf-diario').click();
    await page.waitForTimeout(3000);

    // Esperar descarga
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/control-campo-diario.*\.pdf/i);
  });

  test('el reporte debe incluir información de fechas y horas', async ({ page }) => {
    // Generar vista previa
    const hoy = new Date().toISOString().split('T')[0];
    await page.fill('#reporte-fecha-diario', hoy);
    await page.locator('#btn-preview-diario').click();
    await page.waitForTimeout(2000);

    // Verificar información de tiempo
    await expect(page.locator('.print-preview-sheet')).toContainText('07:30');
    await expect(page.locator('.print-preview-sheet')).toContainText('08:15');
  });

  test('el reporte debe mostrar estados de marcación correctamente', async ({ page }) => {
    // Generar vista previa
    const hoy = new Date().toISOString().split('T')[0];
    await page.fill('#reporte-fecha-diario', hoy);
    await page.locator('#btn-preview-diario').click();
    await page.waitForTimeout(2000);

    // Verificar estados
    await expect(page.locator('.print-preview-sheet')).toContainText('A Tiempo');
    await expect(page.locator('.print-preview-sheet')).toContainText('Atraso');
  });
});
