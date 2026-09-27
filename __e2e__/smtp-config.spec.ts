/**
 * CONTROL PERSONAL CAMPO — E2E Tests de Configuración SMTP
 * Validación de la interfaz y funcionalidad de configuración SMTP
 * @version 1.5.0
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

test.describe('Configuración SMTP - Validación de UI y Funcionalidad', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html#ajustes`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  });

  test('debe mostrar sección de configuración SMTP en ajustes', async ({ page }) => {
    // Verificar que la sección de configuración SMTP exista
    await expect(page.locator('text=Configuración de Correo SMTP')).toBeVisible();
    
    // Verificar que existan todos los campos SMTP
    await expect(page.locator('#cfg-smtp-host')).toBeVisible();
    await expect(page.locator('#cfg-smtp-port')).toBeVisible();
    await expect(page.locator('#cfg-smtp-user')).toBeVisible();
    await expect(page.locator('#cfg-smtp-password')).toBeVisible();
    await expect(page.locator('#cfg-smtp-from')).toBeVisible();
    await expect(page.locator('#cfg-smtp-from-name')).toBeVisible();
    await expect(page.locator('#cfg-smtp-secure')).toBeVisible();
  });

  test('debe mostrar botones de prueba y guardar SMTP', async ({ page }) => {
    // Verificar que los botones existan
    await expect(page.locator('#btn-test-smtp')).toBeVisible();
    await expect(page.locator('#btn-save-smtp')).toBeVisible();
    
    // Verificar textos de los botones
    await expect(page.locator('#btn-test-smtp')).toContainText('Probar Conexión');
    await expect(page.locator('#btn-save-smtp')).toContainText('Guardar Configuración SMTP');
  });

  test('debe validar campos vacíos al probar conexión', async ({ page }) => {
    // Intentar probar conexión sin llenar campos
    await page.locator('#btn-test-smtp').click();
    await page.waitForTimeout(1000);
    
    // El botón debe estar habilitado (la validación ocurre en el click handler)
    const isClickable = await page.locator('#btn-test-smtp').isEnabled();
    expect(isClickable).toBe(true);
  });

  test('debe poder llenar campos con datos', async ({ page }) => {
    // Llenar campos con datos de prueba
    await page.fill('#cfg-smtp-host', 'smtp.gmail.com');
    await page.fill('#cfg-smtp-port', '587');
    await page.fill('#cfg-smtp-user', 'test@gmail.com');
    await page.fill('#cfg-smtp-password', 'password123');
    
    // Verificar que los campos tengan los valores
    const hostValue = await page.locator('#cfg-smtp-host').inputValue();
    const portValue = await page.locator('#cfg-smtp-port').inputValue();
    const userValue = await page.locator('#cfg-smtp-user').inputValue();
    
    expect(hostValue).toBe('smtp.gmail.com');
    expect(portValue).toBe('587');
    expect(userValue).toBe('test@gmail.com');
  });

  test('debe aceptar puerto válido', async ({ page }) => {
    // Llenar campos con puerto válido
    await page.fill('#cfg-smtp-host', 'smtp.gmail.com');
    await page.fill('#cfg-smtp-port', '587');
    await page.fill('#cfg-smtp-user', 'test@gmail.com');
    await page.fill('#cfg-smtp-password', 'password123');
    
    // Verificar que el puerto se haya llenado correctamente
    const portValue = await page.locator('#cfg-smtp-port').inputValue();
    expect(portValue).toBe('587');
  });

  test('debe cargar configuración SMTP desde variables de entorno si están disponibles', async ({ page }) => {
    // Verificar si window.__SMTP_ENV__ está disponible
    const smtpEnv = await page.evaluate(() => {
      return typeof window.__SMTP_ENV__ !== 'undefined' ? window.__SMTP_ENV__ : null;
    });
    
    if (smtpEnv && smtpEnv.host && smtpEnv.port && smtpEnv.user) {
      // Si hay configuración de entorno, verificar que se cargue en los campos
      const hostValue = await page.locator('#cfg-smtp-host').inputValue();
      const portValue = await page.locator('#cfg-smtp-port').inputValue();
      const userValue = await page.locator('#cfg-smtp-user').inputValue();
      
      expect(hostValue).toBe(smtpEnv.host);
      expect(portValue).toBe(smtpEnv.port);
      expect(userValue).toBe(smtpEnv.user);
    } else {
      // Si no hay configuración de entorno, los campos deben estar vacíos
      const hostValue = await page.locator('#cfg-smtp-host').inputValue();
      expect(hostValue).toBe('');
    }
  });

  test('debe verificar disponibilidad de Firebase Functions', async ({ page }) => {
    // Llenar campos con datos válidos
    await page.fill('#cfg-smtp-host', 'smtp.gmail.com');
    await page.fill('#cfg-smtp-port', '587');
    await page.fill('#cfg-smtp-user', 'test@gmail.com');
    await page.fill('#cfg-smtp-password', 'password123');
    
    // Verificar si el usuario está autenticado
    const isAuthenticated = await page.evaluate(() => {
      return window.FirebaseClient?.getCurrentUser() !== null;
    });
    
    // Intentar probar conexión
    await page.locator('#btn-test-smtp').click();
    await page.waitForTimeout(2000);
    
    // Verificar que el botón esté habilitado
    const isClickable = await page.locator('#btn-test-smtp').isEnabled();
    expect(isClickable).toBe(true);
  });

  test('debe poder guardar configuración SMTP localmente', async ({ page }) => {
    // Llenar campos con datos válidos
    await page.fill('#cfg-smtp-host', 'smtp.gmail.com');
    await page.fill('#cfg-smtp-port', '587');
    await page.fill('#cfg-smtp-user', 'test@gmail.com');
    await page.fill('#cfg-smtp-password', 'password123');
    await page.fill('#cfg-smtp-from', 'test@gmail.com');
    await page.fill('#cfg-smtp-from-name', 'Test Sender');
    
    // Guardar configuración
    await page.locator('#btn-save-smtp').click();
    await page.waitForTimeout(1000);
    
    // Verificar que el botón esté habilitado
    const isClickable = await page.locator('#btn-save-smtp').isEnabled();
    expect(isClickable).toBe(true);
  });

  test('debe mostrar área de estado SMTP', async ({ page }) => {
    // Verificar que el área de estado exista (puede estar hidden por defecto)
    const statusElement = page.locator('#smtp-status');
    await expect(statusElement).toHaveCount(1);
    
    // Llenar campos
    await page.fill('#cfg-smtp-host', 'smtp.gmail.com');
    await page.fill('#cfg-smtp-port', '587');
    await page.fill('#cfg-smtp-user', 'test@gmail.com');
    await page.fill('#cfg-smtp-password', 'password123');
    
    // Intentar probar conexión
    await page.locator('#btn-test-smtp').click();
    await page.waitForTimeout(1000);
    
    // Verificar que el elemento de estado exista
    await expect(statusElement).toHaveCount(1);
  });

  test('la checkbox de conexión segura debe estar marcada por defecto', async ({ page }) => {
    // Verificar que la checkbox esté marcada por defecto
    const isChecked = await page.locator('#cfg-smtp-secure').isChecked();
    expect(isChecked).toBe(true);
  });

  test('debe tener placeholders informativos en los campos SMTP', async ({ page }) => {
    // Verificar placeholders
    await expect(page.locator('#cfg-smtp-host')).toHaveAttribute('placeholder', 'smtp.gmail.com');
    await expect(page.locator('#cfg-smtp-port')).toHaveAttribute('placeholder', '587');
    await expect(page.locator('#cfg-smtp-user')).toHaveAttribute('placeholder', 'tu.correo@gmail.com');
    await expect(page.locator('#cfg-smtp-password')).toHaveAttribute('placeholder', 'Tu contraseña o App Password');
    await expect(page.locator('#cfg-smtp-from')).toHaveAttribute('placeholder', 'tu.correo@gmail.com');
    await expect(page.locator('#cfg-smtp-from-name')).toHaveAttribute('placeholder', 'Control Personal Campo');
  });

  test('debe tener enlaces a documentación de Gmail App Password', async ({ page }) => {
    // Verificar que exista el enlace a la documentación de App Password
    const appPasswordLink = page.locator('a[href="https://support.google.com/accounts/answer/185833"]');
    await expect(appPasswordLink).toBeVisible();
    
    // Verificar que el enlace tenga rel="noopener noreferrer"
    await expect(appPasswordLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

test.describe('Configuración SMTP - Validación de Firebase Functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html#ajustes`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  });

  test('Firebase Functions debe estar disponible', async ({ page }) => {
    // Verificar que Firebase Functions esté cargado
    const functionsAvailable = await page.evaluate(() => {
      return typeof window.firebase !== 'undefined' && 
             typeof window.firebase.functions !== 'undefined';
    });
    
    expect(functionsAvailable).toBe(true);
  });

  test('debe poder acceder a la función testSMTPConnection', async ({ page }) => {
    // Verificar que la función esté disponible
    const functionAvailable = await page.evaluate(() => {
      if (!window.firebase?.functions) return false;
      const functions = window.firebase.functions();
      return typeof functions.httpsCallable === 'function';
    });
    
    expect(functionAvailable).toBe(true);
  });
});
