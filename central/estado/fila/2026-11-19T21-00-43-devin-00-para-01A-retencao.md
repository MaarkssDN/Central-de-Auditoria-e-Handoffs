# MISSÃO — Executar handoff da Central de Auditoria

Você é o agente executor designado neste handoff. Repositório: C:\Github\Birthub-360
Worktree de trabalho: C:\Github\Birthub-360-wt\ag-01a | Branch: agente/01a-retencao

## Handoff a executar (fonte oficial — atualize Status/Resolução NESTE arquivo ao final)
C:\Github\Central-de-Auditoria-e-Handoffs\central\ondas\release-readiness-2026-11-18\handoffs\00-para-01A-retencao.md

## Conteúdo do handoff
- De: 00
- Para: 01A (Confiabilidade de dados/RLS/retenção)
- Status: PENDENTE
- Prioridade: P1

## Achado principal

### DEBT-0021 — retentionPurge.service.ts dead code + incompatível com RLS — P1
`src/shared/services/retentionPurge.service.ts:46-209`: nunca chamado, sem scheduler; usa prisma global fora de `requestContext.run({tenantId})` → RLS esconde linhas → deleteMany falha silencioso; `auditLogDays` calculado e não usado.
**Correção:** worker dedicado no padrão `bitrixExtractionPurge` (descobrir orgs → requestContext por org); decidir política de AuditLog (append-only c/ triggers — não purgável por DELETE simples).
**Bloqueio:** aguardar janelas oficiais de retenção (decisão humana pendente — ver INDEX.md). Não ligar purge sem elas.

## Achados relacionados (contexto)
- VOZ-01/02: voz (VoiceCallLog, Note, Activity, ThreeCXCallEvent.rawPayload) fora do inventário de expurgo — incluir no desenho de retenção junto com 12/21.
- DB-05/06/08: soft-delete opt-in, pontos cegos do gate RLS, lacunas FK — handoff separado para 01.

## Aceite
Worker agendado purga por org com tenant context; janelas documentadas; teste prova que linhas de tenant são efetivamente removidas e de outros tenants intactas.


## Regras obrigatórias
1. Leia AGENTS.md e o prompt oficial do seu agente em .agents/prompts/ antes de agir.
2. Trabalhe SOMENTE no worktree/branch indicados. Não toque em arquivos de outros agentes.
3. Respeite propriedade de arquivos (server.ts, package.json, lockfiles, prisma/schema.prisma exigem dono específico).
4. Execute a correção mínima descrita no handoff; rode os gates relevantes e registre comando + exit code reais.
5. Ao terminar, atualize o arquivo do handoff NA CENTRAL: mude "- Status:" para AGUARDANDO_24 e preencha "## Resolução" com branch, commits, gates, evidências e limitações.
6. NÃO faça push, merge ou deploy. NÃO declare conclusão sem evidência de gates.
7. Se encontrar dependência não resolvida ou decisão humana pendente, marque Status: BLOQUEADO e explique em ## Resolução.
