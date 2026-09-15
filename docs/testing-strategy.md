# Testing Suite Strategy - Sistema de Control de Personal de Campo

## 1. Resumen Ejecutivo

Esta estrategia de testing define el enfoque integral para garantizar la calidad, seguridad y confiabilidad del Sistema de Control de Personal de Campo. Incluye pruebas unitarias, de integración, E2E, seguridad, rendimiento y accesibilidad, con especial énfasis en la validación de reglas de Firestore y comportamiento offline/online.

---

## 2. Pirámide de Pruebas

```
        /\
       /  \     E2E Tests (10%)
      /____\    - Flujos completos de usuario
     /      \   - Pruebas de UI con Playwright
    /________\  Integration Tests (20%)
   /          \ - Pruebas de API y módulos
  /____________\ Unit Tests (70%)
                 - Pruebas de funciones puras
                 - Pruebas de reglas de seguridad
                 - Pruebas de lógica de negocio
```

### 2.1 Distribución Recomendada

- **70% Unit Tests**: Lógica de negocio, validaciones, helpers
- **20% Integration Tests**: API endpoints, módulos, Firebase SDK
- **10% E2E Tests**: Flujos completos de usuario, UI/UX

---

## 3. Arquitectura de Pruebas

### 3.1 Estructura de Directorios

```
__tests__/
├── unit/                          # Pruebas unitarias
│   ├── firebase-client.test.js
│   ├── string-helpers.test.js
│   ├── photo-helpers.test.js
│   ├── camera-session.test.js
│   ├── personal.test.js
│   ├── attendance.test.js
│   ├── config.test.js
│   └── validators.test.js
│
├── integration/                   # Pruebas de integración
│   ├── api.test.js
│   ├── modules.test.js
│   ├── offline-queue.test.js
│   └── sync.test.js
│
├── e2e/                          # Pruebas E2E con Playwright
│   ├── mobile-ui.spec.ts
│   ├── desktop-ui.spec.ts
│   ├── offline-flow.spec.ts
│   └── security.spec.ts
│
├── rules/                        # Pruebas de reglas de Firestore
│   ├── rules.test.js
│   ├── rbac.test.js
│   └── validation.test.js
│
├── performance/                  # Pruebas de rendimiento
│   ├── load-test.js
│   └── stress-test.js
│
└── fixtures/                     # Datos de prueba
    ├── workers.json
    ├── attendances.json
    ├── config.json
    └── users.json
```

### 3.2 Configuración de Pruebas

#### Jest Config (`jest.config.js`)

```javascript
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
  },
};
```

#### Playwright Config (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__e2e__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3801',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      testMatch: '**/mobile-ui.spec.ts',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'desktop',
      testMatch: '**/desktop-ui.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3801',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 4. Pruebas Unitarias

### 4.1 Enfoque

Las pruebas unitarias se enfocan en funciones puras y lógica de negocio sin dependencias externas. Se utilizan mocks para Firebase, localStorage y APIs externas.

### 4.2 Estructura de una Prueba Unitaria

```javascript
// __tests__/unit/personal.test.js
describe('ModuloPersonal - Unit Tests', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada prueba
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('normalizeWorker', () => {
    test('debe normalizar payload de trabajador correctamente', () => {
      const payload = {
        id: 'TRAB-001',
        nombre: 'Juan Pérez',
        dpi: '1234567890123',
        puesto: 'Albañil',
      };
      
      const result = normalizeWorker(payload);
      
      expect(result.ID_Trabajador).toBe('TRAB-001');
      expect(result.Nombre_Completo).toBe('Juan Pérez');
      expect(result.DPI_CUI).toBe('1234567890123');
      expect(result.Puesto).toBe('Albañil');
      expect(result.Estado).toBe('Activo');
      expect(result.Fecha_Registro).toBeDefined();
    });

    test('debe preservar datos existentes en edición', () => {
      const previous = {
        ID_Trabajador: 'TRAB-001',
        Nombre_Completo: 'Juan Pérez',
        Fecha_Registro: '2024-01-01',
        Estado: 'Activo',
      };
      
      const payload = {
        id: 'TRAB-001',
        nombre: 'Juan Pérez Actualizado',
      };
      
      const result = normalizeWorker(payload, previous);
      
      expect(result.Nombre_Completo).toBe('Juan Pérez Actualizado');
      expect(result.Fecha_Registro).toBe('2024-01-01');
      expect(result.Estado).toBe('Activo');
    });
  });

  describe('Validaciones de datos', () => {
    test('debe rechazar DPI muy corto', () => {
      const payload = {
        id: 'TRAB-001',
        nombre: 'Test',
        dpi: '123', // Muy corto
        puesto: 'Test',
      };
      
      expect(() => normalizeWorker(payload)).toThrow();
    });

    test('debe rechazar nombre vacío', () => {
      const payload = {
        id: 'TRAB-001',
        nombre: '',
        dpi: '1234567890123',
        puesto: 'Test',
      };
      
      expect(() => normalizeWorker(payload)).toThrow();
    });
  });
});
```

