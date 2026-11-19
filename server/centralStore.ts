import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { canTransition, normalizeStatus } from './phase1/stateMachine';
import { claimLock, getLock, releaseLock, newExecutionId, type LockConflict } from './phase1/locks';
import { appendEvent, logStatusTransition } from './phase1/executions';
import { atomicWriteFile } from './persistence';

export const CENTRAL_DIR = path.resolve(process.cwd(), process.env.CENTRAL_DIR || 'central');

export const RUNS_DIR = path.join(CENTRAL_DIR, 'estado', 'coordinator-runs');

export function readHandoffRaw(relPath: string): string | null {
  const abs = path.resolve(CENTRAL_DIR, relPath);
  if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

export interface ParsedHandoff {
  file: string;
  relPath: string;
  name: string;
  title: string;
  de: string;
  para: string;
  onda: string;
  status: string;
  prioridade: string;
  dependencias: string[];
  referencia: string;
  problema: string;
  correcao: string;
  aceite: string;
  resolucao: string;
  revisao24: string;
}

export interface CentralDoc { file: string; name: string; size: number }
export interface CentralReview { file: string; name: string }
export interface CentralDecision { id: string; title: string; body: string }
export interface CentralAgent {
  id: string; nome: string; tipo: string; disponivel: boolean;
  dispatch?: string; binarios?: { cmd: string; path: string }[];
}
export interface CentralWaveInfo {
  name: string; handoffs: number; byStatus: Record<string, number>;
}
export interface CentralState {
  generatedAt: string;
  state: Record<string, unknown>;
  waves: CentralWaveInfo[];
  handoffs: ParsedHandoff[];
  audits: CentralDoc[];
  reviews: CentralReview[];
  decisions: CentralDecision[];
  agents: CentralAgent[];
}

const STATUS_ORDER = ['PENDENTE', 'EM_EXECUÇÃO', 'AGUARDANDO_24', 'REPROVADO_24', 'BLOQUEADO', 'CONCLUÍDO'];
const VALID_STATUS = [...STATUS_ORDER, 'ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO'];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
}

