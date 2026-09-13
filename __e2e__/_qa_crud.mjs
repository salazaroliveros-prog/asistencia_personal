// QA CRUD AUTOMÁTICO — controlasistenciaapp.vercel.app (colección efímera)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output');
mkdirSync(OUT, { recursive: true });
const TS = () => new Date().toISOString().replace(/[:.]/g, '-');
const COL = 'test_qa_crud_' + TS();
const APP = 'https://controlasistenciaapp.vercel.app';

const log = (m) => console.log('[' + TS().slice(11, 19) + ']', m);
const shot = (page, n) => page.screenshot({ path: join(OUT, n + '-' + TS() + '.png'), fullPage: false, timeout: 15000 }).catch(() => {});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const errors = [];
const cons = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') cons.push(m.text()); if (/conect/i.test(m.text())) log('CONSOLE: ' + m.text()); });
page.on('dialog', async d => { log('DIALOG: ' + d.message()); await d.dismiss(); });

let result = { pasos: [], col: COL };
try {
  log('HOME: ' + APP);
  await page.goto(APP, { waitUntil: 'networkidle' });
  await shot(page, '00-home');

  log('2) Abro Ajustes');
  await page.evaluate(() => {
    const enlaces = Array.from(document.querySelectorAll('[data-page="ajustes"], a[data-page="ajustes"]'));
    enlaces.forEach(e => e.click());
  });
  await page.waitForTimeout(800);

  log('3) Busco formulario CRUD');
  const hasForm = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    let ti = false;
    inputs.forEach(i => { if (i.placeholder && /nombre|valor|descripcion/i.test(i.placeholder)) ti = true; });
    const btns = Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').toLowerCase());
    const tb = ['guardar', 'crear', 'editar', 'eliminar', 'actualizar'].some(t => btns.some(b => b.includes(t)));
    return ti || tb || !!document.querySelector('form');
  });
  log('Formulario/botones detectados: ' + hasForm);
  await shot(page, '01-ajustes');

    log('4) CRUD real contra Firestore (inspecto globales Firebase de la app)');
  const inspect = await page.evaluate(() => {
    const w = window;
    return {
      firebaseExists: !!w.firebase,
      apps: w.firebase?.apps?.length || 0,
      hasConfig: !!(w.FIREBASE_CONFIG || w.firebaseConfig || w.__firebase_config),
      configKeys: w.FIREBASE_CONFIG ? Object.keys(w.FIREBASE_CONFIG) : (w.firebaseConfig ? Object.keys(w.firebaseConfig) : []),
      hasGetFirestore: typeof w.firebase?.firestore === 'function' || typeof w.firebase?.getFirestore === 'function',
    };
  });
  log('Inspect: ' + JSON.stringify(inspect));
  await shot(page, '01-firebase-inspect');

  result = await page.evaluate(async (COL) => {
    const res = { pasos: [] };
    try {
      // Si la app ya inicializó Firebase (window.firebase con apps), reutilizo la instancia.
      // NOTA: en SDK v10-compat, window.firebase.firestore() retorna el servicio Firestore
      // con la API de colecciones (legacy v8). Es la forma más fiable de reusar la app existente.
      if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.firestore === 'function') {
        const db = window.firebase.firestore();       // servicio Firestore reutilizado
        if (!db) { res.error = 'firebase.firestore() retornó null'; return res; }
        const f = window.firebase.firestore;
        const d = db.collection('test_qa_crud').doc(COL);
        await f.setDoc ? null : null;                  // sanity
        await d.set({ nombre: 'TestQA', valor: 1, creado: new Date().toISOString() });
        res.pasos.push('CREADO/' + COL);
        const snap = await d.get();
        res.pasos.push('LEIDO=' + JSON.stringify(snap.data()));
        await d.update({ valor: 2 });
        res.pasos.push('MODIFICADO valor=2');
        await d.delete();
        res.pasos.push('ELIMINADO');
        res.connected = true;
      } else {
        // Importo SDK compat y uso la config de window FIREBASE_CONFIG
        const appMod = (await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'));
        const fsMod = (await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'));
        const cfg = window.FIREBASE_CONFIG || window.firebaseConfig;
        const app = appMod.initializeApp(cfg);
        const db = fsMod.getFirestore(app);
        const d = fsMod.doc(db, 'test_qa_crud', COL);
        await fsMod.setDoc(d, { nombre: 'TestQA', valor: 1, creado: new Date().toISOString() });
        res.pasos.push('CREADO/' + COL);
        const snap = await fsMod.getDoc(d);
        res.pasos.push('LEIDO=' + JSON.stringify(snap.data()));
        await fsMod.updateDoc(d, { valor: 2 });
        res.pasos.push('MODIFICADO valor=2');
        await fsMod.deleteDoc(d);
        res.pasos.push('ELIMINADO');
        res.connected = true;
      }
    } catch (e) {
      res.error = typeof e === 'object' && e ? (e.message || String(e)) : String(e);
      res.stack = typeof e !== 'object' || !e || !e.stack ? null : String(e.stack).split(String.fromCharCode(10)).slice(0, 2).join(' | ');
    }
    return res;
  }, COL);

  log('Resultado: ' + JSON.stringify(result));
  await shot(page, '02-crud');
  log('=== SUMMARY ===');
  log('Colección: ' + COL);
  log('Pasos: ' + (result.pasos || []).join(' -> '));
  log('Error: ' + (result.error || 'Ninguno'));
  log('Console errors: ' + cons.length + ' | Page errors: ' + errors.length);
  if (cons.length) log('Cons errs: ' + JSON.stringify(cons));
  writeFileSync(join(OUT, 'qa-crud-result.json'), JSON.stringify({ col: COL, result, cons, errors }, null, 2));
} catch (e) {
  log('FATAL: ' + e.message);
  writeFileSync(join(OUT, 'qa-crud-result.json'), JSON.stringify({ col: COL, fatal: e.message, cons, errors }, null, 2));
} finally {
  await browser.close();
  process.exit(0);
}