### 4.3 Pruebas de Reglas de Firestore

```javascript
// __tests__/rules/rules.test.js
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

const projectId = 'test-project';
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: fs.readFileSync('firestore.rules', 'utf8'),
  },
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  let adminAuth, employeeAuth, managerAuth;

  beforeAll(async () => {
    adminAuth = testEnv.authenticatedContext('admin-user', {
      admin: true,
      email: 'admin@test.com',
    });
    employeeAuth = testEnv.authenticatedContext('employee-user', {
      employee: true,
      email: 'employee@test.com',
    });
    managerAuth = testEnv.authenticatedContext('manager-user', {
      manager: true,
      email: 'manager@test.com',
    });
  });

  describe('Personal Collection', () => {
    test('admin puede crear trabajador', async () => {
      const db = adminAuth.firestore();
      await assertSucceeds(
        db.collection('personal').doc('TRAB-001').set({
          ID_Trabajador: 'TRAB-001',
          Nombre_Completo: 'Test Worker',
          DPI_CUI: '1234567890123',
          Puesto: 'Test',
          Estado: 'Activo',
          Fecha_Registro: Date.now(),
        })
      );
    });

    test('employee no puede crear trabajador', async () => {
      const db = employeeAuth.firestore();
      await assertFails(
        db.collection('personal').doc('TRAB-002').set({
          ID_Trabajador: 'TRAB-002',
          Nombre_Completo: 'Test Worker 2',
          DPI_CUI: '1234567890123',
          Puesto: 'Test',
          Estado: 'Activo',
          Fecha_Registro: Date.now(),
        })
      );
    });

    test('employee puede leer cualquier trabajador', async () => {
      const db = employeeAuth.firestore();
      await assertSucceeds(db.collection('personal').doc('TRAB-001').get());
    });

    test('manager puede actualizar trabajador', async () => {
      const db = managerAuth.firestore();
      await assertSucceeds(
        db.collection('personal').doc('TRAB-001').update({
          Telefono: '+502 5555-1234',
        })
      );
    });
  });

  describe('Asistencias Collection', () => {
    test('admin puede crear asistencia', async () => {
      const db = adminAuth.firestore();
      await assertSucceeds(
        db.collection('asistencias').doc('MARC-001').set({
          ID_Marcacion: 'MARC-001',
          ID_Trabajador: 'TRAB-001',
          Nombre_Trabajador: 'Test Worker',
          Fecha: '2024-01-01',
          Tipo_Marcacion: 'Entrada',
          Hora_Real: '07:00',
          Estado_Marcacion: 'A Tiempo',
          Timestamp: Date.now(),
        })
      );
    });

    test('employee no puede crear asistencia', async () => {
      const db = employeeAuth.firestore();
      await assertFails(
        db.collection('asistencias').doc('MARC-002').set({
          ID_Marcacion: 'MARC-002',
          ID_Trabajador: 'TRAB-001',
          Nombre_Trabajador: 'Test Worker',
          Fecha: '2024-01-01',
          Tipo_Marcacion: 'Entrada',
          Hora_Real: '07:00',
          Estado_Marcacion: 'A Tiempo',
          Timestamp: Date.now(),
        })
      );
    });
  });

  describe('Validación de datos', () => {
    test('debe rechazar campos inválidos en personal', async () => {
      const db = adminAuth.firestore();
      await assertFails(
        db.collection('personal').doc('TRAB-INVALID').set({
          ID_Trabajador: 'TRAB-INVALID',
          Nombre_Completo: 'AB', // Muy corto
          DPI_CUI: '123', // Muy corto
          Puesto: 'Test',
          Estado: 'Invalid', // Estado inválido
          Fecha_Registro: Date.now(),
        })
      );
    });

    test('debe rechazar tipo de marcación inválido', async () => {
      const db = adminAuth.firestore();
      await assertFails(
        db.collection('asistencias').doc('MARC-INVALID').set({
          ID_Marcacion: 'MARC-INVALID',
          ID_Trabajador: 'TRAB-001',
          Nombre_Trabajador: 'Test',
          Fecha: '2024-01-01',
          Tipo_Marcacion: 'Invalid', // Inválido
          Hora_Real: '07:00',
          Estado_Marcacion: 'A Tiempo',
          Timestamp: Date.now(),
        })
      );
    });
  });
});
```

