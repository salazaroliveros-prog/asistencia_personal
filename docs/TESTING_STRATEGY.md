# Estrategia de Pruebas y Arquitectura del Sistema de Asistencia por QR

## 1. ARQUITECTURA DEL SISTEMA Y LÓGICA END-TO-END

### 1.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: MOBILE CLIENTS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐    ┌────────────────────────┐             │
│  │  Field Scanner PWA   │    │  Main SPA (Vue 3)      │             │
│  │  field-scanner.html  │    │  index.html             │             │
│  │  - Html5Qrcode       │    │  - Personal module      │             │
│  │  - Camera fallback   │    │  - Asistencia module    │             │
│  │  - Torch support     │    │  - Campo module         │             │
│  │  - Offline queue     │    │  - Camera modal         │             │
│  └──────────┬───────────┘    └───────────┬────────────┘             │
│             │                            │                           │
│  ┌──────────▼────────────────────────────▼────────────┐             │
│  │           Service Workers (SW)                      │             │
│  │  - field-scanner-sw.js: Cache-first local assets   │             │
│  │  - service-worker.js: Cache-first + Network-first  │             │
│  └────────────────────────────────────────────────────┘             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTPS │ WSS │ REST
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: BACKEND / DATABASE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │              Firebase / Firestore                          │        │
│  │  Collections:                                             │        │
│  │  • trabajadores (ID, DPI, Nombre, Puesto, QR_Data)       │        │
│  │  • asistencias (ID_Trabajador, Fecha, Tipo, GPS, Estado) │        │
│  │  • configuracion (PIN scanner, obra, horarios)            │        │
│  │  • auditoria_scanner (operador, dispositivo, timestamp)   │        │
│  │                                                            │        │
│  │  Real-time: onSnapshot() listeners                        │        │
│  │  Offline: enablePersistence() + local queue              │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: EXTERNAL INTEGRATIONS                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  • Google Apps Script (GAS) - API REST para reportes                  │
│  • WhatsApp Web API - Notificaciones (wa.me)                          │
│  • Geocoding API - Validación de geocerca                             │
│  • jsQR / Html5Qrcode - Decodificación QR                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Flujo End-to-End de Asistencia

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Worker  │      │  Scanner │      │   App    │      │ Firestore│
│  (QR)    │      │  Device  │      │  Logic   │      │  (DB)    │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                  │
     │  1. QR Code     │                 │                  │
     │  (JSON/Text)    │                 │                  │
     │───────────────>│                 │                  │
     │                 │ 2. getUserMedia │                  │
     │                 │ (camera)        │                  │
     │                 │────────────────>│                  │
     │                 │                 │ 3. Parse QR      │
     │                 │                 │ (Html5Qrcode)    │
     │                 │                 │─────────────────>│
     │                 │                 │ 4. Query worker  │
     │                 │                 │ (local cache)    │
     │                 │                 │<─────────────────│
     │                 │                 │ 5. Get GPS       │
     │                 │                 │ (navigator.geoloc)
     │                 │                 │─────────────────>│
     │                 │                 │                  │ 6. Validate
     │                 │                 │                  │ geofence
     │                 │                 │                  │ (optional)
     │                 │                 │ 7. Build payload │
     │                 │                 │ (ID, Fecha, Tipo,│
     │                 │                 │  GPS, Método)    │
     │                 │                 │──────────────────>│
     │                 │                 │                  8. Transaction
     │                 │                 │                  │ (atomic write)
     │                 │                 │<──────────────────│
     │                 │ 9. UI Feedback  │                  │
     │                 │ (beep + alert)  │                  │
     │<────────────────│                 │                  │
     │                 │                 │                  │
```

### 1.3 Estados del Sistema

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ONLINE    │────>│   SYNCING   │────>│   SYNCED    │<────│  CONFLICT   │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │                   │
        │                   │                   │                   │
        ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CONNECTED  │     │  WRITING    │     │  IDLE       │     │  RESOLVE    │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 1.4 Modelo de Datos

```typescript
// Trabajador
interface Worker {
  ID_Trabajador: string;        // Único, formato: TRAB-{timestamp}-{random}
  DPI_CUI: string;              // 13 dígitos, único
  Nombre_Completo: string;      // Requerido
  Puesto: string;               // Requerido
  Jefe_Inmediato: string;
  Telefono: string;
  WhatsApp: string;
  Direccion: string;
  Fotografia_URL: string;       // Base64 o URL
  Codigo_QR_Data: string;       // JSON: { id, dpi, nombre }
  Fecha_Registro: string;       // ISO8601
  Estado: 'Activo' | 'Inactivo';
  Ubicacion_Obra: string;
}

