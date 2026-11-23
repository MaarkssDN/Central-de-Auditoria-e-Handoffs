# 05 — BACKLOG MESTRE CONSOLIDADO

IDs `CENTRAL-XXXX`. Prioridades: **P0** crítica · **P1** alta · **P2** média · **P3** baixa.
Duas trilhas: **[P]** = plataforma Central (este repo) · **[B]** = produto Birthub-360 (handoffs da onda).

## Trilha P — Plataforma Central

| ID | Título | Origem | Módulo | Prioridade | Status | Responsável |
|---|---|---|---|---|---|---|
| CENTRAL-0001 | Preservar e integrar trabalho não commitado de 21/11 (Gemini service + adapter, chat_messages, rotas /api/gemini, UI AuditReview/HandoffsCenter/FilesView, 2 testes novos) | Diagnóstico 01 §2 | server/, src/ | **P0** | PENDENTE — risco de perda ativo | 00→designar executor + revisão |
| CENTRAL-0002 | Decidir e executar destino dos PRs documentais #9, #10, #11, #12 (sobrepostos) | Diagnóstico 01 §4 | git/PRs | **P1** | AGUARDANDO_APROVACAO | Humano + 00 |
| CENTRAL-0003 | Reconciliar estado vivo: locks expirados (8), fila (12 prompts), worktrees.json, executions — limpar/arquivar com registro | Diagnóstico 01 §3 | central/estado | **P1** | PENDENTE | 00/coordenador |
| CENTRAL-0004 | Atualizar documentos-fonte desatualizados: `handoffs/INDEX.md`, `central-state.json` (waveStatus×nextStep contraditórios), `ondas/INDEX.md` | Relatório 03 §D | central/ | **P1** | PENDENTE | 00 |
| CENTRAL-0005 | Definir política de versionamento de `central/estado/` (o que é trackeado vs runtime) | DT-02 | git/.gitignore | **P2** | PENDENTE — decisão humana | Humano |
| CENTRAL-0006 | Consolidar os dois execution logs (JSONL diário vs JSON por execução) | DT-01 | server/ | **P2** | PENDENTE | designar |
| CENTRAL-0007 | Emitir `exec_heartbeat`/`exec_output` nos adapters p/ painel ao vivo | DT-03 | phase1/adapters | **P3** | PENDENTE | designar |
| CENTRAL-0008 | Exigir parecer 24 APROVADO como gate automático antes de `POST /github/pr` | DT-04 | centralGithub/centralApi | **P2** | PENDENTE | designar |
| CENTRAL-0009 | Trocar senha admin fallback `birthhub360`; documentar `GEMINI_API_KEY`/`CENTRAL_DB_PATH` em `.env.example` | DT-04/06 | auth/env | **P2** | PENDENTE | Humano (senha) + designar |
| CENTRAL-0010 | Remover código órfão `LandingPage.tsx`/`film.css` ou reintroduzir landing (decisão pendente desde 20/11) | estado/handoff-encerramento §7 | src/ | **P3** | AGUARDANDO_APROVACAO | Humano |
| CENTRAL-0011 | Resolver warning chunk >500kB (code-split do bundle) | DT-05 | vite | **P3** | PENDENTE | designar |
| CENTRAL-0012 | Avaliar remoção de worktrees/branches obsoletas deste repo (handoff-central, handoff-update, consolidation_plan, chore/* mergeadas) | Diagnóstico 01 §1 | git | **P3** | AGUARDANDO_APROVACAO | Humano |
| CENTRAL-0013 | Configurar `CENTRAL_NOTIFY_WEBHOOK` (Discord/Slack) — código pronto | FASE3 §4 | env | **P3** | AGUARDANDO_APROVACAO | Humano |
| CENTRAL-0014 | Multi-usuário/roles — marcado "Futuro" no plano de evolução | FASE4 | auth | **P3** | PENDENTE | Humano decide prioridade |
| CENTRAL-0015 | Validar itens "NÃO VERIFICADO" do checklist HTML: UX-04/09, QA-05/06, ARQ-13, IA-10, API-09..12 | Checklist HTML | auditoria produto | **P2** | PENDENTE | designar validador |
| CENTRAL-0016 | Auditar handoffs fora da onda no produto (`.agents/handoffs/`, `handoff-*.md` raiz do Birthub) — P-03 herdado | Checklist §5 | produto | **P3** | PENDENTE | designar |

## Trilha B — Produto Birthub-360 (onda release-readiness-2026-11-18)

| ID | Título | Origem | Agente | Prioridade | Status | Dependências |
|---|---|---|---|---|---|---|
| CENTRAL-0020 | **URGENTE** ARQ-13: waivers Trivy vencem 2026-11-30 — renovar ou cortar SHA candidato | Handoffs 08/10, handoff mestre §7 | 08/10 | **P0** | PENDENTE | Decisão de release do humano |
| CENTRAL-0021 | Reconciliar branches `agente/*` não mergeadas × main (diff-a-diff; Trava de Mutação residual) | Checklist §9, HANDOFF mestre §7 | 00 | **P0** | PENDENTE | Acesso ao repo produto |
| CENTRAL-0022 | Revisão 24 dos 4 AGUARDANDO_24 (01→PR#476, 09→#475, 10→#473, 16→#474) + 4 reviews enfileirados | HANDOFF mestre §4 | Agente 24 | **P0** | PENDENTE (prompts prontos em fila/) | — |
| CENTRAL-0023 | Verificar/re-despachar lote 2 morto: 01A, 02, 04, 05 (locks expirados, worktrees prontos) | Diagnóstico 01 §3 | 01A/02/04/05 | **P0** | EM_EXECUÇÃO-fantasma → re-despachar | CENTRAL-0021 primeiro |
| CENTRAL-0024 | Investigar handoff 15 (execução exit 0 sem Status) | HANDOFF mestre §7 | 00 | **P1** | PENDENTE | — |
| CENTRAL-0025 | Despachar 10 handoffs PENDENTE: 00, 06(+DEBT-0020), 07, 08, 12, 13, 15, 17, 18, 21 | INDEX handoffs | vários | **P1** | PENDENTE | Slots exclusivos; deps em 09-MATRIZ |
| CENTRAL-0026 | Criar handoffs derivados: RLS/migrations reais (DEBT-0057/0058/DB-08, branch integracao/schema-*), clusters mobile DEBT-0025 (reintegração pós-D-06) | HANDOFF mestre §4/§9 | 01/09 | **P0** (RLS) / P1 (mobile) | PENDENTE | Schema PR #476 mergeado ou reconciliado |
| CENTRAL-0027 | P1s abertos do produto: DEBT-0004 mobile, 0005 SSRF, 0007 3CX, 0012 ReAct, 0013 consentimento, 0017, 0019, 0022 voz PII, 0028 | Checklist HTML | donos por handoff | **P0/P1** | PENDENTE | Cobertos por CENTRAL-0023/0025/0026 |
| CENTRAL-0028 | Ratificar D-04 (janelas retenção) e verificar D-01 (envs EC2) — bloqueiam 01A e severidades | decisoes/PENDENTES | Humano | **P0** | AGUARDANDO_APROVACAO | Humano |
| CENTRAL-0029 | Executar drill real de restore de backup no host EC2 | HANDOFF mestre §7 | 10 + humano | **P1** | BLOQUEADO (D-01) | CENTRAL-0028 |
| CENTRAL-0030 | Publicar assetlinks.json + DNS/TLS p/ App Links Android | Handoff 09 Resolução | 09/10/08 | **P1** | PENDENTE | D-02 (respondida: SIM) |
| CENTRAL-0031 | Merge da ordem aprovada de PRs do produto (#401/#413→#415→saneamento→antigos→docs) + PRs #473–476 pós-parecer24 | D-07 / HANDOFF mestre | Humano + 00 | **P1** | AGUARDANDO_APROVACAO | Pareceres 24 (CENTRAL-0022) |
| CENTRAL-0032 | Drop do stash `chore/salvage-stash-00` (Birthub) após confirmação | D-07 | Humano | **P3** | AGUARDANDO_APROVACAO | Confirmação humana |
| CENTRAL-0033 | Limpar `@ts-nocheck` (4 componentes), design-lab público, deps mortas — handoff 00→00 | Checklist HTML | 00/08 | **P2** | PENDENTE | — |

## Regras do backlog

- Um handoff = uma linha quando possível; pendências duplicadas entre handoffs foram unificadas (ex.: DEBT-0013 aparece em 13 e 21 → CENTRAL-0025 cobre ambos, 13 é o dono primário).
- Nada marcado CONCLUÍDO sem evidência (commit+gate+parecer 24 para o produto; teste/build para a plataforma).
- Itens AGUARDANDO_APROVACAO **não** podem ser executados pelo agente sem resposta humana.