---

## 5. Pruebas de Integración

### 5.1 Enfoque

Las pruebas de integración validan la interacción entre módulos, APIs y servicios externos (Firebase, localStorage). Se utilizan emuladores de Firebase para pruebas realistas.

### 5.2 Estructura de Prueba de Integración

```javascript
// __tests__/integration/api.test.js
describe('API - Integration Tests', () => {
  let api;
  let mockFirebaseClient;

  beforeEach(() => {
    // Mock FirebaseClient
    mockFirebaseClient = {
      isReady: jest.fn(() => true),
      getConnectionState: jest.fn(() => 'connected'),
      checkHealth: jest.fn(() => Promise.resolve(true)),
      list: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    
    window.FirebaseClient = mockFirebaseClient;
    window.AppState = new AppState();
    window.LS_KEYS = {
      PERSONAL_CACHE: 'cpc_personal_cache',
      ATTENDANCE_CACHE: 'cpc_asistencias_cache',
      OFFLINE_QUEUE: 'cpc_offline_queue',
      LAST_SYNC: 'cpc_last_sync',
    };
    
    api = window.API;
    api.initialize();
  });

  describe('obtenerPersonal', () => {
    test('debe obtener personal desde Firestore cuando está conectado', async () => {
      const mockWorkers = [
        { ID_Trabajador: 'TRAB-001', Nombre_Completo: 'Test' },
      ];
      
      mockFirebaseClient.list.mockResolvedValue(mockWorkers);
      
      const result = await api.obtenerPersonal();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockWorkers);
      expect(mockFirebaseClient.list).toHaveBeenCalledWith('personal');
    });

    test('debe obtener personal desde cache cuando está offline', async () => {
      mockFirebaseClient.isReady.mockReturnValue(false);
      
      const cachedWorkers = [
        { ID_Trabajador: 'TRAB-001', Nombre_Completo: 'Test' },
      ];
      localStorage.setItem('cpc_personal_cache', JSON.stringify(cachedWorkers));
      
      const result = await api.obtenerPersonal();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedWorkers);
      expect(result.offline).toBe(true);
    });
  });

  describe('guardarTrabajador', () => {
    test('debe crear trabajador en Firestore cuando está conectado', async () => {
      mockFirebaseClient.save.mockResolvedValue({});
      
      const payload = {
        id: 'TRAB-001',
        nombre: 'Juan Pérez',
        dpi: '1234567890123',
        puesto: 'Albañil',
      };
      
      const result = await api.guardarTrabajador(payload);
      
      expect(result.success).toBe(true);
      expect(mockFirebaseClient.save).toHaveBeenCalledWith(
        'personal',
        'TRAB-001',
        expect.objectContaining({
          ID_Trabajador: 'TRAB-001',
          Nombre_Completo: 'Juan Pérez',
        }),
        false
      );
    });

    test('debe crear trabajador localmente cuando está offline', async () => {
      mockFirebaseClient.isReady.mockReturnValue(false);
      
      const payload = {
        id: 'TRAB-001',
        nombre: 'Juan Pérez',
        dpi: '1234567890123',
        puesto: 'Albañil',
      };
      
      const result = await api.guardarTrabajador(payload);
      
      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      
      const queue = JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]');
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('personal-create');
    });

    test('debe fallback a local cuando hay permission-denied', async () => {
      mockFirebaseClient.save.mockRejectedValue({
        code: 'permission-denied',
        message: 'Missing or insufficient permissions',
      });
      
      const payload = {
        id: 'TRAB-001',
        nombre: 'Juan Pérez',
        dpi: '1234567890123',
        puesto: 'Albañil',
      };
      
      const result = await api.guardarTrabajador(payload);
      
      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      
      const queue = JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]');
      expect(queue).toHaveLength(1);
    });
  });

  describe('registrarMarcacion', () => {
    test('debe crear marcación en Firestore', async () => {
      mockFirebaseClient.save.mockResolvedValue({});
      
      const payload = {
        idTrabajador: 'TRAB-001',
        nombreTrabajador: 'Juan Pérez',
        fecha: '2024-01-01',
        tipoMarcacion: 'Entrada',
        horaReal: '07:00',
      };
      
      const result = await api.registrarMarcacion(payload);
      
      expect(result.success).toBe(true);
      expect(result.data.ID_Marcacion).toBeDefined();
      expect(result.data.ID_Trabajador).toBe('TRAB-001');
      expect(result.horaReal).toBe('07:00');
      expect(result.estadoMarcacion).toBeDefined();
    });

    test('debe detectar duplicados cercanos', async () => {
      const existing = [{
        ID_Trabajador: 'TRAB-001',
        Fecha: '2024-01-01',
        Timestamp: Date.now() - 60000, // 1 minuto atrás
      }];
      localStorage.setItem('cpc_asistencias_cache', JSON.stringify(existing));
      
      const payload = {
        idTrabajador: 'TRAB-001',
        fecha: '2024-01-01',
        tipoMarcacion: 'Entrada',
      };
      
      const result = await api.registrarMarcacion(payload);
      
      expect(result.duplicate).toBe(true);
      expect(result.message).toContain('duplicada');
    });
  });
});
```

