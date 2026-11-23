# HANDOFF — CENTRAL DE AUDITORIA E HANDOFF

- **Origem:** Central de Auditoria e Handoff (Devin Desktop, Marcelo)
- **Destino:** Nova Central de Coordenação
- **Data:** 2026-11-20
- **Status:** PARCIAL — pipeline coordenador→worktree→execução→revisão 24→push/PR validado ponta a ponta; 4 handoffs entregues e aprovados, 4 em execução, ~11 deferred
- **Adendo 2026-11-21:** este documento foi publicado via PR #5 (`chore/handoff-central-auditoria-20261120`, merge `ce27d35`) e está em `main`. PRs #473–#476 (Birthub-360) permanecem **abertos, não mergeados** — merges aguardam gates de integração + merge order aprovado. PRs #7 e #8 (outros handoffs de encerramento) também mergeados em `main` (`84897a8`).

---

## 1. Objetivo da central

Evoluir a Central de Auditoria e Handoffs de ferramenta local/manual para **coordenador autônomo** do ecossistema Birthub-360: ler estado central + decisões humanas, selecionar handoffs executáveis, respeitar dependências/slots/concorrência/travas, criar worktrees isolados, despachar agentes, persistir evidências, enfileirar revisões 24h e mover concluídos para `AGUARDANDO_24`. Fase 2 (coordenador) implementada; Fases 3 e parte da 4 já existiam no repo (SSE, métricas, GitHub PR, auth local, SQLite).

## 2. Projetos atendidos

| Projeto | Path | Escopo |
|---|---|---|
| Central de Auditoria e Handoffs | `C:\Github\Central-de-Auditoria-e-Handoffs` | Coordenador (`server/coordinator.ts`), API (`server/centralApi.ts`), estado (`central/`), UI (edições do usuário preservadas) |
| Birthub-360 (app) | `C:\Github\Birthub-360` (+ worktrees `C:\Github\Birthub-360-wt\ag-*`) | Backend TS/Prisma/queues/mobile Capacitor — alvo dos handoffs |

Worktrees ativos: `ag-01`, `ag-09`, `ag-10`, `ag-16` (lote 1, concluídos) e `ag-01a`, `ag-02`, `ag-04`, `ag-05` (lote 2, EM_EXECUÇÃO sem commits).

## 3. Trabalhos realizados

