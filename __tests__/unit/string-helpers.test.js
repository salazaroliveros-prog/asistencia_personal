/**
 * Control Personal Campo — String helpers tests
 * @jest-environment jsdom
 *
 * Tests actualizados para reflejar mejoras de validación y JSDoc en string-helpers.js v1.5.0
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
  describe('escHtml', () => {
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

    it('converts non-string inputs to string', () => {
      expect(StringHelpers.escHtml(123)).toBe('123');
      expect(StringHelpers.escHtml(true)).toBe('true');
    });
  });

  describe('formatTelefono', () => {
    it('formats Guatemalan phone numbers (8 digits)', () => {
      expect(StringHelpers.formatTelefono('55123456')).toBe('+502 5512-3456');
    });

    it('returns empty string for empty phone', () => {
      expect(StringHelpers.formatTelefono('')).toBe('');
    });

    it('handles non-digit characters', () => {
      expect(StringHelpers.formatTelefono('5512-3456')).toBe('+502 5512-3456');
      expect(StringHelpers.formatTelefono('(5512) 3456')).toBe('+502 5512-3456');
    });

    it('returns original for non-8-digit numbers', () => {
      expect(StringHelpers.formatTelefono('123456')).toBe('123456');
      expect(StringHelpers.formatTelefono('1234567890')).toBe('1234567890');
    });
  });

  describe('debounce', () => {
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

    it('passes arguments to debounced function', (done) => {
      let capturedArgs;
      const fn = (...args) => { capturedArgs = args; };
      const debounced = StringHelpers.debounce(fn, 50);
      debounced('arg1', 'arg2');
      setTimeout(() => {
        expect(capturedArgs).toEqual(['arg1', 'arg2']);
        done();
      }, 100);
    });
  });

  describe('generateLocalId', () => {
    it('generates local IDs with prefix', () => {
      const id = StringHelpers.generateLocalId('TRAB', 8);
      expect(id).toMatch(/^TRAB-[A-Z0-9]{8}$/);
    });

    it('uses default parameters when not provided', () => {
      const id = StringHelpers.generateLocalId();
      expect(id).toMatch(/^TRAB-[A-Z0-9]{8}$/);
    });

    it('generates unique IDs', () => {
      const id1 = StringHelpers.generateLocalId('TRAB', 8);
      const id2 = StringHelpers.generateLocalId('TRAB', 8);
      expect(id1).not.toBe(id2);
    });
  });

  describe('dateToStr', () => {
    it('converts date to YYYY-MM-DD format', () => {
      const date = new Date(2026, 8, 19); // Mes es 0-indexed: 8 = septiembre
      const result = StringHelpers.dateToStr(date);
      expect(result).toBe('2026-09-19');
    });

    it('handles invalid dates by using current date', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = StringHelpers.dateToStr('invalid');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[StringHelpers] dateToStr recibió fecha inválida, usando fecha actual');
      consoleWarnSpy.mockRestore();
    });

    it('handles null/undefined by using current date', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result1 = StringHelpers.dateToStr(null);
      const result2 = StringHelpers.dateToStr(undefined);
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result2).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      consoleWarnSpy.mockRestore();
    });

    it('valid dates return YYYY-MM-DD format with padding', () => {
      // Probar con varias fechas válidas para asegurar el padding funciona
      const dates = [
        new Date(2026, 0, 5),   // Enero 5
        new Date(2026, 8, 19),  // Septiembre 19
        new Date(2026, 11, 31), // Diciembre 31
      ];
      
      dates.forEach(date => {
        const result = StringHelpers.dateToStr(date);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const parts = result.split('-');
        expect(parts[1]).toHaveLength(2); // Mes debe tener 2 dígitos
        expect(parts[2]).toHaveLength(2); // Día debe tener 2 dígitos
      });
    });
  });
});
