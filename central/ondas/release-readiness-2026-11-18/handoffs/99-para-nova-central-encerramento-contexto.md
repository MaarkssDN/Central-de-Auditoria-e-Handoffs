# HANDOFF — CENTRAL DE AUDITORIA E HANDOFF

- **Origem:** Central de Auditoria e Handoffs (Devin CLI)
- **Destino:** Nova Central de Coordenação
- **Data:** 2026-11-20
- **Status:** Parcial — Fase 1 implementada e publicada; fases seguintes e execuções de handoffs seguem pendentes.

## 1. Objetivo da central

Evoluir a Central de Auditoria e Handoffs de dashboard/API local para backbone de execução da "Onda release-readiness-2026-11-18" (repositório alvo: Birthub-360). Escopo desta conversa: ler `C:\Users\Marcelo\Desktop\PLANO-EVOLUCAO-CENTRAL-AUDITORIA.html` e executar a **Fase 1** do plano.

## 2. Projetos atendidos

| Projeto | Escopo |
|---|---|
| Central-de-Auditoria-e-Handoffs (`C:\Github\Central-de-Auditoria-e-Handoffs`) | Implementação da Fase 1: locks/lease, execution log, máquina de estados, adapters de provider, worktrees, endpoints e testes. |
| Birthub-360 | Repositório-alvo dos handoffs da onda (não modificado nesta conversa). |

## 3. Trabalhos realizados

- Criados módulos `server/phase1/`: `locks.ts`, `stateMachine.ts`, `executions.ts`, `worktree.ts`, `adapters.ts` (+ `phase1.test.ts`).
- Integrado `centralStore.ts`: `updateHandoffStatus` valida transições na máquina de estados e grava `STATUS_TRANSITION` no log; `queueDispatch` faz `claimLock` e retorna `conflict`.
- Integrado `centralApi.ts`: `GET /locks`, `POST /locks/claim|release|renew`, `GET /worktrees` (com `orphaned`), `POST /dispatch/execute`; `/dispatch` e `/dispatch/execute` retornam **HTTP 409** com `owner`/`expiresAt` em lock vigente.
- Adapters: `cli` (spawn real + exit code), `devin` (cria sessão e polling até terminal), `mock`, `manual`.
- Verificação: `tsc --noEmit` limpo; 65/65 testes passando; smoke real em `PORT=3100` (porta 3000 ocupada por outra instância) confirmando 409, execução CLI real (exit 0) e release.
- Git: commit `75c63b2` (Fase 1 + trabalho paralelo pendente) e `215d818` (gitignore de dirs de ferramentas) pushed para `origin/main`.

## 4. Trabalhos pendentes

- **Fases 2+ do plano de evolução** (coordenação autônoma, observabilidade GitHub ao vivo, robustez) — não iniciadas nesta conversa.
- **19 handoffs da onda release-readiness-2026-11-18** — grande parte PENDENTE; algumas marcadas AGUARDANDO_24/BLOQUEADO por sessões paralelas.
- **Decisões humanas D-01 a D-07** em `central/decisoes/PENDENTES.md` — bloqueiam severidades e escopo (retention defaults, consentimento IA, veredito de módulos gated etc.). D-07 parcialmente resolvida via Etapa 0.
- **Drop do stash** `chore/salvage-stash-00` (Birthub-360) pendente de confirmação.
- Executar `/dispatch/execute` de ponta a ponta contra worktree real e provider `devin` (só testado com mock/fetch simulado).

## 5. Inventário de handoffs

Handoffs da onda ficam em `central/ondas/release-readiness-2026-11-18/handoffs/` (20 arquivos `00-para-*` + `INDEX.md`). Nesta conversa **nenhum handoff foi auditado ou executado** — apenas usado como alvo de smoke test de locks (status revertido após o teste). Estado atual dos status deve ser lido via `GET /api/central/state`.

## 6. Decisões e critérios

- Transições de status inválidas são rejeitadas (ex.: PENDENTE→CONCLUÍDO direto).
- Lock expirado pode ser retomado por outro executor (`stolen: true`); worktrees órfãos de locks expirados são **listados para limpeza manual**, nunca deletados automaticamente.
- Toda mudança de status gera registro no execution log (`central/estado/executions/`).
- Compatibilidade mantida com rotas legadas `/handoffs/status` e `/dispatch` usadas pelo frontend.
- `.gitignore` passou a excluir `.agent/ .agents/ .claude/ .codex/ .devin/ .gemini/` e `central/estado/{coordinator-runs,executions}/`.

## 7. Problemas e riscos

- **Concorrência de sessões**: outra sessão/agente commitou fases 3/4 e PRs (#1–#4) durante o trabalho; working tree tinha ~346 arquivos modificados de origem paralela, commitados juntos a pedido do usuário.
- **Dois sistemas de execution log coexistem**: `centralExecutions.ts` (JSONL diário + SSE, oficial da API) e `phase1/executions.ts` (JSON por executionId). Ambos recebem eventos; avaliar consolidação.
- **Estado volátil commitado**: `central/estado/central-state.json`, `worktrees.json`, `fila/` aparecem como modificados/não rastreados — risco de sujeira no git.
- Locks de smoke test foram liberados e handoff revertido; `estado/fila/` contém prompts de despacho de outras sessões.
- Porta 3000 pode estar ocupada por instância antiga do servidor — reiniciar após deploy de novo código.

## 8. Arquivos e referências

- Plano: `C:\Users\Marcelo\Desktop\PLANO-EVOLUCAO-CENTRAL-AUDITORIA.html`
- Código: `server/phase1/{locks,stateMachine,executions,worktree,adapters}.ts`, `server/centralStore.ts`, `server/centralApi.ts`, `server/centralExecutions.ts`, `server/centralEvents.ts`
- Testes: `server/phase1/*.test.ts`, `server/*.test.ts`, `src/utils/governanceEngine.test.ts`
- Estado: `central/estado/{locks,executions,worktrees.json,fila,central-state.json}`, `central/agents/registry.json`, `central/decisoes/PENDENTES.md`
- Handoffs: `central/ondas/release-readiness-2026-11-18/handoffs/` + `auditoria/etapa0-reconciliacao-prs.md`
- Git: `origin/main` @ `215d818` (após este handoff pode haver commits posteriores de outras sessões)

## 9. Próximos passos

1. Nova central: ler `GET /api/central/state` e `PENDENTES.md` para recompor prioridades.
2. Retomar Fase 2 do plano (coordenação autônoma) ou despachar handoffs via `POST /dispatch/execute`.
3. Resolver D-01–D-07 com o Orquestrador Humano.
4. Considerar consolidar os dois execution logs e ignorar `central/estado/` volátil no git.

## 10. Instruções de continuidade

- Autenticação da API: `POST /api/auth/login` (admin `marcelinmark@gmail.com`, senha inicial `birthhub360` ou `CENTRAL_ADMIN_PASSWORD`) — cookie de sessão necessário para `/api/central/*`.
- Servidor: `node node_modules/tsx/dist/cli.mjs server.ts` (ou `npm run dev`); porta via `PORT` (default 3000).
- Testes: `node node_modules/tsx/dist/cli.mjs --test server/phase1/*.test.ts server/*.test.ts src/utils/governanceEngine.test.ts`; typecheck: `node node_modules/typescript/bin/tsc --noEmit`.
- Não executar commits/push sem instrução explícita do Orquestrador Humano.
