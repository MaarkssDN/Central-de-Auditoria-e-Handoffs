const fs = require('fs');
const f = 'server/phase1/patch-api.cjs';
let t = fs.readFileSync(f, 'utf8');
t = t.replace(
  "const anchor = '  return router;\\n}';",
  "const anchor = /  return router;\\r?\\n}/;"
);
fs.writeFileSync(f, t);
console.log(t.split('\n').filter(l => l.includes('anchor')).join('\n'));
