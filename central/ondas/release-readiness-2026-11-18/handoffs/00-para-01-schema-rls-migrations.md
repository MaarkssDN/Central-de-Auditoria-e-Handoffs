- De: 00
- Para: 01 (Schema/Migrations/RLS)
- Status: AGUARDANDO_24
- Prioridade: P1

## Achados

### DEBT-0006 (co) — Fallback global BITRIX24_WEBHOOK_URL — P1, env-dependente
`LeadUseCases.ts:570-576`: org sem BitrixConnection importa de portal global via env não declarada em env.ts. **Verificar se env existe em produção** — se sim, é P0 cross-tenant.
**Ação 01:** remover fallback ou allowlist; declarar env em env.ts. Execução com 06.

### DEBT-0018 (co) — Contact.companyId sem validação de tenant — P1
`PrismaContactRepository.ts:50-85`. Validar `company.findFirst({id, organizationId})`; ideal FK composta `(companyId, organizationId)` no schema — **schema é seu**.

### DEBT-0020 (co) — Importação Bitrix não atômica — P1
`bitrix/service/leads.ts:321-377`, `deals.ts:436-502`. Company/Contact/Lead/Audit sequenciais fora de $transaction → órfãos. Apoiar 06 na migração para `runInTransaction` por item; enrichment só pós-commit.

### DEBT-0056 — Soft delete opt-in inconsistente — P2
`prisma-interceptors.ts:157-176,316-346`: AUDITABLE_MODELS cobre 9 de ~14 models com deletedAt. Derivar do schema ou ampliar + teste de paridade.

### DEBT-0057 — Gate RLS estático com pontos cegos — P2
`check-rls-coverage.ts:39-105`: não cobre tabelas filhas (Note, TimelineEvent, EnrichmentLog, DocumentChunk, CrmPipelineStage, WorkflowVersion, CallAttempt) nem DROP POLICY posterior. Inventário explícito ou verificação runtime vs pg_policy.

### DEBT-0058 — Skips/gaps de schema — P2
`proposalVersioning.test.ts` skips fluxo "Pago"; `piiSearchIndex-contactHash.test.ts` citado em doc mas ausente — verificar se migration existe.

### DEBT-DB-08 — Lacunas FK/tenant no schema — P3
`DataSubjectRequest.contactId` sem FK; `Setting.organizationId` nullable+unique NULL; `Activity` FK só p/ Lead; filhas com orgId sem FK composta.

## Lembrete
Não criar migrations em branches de integração — handoff formal para você. Slot exclusivo: não rodar 01A em paralelo no mesmo domínio.

## Resolução

**Branch:** `agente/01-schema-rls-migrations` | **Worktree:** `C:\Github\Birthub-360-wtg-01` | **Commit:** `150c1686c`

### Entregue
- **DEBT-0006**: `BITRIX24_WEBHOOK_URL` declarado em `env.ts` + nova `BITRIX24_WEBHOOK_URL_ORG_ALLOWLIST`. `resolveGlobalBitrixWebhookUrl(orgId)` em `settings.ts` retorna a env global **somente** para orgs listadas; allowlist vazia = fallback desligado (fail-closed). Aplicado nos 2 call sites: `getBitrixSettings` e `LeadUseCases` (import Bitrix). **Ação necessária em prod (D-01):** se o fallback global for intencional para alguma org, adicionar o orgId na allowlist; caso contrário remover a env.
- **DEBT-0018**: `PrismaContactRepository.create/update` agora validam `company.organizationId === organizationId` antes de gravar (`assertCompanyBelongsToOrg`). FK composta `(companyId, organizationId)` **não aplicada**: Prisma não permite o mesmo scalar (`organizationId`) em duas relações do mesmo model — documentado como limitação; a validação em aplicação é o fechamento correto.
- **DEBT-0056**: `AUDITABLE_MODELS` estendido com `Agent`, `AgentSession`, `CadenceSequence`, `CopilotoConversation`, `Workflow` — todos têm `deletedAt` no schema e código que o preenche, mas reads não filtravam (soft-deleted vazava). Derivado do schema: 14 models com deletedAt = 9 + 5.

### Gates
- `tsc --noEmit` no worktree: **limpo**.

### Não executado (registrado para follow-up)
- **DEBT-0020** (import Bitrix não atômico): requer coordenação com 06 — a transação `$transaction` por item fica em `bitrix/service/leads.ts`/`deals.ts` (dono 06). Sugiro handoff 01→06 com a especificação: `runInTransaction` por item + enrichment pós-commit.
- **DEBT-0057** (gate RLS estático cego): não executado — requer inventário explícito de tabelas filhas vs `pg_policy`.
- **DEBT-0058** (skips/gaps de schema): não executado.
- **DEBT-DB-08** (FK/tenant P3): não executado.
- **Teste de paridade AUDITABLE_MODELS×schema** (sugerido pelo próprio achado): não criado — recomendo script `scripts/governance/check-auditable-parity.mjs` em follow-up.
