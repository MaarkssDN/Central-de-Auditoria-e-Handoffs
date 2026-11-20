# HANDOFF — SESSÃO DEVIN · FASE 3 (OBSERVABILIDADE) — CENTRAL DE AUDITORIA

- **Origem:** Central de Auditoria e Handoff (sessão Devin Desktop, Marcelo)
- **Destino:** Nova Central de Coordenação
- **Data:** 2026-11-20
- **Status:** CONCLUÍDO (escopo desta sessão) — existe handoff consolidado do dia em `central/HANDOFF-ENCERRAMENTO-20261120.md` (sessão paralela, mais abrangente). Este documento cobre apenas a fatia executada por esta sessão.

---

## 1. Objetivo da central

Esta sessão recebeu o plano `C:\Users\Marcelo\Desktop\PLANO-EVOLUCAO-CENTRAL-AUDITORIA.html` e foi instruída a **executar a Fase 3 — Ecossistema e observabilidade** do repositório `C:\Github\Central-de-Auditoria-e-Handoffs`. Não eram auditorias de código do Birthub-360; era implementação de plataforma.

## 2. Projetos atendidos

| Projeto | Path | Escopo |
|---|---|---|
| Central de Auditoria e Handoffs | `C:\Github\Central-de-Auditoria-e-Handoffs` | Fase 3: SSE de eventos, log de execuções, métricas, webhook, GitHub PR, painel ao vivo |
| Birthub-360 (referência) | `C:\Github\Birthub-360` | Usado apenas para teste real do endpoint de PR (branch `agente/08-visual-scope-pr-diff`) |

## 3. Trabalhos realizados (efetivamente executados)

| Projeto | Atividade | Status | Resultado | Próxima ação |
|---|---|---|---|---|
| Central | `server/centralEvents.ts` — barramento EventEmitter + buffer 200 + SSE com replay | CONCLUÍDO | `GET /api/central/events` transmite `exec_*`, `handoff_*`, `coordinator_run_done`, `pr_created` | Consumir nos dispatchers F1 |
| Central | `server/centralExecutions.ts` — JSONL append-only `estado/executions/YYYY-MM-DD.jsonl` | CONCLUÍDO | Coexiste com `phase1/executions.ts` (JSON por execução) sem conflito | F1 adapters devem chamar `appendExecution` |
| Central | `server/centralNotify.ts` — webhook Discord/Slack | CONCLUÍDO | `CENTRAL_NOTIFY_WEBHOOK` + `CENTRAL_NOTIFY_EVENTS` no `.env` (vazio, aguardando URL) | Usuário cola URL e reinicia |
| Central | `server/centralMetrics.ts` — `GET /metrics` | CONCLUÍDO | Lead time, reprovação 24, bloqueados por decisão, por provider, PRs | Alimentar dashboard |
| Central | `server/centralGithub.ts` + `POST /github/pr` | CONCLUÍDO | Testado real: resolveu PR #423 via `gh`, gravou `pr_created` | Chamar no fluxo complete/fail |
| Central | `POST /coordinator/run` + `GET /coordinator/runs` | CONCLUÍDO | `runCoordinator` (F2) estava sem rota; agora roteado e emite `coordinator_run_done` | — |
| Central | UI: faixa de métricas + painel "Sinal ao vivo" (SSE) em `CentralAuditView.tsx` | CONCLUÍDO | Live sem refresh, LED de conexão | — |
| Central | Fix `pr_created` não registrado quando PR já existia | CONCLUÍDO | Commit `e19ab55`; depois `e9f63c7` (sessão paralela) refatorou p/ `execFile` | Revisar versão final |
| Central | Merge + push | CONCLUÍDO | `origin/main` avançou por PRs #2/#3/#4 de sessões paralelas | — |

## 4. Trabalhos pendentes (visão desta sessão)

- **Webhook real**: `CENTRAL_NOTIFY_WEBHOOK=""` em `.env` — aguardando URL do Discord/Slack do usuário.
- **Restart do servidor**: `npm run dev` na porta 3000 rodava build antigo durante a sessão.
- Integração fina F3↔F1: os adapters (`server/phase1/adapters.ts`) ainda não emitem `exec_heartbeat`/`exec_output` para o SSE — eventos existem, mas só `dispatch`/`status`/`pr_created`/`coordinator_run_done` disparam hoje.
- `GET /api/central/github/pr` cria PR real — não há trava de "só após parecer APROVADO"; o gate de merge do plano (parecer + gates verdes) ainda é manual.