// Asistencia
interface AttendanceRecord {
  ID_Marcacion: string;         // {Fecha}_{DPI_Limpio}
  ID_Trabajador: string;
  Documento: string;            // DPI limpio
  Nombre_Completo: string;
  Puesto: string;
  Fecha: string;                // YYYY-MM-DD
  Tipo_Marcacion: 'Entrada' | 'Salida_Receso' | 'Regreso_Receso' | 'Salida_Obra';
  Hora_Real: string;            // HH:mm
  Estado_Marcacion: 'A Tiempo' | 'Tolerancia' | 'Atraso' | 'Ausencia';
  Metodo_Registro: 'Escaneo_QR' | 'Manual' | 'QR_ESCANER_MOVIL';
  GPS_Latitud: number | null;
  GPS_Longitud: number | null;
  GPS_Dentro_Geocerca: boolean | null;
  Ubicacion_Obra: string;
  Operador: string;             // Scanner operator ID
  Dispositivo: string;          // User-Agent + platform
  Fecha_Registro: Timestamp;    // Server timestamp
  Historial_Marcaciones: Array<{
    Fecha: string;
    Hora: string;
    Timestamp: number;
    Metodo_Registro: string;
    Origen: string;
  }>;
  Metodos_Registro: string[];   // Unique methods used
}

// Auditoría Scanner
interface ScannerAudit {
  timestamp: string;
  operator: string;
  device: string;
  action: 'marcacion' | 'error' | 'login' | 'logout';
  workerId?: string;
  workerName?: string;
  tipo?: string;
  status: 'success' | 'error';
}
```

### 1.5 Lógica de Negocio

```typescript
// Reglas de validación
const BusinessRules = {
  // 1. Un trabajador solo puede marcar una entrada por día
  duplicateEntry: (record: AttendanceRecord, cache: AttendanceRecord[]) => {
    return cache.some(c =>
      c.ID_Trabajador === record.ID_Trabajador &&
      c.Tipo_Marcacion === record.Tipo_Marcacion &&
      c.Fecha === record.Fecha &&
      Math.abs(timeDiff(c.Hora_Real, record.Hora_Real)) <= 2
    );
  },

  // 2. Validación de horario según tipo de marcación
  validateSchedule: (tipo: string, hora: string): boolean => {
    const [h, m] = hora.split(':').map(Number);
    const minutes = h * 60 + m;
    switch (tipo) {
      case 'Entrada': return minutes >= 300 && minutes <= 720; // 5:00 - 12:00
      case 'Salida_Receso': return minutes >= 540 && minutes <= 780; // 9:00 - 13:00
      case 'Regreso_Receso': return minutes >= 780 && minutes <= 1020; // 13:00 - 17:00
      case 'Salida_Obra': return minutes >= 1020 && minutes <= 1320; // 17:00 - 22:00
      default: return true;
    }
  },

  // 3. Tolerancia de 15 minutos para atrasos
  tolerance: (scheduled: string, actual: string): number => {
    const [sh, sm] = scheduled.split(':').map(Number);
    const [ah, am] = actual.split(':').map(Number);
    return (ah * 60 + am) - (sh * 60 + sm);
  },

  // 4. Geocerca: radio configurable (default 200m)
  geofence: (current: GeoCoord, center: GeoCoord, radius: number): boolean => {
    const distance = haversine(current, center);
    return distance <= radius;
  },
};
```

---

## 2. METODOLOGÍA DE PRUEBAS

### 2.1 Pirámide de Pruebas

```
        ┌─────────────┐
        │   E2E Tests  │  ← 10% (Playwright / Cypress)
        │  (Scenarios) │      - Flujos completos
        ├─────────────┤      - Múltiples dispositivos
        │ Integration │  ← 30% (Jest + MSW)
        │   Tests      │      - Firebase mocks
        ├─────────────┤      - API contracts
        │    Unit      │  ← 60% (Jest / Vitest)
        │    Tests      │      - Validators
        │               │      - Helpers
        └─────────────┘      - Business rules
```

### 2.2 Framework de Pruebas

```javascript
// Estructura del proyecto de pruebas
__tests__/
├── unit/
│   ├── validators.test.js          # DPI, teléfono, horarios
│   ├── string-helpers.test.js      # escapeHtml, formatPhone
│   ├── photo-helpers.test.js       # compressImage, updatePreview
│   ├── gps.test.js                 # Haversine, geofence
│   ├── qr-generator.test.js        # QR parsing, worker lookup
│   ├── attendance-logic.test.js    # duplicate detection, tolerance
│   └── business-rules.test.js      # schedule validation
├── integration/
│   ├── firestore-mock.test.js      # Firestore transactions
│   ├── offline-queue.test.js       # LocalStorage queue logic
│   ├── scanner-integration.test.js # Html5Qrcode mock
│   └── api-contract.test.js        # API responses
├── e2e/
│   ├── field-scanner.spec.js       # Playwright: scanner flow
│   ├── main-app.spec.js            # Playwright: full SPA
│   ├── camera-modal.spec.js        # Playwright: photo capture
│   └── pwa-install.spec.js         # Playwright: install prompt
└── fixtures/
    ├── workers.json                # 1000 fake workers
    ├── attendance-records.json     # 30 days of history
    ├── qr-codes.json               # Sample QR payloads
    └── gps-coordinates.json        # Guatemala locations
