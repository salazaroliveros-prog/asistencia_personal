const fs = require('fs');
const path = require('path');

/**
 * Guardas de regresión sobre `firestore.rules`.
 *
 * Estos fallos NO rompen el despliegue: las reglas compilan y el problema sólo
 * aparece en tiempo de ejecución como `permission-denied` genérico, que es muy
 * difícil de diagnosticar desde la app. De ahí que se verifiquen aquí.
 */
describe('firestore.rules — guardas de regresión', () => {
  const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

  it('usa .size() y no .length para medir strings', () => {
    // `.length` no existe en el lenguaje de reglas: su lectura provoca un error
    // de evaluación que Firestore devuelve como `permission-denied`. Bloqueaba
    // silenciosamente TODAS las escrituras que usan isValidString (personal,
    // asistencias, logs…). Los comentarios sí pueden mencionarlo.
    const conLength = rules
      .split(/\r?\n/)
      .map((linea, i) => ({ n: i + 1, texto: linea.trim() }))
      .filter(({ texto }) => !texto.startsWith('//') && texto.includes('.length'));

    expect(conLength.map(({ n, texto }) => `${n}: ${texto}`)).toEqual([]);
  });

  it('no deja una comprobación de lista vacía que siempre sería falsa', () => {
    // `request.auth.token.email in []` es SIEMPRE false con la lista vacía, así
    // que bloqueaba todas las marcaciones. Las líneas comentadas sí se permiten
    // (sirven de plantilla para el modo restringido).
    const activas = rules
      .split(/\r?\n/)
      .map((linea, i) => ({ n: i + 1, texto: linea.trim() }))
      .filter(({ texto }) => !texto.startsWith('//') && /in\s*\[\s*\]/.test(texto));

    expect(activas.map(({ n, texto }) => `${n}: ${texto}`)).toEqual([]);
  });

  it('isAuthenticated verifica que el usuario esté autenticado', () => {
    const bloque = rules.slice(rules.indexOf('function isAuthenticated'));
    const cuerpo = bloque.slice(0, bloque.indexOf('}\n'));

    expect(cuerpo).toContain('return request.auth != null');
  });

  it('isOwner verifica que el usuario sea el dueño del recurso', () => {
    const bloque = rules.slice(rules.indexOf('function isOwner'));
    const cuerpo = bloque.slice(0, bloque.indexOf('}\n'));

    expect(cuerpo).toContain('request.auth.uid == userId');
  });

  it('mantiene las validaciones de datos de las colecciones críticas', () => {
    expect(rules).toContain('function isValidWorkerData(data)');
    expect(rules).toContain('function isValidAttendanceData(data)');
    expect(rules).toContain('isValidString(data.ID_Marcacion, 1, 50)');
    expect(rules).toContain('isValidString(data.Fecha, 10, 10)');
  });

  it('exige autenticación y propiedad para leer las colecciones de trabajo', () => {
    const personal = rules.slice(rules.indexOf('match /personal/'));
    expect(personal.slice(0, 200)).toContain('allow read: if isOwner(userId)');
  });
});
