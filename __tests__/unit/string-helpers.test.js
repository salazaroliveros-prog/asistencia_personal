/**
 * Control Personal Campo — String helpers tests
 */

const StringHelpers = (() => {
  try {
    const script = document.querySelector('script[src="js/utils/string-helpers.js"]');
    if (script) {
      const module = {};
      // Load the script inline for testing
      const fs = require('fs');
      const path = require('path');
      const code = fs.readFileSync(path.join(__dirname, 'js/utils/string-helpers.js'), 'utf8');
      const vm = require('vm');
      const ctx = vm.createContext({ window: {}, console, document: { getElementById: () => null } });
      vm.runInContext(code, ctx);
      return ctx.window?.CPC?.StringHelpers || {};
    }
  } catch (e) {
    console.warn('StringHelpers not available:', e.message);
  }
  return {};
})();

describe('StringHelpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="el"></div>
    `;
  });

  it('escapes HTML entities', () => {
    const result = StringHelpers.escHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('handles null/undefined', () => {
    expect(StringHelpers.escHtml(null)).toBe('');
    expect(StringHelpers.escHtml(undefined)).toBe('');
    expect(StringHelpers.escHtml('')).toBe('');
  });

  it('formats Guatemalan phone numbers', () => {
    expect(StringHelpers.formatTelefono('55123456')).toBe('+502 5512-3456');
    expect(StringHelpers.formatTelefono('+502 5512-3456')).toBe('+502 5512-3456');
    expect(StringHelpers.formatTelefono('')).toBe('');
  });

  it('creates debounced functions', () => {
    const fn = jest.fn();
    const debounced = StringHelpers.debounce(fn, 50);
    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  it('generates local IDs with prefix', () => {
    const id = StringHelpers.generateLocalId('TRAB', 8);
    expect(id).toMatch(/^TRAB-[A-Z0-9]{8}$/);
  });
});
