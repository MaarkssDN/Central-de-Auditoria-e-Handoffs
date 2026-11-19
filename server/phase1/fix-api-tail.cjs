const fs = require('fs');
const f = 'server/centralApi.ts';
let t = fs.readFileSync(f, 'utf8');
const bad = '/  return router;\\r?\\n}/';
if (!t.includes(bad)) { console.error('bad tail not found'); process.exit(1); }
t = t.replace(bad, '  return router;\n}');
fs.writeFileSync(f, t);
console.log('fixed');
