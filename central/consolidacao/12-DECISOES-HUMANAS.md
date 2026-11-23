# 12 — REGISTRO DE DECISÕES HUMANAS

Decisões já respondidas (registradas em `central/decisoes/PENDENTES.md`, **não** reabertas):

| ID | Assunto | Resposta | Status |
|---|---|---|---|
| D-02 | Mobile/Capacitor no Day-1? | SIM — entra no escopo | APROVADA |
| D-03 | Voz/telefonia e enxame IA no release? | SIM — entram no escopo | APROVADA |
| D-04 | Janelas de retenção LGPD | Defaults propostos; implementação pode prosseguir configurável; **ratificação formal pendente** | PENDENTE (parcial) |
| D-05 | Consentimento IA | Persistir no banco (`AiConsent`); env = kill-switch | APROVADA |
| D-06 | Módulos gated | TODOS LIBERADOS — reintegrar | APROVADA |
| D-07 | Estado git/Etapa 0 | RESOLVIDO; stash drop pendente de confirmação | APROVADA (drop pendente) |
| D-01 | Envs EC2 | NÃO VERIFICADO — tratar como ausentes | PENDENTE (acesso host) |

## Novas decisões exigidas por esta consolidação

| ID | Assunto | Contexto | Alternativas | Recomendação técnica | Status |
|---|---|---|---|---|---|
| HD-01 | **Commitar o trabalho não commitado de 21/11** (Gemini+chat+UI, ~870 linhas, testes verdes) | Working tree é a única cópia; sessão morreu sem handoff | (a) commit em branch `feat/gemini-provider` + PR; (b) commit direto na branch atual; (c) descartar | **(a)** — preserva, isola, permite revisão antes de merge | PENDENTE |
| HD-02 | Destino dos PRs documentais #9, #10, #11, #12 | 4 PRs abertos sobrepostos da mesma família de encerramento | (a) mergear todos em ordem; (b) mergear #12 (mais completo) e fechar #9–11; (c) consolidar num só | **(b)/(c)** — #12 contém checklist+encerramento mais recente; verificar sobreposição antes | PENDENTE |
| HD-03 | Política de versionamento de `central/estado/` | Estado vivo (locks/fila/executions/coordinator-runs) parcialmente tracked; `.gitignore` já ignora runs/executions | (a) ignorar todo estado volátil; (b) versionar snapshot periódico; (c) manter como está | **(a)** + snapshot manual em `estado/snapshots/` quando necessário | PENDENTE |
| HD-04 | Podar branches locais e worktrees obsoletas deste repo | 7 branches chore/* já mergeadas + 3 worktrees (2 de branches mergeadas/PR aberto, 1 Antigravity vazia) | (a) remover tudo obsoleto; (b) manter | **(a)** após merge dos PRs de docs | PENDENTE |
| HD-05 | Senha admin fallback `birthhub360` | auth.ts fallback ativo | (a) definir `CENTRAL_ADMIN_PASSWORD` forte; (b) manter | **(a)** | PENDENTE |
| HD-06 | `CENTRAL_NOTIFY_WEBHOOK` | Código pronto, URL vazia | Colar URL Discord/Slack ou deixar desativado | Configurar ou aceitar sem notificações | PENDENTE |
| HD-07 | `LandingPage.tsx`/`film.css` órfãos | Removidos do fluxo por decisão anterior; código morto no repo | (a) deletar; (b) reintroduzir landing | Decisão de produto do usuário | PENDENTE |
| HD-08 | Multi-usuário/roles | Marcado "Futuro" no plano Fase 4 | Implementar agora ou manter single-user local | Manter single-user (app é local/solo) até necessidade real | PENDENTE |
| HD-09 | Agente revisor da plataforma | Produto tem Agente 24; plataforma não tem revisor independente formal | (a) revisões documentais por sessão separada; (b) criar papel "revisor da central" | **(a)** — sessão `subagent_explore` dedicada por entrega | PENDENTE |
| HD-10 | Adapter Gemini para execução de handoffs | Funciona mas não revisado; usa chave do usuário | (a) aprovar como provider experimental; (b) restringir a rotas /api/gemini apenas | **(b)** inicialmente — revisão antes de usar p/ despacho autônomo | PENDENTE |
| HD-11 | Merges do produto (ordem aprovada + PRs #473–476) | Aguardam pareceres 24 | Executar após Onda B | Manter ordem; merges só com autorização | PENDENTE |
| HD-12 | Drop do stash `chore/salvage-stash-00` | D-07: aguardando confirmação | Confirmar drop | Confirmar após verificar PR #429 | PENDENTE |
| HD-13 | Corte de release / SHA candidato | Define urgência real do ARQ-13 (30/11) | Definir data ou deixar waivers expirarem | Se release ≤30/11 → ARQ-13 P0 imediato | PENDENTE |

**Regra:** nenhuma destas foi aprovada por inferência. Itens PENDENTE bloqueiam apenas as tarefas listadas em `09-MATRIZ-DEPENDENCIAS.md`.