```

### 2.3 Configuración de Pruebas

```javascript
// jest.config.js / vitest.config.js
export default {
  testEnvironment: 'jsdom',
  setupFiles: ['__tests__/setup.js'],
  globalSetup: ['__tests__/global-setup.js'],
  coverage: {
    thresholds: {
      unit: 80,
      integration: 70,
      e2e: 60,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
  },
};
```

```javascript
// __tests__/setup.js
import { vi } from 'vitest';

// Mock Firebase
vi.mock('./src/firebase', () => ({
  initialize: vi.fn().mockResolvedValue({ success: true }),
  list: vi.fn().mockResolvedValue([]),
  save: vi.fn().mockResolvedValue({}),
  subscribe: vi.fn().mockReturnValue(() => {}),
}));

// Mock Html5Qrcode
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    scan: vi.fn(),
  })),
}));

// Mock geolocation
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success) =>
      success({
        coords: { latitude: 14.6349, longitude: -90.5062, accuracy: 10 },
        timestamp: Date.now(),
      })
    ),
  },
});

// Mock mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});
```

---

## 3. SIMULACIÓN Y ESCENARIOS DE VALIDACIÓN

### 3.1 Edge Cases

#### 3.1.1 Latencia de Red

```javascript
// Simulación: 3G lento (500ms - 2000ms RTT)
async function testSlowNetwork() {
  // Usar Service Worker para throttling
  await page.route('**/*', (route) => {
    const delay = Math.random() * 2000 + 500;
    setTimeout(() => route.continue(), delay);
  });

  // Escanear QR
  await scanQR(validQR);

  // Verificar: UI muestra "Sincronizando..." inmediatamente
  await expect(page.locator('#sync-indicator')).toHaveText('Sincronizando...');

  // Verificar: After 2s, UI muestra "Sincronizado"
  await expect(page.locator('#sync-indicator')).toHaveText('Sincronizado', { timeout: 5000 });
}

// Simulación: Conexión intermitente (2s ON, 3s OFF)
async function testIntermittentNetwork() {
  let online = true;
  setInterval(() => {
    online = !online;
    if (online) window.dispatchEvent(new Event('online'));
    else window.dispatchEvent(new Event('offline'));
  }, 5000);

  // Escanear 10 QRs rápidamente
  for (let i = 0; i < 10; i++) {
    await scanQR(validQR);
    await page.waitForTimeout(500);
  }

  // Verificar: 10 marcas en cola offline
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('offline_queue') || '[]'));
  expect(queue.length).toBe(10);

  // Reconectar
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(5000);

  // Verificar: Cola vacía, todos sincronizados
  const queueAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('offline_queue') || '[]'));
  expect(queueAfter.length).toBe(0);
}
```

#### 3.1.2 Modo Offline

```javascript
// Simulación: Escanear sin conexión
async function testOfflineMode() {
  // Desconectar red
  await page.context().setOffline(true);

  // Escanear QR
  await scanQR(validQR);

  // Verificar: Marca guardada en cache local
  const localCache = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('attendance_cache') || '[]');
  });
  expect(localCache.length).toBe(1);

  // Verificar: UI muestra "Modo offline"
  await expect(page.locator('#connection-status')).toHaveText('Offline');

  // Reconectar
  await page.context().setOffline(false);
  await page.waitForTimeout(3000);

  // Verificar: Sincronización automática
  const synced = await page.evaluate(() => {
    return firebase().isReady() && firebase().getConnectionState() === 'connected';
  });
  expect(synced).toBe(true);
}
```

#### 3.1.3 Condiciones de Baja Luz

```javascript
// Simulación: Cámara con baja luminosidad
async function testLowLightConditions() {
  // Usar video de baja luminosidad (simular con CSS filter)
  await page.evaluate(() => {
    const video = document.getElementById('camera-video');
    if (video) video.style.filter = 'brightness(0.3) contrast(0.8)';
  });

  // Intentar escanear
  await scanQR(validQR);

  // Verificar: App muestra mensaje de "acerca el código a la luz"
  await expect(page.locator('#camera-hint')).toHaveText('Acerca el código a una fuente de luz');
}
```

#### 3.1.4 QR Incorrecto o Expirado

```javascript
// Simulación: QR inválido
async function testInvalidQR() {
  const invalidQRs = [
    '{ "id": "INVALID" }',              // ID no existe
    '{ "dpi": "123" }',                  // DPI muy corto
    'random-text-no-json',               // Texto plano sin formato
    '{ "id": "TRAB-9999999999999" }',    // ID que no existe en DB
  ];

  for (const qr of invalidQRs) {
    await scanQR(qr);
    await expect(page.locator('#error-toast')).toBeVisible();
  }
}

