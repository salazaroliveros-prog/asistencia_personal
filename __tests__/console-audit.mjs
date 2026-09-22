/**
 * Auditoría de consola del navegador (Chrome/Chromium via Playwright).
 * Fallará si hay console.error o console.warn (excepto allowlist explícita).
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3801';
const PAGES = [
  '/',
  '/field-scanner.html',
  '/pwa/scanner.html',
];

/** Warnings conocidos que aún no se pueden eliminar sin cambiar de SDK modular. */
const ALLOWED_WARN_PATTERNS = [
  // Vacío a propósito: queremos 0 warnings.
];

function isAllowed(type, text) {
  if (type !== 'warning') return false;
  return ALLOWED_WARN_PATTERNS.some((re) => re.test(text));
}

async function auditPage(browser, path) {
  const page = await browser.newPage();
  const messages = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      messages.push({ type, text, url: path });
    }
  });

  page.on('pageerror', (err) => {
    messages.push({ type: 'error', text: `pageerror: ${err.message}`, url: path });
  });

  const response = await page.goto(`${BASE}${path}`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });

  // Dar tiempo a listeners async (Firebase auth/persistence)
  await page.waitForTimeout(2500);

  const status = response ? response.status() : 0;
  await page.close();
  return { path, status, messages };
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() =>
    chromium.launch(),
  );

  const results = [];
  for (const path of PAGES) {
    results.push(await auditPage(browser, path));
  }
  await browser.close();

  const bad = [];
  for (const r of results) {
    console.log(`\n── ${r.path} (HTTP ${r.status}) ──`);
    if (r.messages.length === 0) {
      console.log('  ✓ sin errores ni warnings de consola');
    }
    for (const m of r.messages) {
      const allowed = isAllowed(m.type, m.text);
      console.log(`  ${allowed ? '↷ allow' : '✗'} [${m.type}] ${m.text.slice(0, 200)}`);
      if (!allowed) bad.push(m);
    }
  }

  console.log('\n════════════════════════════');
  if (bad.length) {
    console.log(`FAIL: ${bad.length} mensaje(s) de consola no permitidos`);
    process.exit(1);
  }
  console.log('PASS: 0 errores / 0 warnings en consola');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
