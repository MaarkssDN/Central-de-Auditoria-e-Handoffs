// Detecta agentes CLI disponíveis na máquina e grava estado/agentes-disponiveis.json
// Uso: node agents/detect-agents.mjs   (da raiz da central)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(ROOT, 'agents', 'registry.json'), 'utf8'));

function which(cmd) {
  try {
    const out = execSync(`where ${cmd}`, { stdio: 'pipe' }).toString().split('\n')[0].trim();
    return out || null;
  } catch {
    return null;
  }
}

const result = registry.agents.map((a) => {
  const found = (a.detect || []).map((c) => ({ cmd: c, path: which(c) })).filter((x) => x.path);
  return { ...a, disponivel: a.tipo !== 'cli' || found.length > 0, binarios: found };
});

mkdirSync(join(ROOT, 'estado'), { recursive: true });
writeFileSync(
  join(ROOT, 'estado', 'agentes-disponiveis.json'),
  JSON.stringify({ geradoEm: new Date().toISOString(), agentes: result }, null, 2),
);
for (const a of result) console.log(`${a.disponivel ? '✓' : '✗'} ${a.id} (${a.tipo})${a.binarios?.length ? ' -> ' + a.binarios[0].path : ''}`);
