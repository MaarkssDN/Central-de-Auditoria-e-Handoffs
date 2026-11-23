# 09 — MATRIZ DE DEPENDÊNCIAS

## Grafo resumido (o que bloqueia o quê)

```
D-01 (envs EC2) ──► CENTRAL-0029 (drill restore), severidade DEBT-0003/0006/0007, INF-04
D-04 (ratificar retenção) ──► CENTRAL-0023/01A-retencao (execução), CENTRAL-0026 parcial
Decisão release/SHA ──► CENTRAL-0020 (ARQ-13 waivers Trivy, vence 30/11)
Decisões de versionamento ──► CENTRAL-0005, 0012, 0002
CENTRAL-0001 (commitar trabalho alheio) ──► qualquer nova sessão de plataforma
CENTRAL-0021 (reconciliar branches) ──► CENTRAL-0023 (re-despacho), CENTRAL-0031 (merges)
CENTRAL-0022 (pareceres 24) ──► CENTRAL-0031 (merges produto), veredito final
13-enxame (D-05 respondida) ──► 21-lgpd (co-dependência DEBT-0013)
01-schema ──► 01A (slot exclusivo — nunca simultâneos)
06-integracoes ──► absorver DEBT-0020 (vem do handoff 01)
08-qa ──► ARQ-13/waivers + QA gates de todos
18-contratos ──► coordenar com 05 (DEBT-0011/0044) e 07
```

## Classificação das tarefas

### PRONTAS PARA EXECUÇÃO (sem dependência bloqueante)

| ID | Tarefa | Observação |
|---|---|---|
| CENTRAL-0001 | Preservar trabalho não commitado | Precisa só de autorização para commitar trabalho de outra sessão |
| CENTRAL-0021 | Reconciliar branches `agente/*` × main | Read-only |
| CENTRAL-0023/0024 | Verificar worktrees ag-* + handoff 15 | Read-only |
| CENTRAL-0022 | Revisões 24 ×4 | Read-only; prompts já em `estado/fila/` |
| CENTRAL-0003/0004 | Saneamento estado + docs | Baixo risco |
| CENTRAL-0025 (parcial) | Despachar 00, 06, 07, 08, 12, 13, 17, 18 | Após Onda A; slots livres |
| CENTRAL-0033 | Higiene `@ts-nocheck`/design-lab/deps | Independente |

### DEPENDENTES

| ID | Tarefa | Depende de |
|---|---|---|
| CENTRAL-0023-exec | Re-despacho real de 01A/02/04/05 | Resultado de CENTRAL-0021/0023 (commits nos worktrees?) + D-04 (01A) |
| CENTRAL-0026 | Hand-offs derivados RLS/migrations, mobile clusters | CENTRAL-0021 + schema PR #476 resolvido |
| CENTRAL-0029 | Drill restore | D-01 (host EC2) |
| CENTRAL-0030 | assetlinks/DNS | Decisão de domínio + acesso DNS |
| CENTRAL-0025 (15, 21) | Handoffs 15 e 21 | 15: após CENTRAL-0024; 21: após 13 |
| CENTRAL-0031 | Merges produto | Pareceres 24 + Onda B completa |

### BLOQUEADAS

| ID | Tarefa | Bloqueio |
|---|---|---|
| CENTRAL-0029 | Restore real | D-01 — sem acesso ao host |
| CENTRAL-0028 | Verificação envs EC2 | D-01 — acesso humano ao host |
| CENTRAL-0030 | App Links | Acesso DNS/host |
| CENTRAL-0020 | ARQ-13 waivers | Decisão de release (parcial — pode preparar sem merge) |

### AGUARDANDO APROVAÇÃO HUMANA

CENTRAL-0002 (PRs #9–12), CENTRAL-0005 (versionamento estado), CENTRAL-0009 (senha), CENTRAL-0010 (landing órfã), CENTRAL-0012 (limpeza worktrees/branches), CENTRAL-0013 (webhook), CENTRAL-0014 (multiusuário), CENTRAL-0028 (D-01/D-04), CENTRAL-0031 (merges), CENTRAL-0032 (drop stash).

## Caminho crítico

`CENTRAL-0001 → Onda A (verdade) → Onda B (execução produto) → Onda C (integração/veredito)`.

O item mais urgente por **data**: CENTRAL-0020 (waivers Trivy 30/11) e CENTRAL-0026a (RLS P0 segurança). O mais urgente por **risco**: CENTRAL-0001 (perda de trabalho).

## Conflitos de ownership a respeitar

- `prisma/schema.prisma` + migrations → só agente 01 (01A fora até slot liberar).
- `server.ts`, `package.json`, lockfiles → aprovação do coordenador (nenhum executor edita).
- `.agents/prompts/**`, `AGENTS.md` → humano.
- `central/estado/**` → só o coordenador da Central escreve.
- `src/components/{AuditReviewView,HandoffsCenterView,FilesView}.tsx` + `server/{db,geminiService,centralApi,agentRuntime}.ts` + `server/phase1/adapters.ts` → **em disputa**: contêm o trabalho não commitado de 21/11; ninguém mais deve tocar até CENTRAL-0001 ser resolvido.
