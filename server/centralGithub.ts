import { execSync } from 'child_process';
import { appendExecution, readExecutions } from './centralExecutions';
import { emitCentralEvent } from './centralEvents';

export interface PrResult {
  ok: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  via?: 'gh' | 'api';
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function repoSlug(cwd: string): string | null {
  try {
    const url = git('remote get-url origin', cwd);
    const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/i);
    return m ? `${m[1]}/${m[2].replace(/\.git$/, '')}` : null;
  } catch { return null; }
}

function ghAvailable(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

async function createPrViaApi(slug: string, opts: { head: string; base: string; title: string; body: string }): Promise<PrResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GITHUB_TOKEN não configurado para fallback via API.' };
  const [owner, repo] = slug.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'central-auditoria-handoffs',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: opts.title, head: opts.head, base: opts.base, body: opts.body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `GitHub API HTTP ${res.status}: ${text.slice(0, 300)}` };
  }
  const json = (await res.json()) as { html_url?: string; number?: number };
  return { ok: true, prUrl: json.html_url, prNumber: json.number, via: 'api' };
}

export async function createPullRequest(opts: {
  handoff: string;
  branch: string;
  repoPath: string;
  base?: string;
  title?: string;
  body?: string;
  agent?: string;
  provider?: string;
}): Promise<PrResult> {
  const { handoff, branch, repoPath } = opts;
  if (!repoPath) return { ok: false, error: 'repoPath obrigatório.' };

  const slug = repoSlug(repoPath);
  const base = opts.base || 'main';
  const title = opts.title || `handoff: ${handoff.split('/').pop()?.replace(/\.md$/, '') || handoff}`;
  const body = opts.body || [
    `Handoff da Central de Auditoria: \`${handoff}\``,
    '',
    `Branch: \`${branch}\``,
    `Base: \`${base}\``,
    '',
    'Aberto automaticamente pelo servidor da central (Fase 3 — GitHub integration).',
    'Merge somente com parecer APROVADO do Agente 24 + gates verdes.',
  ].join('\n');

  // 1) tenta gh CLI
  if (ghAvailable()) {
    try {
      const out = execSync(
        `gh pr create --head "${branch}" --base "${base}" --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`,
        { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }
      ).toString().trim();
      const urlMatch = out.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
      if (urlMatch) {
        const prUrl = urlMatch[0];
        const prNumber = Number(prUrl.match(/pull\/(\d+)/)?.[1] || 0) || undefined;
        recordPr(handoff, branch, prUrl, opts);
        return { ok: true, prUrl, prNumber, via: 'gh' };
      }
      // gh pode ter criado mesmo sem URL clara na saída
      if (/already exists|already a pull request/i.test(out)) {
        return findExistingPr(repoPath, branch, slug);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg)) return findExistingPr(repoPath, branch, slug);
      // cai para API se gh falhou por auth/rede
    }
  }

  // 2) fallback API
  if (slug) {
    const res = await createPrViaApi(slug, { head: branch, base, title, body });
    if (res.ok && res.prUrl) recordPr(handoff, branch, res.prUrl, opts);
    return res;
  }
  return { ok: false, error: 'Sem gh CLI autenticado e sem slug owner/repo detectável no remote.' };
}

function findExistingPr(repoPath: string, branch: string, slug: string | null): PrResult {
  try {
    const out = execSync(`gh pr list --head "${branch}" --state open --json url,number --limit 1`, {
      cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000,
    }).toString().trim();
    const parsed = JSON.parse(out) as { url?: string; number?: number }[];
    if (parsed[0]?.url) return { ok: true, prUrl: parsed[0].url, prNumber: parsed[0].number, via: 'gh' };
  } catch { /* ignora */ }
  return { ok: false, error: `Branch ${branch} já possui PR ou gh indisponível.` };
}

function recordPr(handoff: string, branch: string, prUrl: string, opts: { agent?: string; provider?: string }): void {
  appendExecution({
    handoff,
    agent: opts.agent,
    provider: opts.provider,
    action: 'pr_created',
    branch,
    prUrl,
    notes: `PR aberto automaticamente: ${prUrl}`,
  });
  emitCentralEvent('pr_created', { handoff, branch, prUrl, agent: opts.agent, provider: opts.provider });
}

export function handoffsWithPrs(): { handoff: string; prUrl: string; branch?: string | null; ts?: string }[] {
  return readExecutions({ days: 365 })
    .filter((e) => e.prUrl)
    .map((e) => ({ handoff: e.handoff, prUrl: e.prUrl as string, branch: e.branch, ts: e.ts }));
}