// Simulación: QR duplicado (misma marca en 2 min)
async function testDuplicateQR() {
  await scanQR(validQR);  // Primera marca
  await page.waitForTimeout(3000);

  await scanQR(validQR);  // Segunda marca (duplicada)
  await expect(page.locator('#warning-toast')).toHaveText('Marca duplicada detectada');
}
```

### 3.2 Concurrencia y Carga

```javascript
// Simulación: 10 dispositivos escaneando simultáneamente
async function testConcurrentScans() {
  const devices = [];
  const totalScans = 100;

  // Crear 10 workers
  const workers = Array.from({ length: 10 }, (_, i) => ({
    ID_Trabajador: `TRAB-TEST-${i}`,
    Nombre_Completo: `Worker ${i}`,
    DPI_CUI: `1234567890${i}`,
  }));

  // Simular 10 dispositivos
  for (let d = 0; d < 10; d++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/field-scanner.html');

    devices.push({ context, page, workerIndex: d });
  }

  // Cada dispositivo escanea 10 veces
  const scanPromises = devices.flatMap(({ page, workerIndex }) =>
    Array.from({ length: 10 }, (_, i) =>
      page.evaluate((workerId) => {
        window.dispatchEvent(new CustomEvent('simulate-scan', {
          detail: { workerId, tipo: 'Entrada' }
        }));
      }, workers[workerIndex].ID_Trabajador)
    )
  );

  await Promise.all(scanPromises);

  // Verificar: 100 marcas en Firestore
  const records = await firestore.collection('asistencias').get();
  expect(records.size).toBe(100);

  // Cleanup
  for (const { context } of devices) await context.close();
}

// Simulación: Race condition (mismo worker, 2 dispositivos, misma hora)
async function testRaceCondition() {
  const workerId = 'TRAB-RACE-TEST';

  // Dispositivo 1
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto('/field-scanner.html');

  // Dispositivo 2
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto('/field-scanner.html');

  // Ambos escanean al mismo tiempo
  await Promise.all([
    page1.evaluate((id) => simulateScan(id), workerId),
    page2.evaluate((id) => simulateScan(id), workerId),
  ]);

  // Verificar: Firestore transaction previene duplicados
  const doc = await firestore.collection('asistencias').doc('today_DPI').get();
  const historial = doc.data().Historial_Marcaciones;
  expect(historial.length).toBe(1); // Solo una entrada
}
```

### 3.3 Seguridad

#### 3.3.1 Validación de Autenticidad de QR

```javascript
// Simulación: QR spoofing
async function testQRSpoofing() {
  const attacks = [
    // 1. QR con ID de otro trabajador
    { qr: { id: 'TRAB-VICTIM', dpi: '9999999999999' }, expected: 'Trabajador no encontrado' },

    // 2. QR con DPI incorrecto (no coincide con ID)
    { qr: { id: 'TRAB-123', dpi: '8888888888888' }, expected: 'DPI no coincide' },

    // 3. QR sin firma (payload vacío)
    { qr: {}, expected: 'Datos inválidos' },

    // 4. QR con timestamp expirado (>24h)
    { qr: { id: 'TRAB-123', exp: Date.now() - 86400000 }, expected: 'QR expirado' },
  ];

  for (const attack of attacks) {
    await scanQR(JSON.stringify(attack.qr));
    await expect(page.locator('#error-toast')).toContainText(attack.expected);
  }
}
```

#### 3.3.2 Validación de Dispositivo

```javascript
// Simulación: Mismo dispositivo, operador diferente
async function testDeviceFingerprinting() {
  const deviceId = 'device-12345';

  // Operador A escanea
  await page.evaluate(() => {
    localStorage.setItem('field_scanner_session', JSON.stringify({
      operator: 'operador_A',
      deviceId: 'device-12345',
      expiresAt: Date.now() + 3600000,
    }));
  });
  await scanQR(validQR);

  // Operador B intenta escanear desde mismo dispositivo
  await page.evaluate(() => {
    localStorage.setItem('field_scanner_session', JSON.stringify({
      operator: 'operador_B',
      deviceId: 'device-12345',
      expiresAt: Date.now() + 3600000,
    }));
  });

  // Verificar: Sistema detecta conflicto de dispositivo
  const auditLog = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('field_scanner_audit_log') || '[]');
  });
  expect(auditLog.some(log => log.action === 'error' && log.context === 'device_conflict')).toBe(true);
}
```

#### 3.3.3 Prevención de Replay Attacks

```javascript
// Simulación: Replay de marca capturada
async function testReplayAttack() {
  // Capturar payload de una marca legítima
  const legitimatePayload = await captureScanPayload();

  // Replay 1 minuto después
  await page.waitForTimeout(60000);
  await page.evaluate((payload) => {
    window.dispatchEvent(new CustomEvent('simulate-scan', { detail: payload }));
  }, legitimatePayload);

  // Verificar: Sistema rechaza replay (timestamp duplicado)
  await expect(page.locator('#error-toast')).toContainText('Marca duplicada');
}
```

---

## 4. SIMULACIÓN DE DATOS

### 4.1 Generador de Trabajadores

```javascript
// __tests__/fixtures/worker-generator.js
import { faker } from '@faker-js/faker';

