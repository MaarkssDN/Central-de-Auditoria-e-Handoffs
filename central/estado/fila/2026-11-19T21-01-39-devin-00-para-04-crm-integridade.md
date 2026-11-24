# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: C:\Github\Birthub-360
Worktree de trabalho: C:\Github\Birthub-360-wt\ag-04 | Branch: agente/04-crm-integridade

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
C:\Github\Central-de-Auditoria-e-Handoffs\central\ondas\release-readiness-2026-11-18\handoffs\00-para-04-crm-integridade.md

## Conteúdo do handoff
- De: 00
- Para: 04 (CRM/BI)
- Status: PENDENTE
- Prioridade: P1

## Achados

### DEBT-0016 — batchUpdateLeads não atômico — P1
`LeadUseCases.ts:675-791`: status persiste via updateLeadStatus, owner/tags em update separado; falha na 2ª → failedCount conta item cujo status já mudou. PR #390 mantém trade-off documentado; **adendo 24 pendente** — resolver junto.
**Correção:** resultado por campo ou transação; diferenciar rejected/partialFailure.

### DEBT-0017 (co 07) — Status fora do fluxo canônico — P1
`mesaTratamento.routes.ts:282-322`: register grava status direto sem LeadStageHistory/pipeline/closedAt/integrações (where final sem organizationId). `aiPendingAction.service.ts:252-271` (c/ 07): start_cadence idem.
**Correção:** delegar a `updateLeadStatus` canônico.

### DEBT-0018 — Contact.companyId sem tenant — P1 (execução c/ 01 p/ FK)
### DEBT-0019 — Company hard delete sem guarda — P1
`PrismaCompanyRepository.ts:181-185`: schema tem deletedAt/deletedBy/deleteReason não usados. Soft delete ou preflight de dependências.

### DEBT-0028 — convertLead reabre deal fechado — P2
`PrismaCrm360Repository.ts:484-505`: sem validação de estado terminal, zera closedAt.

### DEBT-0030 — LeadStageHistory best-effort — P2
`leadStageHistory.service.ts:44-50` engole erro; update+histórico não transacionais.

### DEBT-0031/0032 — where sem orgId em escritas Contact/Activity; funil Negócio hardcoded pilotos — P2
### DEBT-CRM-10/11 — TMQ null por stageName enum≠label; getMetrics mascara erro como vazio — P2/P3

## Nota
PR #390 já corrige tenancy FKs + CYC-007 + status via updateLeadStatus — confirmar diff antes de duplicar trabalho.


## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "- Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
