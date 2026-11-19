const fs = require('fs');
const f = 'server/centralStore.ts';
let t = fs.readFileSync(f, 'utf8');

// 1) updateHandoffStatus: normalize + state machine check
const reFn = /export function updateHandoffStatus\(relPath: string, status: string, resolution\?: string\): \{ ok: boolean; error\?: string \} \{\r?\n  if \(!VALID_STATUS\.includes\(status\.toUpperCase\(\)\)\) \{\r?\n    return \{ ok: false, error: `Status inválido\. Use: \$\{VALID_STATUS\.join\(', '\)\}` \};\r?\n  \}\r?\n/;
const repFn = `export function updateHandoffStatus(relPath: string, status: string, resolution?: string): { ok: boolean; error?: string } {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return { ok: false, error: \`Status inválido. Use: \${VALID_STATUS.join(', ')}\` };
  }
`;
if (!reFn.test(t)) { console.error('reFn not found'); process.exit(1); }
t = t.replace(reFn, repFn);

// 2) after existence check, add transition validation before reading text
const reAbs = /(const abs = path\.resolve\(CENTRAL_DIR, safe\);\r?\n  if \(!abs\.startsWith\(CENTRAL_DIR\) \|\| !fs\.existsSync\(abs\)\) \{\r?\n    return \{ ok: false, error: 'Handoff não encontrado\.' \};\r?\n  \}\r?\n)(  let text = fs\.readFileSync\(abs, 'utf-8'\);)/;
const repAbs = `$1  const before = parseHandoff(abs);
  const transition = canTransition(before.status, normalized);
  if (!transition.ok) {
    return { ok: false, error: transition.error };
  }
$2`;
if (!reAbs.test(t)) { console.error('reAbs not found'); process.exit(1); }
t = t.replace(reAbs, repAbs);

// 3) after writeFileSync, log transition
const reTail = /(  fs\.writeFileSync\(abs, text, 'utf-8'\);\r?\n)(  return \{ ok: true \};\r?\n\})/;
const repTail = `$1  const lock = getLock(relPath);
  const executionId = lock?.executionId || newExecutionId();
  if (before.status !== normalized) {
    logStatusTransition({
      executionId,
      handoff: relPath.replace(/\\\\/g, '/'),
      from: before.status,
      to: normalized,
      actor: lock?.owner || 'central-api',
      detail: resolution ? 'status+resolucao' : 'status',
    });
  }
$2`;
if (!reTail.test(t)) { console.error('reTail not found'); process.exit(1); }
t = t.replace(reTail, repTail);

// 4) queueDispatch: claim lock before writing prompt file
const reQ = /(  const filaDir = path\.join\(CENTRAL_DIR, 'estado', 'fila'\);)/;
const repQ = `  const claim = claimLock({
    handoffRelPath: opts.handoffRelPath,
    owner: agentCfg.id || opts.agentId || 'desconhecido',
    worktree: opts.worktree,
  });
  if (!claim.ok) {
    return { ok: false, error: \`Handoff já está em execução por '\${claim.conflict.owner}' até \${claim.conflict.expiresAt} (executionId \${claim.conflict.executionId}).\` };
  }
  appendEvent({
    executionId: claim.lock.executionId,
    handoff: opts.handoffRelPath.replace(/\\\\/g, '/'),
    type: 'DISPATCHED',
    actor: agentCfg.id || opts.agentId,
    detail: 'Despacho enfileirado',
    meta: { worktree: opts.worktree, branch: opts.branch },
  });
$1`;
if (!reQ.test(t)) { console.error('reQ not found'); process.exit(1); }
t = t.replace(reQ, repQ);

fs.writeFileSync(f, t);
console.log('patched OK');