---

## 6. Pruebas E2E con Playwright

### 6.1 Configuración

```typescript
// __e2e__/setup/global-setup.ts
import { chromium } from 'playwright';

export default async () => {
  // Setup global antes de todas las pruebas
  console.log('Iniciando pruebas E2E...');
};

export async function teardown() {
  // Cleanup global después de todas las pruebas
  console.log('Pruebas E2E completadas');
};
```

### 6.2 Prueba de Flujo Offline

```typescript
// __e2e__/offline-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Offline Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('debe crear trabajador offline y sincronizar', async ({ page }) => {
    // 1. Simular modo offline
    await page.evaluate(() => {
      // Mock para simular offline
      window.API.ping = async () => ({ success: false, mode: 'local' });
    });

    // 2. Ir a Personal
    await page.click('[data-testid="nav-personal"]');
    await page.waitForTimeout(1000);

    // 3. Abrir modal de nuevo trabajador
    await page.click('#btn-nuevo-personal');
    await page.waitForTimeout(500);

    // 4. Llenar formulario
    await page.fill('#nombre', 'Test Offline');
    await page.fill('#dpi', '9999999999999');
    await page.fill('#puesto', 'Albañil');
    await page.fill('#jefe', 'Supervisor');
    await page.fill('#telefono', '+502 5555-0000');
    await page.fill('#whatsapp', '+502 5555-0000');
    await page.fill('#direccion', 'Test Address');

    // 5. Guardar
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(1000);

    // 6. Verificar que aparece en tabla
    await expect(page.locator('text=Test Offline')).toBeVisible();

    // 7. Verificar queue offline
    const queueLength = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]').length;
    });
    expect(queueLength).toBeGreaterThan(0);

    // 8. Simular reconexión
    await page.evaluate(() => {
      window.API.ping = async () => ({ success: true, mode: 'firestore' });
    });

    // 9. Esperar sincronización
    await page.waitForTimeout(5000);

    // 10. Verificar queue vacía
    const queueAfterSync = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]').length;
    });
    expect(queueAfterSync).toBe(0);
  });

  test('debe sincronizar al reconectar automáticamente', async ({ page }) => {
    // 1. Simular offline
    await page.evaluate(() => {
      window.API.ping = async () => ({ success: false, mode: 'local' });
    });

    // 2. Crear múltiples registros offline
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="nav-personal"]');
      await page.waitForTimeout(500);
      await page.click('#btn-nuevo-personal');
      await page.waitForTimeout(500);
      await page.fill('#nombre', `Worker ${i}`);
      await page.fill('#dpi', `123456789000${i}`);
      await page.fill('#puesto', 'Test');
      await page.click('#btn-guardar-personal');
      await page.waitForTimeout(1000);
    }

    // 3. Verificar 3 items en queue
    const queueBefore = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]').length;
    });
    expect(queueBefore).toBe(3);

    // 4. Simular reconexión
    await page.evaluate(() => {
      window.API.ping = async () => ({ success: true, mode: 'firestore' });
      
      // Disparar sync manualmente
      if (window.API.syncOfflineQueue) {
        window.API.syncOfflineQueue();
      }
    });

    // 5. Esperar sync
    await page.waitForTimeout(3000);

    // 6. Verificar queue vacía
    const queueAfter = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]').length;
    });
    expect(queueAfter).toBe(0);
  });
});
```