- **Etapa 0 (reconciliação de PRs):** auditoria dos 26 débitos → `central/ondas/release-readiness-2026-11-18/auditoria/etapa0-reconciliacao-prs.md`. Freeze de mutação removido após aprovação do merge order (#401/#413 → #415 → saneamento AUD-1/ONDAS → antigos → docs).
- **Stash salvage:** `stash@{0}` do Birthub revisado; partes seguras salvas em `chore/salvage-stash-00` → **PR #429**; stash dropado após push autorizado. Descartados: docker-compose.services.yml (bug LIVEKIT_KEYS), alertmanager→blackhole, `.agents/runs/*`, globals.css.
- **Decisões humanas registradas** em `central/decisoes/PENDENTES.md` + `central-state.json`: D-02 mobile Day-1, D-03 voz/IA no escopo, D-05 consentimento IA persistido no banco, D-06 todos módulos liberados, D-07 resolvido. Defaults conservadores: D-01 (envs EC2 tratadas como ausentes até verificação), D-04 (janelas LGPD propostas, não ratificadas).
- **Coordenador validado ponta a ponta:** dry run → run real despachou 4 handoffs (run `run-2026-11-19T18-21-59-c2f3ee`); segundo run (`run-2026-11-19T21-00-16-f3e8e5`) despachou lote 2 e enfileirou 4 pareceres de revisão.
- **4 handoffs executados + revisados (Agente 24) + push + PRs:**
  - 00→10 infra-backup-deploy → `af70a8787`+review → **PR #473**
  - 00→16 workers-filqs → `bd8597e23`+review → **PR #474**
  - 00→09 mobile-decisao → `f797f15b7`+review → **PR #475**
  - 00→01 schema-rls-migrations → `150c1686c`+review → **PR #476**

## 4. Trabalhos pendentes

- Executar lote 2 (worktrees prontos, sem executor): `00→01A-retencao`, `00→02-ux-crm`, `00→04-crm-integridade`, `00→05-prospeccao-cold-email` — todos `EM_EXECUÇÃO`.
- ~11 handoffs deferred aguardam slots no próximo `coordinator/run`.
- Após execução do lote 2: revisar (Agente 24), push, PR.
- Handoffs derivados não criados ainda: RLS/migrations reais (DEBT-0057/0058/DB-08, branch `integracao/schema-*`), DEBT-0020 (transação Bitrix → 00→06), clusters mobile DEBT-0025 (reintegração pós-D-06), ARQ-13 waivers Trivy (vencem 2026-11-30), follow-ups dos pareceres 24.
- Gates de integração antes de merges: tsc/lint/testes/build + revisão.
- D-01: verificar envs no host EC2; D-04: ratificar retenções; drill de restore real no host.

## 5. Inventário de handoffs (onda `release-readiness-2026-11-18`)

| Handoff | Status | Resultado |
|---|---|---|
| 00→01 schema-rls-migrations | AGUARDANDO_24 → **APROVADO/PR #476** | env Bitrix fail-closed, companyId tenant, AUDITABLE_MODELS derivado do schema |
| 00→09 mobile-decisao | AGUARDANDO_24 → **APROVADO/PR #475** | App Link → app.birthhub360.com.br |
| 00→10 infra-backup-deploy | AGUARDANDO_24 → **APROVADO/PR #473** | migrate+healthcheck deploy, backup/restore reais, rollback runbook |
| 00→16 workers-filqs | AGUARDANDO_24 → **APROVADO/PR #474** | outbound consumers, queueDefaults, DLQ purge, métricas voice |
| 00→01A retencao | EM_EXECUÇÃO | worktree pronto, sem commits |
| 00→02 ux-crm | EM_EXECUÇÃO | idem |
| 00→04 crm-integridade | EM_EXECUÇÃO | idem |
| 00→05 prospeccao-cold-email | EM_EXECUÇÃO | idem |
| Demais ~11 | PENDENTE/deferred | aguardam slots do coordenador |

## 6. Decisões e critérios

- Slots exclusivos: `01↔01A`, `06↔06A`, `08↔08A`, `16↔06/07`, `02↔02A/02B/02C/02D`; `maxParallel=4`; P0→P1, P2+ espera.
- Nunca despachar durante freeze de mutação ou decisão bloqueante; dryRun explica exclusões.
- Executor: trabalhar só no worktree/branch designado, gates com evidência real, handoff → `AGUARDANDO_24` + seção Resolução; sem push/merge/deploy.
- Agente 24: parecer em `.agents/reviews/` com veredito APROVADO/REPROVADO/BLOQUEADO auditando P1–P4 + matriz de propriedade.
- Merge somente após revisão + gates de integração; merges seguem merge order aprovado (aguardam parecer 24 conforme governança).
- Ownership: schema/migrations→01; CRM/contacts→04; integrações/Bitrix/voz→06; QA/docs→08; mobile→09; infra→10; workers→16; `server.ts`/`package.json`/lockfiles→aprovação 00; `.agents/prompts/**`→humano.

## 7. Problemas e riscos

- **Fallback Bitrix agora off por default** (PR #476): orgs que dependiam do webhook global param de importar até opt-in via `BITRIX24_WEBHOOK_URL_ENABLED` + allowlist — comunicar antes do deploy.
- **Restore real nunca executado** — scripts corretos e fail-closed, mas sem `pg_dump`/credenciais locais; drill depende do host (D-01).
- **RLS não aplicada** — débitos P0 de segurança (DEBT-0057/0058/DB-08) ainda abertos; exigem migrations dedicadas.
- **ARQ-13**: waivers Trivy vencem 2026-11-30 — risco de bloqueio de release se SHA candidato for cortado antes.
- **assetlinks.json** não publicado — App Links Android não verificam até DNS+SHA-256 no domínio.
- Decisões D-01/D-04 seguem com defaults conservadores não ratificados.
- Trabalho do usuário na UI central (`src/App.tsx`, `DashboardView`, `Sidebar`, `index.css`, componentes Boot/Particles/Telemetry, `.tmp_frames/`) está **não commitado** no repo Central — não sobrescrever.
- PRs #401/#413/#415/#429 e demais antigos: estado de merge **não verificado** — não assumir merged.

## 8. Arquivos e referências

- Coordenador: `server/coordinator.ts`, `server/centralApi.ts`, `server/phase1/*`, `server/auth.ts`
- Estado: `central/estado/central-state.json`, `central/estado/coordinator-runs/`, `central/estado/fila/` (8 prompts de execução + 4 de revisão enfileirados)
- Onda: `central/ondas/release-readiness-2026-11-18/handoffs/*.md`, `auditoria/etapa0-reconciliacao-prs.md`, `auditoria/plano-saneamento.md`
- Decisões: `central/decisoes/PENDENTES.md`
- Servidor local: `http://localhost:3000` — auth `POST /api/auth/login` (admin `marcelinmark@gmail.com` / default `birthhub360` ou `CENTRAL_ADMIN_PASSWORD`); endpoint `POST /api/central/coordinator/run {wave, maxParallel, dryRun, repoPath}`
- Birthub: `AGENTS.md` (ownership §14/15), `.agents/prompts/`, `.agents/skills/agent-review-gate`
- Branches: `agente/01-*`, `09-*`, `10-*`, `16-*` (pushadas), `agente/01A-*`, `02-*`, `04-*`, `05-*` (locais), `chore/salvage-stash-00` (PR #429)
- Docs novas: `docs/deploy/ROLLBACK-RUNBOOK.md` (branch ag-10)

## 9. Próximos passos

1. Executar os 4 handoffs do lote 2 nos worktrees `ag-01a/ag-02/ag-04/ag-05` (ler prompt oficial `.agents/prompts/`, AGENTS.md, gates com evidência, → AGUARDANDO_24).
2. Novo `coordinator/run` quando slots liberarem (após lote 2 concluir) para os ~11 deferred.
3. Revisões 24 dos lotes seguintes → push → PRs.
4. Criar handoffs: RLS/migrations (01, branch integracao), DEBT-0020 (06), clusters mobile (pós-D-06), ARQ-13 urgente.
5. Verificar envs EC2 (D-01) e ratificar retenções (D-04); agendar drill de restore real.
6. Antes de qualquer merge: gates completos + confirmar estado real dos PRs via `gh`.

## 10. Instruções de continuidade

- Não assumir que PRs estão merged — verificar com `gh pr view`.
- Não executar merges/deploys/pushes fora das branches de agente sem autorização explícita do Orquestrador Humano (única exceção já usada: salvage branch autorizado).
- Todo trabalho de executor em worktree isolado `C:\Github\Birthub-360-wt\ag-*`; nunca tocar worktree de outro agente.
- Commits usam `git -c user.name="Devin" -c user.email="158243242+devin-ai-integration[bot]@users.noreply.github.com"` quando identidade não configurada.
- Evidência obrigatória: comando real + exit code em cada Resolução de handoff; proibido claim sem gate.
- Preservar alterações visuais do usuário no repo Central (não commitadas).
- Histórico completo da conversa anterior: `C:\Users\Marcelo\AppData\Roaming\devin\cli\summaries\history_3cdd172e891a4b2f.md`
