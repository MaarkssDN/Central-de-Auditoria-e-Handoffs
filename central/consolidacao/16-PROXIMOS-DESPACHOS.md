# 16 — PRÓXIMOS DESPACHOS (preparados, NÃO executados)

Ordem por prioridade. Todos aguardam autorização do Orquestrador Humano. Executor padrão: `devin` via `run_subagent`/`dispatch.mjs` salvo indicado.

---

## DESPACHO-01 — CENTRAL-0001 · Preservar trabalho não commitado (P0)

- **Agente:** devin (`subagent_general`) ou execução manual orientada
- **Onda:** A
- **Escopo:** commitar em branch nova `feat/gemini-provider-chat` (a partir da branch atual ou main pós-#12):
  - `server/geminiService.ts`, `server/geminiService.test.ts`, `server/db.test.ts`
  - diffs: `server/{db.ts,centralApi.ts,agentRuntime.ts,phase1/adapters.ts,providers.ts,server.ts}`, `.env.example`
  - `src/components/{AuditReviewView,HandoffsCenterView,FilesView}.tsx`
  - **NÃO incluir:** `central/estado/*` (salvo decisão HD-03), `00-para-*.md` (transições de status — commit separado de "estado" se desejado)
- **Validação:** `npx tsc --noEmit`, `npm test`, `npm run build` — todos já verdes em 22/11; re-rodar no commit.
- **Entrega:** branch + PR documental/feat + handoff de encerramento da sessão de 21/11 (reconstruído).
- **Dependências:** HD-01 (autorização para commitar trabalho alheio).
- **Risco:** nenhum se isolado em branch; merge só após revisão.

## DESPACHO-02 — CENTRAL-0021 · Reconciliação de branches do produto (P0, read-only)

- **Agente:** `subagent_explore` (read-only)
- **Alvo:** `C:\Github\Birthub-360`
- **Tarefa:** para cada branch `agente/*` e `integracao/*` e `chore/salvage-stash-00`: `git log main..branch`, `git diff main...branch --stat`, classificar cada commit como JÁ-IN-MAIN / NOVO / OBSOLETO. Cruzar com PRs #473–476, #429, #423. Verificar fisicamente `C:\Github\Birthub-360-wt\ag-*`: `git status`, `git log` de cada worktree (procurar commits do lote 2).
- **Entrega:** relatório `consolidacao/evidencias/reconciliacao-branches-20261122.md` + tabela "branch → destino (merge/retrabalho/descartar)".
- **Sem dependências.**

## DESPACHO-03 — CENTRAL-0023/0024 · Verificar execuções mortas (P0/P1, read-only)

- **Agente:** `subagent_explore`
- **Alvo:** `C:\Github\Birthub-360-wt\ag-{01a,02,04,05}` + handoffs correspondentes
- **Tarefa:** confirmar se há commits não pushados nos worktrees; ler `## Resolução` dos 4 handoffs EM_EXECUÇÃO; investigar handoff 15 (execução CLI exit 0 sem Status — procurar branch/commit órfão).
- **Entrega:** veredito por handoff: RE-DESPACHAR-LIMPO / RETOMAR-COMMITS / CANCELAR + evidência.

## DESPACHO-04 — CENTRAL-0022 · Revisões 24 dos AGUARDANDO_24 (P0)

- **Agente:** Agente 24 (`subagent_explore` por entrega, ou um só com 4 pareceres)
- **Alvo:** PRs Birthub #473 (10), #474 (16), #475 (09), #476 (01)
- **Tarefa:** parecer APROVADO/REPROVADO/BLOQUEADO por entrega auditando P1–P4 + matriz de propriedade; registrar em `central/ondas/release-readiness-2026-11-18/revisoes/` e atualizar Status dos handoffs.
- **Prompts-modelo já existem:** `central/estado/fila/2026-11-19T18-2*-devin-00-para-*-24-review` (4 arquivos `*-24-review-*`).
- **Sem dependências** — pode rodar em paralelo aos DESPACHOs 02/03.

## DESPACHO-05 — CENTRAL-0003/0004 · Saneamento de estado e docs (P1)

- **Agente:** coordenador/devin
- **Escopo:** `central/estado/` — marcar locks expirados como liberados (arquivo de registro, não deletar histórico); consolidar `fila/` processada vs pendente; atualizar `handoffs/INDEX.md` e `ondas/INDEX.md`; reescrever `central-state.json` (waveStatus coerente, updatedAt, activeBatch=null).
- **Cuidado:** transições de status só via state machine (`updateHandoffStatus`) ou edição manual documentada.

## DESPACHO-06 — Onda B · Re-despacho lote 2 + PENDENTE (P0/P1)

- **Pré-requisito:** DESPACHOs 02/03 concluídos + D-04 ratificada (para 01A).
- **Lote respeitando slots (máx 4):**
  - Slot schema: 01 (RLS/migrations — CENTRAL-0026a, **criar handoff novo**) — 01A espera.
  - Paralelo: 06 (+DEBT-0020), 07, 12, 13.
  - Depois: 17, 18, 21 (após 13), 15 (após DESPACHO-03), 08 (+ARQ-13), 00 (higiene), 02/04/05 (re-despacho conforme evidência).
- **Cada despacho:** prompt via `dispatch.mjs` ou `run_subagent` com caminho absoluto do handoff + worktree + regras (sem push/merge, gates com exit code, Status→AGUARDANDO_24).

## DESPACHO-07 — CENTRAL-0026 · Criar handoffs derivados (P0 para RLS)

- **Agente:** 00/coordenador (criação) — execução pelo agente 01.
- **Handoffs a criar** (usando `TEMPLATE-HANDOFF.md`):
  1. `00-para-01-rls-migrations-reais.md` — DEBT-0057/0058/DB-08 (P0 segurança; branch `integracao/schema-*` como base).
  2. `00-para-09-mobile-clusters.md` — reintegração DEBT-0025 pós-D-06.
  3. `00-para-08-arq13-waivers.md` — renovação Trivy antes de 30/11.
- **Dependências:** Onda A (verdade consolidada).

## DESPACHO-08 — Onda C · Integração e veredito (P1, após Onda B)

- Sequência de merges produto + gates + drill restore + veredito GO/NO-GO.
- **Depende de:** pareceres 24, D-01/D-04, HD-11.

---

## Itens que NÃO são despachos (decisões humanas)

HD-01..HD-13 em `12-DECISOES-HUMANAS.md` — incluindo merges de PRs #9–12, senha, webhook, landing, stash drop, acessos EC2/DNS.