---

## 7. Pruebas de Accesibilidad

### 7.1 Configuración de Axe

```typescript
// __e2e__/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('homepage debe ser accesible', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('#btn-capturar-foto')
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('formulario de personal debe ser accesible', async ({ page }) => {
    await page.goto('/#personal');
    await page.click('#btn-nuevo-personal');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#modal-nuevo-personal')
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

---

## 8. Pruebas de Rendimiento

### 8.1 Lighthouse CI

```yaml
# .lighthouserc.yml
ci:
  collect:
    url:
      - http://localhost:3801/#personal
      - http://localhost:3801/#asistencia
      - http://localhost:3801/#dashboard
    numberOfRuns: 3
  assert:
    assertions:
      first-contentful-paint: ['error', { maxNumericValue: 2000 }]
      largest-contentful-paint: ['error', { maxNumericValue: 2500 }]
      interactive: ['error', { maxNumericValue: 3000 }]
      speed-index: ['error', { maxNumericValue: 3000 }]
      accessibility: ['error', { minScore: 0.9 }]
      best-practices: ['error', { minScore: 0.9 }]
      seo: ['error', { minScore: 0.9 }]
```

### 8.2 Pruebas de Carga

```javascript
// __tests__/performance/load-test.js
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  test('debe cargar lista de 1000 trabajadores en < 3s', async () => {
    const start = performance.now();
    
    // Simular carga de 1000 trabajadores
    const workers = Array.from({ length: 1000 }, (_, i) => ({
      ID_Trabajador: `TRAB-${i}`,
      Nombre_Completo: `Worker ${i}`,
      Puesto: 'Test',
      Estado: 'Activo',
    }));
    
    // Simular renderizado
    const renderStart = performance.now();
    workers.forEach(worker => {
      // Simular creación de elemento DOM
      document.createElement('tr');
    });
    const renderEnd = performance.now();
    
    const totalTime = renderEnd - start;
    expect(totalTime).toBeLessThan(3000);
  });

  test('debe filtrar 1000 trabajadores en < 500ms', async () => {
    const workers = Array.from({ length: 1000 }, (_, i) => ({
      ID_Trabajador: `TRAB-${i}`,
      Nombre_Completo: `Worker ${i}`,
      Puesto: i % 2 === 0 ? 'Albañil' : 'Maestro',
      Estado: 'Activo',
    }));
    
    const start = performance.now();
    
    // Simular filtrado
    const filtered = workers.filter(w => w.Puesto === 'Albañil');
    
    const end = performance.now();
    const filterTime = end - start;
    
    expect(filtered.length).toBe(500);
    expect(filterTime).toBeLessThan(500);
  });
});
```

---

## 9. CI/CD Pipeline

### 9.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --reporter=html
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: __e2e__/output/

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm install -g firebase-tools
      - run: firebase emulators:start --only firestore,auth &
      - run: sleep 10
      - run: npm run test:rules
      - run: firebase emulators:exec "npm run test:rules"

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
```

