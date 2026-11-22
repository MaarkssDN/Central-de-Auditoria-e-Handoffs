# 14 — PLANO DE INTEGRAÇÃO (branches e PRs)

## A. Repo Central (`Central-de-Auditoria-e-Handoffs`)

### Estado atual

- Branch atual `chore/handoff-devin-versionamento-20261121` = origin, **PR #12 OPEN** (2 commits: encerramento versionamento + checklist HTML).
- Working tree suja com trabalho de 21/11 (não commitado).
- PRs #9, #10, #11 OPEN — mesma família documental, sobrepostos.

### Sequência recomendada

1. **HD-01 primeiro:** commitar o trabalho de 21/11 em branch nova `feat/gemini-provider-chat` a partir da atual (ou de main após merge do #12). Incluir: `server/geminiService.ts`, `geminiService.test.ts`, `db.test.ts`, diffs de `server/{db,centralApi,agentRuntime,phase1/adapters,providers,ts}`, `src/components/{AuditReviewView,HandoffsCenterView,FilesView}.tsx`, `.env.example`. **NÃO** incluir: `central/estado/*` (ver HD-03), handoffs `00-para-*` (transições legítimas — decidir se versiona junto ou em commit separado de estado).
2. **PRs documentais:** verificar sobreposição #9–#12 (`gh pr diff`). Recomendado: mergear #12 primeiro (contém o mais recente), depois #9–11 apenas do que sobrar, ou fechar duplicados com comentário.
3. **Limpeza pós-merge:** podar branches `chore/*` mergeadas e worktrees obsoletas (HD-04).
4. **Consolidação (este trabalho):** os 18 documentos de `central/consolidacao/` devem ser commitados — sugestão: na branch do PR #12 ou em `docs/consolidacao-global-20261122` → PR próprio.

### Regras

- Staging sempre explícito (nunca `git add -A`) — histórico de sessões paralelas.
- Nunca push/merge sem autorização do Orquestrador Humano.
- Estado volátil (`locks/`, `fila/` novos) não deve entrar em commits de código — decidir em HD-03.

## B. Repo produto (`Birthub-360`)

### Branches `agente/*` pendentes de reconciliação

| Branch | Entrega | PR | Ação recomendada |
|---|---|---|---|
| `agente/01-schema-rls-migrations` | `150c1686c` | #476 | Revisão 24 → merge ou retrabalho |
| `agente/09-mobile-decisao` | `f797f15b7` | #475 | Idem |
| `agente/10-infra-backup-deploy` | `af70a8787` | #473 | Idem |
| `agente/16-workers-filqs` | `bd8597e23` | #474 | Idem |
| `agente/07-ia-debts-*` | ? | ? | Verificar conteúdo × main (parcialmente mergeado?) |
| `agente/00-correcao-p0-auditoria` | P0 fixes | ? | Verificar × main |
| `agente/01A/02/04/05-*` | lote 2 | nenhuma | Verificar commits nos worktrees antes de qualquer merge |
| `chore/salvage-stash-00` | salvage | #429 | Merge ou fechar; depois drop stash (HD-12) |
| `integracao/schema-*` | migrations derivadas | — | Base para CENTRAL-0026a |

### Ordem de merge do produto (aprovada em D-07)

`#401/#413 → #415 → saneamento (AUD-1/ONDAS) → antigos → docs`

**Ressalva:** essa ordem precede os PRs #473–476 e o resultado da Onda B. Ordem final deve ser re-emitida após reconciliação (CENTRAL-0021) e pareceres 24 — merges de código só após gates de integração.

## C. Checklist de integração por PR

- [ ] Diff revisado (sem arquivos fora do escopo)
- [ ] Gates verdes no head do PR
- [ ] Parecer 24 (produto) / revisão (plataforma)
- [ ] Sem conflito com main atual
- [ ] Autorização humana registrada
- [ ] Merge + validação pós-merge (smoke)
- [ ] Branch/worktree limpos após merge