## 5. Inventário de handoffs

Nenhum handoff `.md` da onda foi criado/analisado por esta sessão (escopo era plataforma, não execução de handoffs). Handoffs existentes em `central/ondas/release-readiness-2026-11-18/handoffs/` (19, todos PENDENTE no início da sessão) foram apenas lidos indiretamente via métricas. Um teste de transição de status foi feito e **revertido** (ver §7).

## 6. Decisões e critérios

- Fase 3 implementada **sem** esperar Fases 1–2 completas: eventos/métricas funcionam com dados parciais (JSONL vazio → métricas zeradas, sem crash).
- Log JSONL diário escolhido como formato do plano (append-only), coexistindo com o modelo por-execução da `phase1/`.
- Notificações: filtro por tipo de evento via `CENTRAL_NOTIFY_EVENTS`; payload Discord (`content`) / Slack (`text`) / genérico detectados pela URL.
- PR: `gh` CLI preferido (já autenticado como `MaarkssDN`, scopes `repo`), fallback API com `GITHUB_TOKEN`; slug detectado via `git remote get-url origin`.

## 7. Problemas e riscos

- **Corrida com sessões paralelas**: outras sessões Devin trabalharam no mesmo working tree durante esta sessão (Fases 1, 2, 4, auth, coordinator, landing page). Risco de sobrescrita foi contornado porque `centralApi.ts` foi lido antes das adições e minhas rotas são aditivas — mas **a versão final commitada pode divergir do que esta sessão escreveu** (ver `e9f63c7`).
- **Mutação de teste revertida**: um `POST /handoffs/status` de teste marcou `00-para-10-infra-backup-deploy.md` como BLOQUEADO; revertido manualmente para PENDENTE. O execution log guarda o evento (append-only, correto).
- **Auth**: `server/auth.ts` (sessão paralela) exige login em toda `/api` — SSE/fetch do dashboard retornam 401 sem sessão; frontend de login pode estar incompleto.
- **Erros tsc pré-existentes** em `FilesView.tsx` (trabalho paralelo em andamento na época).

## 8. Arquivos e referências

- Plano fonte: `C:\Users\Marcelo\Desktop\PLANO-EVOLUCAO-CENTRAL-AUDITORIA.html` (§Fase 3, §API)
- Novos: `server/centralEvents.ts`, `centralExecutions.ts`, `centralNotify.ts`, `centralMetrics.ts`, `centralGithub.ts`
- Alterados: `server/centralApi.ts`, `src/components/CentralAuditView.tsx`, `.env` (criado, gitignored)
- Dados: `central/estado/executions/*.jsonl`, `central/estado/coordinator-runs/`, `central/estado/locks/`, `central/estado/worktrees.json`
- Commits: `e19ab55` (meu fix), `4f2d68c`, `44d73ca`, merges PRs #2–#4
- Teste real: PR https://github.com/MaarkssDN/Birthub-360/pull/423 (existente, não criado)
- Handoff consolidado do dia: `central/HANDOFF-ENCERRAMENTO-20261120.md`

## 9. Próximos passos

1. Nova central deve ler `central/HANDOFF-ENCERRAMENTO-20261120.md` (visão completa: lote 2 EM_EXECUÇÃO, ~11 deferred, PRs #473–#476).
2. Usuário define `CENTRAL_NOTIFY_WEBHOOK` e reinicia o servidor.
3. Fase 4 restante: auth/write-protection já existe parcialmente; persistência SQLite existe (`server/db.ts`); falta suite de testes e graceful shutdown.
4. Quando F1 adapters rodarem de verdade, emitir `exec_heartbeat`/`exec_output` no barramento para o painel ao vivo mostrar tail de log.

## 10. Instruções de continuidade

- Repositório principal: `C:\Github\Central-de-Auditoria-e-Handoffs` (branch `main`, sincronizado com origin).
- Servidor: `npm run dev` → `http://localhost:3000` (tsx server.ts; PORT via env).
- Testes de tipo: `npx tsc --noEmit` (erros conhecidos em `FilesView.tsx` de trabalho paralelo).
- Convenções: handoffs em `central/ondas/<onda>/handoffs/*.md`; estado em `central/estado/`; decisões humanas em `central/decisoes/PENDENTES.md`; state machine validada em `server/phase1/stateMachine.ts`.
- Não executar mutações em handoffs sem passar pela API (state machine rejeita transições inválidas).
