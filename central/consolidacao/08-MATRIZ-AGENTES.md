# 08 — MATRIZ DE AGENTES E RESPONSÁVEIS

## A. Agentes do produto Birthub-360 (donos de handoffs da onda)

Identificadores conforme `handoffs/INDEX.md` e prompts `.agents/prompts/` do produto. **Não inventados** — todos constam nos handoffs.

| ID | Especialidade | Handoffs | Slots/regras |
|---|---|---|---|
| 00 | Coordenador global / decisões e higiene | 00→00 | Coordenador; não executa fixes de domínio |
| 01 | Schema/RLS/migrations | 00→01 | Dono exclusivo de `prisma/schema.prisma` e migrations; slot exclusivo com 01A |
| 01A | Retenção de dados | 00→01A | Slot exclusivo com 01; depende D-04 |
| 02 | Produto/UX | 00→02 | — |
| 04 | CRM/BI | 00→04 | — |
| 05 | Prospecção/outbound | 00→05 | — |
| 06 | Integrações/Bitrix/voz | 00→06 | Slot exclusivo com 06A; absorver DEBT-0020 |
| 07 | IA gateway/custos | 00→07 | — |
| 08 | QA/gates | 00→08 | Slot exclusivo com 08A; dono de ARQ-13/waivers |
| 09 | Mobile/Capacitor | 00→09 | Decisão D-02: mobile no escopo Day-1 |
| 10 | Infra/backup/deploy | 00→10 | — |
| 12 | Voz/LGPD/workers | 00→12 | — |
| 13 | Enxame/consentimento IA | 00→13 | D-05: consentimento persistido |
| 15 | Segurança de rotas | 00→15 | Investigar execução fantasma antes |
| 16 | Workers/filas | 00→16 | — |
| 17 | Cadência | 00→17 | — |
| 18 | Contratos de API | 00→18 | Coordenar com 05 (DEBT-0011/0044) e 07 |
| 21 | LGPD/voz/consentimento | 00→21 | Apoio a 13 (DEBT-0013 co) |
| 24 | Revisão independente | todos | Parecer obrigatório antes de CONCLUÍDO/merge |

**Regras vigentes** (`COORDENADOR.md` + handoff mestre §6): máx 3–4 executores simultâneos; slots exclusivos 01/01A, 06/06A, 08/08A; arquivos protegidos (`server.ts`, `package.json`, lockfiles, `prisma/schema.prisma` só do 01, `AGENTS.md`, `.agents/prompts/**`); executor nunca faz push/merge; worktree isolado por executor.

## B. Provedores de execução disponíveis à Central (plataforma)

Fonte: `central/agents/registry.json` + `estado/agentes-disponiveis.json` (detectado 18/11 — **re-rodar `detect-agents.mjs` antes de despachar**).

| ID | Tipo | Disponibilidade | Uso recomendado |
|---|---|---|---|
| devin | subagente (`subagent_general`) | **Disponível sempre** nesta sessão | Executor padrão p/ trabalho autônomo |
| claude-code | CLI headless | Não confirmado (detect de 18/11) | Se instalada: `claude -p` no worktree |
| codex-cli | CLI headless | Não confirmado | Se instalado: `codex exec` |
| antigravity | manual | Sem CLI headless | Prompt em `estado/fila/` p/ humano colar |
| github-copilot | manual | Shim interativo | Prompt em fila |
| chatgpt-api / grok-api / gemini-api | API | Chaves em Conexões de IA | Tarefas de geração/análise, não execução de repo |
| generico | manual | Sempre | Pacote de prompt para qualquer agente |

**Atenção:** o adapter `gemini` novo (não commitado) permite executar handoffs via API Gemini — funcional mas não revisado; tratar como experimental até CENTRAL-0001 ser integrado e testado.

## C. Matriz de despacho proposta (ondas A–D)

| Onda | Missão | Agente/Executor | Escopo | Prioridade | Dependências | Status |
|---|---|---|---|---|---|---|
| A | CENTRAL-0001 preservar trabalho Gemini | devin (subagente) ou humano | server/, src/, 2 testes | P0 | Autorização p/ commitar trabalho alheio | PREPARADO (16) |
| A | CENTRAL-0021 reconciliar branches produto | devin (subagent_explore, read-only) | C:\Github\Birthub-360 | P0 | — | PREPARADO (16) |
| A | CENTRAL-0023/0024 verificar worktrees+handoff15 | devin (subagent_explore) | Birthub-360-wt | P0/P1 | — | PREPARADO (16) |
| A | CENTRAL-0022 revisões 24 ×4 | Agente 24 (subagent_explore) | PRs #473–476 | P0 | Prompts já em fila/ | PREPARADO |
| A | CENTRAL-0003/0004 saneamento estado+docs | devin/coordenador | central/estado, INDEXs | P1 | — | PREPARADO |
| B | CENTRAL-0026a RLS/migrations | Agente 01 (slot exclusivo) | prisma/schema, migrations | P0 | Onda A | AGUARDANDO |
| B | CENTRAL-0020 ARQ-13 waivers Trivy | Agente 08 | .github/workflows, docs | P0 | Decisão de release | AGUARDANDO_APROVACAO |
| B | Re-despacho 01A/02/04/05 | agentes 01A/02/04/05 | conforme handoffs | P0 | Resultado Onda A | AGUARDANDO |
| B | Despacho PENDENTE (06,07,08,12,13,15,17,18,21,00) | donos | conforme handoffs | P1 | Slots + deps | AGUARDANDO |
| C | Merges produto + gates + veredito | Humano + 00 | repo produto | P1 | Onda B + D-01/D-04 | AGUARDANDO_APROVACAO |
| D | CENTRAL-0005..0016 plataforma | designar por item | server/, src/, git | P2/P3 | Decisões humanas | PARCIALMENTE PREPARADO |

## D. Papéis da própria Central

- **Coordenador (este agente/00-da-central):** lê estado, seleciona lotes, despacha, acompanha, mantém checkpoint. Não executa fixes.
- **Revisor independente:** Agente 24 do produto (para entregas do produto) / revisão documental para a plataforma (não há agente 24 formal da Central — ver decisão pendente em 12).
