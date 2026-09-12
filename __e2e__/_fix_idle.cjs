// Reemplaza waitForLoadState('networkidle') por 'load' en el spec (networkidle
// nunca llega: Firestore/SW mantienen conexiones persistentes).
const fs = require('fs');
const f = '__e2e__/e2e.spec.js';
let s = fs.readFileSync(f, 'utf8');
const before = (s.match(/networkidle/g) || []).length;
s = s.split("waitForLoadState('networkidle')").join("waitForLoadState('load')");
fs.writeFileSync(f, s);
console.log('REEMPLAZADOS:', before);