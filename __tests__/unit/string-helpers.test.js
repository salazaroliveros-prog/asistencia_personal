/**
 * Control Personal Campo — String helpers tests
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Cargar el módulo en un contexto con window simulado
const code = fs.readFileSync(
  path.resolve(__dirname, '../../js/utils/string-helpers.js'),
  'utf8'
);
const ctx = vm.createContext({
  window: {},
  console,
  document: { getElementById: () => null },
  setTimeout,
  clearTimeout,
});
vm.runInContext(code, ctx);
const StringHelpers = ctx.window?.CPC?.StringHelpers || {};

describe('StringHelpers', () => {
  it('escapes HTML entities', () => {
    const result = StringHelpers.escHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('handles null/undefined/empty', () => {
    expect(StringHelpers.escHtml(null)).toBe('');
    expect(StringHelpers.escHtml(undefined)).toBe('');
    expect(StringHelpers.escHtml('')).toBe('');
  });

  it('formats Guatemalan phone numbers (8 digits)', () => {
    expect(StringHelpers.formatTelefono('55123456')).toBe('+502 5512-3456');
  });

  it('returns empty string for empty phone', () => {
    expect(StringHelpers.formatTelefono('')).toBe('');
  });

  it('creates debounced functions', (done) => {
    let callCount = 0;
    const fn = () => callCount++;
    const debounced = StringHelpers.debounce(fn, 50);
    debounced();
    debounced();
    debounced();
    expect(callCount).toBe(0);
    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 100);
  });

  it('generates local IDs with prefix', () => {
    const id = StringHelpers.generateLocalId('TRAB', 8);
    expect(id).toMatch(/^TRAB-[A-Z0-9]{8}$/);
  });
});
