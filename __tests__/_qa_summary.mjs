/** Consolida los resultados de QA en __tests__/results. */
import fs from 'node:fs';
const dir = '__tests__/results';
let t = 0, p = 0, f = 0, w = 0;
for (const file of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const r = JSON.parse(fs.readFileSync(dir + '/' + file, 'utf8'));
  t += r.checks; p += r.pass; f += r.fail; w += r.warn;
  console.log(file.padEnd(24), ('PASS ' + r.pass).padEnd(8), ('FAIL ' + r.fail).padEnd(8), ('WARN ' + r.warn));
}
console.log('─────────────────────────────────────');
console.log('TOTAL:', t, 'checks |', p, 'pass |', f, 'fail |', w, 'warn');