/**
 * Tests unitarios — field-scanner.js
 *
 * Valida los flujos críticos del escáner de campo sin cargar el módulo
 * completo (que es un IIFE con efectos de lado DOM/Firebase al arrancar).
 * En su lugar se testean:
 *   - La lógica pura extraída del módulo (funciones sin dependencias DOM)
 *   - El contenido del HTML de producción (rutas, URLs, estructura)
 *   - Los formatos de datos que exige firestore.rules
 *
 * @version 1.5.0
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// ─── Lógica pura extraída de field-scanner.js para testear ──────────────────
// Estas funciones son copias exactas del código en field-scanner.js.
// Si se modifica la lógica allá debe actualizarse aquí también.

/** Parsea el texto de un QR al formato {id?, dpi?} */
function parseQRData(text) {
  try {
    const data = JSON.parse(text);
    if (data && data.id) return data;
  } catch (_) { /* no es JSON */ }
  if (text && /^[A-Z0-9-]+$/.test(text) && text.length >= 5) return { id: text };
  return null;
}

/** Devuelve la fecha de hoy como YYYY-MM-DD */
function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

/** Construye el ID determinista de una marcación */
function buildMarcacionId(idTrabajador, fecha, tipo) {
  return `${idTrabajador}_${fecha}_${tipo}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Normaliza un número DPI (quita separadores) */
function normalizeDpi(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/** Traduce códigos de error de Firebase Auth al español */
function traducirErrorAuth(errorCode = '', message = '') {
  const code = String(errorCode).toLowerCase();
  const msg  = String(message).toLowerCase();
  if (code.includes('user-not-found') || msg.includes('no user record'))
    return 'No existe ninguna cuenta con ese correo electrónico.';
  if (code.includes('wrong-password') || code.includes('invalid-credential') || msg.includes('invalid credential') || msg.includes('invalid login'))
    return 'Correo o contraseña incorrectos. Verifica tus credenciales.';
  if (code.includes('too-many-requests') || msg.includes('too many'))
    return 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.';
  if (code.includes('user-disabled'))
    return 'Esta cuenta ha sido desactivada. Contacta al administrador.';
  if (code.includes('network') || msg.includes('network') || msg.includes('unavailable'))
    return 'Sin conexión a internet. Verifica tu red e inténtalo de nuevo.';
  if (code.includes('invalid-email'))
    return 'El correo electrónico no tiene un formato válido.';
  if (code.includes('missing-password'))
    return 'La contraseña es obligatoria.';
  return 'No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.';
}

/** Traduce errores de escritura en Firestore a mensajes para el operador */
function mensajeErrorMarcacion(err) {
  const code = String(err?.code || '');
  if (code.includes('permission-denied'))
    return 'Sin permiso para registrar. Verifica que tu correo esté verificado y la sesión activa.';
  if (code.includes('unavailable') || code.includes('network'))
    return 'Sin conexión: la marcación no se pudo enviar. Inténtalo de nuevo.';
  if (code.includes('failed-precondition'))
    return 'Base de datos no lista. Recarga la página e inténtalo otra vez.';
  return 'No se pudo registrar la marca';
}

/** Valida la sesión de un usuario */
function validateSession(user, AUTHORIZED_OPERATOR_EMAILS = [], REQUIRE_VERIFIED_EMAIL = false) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, reason: 'unauthorized' };
  const authorized = AUTHORIZED_OPERATOR_EMAILS.length === 0 ||
    AUTHORIZED_OPERATOR_EMAILS.some((e) => e.toLowerCase() === email);
  if (!authorized) return { ok: false, reason: 'unauthorized' };
  if (REQUIRE_VERIFIED_EMAIL && !user?.emailVerified)
    return { ok: false, reason: 'unverified' };
  return { ok: true };
}

/** Construye el record completo de una marcación */
function buildAttendanceRecord(payload, horaReal, uid) {
  const id = buildMarcacionId(payload.ID_Trabajador, payload.Fecha, payload.Tipo_Marcacion);
  return {
    ID_Marcacion:      id,
    ID_Registro:       id,
    ID_Trabajador:     payload.ID_Trabajador,
    Nombre_Trabajador: payload.Nombre_Trabajador,
    Fecha:             payload.Fecha,
    Tipo_Marcacion:    payload.Tipo_Marcacion,
    Hora_Programada:   '',
    Hora_Real:         horaReal,
    Estado_Marcacion:  'A Tiempo',
    Metodo_Registro:   payload.Metodo_Registro || 'Escaneo_QR',
    Horas_Extra:       0,
    Ubicacion_Obra:    payload.Ubicacion_Obra || '',
    Timestamp:         Date.now(),
    GPS_Latitud:       payload.GPS_Latitud  ?? null,
    GPS_Longitud:      payload.GPS_Longitud ?? null,
    GPS_Accuracy:      payload.GPS_Accuracy ?? null,
  };
}

/** Construye la ruta SaaS correcta de asistencias */
function buildAsistenciasPath(uid, docId) {
  return `users/${uid}/asistencias/${docId}`;
}

/** Construye la ruta SaaS correcta de personal */
function buildPersonalPath(uid) {
  return `users/${uid}/personal`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Parseo de QR
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — parseQRData', () => {
  test('QR JSON {id, dpi} es parseado correctamente', () => {
    const r = parseQRData(JSON.stringify({ id: 'TRAB-007', dpi: '2507931520101' }));
    expect(r).not.toBeNull();
    expect(r.id).toBe('TRAB-007');
    expect(r.dpi).toBe('2507931520101');
  });

  test('QR con solo id alfanumérico puro es aceptado', () => {
    const r = parseQRData('TRAB-007');
    expect(r).not.toBeNull();
    expect(r.id).toBe('TRAB-007');
  });

  test('ID de 4 chars (< 5) NO es aceptado como plain text', () => {
    const r = parseQRData('TRAB');
    expect(r).toBeNull();
  });

  test('texto aleatorio con espacios/especiales no es válido', () => {
    expect(parseQRData('hola mundo!!')).toBeNull();
    expect(parseQRData('no sirve')).toBeNull();
  });

  test('QR vacío → null', () => {
    expect(parseQRData('')).toBeNull();
    expect(parseQRData(null)).toBeNull();
  });

  test('JSON sin campo id → null', () => {
    expect(parseQRData(JSON.stringify({ nombre: 'algo' }))).toBeNull();
  });

  test('DPI como único campo de QR NO es válido (requiere id)', () => {
    const r = parseQRData(JSON.stringify({ dpi: '1234567890101' }));
    expect(r).toBeNull(); // no tiene `id`
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Validación de sesión
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — validateSession', () => {
  test('usuario válido en modo abierto → ok', () => {
    const r = validateSession({ email: 'op@obra.com', emailVerified: true });
    expect(r.ok).toBe(true);
  });

  test('null → unauthorized', () => {
    const r = validateSession(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  test('sin email → unauthorized', () => {
    expect(validateSession({ emailVerified: true }).ok).toBe(false);
  });

  test('email sin @ → unauthorized', () => {
    expect(validateSession({ email: 'noemail', emailVerified: true }).ok).toBe(false);
  });

  test('modo estricto: correo no verificado → unverified', () => {
    const r = validateSession({ email: 'op@obra.com', emailVerified: false }, [], true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unverified');
  });

  test('modo abierto: correo no verificado → ok igual', () => {
    const r = validateSession({ email: 'op@obra.com', emailVerified: false }, [], false);
    expect(r.ok).toBe(true);
  });

  test('lista de emails: email autorizado → ok', () => {
    const r = validateSession(
      { email: 'operador@empresa.com', emailVerified: true },
      ['operador@empresa.com'],
    );
    expect(r.ok).toBe(true);
  });

  test('lista de emails: email NO autorizado → unauthorized', () => {
    const r = validateSession(
      { email: 'otro@empresa.com', emailVerified: true },
      ['operador@empresa.com'],
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  test('comparación de email es case-insensitive', () => {
    const r = validateSession(
      { email: 'OPERADOR@EMPRESA.COM', emailVerified: true },
      ['operador@empresa.com'],
    );
    expect(r.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Mensajes de error de Auth
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — traducirErrorAuth', () => {
  test('user-not-found → mensaje de cuenta inexistente', () => {
    const m = traducirErrorAuth('auth/user-not-found');
    expect(m).toMatch(/cuenta|correo/i);
  });

  test('wrong-password → mensaje de credenciales incorrectas', () => {
    expect(traducirErrorAuth('auth/wrong-password')).toMatch(/contraseña|credencial/i);
  });

  test('invalid-credential → mensaje de credenciales incorrectas', () => {
    expect(traducirErrorAuth('auth/invalid-credential')).toMatch(/contraseña|credencial/i);
  });

  test('too-many-requests → mensaje de bloqueo temporal', () => {
    expect(traducirErrorAuth('auth/too-many-requests')).toMatch(/bloqueada|intentos/i);
  });

  test('user-disabled → mensaje de cuenta desactivada', () => {
    expect(traducirErrorAuth('auth/user-disabled')).toMatch(/desactivada|administrador/i);
  });

  test('network-request-failed → mensaje de red', () => {
    expect(traducirErrorAuth('auth/network-request-failed')).toMatch(/conexión|red/i);
  });

  test('error desconocido → mensaje genérico (no vacío)', () => {
    const m = traducirErrorAuth('auth/unknown-error');
    expect(typeof m).toBe('string');
    expect(m.length).toBeGreaterThan(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Mensajes de error de marcación (Firestore)
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — mensajeErrorMarcacion', () => {
  test('permission-denied → menciona permiso/sesión', () => {
    expect(mensajeErrorMarcacion({ code: 'firestore/permission-denied' }))
      .toMatch(/permiso|sesión|verificado/i);
  });

  test('unavailable → menciona conexión', () => {
    expect(mensajeErrorMarcacion({ code: 'firestore/unavailable' }))
      .toMatch(/conexión|enviar/i);
  });

  test('network-request-failed → menciona conexión', () => {
    expect(mensajeErrorMarcacion({ code: 'network-request-failed' }))
      .toMatch(/conexión|enviar/i);
  });

  test('failed-precondition → menciona recarga', () => {
    expect(mensajeErrorMarcacion({ code: 'failed-precondition' }))
      .toMatch(/datos|recarga/i);
  });

  test('código desconocido → string no vacío', () => {
    const m = mensajeErrorMarcacion({ code: 'unknown' });
    expect(m.length).toBeGreaterThan(0);
  });

  test('null → string no vacío', () => {
    const m = mensajeErrorMarcacion(null);
    expect(m.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: ID de marcación — idempotencia y formato
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — buildMarcacionId', () => {
  test('ID es determinista — mismo input = mismo output', () => {
    const id1 = buildMarcacionId('TRAB-001', '2026-10-09', 'Entrada');
    const id2 = buildMarcacionId('TRAB-001', '2026-10-09', 'Entrada');
    expect(id1).toBe(id2);
  });

  test('ID no contiene caracteres inválidos', () => {
    const id = buildMarcacionId('TRAB-001', '2026-10-09', 'Salida_Receso');
    expect(/[^A-Za-z0-9_-]/.test(id)).toBe(false);
  });

  test('caracteres especiales son sanitizados a guión bajo', () => {
    const id = buildMarcacionId('TRAB#001', '2026.10.09', 'Entrada');
    expect(id).toBe('TRAB_001_2026_10_09_Entrada');
  });

  test('IDs de distinto tipo de marcación son diferentes', () => {
    const base = ['Entrada', 'Salida_Receso', 'Regreso_Receso', 'Salida_Obra'];
    const ids = base.map((t) => buildMarcacionId('TRAB-001', '2026-10-09', t));
    const unique = new Set(ids);
    expect(unique.size).toBe(4);
  });

  test('tamaño del ID es <= 50 chars para datos normales', () => {
    const id = buildMarcacionId('TRAB-001', '2026-10-09', 'Salida_Receso');
    expect(id.length).toBeLessThanOrEqual(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Rutas SaaS correctas
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — rutas SaaS users/{uid}/colección', () => {
  const uid = 'JTuDWJLkmdQrPlcxsUWQqXH7d263';

  test('ruta de asistencias incluye users/{uid}/asistencias/', () => {
    const path = buildAsistenciasPath(uid, 'TRAB-001_2026-10-09_Entrada');
    expect(path).toBe(`users/${uid}/asistencias/TRAB-001_2026-10-09_Entrada`);
    expect(path).toMatch(/^users\/[^/]+\/asistencias\//);
  });

  test('ruta de personal incluye users/{uid}/personal', () => {
    const p = buildPersonalPath(uid);
    expect(p).toBe(`users/${uid}/personal`);
    expect(p).toMatch(/^users\/[^/]+\/personal$/);
  });

  test('rutas NO usan colecciones raíz /personal/ o /asistencias/', () => {
    const asistPath = buildAsistenciasPath(uid, 'test');
    const persoPath = buildPersonalPath(uid);
    expect(asistPath.startsWith('asistencias/')).toBe(false);
    expect(persoPath.startsWith('personal')).toBe(false);
  });

  test('ruta no tiene dobles barras', () => {
    expect(buildAsistenciasPath(uid, 'test')).not.toContain('//');
    expect(buildPersonalPath(uid)).not.toContain('//');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: Record de asistencia — campos requeridos por firestore.rules
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — buildAttendanceRecord (isValidAttendanceData)', () => {
  const REQUIRED_FIELDS = [
    'ID_Marcacion', 'ID_Registro', 'ID_Trabajador', 'Nombre_Trabajador',
    'Fecha', 'Tipo_Marcacion', 'Hora_Real', 'Estado_Marcacion', 'Timestamp',
  ];
  const VALID_TIPOS  = ['Entrada', 'Salida_Receso', 'Regreso_Receso', 'Salida_Obra', 'Entrada_Extra'];
  const VALID_ESTADOS = ['A Tiempo', 'Puntual', 'Tolerancia', 'Atraso', 'Ausencia'];

  const samplePayload = {
    ID_Trabajador: 'TRAB-001', Nombre_Trabajador: 'Juan Lopez',
    Fecha: '2026-10-09', Tipo_Marcacion: 'Entrada',
    Metodo_Registro: 'Escaneo_QR', Ubicacion_Obra: '',
  };

  test('contiene todos los campos requeridos por las reglas', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    REQUIRED_FIELDS.forEach((f) => {
      expect(r).toHaveProperty(f);
    });
  });

  test('Tipo_Marcacion es un valor válido', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(VALID_TIPOS).toContain(r.Tipo_Marcacion);
  });

  test('Estado_Marcacion es un valor válido', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(VALID_ESTADOS).toContain(r.Estado_Marcacion);
  });

  test('Fecha tiene formato YYYY-MM-DD exacto (10 chars)', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(r.Fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.Fecha.length).toBe(10);
  });

  test('Hora_Real tiene formato HH:MM (5 chars)', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(r.Hora_Real).toMatch(/^\d{2}:\d{2}$/);
  });

  test('Timestamp es número positivo > 0', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(typeof r.Timestamp).toBe('number');
    expect(r.Timestamp).toBeGreaterThan(0);
  });

  test('GPS_Latitud/Longitud/Accuracy son null cuando no se pasan', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(r.GPS_Latitud).toBeNull();
    expect(r.GPS_Longitud).toBeNull();
    expect(r.GPS_Accuracy).toBeNull();
  });

  test('GPS fields son números cuando se incluyen', () => {
    const r = buildAttendanceRecord(
      { ...samplePayload, GPS_Latitud: 14.6349, GPS_Longitud: -90.5069, GPS_Accuracy: 12.5 },
      '07:05', 'uid-test',
    );
    expect(typeof r.GPS_Latitud).toBe('number');
    expect(typeof r.GPS_Longitud).toBe('number');
    expect(typeof r.GPS_Accuracy).toBe('number');
  });

  test('Horas_Extra es número 0 por defecto', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(typeof r.Horas_Extra).toBe('number');
    expect(r.Horas_Extra).toBe(0);
  });

  test('ID_Marcacion tiene 1-50 chars', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(r.ID_Marcacion.length).toBeGreaterThanOrEqual(1);
    expect(r.ID_Marcacion.length).toBeLessThanOrEqual(50);
  });

  test('keys().size() <= 25 (límite de las reglas)', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(Object.keys(r).length).toBeLessThanOrEqual(25);
  });

  test('Nombre_Trabajador >= 2 chars', () => {
    const r = buildAttendanceRecord(samplePayload, '07:05', 'uid-test');
    expect(r.Nombre_Trabajador.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: Verificación del HTML de producción
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner.html — contenido de producción', () => {
  const html = fs.readFileSync(path.join(ROOT, 'field-scanner.html'), 'utf8');

  test('og:url apunta a la URL de producción correcta', () => {
    expect(html).toContain('https://controlasistenciaapp.vercel.app/field-scanner.html');
  });

  test('og:url NO contiene URLs de preview antiguas', () => {
    expect(html).not.toMatch(/evexmkwgu|proyectoswm|osdcx8dn8/);
  });

  test('carga Firebase Auth compat desde /vendor/', () => {
    expect(html).toContain('/vendor/firebase/firebase-app-compat.js');
    expect(html).toContain('/vendor/firebase/firebase-auth-compat.js');
    expect(html).toContain('/vendor/firebase/firebase-firestore-compat.js');
  });

  test('field-scanner.js se carga DESPUÉS del SDK de Firebase', () => {
    const sdkPos = html.lastIndexOf('firebase-firestore-compat.js');
    const fsPos  = html.lastIndexOf('field-scanner.js');
    expect(fsPos).toBeGreaterThan(sdkPos);
  });

  test('contiene el formulario de login con los campos necesarios', () => {
    expect(html).toContain('id="login-email"');
    expect(html).toContain('id="login-password"');
    expect(html).toContain('id="btn-login"');
    expect(html).toContain('id="login-form"');
  });

  test('contiene el app de escáner (post-login)', () => {
    expect(html).toContain('id="app"');
    expect(html).toContain('id="campo-qr-reader"');
    expect(html).toContain('id="campo-btn-scan"');
    expect(html).toContain('id="campo-mark-grid"');
  });

  test('contiene botón de logout', () => {
    expect(html).toContain('id="logout-btn"');
  });

  test('tiene el manifest de PWA apuntando al correcto', () => {
    expect(html).toContain('/field-scanner-manifest.json');
  });

  test('tiene CSP definida', () => {
    expect(html).toContain('Content-Security-Policy');
  });

  test('registra el service worker del escáner', () => {
    expect(html).toContain('field-scanner-sw.js');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: field-scanner.js — verificación de código fuente
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner.js — verificación de código fuente (rutas SaaS)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'field-scanner.js'), 'utf8');

  test('_enviarMarcacionFirestore usa users/{uid}/asistencias', () => {
    // Verificar que las referencias SaaS existen en el archivo fuente
    expect(src).toContain("collection('users').doc(user.uid)");
    expect(src).toContain("collection('asistencias').doc(id)");
    // Verificar que el comentario de modelo SaaS está presente
    expect(src).toContain('MODELO SAAS: escribir en users/{userId}/asistencias');
  });

  test('_buscarTrabajadorFirestore usa users/{uid}/personal', () => {
    expect(src).toContain("collection('users').doc(user.uid).collection('personal')");
  });

  test('_subscribeRealtime usa users/{uid}/asistencias', () => {
    expect(src).toContain('MODELO SAAS: escuchar en users/{userId}/asistencias');
    expect(src).toContain("collection('asistencias')");
  });

  test('NO usa la colección raíz /asistencias/ para escrituras', () => {
    // La escritura principal no debe ser .collection('asistencias') directamente
    // (sólo está permitido dentro de users/{uid}/)
    const enviarSection = src.match(/_enviarMarcacionFirestore[\s\S]{0,1000}/)?.[0] || '';
    expect(enviarSection).not.toMatch(/^[^/]*\.collection\('asistencias'\)/m);
  });

  test('incluye GPS_Latitud/Longitud/Accuracy en el record con fallback null', () => {
    expect(src).toContain('GPS_Latitud:');
    expect(src).toContain('GPS_Longitud:');
    expect(src).toContain('GPS_Accuracy:');
    expect(src).toContain('?? null');
  });

  test('verifica que el usuario está autenticado antes de escribir', () => {
    expect(src).toContain("_auth?.currentUser");
    expect(src).toContain('Sin sesión activa');
  });

  test('usa transacción para idempotencia (evita duplicados)', () => {
    expect(src).toContain('runTransaction');
    expect(src).toContain('snap.exists');
  });

  test('guarda log de auditoría en localStorage', () => {
    expect(src).toContain('_saveAuditLog');
    expect(src).toContain('field_scanner_audit_log');
  });

  test('expone FieldScanner en window con API pública', () => {
    expect(src).toContain('window.FieldScanner');
    expect(src).toContain('simulateScan');
    expect(src).toContain('__validateSession');
    expect(src).toContain('__testSetDb');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 10: DPI y normalización
// ─────────────────────────────────────────────────────────────────────────────
describe('field-scanner — normalizeDpi', () => {
  test('DPI con espacios es normalizado', () => {
    expect(normalizeDpi('2507 9315 20101')).toBe('2507931520101');
  });

  test('DPI con guiones es normalizado', () => {
    expect(normalizeDpi('2507-9315-20101')).toBe('2507931520101');
  });

  test('DPI ya limpio permanece igual', () => {
    expect(normalizeDpi('2507931520101')).toBe('2507931520101');
  });

  test('DPI vacío → string vacío', () => {
    expect(normalizeDpi('')).toBe('');
    expect(normalizeDpi(null)).toBe('');
  });

  test('DPI normalizado tiene 13 dígitos', () => {
    const dpi = normalizeDpi('2507 9315 20101');
    expect(dpi.length).toBe(13);
    expect(/^\d+$/.test(dpi)).toBe(true);
  });
});
