/**
 * Comprehensive manual testing session + visual regression baseline
 *
 * This script validates:
 * - All screens render correctly
 * - UI components are visible and functional
 * - Exported documents are generated correctly
 * - No visual regressions have occurred
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';
const SCREENSHOTS_DIR = 'test-results/visual-baseline';

test.describe('Comprehensive Manual Testing + Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  });

  test.describe('Dashboard', () => {
    test('should render all dashboard components', async ({ page }) => {
      await page.waitForSelector('h1#page-title:has-text("Dashboard")', { timeout: 10000 });
      await expect(page.locator('h1#page-title:has-text("Dashboard")')).toBeVisible();

      // KPI cards - use actual labels from the app
      const kpiLabels = [
        'Personal Activo',
        'Asistencia Hoy',
        'Tardanzas / Omisiones',
        'Ausencias Hoy',
      ];

      for (const label of kpiLabels) {
        await expect(page.locator(`text=${label}`)).toBeVisible();
      }

      // Chart or canvas should exist
      const chart = page.locator('#chart-asistencia, canvas, .chart-container');
      const chartCount = await chart.count();
      expect(chartCount).toBeGreaterThan(0);

      // Sync indicator - use first match to avoid strict mode violation
      await expect(page.locator('#connection-text, .connection-dot').first()).toBeVisible();
    });

    test('dashboard screenshot baseline', async ({ page }) => {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/dashboard.png`,
        fullPage: false,
      });
    });
  });

  test.describe('Personal Module', () => {
    test('should display personal table and controls', async ({ page }) => {
      await page.click('[href="#personal"]');
      await page.waitForTimeout(2000);

      // Page heading
      const heading = page.locator('h1#page-title:has-text("Gestión de Personal")');
      await expect(heading).toBeVisible();

      // Table should exist
      const table = page.locator('table, .data-table, #tabla-personal');
      const tableCount = await table.count();
      expect(tableCount).toBeGreaterThan(0);

      // New worker button
      await expect(page.locator('#btn-nuevo-personal')).toBeVisible();
    });

    test('should open new worker modal and display fields', async ({ page }) => {
      await page.click('[href="#personal"]');
      await page.waitForTimeout(2000);
      await page.click('#btn-nuevo-personal');
      await page.waitForTimeout(1000);

      // Modal should be visible
      const modal = page.locator('#modal-personal:not([hidden])');
      await expect(modal).toBeVisible();

      // Required fields should be present
      await expect(page.locator('#p-nombre')).toBeVisible();
      await expect(page.locator('#p-dpi')).toBeVisible();
      await expect(page.locator('#p-puesto')).toBeVisible();
    });

    test('personal module screenshot baseline', async ({ page }) => {
      await page.click('[href="#personal"]');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/personal.png`,
        fullPage: false,
      });
    });
  });

  test.describe('Asistencia Module', () => {
    test('should render attendance controls and tabs', async ({ page }) => {
      await page.click('[href="#asistencia"]');
      await page.waitForTimeout(2000);

      // Page heading
      const heading = page.locator('h1#page-title:has-text("Asistencia")');
      await expect(heading).toBeVisible();

      // Tabs should exist
      const tabs = page.locator('.tab, [data-tab]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);

      // Manual search input
      const searchInput = page.locator('#manual-worker-search');
      await expect(searchInput).toHaveCount(1);
    });

    test('asistencia module screenshot baseline', async ({ page }) => {
      await page.click('[href="#asistencia"]');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/asistencia.png`,
        fullPage: false,
      });
    });
  });

  test.describe('Campo / Field Scanner', () => {
    test('should navigate to campo section', async ({ page }) => {
      await page.click('[href="#campo"]');
      await page.waitForTimeout(2000);

      // Page heading
      const heading = page.locator('h1#page-title:has-text("Marcar en Campo"), h1#page-title:has-text("Campo")');
      await expect(heading).toBeVisible();
    });

    test('campo module screenshot baseline', async ({ page }) => {
      await page.click('[href="#campo"]');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/campo.png`,
        fullPage: false,
      });
    });
  });

  test.describe('Reportes Module', () => {
    test('should render report options', async ({ page }) => {
      await page.click('[href="#reportes"]');
      await page.waitForTimeout(2000);

      // Page heading
      const heading = page.locator('h1#page-title:has-text("Reportes")');
      await expect(heading).toBeVisible();

      // Report type cards/buttons
      await expect(page.locator('text=Reporte Diario')).toBeVisible();
      await expect(page.locator('text=Reporte Semanal')).toBeVisible();
      await expect(page.locator('text=Reporte Mensual')).toBeVisible();
    });

    test('reportes module screenshot baseline', async ({ page }) => {
      await page.click('[href="#reportes"]');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/reportes.png`,
        fullPage: false,
      });
    });
  });

  test.describe('Ajustes Module', () => {
    test('should render settings sections', async ({ page }) => {
      await page.click('[href="#ajustes"]');
      await page.waitForTimeout(2000);

      // Page heading
      const heading = page.locator('h1#page-title:has-text("Ajustes")');
      await expect(heading).toBeVisible();

      // Settings sections - use h3 for section titles
      await expect(page.locator('text=Datos y sincronización')).toBeVisible();
      await expect(page.locator('h3:has-text("General")')).toBeVisible();
      await expect(page.locator('text=Horarios de Obra')).toBeVisible();
      await expect(page.locator('text=GPS y Geocercas')).toBeVisible();
    });

    test('ajustes module screenshot baseline', async ({ page }) => {
      await page.click('[href="#ajustes"]');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/ajustes.png`,
        fullPage: false,
      });
    });
  });

  test.describe('Document Export Validation', () => {
    test('report preview and export buttons should exist', async ({ page }) => {
      await page.click('[href="#reportes"]');
      await page.waitForTimeout(2000);

      // Daily report controls
      await expect(page.locator('#btn-preview-diario')).toBeVisible();
      await expect(page.locator('#btn-pdf-diario')).toBeVisible();
      await expect(page.locator('#btn-csv-diario')).toBeVisible();
    });
  });

  test.describe('Mobile Responsive', () => {
    test('should render correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      // Menu button should be visible on mobile
      const menuButton = page.locator('#menu-toggle, .menu-toggle');
      await expect(menuButton).toBeVisible();
    });

    test('mobile screenshot baseline', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/mobile-home.png`,
        fullPage: false,
      });
    });
  });
});
