# 15 — MEMÓRIA OPERACIONAL (continuidade entre sessões)

> Leia este arquivo primeiro ao assumir a coordenação. Ele é autocontido; aprofunde nos documentos citados apenas quando necessário.

## O que é a Central

Plataforma local (`C:\Github\Central-de-Auditoria-e-Handoffs`, app em `localhost:3000` via `npm run dev`) que orquestra auditorias e handoffs de correção sobre o produto **Birthub-360** (`C:\Github\Birthub-360`). Fluxo: auditoria → débitos DEBT-XXXX → handoffs `00-para-*` por agente-dono → executores em worktrees isolados (`C:\Github\Birthub-360-wt\ag-*`) → evidência de gates → revisão independente do Agente 24 → merge sob ordem aprovada.

## Verdades absolutas (não re-auditar)

- Veredito do produto: **NO-GO**. Auditoria forense completa em `central/ondas/release-readiness-2026-11-18/auditoria/` (inventario-mestre DEBT-0001…0058).
- Etapa 0 (reconciliação PRs) **executada**; FREEZE LIFTED; merge order aprovada.
- Decisões D-02/03/05/06 respondidas; D-01 (envs EC2) não verificável sem host; D-04 tem defaults não ratificados.
- Checklist item-a-item dos 19 handoffs: `CHECKLIST-HANDOFFS-RELEASE-READINESS.html` (raiz) — **não refazer**; é a fonte da verificação.
- Plataforma: Fases 1–4 implementadas; 89 testes verdes; tsc/build limpos em 22/11.

## Estado real em 22/11 (resumo — detalhe em 01/02)

- **Produto:** 4 handoffs AGUARDANDO_24 (01/09/10/16 → PRs #473–476); 4 EM_EXECUÇÃO provavelmente mortos (01A/02/04/05, locks expirados 19/11); 10 PENDENTE; 1 handoff (00→00) precisa melhoria; 1 (00→24) concluído.
- **Plataforma:** working tree tem ~870 linhas não commitadas de 21/11 (provedor Gemini + persistência chat + UI) — funcional mas sem handoff/commit. **Risco de perda ativo.**
- **Git Central:** branch `chore/handoff-devin-versionamento-20261121` publicada, PR #12 aberto; PRs #9–11 abertos sobrepostos; main sincronizada.
- **Docs desta consolidação:** `central/consolidacao/00..17` — backlog em `05`, decisões em `12`, próximo passo em `16`.

## Como operar (rotina do coordenador)

1. `git status` + `git log` — confirmar estado antes de qualquer coisa.
2. Ler `central/estado/central-state.json` → `ondas/INDEX.md` → `decisoes/PENDENTES.md` (ordem do COORDENADOR.md).
3. Estado da onda: statuses reais estão nos próprios arquivos `handoffs/*.md` (`- Status:`), não só no JSON.
4. Despacho: `node agents/detect-agents.mjs` se CLIs mudaram → `agents/dispatch.mjs --handoff <> --agent devin --worktree <>` ou `run_subagent` direto.
5. Locks em `estado/locks/` expiram em 1h; execuções mortas deixam locks stale — verificar `expiresAt` antes de assumir bloqueio.
6. Nunca `git add -A`; staging explícito; nunca push/merge sem autorização.
7. Worktrees do produto em `C:\Github\Birthub-360-wt\`; um agente por worktree.

## Armadilhas conhecidas

- `server.ts`/`package.json`/lockfiles/`schema.prisma` são protegidos — não deixar executor tocar.
- Slots exclusivos: 01↔01A, 06↔06A, 08↔08A.
- `central-state.json` é reescrito por `saveJsonAtomic` com formatação expandida — diffs grandes normais.
- Porta 3000 pode estar ocupada por instância antiga — usar `PORT=<outra>`.
- `data/` é gitignored; `central/estado/coordinator-runs/` e `executions/` também.
- O arquivo `nul` pode reaparecer se usar `2>nul` no Git Bash — use `2>/dev/null`.
- D-01/D-04: não improvisar; defaults conservadores registrados em PENDENTES.md.
- Merge order do produto precisa ser **re-emitida** após Onda A (branches reconciliadas).

## Pendências quentes (ordem de ataque)

1. **CENTRAL-0001** — commitar trabalho de 21/11 (único risco de perda ativo).
2. **CENTRAL-0020** — waivers Trivy (vence 30/11).
3. **CENTRAL-0021/0023** — reconciliar branches e worktrees antes de re-despachar.
4. **CENTRAL-0022** — pareceres 24 dos 4 AGUARDANDO_24 (desbloqueia merges).
5. **CENTRAL-0026a** — RLS/migrations (P0 segurança).
6. Decisões humanas HD-01..HD-13 (`12-DECISOES-HUMANAS.md`).

## Documentos oficiais (mapa)

| Preciso de... | Vá em... |
|---|---|
| Fotografia forense completa | `consolidacao/01-ESTADO-GLOBAL-CENTRAL.md` |
| Inventário de handoffs | `consolidacao/02` + `CHECKLIST-HANDOFFS-RELEASE-READINESS.html` |
| O que falta fazer | `consolidacao/05-BACKLOG-MESTRE.md` |
| Ordem de execução | `consolidacao/06` + `07-PLANO-ONDAS.md` |
| Quem faz o quê | `consolidacao/08-MATRIZ-AGENTES.md` |
| O que depende de quê | `consolidacao/09-MATRIZ-DEPENDENCIAS.md` |
| Riscos | `consolidacao/11-MATRIZ-RISCOS.md` |
| Decisões pendentes | `consolidacao/12` + `decisoes/PENDENTES.md` |
| Testes | `consolidacao/13-PLANO-TESTES.md` |
| Merges/PRs | `consolidacao/14-PLANO-INTEGRACAO.md` |
| Próximos despachos prontos | `consolidacao/16-PROXIMOS-DESPACHOS.md` |
| Relatório executivo | `consolidacao/17-RELATORIO-EXECUTIVO.md` |
