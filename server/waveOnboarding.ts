import fs from 'fs';
import path from 'path';
import { CENTRAL_DIR } from './centralStore';
import { saveJsonAtomic } from './persistence';

/**
 * Onboarding de onda (Fase 4): em vez de copiar pastas manualmente,
 * um wizard (UI) chama POST /api/central/waves/onboard que cria a
 * estrutura central/ondas/<slug>/{handoffs,auditoria,revisoes} e gera
 * os arquivos de handoff a partir de template.
 */

export interface OnboardHandoffInput {
  para: string;
  titulo: string;
  prioridade?: string;
  dependencias?: string[];
  problema?: string;
  correcao?: string;
  aceite?: string;
}

export interface OnboardWaveInput {
  name: string;
  repoPath?: string;
  baseline?: string;
  handoffs: OnboardHandoffInput[];
  force?: boolean;
}

function slugify(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function handoffTemplate(
  h: OnboardHandoffInput,
  waveSlug: string,
  seq: number,
  ctx?: { repoPath?: string; baseline?: string },
): string {
  const slug = slugify(h.titulo) || `handoff-${seq}`;
  const paraNum = (h.para.match(/\d+/) || ['00'])[0];
  return `# ${h.titulo}

- De: 00
- Para: ${h.para}
- Onda: ${waveSlug}
- Status: PENDENTE
- Prioridade: ${h.prioridade || 'P2'}
- Dependências: ${(h.dependencias || []).join(', ') || 'nenhuma'}
- Referência: ${ctx?.repoPath || 'repositório alvo'} @ ${ctx?.baseline || 'main'}

## Problema
${h.problema || '(descrever o problema com evidência: arquivo:linha, log, comportamento observado)'}

## Correção exigida
${h.correcao || '(descrever a correção mínima, arquivos permitidos e o que NÃO pode ser tocado)'}

## Critério de aceite
${h.aceite || '(comandos de gate + exit codes esperados + evidência exigida na ## Resolução)'}

## Resolução
(preencher pelo executor: branch, commits, gates com exit code real, evidências, limitações)

## Revisão 24
(parecer do Agente 24 — preenchido somente na revisão independente)
`;
}

export function onboardWave(input: OnboardWaveInput): { ok: boolean; waveDir?: string; files?: string[]; error?: string } {
  const slug = slugify(input.name);
  if (!slug) return { ok: false, error: 'Nome da onda inválido.' };
  if (!Array.isArray(input.handoffs) || input.handoffs.length === 0) {
    return { ok: false, error: 'Informe ao menos um handoff.' };
  }
  for (const h of input.handoffs) {
    if (!h.para?.trim() || !h.titulo?.trim()) {
      return { ok: false, error: 'Todo handoff precisa de "para" e "titulo".' };
    }
  }

  const waveDir = path.join(CENTRAL_DIR, 'ondas', slug);
  const hdir = path.join(waveDir, 'handoffs');
  if (fs.existsSync(waveDir) && !input.force) {
    return { ok: false, error: `Onda '${slug}' já existe. Use force=true para sobrescrever arquivos de handoff.` };
  }

  fs.mkdirSync(path.join(waveDir, 'auditoria'), { recursive: true });
  fs.mkdirSync(path.join(waveDir, 'revisoes'), { recursive: true });
  fs.mkdirSync(hdir, { recursive: true });

  const files: string[] = [];
  input.handoffs.forEach((h, i) => {
    const seq = String(i + 1).padStart(2, '0');
    const paraNum = (h.para.match(/\d+/) || ['00'])[0];
    const suffix = slugify(h.titulo).slice(0, 48) || `handoff-${i + 1}`;
    const fname = `${seq}-para-${paraNum}-${suffix}.md`;
    const abs = path.join(hdir, fname);
    fs.writeFileSync(abs, handoffTemplate(h, slug, i + 1, { repoPath: input.repoPath, baseline: input.baseline }), 'utf-8');
    files.push(path.relative(CENTRAL_DIR, abs).replace(/\\/g, '/'));
  });

  const index = `# Onda ${input.name} (${slug})

- Repo: ${input.repoPath || '(definir)'}
- Baseline: ${input.baseline || 'main'}
- Criada em: ${new Date().toISOString()}
- Handoffs: ${input.handoffs.length}

## Handoffs
${input.handoffs.map((h, i) => `${i + 1}. **${h.para}** — ${h.titulo} (${h.prioridade || 'P2'})`).join('\n')}
`;
  fs.writeFileSync(path.join(waveDir, 'INDEX.md'), index, 'utf-8');
  files.unshift(path.relative(CENTRAL_DIR, path.join(waveDir, 'INDEX.md')).replace(/\\/g, '/'));

  // Registra a onda no checkpoint da central (não destrutivo)
  const stateFile = path.join(CENTRAL_DIR, 'estado', 'central-state.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf-8')) : {};
  if (!Array.isArray(state.wavesOnboarded)) state.wavesOnboarded = [];
  if (!state.wavesOnboarded.includes(slug)) state.wavesOnboarded.push(slug);
  state.lastOnboardedWave = { slug, name: input.name, at: new Date().toISOString() };
  saveJsonAtomic(stateFile, state);

  return { ok: true, waveDir: slug, files };
}
