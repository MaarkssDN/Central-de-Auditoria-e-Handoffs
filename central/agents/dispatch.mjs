// Gera o pacote de despacho para um handoff + agente.
// Uso: node agents/dispatch.mjs --handoff <arquivo.md> --agent <id> --worktree <path> [--branch <nome>]
// Saída: prompt pronto em estado/fila/<timestamp>-<agent>-<handoff>.md
//        e, se o agente for CLI disponível, tentativa de execução headless.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const { handoff, agent = 'generico', worktree, branch } = args;
if (!handoff || !existsSync(handoff)) {
  console.error('uso: --handoff <arquivo.md> [--agent id] [--worktree path] [--branch nome]');
  process.exit(1);
}

const registry = JSON.parse(readFileSync(join(ROOT, 'agents', 'registry.json'), 'utf8'));
const agentCfg = registry.agents.find((a) => a.id === agent) || registry.agents.at(-1);
const handoffText = readFileSync(handoff, 'utf8');
const handoffName = basename(handoff, '.md');

const prompt = `# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: C:\\Github\\Birthub-360
Worktree de trabalho: ${worktree || '(definir — usar worktree isolado do agente)'}${branch ? ` | Branch: ${branch}` : ''}

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
${handoff}

## Conteúdo do handoff
${handoffText}

## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
`;

const filaDir = join(ROOT, 'estado', 'fila');
mkdirSync(filaDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = join(filaDir, `${stamp}-${agentCfg.id}-${handoffName}.md`);
writeFileSync(outFile, prompt);
console.log(`prompt gerado: ${outFile}`);

// Se CLI disponível, tentar execução headless (melhor esforço)
const availFile = join(ROOT, 'estado', 'agentes-disponiveis.json');
if (existsSync(availFile) && agentCfg.tipo === 'cli' && worktree) {
  const avail = JSON.parse(readFileSync(availFile, 'utf8'));
  const found = avail.agentes.find((a) => a.id === agentCfg.id);
  const bin = found?.binarios?.[0]?.path;
  if (bin) {
    try {
      const cmd =
        agentCfg.id === 'claude-code'
          ? `"${bin}" -p "${prompt.replace(/"/g, '\\"').slice(0, 60000)}"`
          : `"${bin}" exec "${prompt.replace(/"/g, '\\"').slice(0, 60000)}"`;
      console.log(`executando ${agentCfg.id} em ${worktree}...`);
      execSync(cmd, { cwd: worktree, stdio: 'inherit', timeout: 30 * 60 * 1000 });
      console.log('execução concluída');
    } catch (e) {
      console.error(`falha ao executar ${agentCfg.id}: ${e.message}`);
      console.log('Use o prompt gerado manualmente no worktree.');
    }
  } else {
    console.log(`${agentCfg.id} CLI não detectada — use o prompt gerado manualmente.`);
  }
} else {
  console.log(`tipo=${agentCfg.tipo} — despache manual ou via subagente do coordenador usando o prompt gerado.`);
}
