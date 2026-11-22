# 04 — DIAGNÓSTICO TÉCNICO

## 1. Arquitetura da plataforma Central (repo `Central-de-Auditoria-e-Handoffs`)

App full-stack local: **React 19 + Vite 8 + Tailwind 4** (frontend) e **Express + tsx + SQLite (`better-sqlite3`-style via `server/db.ts`)** (backend), single-process em `server.ts` (~600 linhas).

### Backend (`server/`, 36 arquivos .ts)

| Módulo | Arquivos | Estado |
|---|---|---|
| Bootstrap/rotas | `server.ts`, `server/auth.ts`, `server/providers.ts`, `server/fsApi.ts`, `server/agentRuntime.ts` | Funcional; auth local scrypt+cookie OK |
| Núcleo da Central | `centralApi.ts`, `centralStore.ts`, `coordinator.ts`, `waveOnboarding.ts` | Funcional; state machine validada |
| Fase 1 (execução) | `phase1/{locks,stateMachine,executions,worktree,adapters}.ts` | Implementado e testado |
| Fase 3 (observabilidade) | `centralEvents.ts`, `centralExecutions.ts`, `centralNotify.ts`, `centralMetrics.ts`, `centralGithub.ts`, `centralReport.ts` | Implementado; webhook sem URL configurada |
| Fase 4 (robustez) | `persistence.ts` (atomic write + file locks), `taskQueue.ts` (semaphore), `db.ts` (SQLite) | Implementado; 89 testes verdes |
| **Não commitado (21/11)** | `geminiService.ts`, adapters `gemini`, rotas `/api/gemini/*`, `/chat/messages`, `/db-stats`, chat_messages table | **Funcional (testes verdes) mas não commitado/revisado** |

### Pontos fortes verificados

- State machine de handoffs com rejeição de transições inválidas.
- Locks com lease/expiry/stale recovery; worktrees órfãos listados (nunca deletados).
- Escrita atômica (tmp+rename) em estado; execução JSONL append-only + eventos SSE.
- Auth obrigatória em `/api` (exceto `/api/auth`); FS sandbox com raízes permitidas.
- Semântica de queue com `CENTRAL_MAX_CONCURRENCY` e graceful shutdown.
- Typecheck limpo, 89 testes, build OK **hoje**.

### Dívidas técnicas da plataforma (verificadas)

| ID | Domínio | Descrição | Severidade |
|---|---|---|---|
| DT-01 | Persistência/estado | Dois execution logs coexistem (`centralExecutions.ts` JSONL vs `phase1/executions.ts` JSON) — consolidar | Média |
| DT-02 | Estado versionado | `central/estado/` parcialmente tracked (locks/fila/estado volátil misturados com código) — política de versionamento indefinida | Média |
| DT-03 | Observabilidade | Adapters não emitem `exec_heartbeat`/`exec_output` — painel ao vivo mostra só dispatch/status/PR | Baixa |
| DT-04 | Segurança | Gate de criação de PR não exige parecer 24 APROVADO (manual); senha fallback `birthhub360`; multi-usuário/roles ausente (futuro no plano) | Média |
| DT-05 | Qualidade | Warning de chunk >500kB no build; `LandingPage.tsx`/`film.css` órfãos; sem code-splitting | Baixa |
| DT-06 | Integração | `CENTRAL_NOTIFY_WEBHOOK` vazio; `getAdapter('gemini')` depende de `GEMINI_API_KEY` não documentada em `.env.example` (verificar) | Baixa |
| DT-07 | Processo | Sessões paralelas commitaram direto na main e deixaram trabalho não commitado — falta handoff obrigatório de encerramento | Média |

## 2. Estado do produto auditado (Birthub-360)

- Veredito **NO-GO** mantido (parecer 24 sobre a auditoria; a auditoria em si foi APROVADA como documento).
- Auditoria forense: ~60 débitos catalogados (DEBT-0001…0058+), P0=4, P1=22, P2≈34+, P3 dezenas.
- Verificação item-a-item de 22/11 (checklist HTML, evidência arquivo:linha em `main @ 5174664b2`):
  - **1 handoff CONCLUÍDO** (00→24 revisão).
  - **12 PARCIAIS** — maioria dos P1/P2 endereçada, P1s relevantes abertos.
  - **1 PRECISA MELHORIA** (00→00 higiene: design-lab público, `@ts-nocheck`, deps mortas).
  - **1 NÃO FEITO** (00→01A retenção — bloqueado por D-04).
  - **4 EM EXECUÇÃO mortas** (01A/02/04/05).
  - **10 PENDENTE**.
- P1s críticos abertos (promovidos por D-02/D-03/D-05): DEBT-0004 (mobile Day-1), DEBT-0005 (SSRF), DEBT-0007 (segredo 3CX global), DEBT-0012 (ReAct fora do gateway), DEBT-0013 (consentimento env-only), DEBT-0017, DEBT-0019, DEBT-0022 (PII voz), DEBT-0028.
- RLS **não aplicada** (DEBT-0057/0058/DB-08) — débito P0 de segurança aberto; exige migrations dedicadas.
- Restore de backup **nunca executado de verdade**; depende de credenciais no host (D-01).
- assetlinks.json não publicado; App Links Android não verificam.
- Waivers Trivy vencem **2026-11-30** (ARQ-13) — urgente se houver corte de release.
- Branches `agente/*` não mergeadas com conteúdo possivelmente duplicado — reconciliar antes de re-despachar (Trava de Mutação residual).

## 3. Integrações reais vs cadastradas

| Integração | Estado real |
|---|---|
| GitHub (`gh` CLI + API) | **Funcional** — `centralGithub.ts` resolveu PR #423 real; scopes `repo` |
| Gemini API | **Funcional no código não commitado** — `geminiService` + adapter + rotas; requer `GEMINI_API_KEY` |
| Providers Codex/Claude/ChatGPT/etc. | Catálogo existe (`providers.ts`, `registry.json`); adapters `cli`/`devin`/`manual`/`mock` implementados; `subagente` declarado mas sem implementação dedicada (usa prompt enfileirado) |
| Discord/Slack webhook | Código pronto; **sem URL configurada** |
| SSE/painel ao vivo | Funcional para eventos emitidos; adapters não emitem heartbeat/output |

## 4. Conclusão do diagnóstico

A plataforma Central está **arquiteturalmente sólida e testada** (89 testes verdes hoje), mas operacionalmente **estagnada desde 19/11**: todas as execuções morreram com as sessões, locks expiraram, e uma sessão de 21/11 deixou ~870 linhas de funcionalidade nova (Gemini) não commitada nem documentada. O produto Birthub-360 permanece em **NO-GO** com 10 handoffs PENDENTE e 4 execuções mortas a re-despachar.
