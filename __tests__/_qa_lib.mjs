/** QA Funcional y UI/UX — CONTROL PERSONAL CAMPO (biblioteca). */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dir, '..');

const PORT = 3810;
export const BASE = 'http://localhost:' + PORT;

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript',
  '.mjs':'application/javascript', '.json':'application/json', '.png':'image/png',
  '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2',
  '.woff':'font/woff', '.ttf':'font/ttf', '.webp':'image/webp', '.gif':'image/gif', '.md':'text/plain',
};

export async function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const raw = decodeURIComponent((req.url || '/').split('?')[0]);
      const urlPath = raw === '/' ? '/index.html' : raw;
      let filePath = path.normalize(path.join(ROOT, urlPath));
      if (!filePath.startsWith(ROOT)) filePath = path.join(ROOT, 'index.html');
      let data;
      try { data = await readFile(filePath); }
      catch { filePath = path.join(ROOT, 'index.html'); data = await readFile(filePath); }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('ERR ' + e.message);
    }
  });
  await new Promise((ok) => server.listen(PORT, '127.0.0.1', () => ok()));
  return server;
}
// ── Helpers de reporte ───────────────────────────────────────────────────────
export const report = {
  inicio: new Date().toISOString(), fin: null, checks: 0, pass: 0, fail: 0, warn: 0,
  pasos: [],
};

let sectionRunning = null;

export function section(title) {
  sectionRunning = title;
  console.log('\n[SECCION] ' + title + ' ' + '-'.repeat(Math.max(0, 50 - title.length)));
  report.pasos.push({ categoria: 'section', descripcion: title });
}

export function check(cond, desc) {
  report.checks++;
  if (cond) { report.pass++; console.log('  [PASS] ' + desc); }
  else { report.fail++; console.log('  [FAIL] ' + desc); }
  report.pasos.push({ categoria: 'assert', estado: cond ? 'PASS' : 'FAIL', descripcion: desc, seccion: sectionRunning });
}

export function warn(desc) {
  report.warn++;
  console.log('  [WARN] ' + desc);
  report.pasos.push({ categoria: 'warn', estado: 'WARN', descripcion: desc, seccion: sectionRunning });
}

export function info(message) {
  console.log('  [INFO] ' + message);
}

export async function shot(page, dir, name) {
  try { await page.screenshot({ path: path.join(dir, name), fullPage: false }); }
  catch (e) { console.log('  [no screenshot] ' + name); }
}

export async function gotoPage(page, sec, waitMs = 650) {
  await page.evaluate((s) => { window.location.hash = '#' + s; }, sec);
  await page.waitForFunction((s) => {
    const el = document.getElementById('page-' + s);
    return el && el.classList.contains('active') && !el.hasAttribute('hidden');
  }, sec, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
}

// ── Detección de overflow horizontal / scroll de body / clip de texto ────────
export async function scanOverflow(page) {
  return page.evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const out = { bodyHScroll: document.documentElement.scrollWidth > vw + 2, elements: [] };
    const isScrollCont = (el) => {
      const cs = getComputedStyle(el);
      return /auto|scroll|overlay/.test(cs.overflowX) || /auto|scroll|overlay/.test(cs.overflow);
    };
    const insideScroll = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (isScrollCont(p)) return true;
        if (getComputedStyle(p).position === 'fixed') break;
      }
      return false;
    };
    const visible = [...document.querySelectorAll('body *, body')].filter((el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && !el.hidden && el.getClientRects().length > 0;
    });
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 2 && !insideScroll(el)) {
        const sel = el.id ? '#' + el.id
          : (el.getAttribute('data-page') ? '[data-page="' + el.getAttribute('data-page') + '"]'
          : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName));
        out.elements.push({ sel, right: Math.round(r.right), vw, w: Math.round(r.width) });
      }
    }
    out.elements = out.elements.slice(0, 25);
    return out;
  })()`);
}

export async function scanTextClip(page) {
  return page.evaluate(`(() => {
    const problems = [];
    const visible = [...document.querySelectorAll('body *')].filter((el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && !el.hidden && el.getClientRects().length > 0;
    });
    for (const el of visible) {
      if (el.querySelector('*')) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 10) continue;
      const cs = getComputedStyle(el);
      if (!(cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.whiteSpace === 'nowrap')) continue;
      const w = el.getBoundingClientRect().width;
      const approx = t.length * parseFloat(cs.fontSize) * 0.52;
      if (w > 0 && approx > w * 1.9) {
        problems.push({
          sel: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName),
          overflowPct: Math.round((approx / w) * 100),
          preview: t.slice(0, 28),
        });
      }
    }
    return problems.slice(0, 20);
  })()`);
}

// ── Persistencia de estado entre fases y emisión de resultados ───────────────
import fs from 'node:fs';

export const STATE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '_qa_state.json');

export async function saveState(page) {
  const data = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cpc_')) out[k] = localStorage.getItem(k);
    }
    return out;
  });
  fs.writeFileSync(STATE_FILE, JSON.stringify(data), 'utf8');
  return Object.keys(data).length;
}

export function stateInitScript() {
  let seed = '{}';
  if (fs.existsSync(STATE_FILE)) {
    try { seed = fs.readFileSync(STATE_FILE, 'utf8'); } catch {}
  }
  const safe = seed.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/'/g, "\\'");
  return `(() => {
    try {
      const data = JSON.parse(\`${safe}\`);
      for (const k of Object.keys(data)) localStorage.setItem(k, data[k]);
    } catch (e) { console.log('state-seed-error', e.message); }
  })();`;
}

export function emitResults(phase, resultsDir) {
  const data = {
    phase, checks: report.checks, pass: report.pass, fail: report.fail, warn: report.warn, pasos: report.pasos,
  };
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, phase + '.json'), JSON.stringify(data), 'utf8');
  console.log('\n[FASE] ' + phase + ' -> ✔' + report.pass + ' | ✖' + report.fail + ' | ⚠' + report.warn + ' | checks=' + report.checks);
}

export async function openApp(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 768 }, permissions: ['camera'] });
  if (opts.seed) await ctx.addInitScript(stateInitScript());
  const p = await ctx.newPage();
  // Bloquear CDN pesadas/no imprescindibles para estabilizar y acelerar la carga.
  await p.route(/fonts\.(googleapis|gstatic)\.com|\/leaflet\.(js|css)|html5-qrcode|unpkg\.com\/leaflet/, (r) => r.abort());
  let err = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 12000 });
      err = null;
      break;
    } catch (e) { err = e; await p.waitForTimeout(400); }
  }
  if (err) throw err;
  await p.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.hidden;
  }, { timeout: 15000 });
  await p.waitForTimeout(900);
  return { ctx, page: p };
}