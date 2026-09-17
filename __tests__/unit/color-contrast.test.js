/**
 * Control Personal Campo — Verificación de contraste WCAG AA
 * @jest-environment node
 *
 * Lee los tokens reales de css/main.css, css/components.css y css/campo.css y
 * comprueba los pares texto/fondo que la auditoría identificó como críticos:
 *  - avisos toast (superficie oscura en ambos temas)
 *  - texto sobre los acentos de la paleta (botones de marcación)
 *  - acentos usados como texto en tema oscuro y en tema claro
 *  - texto principal y atenuado sobre el degradado de fondo
 *
 * Si alguien cambia un token y baja de 4.5:1, este test falla.
 */

const fs = require('fs');
const path = require('path');

const CSS_DIR = path.resolve(__dirname, '../../css');
const read = (f) => fs.readFileSync(path.join(CSS_DIR, f), 'utf8');

/** Extrae TODOS los bloques `selector { ... }` (puede haber varios iguales). */
function blocks(css, selector) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(selector + ' {', from);
    if (start === -1) break;
    const i = css.indexOf('{', start);
    let depth = 0, end = -1;
    for (let j = i; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end === -1) break;
    out.push(css.slice(i + 1, end).replace(/\/\*[\s\S]*?\*\//g, ''));
    from = end + 1;
  }
  if (!out.length) throw new Error(`No se encontró el bloque ${selector}`);
  return out;
}

/** Recoge los tokens `--x: valor;` de un bloque. */
function tokens(text) {
  const map = {};
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    map[m[1]] = m[2].trim();
  }
  return map;
}

/** Resuelve `var(--x)` (anidado) dentro de un contexto de tokens. */
function resolve(value, ctx) {
  let out = value, guard = 0;
  while (/var\(/.test(out) && guard++ < 10) {
    out = out.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]*))?\)/gi,
      (_m, name, fallback) => (ctx[name] !== undefined ? ctx[name] : (fallback || '')));
  }
  return out.trim();
}

/** #rrggbb / #rgb / rgba(r,g,b,a) → [r, g, b, a]. */
function parseColor(value, ctx) {
  const v = resolve(value, ctx).toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const rgba = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgba) {
    return [
      Number(rgba[1]), Number(rgba[2]), Number(rgba[3]),
      rgba[4] === undefined ? 1 : Number(rgba[4]),
    ];
  }
  throw new Error(`Color no reconocido: ${value}`);
}

/** Compone un color semitransparente sobre un fondo opaco. */
function over(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
}

/** Luminancia relativa WCAG 2.x. */
function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXTO = 4.5;
const AA_NO_TEXTO = 3;

// Contextos de tokens por tema, tal como los resuelve el navegador.
// main.css declara [data-theme="light"] en más de un bloque (uno heredado del
// diseño antiguo y el remapeo de tokens de vidrio): se fusionan todos.
const mergeTokens = (css, selector) =>
  Object.assign({}, ...blocks(css, selector).map(tokens));

const mainCss = read('main.css');
const baseTokens = mergeTokens(mainCss, ':root');
const lightTokens = mergeTokens(mainCss, '[data-theme="light"]');
const toastTokens = tokens(blocks(read('components.css'), '.toast')[0]);

const DARK_CTX = { ...baseTokens };
const LIGHT_CTX = { ...baseTokens, ...lightTokens };

// Fondos de referencia reales del sistema
const DARK_BG = parseColor('#0A1628', DARK_CTX);      // stop más oscuro del degradado
const LIGHT_BG = parseColor('#cfe3f4', LIGHT_CTX);    // stop más oscuro del degradado claro

describe('Contraste WCAG AA de los tokens', () => {
  it('el aviso toast mantiene su texto legible en ambos temas', () => {
    for (const [ctx, fondoBase] of [[DARK_CTX, DARK_BG], [LIGHT_CTX, LIGHT_BG]]) {
      const fondo = over(parseColor(toastTokens['--toast-bg'], ctx), fondoBase);
      for (const t of ['--toast-title', '--toast-text', '--toast-icon-mute']) {
        const r = ratio(parseColor(toastTokens[t], ctx), fondo);
        expect(r).toBeGreaterThanOrEqual(AA_TEXTO);
      }
    }
  });

  it('el texto sobre los acentos supera 4.5:1 (botones de marcación)', () => {
    const pares = [
      ['--color-accent-green', '--color-on-accent-ink'],
      ['--color-accent-amber', '--color-on-accent-ink'],
      ['--color-accent-red',   '--color-on-accent-ink'],
      ['--color-primary',      '--color-on-accent'],
      ['--color-primary-dark', '--color-on-accent'],
    ];
    for (const [fondo, texto] of pares) {
      const r = ratio(parseColor(baseTokens[texto], DARK_CTX), parseColor(baseTokens[fondo], DARK_CTX));
      expect(r).toBeGreaterThanOrEqual(AA_TEXTO);
    }
  });

  it('los acentos como texto cumplen AA en tema oscuro', () => {
    for (const t of ['--color-text-success', '--color-text-warning', '--color-text-danger']) {
      expect(ratio(parseColor(DARK_CTX[t], DARK_CTX), DARK_BG)).toBeGreaterThanOrEqual(AA_TEXTO);
    }
  });

  it('los acentos como texto cumplen AA en tema claro', () => {
    for (const t of ['--color-text-success', '--color-text-warning', '--color-text-danger']) {
      expect(ratio(parseColor(LIGHT_CTX[t], LIGHT_CTX), LIGHT_BG)).toBeGreaterThanOrEqual(AA_TEXTO);
    }
  });

  it('el texto principal y el atenuado cumplen AA sobre el fondo', () => {
    expect(ratio(parseColor(DARK_CTX['--color-text-primary'], DARK_CTX), DARK_BG))
      .toBeGreaterThanOrEqual(AA_TEXTO);
    expect(ratio(parseColor(LIGHT_CTX['--color-text-primary'], LIGHT_CTX), LIGHT_BG))
      .toBeGreaterThanOrEqual(AA_TEXTO);

    // El atenuado es semitransparente: se compone sobre el fondo real
    expect(ratio(over(parseColor(DARK_CTX['--color-text-muted'], DARK_CTX), DARK_BG), DARK_BG))
      .toBeGreaterThanOrEqual(AA_TEXTO);
    expect(ratio(over(parseColor(LIGHT_CTX['--color-text-muted'], LIGHT_CTX), LIGHT_BG), LIGHT_BG))
      .toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('los iconos de tipo del toast superan el 3:1 de elementos no textuales', () => {
    const fondo = over(parseColor(toastTokens['--toast-bg'], DARK_CTX), DARK_BG);
    for (const t of ['--color-on-dark-success', '--color-on-dark-danger',
      '--color-on-dark-warning', '--color-secondary']) {
      expect(ratio(parseColor(DARK_CTX[t], DARK_CTX), fondo)).toBeGreaterThanOrEqual(AA_NO_TEXTO);
    }
  });

  it('no queda ningún token de color usado sin definir', () => {
    const definidos = new Set(Object.keys({ ...baseTokens, ...lightTokens, ...toastTokens }));
    const faltantes = [];
    for (const css of [mainCss, read('components.css'), read('campo.css'),
      read('campo-login.css'), read('campo-scanner.css')]) {
      const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of limpio.matchAll(/var\(\s*(--(?:color|toast)-[a-z0-9-]+)\s*(,)?/gi)) {
        if (!m[2] && !definidos.has(m[1])) faltantes.push(m[1]);
      }
    }
    expect([...new Set(faltantes)]).toEqual([]);
  });
});