export function generateWorkers(count: number): Worker[] {
  return Array.from({ length: count }, (_, i) => ({
    ID_Trabajador: `TRAB-${Date.now()}-${i.toString(36).toUpperCase()}`,
    DPI_CUI: generateDPI(),
    Nombre_Completo: faker.person.fullName({ sex: faker.person.sexType() }),
    Puesto: faker.person.jobTitle(),
    Jefe_Inmediato: faker.person.fullName(),
    Telefono: generatePhone(),
    WhatsApp: generateWhatsApp(),
    Direccion: faker.location.streetAddress(),
    Fotografia_URL: faker.image.avatar(),
    Codigo_QR_Data: JSON.stringify({
      id: `TRAB-${Date.now()}-${i.toString(36).toUpperCase()}`,
      dpi: generateDPI(),
      nombre: faker.person.fullName(),
    }),
    Fecha_Registro: faker.date.past().toISOString(),
    Estado: faker.helpers.arrayElement(['Activo', 'Inactivo']),
    Ubicacion_Obra: generateGPS(),
  }));
}

function generateDPI(): string {
  // DPI guatemalteco: 13 dígitos
  const dept = faker.string.numeric(2);
  const municipio = faker.string.numeric(2);
  const numero = faker.string.numeric(9);
  return `${dept}${municipio}${numero}`;
}

function generatePhone(): string {
  // Guatemala: 8 dígitos
  return faker.string.numeric(8);
}

