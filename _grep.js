const fs = require('fs');
const file = 'js/modules/personal.js';
const content = fs.readFileSync(file, 'utf8');
const patterns = [
  '_resolverPuesto',
  '_setPuestoSelect',
  '_renderPuestoOptions',
  'PUESTOS_CUSTOM_KEY',
  "'__custom__'",
  'p-puesto-custom',
  'loadCustomPuestos',
  'saveCustomPuesto',
];
for (const p of patterns) {
  const count = (content.match(new RegExp(p.replace(/'/g, "\\'"), 'g')) || []).length;
  console.log(`[${p}] = ${count}`);
}
console.log('--- total lines:', content.split('\n').length);