function parseHandoff(file: string): ParsedHandoff {
  const text = fs.readFileSync(file, 'utf-8');
  const field = (name: string) => {
    const m = text.match(new RegExp(`^- ${name}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  const title = (text.match(/^#\s+(.+)$/m) || [, path.basename(file)])[1].trim();
  const section = (name: string) => {
    const m = text.match(new RegExp(`## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`));
    return m ? m[1].trim() : '';
  };
  const statusRaw = field('Status').toUpperCase();
  const status = STATUS_ORDER.find((s) => statusRaw.includes(s)) || 'PENDENTE';
  const prio = (field('Prioridade').match(/P[0-3]/) || ['P3'])[0];
  const deps = (field('Dependências').match(/[\wÀ-ú-]+/g) || [])
    .map((d) => d.trim())
    .filter((d) => /^(DEBT|D|QA|INF|SEC|PRO|CRM|IA|VOZ|WRK|API|UX|ARQ|DB)-?\d*/i.test(d) || d.startsWith('DEBT'));
  return {
    file: path.relative(CENTRAL_DIR, file).replace(/\\/g, '/'),
    relPath: path.relative(CENTRAL_DIR, file),
    name: path.basename(file),
    title, de: field('De'), para: field('Para'), onda: field('Onda'),
    status, prioridade: prio, dependencias: deps,
    referencia: field('Referência'),
    problema: section('Problema').slice(0, 4000),
    correcao: section('Correção exigida').slice(0, 4000),
    aceite: section('Critério de aceite').slice(0, 2000),
    resolucao: section('Resolução'),
    revisao24: section('Revisão 24'),
  };
}

export function getCentralState(): CentralState {
  const waves: CentralWaveInfo[] = [];
  const handoffs: ParsedHandoff[] = [];
  const audits: CentralDoc[] = [];
  const reviews: CentralReview[] = [];

  const ondasDir = path.join(CENTRAL_DIR, 'ondas');
  if (fs.existsSync(ondasDir)) {
    for (const wave of fs.readdirSync(ondasDir)) {
      const wdir = path.join(ondasDir, wave);
      if (!fs.statSync(wdir).isDirectory()) continue;
      const hdir = path.join(wdir, 'handoffs');
      const waveHandoffs = fs.existsSync(hdir)
        ? walk(hdir).filter((f) => !f.endsWith('INDEX.md')).map(parseHandoff)
        : [];
      handoffs.push(...waveHandoffs);
      const adir = path.join(wdir, 'auditoria');
      if (fs.existsSync(adir)) {
        audits.push(...walk(adir).map((f) => ({
          file: path.relative(CENTRAL_DIR, f).replace(/\\/g, '/'),
          name: path.basename(f), size: fs.statSync(f).size,
        })));
      }
      const rdir = path.join(wdir, 'revisoes');
      if (fs.existsSync(rdir)) {
        reviews.push(...walk(rdir).map((f) => ({
          file: path.relative(CENTRAL_DIR, f).replace(/\\/g, '/'),
          name: path.basename(f),
        })));
      }
      waves.push({
        name: wave,
        handoffs: waveHandoffs.length,
        byStatus: waveHandoffs.reduce<Record<string, number>>((a, h) => {
          a[h.status] = (a[h.status] || 0) + 1; return a;
        }, {}),
      });
    }
  }

  const decisionsFile = path.join(CENTRAL_DIR, 'decisoes', 'PENDENTES.md');
  const decisions: CentralDecision[] = fs.existsSync(decisionsFile)
    ? fs.readFileSync(decisionsFile, 'utf-8')
        .split(/\n(?=## D-\d+)/)
        .filter((b) => b.startsWith('## D-'))
        .map((b) => {
          const [head, ...rest] = b.split('\n');
          return { id: (head.match(/D-\d+/) || [''])[0], title: head.replace(/^##\s*/, '').trim(), body: rest.join('\n').trim() };
        })
    : [];

  const stateFile = path.join(CENTRAL_DIR, 'estado', 'central-state.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf-8')) : {};

  const agentsFile = path.join(CENTRAL_DIR, 'estado', 'agentes-disponiveis.json');
  const agents: CentralAgent[] = fs.existsSync(agentsFile)
    ? JSON.parse(fs.readFileSync(agentsFile, 'utf-8')).agentes || []
    : [];

  return {
    generatedAt: new Date().toISOString(),
    state, waves, handoffs, audits, reviews, decisions, agents,
  };
}

export function updateHandoffStatus(relPath: string, status: string, resolution?: string): { ok: boolean; error?: string } {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return { ok: false, error: `Status inválido. Use: ${VALID_STATUS.join(', ')}` };
  }
  const safe = path.normalize(relPath);
  const abs = path.resolve(CENTRAL_DIR, safe);
  if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) {
    return { ok: false, error: 'Handoff não encontrado.' };
  }
  const before = parseHandoff(abs);
  const transition = canTransition(before.status, normalized);
  if (!transition.ok) {
    return { ok: false, error: transition.error };
  }
  let text = fs.readFileSync(abs, 'utf-8');
  if (/^- Status:/m.test(text)) {
    text = text.replace(/^- Status:.*$/m, `- Status: ${normalized}`);
  } else {
    text = text.replace(/(- Para:.*)$/m, `$1\n- Status: ${normalized}`);
  }
  if (resolution && resolution.trim()) {
    const block = `\n\n## Resolução\n${resolution.trim()}\n- Atualizado via Central em ${new Date().toISOString()}\n`;
    if (/## Resolução/.test(text)) {
      text = text.replace(/## Resolução[\s\S]*$/, block.trimStart());
    } else {
      text += block;
    }
  }
  atomicWriteFile(abs, text);
  const lock = getLock(relPath);
  const executionId = lock?.executionId || newExecutionId();
  if (before.status !== normalized) {
    logStatusTransition({
      executionId,
      handoff: relPath.replace(/\\/g, '/'),
      from: before.status,
      to: normalized,
      actor: lock?.owner || 'central-api',
      detail: resolution ? 'status+resolucao' : 'status',
    });
  }
  return { ok: true };
}

export function which(cmd: string): string | null {
  try {
    const out = execSync(`where ${cmd}`, { stdio: 'pipe' }).toString().split('\n')[0].trim();
    return out || null;
  } catch { return null; }
}

export function detectAgents(): CentralAgent[] {
  const regFile = path.join(CENTRAL_DIR, 'agents', 'registry.json');
  if (!fs.existsSync(regFile)) return [];
  const registry = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
  return (registry.agents || []).map((a: CentralAgent) => {
    const cmds = (a as unknown as { detect?: string[] }).detect || [];
    const found = cmds.map((c) => ({ cmd: c, path: which(c) })).filter((x) => x.path);
    return { ...a, disponivel: a.tipo !== 'cli' || found.length > 0, binarios: found };
  });
}

export function buildDispatchPrompt(opts: {
  handoffAbsPath: string; agentName: string; worktree?: string; branch?: string; repoPath?: string;
}): string {
  const handoffText = fs.readFileSync(opts.handoffAbsPath, 'utf-8');
  return `# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: ${opts.repoPath || 'C:\\Github\\Birthub-360'}
Worktree de trabalho: ${opts.worktree || '(definir — usar worktree isolado do agente)'}${opts.branch ? ` | Branch: ${opts.branch}` : ''}

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
${opts.handoffAbsPath}

## Conteúdo do handoff
${handoffText}

## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "- Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
`;
}

export function queueDispatch(opts: {
  handoffRelPath: string; agentId: string; worktree?: string; branch?: string; repoPath?: string;
}): { ok: boolean; promptFile?: string; error?: string; conflict?: LockConflict } {
  const abs = path.resolve(CENTRAL_DIR, opts.handoffRelPath);
  if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) {
    return { ok: false, error: 'Handoff não encontrado.' };
  }
  const registry = JSON.parse(fs.readFileSync(path.join(CENTRAL_DIR, 'agents', 'registry.json'), 'utf-8'));
  const agentCfg = (registry.agents || []).find((a: { id: string }) => a.id === opts.agentId) || registry.agents.at(-1);
  const prompt = buildDispatchPrompt({
    handoffAbsPath: abs,
    agentName: agentCfg.nome || opts.agentId,
    worktree: opts.worktree,
    branch: opts.branch,
    repoPath: opts.repoPath,
  });
  const claim = claimLock({
    handoffRelPath: opts.handoffRelPath,
    owner: agentCfg.id || opts.agentId || 'desconhecido',
    worktree: opts.worktree,
  });
  if (!claim.ok) {
    return { ok: false, error: `Handoff já está em execução por '${claim.conflict.owner}' até ${claim.conflict.expiresAt} (executionId ${claim.conflict.executionId}).`, conflict: claim.conflict };
  }
  appendEvent({
    executionId: claim.lock.executionId,
    handoff: opts.handoffRelPath.replace(/\\/g, '/'),
    type: 'DISPATCHED',
    actor: agentCfg.id || opts.agentId,
    detail: 'Despacho enfileirado',
    meta: { worktree: opts.worktree, branch: opts.branch },
  });
  const filaDir = path.join(CENTRAL_DIR, 'estado', 'fila');
  fs.mkdirSync(filaDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(filaDir, `${stamp}-${agentCfg.id}-${path.basename(abs, '.md')}.md`);
  atomicWriteFile(outFile, prompt);

  // Registra despacho no handoff (Status EM_EXECUÇÃO se ainda PENDENTE)
  const current = parseHandoff(abs);
  if (current.status === 'PENDENTE') {
    updateHandoffStatus(opts.handoffRelPath, 'EM_EXECUÇÃO');
  }
  return { ok: true, promptFile: path.relative(CENTRAL_DIR, outFile).replace(/\\/g, '/') };
}