---

## 10. Monitoreo en Producción

### 10.1 Métricas Clave

- **Disponibilidad**: Uptime > 99.5%
- **Rendimiento**: Tiempo de carga < 3s
- **Errores**: Tasa de error < 0.1%
- **Sincronización**: Tiempo de sync < 30s
- **Uso de Storage**: < 10MB por dispositivo

### 10.2 Alertas

```javascript
// Configuración de alertas en producción
const ALERTAS = {
  syncFailureRate: {
    threshold: 0.05, // 5% de fallos
    action: 'alert',
  },
  offlineDuration: {
    threshold: 300000, // 5 minutos
    action: 'notify',
  },
  queueSize: {
    threshold: 100, // 100 items
    action: 'alert',
  },
  firestoreErrors: {
    threshold: 10, // 10 errores por minuto
    action: 'page',
  },
};
```

---

## 11. Checklist de Pruebas Pre-Deployment

### 11.1 Antes de Cada Release

- [ ] Todas las pruebas unitarias pasan (`npm run test:unit`)
- [ ] Todas las pruebas E2E pasan (`npx playwright test`)
- [ ] Pruebas de seguridad pasan (`npm run test:rules`)
- [ ] Lint sin errores (`npm run lint`)
- [ ] Typecheck sin errores (`npm run typecheck`)
- [ ] Build exitoso (`npm run build`)
- [ ] Cobertura de código > 80%
- [ ] Sin vulnerabilidades en dependencias (`npm audit`)
- [ ] Reglas de Firestore validadas
- [ ] Índices de Firestore creados
- [ ] Documentación actualizada

### 11.2 Antes de Deploy a Producción

- [ ] Pruebas en ambiente de staging exitosas
- [ ] Backup de base de datos realizado
- [ ] Rollback plan documentado
- [ ] Notificación a usuarios programada
- [ ] Monitoreo configurado
- [ ] Equipo de soporte notificado

---

## 12. Recursos y Referencias

### 12.1 Documentación Oficial

- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firestore Emulator](https://firebase.google.com/docs/emulator-suite)
- [Playwright Testing](https://playwright.dev/)
- [Jest Testing](https://jestjs.io/)
- [Firebase Rules Unit Testing](https://firebase.google.com/docs/rules/unit-tests)

### 12.2 Herramientas Recomendadas

- **Firebase Emulator Suite**: Para pruebas locales
- **Playwright**: Para pruebas E2E
- **Jest**: Para pruebas unitarias
- **Lighthouse CI**: Para pruebas de rendimiento
- **Axe-core**: Para pruebas de accesibilidad
- **Codecov**: Para cobertura de código

### 12.3 Comandos Útiles

```bash
# Iniciar emuladores
firebase emulators:start

# Ejecutar pruebas con emuladores
firebase emulators:exec "npm run test:all"

# Ejecutar pruebas específicas
npm run test:unit -- --testNamePattern="Personal"
npx playwright test --grep "offline"

# Ver reporte de cobertura
npm run test:coverage

# Ejecutar Lighthouse
lhci autorun

# Verificar seguridad
npm audit
npm run audit:firebase
```

---

## 13. Próximos Pasos

1. Implementar todas las pruebas unitarias faltantes
2. Configurar CI/CD con GitHub Actions
3. Agregar pruebas de reglas de Firestore
4. Implementar monitoreo en producción
5. Capacitar equipo en escritura de pruebas
6. Establecer métricas de calidad y thresholds