function generateWhatsApp(): string {
  // +502 1234 5678
  return `+502 ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
}

function generateGPS(): string {
  // Guatemala City area
  const lat = 14.6349 + (Math.random() - 0.5) * 0.5;
  const lon = -90.5062 + (Math.random() - 0.5) * 0.5;
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}
```

### 4.2 Generador de Marcaciones

```javascript
// __tests__/fixtures/attendance-generator.js
export function generateAttendanceRecords(
  workers: Worker[],
  days: number = 30
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    for (const worker of workers) {
      if (isWeekend && Math.random() > 0.1) continue; // 10% trabajan fin de semana

      // Probabilidad de asistencia: 85%
      if (Math.random() > 0.85) continue;

      const tipo = faker.helpers.arrayElement([
        'Entrada',
        'Salida_Receso',
        'Regreso_Receso',
        'Salida_Obra',
      ]);

      const horaBase = getBaseHour(tipo);
      const tolerance = faker.number.int({ min: -5, max: 15 }); // minutes
      const horaReal = addMinutes(horaBase, tolerance);

      records.push({
        ID_Marcacion: `${dateStr}_${worker.DPI_CUI.replace(/\D/g, '')}`,
        ID_Trabajador: worker.ID_Trabajador,
        Documento: worker.DPI_CUI.replace(/\D/g, ''),
        Nombre_Completo: worker.Nombre_Completo,
        Puesto: worker.Puesto,
        Fecha: dateStr,
        Tipo_Marcacion: tipo,
        Hora_Real: formatTime(addMinutes(parseTime(horaBase), tolerance)),
        Estado_Marcacion: calculateStatus(tolerance),
        Metodo_Registro: faker.helpers.arrayElement([
          'Escaneo_QR',
          'Manual',
          'QR_ESCANER_MOVIL',
        ]),
        GPS_Latitud: parseFloat(generateGPS().split(',')[0]),
        GPS_Longitud: parseFloat(generateGPS().split(',')[1]),
        GPS_Dentro_Geocerca: Math.random() > 0.2, // 80% dentro de geocerca
        Ubicacion_Obra: 'Obra Principal',
        Operador: faker.person.fullName(),
        Dispositivo: faker.helpers.arrayElement([
          'Mobile · Android · Chrome/120.0',
          'Mobile · iOS · Safari/17.0',
          'Mobile · Android · Chrome/119.0',
        ]),
        Fecha_Registro: date.toISOString(),
        Historial_Marcaciones: [],
        Metodos_Registro: [tipo],
      });
    }
  }

  return records;
}

function getBaseHour(tipo: string): string {
  const schedule = {
    'Entrada': '07:00',
    'Salida_Receso': '10:00',
    'Regreso_Receso': '10:30',
    'Salida_Obra': '17:00',
  };
  return schedule[tipo] || '07:00';
}
```

### 4.3 Generador de QR Codes

```javascript
// __tests__/fixtures/qr-generator.js
export function generateQRPayloads(workers: Worker[]): string[] {
  return workers.map(worker => {
    // Formato 1: JSON estructurado
    const jsonPayload = JSON.stringify({
      id: worker.ID_Trabajador,
      dpi: worker.DPI_CUI,
      nombre: worker.Nombre_Completo,
      exp: Date.now() + 86400000, // 24h expiry
    });

    // Formato 2: DPI plano (legacy)
    const plainPayload = worker.DPI_CUI.replace(/\D/g, '');

    // Formato 3: ID del trabajador (legacy)
    const idPayload = worker.ID_Trabajador;

    return faker.helpers.arrayElement([jsonPayload, plainPayload, idPayload]);
  });
}
```

### 4.4 Generador de Escenarios de Error

```javascript
// __tests__/fixtures/error-scenarios.js
export const ERROR_SCENARIOS = {
  // Red
  networkLatency: { min: 500, max: 3000 },
  networkTimeout: { probability: 0.1 },
  offlineDuringScan: { probability: 0.15 },

  // Cámara
  cameraDenied: { probability: 0.05 },
  cameraBusy: { probability: 0.03 },
  lowLight: { probability: 0.2 },
  blurryQR: { probability: 0.1 },

  // Datos
  invalidQR: { probability: 0.08 },
  duplicateQR: { probability: 0.05 },
  expiredQR: { probability: 0.02 },

  // GPS
  gpsTimeout: { probability: 0.1 },
  gpsInaccurate: { accuracy: 100 }, // meters
  outOfGeofence: { probability: 0.15 },

  // Firebase
  firestoreUnavailable: { probability: 0.05 },
  quotaExceeded: { probability: 0.01 },
  permissionDenied: { probability: 0.03 },
};
```

---

## 5. SUITE DE PRUEBAS COMPLETA

### 5.1 Pruebas Unitarias (60% del esfuerzo)

```javascript
// __tests__/unit/validators.test.js
describe('Validators', () => {
  test('DPI válido: 13 dígitos', () => {
    expect(validateDPI('1234567890123')).toBe(true);
  });

  test('DPI inválido: menos de 13 dígitos', () => {
    expect(validateDPI('123456789')).toBe(false);
  });

  test('DPI con letras', () => {
    expect(validateDPI('123456789012A')).toBe(false);
  });

  test('Teléfono local: 8 dígitos', () => {
    expect(validatePhone('12345678')).toBe(true);
  });

  test('Teléfono internacional: +502', () => {
    expect(validatePhone('+50212345678')).toBe(true);
  });

  test('Hora válida: 07:00', () => {
    expect(validateTime('07:00')).toBe(true);
  });

  test('Hora inválida: 25:00', () => {
    expect(validateTime('25:00')).toBe(false);
  });

  test('Tolerancia máxima: 60 minutos', () => {
    expect(validateTolerance(60)).toBe(true);
  });

  test('Tolerancia inválida: -1', () => {
    expect(validateTolerance(-1)).toBe(false);
  });
});

// __tests__/unit/gps.test.js
describe('GPS Utils', () => {
  test('Haversine: Guatemala City a Mixco (~8km)', () => {
    const dist = GPS.calculateDistance(14.6349, -90.5062, 14.6123, -90.5267);
    expect(dist).toBeGreaterThan(7000);
    expect(dist).toBeLessThan(9000);
  });

  test('Geofence: dentro de radio', () => {
    const result = GPS.checkGeofence(
      { latitude: 14.6349, longitude: -90.5062 },
      { latitude: 14.6350, longitude: -90.5063 },
      200
    );
    expect(result.inside).toBe(true);
    expect(result.distance).toBeLessThan(200);
  });

  test('Geofence: fuera de radio', () => {
    const result = GPS.checkGeofence(
      { latitude: 14.6349, longitude: -90.5062 },
      { latitude: 14.7000, longitude: -90.6000 },
      200
    );
    expect(result.inside).toBe(false);
  });
});
```

### 5.2 Pruebas de Integración (30% del esfuerzo)

```javascript
// __tests__/integration/firestore-mock.test.js
describe('Firestore Integration', () => {
  test('Transaction: registrar asistencia con historial', async () => {
    const mockDoc = {
      exists: true,
      data: () => ({
        Historial_Marcaciones: [],
        Metodos_Registro: [],
      }),
    };

    // Mock transaction.get
    firestoreMock.collection.mockReturnValue({
      doc: () => mockDoc,
      add: vi.fn().mockResolvedValue({ id: 'test-id' }),
    });

    await registrarAsistencia('TRAB-123', worker);

    // Verificar: Transaction ejecutada
    expect(runTransaction).toHaveBeenCalled();

    // Verificar: Documento mergeado
    expect(mockDoc.data().Historial_Marcaciones.length).toBe(1);
    expect(mockDoc.data().Metodos_Registro).toContain('QR_ESCANER_MOVIL');
  });

  test('Offline queue: sincronización al reconectar', async () => {
    // Simular 3 marcas offline
    localStorage.setItem('offline_queue', JSON.stringify([
      { workerId: '1', fechaHoy: '2026-09-13', hora: '07:05' },
      { workerId: '2', fechaHoy: '2026-09-13', hora: '07:10' },
      { workerId: '3', fechaHoy: '2026-09-13', hora: '07:15' },
    ]));

    // Reconectar
    await processOfflineQueue();

    // Verificar: Cola vacía
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    expect(queue.length).toBe(0);

    // Verificar: 3 transacciones ejecutadas
    expect(runTransaction).toHaveBeenCalledTimes(3);
  });
});

// __tests__/integration/scanner-integration.test.js
describe('Scanner Integration', () => {
  test('Html5Qrcode: decodificar QR válido', async () => {
    const qrData = JSON.stringify({ id: 'TRAB-123', dpi: '1234567890123' });
    const result = await Html5Qrcode.decode(qrData);
    expect(result).toEqual({ id: 'TRAB-123', dpi: '1234567890123' });
  });

  test('Camera: fallback environment -> user', async () => {
    // Simular OverconstrainedError en cámara trasera
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(
      new Error('OverconstrainedError')
    );

    // Segundo intento: éxito con cámara frontal
    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce({
      getTracks: () => [{ stop: vi.fn() }],
    });

    await startScanner();

    // Verificar: Segundo llamado con facingMode: 'user'
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: 'user' }) })
    );
  });
});
```

### 5.3 Pruebas E2E (10% del esfuerzo)

```javascript
// __tests__/e2e/field-scanner.spec.js
import { test, expect } from '@playwright/test';

test.describe('Field Scanner E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/field-scanner.html');
  });

  test('Flujo completo: login -> escanear -> marcar -> sync', async ({ page }) => {
    // 1. Login con PIN
    await page.fill('#login-pin', '1234');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#campo-scanner')).toBeVisible();

    // 2. Iniciar escáner
    await page.click('#campo-btn-scan');
    await page.waitForTimeout(1000); // Esperar cámara

    // 3. Simular escaneo de QR
    await page.evaluate(() => {
      const qrData = JSON.stringify({
        id: 'TRAB-TEST-001',
        dpi: '1234567890123',
        nombre: 'Juan Pérez',
      });
      window.dispatchEvent(new CustomEvent('simulate-scan', { detail: qrData }));
    });

    // 4. Verificar: Worker panel visible
    await expect(page.locator('#campo-worker-name')).toHaveText('Juan Pérez');

    // 5. Marcar entrada
    await page.click('.campo-mark-btn[data-tipo="Entrada"]');

    // 6. Verificar: Alerta de éxito
    await expect(page.locator('.alert-success')).toBeVisible();

    // 7. Verificar: Feed actualizado
    await expect(page.locator('.campo-feed-item')).toHaveCount(1);
  });

  test('Modo offline: escanear sin conexión', async ({ page }) => {
    // Desconectar red
    await page.context().setOffline(true);

    // Escanear QR
    await page.evaluate(() => {
      simulateScan({ id: 'TRAB-OFFLINE', dpi: '9999999999999' });
    });

    // Verificar: Marca en cola offline
    const queue = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('offline_queue') || '[]')
    );
    expect(queue.length).toBe(1);

    // Reconectar
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // Verificar: Cola sincronizada
    const queueAfter = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('offline_queue') || '[]')
    );
    expect(queueAfter.length).toBe(0);
  });
});

// __tests__/e2e/main-app.spec.js
test.describe('Main App E2E', () => {
  test('Camera modal: capturar foto de trabajador', async ({ page }) => {
    await page.goto('/');

    // Navegar a Personal
    await page.click('#nav-personal');
    await page.click('#btn-add-personal');

    // Abrir cámara
    await page.click('#btn-camera-open');
    await page.waitForTimeout(1000);

    // Simular captura
    await page.evaluate(() => {
      const video = document.getElementById('camera-video');
      video.videoWidth = 640;
      video.videoHeight = 480;
      video.srcObject = {
        getTracks: () => [{ stop: vi.fn() }],
      };
    });

    await page.click('#btn-camera-capture');

    // Verificar: Preview visible
    await expect(page.locator('#camera-preview-section')).toBeVisible();
    await expect(page.locator('#camera-captured-img')).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'));
  });
});
```

---

## 6. INFRAESTRUCTURA DE PRUEBAS

### 6.1 Entornos

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

### 6.2 Datos de Prueba (Seed Data)

```javascript
// __tests__/fixtures/seed-data.ts
export async function seedFirestore() {
  const workers = generateWorkers(100);
  const attendance = generateAttendanceRecords(workers, 30);

  // Batch write
  const batch = writeBatch(db);

  workers.forEach(worker => {
    batch.set(doc(db, 'trabajadores', worker.ID_Trabajador), worker);
  });

  attendance.forEach(record => {
    batch.set(doc(db, 'asistencias', record.ID_Marcacion), record);
  });

  await batch.commit();
}

export async function clearFirestore() {
  const collections = ['trabajadores', 'asistencias', 'configuracion', 'auditoria_scanner'];

  for (const col of collections) {
    const snapshot = await getDocs(collection(db, col));
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}
```

---

## 7. MÉTRICAS Y MONITOREO

### 7.1 KPIs de Sistema

```javascript
const SystemMetrics = {
  // Performance
  scanLatency: { target: '< 2s', alert: '> 5s' },
  cameraInitTime: { target: '< 1s', alert: '> 3s' },
  syncTime: { target: '< 3s', alert: '> 10s' },

  // Reliability
  scanSuccessRate: { target: '> 99%', alert: '< 95%' },
  syncSuccessRate: { target: '> 98%', alert: '< 90%' },
  offlineQueueSize: { target: '< 10', alert: '> 50' },

  // Business
  duplicateRate: { target: '< 1%', alert: '> 5%' },
  fraudRate: { target: '0%', alert: '> 0.1%' },
  averageMarksPerDay: { target: '400-600', alert: '< 200' },
};
```

### 7.2 Logs Estructurados

```javascript
// Log schema
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  context: string;
  device: string;
  operator?: string;
  workerId?: string;
  duration?: number;
  error?: string;
}

// Ejemplo de log
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  context: 'qr_scan_success',
  device: getDeviceInfo(),
  workerId: worker.ID_Trabajador,
  duration: 1.2, // seconds
}));
```

---

## 8. PLAN DE PRUEBAS POR FASE

### Fase 1: Unitarias (Semana 1)
- [ ] Validators (DPI, teléfono, horarios)
- [ ] GPS utils (Haversine, geofence)
- [ ] QR parser (JSON, plain text, legacy)
- [ ] Business rules (duplicate detection, tolerance)
- [ ] Offline queue logic

### Fase 2: Integración (Semana 2)
- [ ] Firestore transactions (mocked)
- [ ] Offline queue sync
- [ ] Camera fallback logic
- [ ] Service worker caching
- [ ] API contracts

### Fase 3: E2E (Semana 3)
- [ ] Field scanner flow (login -> scan -> mark -> sync)
- [ ] Main app camera modal
- [ ] PWA install flow
- [ ] Offline -> Online transition
- [ ] Concurrent scans (multi-device)

### Fase 4: Performance & Load (Semana 4)
- [ ] 1000 workers, 30 days history
- [ ] 10 concurrent devices, 100 scans each
- [ ] Network throttling (3G, 4G, offline)
- [ ] Battery drain test (30 min continuous scan)
- [ ] Memory leak test (1000 scans)

### Fase 5: Security & Penetration (Semana 5)
- [ ] QR spoofing attempts
- [ ] Replay attacks
- [ ] Device fingerprinting
- [ ] Man-in-the-middle (MITM) simulation
- [ ] SQL injection (if using GAS backend)

---

## 9. CHECKLIST DE VALIDACIÓN PRE-PRODUCCIÓN

### 9.1 Funcional
- [ ] Escaneo QR exitoso en iOS Safari
- [ ] Escaneo QR exitoso en Android Chrome
- [ ] Fallback cámara frontal/trasera
- [ ] Flash/torch funcional
- [ ] GPS captura coordenadas
- [ ] Geocerca valida ubicación
- [ ] Modo offline funciona
- [ ] Sincronización automática al reconectar
- [ ] Detección de duplicados
- [ ] Auditoría de operaciones

### 9.2 No-Funcional
- [ ] Tiempo de escaneo < 2s
- [ ] App inicia en < 3s
- [ ] Sin memory leaks en 1000 escaneos
- [ ] Battery drain < 10% en 30 min
- [ ] Funciona en 3G lento
- [ ] Funciona en modo avión (offline)
- [ ] PWA instalable en iOS/Android

### 9.3 Seguridad
- [ ] QR solo válido por 24h
- [ ] Device fingerprinting activo
- [ ] HTTPS forzado en producción
- [ ] Permissions-Policy configurado
- [ ] Sin secrets en código fuente
- [ ] Firestore rules restrictivas

### 9.4 UI/UX
- [ ] Responsive en móviles (320px - 1440px)
- [ ] Touch targets > 44px
- [ ] Contraste WCAG AA
- [ ] Mensajes de error claros
- [ ] Loading states visibles
- [ ] Offline indicator siempre visible

---

## 10. CONCLUSIONES Y RECOMENDACIONES

1. **Testing Continuo**: Implementar CI/CD con GitHub Actions para correr tests en cada push.
2. **Feature Flags**: Usar flags para desplegar features gradualmente (ej: torch, geofence).
3. **Monitoring**: Implementar logging estructurado y alertas en producción (Sentry, LogRocket).
4. **Beta Testing**: Distribuir a 5-10 dispositivos de campo antes de producción.
5. **Documentation**: Mantener documentación actualizada de API, QR format, y troubleshooting.
